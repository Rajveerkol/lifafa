-- ==============================================================================
-- Migration: 047_fix_claim_lifafa_pgcrypto_search_path.sql
-- Description: Fix "function crypt(text, text) does not exist" in claim_lifafa_rpc
--
-- Analysis:
--   1. Extension "pgcrypto" (which provides crypt()) is installed in schema "extensions"
--      in Supabase-hosted PostgreSQL.
--   2. In migration 043, claim_lifafa_rpc was hardened with:
--        SET search_path = public, pg_temp;
--   3. Because "extensions" was omitted from search_path, calls to crypt() fail with:
--        function crypt(text, text) does not exist (SQLSTATE 42883)
--   4. The existing live signature for verify_lifafa_pin_rpc uses parameter name:
--        p_lifafa_code TEXT, p_pin_code TEXT
--      Preserving this exact signature ensures CREATE OR REPLACE succeeds without
--      any DROP FUNCTION requirement.
--
-- Fix:
--   1. Ensure "pgcrypto" extension exists: CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--   2. Update claim_lifafa_rpc with:
--        SET search_path = public, extensions, pg_temp;
--      Preserves exact input parameter names, types, order, and all business logic.
--   3. Update verify_lifafa_pin_rpc with exact existing parameter names:
--        (p_lifafa_code TEXT, p_pin_code TEXT)
--        and SET search_path TO 'public', 'extensions', 'pg_temp'.
--   4. NO DROP FUNCTION required.
-- ==============================================================================

-- 1. Ensure pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Update claim_lifafa_rpc with extensions in search_path
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
    v_clean_upi TEXT := NULL;
    v_account_name TEXT := NULL;
    v_profile_name TEXT;
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

    IF v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    IF v_lifafa.withdrawal_status = 'BLOCKED' THEN
        RAISE EXCEPTION 'This Lifafa has been blocked by platform administration';
    END IF;

    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa has not started yet. Starts at: %', v_lifafa.starts_at;
    END IF;

    IF v_lifafa.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Lifafa has been cancelled';
    END IF;

    IF v_lifafa.status = 'EXPIRED' OR v_lifafa.expires_at <= NOW() THEN
        IF v_lifafa.status <> 'EXPIRED' THEN
            UPDATE public.lifafas SET status = 'EXPIRED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        END IF;
        RAISE EXCEPTION 'Lifafa has expired';
    END IF;

    IF v_lifafa.status = 'COMPLETED' OR v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0.00 THEN
        IF v_lifafa.status <> 'COMPLETED' THEN
            UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        END IF;
        RAISE EXCEPTION 'All Lifafa rewards have already been claimed';
    END IF;

    IF v_lifafa.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Lifafa is not active (Status: %)', v_lifafa.status;
    END IF;

    -- 3. External Payout Details Validation: Enforce UPI ONLY for UPI_BANK mode
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Reject bank account parameters
        IF p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> '' THEN
            RAISE EXCEPTION 'Bank account claims are no longer supported. All external claims must use UPI.';
        END IF;

        IF p_upi_id IS NULL OR TRIM(p_upi_id) = '' THEN
            RAISE EXCEPTION 'A valid UPI ID is required to claim this Lifafa.';
        END IF;

        v_clean_upi := LOWER(TRIM(p_upi_id));
        IF NOT (v_clean_upi ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$') THEN
            RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
        END IF;

        SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
        v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Claimant');
    END IF;

    -- Device limit check
    IF p_device_fingerprint IS NOT NULL AND v_lifafa.device_claim_limit > 0 THEN
        SELECT COUNT(*) INTO v_device_claims_count
        FROM public.lifafa_claims
        WHERE lifafa_id = v_lifafa.id AND device_fingerprint = p_device_fingerprint;

        IF v_device_claims_count >= v_lifafa.device_claim_limit THEN
            RAISE EXCEPTION 'Device claim limit (% per device) reached for this Lifafa', v_lifafa.device_claim_limit;
        END IF;
    END IF;

    -- PIN verification
    SELECT * INTO v_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND AND v_secret.pin_code_hash IS NOT NULL THEN
        IF p_pin_code IS NULL OR LENGTH(TRIM(p_pin_code)) = 0 THEN
            RAISE EXCEPTION 'Secret PIN code is required to claim this Lifafa';
        END IF;

        IF v_secret.pin_code_hash <> crypt(TRIM(p_pin_code), v_secret.pin_code_hash) THEN
            RAISE EXCEPTION 'Incorrect PIN code entered';
        END IF;
    END IF;

    -- Task completions check
    SELECT COUNT(*) INTO v_uncompleted_count
    FROM public.lifafa_tasks t
    WHERE t.lifafa_id = v_lifafa.id
      AND t.is_required = TRUE
      AND t.is_enabled = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM public.task_completions tc
          WHERE tc.task_id = t.id 
            AND tc.user_id = v_user_id
            AND (
                (t.task_type IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT')
                 AND tc.status = 'VERIFIED'
                 AND tc.verification_method = 'TELEGRAM_BOT_API'
                 AND tc.verified_via_bot = TRUE)
                OR
                (t.task_type IN ('VISIT_WEBSITE', 'CUSTOM')
                 AND (tc.status = 'CLICK_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method = 'URL_VISIT')))
                OR
                (t.task_type IN ('INSTAGRAM_FOLLOW', 'INSTAGRAM_LIKE', 'YOUTUBE_SUB', 'REFERRAL')
                 AND (tc.status = 'USER_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method IN ('MANUAL', 'ENGAGEMENT', 'OAUTH_CHECK'))))
                OR
                (t.task_type = 'YOUTUBE_WATCH'
                 AND (tc.status = 'USER_CONFIRMED' OR tc.status = 'VERIFIED')
                 AND (tc.verification_method IN ('YOUTUBE_PLAYER_ENDED', 'USER_CONFIRMED', 'ENGAGEMENT')))
            )
      );

    IF v_uncompleted_count > 0 THEN
        RAISE EXCEPTION 'Please complete and verify all required community tasks before claiming';
    END IF;

    -- 4. Select next available allocation
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

    -- 5. Deduct from creator escrow
    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - v_claim_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- 6. Payout Routing: UPI_BANK (External PayNit UPI) vs WALLET (Internal Instant)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Insert into public.withdrawals for external PayNit UPI dispatch
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
            payout_method,
            idempotency_key
        ) VALUES (
            v_user_id,
            v_claim_amount,
            0.00, -- Free to claimant
            v_claim_amount,
            v_account_name,
            NULL,
            NULL,
            NULL,
            v_clean_upi,
            'PENDING',
            'PAYNIT', -- ENFORCE PAYNIT
            'UPI',    -- ENFORCE UPI
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

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
            'payout_method', 'UPI',
            'payout_provider', 'PAYNIT',
            'withdrawal_id', v_withdrawal_id,
            'withdrawal_status', 'PENDING',
            'new_balance', v_balance_after
        );

    ELSE
        -- WALLET mode: Instant internal credit (UNCHANGED)
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
        ) VALUES 
        (
            v_user_id,
            v_user_wallet.id,
            v_claim_amount,
            'CLAIM',
            'SUCCESS',
            'LIFAFA_CLAIM',
            v_claim_id::text,
            'claim_tx_' || v_effective_idempotency,
            v_balance_before,
            v_balance_after,
            jsonb_build_object(
                'lifafa_id', v_lifafa.id,
                'lifafa_code', v_lifafa.code,
                'allocation_id', v_allocation.id
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- Permissions
REVOKE ALL ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;


-- 3. Update verify_lifafa_pin_rpc preserving the EXACT existing parameter names:
--    (p_lifafa_code TEXT, p_pin_code TEXT)
CREATE OR REPLACE FUNCTION public.verify_lifafa_pin_rpc(
    p_lifafa_code TEXT,
    p_pin_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lifafa RECORD;
    v_secret RECORD;
    v_clean_pin TEXT;
    v_attempt RECORD;
    v_max_attempts INT := 5;
    v_lockout_interval INTERVAL := INTERVAL '15 minutes';
BEGIN
    -- 1. Strict Authentication Guard
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to verify Lifafa PIN';
    END IF;

    -- 2. Validate Input
    IF p_lifafa_code IS NULL OR LENGTH(TRIM(p_lifafa_code)) = 0 THEN
        RETURN jsonb_build_object('valid', false, 'requires_pin', false, 'message', 'Invalid Lifafa code');
    END IF;

    -- 3. Check Lifafa Status
    SELECT id, code, status, expires_at INTO v_lifafa
    FROM public.lifafas
    WHERE code = UPPER(TRIM(p_lifafa_code));

    IF NOT FOUND OR v_lifafa.status <> 'ACTIVE' OR v_lifafa.expires_at <= TIMEZONE('utc'::text, NOW()) THEN
        RETURN jsonb_build_object('valid', false, 'requires_pin', false, 'message', 'Lifafa not found or no longer active');
    END IF;

    -- 4. Check if Lifafa is PIN-Protected
    SELECT pin_code_hash INTO v_secret
    FROM public.lifafa_secrets
    WHERE lifafa_id = v_lifafa.id;

    IF NOT FOUND OR v_secret.pin_code_hash IS NULL THEN
        RETURN jsonb_build_object('valid', true, 'requires_pin', false);
    END IF;

    -- 5. Brute-Force Rate Limiting Guard
    SELECT * INTO v_attempt
    FROM public.lifafa_pin_attempts
    WHERE user_id = v_user_id AND lifafa_id = v_lifafa.id
    FOR UPDATE;

    IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > TIMEZONE('utc'::text, NOW()) THEN
        RETURN jsonb_build_object(
            'valid', false,
            'requires_pin', true,
            'message', 'Too many incorrect attempts. Please wait 15 minutes before trying again.'
        );
    END IF;

    v_clean_pin := TRIM(COALESCE(p_pin_code, ''));
    IF LENGTH(v_clean_pin) = 0 THEN
        RETURN jsonb_build_object('valid', false, 'requires_pin', true, 'message', 'Please enter the security PIN');
    END IF;

    -- 6. Constant-Time Verification via crypt()
    IF v_secret.pin_code_hash = crypt(v_clean_pin, v_secret.pin_code_hash) THEN
        -- Success: Clear failed attempts
        DELETE FROM public.lifafa_pin_attempts
        WHERE user_id = v_user_id AND lifafa_id = v_lifafa.id;

        RETURN jsonb_build_object('valid', true, 'requires_pin', true);
    ELSE
        -- Failure: Increment attempt counter and apply lockout if threshold reached
        INSERT INTO public.lifafa_pin_attempts (user_id, lifafa_id, failed_attempts, last_attempt_at)
        VALUES (v_user_id, v_lifafa.id, 1, TIMEZONE('utc'::text, NOW()))
        ON CONFLICT (user_id, lifafa_id) DO UPDATE
        SET failed_attempts = public.lifafa_pin_attempts.failed_attempts + 1,
            locked_until = CASE 
                WHEN public.lifafa_pin_attempts.failed_attempts + 1 >= v_max_attempts 
                THEN TIMEZONE('utc'::text, NOW()) + v_lockout_interval 
                ELSE NULL 
            END,
            last_attempt_at = TIMEZONE('utc'::text, NOW());

        RETURN jsonb_build_object(
            'valid', false,
            'requires_pin', true,
            'message', 'Incorrect PIN code entered. Please try again.'
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_lifafa_pin_rpc(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_lifafa_pin_rpc(TEXT, TEXT) TO authenticated, service_role;
