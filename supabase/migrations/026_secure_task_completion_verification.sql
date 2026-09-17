-- ==============================================================================
-- Migration: 026_secure_task_completion_verification.sql
-- Description: Strengthen task completion security while strictly preserving
--              the existing production Lifafa schema, tables, and claim logic.
--
-- Target: Supabase SQL Editor (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================

-- 1. SAFE ENUM EXTENSION (IF task_completion_status ENUM EXISTS)
-- Idempotently registers CLICK_CONFIRMED and USER_CONFIRMED if enum type exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_completion_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'task_completion_status' AND e.enumlabel = 'CLICK_CONFIRMED'
        ) THEN
            ALTER TYPE public.task_completion_status ADD VALUE 'CLICK_CONFIRMED';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = 'task_completion_status' AND e.enumlabel = 'USER_CONFIRMED'
        ) THEN
            ALTER TYPE public.task_completion_status ADD VALUE 'USER_CONFIRMED';
        END IF;
    END IF;
END $$;

-- 2. TARGETED STATUS CHECK CONSTRAINT ON task_completions
-- Specifically drops only the check constraint on task_completions.status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'task_completions'
          AND c.contype = 'c'
          AND a.attname = 'status'
    ) LOOP
        EXECUTE 'ALTER TABLE public.task_completions DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.task_completions 
    ADD CONSTRAINT task_completions_status_check 
    CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED', 'CLICK_CONFIRMED', 'USER_CONFIRMED'));

-- 3. LOCK DOWN task_completions RLS (NO DIRECT CLIENT INSERT / UPDATE)
DROP POLICY IF EXISTS "Users can view and insert own task completions" ON public.task_completions;
DROP POLICY IF EXISTS "Users can insert own task completions" ON public.task_completions;
DROP POLICY IF EXISTS "Users can insert completions" ON public.task_completions;
DROP POLICY IF EXISTS "Users can update own task completions" ON public.task_completions;
DROP POLICY IF EXISTS "Only server or admin can update task completions" ON public.task_completions;
DROP POLICY IF EXISTS "Only admin can update task completions" ON public.task_completions;
DROP POLICY IF EXISTS "Only admin can insert task completions" ON public.task_completions;
DROP POLICY IF EXISTS "No direct client insert on task completions" ON public.task_completions;
DROP POLICY IF EXISTS "Users can view own task completions" ON public.task_completions;

-- Authenticated claimants can only view their own completion records
CREATE POLICY "Users can view own task completions"
    ON public.task_completions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- Only admins can directly insert or update task completions outside RPCs
CREATE POLICY "Only admin can insert task completions"
    ON public.task_completions FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admin can update task completions"
    ON public.task_completions FOR UPDATE
    USING (public.is_admin());

-- 4. REVOKE OLD CLIENT-FACING TELEGRAM COMPLETION RPC
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'record_telegram_member_completion_rpc'
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.record_telegram_member_completion_rpc(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 5. SERVER-ONLY TELEGRAM COMPLETION RPC (service_role ONLY)
-- Called strictly by the verify-telegram-membership Edge Function after Bot API getChatMember
CREATE OR REPLACE FUNCTION public.record_telegram_member_completion_server_rpc(
    p_task_id UUID,
    p_user_id UUID,
    p_telegram_user_id BIGINT,
    p_telegram_username TEXT,
    p_member_status TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_task RECORD;
    v_profile RECORD;
    v_valid_statuses TEXT[] := ARRAY['creator', 'administrator', 'member', 'restricted'];
BEGIN
    -- Authorization: strictly service_role or platform admin
    v_caller_role := current_setting('role', true);
    IF v_caller_role <> 'service_role' AND auth.uid() IS NOT NULL THEN
        IF NOT public.is_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Unauthorized: only service_role or admin can record server-verified completions';
        END IF;
    END IF;

    -- Validate member status
    IF NOT (p_member_status = ANY(v_valid_statuses)) THEN
        RAISE EXCEPTION 'Invalid or unverified Telegram member status: %', p_member_status;
    END IF;

    -- Validate task exists and belongs to a valid Lifafa
    SELECT * INTO v_task FROM public.lifafa_tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found: %', p_task_id;
    END IF;

    -- Validate task type is Telegram
    IF v_task.task_type NOT IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT') THEN
        RAISE EXCEPTION 'Task is not a Telegram task (Type: %)', v_task.task_type;
    END IF;

    -- Verify associated Lifafa exists
    IF NOT EXISTS (SELECT 1 FROM public.lifafas WHERE id = v_task.lifafa_id) THEN
        RAISE EXCEPTION 'Associated Lifafa not found for task %', p_task_id;
    END IF;

    -- Verify and update claimant profile with Telegram binding
    SELECT id INTO v_profile FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claimant profile not found for user %', p_user_id;
    END IF;

    IF p_telegram_username IS NOT NULL OR p_telegram_user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET telegram_user_id = COALESCE(p_telegram_user_id, telegram_user_id),
            telegram_username = COALESCE(LOWER(REPLACE(TRIM(p_telegram_username), '@', '')), telegram_username),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = p_user_id;
    END IF;

    -- Authoritatively upsert task completion as VERIFIED with TELEGRAM_BOT_API
    -- Note: verified_via_bot is hardcoded to TRUE and verification_method is hardcoded to TELEGRAM_BOT_API
    INSERT INTO public.task_completions (
        task_id,
        lifafa_id,
        user_id,
        status,
        verification_method,
        telegram_member_status,
        verified_via_bot,
        metadata
    ) VALUES (
        p_task_id,
        v_task.lifafa_id,
        p_user_id,
        'VERIFIED',
        'TELEGRAM_BOT_API',
        p_member_status,
        TRUE,
        jsonb_build_object(
            'telegram_user_id', p_telegram_user_id,
            'telegram_username', p_telegram_username,
            'channel_username', v_task.telegram_channel_username,
            'verified_by', 'verify-telegram-membership-function',
            'verified_at', TIMEZONE('utc'::text, NOW())
        )
    )
    ON CONFLICT (task_id, user_id) DO UPDATE SET
        status = 'VERIFIED',
        verification_method = 'TELEGRAM_BOT_API',
        telegram_member_status = EXCLUDED.telegram_member_status,
        verified_via_bot = TRUE,
        metadata = public.task_completions.metadata || EXCLUDED.metadata;

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'status', 'VERIFIED',
        'verification_tier', 'SERVER_VERIFIED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.record_telegram_member_completion_server_rpc(UUID, UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_telegram_member_completion_server_rpc(UUID, UUID, BIGINT, TEXT, TEXT) TO service_role;

-- 6. ENGAGEMENT TASK COMPLETION RPC (Non-Telegram ONLY)
-- Handles Click-Confirmed (Website) and User-Confirmed (Instagram/YouTube/Social)
CREATE OR REPLACE FUNCTION public.record_engagement_task_completion_rpc(
    p_task_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_task RECORD;
    v_status TEXT;
    v_method TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
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
    ELSIF v_task.task_type IN ('INSTAGRAM_FOLLOW', 'INSTAGRAM_LIKE', 'YOUTUBE_SUB', 'REFERRAL') THEN
        v_status := 'USER_CONFIRMED';
        v_method := 'USER_CONFIRMED';
    ELSE
        v_status := 'CLICK_CONFIRMED';
        v_method := 'ENGAGEMENT';
    END IF;

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

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'status', v_status,
        'method', v_method
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.record_engagement_task_completion_rpc(UUID) TO authenticated;

-- 7. AUTHORITATIVE claim_lifafa_rpc (PRESERVES EXISTING MIGRATION 018/019/025 ARCHITECTURE)
-- ONLY strengthens the required community tasks verification section while preserving
-- all financial, idempotency, device limit, PIN, allocation, PayRupee, and 025 logic byte-for-byte.
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

    -- MULTI-TIER COMMUNITY TASK VERIFICATION (STRENGTHENED)
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
                -- Tier 1: Telegram tasks strictly require true server verification via Bot API
                (t.task_type IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT')
                 AND tc.status = 'VERIFIED'
                 AND tc.verification_method = 'TELEGRAM_BOT_API'
                 AND tc.verified_via_bot = TRUE)
                OR
                -- Tier 2: Visit website / custom link tasks require CLICK_CONFIRMED (or historical URL_VISIT)
                (t.task_type IN ('VISIT_WEBSITE', 'CUSTOM')
                 AND (tc.status = 'CLICK_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method = 'URL_VISIT')))
                OR
                -- Tier 3: Social follow / sub tasks require USER_CONFIRMED (or historical attestation)
                (t.task_type IN ('INSTAGRAM_FOLLOW', 'INSTAGRAM_LIKE', 'YOUTUBE_SUB', 'REFERRAL')
                 AND (tc.status = 'USER_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method IN ('MANUAL', 'ENGAGEMENT', 'OAUTH_CHECK'))))
            )
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
            'SUCCESS'::transaction_status,
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

-- 8. CLEAN RPC EXECUTE GRANTS
REVOKE EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
