-- ==============================================================================
-- Migration: 049_lifafa_payout_fee_escrow.sql
-- Description: Authoritative Platform Payout Fee Escrow & Revenue Leak Fix
--              1. Authoritative Server-side Payout Fee Slab function:
--                 public.get_lifafa_payout_fee(numeric)
--                 - ₹1.00 to ₹500.00        -> ₹2.50
--                 - Above ₹500.00 to ₹1,000 -> ₹2.70
--                 - Above ₹1,000 to ₹5,000  -> ₹3.50
--              2. Schema Extension on public.lifafas:
--                 - total_fee_amount NUMERIC(12, 2) DEFAULT 0.00
--                 - remaining_fee_amount NUMERIC(12, 2) DEFAULT 0.00
--              3. Updated public.create_lifafa_rpc:
--                 - Upfront calculation and reservation of maximum payout fees
--                   for external UPI Lifafas (payout_mode = 'UPI_BANK').
--                 - Creator available balance must cover:
--                   TOTAL PRIZE AMOUNT + TOTAL MAXIMUM PAYOUT FEES.
--                 - Escrows prize + payout fees in wallets.reserved_balance.
--              4. Updated public.claim_lifafa_rpc:
--                 - For UPI_BANK external claims, claimant receives exact prize.
--                 - Creator escrow is reduced by payout + platform fee.
--                 - Platform fee is recognized in withdrawals and wallet_transactions.
--                 - Claimant is NOT charged the fee.
--              5. Updated public.refund_expired_or_cancelled_lifafa_rpc:
--                 - Unclaimed winners NEVER pay fees: refunds unused prize escrow
--                   AND unconsumed fee reserve back to creator available balance.
--              6. Preserves admin_update_withdrawal_rpc refund behavior:
--                 - On failed payout, full transaction amount (prize + fee) is
--                   safely restored to creator available balance.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE AUTOMATICALLY
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTHORITATIVE SERVER-SIDE LIFAFA PAYOUT FEE CALCULATION FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lifafa_payout_fee(p_amount NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    IF p_amount IS NULL OR p_amount <= 0.00 THEN
        RETURN 0.00;
    ELSIF p_amount <= 500.00 THEN
        RETURN 2.50;
    ELSIF p_amount <= 1000.00 THEN
        RETURN 2.70;
    ELSE
        RETURN 3.50;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.get_lifafa_payout_fee(NUMERIC) TO PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. EXTEND public.lifafas SCHEMA WITH FEE ESCROW TRACKING COLUMNS
-- ------------------------------------------------------------------------------
ALTER TABLE public.lifafas
    ADD COLUMN IF NOT EXISTS total_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS remaining_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- ------------------------------------------------------------------------------
-- 3. UPGRADE public.create_lifafa_rpc (UPFRONT PAYOUT FEE RESERVATION)
-- ------------------------------------------------------------------------------
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
    v_total_payout_fee NUMERIC(12, 2) := 0.00;
    v_total_required NUMERIC(12, 2);
    v_lifafa_id UUID;
    v_lifafa_code TEXT;
    v_total_paise BIGINT;
    v_base_paise BIGINT;
    v_remainder_paise BIGINT;
    v_running_paise_sum BIGINT := 0;
    v_allocations_arr NUMERIC(12, 2)[] := ARRAY[]::NUMERIC(12, 2)[];
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

    -- 4. Precompute Allocations & Authoritative Payout Fee Reserve
    v_total_paise := (p_total_amount * 100)::BIGINT;
    v_base_paise := v_total_paise / p_winner_count;
    v_remainder_paise := v_total_paise % p_winner_count;

    FOR v_i IN 1..p_winner_count LOOP
        DECLARE
            v_alloc_paise BIGINT;
            v_alloc_amount NUMERIC(12, 2);
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
            v_alloc_amount := ROUND(v_alloc_paise / 100.0, 2);
            v_allocations_arr := array_append(v_allocations_arr, v_alloc_amount);

            -- Calculate payout fee per winner for external UPI_BANK Lifafas
            IF v_mode = 'UPI_BANK' THEN
                v_total_payout_fee := v_total_payout_fee + public.get_lifafa_payout_fee(v_alloc_amount);
            END IF;
        END;
    END LOOP;

    -- 5. Platform Creation Fee Calculation (if configured in platform_fees)
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

    -- Total creator funding required = Prize Pool + Creation Fee + Total External Payout Fees
    v_total_required := p_total_amount + v_fee + v_total_payout_fee;

    -- 6. Lock Creator Wallet & Validate Balance
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Creator wallet does not exist';
    END IF;

    IF v_wallet.available_balance < v_total_required THEN
        RAISE EXCEPTION USING MESSAGE = format(
            'Insufficient balance. Available: ₹%s, Required: ₹%s (Prize: ₹%s, Fee: ₹%s)',
            v_wallet.available_balance,
            v_total_required,
            p_total_amount,
            v_total_payout_fee
        );
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - v_total_required;

    -- 7. Deduct Available Balance & Escrow Prize + Payout Fees
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_required,
        reserved_balance = reserved_balance + p_total_amount + v_total_payout_fee,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 8. Unique Lifafa Code
    LOOP
        v_lifafa_code := 'LF-' || UPPER(SUBSTRING(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.lifafas WHERE code = v_lifafa_code);
    END LOOP;

    -- 9. Insert Authoritative Lifafa Record
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
        payout_mode,
        total_fee_amount,
        remaining_fee_amount
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
        v_mode,
        v_total_payout_fee,
        v_total_payout_fee
    ) RETURNING id INTO v_lifafa_id;

    -- 10. Secure PIN Code Storage (Cryptographic bcrypt hash)
    IF p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 THEN
        INSERT INTO public.lifafa_secrets (lifafa_id, pin_code_hash, creator_id)
        VALUES (v_lifafa_id, crypt(TRIM(p_pin_code), gen_salt('bf')), v_user_id)
        ON CONFLICT (lifafa_id) DO UPDATE
        SET pin_code_hash = EXCLUDED.pin_code_hash,
            creator_id = EXCLUDED.creator_id;
    END IF;

    -- 11. Insert Precomputed Allocations
    FOR v_i IN 1..array_length(v_allocations_arr, 1) LOOP
        INSERT INTO public.lifafa_allocations (
            lifafa_id,
            allocation_index,
            amount,
            is_claimed
        ) VALUES (
            v_lifafa_id,
            v_i,
            v_allocations_arr[v_i],
            FALSE
        );
    END LOOP;

    -- 12. Insert Required Tasks (if any)
    IF p_tasks IS NOT NULL AND jsonb_array_length(p_tasks) > 0 THEN
        FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
            v_task_type := (v_task->>'task_type')::task_type;
            INSERT INTO public.lifafa_tasks (
                lifafa_id,
                task_type,
                title,
                description,
                target_url,
                is_required,
                is_enabled,
                telegram_channel_id,
                telegram_channel_username,
                youtube_video_id
            ) VALUES (
                v_lifafa_id,
                v_task_type,
                COALESCE(v_task->>'title', 'Community Requirement'),
                v_task->>'description',
                v_task->>'target_url',
                COALESCE((v_task->>'is_required')::BOOLEAN, TRUE),
                COALESCE((v_task->>'is_enabled')::BOOLEAN, TRUE),
                v_task->>'telegram_channel_id',
                v_task->>'telegram_channel_username',
                v_task->>'youtube_video_id'
            );
        END LOOP;
    END IF;

    -- 13. Double-Entry Float Ledger Transactions
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
        -p_total_amount,
        'RESERVE',
        'SUCCESS'::transaction_status,
        'LIFAFA_CREATION',
        v_lifafa_id::text,
        'reserve_prize_' || v_effective_idempotency,
        v_balance_before,
        v_balance_before - p_total_amount,
        jsonb_build_object(
            'lifafa_id', v_lifafa_id,
            'lifafa_code', v_lifafa_code,
            'winner_count', p_winner_count,
            'payout_mode', v_mode,
            'distribution_type', p_distribution_type
        )
    );

    IF v_total_payout_fee > 0.00 THEN
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
            -v_total_payout_fee,
            'RESERVE',
            'SUCCESS'::transaction_status,
            'LIFAFA_PAYOUT_FEE_RESERVE',
            v_lifafa_id::text,
            'reserve_fee_' || v_effective_idempotency,
            v_balance_before - p_total_amount,
            v_balance_after,
            jsonb_build_object(
                'lifafa_id', v_lifafa_id,
                'lifafa_code', v_lifafa_code,
                'fee_reserve', v_total_payout_fee,
                'payout_mode', v_mode
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa_id,
        'code', v_lifafa_code,
        'total_amount', p_total_amount,
        'payout_fees', v_total_payout_fee,
        'total_reserved', (p_total_amount + v_total_payout_fee),
        'winner_count', p_winner_count,
        'payout_mode', v_mode,
        'distribution_type', p_distribution_type,
        'new_balance', v_balance_after
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_lifafa_rpc(text, text, numeric, integer, distribution_type, timestamp with time zone, boolean, character varying, boolean, boolean, text, jsonb, text, numeric, numeric, timestamp with time zone, integer, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lifafa_rpc(text, text, numeric, integer, distribution_type, timestamp with time zone, boolean, character varying, boolean, boolean, text, jsonb, text, numeric, numeric, timestamp with time zone, integer, character varying) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. UPGRADE public.claim_lifafa_rpc (ATOMIC FEE RECOGNITION & CREATOR ESCROW REDUCTION)
-- ------------------------------------------------------------------------------
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
    v_claim_fee NUMERIC(12, 2) := 0.00;
    v_uncompleted_count INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_existing_claim RECORD;
    v_device_claims_count INT;
    v_secret RECORD;
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

    -- 5. Calculate Fee & Update Lifafa Row
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Only deduct fee if Lifafa was created with fee escrow (backward-compatible)
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

    -- 6. Deduct from creator escrow: prize amount + applicable payout fee
    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - (v_claim_amount + v_claim_fee)),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- 7. Payout Routing: UPI_BANK (External PayNit UPI) vs WALLET (Internal Instant)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Insert into public.withdrawals for external PayNit UPI dispatch
        -- amount = v_claim_amount + v_claim_fee (total deduction funded by creator)
        -- fee_amount = v_claim_fee (platform fee recognized)
        -- net_amount = v_claim_amount (exact prize delivered to claimant)
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
                    'claim_amount', v_claim_amount,
                    'payout_fee', v_claim_fee
                )
            );
        END IF;

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
            'payout_fee', v_claim_fee,
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

REVOKE ALL ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. UPGRADE public.refund_expired_or_cancelled_lifafa_rpc (REFUNDS UNCONSUMED FEE RESERVE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(
    p_lifafa_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_service_role BOOLEAN := (
        COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
        OR auth.role() = 'service_role'
        OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );
    v_lifafa RECORD;
    v_creator_wallet RECORD;
    v_refund_prize NUMERIC(12, 2);
    v_refund_fee NUMERIC(12, 2) := 0.00;
    v_total_refund NUMERIC(12, 2);
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
BEGIN
    -- Explicitly reject anonymous callers
    IF NOT v_is_service_role THEN
        IF v_caller_id IS NULL THEN
            RAISE EXCEPTION 'Authentication required to refund this Lifafa';
        END IF;
    END IF;

    -- Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    -- Authorize: service_role (expiry sweep), Lifafa creator, or Administrator
    IF NOT v_is_service_role THEN
        IF v_caller_id <> v_lifafa.creator_id AND NOT public.has_admin_role('ADMIN') THEN
            RAISE EXCEPTION 'Unauthorized to refund this Lifafa';
        END IF;
    END IF;

    -- Status eligibility check
    IF v_lifafa.status NOT IN ('ACTIVE', 'EXPIRED') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lifafa already completed, refunded, or cancelled');
    END IF;

    -- Calculate refund amounts: remaining prize + unconsumed fee reserve
    v_refund_prize := v_lifafa.remaining_amount;

    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        v_refund_fee := COALESCE(v_lifafa.remaining_fee_amount, 0.00);
    ELSE
        v_refund_fee := 0.00;
    END IF;

    v_total_refund := v_refund_prize + v_refund_fee;

    IF v_total_refund <= 0 THEN
        UPDATE public.lifafas
        SET status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_lifafa.id;
        RETURN jsonb_build_object('success', true, 'refunded_amount', 0);
    END IF;

    SELECT * INTO v_creator_wallet
    FROM public.wallets
    WHERE user_id = v_lifafa.creator_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Creator wallet not found';
    END IF;

    v_balance_before := v_creator_wallet.available_balance;
    v_balance_after := v_balance_before + v_total_refund;

    UPDATE public.wallets
    SET available_balance = available_balance + v_total_refund,
        reserved_balance = GREATEST(0.00, reserved_balance - v_total_refund),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_creator_wallet.id;

    UPDATE public.lifafas
    SET remaining_amount = 0.00,
        remaining_fee_amount = 0.00,
        status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    v_idempotency_key := 'refund_' || v_lifafa.id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;

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
        v_total_refund,
        'REFUND',
        'SUCCESS'::transaction_status,
        'LIFAFA_REFUND',
        v_lifafa.id::text,
        v_idempotency_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'lifafa_id', v_lifafa.id,
            'lifafa_code', v_lifafa.code,
            'refunded_prize', v_refund_prize,
            'refunded_fee_reserve', v_refund_fee,
            'total_refund', v_total_refund
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa.id,
        'refunded_amount', v_total_refund,
        'refunded_prize', v_refund_prize,
        'refunded_fee_reserve', v_refund_fee,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) TO authenticated, service_role;
