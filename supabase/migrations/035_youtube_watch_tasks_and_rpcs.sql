-- ==============================================================================
-- Migration: 035_youtube_watch_tasks_and_rpcs.sql (Migration B)
-- Description: Step 2 of Watch YouTube Video Requirement
--              Applies schema extension (lifafa_tasks.youtube_video_id),
--              supporting indexes, and authoritative RPC updates for
--              creation, engagement completion, and claim gating.
--
-- PREREQUISITE:
-- Must run AFTER Migration 034 (034_add_youtube_watch_enum.sql) has committed.
-- Safe to reference 'YOUTUBE_WATCH' enum value.
--
-- Target: Supabase SQL Editor / Management API
-- DO NOT EXECUTE AUTOMATICALLY. PREPARED FOR USER REVIEW AND MANUAL EXECUTION.
-- ==============================================================================

-- 1. EXTEND lifafa_tasks TABLE WITH youtube_video_id COLUMN
ALTER TABLE public.lifafa_tasks
    ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

-- 2. PARTIAL INDEX FOR FAST LOOKUPS ON YOUTUBE_WATCH TASKS
CREATE INDEX IF NOT EXISTS idx_tasks_youtube_video 
    ON public.lifafa_tasks(youtube_video_id) 
    WHERE task_type = 'YOUTUBE_WATCH';

-- 3. UPDATE create_lifafa_rpc TO PERSIST youtube_video_id
-- Fully preserves Migration 032 architecture: PIN protection, platform fee,
-- LF-XXXXXX code generation, integer paise allocations, and escrow accounting.
CREATE OR REPLACE FUNCTION public.create_lifafa_rpc(
    p_title text,
    p_message text,
    p_total_amount numeric,
    p_winner_count integer,
    p_distribution_type distribution_type,
    p_expires_at timestamp with time zone,
    p_is_public boolean DEFAULT true,
    p_pin_code character varying DEFAULT NULL::character varying,
    p_allow_cancel boolean DEFAULT true,
    p_show_remaining boolean DEFAULT true,
    p_creator_note text DEFAULT NULL::text,
    p_tasks jsonb DEFAULT '[]'::jsonb,
    p_idempotency_key text DEFAULT NULL::text,
    p_min_claim_amount numeric DEFAULT NULL::numeric,
    p_max_claim_amount numeric DEFAULT NULL::numeric,
    p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_device_claim_limit integer DEFAULT 1,
    p_payout_mode character varying DEFAULT 'WALLET'::character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_fee NUMERIC(12, 2) := 0.00;
    v_fee_rec RECORD;
    v_total_required NUMERIC(12, 2);
    v_lifafa_id UUID;
    v_lifafa_code TEXT;
    v_total_paise BIGINT;
    v_base_paise BIGINT;
    v_remainder_paise BIGINT;
    v_running_paise_sum BIGINT := 0;
    v_task JSONB;
    v_task_type task_type;
    v_i INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_starts_at TIMESTAMPTZ;
    v_mode VARCHAR(20);
BEGIN
    -- 1. Authenticate caller
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a Lifafa';
    END IF;

    -- 2. Validate Payout Mode
    v_mode := UPPER(COALESCE(p_payout_mode, 'WALLET'));
    IF v_mode NOT IN ('WALLET', 'UPI_BANK') THEN
        RAISE EXCEPTION 'Invalid payout mode: %. Must be WALLET or UPI_BANK', p_payout_mode;
    END IF;

    -- 3. Validate Inputs
    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be greater than zero';
    END IF;

    IF p_winner_count IS NULL OR p_winner_count < 1 THEN
        RAISE EXCEPTION 'Winner count must be at least 1';
    END IF;

    IF (p_total_amount / p_winner_count) < 0.01 THEN
        RAISE EXCEPTION 'Total amount must allow at least 0.01 per winner';
    END IF;

    IF p_expires_at <= NOW() THEN
        RAISE EXCEPTION 'Expiry date must be strictly in the future';
    END IF;

    v_starts_at := COALESCE(p_starts_at, NOW());

    -- 4. Platform Fee Calculation
    SELECT value, calculation_type INTO v_fee_rec 
    FROM public.platform_fees 
    WHERE fee_type = 'LIFAFA_CREATION' AND is_active = TRUE;

    IF FOUND THEN
        IF v_fee_rec.calculation_type = 'PERCENTAGE' THEN
            v_fee := ROUND((p_total_amount * v_fee_rec.value) / 100.0, 2);
        ELSE
            v_fee := v_fee_rec.value;
        END IF;
    END IF;

    v_total_required := p_total_amount + v_fee;

    -- 5. Lock Creator Wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Creator wallet does not exist';
    END IF;

    IF v_wallet.available_balance < v_total_required THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %, Required: % (including fee: %)',
            v_wallet.available_balance, v_total_required, v_fee;
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - v_total_required;

    -- 6. Deduct balance, escrow principal
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_required,
        reserved_balance = reserved_balance + p_total_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 7. Unique Lifafa Code
    LOOP
        v_lifafa_code := 'LF-' || UPPER(SUBSTRING(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.lifafas WHERE code = v_lifafa_code);
    END LOOP;

    -- 8. Insert Authoritative Lifafa Record ('PROTECTED' indicator, NO plaintext PIN)
    INSERT INTO public.lifafas (
        code,
        creator_id,
        title,
        message,
        total_amount,
        winner_count,
        distribution_type,
        remaining_amount,
        status,
        expires_at,
        starts_at,
        is_public,
        pin_code,
        allow_cancel,
        show_remaining,
        creator_note,
        min_claim_amount,
        max_claim_amount,
        device_claim_limit,
        payout_mode
    ) VALUES (
        v_lifafa_code,
        v_user_id,
        TRIM(p_title),
        p_message,
        p_total_amount,
        p_winner_count,
        p_distribution_type,
        p_total_amount,
        'ACTIVE',
        p_expires_at,
        v_starts_at,
        p_is_public,
        CASE 
            WHEN p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 
            THEN 'PROTECTED' 
            ELSE NULL 
        END,
        p_allow_cancel,
        p_show_remaining,
        p_creator_note,
        p_min_claim_amount,
        p_max_claim_amount,
        p_device_claim_limit,
        v_mode
    ) RETURNING id INTO v_lifafa_id;

    -- 9. Secure PIN Code Storage (Cryptographic bcrypt hash)
    IF p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 THEN
        INSERT INTO public.lifafa_secrets (lifafa_id, pin_code_hash, creator_id)
        VALUES (v_lifafa_id, crypt(TRIM(p_pin_code), gen_salt('bf')), v_user_id)
        ON CONFLICT (lifafa_id) DO UPDATE
        SET pin_code_hash = EXCLUDED.pin_code_hash,
            creator_id = EXCLUDED.creator_id;
    END IF;

    -- 10. Generate Allocations
    v_total_paise := (p_total_amount * 100)::BIGINT;
    v_base_paise := v_total_paise / p_winner_count;
    v_remainder_paise := v_total_paise % p_winner_count;

    FOR v_i IN 1..p_winner_count LOOP
        DECLARE
            v_alloc_paise BIGINT;
        BEGIN
            IF p_distribution_type = 'EQUAL' THEN
                v_alloc_paise := v_base_paise + CASE WHEN v_i <= v_remainder_paise THEN 1 ELSE 0 END;
            ELSE
                IF v_i = p_winner_count THEN
                    v_alloc_paise := v_total_paise - v_running_paise_sum;
                ELSE
                    DECLARE
                        v_remaining_spots INT := p_winner_count - v_i + 1;
                        v_remaining_paise BIGINT := v_total_paise - v_running_paise_sum;
                        v_max_for_this BIGINT := v_remaining_paise - (v_remaining_spots - 1);
                        v_min_for_this BIGINT := 1;
                    BEGIN
                        IF v_max_for_this > v_min_for_this THEN
                            v_alloc_paise := v_min_for_this + floor(random() * (v_max_for_this - v_min_for_this + 1))::BIGINT;
                        ELSE
                            v_alloc_paise := v_min_for_this;
                        END IF;
                    END;
                END IF;
            END IF;

            v_running_paise_sum := v_running_paise_sum + v_alloc_paise;

            INSERT INTO public.lifafa_allocations (
                lifafa_id,
                allocation_index,
                amount,
                is_claimed
            ) VALUES (
                v_lifafa_id,
                v_i,
                ROUND(v_alloc_paise / 100.0, 2),
                FALSE
            );
        END;
    END LOOP;

    -- 11. Tasks Attachment (With youtube_video_id persistence)
    IF p_tasks IS NOT NULL AND jsonb_array_length(p_tasks) > 0 THEN
        FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
            v_task_type := (v_task->>'task_type')::task_type;
            INSERT INTO public.lifafa_tasks (
                lifafa_id,
                task_type,
                title,
                description,
                target_url,
                youtube_video_id,
                is_required,
                is_enabled,
                telegram_channel_username,
                telegram_channel_id,
                telegram_channel_title,
                is_channel_verified,
                sort_order
            ) VALUES (
                v_lifafa_id,
                v_task_type,
                COALESCE(v_task->>'title', 'Community Task'),
                v_task->>'description',
                v_task->>'target_url',
                v_task->>'youtube_video_id',
                COALESCE((v_task->>'is_required')::BOOLEAN, TRUE),
                COALESCE((v_task->>'is_enabled')::BOOLEAN, TRUE),
                v_task->>'telegram_channel_username',
                (v_task->>'telegram_channel_id')::BIGINT,
                v_task->>'telegram_channel_title',
                COALESCE((v_task->>'is_channel_verified')::BOOLEAN, FALSE),
                COALESCE((v_task->>'sort_order')::INT, 0)
            );
        END LOOP;
    END IF;

    -- 12. Ledger Entry: Reserve Escrow
    v_effective_idempotency := COALESCE(p_idempotency_key, 'create_lifafa_' || v_lifafa_id::text);

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
        p_total_amount,
        'RESERVE',
        'SUCCESS',
        'LIFAFA_CREATION',
        v_lifafa_id::text,
        v_effective_idempotency,
        v_balance_before,
        v_balance_before - p_total_amount,
        jsonb_build_object(
            'lifafa_id', v_lifafa_id,
            'lifafa_code', v_lifafa_code,
            'principal', p_total_amount,
            'fee', v_fee,
            'winner_count', p_winner_count,
            'distribution_type', p_distribution_type,
            'payout_mode', v_mode
        )
    );

    -- 13. Ledger Entry: Creation Fee
    IF v_fee > 0 THEN
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
            v_fee,
            'FEE',
            'SUCCESS',
            'LIFAFA_CREATION_FEE',
            v_lifafa_id::text,
            'fee_' || v_effective_idempotency,
            v_balance_before - p_total_amount,
            v_balance_after,
            jsonb_build_object(
                'lifafa_id', v_lifafa_id,
                'lifafa_code', v_lifafa_code,
                'fee', v_fee
            )
        );
    END IF;

    -- 14. Return Creation Summary
    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa_id,
        'code', v_lifafa_code,
        'total_amount', p_total_amount,
        'payout_mode', v_mode,
        'winner_count', p_winner_count
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_lifafa_rpc(text, text, numeric, integer, distribution_type, timestamp with time zone, boolean, character varying, boolean, boolean, text, jsonb, text, numeric, numeric, timestamp with time zone, integer, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lifafa_rpc(text, text, numeric, integer, distribution_type, timestamp with time zone, boolean, character varying, boolean, boolean, text, jsonb, text, numeric, numeric, timestamp with time zone, integer, character varying) TO authenticated;

-- 4. UPDATE record_engagement_task_completion_rpc TO HANDLE YOUTUBE_WATCH
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

REVOKE ALL ON FUNCTION public.record_engagement_task_completion_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_engagement_task_completion_rpc(UUID) TO authenticated;

-- 5. UPDATE claim_lifafa_rpc TO VERIFY YOUTUBE_WATCH COMPLETIONS
-- Preserves all financial atomicity, PayRupee bank dispatch, PIN cryptography,
-- device limits, and SKIP LOCKED allocation guarantees from Migrations 026 and 032.
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

    -- MULTI-TIER COMMUNITY TASK VERIFICATION (INCLUDES YOUTUBE_WATCH)
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
                OR
                -- Tier 4: Watch YouTube Video tasks require player completion confirmation
                (t.task_type = 'YOUTUBE_WATCH'
                 AND (tc.status = 'USER_CONFIRMED' OR tc.status = 'VERIFIED')
                 AND (tc.verification_method IN ('YOUTUBE_PLAYER_ENDED', 'USER_CONFIRMED', 'ENGAGEMENT')))
            )
      );

    IF v_uncompleted_count > 0 THEN
        RAISE EXCEPTION 'Please complete and verify all required community tasks before claiming';
    END IF;

    -- 3. Select next available allocation
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

REVOKE EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
