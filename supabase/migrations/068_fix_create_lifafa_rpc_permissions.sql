-- ==============================================================================
-- MIGRATION 068: AUTHORITATIVE FIX FOR CREATE_LIFAFA_RPC PERMISSIONS & OVERLOADS
-- ==============================================================================
-- SQL STATUS: NOT EXECUTED — AWAITING MANUAL EXECUTION
--
-- PURPOSE:
-- 1. Eliminate all competing / historical overloaded definitions of
--    public.create_lifafa_rpc in pg_proc (from Migrations 010, 013, 017, 032, 049, 051, 054).
-- 2. Define the single authoritative, canonical 18-parameter public.create_lifafa_rpc.
-- 3. Ensure SECURITY DEFINER with strict search_path = 'public', 'extensions', 'pg_temp'.
-- 4. Verify auth.uid() authentication and user ownership.
-- 5. Preserve all financial validations, platform fee escrow, wallet locks,
--    RESERVE transaction type, minimum ₹10 per winner for UPI Lifafas, idempotency,
--    and allocation generation.
-- 6. Correctly GRANT EXECUTE to 'authenticated' and 'service_role'.
-- 7. Strictly REVOKE ALL permissions from 'PUBLIC' and 'anon'.
-- ==============================================================================

-- STEP 1: DYNAMICALLY DROP ALL EXISTING OVERLOADS OF create_lifafa_rpc
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'create_lifafa_rpc'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE;';
    END LOOP;
END;
$$;

-- STEP 2: CREATE CANONICAL 18-PARAMETER FUNCTION
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
    v_clean_idempotency TEXT;
    v_existing_lifafa RECORD;
BEGIN
    -- 1. Authenticate caller (must be signed-in user)
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a Lifafa';
    END IF;

    -- 2. Idempotency Check: Return existing Lifafa without double debiting creator funds
    v_clean_idempotency := NULLIF(TRIM(p_idempotency_key), '');
    IF v_clean_idempotency IS NOT NULL THEN
        SELECT id, code, total_amount, winner_count, distribution_type, payout_mode,
               total_fee_amount
        INTO v_existing_lifafa
        FROM public.lifafas
        WHERE creator_id = v_user_id AND idempotency_key = v_clean_idempotency;

        IF FOUND THEN
            SELECT available_balance INTO v_balance_after 
            FROM public.wallets WHERE user_id = v_user_id;

            RETURN jsonb_build_object(
                'success', true,
                'lifafa_id', v_existing_lifafa.id,
                'code', v_existing_lifafa.code,
                'total_amount', v_existing_lifafa.total_amount,
                'winner_count', v_existing_lifafa.winner_count,
                'distribution_type', v_existing_lifafa.distribution_type,
                'payout_mode', v_existing_lifafa.payout_mode,
                'creation_fee', v_existing_lifafa.total_fee_amount,
                'payout_fee_escrow', v_existing_lifafa.total_fee_amount,
                'total_required', v_existing_lifafa.total_amount + v_existing_lifafa.total_fee_amount,
                'new_balance', v_balance_after,
                'is_idempotent_replay', true
            );
        END IF;
    END IF;

    -- 3. Validate Payout Mode
    v_mode := UPPER(COALESCE(p_payout_mode, 'WALLET'));
    IF v_mode NOT IN ('WALLET', 'UPI_BANK') THEN
        RAISE EXCEPTION 'Invalid payout mode: %. Must be WALLET or UPI_BANK', p_payout_mode;
    END IF;

    -- 4. Validate Inputs
    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be greater than zero';
    END IF;

    IF p_winner_count IS NULL OR p_winner_count < 1 THEN
        RAISE EXCEPTION 'Winner count must be at least 1';
    END IF;

    IF (p_total_amount / p_winner_count) < 0.01 THEN
        RAISE EXCEPTION 'Total amount must allow at least 0.01 per winner';
    END IF;

    -- UPI Lifafa Minimum ₹10.00 Per Winner Enforcement
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

    -- 5. Precompute Allocations & Authoritative Payout Fee Reserve
    v_total_paise := (p_total_amount * 100)::BIGINT;
    v_base_paise := v_total_paise / p_winner_count;
    v_remainder_paise := v_total_paise % p_winner_count;

    IF v_mode = 'UPI_BANK' THEN
        v_min_paise_per_winner := 1000;
        IF p_min_claim_amount IS NOT NULL AND (p_min_claim_amount * 100)::BIGINT > 1000 THEN
            v_min_paise_per_winner := (p_min_claim_amount * 100)::BIGINT;
        END IF;
    ELSE
        IF p_min_claim_amount IS NOT NULL AND (p_min_claim_amount * 100)::BIGINT >= 1 THEN
            v_min_paise_per_winner := (p_min_claim_amount * 100)::BIGINT;
        END IF;
    END IF;

    FOR v_i IN 1..p_winner_count LOOP
        DECLARE
            v_alloc_paise BIGINT;
            v_alloc_amount NUMERIC(12, 2);
        BEGIN
            -- Canonical 'EQUAL' enum value
            IF p_distribution_type = 'EQUAL' THEN
                v_alloc_paise := v_base_paise;
                IF v_i <= v_remainder_paise THEN
                    v_alloc_paise := v_alloc_paise + 1;
                END IF;
            ELSE
                IF v_i = p_winner_count THEN
                    v_alloc_paise := v_total_paise - v_running_paise_sum;
                ELSE
                    DECLARE
                        v_remaining_paise BIGINT := v_total_paise - v_running_paise_sum;
                        v_remaining_winners INT := p_winner_count - v_i + 1;
                        v_min_for_this BIGINT := v_min_paise_per_winner;
                        v_max_for_this BIGINT := v_remaining_paise - ((v_remaining_winners - 1) * v_min_paise_per_winner);
                    BEGIN
                        IF p_max_claim_amount IS NOT NULL THEN
                            DECLARE
                                v_cap BIGINT := (p_max_claim_amount * 100)::BIGINT;
                            BEGIN
                                IF v_cap < v_max_for_this THEN
                                    v_max_for_this := v_cap;
                                END IF;
                            END;
                        END IF;

                        IF v_max_for_this < v_min_for_this THEN
                            v_max_for_this := v_min_for_this;
                        END IF;

                        IF v_max_for_this > v_min_for_this THEN
                            v_alloc_paise := v_min_for_this + floor(random() * (v_max_for_this - v_min_for_this + 1))::BIGINT;
                        ELSE
                            v_alloc_paise := v_min_for_this;
                        END IF;
                    END;
                END IF;
            END IF;

            IF v_mode = 'UPI_BANK' AND v_alloc_paise < 1000 THEN
                RAISE EXCEPTION 'Each winner must receive at least ₹10 for UPI Lifafa.';
            END IF;

            v_running_paise_sum := v_running_paise_sum + v_alloc_paise;
            v_alloc_amount := ROUND(v_alloc_paise / 100.0, 2);

            IF v_mode = 'UPI_BANK' AND v_alloc_amount < 10.00 THEN
                RAISE EXCEPTION 'Each winner must receive at least ₹10 for UPI Lifafa.';
            END IF;

            v_allocations_arr := array_append(v_allocations_arr, v_alloc_amount);

            IF v_mode = 'UPI_BANK' THEN
                v_total_payout_fee := v_total_payout_fee + public.get_lifafa_payout_fee(v_alloc_amount);
            END IF;
        END;
    END LOOP;

    -- 6. Platform Creation Fee Calculation
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

    v_total_required := p_total_amount + v_fee + v_total_payout_fee;

    -- 7. Lock Creator Wallet & Validate Balance
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

    -- 8. Deduct Available Balance & Escrow Prize + Payout Fees
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_required,
        reserved_balance = reserved_balance + p_total_amount + v_total_payout_fee,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 9. Generate Unique Lifafa Code
    LOOP
        v_lifafa_code := 'LF-' || UPPER(SUBSTRING(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.lifafas WHERE code = v_lifafa_code);
    END LOOP;

    -- 10. Insert Authoritative Lifafa Record
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
        v_clean_idempotency,
        p_min_claim_amount,
        p_max_claim_amount,
        p_device_claim_limit,
        v_mode,
        v_total_payout_fee,
        v_total_payout_fee
    ) RETURNING id INTO v_lifafa_id;

    -- 11. Store PIN Hash if provided (with creator_id populated)
    IF p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 THEN
        INSERT INTO public.lifafa_secrets (
            lifafa_id,
            creator_id,
            pin_code_hash
        ) VALUES (
            v_lifafa_id,
            v_user_id,
            crypt(TRIM(p_pin_code), gen_salt('bf', 8))
        );
    END IF;

    -- 12. Insert Allocations
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

    -- 13. Insert Tasks
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

    -- 14. Audit Trail: Wallet Transaction (Canonical 'RESERVE' transaction_type)
    v_effective_idempotency := COALESCE(v_clean_idempotency, 'create_' || v_lifafa_id::text);

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
        'RESERVE',
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

-- STEP 3: STRICT SECURITY REVOCATION & SCOPED GRANTS
REVOKE ALL ON FUNCTION public.create_lifafa_rpc(
    text, text, numeric, integer, distribution_type, timestamp with time zone,
    boolean, character varying, boolean, boolean, text, jsonb, text,
    numeric, numeric, timestamp with time zone, integer, character varying
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_lifafa_rpc(
    text, text, numeric, integer, distribution_type, timestamp with time zone,
    boolean, character varying, boolean, boolean, text, jsonb, text,
    numeric, numeric, timestamp with time zone, integer, character varying
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_lifafa_payout_fee(NUMERIC) TO authenticated, service_role;
