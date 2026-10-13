-- ==============================================================================
-- Migration: 072_allow_guest_lifafa_claims_without_login.sql
-- Description:
--   1. Allow guest claimants to claim public UPI Lifafas without Google login.
--   2. Make user_id nullable in lifafa_claims, withdrawals, lifafa_allocations, and task_completions.
--   3. Add guest_claim_token column with unique constraints to prevent duplicates and bind payouts.
--   4. Update verify_lifafa_pin_rpc to allow anonymous callers with constant-time verification.
--   5. Update record_engagement_task_completion_rpc to support guest claimants with token.
--   6. Update claim_lifafa_rpc to safely process guest claims on public UPI Lifafas.
--   7. Add get_guest_claim_status_rpc for secure status checks without exposing private data.
--   8. Grant EXECUTE permissions to anon role on relevant claim RPCs.
-- Target: Supabase SQL Editor / Management API
-- STATUS: NOT EXECUTED — AWAITING MANUAL EXECUTION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA HARDENING: NULLABLE user_id AND guest_claim_token COLUMNS
-- ------------------------------------------------------------------------------

-- 1a. lifafa_claims: allow guest claims with guest_claim_token
ALTER TABLE public.lifafa_claims ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.lifafa_claims ADD COLUMN IF NOT EXISTS guest_claim_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lifafa_claims_guest
    ON public.lifafa_claims (lifafa_id, guest_claim_token)
    WHERE guest_claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lifafa_claims_guest_token
    ON public.lifafa_claims (guest_claim_token)
    WHERE guest_claim_token IS NOT NULL;

-- 1b. withdrawals: allow guest claim payouts with guest_claim_token
ALTER TABLE public.withdrawals ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS guest_claim_token TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawals_guest_token
    ON public.withdrawals (guest_claim_token)
    WHERE guest_claim_token IS NOT NULL;

-- 1c. lifafa_allocations: ensure claimed_by is nullable (already nullable, verify)
ALTER TABLE public.lifafa_allocations ALTER COLUMN claimed_by DROP NOT NULL;

ALTER TABLE public.lifafa_allocations ADD COLUMN IF NOT EXISTS claimed_by_guest_token TEXT;

-- 1d. task_completions: allow engagement task tracking for guest claimants
ALTER TABLE public.task_completions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS guest_claim_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_task_completion
    ON public.task_completions (task_id, guest_claim_token)
    WHERE guest_claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_comp_guest
    ON public.task_completions (lifafa_id, guest_claim_token)
    WHERE guest_claim_token IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 2. STANDALONE AUTHORITATIVE PIN VERIFICATION RPC (ANON + AUTHENTICATED)
-- ------------------------------------------------------------------------------
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
    -- 1. Validate Input
    IF p_lifafa_code IS NULL OR LENGTH(TRIM(p_lifafa_code)) = 0 THEN
        RETURN jsonb_build_object('valid', false, 'requires_pin', false, 'message', 'Invalid Lifafa code');
    END IF;

    -- 2. Check Lifafa Status
    SELECT id, code, status, is_public, expires_at INTO v_lifafa
    FROM public.lifafas
    WHERE code = UPPER(TRIM(p_lifafa_code));

    IF NOT FOUND OR v_lifafa.status <> 'ACTIVE' OR v_lifafa.expires_at <= TIMEZONE('utc'::text, NOW()) THEN
        RETURN jsonb_build_object('valid', false, 'requires_pin', false, 'message', 'Lifafa not found or no longer active');
    END IF;

    -- 3. Check if Lifafa is PIN-Protected
    SELECT pin_code_hash INTO v_secret
    FROM public.lifafa_secrets
    WHERE lifafa_id = v_lifafa.id;

    IF NOT FOUND OR v_secret.pin_code_hash IS NULL THEN
        RETURN jsonb_build_object('valid', true, 'requires_pin', false);
    END IF;

    v_clean_pin := TRIM(COALESCE(p_pin_code, ''));
    IF LENGTH(v_clean_pin) = 0 THEN
        RETURN jsonb_build_object('valid', false, 'requires_pin', true, 'message', 'Please enter the security PIN');
    END IF;

    -- 4. Rate-limiting for authenticated users
    IF v_user_id IS NOT NULL THEN
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

        -- Constant-time verification via crypt()
        IF v_secret.pin_code_hash = crypt(v_clean_pin, v_secret.pin_code_hash) THEN
            DELETE FROM public.lifafa_pin_attempts
            WHERE user_id = v_user_id AND lifafa_id = v_lifafa.id;

            RETURN jsonb_build_object('valid', true, 'requires_pin', true);
        ELSE
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
    ELSE
        -- 5. Guest PIN verification on public Lifafas: constant-time crypt() verification
        IF v_secret.pin_code_hash = crypt(v_clean_pin, v_secret.pin_code_hash) THEN
            RETURN jsonb_build_object('valid', true, 'requires_pin', true);
        ELSE
            RETURN jsonb_build_object(
                'valid', false,
                'requires_pin', true,
                'message', 'Incorrect PIN code entered. Please try again.'
            );
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_lifafa_pin_rpc(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_lifafa_pin_rpc(TEXT, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. RECORD ENGAGEMENT TASK COMPLETION RPC (ANON + AUTHENTICATED)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_engagement_task_completion_rpc(UUID);
DROP FUNCTION IF EXISTS public.record_engagement_task_completion_rpc(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.record_engagement_task_completion_rpc(
    p_task_id UUID,
    p_guest_claim_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_guest_token TEXT := NULLIF(TRIM(p_guest_claim_token), '');
    v_task RECORD;
    v_status TEXT;
    v_method TEXT;
BEGIN
    IF v_user_id IS NULL AND (v_clean_guest_token IS NULL OR LENGTH(v_clean_guest_token) < 16) THEN
        RAISE EXCEPTION 'Authentication or valid guest token required';
    END IF;

    -- Validate task exists
    SELECT * INTO v_task FROM public.lifafa_tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found: %', p_task_id;
    END IF;

    -- STRICT GUARD: Telegram tasks CANNOT be completed via this RPC
    IF v_task.task_type IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT') THEN
        RAISE EXCEPTION 'Telegram tasks cannot be completed via engagement RPC. Server verification required.';
    END IF;

    -- Tier determination based on task type
    IF v_task.task_type IN ('VISIT_WEBSITE', 'CUSTOM') THEN
        v_status := 'CLICK_CONFIRMED';
        v_method := 'CLICK_CONFIRMED';
    ELSIF v_task.task_type = 'YOUTUBE_WATCH' THEN
        v_status := 'USER_CONFIRMED';
        v_method := 'YOUTUBE_PLAYER_ENDED';
    ELSIF v_task.task_type IN ('INSTAGRAM_FOLLOW', 'INSTAGRAM_LIKE', 'YOUTUBE_SUB', 'REFERRAL') THEN
        v_status := 'USER_CONFIRMED';
        v_method := 'USER_CONFIRMED';
    ELSE
        v_status := 'CLICK_CONFIRMED';
        v_method := 'ENGAGEMENT';
    END IF;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.task_completions (
            task_id,
            lifafa_id,
            user_id,
            status,
            verification_method,
            metadata
        ) VALUES (
            p_task_id,
            v_task.lifafa_id,
            v_user_id,
            v_status,
            v_method,
            jsonb_build_object(
                'task_type', v_task.task_type,
                'completed_at', TIMEZONE('utc'::text, NOW())
            )
        )
        ON CONFLICT (task_id, user_id) DO UPDATE SET
            status = EXCLUDED.status,
            verification_method = EXCLUDED.verification_method,
            metadata = public.task_completions.metadata || EXCLUDED.metadata;
    ELSE
        -- Guest completion insertion
        INSERT INTO public.task_completions (
            task_id,
            lifafa_id,
            user_id,
            guest_claim_token,
            status,
            verification_method,
            metadata
        ) VALUES (
            p_task_id,
            v_task.lifafa_id,
            NULL,
            v_clean_guest_token,
            v_status,
            v_method,
            jsonb_build_object(
                'task_type', v_task.task_type,
                'completed_at', TIMEZONE('utc'::text, NOW()),
                'guest', true
            )
        )
        ON CONFLICT (task_id, guest_claim_token) WHERE guest_claim_token IS NOT NULL DO UPDATE SET
            status = EXCLUDED.status,
            verification_method = EXCLUDED.verification_method,
            metadata = public.task_completions.metadata || EXCLUDED.metadata;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'status', v_status,
        'method', v_method
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_engagement_task_completion_rpc(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_engagement_task_completion_rpc(UUID, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. HARDENED claim_lifafa_rpc SUPPORTING GUEST CLAIMS ON PUBLIC LIFAFAS
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc(
    p_code TEXT,
    p_pin_code VARCHAR(10) DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL,
    p_guest_claim_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_guest_token TEXT := NULLIF(TRIM(p_guest_claim_token), '');
    v_lifafa RECORD;
    v_allocation RECORD;
    v_user_wallet RECORD;
    v_creator_wallet RECORD;
    v_claim_id UUID;
    v_withdrawal_id UUID := NULL;
    v_claim_amount NUMERIC(12, 2);
    v_claim_fee NUMERIC(12, 2) := 0.00;
    v_uncompleted_count INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2) := 0.00;
    v_effective_idempotency TEXT;
    v_existing_claim RECORD;
    v_device_claims_count INT;
    v_secret RECORD;
    v_clean_upi TEXT := NULL;
    v_account_name TEXT := NULL;
    v_profile_name TEXT;
    v_clean_device_fp TEXT := NULL;
BEGIN
    -- Sanitize device fingerprint: Treat whitespace, null-like literals, or very short strings as NULL
    v_clean_device_fp := NULLIF(TRIM(p_device_fingerprint), '');
    IF v_clean_device_fp IS NOT NULL THEN
        IF LOWER(v_clean_device_fp) IN ('null', 'undefined', 'unknown', 'none', '[object object]') OR LENGTH(v_clean_device_fp) < 8 THEN
            v_clean_device_fp := NULL;
        END IF;
    END IF;

    -- Determine effective idempotency key safely
    IF v_user_id IS NOT NULL THEN
        v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_' || v_user_id::text);
    ELSE
        -- Guest Claimant Validation: Token must be provided with minimum 16 characters
        IF v_clean_guest_token IS NULL OR LENGTH(v_clean_guest_token) < 16 THEN
            RAISE EXCEPTION 'A valid guest claim session token is required to claim without login';
        END IF;
        v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_guest_' || v_clean_guest_token);
    END IF;

    -- 1. Check idempotency / existing claim
    SELECT lc.*, w.status AS withdrawal_status INTO v_existing_claim
    FROM public.lifafa_claims lc
    LEFT JOIN public.withdrawals w ON w.id = lc.withdrawal_id
    WHERE lc.idempotency_key = v_effective_idempotency 
       OR (v_user_id IS NOT NULL AND lc.lifafa_id IN (SELECT id FROM public.lifafas WHERE code = TRIM(p_code)) AND lc.user_id = v_user_id)
       OR (v_user_id IS NULL AND lc.lifafa_id IN (SELECT id FROM public.lifafas WHERE code = TRIM(p_code)) AND lc.guest_claim_token = v_clean_guest_token);

    IF FOUND THEN
        -- If previous claim had an external payout that definitively FAILED, allow clean retry
        IF v_existing_claim.withdrawal_id IS NOT NULL AND v_existing_claim.withdrawal_status = 'FAILED' THEN
            DELETE FROM public.lifafa_claims WHERE id = v_existing_claim.id;
        ELSE
            IF v_user_id IS NOT NULL THEN
                SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;
            END IF;
            RETURN jsonb_build_object(
                'success', true,
                'amount', v_existing_claim.amount,
                'lifafa_code', p_code,
                'is_duplicate', true,
                'payout_mode', v_existing_claim.payout_mode,
                'withdrawal_id', v_existing_claim.withdrawal_id,
                'withdrawal_status', v_existing_claim.withdrawal_status,
                'guest_claim_token', v_clean_guest_token,
                'new_balance', v_balance_after
            );
        END IF;
    END IF;

    -- 2. Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE code = TRIM(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa with code % does not exist', p_code;
    END IF;

    -- Guest Claiming Policy Enforcement:
    -- Guests are strictly allowed ONLY on PUBLIC Lifafas with UPI_BANK payout mode.
    IF v_user_id IS NULL THEN
        IF v_lifafa.is_public IS NOT TRUE THEN
            RAISE EXCEPTION 'Authentication required: This private Lifafa can only be claimed by logged-in users';
        END IF;

        IF v_lifafa.payout_mode = 'WALLET' THEN
            RAISE EXCEPTION 'This Lifafa reward is credited to your Createlifafa wallet. Please sign in with Google to claim.';
        END IF;
    END IF;

    IF v_user_id IS NOT NULL AND v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    IF v_lifafa.withdrawal_status = 'BLOCKED' THEN
        RAISE EXCEPTION 'This Lifafa has been blocked by administrators for security reasons';
    END IF;

    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa is scheduled to begin at %', v_lifafa.starts_at;
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

        IF v_user_id IS NOT NULL THEN
            SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
        END IF;
        v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Claimant');
    END IF;

    -- 4. Device limit check: Lifafa-scoped, valid sanitized fingerprint only, excluding failed payouts
    IF v_clean_device_fp IS NOT NULL AND v_lifafa.device_claim_limit > 0 THEN
        SELECT COUNT(*) INTO v_device_claims_count
        FROM public.lifafa_claims lc
        LEFT JOIN public.withdrawals w ON w.id = lc.withdrawal_id
        WHERE lc.lifafa_id = v_lifafa.id 
          AND lc.device_fingerprint = v_clean_device_fp
          AND (lc.withdrawal_id IS NULL OR w.status IN ('PENDING', 'PROCESSING', 'SUCCESS'));

        IF v_device_claims_count >= v_lifafa.device_claim_limit THEN
            RAISE EXCEPTION 'Device claim limit (% per device) reached for this Lifafa', v_lifafa.device_claim_limit;
        END IF;
    END IF;

    -- 5. PIN verification
    SELECT * INTO v_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND AND v_secret.pin_code_hash IS NOT NULL THEN
        IF p_pin_code IS NULL OR LENGTH(TRIM(p_pin_code)) = 0 THEN
            RAISE EXCEPTION 'Secret PIN code is required to claim this Lifafa';
        END IF;

        IF v_secret.pin_code_hash <> crypt(TRIM(p_pin_code), v_secret.pin_code_hash) THEN
            RAISE EXCEPTION 'Incorrect PIN code entered';
        END IF;
    END IF;

    -- 6. Task completions check: Supports authenticated & guest claimants
    IF v_user_id IS NOT NULL THEN
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
    ELSE
        -- Guest task completions check: matches guest_claim_token
        SELECT COUNT(*) INTO v_uncompleted_count
        FROM public.lifafa_tasks t
        WHERE t.lifafa_id = v_lifafa.id
          AND t.is_required = TRUE
          AND t.is_enabled = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM public.task_completions tc
              WHERE tc.task_id = t.id 
                AND tc.guest_claim_token = v_clean_guest_token
                AND (
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
    END IF;

    IF v_uncompleted_count > 0 THEN
        RAISE EXCEPTION 'Please complete and verify all required community tasks before claiming';
    END IF;

    -- 7. Select next available allocation
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
        claimed_by_guest_token = v_clean_guest_token,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    -- 8. Calculate Fee & Update Lifafa Row
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        IF COALESCE(v_lifafa.total_fee_amount, 0.00) > 0.00 THEN
            v_claim_fee := public.get_lifafa_payout_fee(v_claim_amount);
        ELSE
            v_claim_fee := 0.00;
        END IF;
    END IF;

    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = GREATEST(0.00, remaining_amount - v_claim_amount),
        remaining_fee_amount = GREATEST(0.00, remaining_fee_amount - v_claim_fee),
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0.00 
                THEN 'COMPLETED'::lifafa_status 
            ELSE 'ACTIVE'::lifafa_status 
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    -- 9. Deduct from creator escrow: prize amount + applicable payout fee
    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - (v_claim_amount + v_claim_fee)),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- 10. Payout Routing: UPI_BANK (External PayNit UPI) vs WALLET (Internal Instant)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        INSERT INTO public.withdrawals (
            user_id,
            guest_claim_token,
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
            v_clean_guest_token,
            v_claim_amount + v_claim_fee,
            v_claim_fee,
            v_claim_amount,
            v_account_name,
            NULL,
            NULL,
            NULL,
            v_clean_upi,
            'PENDING',
            'PAYNIT',
            'UPI',
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        INSERT INTO public.lifafa_claims (
            lifafa_id,
            user_id,
            guest_claim_token,
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
            v_clean_guest_token,
            v_allocation.id,
            v_claim_amount,
            v_effective_idempotency,
            v_clean_device_fp,
            p_ip_address,
            'UPI_BANK',
            v_withdrawal_id
        ) RETURNING id INTO v_claim_id;

        -- Record fee transaction in creator's wallet audit trail if fee was recognized
        IF v_claim_fee > 0.00 THEN
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
                v_lifafa.creator_id,
                v_creator_wallet.id,
                -v_claim_fee,
                'FEE',
                'SUCCESS'::transaction_status,
                'LIFAFA_PAYOUT_FEE',
                v_withdrawal_id::text,
                'tx_claim_fee_' || v_effective_idempotency,
                v_creator_wallet.available_balance,
                v_creator_wallet.available_balance,
                jsonb_build_object(
                    'lifafa_id', v_lifafa.id,
                    'lifafa_code', v_lifafa.code,
                    'withdrawal_id', v_withdrawal_id,
                    'claimant_id', v_user_id,
                    'guest_claim_token', v_clean_guest_token,
                    'claim_amount', v_claim_amount,
                    'payout_fee', v_claim_fee
                )
            );
        END IF;

        IF v_user_id IS NOT NULL THEN
            SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'UPI_BANK',
            'payout_method', 'UPI',
            'payout_provider', 'PAYNIT',
            'withdrawal_id', v_withdrawal_id,
            'withdrawal_status', 'PENDING',
            'payout_fee', v_claim_fee,
            'guest_claim_token', v_clean_guest_token,
            'new_balance', v_balance_after
        );

    ELSE
        -- WALLET mode: Requires authenticated user
        IF v_user_id IS NULL THEN
            RAISE EXCEPTION 'Please sign in to claim this Lifafa to your wallet balance';
        END IF;

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
            v_clean_device_fp,
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
            'SUCCESS'::transaction_status,
            'LIFAFA_CLAIM',
            v_claim_id::text,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. SECURE GUEST CLAIM STATUS RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_guest_claim_status_rpc(
    p_lifafa_code TEXT,
    p_guest_claim_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
    v_clean_token TEXT := NULLIF(TRIM(p_guest_claim_token), '');
    v_claim RECORD;
    v_withdrawal RECORD;
BEGIN
    IF v_clean_token IS NULL OR LENGTH(v_clean_token) < 16 THEN
        RETURN jsonb_build_object('found', false, 'message', 'Invalid guest session token');
    END IF;

    SELECT lc.* INTO v_claim
    FROM public.lifafa_claims lc
    JOIN public.lifafas l ON l.id = lc.lifafa_id
    WHERE l.code = UPPER(TRIM(p_lifafa_code))
      AND lc.guest_claim_token = v_clean_token
    ORDER BY lc.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    IF v_claim.withdrawal_id IS NOT NULL THEN
        SELECT id, status, provider_order_id, payout_reference_id, rejection_reason
        INTO v_withdrawal
        FROM public.withdrawals
        WHERE id = v_claim.withdrawal_id;
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'claim_id', v_claim.id,
        'amount', v_claim.amount,
        'payout_mode', v_claim.payout_mode,
        'withdrawal_id', v_claim.withdrawal_id,
        'withdrawal_status', COALESCE(v_withdrawal.status, 'PENDING'),
        'order_id', v_withdrawal.provider_order_id,
        'payout_reference_id', v_withdrawal.payout_reference_id,
        'rejection_reason', v_withdrawal.rejection_reason,
        'created_at', v_claim.created_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_claim_status_rpc(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_claim_status_rpc(TEXT, TEXT) TO anon, authenticated, service_role;
