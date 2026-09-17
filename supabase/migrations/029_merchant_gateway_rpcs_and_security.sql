-- ==============================================================================
-- Migration: 029_merchant_gateway_rpcs_and_security.sql
-- Description: Transactional RPCs, Dedicated Vault Encryption/Decryption,
--              Secure Server-Side API Key Generation (Secret Returned Once),
--              2% Deposit Approval, Tiered Payout Fees, Inbound Webhook State
--              Machine with Auto-Refund, and Full Row Level Security (RLS).
-- Target: Supabase SQL Editor (Manual Execution after Review)
-- ==============================================================================

-- 1. MERCHANT ROLE CHECK HELPER
CREATE OR REPLACE FUNCTION public.is_merchant(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.merchants
        WHERE user_id = check_user_id AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. DEDICATED VAULT ENCRYPTION FUNCTION FOR MERCHANT BANK CREDENTIALS
-- Fail-closed retrieval of dedicated payout_encryption_key from Supabase Vault
CREATE OR REPLACE FUNCTION public.encrypt_merchant_bank_account(p_account_number TEXT)
RETURNS TEXT AS $$
DECLARE
    v_key TEXT;
BEGIN
    IF p_account_number IS NULL OR LENGTH(TRIM(p_account_number)) = 0 THEN
        RETURN NULL;
    END IF;

    -- Retrieve dedicated payout encryption key from Supabase Vault
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

-- Revoke all execute permissions from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.encrypt_merchant_bank_account(TEXT) FROM PUBLIC, anon, authenticated;
-- Grant execute to service_role (and callable by internal SECURITY DEFINER functions)
GRANT EXECUTE ON FUNCTION public.encrypt_merchant_bank_account(TEXT) TO service_role;

-- 3. DEDICATED VAULT DECRYPTION FUNCTION FOR MERCHANT BANK CREDENTIALS (SERVICE-ROLE ONLY)
CREATE OR REPLACE FUNCTION public.get_decrypted_merchant_bank_account_rpc(p_payout_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_encrypted TEXT;
    v_key TEXT;
BEGIN
    -- Strict service_role enforcement: NO client or admin bypass
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: service_role required';
    END IF;

    SELECT encrypted_account_number INTO v_encrypted
    FROM public.merchant_payout_bank_credentials
    WHERE payout_id = p_payout_id;

    IF v_encrypted IS NULL THEN
        RETURN NULL;
    END IF;

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

REVOKE ALL ON FUNCTION public.get_decrypted_merchant_bank_account_rpc(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_merchant_bank_account_rpc(UUID) TO service_role;

-- 4. SECURE SERVER-SIDE API KEY GENERATION RPC (PLAINTEXT RETURNED ONCE ONLY)
CREATE OR REPLACE FUNCTION public.merchant_generate_api_key_rpc(
    p_merchant_id UUID,
    p_key_name TEXT DEFAULT 'Primary API Key'
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_key_id UUID;
    v_client_id TEXT;
    v_raw_secret TEXT;
    v_secret_hash TEXT;
BEGIN
    -- Verify ownership
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this active merchant account';
        END IF;
    END IF;

    -- Generate cryptographically secure random credentials
    -- client_id: pk_live_<32 hex chars>
    v_client_id := 'pk_live_' || encode(extensions.gen_random_bytes(16), 'hex');
    -- client_secret: sk_live_<48 hex chars>
    v_raw_secret := 'sk_live_' || encode(extensions.gen_random_bytes(24), 'hex');

    -- Compute SHA-256 hash using pgcrypto digest
    v_secret_hash := encode(extensions.digest(v_raw_secret, 'sha256'), 'hex');
    v_key_id := gen_random_uuid();

    -- Store ONLY the cryptographic hash in database (plaintext secret is NEVER stored)
    INSERT INTO public.merchant_api_keys (
        id,
        merchant_id,
        key_name,
        client_id,
        client_secret_hash,
        is_active
    ) VALUES (
        v_key_id,
        p_merchant_id,
        COALESCE(NULLIF(TRIM(p_key_name), ''), 'Primary API Key'),
        v_client_id,
        v_secret_hash,
        TRUE
    );

    -- Plaintext client_secret is returned ONLY ONCE in this response
    RETURN jsonb_build_object(
        'success', true,
        'key_id', v_key_id,
        'client_id', v_client_id,
        'client_secret', v_raw_secret,
        'key_name', COALESCE(NULLIF(TRIM(p_key_name), ''), 'Primary API Key')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 5. API KEY REVOCATION RPC
CREATE OR REPLACE FUNCTION public.merchant_revoke_api_key_rpc(p_key_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
BEGIN
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchant_api_keys k
            JOIN public.merchants m ON m.id = k.merchant_id
            WHERE k.id = p_key_id AND m.user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this API key';
        END IF;
    END IF;

    UPDATE public.merchant_api_keys
    SET is_active = FALSE
    WHERE id = p_key_id;

    RETURN jsonb_build_object('success', true, 'key_id', p_key_id, 'is_active', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. MERCHANT API KEYS LISTING RPC (NEVER RETURNS SECRET OR SECRET HASH)
CREATE OR REPLACE FUNCTION public.merchant_list_api_keys_rpc(p_merchant_id UUID)
RETURNS TABLE (
    id UUID,
    merchant_id UUID,
    key_name TEXT,
    client_id TEXT,
    is_active BOOLEAN,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
BEGIN
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE public.merchants.id = p_merchant_id
              AND public.merchants.user_id = v_caller_uid
              AND public.merchants.status = 'ACTIVE'
        ) AND NOT public.is_admin(v_caller_uid) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    RETURN QUERY
    SELECT 
        k.id,
        k.merchant_id,
        k.key_name,
        k.client_id,
        k.is_active,
        k.last_used_at,
        k.created_at
    FROM public.merchant_api_keys k
    WHERE k.merchant_id = p_merchant_id
    ORDER BY k.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_list_api_keys_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_list_api_keys_rpc(UUID) TO authenticated, service_role;

-- 7. MERCHANT PAYOUT INITIATION RPC (ATOMIC FLOAT DEDUCTION & TIERED FEE)
CREATE OR REPLACE FUNCTION public.merchant_initiate_payout_rpc(
    p_merchant_id UUID,
    p_order_id TEXT,
    p_amount NUMERIC(12, 2),
    p_account_holder_name TEXT,
    p_bank_account_number TEXT,
    p_ifsc_code TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_existing_status TEXT;
    v_wallet RECORD;
    v_min_payout NUMERIC(12, 2);
    v_max_payout NUMERIC(12, 2);
    v_fee NUMERIC(12, 2);
    v_total_deducted NUMERIC(12, 2);
    v_payout_id UUID;
    v_provider_order_id TEXT;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT;
    v_idem_key TEXT;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    -- 1. Authorization check
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this active merchant account';
        END IF;
    END IF;

    -- 2. Input validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payout amount must be greater than zero';
    END IF;

    -- Configurable Limits from platform_settings
    SELECT COALESCE(value::NUMERIC, 10.00) INTO v_min_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MIN_PAYOUT_AMOUNT';
    IF v_min_payout IS NULL THEN v_min_payout := 10.00; END IF;

    SELECT COALESCE(value::NUMERIC, 1000.00) INTO v_max_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MAX_PAYOUT_AMOUNT';
    IF v_max_payout IS NULL THEN v_max_payout := 1000.00; END IF;

    IF p_amount < v_min_payout THEN
        RAISE EXCEPTION 'Payout amount % is below minimum allowed %', p_amount, v_min_payout;
    END IF;
    IF p_amount > v_max_payout THEN
        RAISE EXCEPTION 'Payout amount % exceeds maximum allowed %', p_amount, v_max_payout;
    END IF;

    IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 4 THEN
        RAISE EXCEPTION 'A valid bank account number is required';
    END IF;

    IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
        RAISE EXCEPTION 'A valid 11-character IFSC code is required';
    END IF;

    IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
        RAISE EXCEPTION 'Account holder name is required';
    END IF;

    -- 3. Exact Tiered Payout Fee Calculation
    -- <= 100.00 => ₹3.70 | > 100.00 and <= 1000.00 => ₹3.80
    IF p_amount <= 100.00 THEN
        v_fee := 3.70;
    ELSE
        v_fee := 3.80;
    END IF;
    v_total_deducted := p_amount + v_fee;

    -- 4. Idempotency Check
    v_idem_key := COALESCE(p_idempotency_key, 'mch_py_' || p_merchant_id::text || '_' || p_order_id);
    SELECT id, provider_order_id, status INTO v_payout_id, v_provider_order_id, v_existing_status
    FROM public.merchant_payouts
    WHERE idempotency_key = v_idem_key OR (merchant_id = p_merchant_id AND order_id = p_order_id);

    IF v_payout_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'payout_id', v_payout_id,
            'provider_order_id', v_provider_order_id,
            'status', v_existing_status,
            'idempotent', true
        );
    END IF;

    -- 5. Pessimistic float lock on merchant wallet
    SELECT * INTO v_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = p_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant wallet not found';
    END IF;

    IF v_wallet.available_balance < v_total_deducted THEN
        RAISE EXCEPTION 'Insufficient merchant float balance. Required: %, Available: %',
            v_total_deducted, v_wallet.available_balance;
    END IF;

    -- 6. Encrypt bank account number using dedicated Vault helper
    v_encrypted_acc := public.encrypt_merchant_bank_account(p_bank_account_number);
    v_masked_acc := '•••• •••• ' || RIGHT(TRIM(p_bank_account_number), 4);

    -- 7. Generate payout UUID and deterministic provider order ID
    v_payout_id := gen_random_uuid();
    v_provider_order_id := 'GW_ORD_' || REPLACE(v_payout_id::text, '-', '');

    -- 8. Deduct float: available_balance -> locked_payout_balance
    v_bal_before := v_wallet.available_balance;
    v_bal_mid := v_bal_before - p_amount;
    v_bal_after := v_bal_mid - v_fee;

    UPDATE public.merchant_wallets
    SET 
        available_balance = v_bal_after,
        locked_payout_balance = locked_payout_balance + v_total_deducted,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 9. Append immutable ledger audit entries
    INSERT INTO public.merchant_ledger_entries (
        merchant_id, wallet_id, amount, fee_amount, entry_type,
        reference_type, reference_id, idempotency_key,
        balance_before, balance_after, metadata
    ) VALUES 
    (
        p_merchant_id, v_wallet.id, -p_amount, 0.00, 'PAYOUT_LOCK',
        'PAYOUT', v_payout_id::text, v_idem_key || '_lock_amt',
        v_bal_before, v_bal_mid,
        jsonb_build_object('order_id', p_order_id, 'provider_order_id', v_provider_order_id)
    ),
    (
        p_merchant_id, v_wallet.id, -v_fee, v_fee, 'PAYOUT_FEE_LOCK',
        'PAYOUT', v_payout_id::text, v_idem_key || '_lock_fee',
        v_bal_mid, v_bal_after,
        jsonb_build_object('order_id', p_order_id, 'fee', v_fee)
    );

    -- 10. Insert payout record with initial status = 'PENDING'
    INSERT INTO public.merchant_payouts (
        id, merchant_id, order_id, provider_order_id,
        amount, fee_amount, total_deducted,
        account_holder_name, bank_account_number_masked, ifsc_code,
        status, payout_provider, idempotency_key
    ) VALUES (
        v_payout_id, p_merchant_id, p_order_id, v_provider_order_id,
        p_amount, v_fee, v_total_deducted,
        TRIM(p_account_holder_name), v_masked_acc, UPPER(TRIM(p_ifsc_code)),
        'PENDING', 'PAYRUPEE', v_idem_key
    );

    -- 11. Insert encrypted bank account credential into isolated credentials table
    INSERT INTO public.merchant_payout_bank_credentials (
        payout_id, encrypted_account_number
    ) VALUES (
        v_payout_id, v_encrypted_acc
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'order_id', p_order_id,
        'provider_order_id', v_provider_order_id,
        'amount', p_amount,
        'fee_amount', v_fee,
        'total_deducted', v_total_deducted,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

-- 8. MERCHANT DEPOSIT SUBMISSION RPC (SERVER-CALCULATED 2% FEE, STRICT PENDING STATUS)
CREATE OR REPLACE FUNCTION public.merchant_submit_deposit_rpc(
    p_merchant_id UUID,
    p_gross_amount NUMERIC(12, 2),
    p_utr_number TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_fee_pct NUMERIC(12, 2) := 2.00;
    v_fee_amount NUMERIC(12, 2);
    v_net_credited NUMERIC(12, 2);
    v_deposit_id UUID;
    v_clean_utr TEXT;
BEGIN
    -- 1. Authorization: Verify caller owns active merchant account
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this active merchant account';
        END IF;
    END IF;

    -- 2. Validation
    IF p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit gross amount must be greater than zero';
    END IF;

    v_clean_utr := UPPER(TRIM(COALESCE(p_utr_number, '')));
    IF LENGTH(v_clean_utr) < 6 THEN
        RAISE EXCEPTION 'A valid UPI UTR or Transaction Reference Number is required';
    END IF;

    -- Check duplicate UTR
    IF EXISTS (SELECT 1 FROM public.merchant_deposits WHERE utr_number = v_clean_utr) THEN
        RAISE EXCEPTION 'Deposit request with this UTR number already exists';
    END IF;

    -- 3. Calculate 2% deposit fee server-side
    SELECT COALESCE(value::NUMERIC, 2.00) INTO v_fee_pct
    FROM public.platform_settings WHERE key = 'MERCHANT_DEPOSIT_FEE_PERCENT';
    IF v_fee_pct IS NULL THEN v_fee_pct := 2.00; END IF;

    v_fee_amount := ROUND(p_gross_amount * (v_fee_pct / 100.0), 2);
    v_net_credited := p_gross_amount - v_fee_amount;

    IF v_net_credited <= 0 THEN
        RAISE EXCEPTION 'Calculated net credited amount % is invalid for gross %', v_net_credited, p_gross_amount;
    END IF;

    v_deposit_id := gen_random_uuid();

    -- 4. Insert strictly with status = 'PENDING' and NULL admin review fields
    INSERT INTO public.merchant_deposits (
        id,
        merchant_id,
        gross_amount,
        deposit_fee,
        net_credited,
        utr_number,
        status,
        admin_notes,
        reviewed_by,
        reviewed_at
    ) VALUES (
        v_deposit_id,
        p_merchant_id,
        p_gross_amount,
        v_fee_amount,
        v_net_credited,
        v_clean_utr,
        'PENDING',
        NULL,
        NULL,
        NULL
    );

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'gross_amount', p_gross_amount,
        'deposit_fee', v_fee_amount,
        'net_credited', v_net_credited,
        'utr_number', v_clean_utr,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- 9. ADMIN DEPOSIT APPROVAL RPC (MANUAL REVIEW, 2% FEE DEDUCTION, IDEMPOTENT)
CREATE OR REPLACE FUNCTION public.admin_approve_merchant_deposit_rpc(
    p_deposit_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_deposit RECORD;
    v_wallet RECORD;
    v_fee_pct NUMERIC(12, 2) := 2.00;
    v_fee_amount NUMERIC(12, 2);
    v_net_credited NUMERIC(12, 2);
    v_bal_before NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    -- Authorization check
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    -- Lock deposit row
    SELECT * INTO v_deposit
    FROM public.merchant_deposits
    WHERE id = p_deposit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant deposit request not found';
    END IF;

    -- Idempotency check
    IF v_deposit.status = 'APPROVED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'deposit_id', v_deposit.id,
            'status', 'APPROVED',
            'idempotent', true,
            'net_credited', v_deposit.net_credited
        );
    END IF;

    IF v_deposit.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Deposit cannot be approved in status %', v_deposit.status;
    END IF;

    -- Calculate 2% deposit fee server-side
    SELECT COALESCE(value::NUMERIC, 2.00) INTO v_fee_pct
    FROM public.platform_settings WHERE key = 'MERCHANT_DEPOSIT_FEE_PERCENT';
    IF v_fee_pct IS NULL THEN v_fee_pct := 2.00; END IF;

    v_fee_amount := ROUND(v_deposit.gross_amount * (v_fee_pct / 100.0), 2);
    v_net_credited := v_deposit.gross_amount - v_fee_amount;

    IF v_net_credited <= 0 THEN
        RAISE EXCEPTION 'Calculated net credit % is invalid for gross %', v_net_credited, v_deposit.gross_amount;
    END IF;

    -- Lock merchant wallet
    SELECT * INTO v_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = v_deposit.merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant wallet not found for deposit';
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after := v_bal_before + v_net_credited;

    -- Credit wallet float
    UPDATE public.merchant_wallets
    SET
        available_balance = v_bal_after,
        total_deposited = total_deposited + v_deposit.gross_amount,
        total_fees_paid = total_fees_paid + v_fee_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Append immutable ledger entries
    INSERT INTO public.merchant_ledger_entries (
        merchant_id, wallet_id, amount, fee_amount, entry_type,
        reference_type, reference_id, idempotency_key,
        balance_before, balance_after, metadata
    ) VALUES 
    (
        v_deposit.merchant_id, v_wallet.id, v_net_credited, 0.00, 'DEPOSIT_CREDIT',
        'DEPOSIT', v_deposit.id::text, 'mch_dep_net_' || v_deposit.id::text,
        v_bal_before, v_bal_after,
        jsonb_build_object('gross', v_deposit.gross_amount, 'utr', v_deposit.utr_number)
    ),
    (
        v_deposit.merchant_id, v_wallet.id, -v_fee_amount, v_fee_amount, 'DEPOSIT_FEE',
        'DEPOSIT', v_deposit.id::text, 'mch_dep_fee_' || v_deposit.id::text,
        v_bal_after, v_bal_after,
        jsonb_build_object('fee_percent', v_fee_pct, 'utr', v_deposit.utr_number)
    );

    -- Update deposit record
    UPDATE public.merchant_deposits
    SET
        status = 'APPROVED',
        deposit_fee = v_fee_amount,
        net_credited = v_net_credited,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        reviewed_by = v_admin_uid,
        reviewed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_deposit.id;

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit.id,
        'gross_amount', v_deposit.gross_amount,
        'deposit_fee', v_fee_amount,
        'net_credited', v_net_credited,
        'status', 'APPROVED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 8. ADMIN DEPOSIT REJECTION RPC
CREATE OR REPLACE FUNCTION public.admin_reject_merchant_deposit_rpc(
    p_deposit_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_deposit RECORD;
BEGIN
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    SELECT * INTO v_deposit
    FROM public.merchant_deposits
    WHERE id = p_deposit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant deposit request not found';
    END IF;

    IF v_deposit.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Deposit cannot be rejected in status %', v_deposit.status;
    END IF;

    UPDATE public.merchant_deposits
    SET
        status = 'REJECTED',
        admin_notes = COALESCE(p_admin_notes, 'Rejected by platform administrator'),
        reviewed_by = v_admin_uid,
        reviewed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_deposit.id;

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit.id,
        'status', 'REJECTED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9. INBOUND WEBHOOK FINALIZATION: SUCCESS (SERVICE ROLE ONLY)
CREATE OR REPLACE FUNCTION public.merchant_finalize_payout_success_rpc(
    p_provider_order_id TEXT,
    p_provider_reference_id TEXT,
    p_provider_event_id TEXT,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_payout RECORD;
    v_wallet RECORD;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: service_role required';
    END IF;

    -- Idempotency check on provider event
    IF EXISTS (SELECT 1 FROM public.merchant_payout_events WHERE provider_event_id = p_provider_event_id) THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Event already processed');
    END IF;

    SELECT * INTO v_payout
    FROM public.merchant_payouts
    WHERE provider_order_id = p_provider_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant payout not found for order %', p_provider_order_id;
    END IF;

    -- If already SUCCESS, log event and return idempotent
    IF v_payout.status = 'SUCCESS' THEN
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (p_provider_event_id, v_payout.id, 'payout.already_success', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    -- Terminal state protection: A payout that was already FAILED (e.g. 4xx rejection or failure webhook)
    -- must NEVER be converted to SUCCESS by a delayed/out-of-order webhook
    IF v_payout.status IN ('FAILED', 'REVERSED') THEN
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (p_provider_event_id, v_payout.id, 'payout.conflict_already_failed', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;
        RETURN jsonb_build_object(
            'success', false,
            'idempotent', true,
            'error', 'Terminal state conflict: payout is already ' || v_payout.status || ' and cannot be marked SUCCESS'
        );
    END IF;

    -- Lock merchant wallet
    SELECT * INTO v_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = v_payout.merchant_id
    FOR UPDATE;

    -- Release locked float and increment totals
    UPDATE public.merchant_wallets
    SET
        locked_payout_balance = GREATEST(0.00, locked_payout_balance - v_payout.total_deducted),
        total_paid_out = total_paid_out + v_payout.amount,
        total_fees_paid = total_fees_paid + v_payout.fee_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Record ledger confirmation
    INSERT INTO public.merchant_ledger_entries (
        merchant_id, wallet_id, amount, fee_amount, entry_type,
        reference_type, reference_id, idempotency_key,
        balance_before, balance_after, metadata
    ) VALUES (
        v_payout.merchant_id, v_wallet.id, -v_payout.amount, v_payout.fee_amount, 'PAYOUT_CONFIRM',
        'PAYOUT', v_payout.id::text, 'mch_py_conf_' || p_provider_event_id,
        v_wallet.available_balance, v_wallet.available_balance,
        jsonb_build_object('provider_reference_id', p_provider_reference_id, 'provider_event_id', p_provider_event_id)
    );

    -- Update payout status to SUCCESS
    UPDATE public.merchant_payouts
    SET
        status = 'SUCCESS',
        provider_reference_id = p_provider_reference_id,
        processed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_payout.id;

    -- Record webhook event
    INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
    VALUES (p_provider_event_id, v_payout.id, 'payout.success', p_raw_payload)
    ON CONFLICT (provider_event_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'status', 'SUCCESS');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_finalize_payout_success_rpc(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_finalize_payout_success_rpc(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 10. INBOUND WEBHOOK FINALIZATION: FAILURE & AUTO-REFUND (SERVICE ROLE ONLY)
CREATE OR REPLACE FUNCTION public.merchant_finalize_payout_failure_rpc(
    p_provider_order_id TEXT,
    p_rejection_reason TEXT,
    p_provider_event_id TEXT,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_payout RECORD;
    v_wallet RECORD;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: service_role required';
    END IF;

    -- Idempotency check
    IF EXISTS (SELECT 1 FROM public.merchant_payout_events WHERE provider_event_id = p_provider_event_id) THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Event already processed');
    END IF;

    SELECT * INTO v_payout
    FROM public.merchant_payouts
    WHERE provider_order_id = p_provider_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant payout not found for order %', p_provider_order_id;
    END IF;

    -- If already FAILED/REVERSED, return idempotent
    IF v_payout.status IN ('FAILED', 'REVERSED') THEN
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (p_provider_event_id, v_payout.id, 'payout.already_failed', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    -- Terminal state protection: A payout that was already SUCCESS
    -- must NEVER be converted to FAILED or refunded by a delayed/out-of-order webhook
    IF v_payout.status = 'SUCCESS' THEN
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (p_provider_event_id, v_payout.id, 'payout.conflict_already_success', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;
        RETURN jsonb_build_object(
            'success', false,
            'idempotent', true,
            'error', 'Terminal state conflict: payout is already SUCCESS and cannot be marked FAILED or refunded'
        );
    END IF;

    -- Lock merchant wallet
    SELECT * INTO v_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = v_payout.merchant_id
    FOR UPDATE;

    v_bal_before := v_wallet.available_balance;
    v_bal_mid := v_bal_before + v_payout.amount;
    v_bal_after := v_bal_mid + v_payout.fee_amount;

    -- Auto-refund: release locked balance, return amount + fee to available_balance
    UPDATE public.merchant_wallets
    SET
        available_balance = v_bal_after,
        locked_payout_balance = GREATEST(0.00, locked_payout_balance - v_payout.total_deducted),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Append refund ledger audit entries
    INSERT INTO public.merchant_ledger_entries (
        merchant_id, wallet_id, amount, fee_amount, entry_type,
        reference_type, reference_id, idempotency_key,
        balance_before, balance_after, metadata
    ) VALUES 
    (
        v_payout.merchant_id, v_wallet.id, v_payout.amount, 0.00, 'PAYOUT_REFUND',
        'PAYOUT', v_payout.id::text, 'mch_py_ref_amt_' || p_provider_event_id,
        v_bal_before, v_bal_mid,
        jsonb_build_object('reason', p_rejection_reason, 'provider_event_id', p_provider_event_id)
    ),
    (
        v_payout.merchant_id, v_wallet.id, v_payout.fee_amount, 0.00, 'PAYOUT_FEE_REFUND',
        'PAYOUT', v_payout.id::text, 'mch_py_ref_fee_' || p_provider_event_id,
        v_bal_mid, v_bal_after,
        jsonb_build_object('reason', p_rejection_reason, 'fee_refunded', v_payout.fee_amount)
    );

    -- Update payout status to FAILED
    UPDATE public.merchant_payouts
    SET
        status = 'FAILED',
        rejection_reason = p_rejection_reason,
        processed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_payout.id;

    -- Record webhook event
    INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
    VALUES (p_provider_event_id, v_payout.id, 'payout.failed', p_raw_payload)
    ON CONFLICT (provider_event_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'status', 'FAILED', 'refunded', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_finalize_payout_failure_rpc(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_finalize_payout_failure_rpc(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 12. MERCHANT IP WHITELIST ADDITION RPC (SERVER-SIDE VALIDATION & OWNERSHIP ENFORCEMENT)
CREATE OR REPLACE FUNCTION public.merchant_add_ip_whitelist_rpc(
    p_merchant_id UUID,
    p_ip_address TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_parsed_ip INET;
    v_entry_id UUID;
BEGIN
    -- 1. Authorization: Verify caller owns active merchant account
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this active merchant account';
        END IF;
    END IF;

    -- 2. Validate IP Address / CIDR format server-side
    BEGIN
        v_parsed_ip := TRIM(p_ip_address)::INET;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid IP address or CIDR format: %', p_ip_address;
    END;

    v_entry_id := gen_random_uuid();

    -- 3. Insert into merchant_ip_whitelist with strictly verified merchant_id
    INSERT INTO public.merchant_ip_whitelist (
        id,
        merchant_id,
        ip_address,
        description
    ) VALUES (
        v_entry_id,
        p_merchant_id,
        v_parsed_ip,
        NULLIF(TRIM(p_description), '')
    )
    ON CONFLICT (merchant_id, ip_address) DO UPDATE SET
        description = COALESCE(EXCLUDED.description, public.merchant_ip_whitelist.description);

    RETURN jsonb_build_object(
        'success', true,
        'id', v_entry_id,
        'ip_address', host(v_parsed_ip),
        'description', p_description
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_add_ip_whitelist_rpc(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_add_ip_whitelist_rpc(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 13. MERCHANT IP WHITELIST REMOVAL RPC (OWNERSHIP ENFORCEMENT)
CREATE OR REPLACE FUNCTION public.merchant_remove_ip_whitelist_rpc(
    p_whitelist_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
BEGIN
    -- 1. Authorization: Verify caller owns this whitelist entry
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchant_ip_whitelist w
            JOIN public.merchants m ON m.id = w.merchant_id
            WHERE w.id = p_whitelist_id AND m.user_id = v_caller_uid
        ) AND NOT public.is_admin(v_caller_uid) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this whitelist entry';
        END IF;
    END IF;

    DELETE FROM public.merchant_ip_whitelist WHERE id = p_whitelist_id;

    RETURN jsonb_build_object('success', true, 'id', p_whitelist_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_remove_ip_whitelist_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_remove_ip_whitelist_rpc(UUID) TO authenticated, service_role;

-- 14. ROW LEVEL SECURITY (RLS) POLICIES FOR ALL MERCHANT TABLES

-- A. public.merchants
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can read own profile" ON public.merchants;
CREATE POLICY "Merchants can read own profile"
    ON public.merchants FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Merchants can update own profile" ON public.merchants;
CREATE POLICY "Merchants can update own profile"
    ON public.merchants FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- B. public.merchant_wallets (READ ONLY FOR OWNER, ZERO DIRECT CLIENT WRITES)
ALTER TABLE public.merchant_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can read own wallet" ON public.merchant_wallets;
CREATE POLICY "Merchants can read own wallet"
    ON public.merchant_wallets FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.is_admin(auth.uid())
    );

REVOKE INSERT, UPDATE, DELETE ON public.merchant_wallets FROM authenticated, anon, PUBLIC;

-- C. public.merchant_ledger_entries (READ ONLY FOR OWNER, ZERO DIRECT CLIENT WRITES)
ALTER TABLE public.merchant_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can read own ledger" ON public.merchant_ledger_entries;
CREATE POLICY "Merchants can read own ledger"
    ON public.merchant_ledger_entries FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.is_admin(auth.uid())
    );

REVOKE INSERT, UPDATE, DELETE ON public.merchant_ledger_entries FROM authenticated, anon, PUBLIC;

-- D. public.merchant_payouts (READ ONLY FOR OWNER, ZERO DIRECT CLIENT WRITES)
ALTER TABLE public.merchant_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can read own payouts" ON public.merchant_payouts;
CREATE POLICY "Merchants can read own payouts"
    ON public.merchant_payouts FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.is_admin(auth.uid())
    );

REVOKE INSERT, UPDATE, DELETE ON public.merchant_payouts FROM authenticated, anon, PUBLIC;

-- E. public.merchant_deposits (READ ONLY FOR OWNER, ZERO DIRECT CLIENT WRITES, MUTATIONS VIA RPC ONLY)
ALTER TABLE public.merchant_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view own deposits" ON public.merchant_deposits;
CREATE POLICY "Merchants can view own deposits"
    ON public.merchant_deposits FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.is_admin(auth.uid())
    );

REVOKE INSERT, UPDATE, DELETE ON public.merchant_deposits FROM authenticated, anon, PUBLIC;

-- F. public.merchant_api_keys (READ ONLY FOR OWNER METADATA, ZERO CLIENT WRITES, MUTATIONS VIA RPC ONLY)
ALTER TABLE public.merchant_api_keys ENABLE ROW LEVEL SECURITY;

-- Revoke all direct client write mutations
REVOKE INSERT, UPDATE, DELETE ON public.merchant_api_keys FROM authenticated, anon, PUBLIC;

-- Only grant SELECT on safe metadata columns to authenticated (client_secret_hash is NEVER accessible)
REVOKE SELECT ON public.merchant_api_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, merchant_id, key_name, client_id, is_active, last_used_at, created_at)
    ON public.merchant_api_keys TO authenticated;
GRANT ALL ON public.merchant_api_keys TO service_role;

DROP POLICY IF EXISTS "Merchants manage own api keys" ON public.merchant_api_keys;
DROP POLICY IF EXISTS "Merchants can read own api keys" ON public.merchant_api_keys;
CREATE POLICY "Merchants can read own api keys"
    ON public.merchant_api_keys FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.is_admin(auth.uid())
    );

-- G. public.merchant_ip_whitelist (READ ONLY FOR OWNER, ZERO CLIENT WRITES, MUTATIONS VIA RPC ONLY)
ALTER TABLE public.merchant_ip_whitelist ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.merchant_ip_whitelist FROM authenticated, anon, PUBLIC;

DROP POLICY IF EXISTS "Merchants manage own ip whitelist" ON public.merchant_ip_whitelist;
DROP POLICY IF EXISTS "Merchants can view own ip whitelist" ON public.merchant_ip_whitelist;
CREATE POLICY "Merchants can view own ip whitelist"
    ON public.merchant_ip_whitelist FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.is_admin(auth.uid())
    );

-- H. public.merchant_payout_events (SERVICE ROLE ONLY)
ALTER TABLE public.merchant_payout_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_payout_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.merchant_payout_events TO service_role;
