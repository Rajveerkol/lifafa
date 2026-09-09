-- ==============================================================================
-- Migration: 010_functions_and_rpc.sql
-- Description: Authoritative server-side atomic RPC functions for wallet reservation,
--              Lifafa creation, random allocation generation, concurrency-safe claiming,
--              idempotent withdrawals, expiry refunds, and audited admin operations.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper: Generate unique random code for Lifafas (e.g. LF-8X92K)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_lifafa_code()
RETURNS TEXT AS $$
DECLARE
    v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_code TEXT;
    v_exists BOOLEAN;
    v_i INT;
BEGIN
    LOOP
        v_code := 'LF-';
        FOR v_i IN 1..6 LOOP
            v_code := v_code || SUBSTR(v_chars, FLOOR(RANDOM() * LENGTH(v_chars) + 1)::INT, 1);
        END LOOP;
        
        SELECT EXISTS(SELECT 1 FROM public.lifafas WHERE code = v_code) INTO v_exists;
        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ------------------------------------------------------------------------------
-- 2. CREATE LIFAFA WITH ATOMIC WALLET RESERVATION AND SERVER-SIDE ALLOCATIONS
-- ------------------------------------------------------------------------------
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
    p_idempotency_key TEXT DEFAULT NULL
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
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_task_elem JSONB;
    -- Allocation variables (Integer Paise calculation for exact sum invariant)
    v_total_paise BIGINT;
    v_allocated_paise BIGINT := 0;
    v_cur_paise BIGINT;
    v_i INT;
    v_random_weights NUMERIC[];
    v_total_weight NUMERIC := 0;
    v_equal_paise BIGINT;
    v_remainder_paise BIGINT;
BEGIN
    -- Authorization check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create Lifafa';
    END IF;

    -- Basic input validation
    IF p_total_amount <= 0 THEN
        RAISE EXCEPTION 'Total amount must be greater than zero';
    END IF;
    IF p_winner_count <= 0 THEN
        RAISE EXCEPTION 'Winner count must be at least 1';
    END IF;
    IF p_winner_count > 10000 THEN
        RAISE EXCEPTION 'Maximum winners per Lifafa is 10,000';
    END IF;
    IF p_expires_at <= NOW() THEN
        RAISE EXCEPTION 'Expiry date must be in the future';
    END IF;

    -- Idempotency check: Return existing lifafa if same idempotency key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, code INTO v_lifafa_id, v_lifafa_code
        FROM public.lifafas
        WHERE creator_id = v_user_id 
          AND creator_note = p_idempotency_key;
        IF v_lifafa_id IS NOT NULL THEN
            RETURN jsonb_build_object('success', true, 'lifafa_id', v_lifafa_id, 'code', v_lifafa_code, 'idempotent', true);
        END IF;
    END IF;

    -- Server-side fee calculation
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'LIFAFA_CREATION' AND is_active = TRUE;
    
    IF FOUND THEN
        IF v_fee_rec.calculation_type = 'FIXED' THEN
            v_fee := v_fee_rec.value;
        ELSIF v_fee_rec.calculation_type = 'PERCENTAGE' THEN
            v_fee := ROUND((p_total_amount * v_fee_rec.value / 100.0), 2);
        END IF;
    END IF;

    v_total_required := p_total_amount + v_fee;

    -- Row-Level Lock on creator's wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user';
    END IF;

    IF v_wallet.available_balance < v_total_required THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Required: %, Available: %', v_total_required, v_wallet.available_balance;
    END IF;

    -- Atomic Wallet Reservation
    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - v_total_required;

    UPDATE public.wallets
    SET available_balance = available_balance - v_total_required,
        reserved_balance = reserved_balance + p_total_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Generate code
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
        is_public,
        pin_code,
        allow_cancel,
        show_remaining,
        creator_note
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
        p_is_public,
        p_pin_code,
        p_allow_cancel,
        p_show_remaining,
        COALESCE(p_idempotency_key, p_creator_note)
    ) RETURNING id INTO v_lifafa_id;

    -- Create Wallet Ledger Transaction for the reservation
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
        COALESCE(p_idempotency_key, 'reserve_' || v_lifafa_id::text),
        v_balance_before,
        v_balance_after,
        jsonb_build_object('lifafa_code', v_lifafa_code, 'fee', v_fee)
    );

    -- If fee > 0, record fee ledger transaction
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

    -- --------------------------------------------------------------------------
    -- SERVER-SIDE AUTHORITATIVE ALLOCATION GENERATION (SUM MUST EQUAL EXACTLY)
    -- --------------------------------------------------------------------------
    v_total_paise := (p_total_amount * 100)::BIGINT;

    IF p_distribution_type = 'EQUAL' THEN
        v_equal_paise := v_total_paise / p_winner_count;
        v_remainder_paise := v_total_paise % p_winner_count;

        FOR v_i IN 1..p_winner_count LOOP
            v_cur_paise := v_equal_paise;
            -- Distribute remainder paise one by one to early indices
            IF v_i <= v_remainder_paise THEN
                v_cur_paise := v_cur_paise + 1;
            END IF;
            v_allocated_paise := v_allocated_paise + v_cur_paise;

            INSERT INTO public.lifafa_allocations (
                lifafa_id,
                allocation_index,
                amount
            ) VALUES (
                v_lifafa_id,
                v_i,
                (v_cur_paise::NUMERIC / 100.0)
            );
        END LOOP;
    ELSE
        -- RANDOM DISTRIBUTION (Dirichlet / Random cut partition algorithm)
        -- Ensure minimum 100 paise (₹1.00) per winner if total allows, else minimum 1 paise
        DECLARE
            v_min_paise BIGINT := 1;
            v_pool_paise BIGINT;
            v_weight NUMERIC;
            v_w_i INT;
        BEGIN
            IF v_total_paise >= (p_winner_count * 100) THEN
                v_min_paise := 100;
            END IF;
            
            v_pool_paise := v_total_paise - (p_winner_count * v_min_paise);

            -- Generate random weights
            FOR v_w_i IN 1..p_winner_count LOOP
                v_weight := RANDOM() + 0.05;
                v_random_weights := ARRAY_APPEND(v_random_weights, v_weight);
                v_total_weight := v_total_weight + v_weight;
            END LOOP;

            -- Distribute pool proportionally
            FOR v_w_i IN 1..p_winner_count LOOP
                IF v_w_i = p_winner_count THEN
                    -- Last allocation takes remaining paise to guarantee 100% exact sum
                    v_cur_paise := v_min_paise + (v_total_paise - v_allocated_paise - v_min_paise);
                ELSE
                    v_cur_paise := v_min_paise + FLOOR((v_pool_paise * (v_random_weights[v_w_i] / v_total_weight)))::BIGINT;
                END IF;

                v_allocated_paise := v_allocated_paise + v_cur_paise;

                INSERT INTO public.lifafa_allocations (
                    lifafa_id,
                    allocation_index,
                    amount
                ) VALUES (
                    v_lifafa_id,
                    v_w_i,
                    (v_cur_paise::NUMERIC / 100.0)
                );
            END LOOP;
        END;
    END IF;

    -- Financial Invariant Assertion: Allocated sum MUST equal total amount down to the exact paise
    IF v_allocated_paise <> v_total_paise THEN
        RAISE EXCEPTION 'Financial invariant violated: Allocation sum (%) does not equal total (%)', 
            v_allocated_paise, v_total_paise;
    END IF;

    -- Insert optional tasks if provided
    IF p_tasks IS NOT NULL AND jsonb_array_length(p_tasks) > 0 THEN
        v_i := 0;
        FOR v_task_elem IN SELECT * FROM jsonb_array_elements(p_tasks) LOOP
            v_i := v_i + 1;
            INSERT INTO public.lifafa_tasks (
                lifafa_id,
                task_type,
                title,
                description,
                target_url,
                is_required,
                is_enabled,
                sort_order
            ) VALUES (
                v_lifafa_id,
                (v_task_elem->>'task_type')::task_type,
                COALESCE(v_task_elem->>'title', 'Task ' || v_i),
                v_task_elem->>'description',
                v_task_elem->>'target_url',
                COALESCE((v_task_elem->>'is_required')::BOOLEAN, TRUE),
                COALESCE((v_task_elem->>'is_enabled')::BOOLEAN, TRUE),
                v_i
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa_id,
        'code', v_lifafa_code,
        'total_amount', p_total_amount,
        'fee', v_fee,
        'winner_count', p_winner_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 3. CONCURRENCY-SAFE ATOMIC CLAIM RPC
-- ------------------------------------------------------------------------------
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
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_required_tasks_count INT;
    v_completed_tasks_count INT;
BEGIN
    -- Auth check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be logged in to claim a Lifafa';
    END IF;

    -- Row-level lock on the Lifafa record to serialize concurrent claims
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE UPPER(code) = UPPER(TRIM(p_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa code not found';
    END IF;

    -- Lifecycle & Expiry checks
    IF v_lifafa.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'This Lifafa is % and cannot be claimed', v_lifafa.status;
    END IF;

    IF v_lifafa.expires_at <= NOW() THEN
        -- Mark as expired atomically
        UPDATE public.lifafas SET status = 'EXPIRED' WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'This Lifafa has expired';
    END IF;

    IF v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0 THEN
        UPDATE public.lifafas SET status = 'COMPLETED' WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'All rewards for this Lifafa have already been claimed!';
    END IF;

    -- PIN protection check if configured
    IF v_lifafa.pin_code IS NOT NULL AND v_lifafa.pin_code <> '' THEN
        IF p_pin_code IS NULL OR TRIM(p_pin_code) <> v_lifafa.pin_code THEN
            RAISE EXCEPTION 'Invalid Lifafa PIN code';
        END IF;
    END IF;

    -- Unique Claim Constraint Check: A user can claim a Lifafa ONLY ONCE
    IF EXISTS (SELECT 1 FROM public.lifafa_claims WHERE lifafa_id = v_lifafa.id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'You have already claimed this Lifafa';
    END IF;

    -- Creator cannot claim their own Lifafa
    IF v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    -- Server-side Task Completion Check: Ensure all required tasks have valid completion records
    SELECT COUNT(*) INTO v_required_tasks_count
    FROM public.lifafa_tasks
    WHERE lifafa_id = v_lifafa.id AND is_required = TRUE AND is_enabled = TRUE;

    IF v_required_tasks_count > 0 THEN
        SELECT COUNT(DISTINCT task_id) INTO v_completed_tasks_count
        FROM public.task_completions
        WHERE lifafa_id = v_lifafa.id 
          AND user_id = v_user_id 
          AND status = 'VERIFIED';

        IF v_completed_tasks_count < v_required_tasks_count THEN
            RAISE EXCEPTION 'Please complete all required tasks before claiming';
        END IF;
    END IF;

    -- Concurrency-Safe Allocation Lock: Pick the next unclaimed allocation
    SELECT * INTO v_allocation
    FROM public.lifafa_allocations
    WHERE lifafa_id = v_lifafa.id AND is_claimed = FALSE
    ORDER BY allocation_index ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        UPDATE public.lifafas SET status = 'COMPLETED' WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'No allocations remaining';
    END IF;

    v_claim_amount := v_allocation.amount;

    -- Financial safety check
    IF v_claim_amount > v_lifafa.remaining_amount THEN
        RAISE EXCEPTION 'Allocation exceeds remaining Lifafa balance';
    END IF;

    -- 1. Mark allocation as claimed
    UPDATE public.lifafa_allocations
    SET is_claimed = TRUE,
        claimed_by = v_user_id,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    -- 2. Update Lifafa state
    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = remaining_amount - v_claim_amount,
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0 THEN 'COMPLETED'::lifafa_status
            ELSE 'ACTIVE'::lifafa_status
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    -- 3. Lock claimant's wallet and credit available balance
    SELECT * INTO v_user_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Auto-initialize wallet if missing
        INSERT INTO public.wallets (user_id, available_balance, reserved_balance, total_earned, total_withdrawn)
        VALUES (v_user_id, 0.00, 0.00, 0.00, 0.00)
        RETURNING * INTO v_user_wallet;
    END IF;

    v_balance_before := v_user_wallet.available_balance;
    v_balance_after := v_balance_before + v_claim_amount;

    UPDATE public.wallets
    SET available_balance = available_balance + v_claim_amount,
        total_earned = total_earned + v_claim_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_user_wallet.id;

    -- 4. Decrement creator's reserved balance
    UPDATE public.wallets
    SET reserved_balance = GREATEST(0, reserved_balance - v_claim_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- 5. Record claim record with idempotency
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
        COALESCE(p_idempotency_key, 'claim_' || v_lifafa.id::text || '_' || v_user_id::text),
        p_device_fingerprint,
        p_ip_address
    ) RETURNING id INTO v_claim_id;

    -- 6. Record Double-Entry Wallet Ledger Transaction for the claimant
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

    -- 7. Trigger In-App Notification
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        reference_id
    ) VALUES (
        v_user_id,
        '🎉 Lifafa Claimed!',
        'You claimed ₹' || v_claim_amount::text || ' from ' || v_lifafa.title,
        'CLAIM_SUCCESS',
        v_lifafa.code
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

-- ------------------------------------------------------------------------------
-- 4. IDEMPOTENT EXPIRY REFUND / CANCEL RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(
    p_lifafa_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_lifafa RECORD;
    v_creator_wallet RECORD;
    v_refund_amount NUMERIC(12, 2);
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
BEGIN
    -- Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    -- Caller must be creator or admin
    IF v_caller_id <> v_lifafa.creator_id AND NOT public.is_admin(v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized to refund this Lifafa';
    END IF;

    -- Only allow if expired or active to cancel
    IF v_lifafa.status NOT IN ('ACTIVE', 'EXPIRED') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lifafa already completed, refunded, or cancelled');
    END IF;

    v_refund_amount := v_lifafa.remaining_amount;

    -- Idempotency check: If no remaining amount, simply update status
    IF v_refund_amount <= 0 THEN
        UPDATE public.lifafas
        SET status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_lifafa.id;
        RETURN jsonb_build_object('success', true, 'refunded_amount', 0);
    END IF;

    -- Lock creator's wallet
    SELECT * INTO v_creator_wallet
    FROM public.wallets
    WHERE user_id = v_lifafa.creator_id
    FOR UPDATE;

    v_balance_before := v_creator_wallet.available_balance;
    v_balance_after := v_balance_before + v_refund_amount;

    -- Release funds: deduct from reserved, add back to available
    UPDATE public.wallets
    SET available_balance = available_balance + v_refund_amount,
        reserved_balance = GREATEST(0, reserved_balance - v_refund_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_creator_wallet.id;

    -- Mark remaining amount 0 and status updated
    UPDATE public.lifafas
    SET remaining_amount = 0.00,
        status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    v_idempotency_key := 'refund_' || v_lifafa.id::text;

    -- Ledger transaction for refund/release
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
        v_refund_amount,
        'REFUND',
        'SUCCESS',
        'LIFAFA_REFUND',
        v_lifafa.id::text,
        v_idempotency_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object('lifafa_code', v_lifafa.code)
    ) ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'refunded_amount', v_refund_amount,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 5. IDEMPOTENT WITHDRAWAL REQUEST RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal_rpc(
    p_amount NUMERIC(12, 2),
    p_account_holder_name TEXT,
    p_bank_account_number TEXT,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_fee NUMERIC(12, 2) := 0.00;
    v_fee_rec RECORD;
    v_net_amount NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_masked_acc TEXT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_key TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to withdraw';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
    END IF;

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- Idempotency check: Return existing withdrawal if same key
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- Server-side withdrawal fee calculation
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'WITHDRAWAL' AND is_active = TRUE;
    
    IF FOUND THEN
        IF v_fee_rec.calculation_type = 'FIXED' THEN
            v_fee := v_fee_rec.value;
        ELSIF v_fee_rec.calculation_type = 'PERCENTAGE' THEN
            v_fee := ROUND((p_amount * v_fee_rec.value / 100.0), 2);
        END IF;
    END IF;

    v_net_amount := p_amount - v_fee;
    IF v_net_amount <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount after fees must be greater than 0';
    END IF;

    -- Row lock on user wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_wallet.available_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient available balance. Available: %, Requested: %', v_wallet.available_balance, p_amount;
    END IF;

    -- Mask bank account: e.g. XXXX-XXXX-1234
    IF p_bank_account_number IS NOT NULL AND LENGTH(TRIM(p_bank_account_number)) >= 4 THEN
        v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
    ELSE
        v_masked_acc := 'UPI: ' || COALESCE(p_upi_id, 'N/A');
    END IF;

    -- Debit wallet balance atomically
    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - p_amount;

    UPDATE public.wallets
    SET available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Insert withdrawal record
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
        p_amount,
        v_fee,
        v_net_amount,
        p_account_holder_name,
        v_masked_acc,
        p_bank_account_number, -- In production, pgp_sym_encrypt with environment key
        p_ifsc_code,
        p_upi_id,
        'PENDING',
        'MANUAL',
        v_key
    ) RETURNING id INTO v_withdrawal_id;

    -- Insert ledger transaction
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
        p_amount,
        'WITHDRAWAL',
        'PENDING',
        'WITHDRAWAL_REQUEST',
        v_withdrawal_id::text,
        'tx_' || v_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'masked_account', v_masked_acc,
            'fee', v_fee,
            'net_amount', v_net_amount
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'net_amount', v_net_amount,
        'fee', v_fee,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 6. ADMIN WALLET ADJUSTMENT RPC (WITH IMMUTABLE AUDIT RECORD)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet_rpc(
    p_target_user_id UUID,
    p_amount NUMERIC(12, 2),
    p_type transaction_type, -- CREDIT or DEBIT
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_tx_id UUID;
BEGIN
    -- Server-side admin authorization check
    IF NOT public.is_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can adjust wallet balances';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Adjustment amount must be positive';
    END IF;

    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
        RAISE EXCEPTION 'A legitimate reason is required for administrative wallet adjustments';
    END IF;

    IF p_type NOT IN ('CREDIT', 'DEBIT') THEN
        RAISE EXCEPTION 'Adjustment type must be CREDIT or DEBIT';
    END IF;

    -- Lock target user's wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user wallet not found';
    END IF;

    v_balance_before := v_wallet.available_balance;

    IF p_type = 'CREDIT' THEN
        v_balance_after := v_balance_before + p_amount;
        UPDATE public.wallets
        SET available_balance = available_balance + p_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;
    ELSE
        IF v_balance_before < p_amount THEN
            RAISE EXCEPTION 'Cannot debit more than available balance (%). Requested: %', v_balance_before, p_amount;
        END IF;
        v_balance_after := v_balance_before - p_amount;
        UPDATE public.wallets
        SET available_balance = available_balance - p_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;
    END IF;

    -- Insert ledger transaction
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
        p_target_user_id,
        v_wallet.id,
        p_amount,
        p_type,
        'SUCCESS',
        'ADMIN_ADJUSTMENT',
        v_admin_id::text,
        v_balance_before,
        v_balance_after,
        jsonb_build_object('admin_id', v_admin_id, 'reason', p_reason)
    ) RETURNING id INTO v_tx_id;

    -- Insert immutable Admin Audit Log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_admin_id,
        'WALLET_' || p_type::text,
        'USER_WALLET',
        p_target_user_id::text,
        jsonb_build_object(
            'amount', p_amount,
            'reason', p_reason,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'transaction_id', v_tx_id
        )
    );

    -- Notify user
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type
    ) VALUES (
        p_target_user_id,
        CASE WHEN p_type = 'CREDIT' THEN 'Wallet Credited' ELSE 'Wallet Debited' END,
        'Admin adjustment: ₹' || p_amount::text || '. Reason: ' || p_reason,
        'SYSTEM'
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'amount', p_amount,
        'type', p_type,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 7. ADMIN WITHDRAWAL STATUS UPDATE RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_rpc(
    p_withdrawal_id UUID,
    p_new_status withdrawal_status,
    p_payout_reference_id TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_withdrawal RECORD;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
BEGIN
    IF NOT public.is_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Only administrators can update withdrawal status';
    END IF;

    SELECT * INTO v_withdrawal
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal not found';
    END IF;

    -- If already finalized, do not alter
    IF v_withdrawal.status IN ('SUCCESS', 'REVERSED') THEN
        RAISE EXCEPTION 'Withdrawal is already in terminal status (%) and cannot be modified', v_withdrawal.status;
    END IF;

    -- Update withdrawal status
    UPDATE public.withdrawals
    SET status = p_new_status,
        payout_reference_id = COALESCE(p_payout_reference_id, payout_reference_id),
        rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
        processed_at = CASE WHEN p_new_status IN ('SUCCESS', 'FAILED', 'REVERSED') THEN TIMEZONE('utc'::text, NOW()) ELSE processed_at END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_withdrawal_id;

    -- If FAILED or REVERSED, refund the user's available wallet balance atomically
    IF p_new_status IN ('FAILED', 'REVERSED') THEN
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_withdrawal.user_id
        FOR UPDATE;

        v_balance_before := v_wallet.available_balance;
        v_balance_after := v_balance_before + v_withdrawal.amount;

        UPDATE public.wallets
        SET available_balance = available_balance + v_withdrawal.amount,
            total_withdrawn = GREATEST(0, total_withdrawn - v_withdrawal.amount),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;

        -- Create ledger reversal transaction
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
            v_withdrawal.user_id,
            v_wallet.id,
            v_withdrawal.amount,
            'WITHDRAWAL_REVERSAL',
            'SUCCESS',
            'WITHDRAWAL_FAILED',
            p_withdrawal_id::text,
            'reversal_' || p_withdrawal_id::text,
            v_balance_before,
            v_balance_after,
            jsonb_build_object('reason', p_rejection_reason)
        );
    END IF;

    -- Audit log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_admin_id,
        'WITHDRAWAL_' || p_new_status::text,
        'WITHDRAWAL',
        p_withdrawal_id::text,
        jsonb_build_object(
            'old_status', v_withdrawal.status,
            'new_status', p_new_status,
            'payout_reference_id', p_payout_reference_id,
            'reason', p_rejection_reason
        )
    );

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
