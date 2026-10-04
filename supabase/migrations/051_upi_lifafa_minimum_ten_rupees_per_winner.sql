-- ==============================================================================
-- MIGRATION 051: UPI LIFAFA — MINIMUM ₹10 PER WINNER ENFORCEMENT
-- ==============================================================================
-- BUSINESS REQUIREMENT:
-- For every NEW external UPI Lifafa (payout_mode = 'UPI_BANK'):
-- EVERY WINNER MUST RECEIVE AT LEAST ₹10.00.
--
-- EQUAL DISTRIBUTION:
-- p_total_amount / p_winner_count >= 10.00
--
-- RANDOM DISTRIBUTION:
-- Every single allocation must satisfy allocation.amount >= 10.00.
-- The generator guarantees min >= 10.00 paise for all spots.
--
-- SCOPE & NON-REGRESSION:
-- - Applies ONLY to payout_mode = 'UPI_BANK'.
-- - payout_mode = 'WALLET' behavior is completely unchanged.
-- - Payout fee escrow calculations and slabs are fully preserved.
-- - Existing historical Lifafas and allocations are completely untouched.
-- ==============================================================================

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
    v_min_paise_per_winner BIGINT := 1;
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

    -- [NEW BUSINESS RULE]: UPI Lifafa Minimum ₹10.00 Per Winner
    IF v_mode = 'UPI_BANK' THEN
        IF (p_total_amount / p_winner_count) < 10.00 THEN
            RAISE EXCEPTION 'Each winner must receive at least ₹10 for UPI Lifafa.';
        END IF;

        IF p_min_claim_amount IS NOT NULL AND p_min_claim_amount < 10.00 THEN
            RAISE EXCEPTION 'Each winner must receive at least ₹10 for UPI Lifafa.';
        END IF;
    END IF;

    IF p_expires_at <= NOW() THEN
        RAISE EXCEPTION 'Expiry date must be strictly in the future';
    END IF;

    v_starts_at := COALESCE(p_starts_at, NOW());

    -- 4. Precompute Allocations & Authoritative Payout Fee Reserve
    v_total_paise := (p_total_amount * 100)::BIGINT;
    v_base_paise := v_total_paise / p_winner_count;
    v_remainder_paise := v_total_paise % p_winner_count;

    -- Establish floor paise per allocation
    IF v_mode = 'UPI_BANK' THEN
        v_min_paise_per_winner := 1000; -- ₹10.00 minimum for UPI
        IF p_min_claim_amount IS NOT NULL AND (p_min_claim_amount * 100)::BIGINT > 1000 THEN
            v_min_paise_per_winner := (p_min_claim_amount * 100)::BIGINT;
        END IF;
    ELSE
        IF p_min_claim_amount IS NOT NULL AND (p_min_claim_amount * 100)::BIGINT > 1 THEN
            v_min_paise_per_winner := (p_min_claim_amount * 100)::BIGINT;
        ELSE
            v_min_paise_per_winner := 1;
        END IF;
    END IF;

    FOR v_i IN 1..p_winner_count LOOP
        DECLARE
            v_alloc_paise BIGINT;
            v_alloc_amount NUMERIC(12, 2);
        BEGIN
            IF p_distribution_type = 'EQUAL' THEN
                v_alloc_paise := v_base_paise + CASE WHEN v_i <= v_remainder_paise THEN 1 ELSE 0 END;
            ELSE
                -- RANDOM Distribution
                IF v_i = p_winner_count THEN
                    v_alloc_paise := v_total_paise - v_running_paise_sum;
                ELSE
                    DECLARE
                        v_remaining_spots INT := p_winner_count - v_i + 1;
                        v_remaining_paise BIGINT := v_total_paise - v_running_paise_sum;
                        v_max_for_this BIGINT := v_remaining_paise - ((v_remaining_spots - 1) * v_min_paise_per_winner);
                        v_min_for_this BIGINT := v_min_paise_per_winner;
                    BEGIN
                        IF p_max_claim_amount IS NOT NULL THEN
                            v_max_for_this := LEAST(v_max_for_this, (p_max_claim_amount * 100)::BIGINT);
                        END IF;

                        IF v_max_for_this < v_min_for_this THEN
                            IF v_mode = 'UPI_BANK' THEN
                                RAISE EXCEPTION 'Each winner must receive at least ₹10 for UPI Lifafa.';
                            ELSE
                                v_alloc_paise := v_min_for_this;
                            END IF;
                        ELSIF v_max_for_this > v_min_for_this THEN
                            v_alloc_paise := v_min_for_this + floor(random() * (v_max_for_this - v_min_for_this + 1))::BIGINT;
                        ELSE
                            v_alloc_paise := v_min_for_this;
                        END IF;
                    END;
                END IF;
            END IF;

            -- Authoritative validation of allocation for UPI
            IF v_mode = 'UPI_BANK' AND v_alloc_paise < 1000 THEN
                RAISE EXCEPTION 'Each winner must receive at least ₹10 for UPI Lifafa.';
            END IF;

            v_running_paise_sum := v_running_paise_sum + v_alloc_paise;
            v_alloc_amount := ROUND(v_alloc_paise / 100.0, 2);

            IF v_mode = 'UPI_BANK' AND v_alloc_amount < 10.00 THEN
                RAISE EXCEPTION 'Each winner must receive at least ₹10 for UPI Lifafa.';
            END IF;

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
        idempotency_key,
        min_claim_amount,
        max_claim_amount,
        device_claim_limit,
        payout_mode,
        total_fee_amount,
        remaining_fee_amount
    ) VALUES (
        v_lifafa_code,
        v_user_id,
        p_title,
        p_message,
        p_total_amount,
        p_winner_count,
        p_distribution_type,
        p_total_amount,
        'ACTIVE'::lifafa_status,
        p_expires_at,
        v_starts_at,
        p_is_public,
        p_pin_code,
        p_allow_cancel,
        p_show_remaining,
        p_creator_note,
        p_idempotency_key,
        p_min_claim_amount,
        p_max_claim_amount,
        p_device_claim_limit,
        v_mode,
        v_total_payout_fee,
        v_total_payout_fee
    ) RETURNING id INTO v_lifafa_id;

    -- 10. Store PIN Hash if PIN provided
    IF p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 THEN
        INSERT INTO public.lifafa_secrets (
            lifafa_id,
            pin_code_hash
        ) VALUES (
            v_lifafa_id,
            crypt(TRIM(p_pin_code), gen_salt('bf', 8))
        );
    END IF;

    -- 11. Insert Authoritative Allocations
    FOR v_i IN 1..p_winner_count LOOP
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

    -- 12. Insert Required Tasks (if provided)
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
                sort_order,
                youtube_video_id,
                telegram_channel_username,
                telegram_channel_id,
                is_channel_verified
            ) VALUES (
                v_lifafa_id,
                v_task_type,
                COALESCE(v_task->>'title', 'Community Requirement'),
                v_task->>'description',
                v_task->>'target_url',
                COALESCE((v_task->>'is_required')::BOOLEAN, TRUE),
                COALESCE((v_task->>'is_enabled')::BOOLEAN, TRUE),
                COALESCE((v_task->>'sort_order')::INT, 0),
                v_task->>'youtube_video_id',
                v_task->>'telegram_channel_username',
                (v_task->>'telegram_channel_id')::BIGINT,
                COALESCE((v_task->>'is_channel_verified')::BOOLEAN, FALSE)
            );
        END LOOP;
    END IF;

    -- 13. Audit Trail: Wallet Transaction for Lifafa Creation & Escrow Reservation
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
        -v_total_required,
        'SPEND',
        'SUCCESS'::transaction_status,
        'LIFAFA_CREATION',
        v_lifafa_id::text,
        'tx_' || v_effective_idempotency,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'lifafa_id', v_lifafa_id,
            'lifafa_code', v_lifafa_code,
            'prize_pool', p_total_amount,
            'winner_count', p_winner_count,
            'payout_mode', v_mode,
            'creation_fee', v_fee,
            'payout_fee_escrow', v_total_payout_fee,
            'total_deducted', v_total_required
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa_id,
        'code', v_lifafa_code,
        'total_amount', p_total_amount,
        'winner_count', p_winner_count,
        'distribution_type', p_distribution_type,
        'payout_mode', v_mode,
        'creation_fee', v_fee,
        'payout_fee_escrow', v_total_payout_fee,
        'total_required', v_total_required,
        'new_balance', v_balance_after
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_lifafa_rpc(text, text, numeric, integer, distribution_type, timestamp with time zone, boolean, character varying, boolean, boolean, text, jsonb, text, numeric, numeric, timestamp with time zone, integer, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lifafa_rpc(text, text, numeric, integer, distribution_type, timestamp with time zone, boolean, character varying, boolean, boolean, text, jsonb, text, numeric, numeric, timestamp with time zone, integer, character varying) TO authenticated, service_role;
