-- ==============================================================================
-- Migration: 013_phase3_additions.sql
-- Description: Phase 3 Schema Enhancements:
--              1. Adds starts_at and device_claim_limit to lifafas.
--              2. Updated create_lifafa_rpc with full parameter support.
--              3. Updated claim_lifafa_rpc with scheduled start check and device limits.
--              4. Maintains all security hardening (search_path, lifafa_secrets, row locking).
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

-- 0. Safely add EXHAUSTED to lifafa_status if desired, maintaining backward-compatible enum
DO $$ BEGIN
    ALTER TYPE lifafa_status ADD VALUE IF NOT EXISTS 'EXHAUSTED';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 1. Extend lifafas table
ALTER TABLE public.lifafas
    ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    ADD COLUMN IF NOT EXISTS device_claim_limit INT DEFAULT 1;

-- 2. Enhanced create_lifafa_rpc supporting scheduled launch & device limits
CREATE OR REPLACE FUNCTION public.create_lifafa_rpc(
    p_title TEXT,
    p_message TEXT,
    p_total_amount NUMERIC(12, 2),
    p_winner_count INT,
    p_distribution_type distribution_type,
    p_expires_at TIMESTAMPTZ,
    p_is_public BOOLEAN DEFAULT TRUE,
    p_pin_code VARCHAR(10) DEFAULT NULL,
    p_allow_cancel BOOLEAN DEFAULT TRUE,
    p_show_remaining BOOLEAN DEFAULT TRUE,
    p_creator_note TEXT DEFAULT NULL,
    p_tasks JSONB DEFAULT '[]'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL,
    p_min_claim_amount NUMERIC(12, 2) DEFAULT NULL,
    p_max_claim_amount NUMERIC(12, 2) DEFAULT NULL,
    p_starts_at TIMESTAMPTZ DEFAULT NULL,
    p_device_claim_limit INT DEFAULT 1
)
RETURNS JSONB AS $$
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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a Lifafa';
    END IF;

    IF p_total_amount <= 0.00 THEN
        RAISE EXCEPTION 'Total Lifafa amount must be greater than zero';
    END IF;

    IF p_winner_count <= 0 THEN
        RAISE EXCEPTION 'Number of winners must be at least 1';
    END IF;

    IF p_expires_at <= NOW() THEN
        RAISE EXCEPTION 'Expiry date must be set in the future';
    END IF;

    v_starts_at := COALESCE(p_starts_at, TIMEZONE('utc'::text, NOW()));

    -- Calculate platform fee
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

    -- Concurrency-safe lock on creator wallet
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

    -- Deduct total required (amount + fee) from available balance, add principal to reserved balance
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_required,
        reserved_balance = reserved_balance + p_total_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    v_lifafa_code := public.generate_lifafa_code();

    -- Create Lifafa record
    INSERT INTO public.lifafas (
        code,
        creator_id,
        title,
        message,
        total_amount,
        winner_count,
        distribution_type,
        claimed_count,
        remaining_amount,
        status,
        expires_at,
        starts_at,
        device_claim_limit,
        is_public,
        pin_code,
        allow_cancel,
        show_remaining,
        creator_note,
        min_claim_amount,
        max_claim_amount
    ) VALUES (
        v_lifafa_code,
        v_user_id,
        p_title,
        p_message,
        p_total_amount,
        p_winner_count,
        p_distribution_type,
        0,
        p_total_amount,
        'ACTIVE',
        p_expires_at,
        v_starts_at,
        COALESCE(p_device_claim_limit, 1),
        p_is_public,
        CASE WHEN p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 THEN 'PROTECTED' ELSE NULL END,
        p_allow_cancel,
        p_show_remaining,
        p_creator_note,
        p_min_claim_amount,
        p_max_claim_amount
    ) RETURNING id INTO v_lifafa_id;

    -- Store PIN hash in secure isolated table
    IF p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 THEN
        INSERT INTO public.lifafa_secrets (lifafa_id, pin_code_hash, creator_id)
        VALUES (v_lifafa_id, crypt(TRIM(p_pin_code), gen_salt('bf', 8)), v_user_id);
    END IF;

    -- Generate integer paise allocations
    v_total_paise := ROUND(p_total_amount * 100);

    IF p_distribution_type = 'EQUAL' THEN
        v_base_paise := FLOOR(v_total_paise / p_winner_count);
        v_remainder_paise := v_total_paise - (v_base_paise * p_winner_count);

        FOR v_i IN 1..p_winner_count LOOP
            DECLARE
                v_cur_paise BIGINT := v_base_paise;
            BEGIN
                IF v_i <= v_remainder_paise THEN
                    v_cur_paise := v_cur_paise + 1;
                END IF;
                v_running_paise_sum := v_running_paise_sum + v_cur_paise;

                INSERT INTO public.lifafa_allocations (
                    lifafa_id,
                    allocation_index,
                    amount,
                    is_claimed
                ) VALUES (
                    v_lifafa_id,
                    v_i,
                    (v_cur_paise::NUMERIC / 100.0),
                    FALSE
                );
            END;
        END LOOP;
    ELSE
        -- Random distribution: Strictly guaranteed > 0 allocations and exact sum invariant
        DECLARE
            v_min_paise BIGINT := 1;
            v_pool_paise BIGINT;
            v_random_weights NUMERIC[];
            v_total_weight NUMERIC := 0;
            v_weight NUMERIC;
            v_w_i INT;
            v_cur_paise BIGINT;
        BEGIN
            IF v_total_paise >= (p_winner_count * 100) THEN
                v_min_paise := 100; -- Guarantee minimum ₹1.00 if balance allows
            END IF;

            v_pool_paise := v_total_paise - (p_winner_count * v_min_paise);

            FOR v_w_i IN 1..p_winner_count LOOP
                v_weight := RANDOM() + 0.05;
                v_random_weights := ARRAY_APPEND(v_random_weights, v_weight);
                v_total_weight := v_total_weight + v_weight;
            END LOOP;

            FOR v_w_i IN 1..p_winner_count LOOP
                IF v_w_i = p_winner_count THEN
                    -- Last allocation absorbs remaining paise to guarantee 100% exact sum
                    v_cur_paise := v_total_paise - v_running_paise_sum;
                ELSE
                    v_cur_paise := v_min_paise + FLOOR(v_pool_paise * (v_random_weights[v_w_i] / v_total_weight))::BIGINT;
                END IF;

                v_running_paise_sum := v_running_paise_sum + v_cur_paise;

                INSERT INTO public.lifafa_allocations (
                    lifafa_id,
                    allocation_index,
                    amount,
                    is_claimed
                ) VALUES (
                    v_lifafa_id,
                    v_w_i,
                    (v_cur_paise::NUMERIC / 100.0),
                    FALSE
                );
            END LOOP;
        END;
    END IF;

    -- Financial Invariant Assertion: Allocated sum MUST equal total amount down to the exact paise
    IF v_running_paise_sum <> v_total_paise THEN
        RAISE EXCEPTION 'Financial invariant violated: Allocation sum (%) does not equal total (%)', 
            v_running_paise_sum, v_total_paise;
    END IF;

    -- Insert tasks
    IF p_tasks IS NOT NULL AND jsonb_array_length(p_tasks) > 0 THEN
        FOR v_i IN 0..(jsonb_array_length(p_tasks) - 1) LOOP
            v_task := p_tasks->v_i;
            v_task_type := (v_task->>'task_type')::task_type;

            INSERT INTO public.lifafa_tasks (
                lifafa_id,
                task_type,
                title,
                description,
                target_url,
                is_required,
                is_enabled,
                sort_order,
                telegram_channel_username,
                telegram_channel_id,
                telegram_channel_title,
                is_channel_verified,
                verified_bot_username,
                channel_verified_at
            ) VALUES (
                v_lifafa_id,
                v_task_type,
                v_task->>'title',
                v_task->>'description',
                v_task->>'target_url',
                COALESCE((v_task->>'is_required')::boolean, TRUE),
                COALESCE((v_task->>'is_enabled')::boolean, TRUE),
                v_i,
                LOWER(REPLACE(TRIM(COALESCE(v_task->>'telegram_channel_username', '')), '@', '')),
                (v_task->>'telegram_channel_id')::BIGINT,
                v_task->>'telegram_channel_title',
                COALESCE((v_task->>'is_channel_verified')::boolean, FALSE),
                v_task->>'verified_bot_username',
                CASE WHEN (v_task->>'is_channel_verified')::boolean = TRUE THEN TIMEZONE('utc'::text, NOW()) ELSE NULL END
            );
        END LOOP;
    END IF;

    -- Double-entry ledger record for fund reservation
    v_effective_idempotency := COALESCE(p_idempotency_key, 'create_' || v_lifafa_id::text);

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
            'fee', v_fee,
            'winner_count', p_winner_count,
            'distribution_type', p_distribution_type
        )
    );

    -- If platform fee > 0, record fee ledger transaction
    IF v_fee > 0 THEN
        INSERT INTO public.wallet_transactions (
            user_id,
            wallet_id,
            amount,
            type,
            status,
            reference_type,
            reference_id,
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
            v_balance_before - p_total_amount,
            v_balance_after,
            jsonb_build_object('lifafa_code', v_lifafa_code)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa_id,
        'code', v_lifafa_code,
        'reserved_amount', p_total_amount,
        'fee', v_fee,
        'winner_count', p_winner_count,
        'starts_at', v_starts_at,
        'expires_at', p_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Enhanced claim_lifafa_rpc with scheduled start check & device limits
CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc(
    p_code TEXT,
    p_pin_code VARCHAR(10) DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lifafa RECORD;
    v_allocation RECORD;
    v_user_wallet RECORD;
    v_creator_wallet RECORD;
    v_claim_id UUID;
    v_claim_amount NUMERIC(12, 2);
    v_uncompleted_count INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_existing_claim RECORD;
    v_secret RECORD;
    v_device_claims_count INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim a Lifafa';
    END IF;

    v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_' || v_user_id::text);

    -- 1. Check idempotency
    SELECT * INTO v_existing_claim
    FROM public.lifafa_claims
    WHERE idempotency_key = v_effective_idempotency OR (lifafa_id IN (SELECT id FROM public.lifafas WHERE code = TRIM(p_code)) AND user_id = v_user_id);

    IF FOUND THEN
        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;
        RETURN jsonb_build_object(
            'success', true,
            'amount', v_existing_claim.amount,
            'lifafa_code', p_code,
            'is_duplicate', true,
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

    -- Check scheduled start date
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

    -- Check device claim limit
    IF p_device_fingerprint IS NOT NULL AND v_lifafa.device_claim_limit > 0 THEN
        SELECT COUNT(*) INTO v_device_claims_count
        FROM public.lifafa_claims
        WHERE lifafa_id = v_lifafa.id AND device_fingerprint = p_device_fingerprint;

        IF v_device_claims_count >= v_lifafa.device_claim_limit THEN
            RAISE EXCEPTION 'Device claim limit (% per device) reached for this Lifafa', v_lifafa.device_claim_limit;
        END IF;
    END IF;

    -- Verify PIN from isolated lifafa_secrets table
    SELECT * INTO v_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND THEN
        IF p_pin_code IS NULL OR LENGTH(TRIM(p_pin_code)) = 0 THEN
            RAISE EXCEPTION 'Secret PIN code is required to claim this Lifafa';
        END IF;

        IF v_secret.pin_code_hash <> crypt(TRIM(p_pin_code), v_secret.pin_code_hash) THEN
            RAISE EXCEPTION 'Incorrect PIN code entered';
        END IF;
    END IF;

    -- Verify all required tasks
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

    -- Select unclaimed allocation with SKIP LOCKED
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

    -- Mark allocation claimed
    UPDATE public.lifafa_allocations
    SET is_claimed = TRUE,
        claimed_by = v_user_id,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    -- Update Lifafa stats
    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = GREATEST(0.00, remaining_amount - v_claim_amount),
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0.00 THEN 'COMPLETED'::lifafa_status 
            ELSE 'ACTIVE'::lifafa_status 
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    -- Deterministic lock order on wallets
    IF v_lifafa.creator_id < v_user_id THEN
        SELECT * INTO v_creator_wallet FROM public.wallets WHERE user_id = v_lifafa.creator_id FOR UPDATE;
        SELECT * INTO v_user_wallet FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;
    ELSE
        SELECT * INTO v_user_wallet FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;
        SELECT * INTO v_creator_wallet FROM public.wallets WHERE user_id = v_lifafa.creator_id FOR UPDATE;
    END IF;

    -- Decrement creator's reserved balance
    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - v_claim_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- Credit claimant's available balance
    v_balance_before := v_user_wallet.available_balance;
    v_balance_after := v_balance_before + v_claim_amount;

    UPDATE public.wallets
    SET available_balance = available_balance + v_claim_amount,
        total_earned = total_earned + v_claim_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_user_id;

    -- Insert claim record
    INSERT INTO public.lifafa_claims (
        lifafa_id,
        user_id,
        allocation_id,
        amount,
        idempotency_key,
        device_fingerprint,
        ip_address
    ) VALUES (
        v_lifafa.id,
        v_user_id,
        v_allocation.id,
        v_claim_amount,
        v_effective_idempotency,
        p_device_fingerprint,
        p_ip_address
    ) RETURNING id INTO v_claim_id;

    -- Double-entry ledger transaction
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
        'SUCCESS',
        'LIFAFA_CLAIM',
        v_claim_id::text,
        'claim_tx_' || v_claim_id::text,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'lifafa_id', v_lifafa.id,
            'lifafa_code', v_lifafa.code,
            'lifafa_title', v_lifafa.title
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'amount', v_claim_amount,
        'lifafa_code', v_lifafa.code,
        'lifafa_title', v_lifafa.title,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
