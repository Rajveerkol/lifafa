-- ==============================================================================
-- Migration: 018_payrupee_payout_and_bank_account_protection.sql
-- Description: 1. Fail-closed bank account encryption using Supabase Vault.
--              2. Vault schema & decrypted_secrets privilege hardening.
--              3. Dedicated locked-down table (withdrawal_bank_credentials).
--              4. Transactional migration of legacy plaintext rows with count verification.
--              5. Post-verification wiping of plaintext from public.withdrawals.
--              6. Strict service-role-only decryption RPC (postgrest execution revoked).
--              7. Deterministic PayRupee provider_order_id.
-- Target: Supabase SQL Editor
-- ==============================================================================

-- 1. FAIL-CLOSED PRE-CHECK: VERIFY VAULT EXTENSION & DEDICATED SECRET EXIST
DO $$
DECLARE
    v_key TEXT;
BEGIN
    -- Verify vault schema and decrypted_secrets view exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_views WHERE schemaname = 'vault' AND viewname = 'decrypted_secrets'
    ) THEN
        RAISE EXCEPTION 'Migration 018 aborted: Supabase Vault extension is not enabled. Run in Supabase SQL editor: CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;';
    END IF;

    -- Verify payout_encryption_key secret is configured in vault
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'payout_encryption_key'
    LIMIT 1;

    IF v_key IS NULL OR LENGTH(TRIM(v_key)) = 0 THEN
        RAISE EXCEPTION 'Migration 018 aborted: payout_encryption_key secret is missing from Supabase Vault. Add it first in Supabase SQL editor: SELECT vault.create_secret(''<YOUR_SECURE_KEY>'', ''payout_encryption_key'', ''Dedicated bank payout key'');';
    END IF;
END $$;

-- 2. VAULT SCHEMA & VIEW PRIVILEGE HARDENING & FAIL-CLOSED ENFORCEMENT
-- In Supabase hosted PostgreSQL, vault objects are owned by supabase_admin.
-- Blindly revoking routines/tables owned by supabase_admin triggers error 42501.
-- Instead, we fail-closed assert that anon & authenticated have zero access,
-- and guarantee that service_role retains USAGE and SELECT.
DO $$
BEGIN
    -- Verify anon has zero access to vault schema
    IF has_schema_privilege('anon', 'vault', 'USAGE') THEN
        RAISE EXCEPTION 'Security assertion failed: anon role has USAGE access to vault schema';
    END IF;

    -- Verify authenticated has zero access to vault schema
    IF has_schema_privilege('authenticated', 'vault', 'USAGE') THEN
        RAISE EXCEPTION 'Security assertion failed: authenticated role has USAGE access to vault schema';
    END IF;

    -- Verify anon has zero access to vault.decrypted_secrets
    IF has_table_privilege('anon', 'vault.decrypted_secrets', 'SELECT') THEN
        RAISE EXCEPTION 'Security assertion failed: anon role can SELECT from vault.decrypted_secrets';
    END IF;

    -- Verify authenticated has zero access to vault.decrypted_secrets
    IF has_table_privilege('authenticated', 'vault.decrypted_secrets', 'SELECT') THEN
        RAISE EXCEPTION 'Security assertion failed: authenticated role can SELECT from vault.decrypted_secrets';
    END IF;

    -- Verify service_role has USAGE on vault schema
    IF NOT has_schema_privilege('service_role', 'vault', 'USAGE') THEN
        RAISE EXCEPTION 'Configuration error: service_role lacks USAGE access to vault schema';
    END IF;

    -- Verify service_role has SELECT on vault.decrypted_secrets
    IF NOT has_table_privilege('service_role', 'vault.decrypted_secrets', 'SELECT') THEN
        RAISE EXCEPTION 'Configuration error: service_role lacks SELECT access to vault.decrypted_secrets';
    END IF;
END $$;

-- 3. ADD PROVIDER ORDER ID TO WITHDRAWALS FOR DETERMINISTIC IDEMPOTENCY
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'provider_order_id'
    ) THEN
        ALTER TABLE public.withdrawals 
        ADD COLUMN provider_order_id TEXT UNIQUE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_withdrawals_provider_order_id ON public.withdrawals(provider_order_id);

-- 4. CREATE ISOLATED BANK CREDENTIALS TABLE (LOCKED DOWN FROM BROWSER / AUTHENTICATED USERS)
CREATE TABLE IF NOT EXISTS public.withdrawal_bank_credentials (
    withdrawal_id UUID PRIMARY KEY REFERENCES public.withdrawals(id) ON DELETE CASCADE,
    encrypted_account_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on the isolated credentials table
ALTER TABLE public.withdrawal_bank_credentials ENABLE ROW LEVEL SECURITY;

-- Physically revoke all table privileges from public, anon, and authenticated roles
REVOKE ALL ON TABLE public.withdrawal_bank_credentials FROM PUBLIC, anon, authenticated;

-- Grant access exclusively to service_role
GRANT ALL ON TABLE public.withdrawal_bank_credentials TO service_role;

-- Ensure service_role policy is explicitly defined
DROP POLICY IF EXISTS "Service role only access to bank credentials" ON public.withdrawal_bank_credentials;
CREATE POLICY "Service role only access to bank credentials"
    ON public.withdrawal_bank_credentials FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- 5. ENCRYPTION HELPER (STRICT VAULT RETRIEVAL: FAIL-CLOSED, ZERO JWT FALLBACK)
CREATE OR REPLACE FUNCTION public.encrypt_bank_account(p_account_number TEXT)
RETURNS TEXT AS $$
DECLARE
    v_key TEXT;
BEGIN
    IF p_account_number IS NULL OR LENGTH(TRIM(p_account_number)) = 0 THEN
        RETURN NULL;
    END IF;

    -- Strictly read dedicated payout encryption key from Supabase Vault
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'payout_encryption_key'
    LIMIT 1;

    IF v_key IS NULL OR LENGTH(TRIM(v_key)) = 0 THEN
        RAISE EXCEPTION 'Dedicated payout encryption key is not configured in Supabase Vault (vault.decrypted_secrets)';
    END IF;

    RETURN encode(extensions.pgp_sym_encrypt(TRIM(p_account_number), v_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

-- 6. STRICT SERVICE-ROLE-ONLY DECRYPTION RPC (NO ADMIN EXCEPTION)
CREATE OR REPLACE FUNCTION public.get_decrypted_bank_account_rpc(p_withdrawal_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_encrypted TEXT;
    v_key TEXT;
BEGIN
    -- Strict service_role enforcement: NO admin bypass
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: service_role required';
    END IF;

    SELECT encrypted_account_number INTO v_encrypted
    FROM public.withdrawal_bank_credentials
    WHERE withdrawal_id = p_withdrawal_id;

    IF v_encrypted IS NULL THEN
        RETURN NULL;
    END IF;

    -- Strictly read dedicated payout encryption key from Supabase Vault
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'payout_encryption_key'
    LIMIT 1;

    IF v_key IS NULL OR LENGTH(TRIM(v_key)) = 0 THEN
        RAISE EXCEPTION 'Dedicated payout encryption key is not configured in Supabase Vault (vault.decrypted_secrets)';
    END IF;

    RETURN extensions.pgp_sym_decrypt(decode(v_encrypted, 'base64'), v_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

-- Revoke all execute permissions from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.get_decrypted_bank_account_rpc(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_decrypted_bank_account_rpc(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_decrypted_bank_account_rpc(UUID) FROM authenticated;

-- Grant execute exclusively to service_role
GRANT EXECUTE ON FUNCTION public.get_decrypted_bank_account_rpc(UUID) TO service_role;

-- 7. TRANSACTIONAL MIGRATION OF LEGACY PLAINTEXT DATA WITH VERIFICATION & WIPE
DO $$
DECLARE
    v_total_plaintext_count INT;
    v_inserted_count INT;
BEGIN
    -- Count all existing rows with non-null bank_account_encrypted across ALL lifecycle states
    SELECT COUNT(*) INTO v_total_plaintext_count
    FROM public.withdrawals
    WHERE bank_account_encrypted IS NOT NULL 
      AND LENGTH(TRIM(bank_account_encrypted)) > 0;

    IF v_total_plaintext_count > 0 THEN
        -- Encrypt each plaintext bank account number into withdrawal_bank_credentials
        INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number, created_at)
        SELECT 
            w.id,
            public.encrypt_bank_account(w.bank_account_encrypted),
            w.created_at
        FROM public.withdrawals w
        WHERE w.bank_account_encrypted IS NOT NULL 
          AND LENGTH(TRIM(w.bank_account_encrypted)) > 0
        ON CONFLICT (withdrawal_id) DO NOTHING;

        -- Verify that every plaintext row has an encrypted credential row
        SELECT COUNT(*) INTO v_inserted_count
        FROM public.withdrawal_bank_credentials c
        JOIN public.withdrawals w ON w.id = c.withdrawal_id
        WHERE w.bank_account_encrypted IS NOT NULL 
          AND LENGTH(TRIM(w.bank_account_encrypted)) > 0;

        IF v_inserted_count < v_total_plaintext_count THEN
            RAISE EXCEPTION 'Migration 018 verification failed: Only % of % plaintext credentials migrated. Transaction aborted.',
                v_inserted_count, v_total_plaintext_count;
        END IF;

        -- Wipe plaintext from public.withdrawals so browser queries (SELECT *) cannot see it
        UPDATE public.withdrawals
        SET bank_account_encrypted = NULL
        WHERE bank_account_encrypted IS NOT NULL;
    END IF;
END $$;

-- 8. UPDATE request_withdrawal_rpc TO ROUTE ENCRYPTED CREDENTIALS TO ISOLATED TABLE
CREATE OR REPLACE FUNCTION public.request_withdrawal_rpc(
    p_amount NUMERIC(12, 2),
    p_account_holder_name TEXT,
    p_bank_account_number TEXT,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_fee NUMERIC(12, 2) := 0.00;
    v_fee_rec RECORD;
    v_net_amount NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_key TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to withdraw';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
    END IF;

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- Idempotency check
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- Platform fee calculation
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'WITHDRAWAL' AND is_active = TRUE;
    
    IF FOUND THEN
        IF v_fee_rec.calculation_type = 'FIXED' THEN
            v_fee := v_fee_rec.value;
        ELSIF v_fee_rec.calculation_type = 'PERCENTAGE' THEN
            v_fee := ROUND((p_amount * v_fee_rec.value / 100.0), 2);
        END IF;
    END IF;

    v_net_amount := p_amount - v_fee;
    IF v_net_amount <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount after fees must be greater than 0';
    END IF;

    -- Row lock on wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_wallet.available_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient available balance. Available: %, Requested: %', v_wallet.available_balance, p_amount;
    END IF;

    IF p_bank_account_number IS NOT NULL AND LENGTH(TRIM(p_bank_account_number)) >= 4 THEN
        v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
        -- Fail-closed Vault encryption
        v_encrypted_acc := public.encrypt_bank_account(p_bank_account_number);
    ELSE
        v_masked_acc := 'UPI: ' || COALESCE(p_upi_id, 'N/A');
        v_encrypted_acc := NULL;
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - p_amount;

    UPDATE public.wallets
    SET available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Insert withdrawal: bank_account_encrypted remains strictly NULL
    INSERT INTO public.withdrawals (
        user_id,
        amount,
        fee_amount,
        net_amount,
        account_holder_name,
        bank_account_number_masked,
        bank_account_encrypted,
        ifsc_code,
        upi_id,
        status,
        payout_provider,
        idempotency_key
    ) VALUES (
        v_user_id,
        p_amount,
        v_fee,
        v_net_amount,
        p_account_holder_name,
        v_masked_acc,
        NULL,
        p_ifsc_code,
        p_upi_id,
        'PENDING',
        'PAYRUPEE',
        v_key
    ) RETURNING id INTO v_withdrawal_id;

    -- Insert encrypted credential into isolated credentials table
    IF v_encrypted_acc IS NOT NULL THEN
        INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number)
        VALUES (v_withdrawal_id, v_encrypted_acc);
    END IF;

    -- Ledger transaction
    INSERT INTO public.wallet_transactions (
        user_id,
        wallet_id,
        amount,
        type,
        status,
        reference_type,
        reference_id,
        idempotency_key,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        v_user_id,
        v_wallet.id,
        -p_amount,
        'WITHDRAWAL',
        'COMPLETED',
        'WITHDRAWAL',
        v_withdrawal_id,
        'tx_' || v_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'fee_amount', v_fee,
            'net_amount', v_net_amount,
            'account_holder', p_account_holder_name,
            'account_masked', v_masked_acc
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'net_amount', v_net_amount,
        'fee', v_fee,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

-- 9. UPDATE claim_lifafa_rpc TO POPULATE ISOLATED CREDENTIALS FOR UPI_BANK
CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc(
    p_code TEXT,
    p_pin_code VARCHAR(10) DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lifafa RECORD;
    v_allocation RECORD;
    v_user_wallet RECORD;
    v_creator_wallet RECORD;
    v_claim_id UUID;
    v_withdrawal_id UUID := NULL;
    v_claim_amount NUMERIC(12, 2);
    v_uncompleted_count INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_existing_claim RECORD;
    v_secret RECORD;
    v_device_claims_count INT;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT := NULL;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim a Lifafa';
    END IF;

    v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_' || v_user_id::text);

    -- 1. Check idempotency
    SELECT * INTO v_existing_claim
    FROM public.lifafa_claims
    WHERE idempotency_key = v_effective_idempotency 
       OR (lifafa_id IN (SELECT id FROM public.lifafas WHERE code = TRIM(p_code)) AND user_id = v_user_id);

    IF FOUND THEN
        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;
        RETURN jsonb_build_object(
            'success', true,
            'amount', v_existing_claim.amount,
            'lifafa_code', p_code,
            'is_duplicate', true,
            'payout_mode', v_existing_claim.payout_mode,
            'withdrawal_id', v_existing_claim.withdrawal_id,
            'new_balance', v_balance_after
        );
    END IF;

    -- 2. Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE code = TRIM(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa with code % does not exist', p_code;
    END IF;

    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa has not started yet. Starts at: %', v_lifafa.starts_at;
    END IF;

    IF v_lifafa.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Lifafa is not active (Status: %)', v_lifafa.status;
    END IF;

    IF v_lifafa.expires_at <= NOW() THEN
        UPDATE public.lifafas SET status = 'EXPIRED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'Lifafa has expired';
    END IF;

    IF v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0.00 THEN
        UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'All Lifafa rewards have already been claimed';
    END IF;

    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
            RAISE EXCEPTION 'Account holder name as per bank records is required';
        END IF;

        IF (p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 6)
           AND (p_upi_id IS NULL OR LENGTH(TRIM(p_upi_id)) < 3) THEN
            RAISE EXCEPTION 'A valid Bank Account Number or UPI ID is required for payout';
        END IF;

        IF p_ifsc_code IS NOT NULL AND LENGTH(TRIM(p_ifsc_code)) > 0 AND NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
            RAISE EXCEPTION 'Invalid IFSC code format (e.g. SBIN0001234)';
        END IF;

        IF p_upi_id IS NOT NULL AND LENGTH(TRIM(p_upi_id)) > 0 AND NOT (TRIM(p_upi_id) ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
            RAISE EXCEPTION 'Invalid UPI ID format (e.g. name@okhdfcbank)';
        END IF;
    END IF;

    IF p_device_fingerprint IS NOT NULL AND v_lifafa.device_claim_limit > 0 THEN
        SELECT COUNT(*) INTO v_device_claims_count
        FROM public.lifafa_claims
        WHERE lifafa_id = v_lifafa.id AND device_fingerprint = p_device_fingerprint;

        IF v_device_claims_count >= v_lifafa.device_claim_limit THEN
            RAISE EXCEPTION 'Device claim limit (% per device) reached for this Lifafa', v_lifafa.device_claim_limit;
        END IF;
    END IF;

    SELECT * INTO v_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND THEN
        IF p_pin_code IS NULL OR LENGTH(TRIM(p_pin_code)) = 0 THEN
            RAISE EXCEPTION 'Secret PIN code is required to claim this Lifafa';
        END IF;

        IF v_secret.pin_code_hash <> crypt(TRIM(p_pin_code), v_secret.pin_code_hash) THEN
            RAISE EXCEPTION 'Incorrect PIN code entered';
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_uncompleted_count
    FROM public.lifafa_tasks t
    WHERE t.lifafa_id = v_lifafa.id
      AND t.is_required = TRUE
      AND t.is_enabled = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM public.task_completions tc
          WHERE tc.task_id = t.id AND tc.user_id = v_user_id AND tc.status = 'VERIFIED'
      );

    IF v_uncompleted_count > 0 THEN
        RAISE EXCEPTION 'Please complete and verify all required community tasks before claiming';
    END IF;

    SELECT * INTO v_allocation
    FROM public.lifafa_allocations
    WHERE lifafa_id = v_lifafa.id AND is_claimed = FALSE
    ORDER BY allocation_index ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'No available rewards remaining in this Lifafa';
    END IF;

    v_claim_amount := v_allocation.amount;

    UPDATE public.lifafa_allocations
    SET is_claimed = TRUE,
        claimed_by = v_user_id,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = GREATEST(0.00, remaining_amount - v_claim_amount),
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0.00 
                THEN 'COMPLETED'::lifafa_status 
            ELSE 'ACTIVE'::lifafa_status 
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - v_claim_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        IF p_bank_account_number IS NOT NULL AND LENGTH(TRIM(p_bank_account_number)) >= 4 THEN
            v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
            v_encrypted_acc := public.encrypt_bank_account(p_bank_account_number);
        ELSE
            v_masked_acc := 'UPI: ' || COALESCE(TRIM(p_upi_id), 'N/A');
            v_encrypted_acc := NULL;
        END IF;

        INSERT INTO public.withdrawals (
            user_id,
            amount,
            fee_amount,
            net_amount,
            account_holder_name,
            bank_account_number_masked,
            bank_account_encrypted,
            ifsc_code,
            upi_id,
            status,
            payout_provider,
            idempotency_key
        ) VALUES (
            v_user_id,
            v_claim_amount,
            0.00,
            v_claim_amount,
            TRIM(p_account_holder_name),
            v_masked_acc,
            NULL,
            NULLIF(UPPER(TRIM(p_ifsc_code)), ''),
            NULLIF(LOWER(TRIM(p_upi_id)), ''),
            'PENDING',
            'PAYRUPEE',
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        IF v_encrypted_acc IS NOT NULL THEN
            INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number)
            VALUES (v_withdrawal_id, v_encrypted_acc);
        END IF;

        INSERT INTO public.lifafa_claims (
            lifafa_id,
            user_id,
            allocation_id,
            amount,
            idempotency_key,
            device_fingerprint,
            ip_address,
            payout_mode,
            withdrawal_id
        ) VALUES (
            v_lifafa.id,
            v_user_id,
            v_allocation.id,
            v_claim_amount,
            v_effective_idempotency,
            p_device_fingerprint,
            p_ip_address,
            'UPI_BANK',
            v_withdrawal_id
        ) RETURNING id INTO v_claim_id;

        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'UPI_BANK',
            'withdrawal_id', v_withdrawal_id,
            'withdrawal_status', 'PENDING',
            'new_balance', v_balance_after
        );

    ELSE
        SELECT * INTO v_user_wallet 
        FROM public.wallets 
        WHERE user_id = v_user_id 
        FOR UPDATE;

        v_balance_before := v_user_wallet.available_balance;
        v_balance_after := v_balance_before + v_claim_amount;

        UPDATE public.wallets
        SET available_balance = available_balance + v_claim_amount,
            total_earned = total_earned + v_claim_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_user_wallet.id;

        INSERT INTO public.lifafa_claims (
            lifafa_id,
            user_id,
            allocation_id,
            amount,
            idempotency_key,
            device_fingerprint,
            ip_address,
            payout_mode
        ) VALUES (
            v_lifafa.id,
            v_user_id,
            v_allocation.id,
            v_claim_amount,
            v_effective_idempotency,
            p_device_fingerprint,
            p_ip_address,
            'WALLET'
        ) RETURNING id INTO v_claim_id;

        INSERT INTO public.wallet_transactions (
            user_id,
            wallet_id,
            amount,
            type,
            status,
            reference_type,
            reference_id,
            idempotency_key,
            balance_before,
            balance_after,
            metadata
        ) VALUES (
            v_user_id,
            v_user_wallet.id,
            v_claim_amount,
            'CLAIM',
            'COMPLETED',
            'LIFAFA_CLAIM',
            v_claim_id,
            'tx_claim_' || v_effective_idempotency,
            v_balance_before,
            v_balance_after,
            jsonb_build_object(
                'lifafa_id', v_lifafa.id,
                'lifafa_code', v_lifafa.code,
                'claim_id', v_claim_id,
                'creator_id', v_lifafa.creator_id
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'WALLET',
            'new_balance', v_balance_after
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

-- 10. CLEAN RPC EXECUTE GRANTS
GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
