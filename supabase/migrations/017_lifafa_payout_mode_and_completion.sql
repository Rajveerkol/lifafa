-- ==============================================================================
-- Migration: 017_lifafa_payout_mode_and_completion.sql
-- Description: Lifafa Reward Destination (WALLET vs UPI_BANK), completion lifecycle hardening,
--              and clean RPC overload elimination.
-- Target: Run in Supabase SQL Editor (DO NOT EXECUTE AUTOMATICALLY - AWAIT USER REVIEW)
-- ==============================================================================

-- 1. Add payout_mode to public.lifafas with backward-compatible default 'WALLET'
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'lifafas' AND column_name = 'payout_mode'
    ) THEN
        ALTER TABLE public.lifafas 
        ADD COLUMN payout_mode VARCHAR(20) DEFAULT 'WALLET' NOT NULL;

        ALTER TABLE public.lifafas
        ADD CONSTRAINT chk_lifafa_payout_mode CHECK (payout_mode IN ('WALLET', 'UPI_BANK'));
    END IF;
END $$;

-- 2. Add payout tracking columns to public.lifafa_claims
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'lifafa_claims' AND column_name = 'payout_mode'
    ) THEN
        ALTER TABLE public.lifafa_claims 
        ADD COLUMN payout_mode VARCHAR(20) DEFAULT 'WALLET' NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'lifafa_claims' AND column_name = 'withdrawal_id'
    ) THEN
        ALTER TABLE public.lifafa_claims 
        ADD COLUMN withdrawal_id UUID REFERENCES public.withdrawals(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lifafas_payout_mode ON public.lifafas(payout_mode);
CREATE INDEX IF NOT EXISTS idx_lifafa_claims_withdrawal ON public.lifafa_claims(withdrawal_id);

-- 3. ELIMINATE OLD OVERLOADED RPC SIGNATURES TO PREVENT AMBIGUOUS RPC CALLS IN POSTGREST
-- Drop all existing versions of create_lifafa_rpc and claim_lifafa_rpc dynamically:
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname IN ('create_lifafa_rpc', 'claim_lifafa_rpc')
    ) LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;', r.proname, r.args);
    END LOOP;
END $$;

-- 4. SINGLE AUTHORITATIVE CREATE LIFAFA RPC WITH REWARD DESTINATION (PAYOUT MODE)
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
    p_device_claim_limit INT DEFAULT 1,
    p_payout_mode VARCHAR(20) DEFAULT 'WALLET'
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
    v_mode VARCHAR(20);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a Lifafa';
    END IF;

    v_mode := UPPER(COALESCE(NULLIF(TRIM(p_payout_mode), ''), 'WALLET'));
    IF v_mode NOT IN ('WALLET', 'UPI_BANK') THEN
        RAISE EXCEPTION 'Invalid payout mode (must be WALLET or UPI_BANK)';
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

    -- Deduct total required from available balance, add principal to reserved escrow
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_required,
        reserved_balance = reserved_balance + p_total_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Generate unique short code
    LOOP
        v_lifafa_code := 'LF-' || UPPER(SUBSTRING(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.lifafas WHERE code = v_lifafa_code);
    END LOOP;

    -- Insert authoritative Lifafa row
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
        NULL, -- PIN stored separately in lifafa_secrets
        p_allow_cancel,
        p_show_remaining,
        p_creator_note,
        p_min_claim_amount,
        p_max_claim_amount,
        p_device_claim_limit,
        v_mode
    ) RETURNING id INTO v_lifafa_id;

    -- Store optional PIN code securely
    IF p_pin_code IS NOT NULL AND LENGTH(TRIM(p_pin_code)) > 0 THEN
        INSERT INTO public.lifafa_secrets (lifafa_id, pin_code_hash)
        VALUES (v_lifafa_id, crypt(TRIM(p_pin_code), gen_salt('bf')));
    END IF;

    -- Generate Allocations conserving total sum to exact paise
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

    -- Attach community tasks
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

    -- Double-entry ledger record for escrow lock
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
        v_total_required,
        'ESCROW_LOCK',
        'SUCCESS',
        'LIFAFA_CREATION',
        v_lifafa_id::text,
        v_effective_idempotency,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'lifafa_id', v_lifafa_id,
            'lifafa_code', v_lifafa_code,
            'principal', p_total_amount,
            'platform_fee', v_fee,
            'payout_mode', v_mode
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa_id,
        'code', v_lifafa_code,
        'total_amount', p_total_amount,
        'payout_mode', v_mode,
        'winner_count', p_winner_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 5. SINGLE AUTHORITATIVE CLAIM LIFAFA RPC SUPPORTING WALLET & UPI/BANK PAYOUTS
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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim a Lifafa';
    END IF;

    v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_' || v_user_id::text);

    -- 1. Check idempotency: If already claimed, return existing claim without duplicate payout
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

    -- Check scheduled start
    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa has not started yet. Starts at: %', v_lifafa.starts_at;
    END IF;

    -- Check active status
    IF v_lifafa.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Lifafa is not active (Status: %)', v_lifafa.status;
    END IF;

    -- Check expiration
    IF v_lifafa.expires_at <= NOW() THEN
        UPDATE public.lifafas SET status = 'EXPIRED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'Lifafa has expired';
    END IF;

    -- Check completion condition
    IF v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0.00 THEN
        UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'All Lifafa rewards have already been claimed';
    END IF;

    -- Validate UPI/Bank Payout Details if Lifafa payout_mode is UPI_BANK
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

    -- Update Lifafa stats and check authoritative completion
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

    -- Lock creator wallet and debit creator escrow (reserved_balance)
    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - v_claim_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- BRANCH ON REWARD DESTINATION (PAYOUT MODE)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Safely mask bank account number per existing withdrawal schema
        IF p_bank_account_number IS NOT NULL AND LENGTH(TRIM(p_bank_account_number)) >= 4 THEN
            v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
        ELSE
            v_masked_acc := 'UPI: ' || COALESCE(TRIM(p_upi_id), 'N/A');
        END IF;

        -- Create PENDING withdrawal record
        INSERT INTO public.withdrawals (
            user_id,
            amount,
            fee_amount,
            net_amount,
            account_holder_name,
            bank_account_number_masked,
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
            NULLIF(UPPER(TRIM(p_ifsc_code)), ''),
            NULLIF(LOWER(TRIM(p_upi_id)), ''),
            'PENDING',
            'MANUAL',
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        -- Insert claim record linked to withdrawal
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

        -- Winner's wallet is NOT credited with liquid funds to prevent double payout
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
        -- WALLET REWARD MODE: Credit claimant's available balance atomically
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
        WHERE user_id = v_user_id;

        -- Insert claim record
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
            'WALLET',
            NULL
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
                'allocation_id', v_allocation.id,
                'payout_mode', 'WALLET'
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

-- 6. GRANT AUTHORIZED PERMISSIONS
GRANT EXECUTE ON FUNCTION public.create_lifafa_rpc(
    TEXT, TEXT, NUMERIC, INT, distribution_type, TIMESTAMPTZ, BOOLEAN, VARCHAR, BOOLEAN, BOOLEAN, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ, INT, VARCHAR
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(
    TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
