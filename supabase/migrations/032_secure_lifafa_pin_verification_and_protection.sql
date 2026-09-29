-- ==============================================================================
-- Migration: 032_secure_lifafa_pin_verification_and_protection.sql
-- Description:
--   1. Create lifafa_pin_attempts table for brute-force rate-limiting.
--   2. Implement verify_lifafa_pin_rpc with 5-attempt/15-min lockout (authenticated only).
--   3. Drop obsolete claim_lifafa_rpc 8-arg overload.
--   4. Update create_lifafa_rpc to set lifafas.pin_code = 'PROTECTED' for PIN lifafas.
--   5. Safely backfill existing PIN-protected Lifafas.
-- Target: Supabase SQL Editor / Management API
-- ==============================================================================

-- 1. BRUTE-FORCE RATE-LIMITING TABLE FOR PIN VERIFICATION
CREATE TABLE IF NOT EXISTS public.lifafa_pin_attempts (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lifafa_id UUID NOT NULL REFERENCES public.lifafas(id) ON DELETE CASCADE,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (user_id, lifafa_id)
);

ALTER TABLE public.lifafa_pin_attempts ENABLE ROW LEVEL SECURITY;

-- 2. STANDALONE AUTHORITATIVE PIN VERIFICATION RPC
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
GRANT EXECUTE ON FUNCTION public.verify_lifafa_pin_rpc(TEXT, TEXT) TO authenticated;

-- 3. DROP OBSOLETE 8-ARGUMENT OVERLOAD OF claim_lifafa_rpc (WITHOUT PIN CHECK)
DROP FUNCTION IF EXISTS public.claim_lifafa_rpc(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 4. UPDATE create_lifafa_rpc TO MARK 'PROTECTED' ON FUTURE PIN LIFAFAS
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

    -- 11. Tasks Attachment
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

-- 5. SAFE BACKFILL FOR EXISTING PIN-PROTECTED LIFAFAS (EXACTLY 2 ROWS)
UPDATE public.lifafas l
SET pin_code = 'PROTECTED'
FROM public.lifafa_secrets s
WHERE l.id = s.lifafa_id
  AND s.pin_code_hash IS NOT NULL
  AND LENGTH(TRIM(s.pin_code_hash)) >= 20
  AND (l.pin_code IS NULL OR l.pin_code <> 'PROTECTED');
