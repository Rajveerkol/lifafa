-- ==============================================================================
-- Migration: 025_lifafa_withdrawal_control.sql
-- Description:
-- 1. Add withdrawal_status (ALLOWED / BLOCKED) to public.lifafas (defaults to 'ALLOWED')
-- 2. Add withdrawn_amount tracking column to public.lifafa_claims
-- 3. Create public.withdrawal_source_allocations table for source traceability
-- 4. Create public.admin_set_lifafa_withdrawal_status_rpc (Admin-only toggle with audit logging)
-- 5. Create public.get_user_withdrawable_balance_rpc (Server-authoritative balance breakdown)
-- 6. Upgrade public.request_withdrawal_rpc to enforce withdrawable balance & FIFO source allocation
-- 7. Upgrade public.admin_update_withdrawal_rpc to restore source allocations on FAILED/REVERSED
-- 8. Add RLS policies and indexes for high performance and strict isolation
-- ==============================================================================

-- 1. Add withdrawal_status to public.lifafas
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'lifafas' AND column_name = 'withdrawal_status'
    ) THEN
        ALTER TABLE public.lifafas 
        ADD COLUMN withdrawal_status VARCHAR(20) DEFAULT 'ALLOWED' NOT NULL;

        ALTER TABLE public.lifafas
        ADD CONSTRAINT chk_lifafa_withdrawal_status CHECK (withdrawal_status IN ('ALLOWED', 'BLOCKED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lifafas_withdrawal_status ON public.lifafas(withdrawal_status);

-- 2. Add withdrawn_amount to public.lifafa_claims
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'lifafa_claims' AND column_name = 'withdrawn_amount'
    ) THEN
        ALTER TABLE public.lifafa_claims 
        ADD COLUMN withdrawn_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL;

        ALTER TABLE public.lifafa_claims
        ADD CONSTRAINT chk_claim_withdrawn_amount CHECK (withdrawn_amount >= 0.00 AND withdrawn_amount <= amount);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claims_withdrawal_tracking 
ON public.lifafa_claims(user_id, payout_mode, withdrawn_amount) 
WHERE payout_mode = 'WALLET';

-- 3. Create public.withdrawal_source_allocations table
CREATE TABLE IF NOT EXISTS public.withdrawal_source_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES public.lifafa_claims(id) ON DELETE RESTRICT,
    lifafa_id UUID REFERENCES public.lifafas(id) ON DELETE RESTRICT,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wsa_withdrawal ON public.withdrawal_source_allocations(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_wsa_claim ON public.withdrawal_source_allocations(claim_id);
CREATE INDEX IF NOT EXISTS idx_wsa_lifafa ON public.withdrawal_source_allocations(lifafa_id);

-- Enable RLS on withdrawal_source_allocations
ALTER TABLE public.withdrawal_source_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own withdrawal allocations" ON public.withdrawal_source_allocations;
CREATE POLICY "Users can view own withdrawal allocations"
    ON public.withdrawal_source_allocations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.withdrawals w 
            WHERE w.id = withdrawal_id AND w.user_id = auth.uid()
        ) 
        OR public.is_admin()
    );

-- 4. Admin RPC: Set Lifafa Withdrawal Status with Audit Logging
CREATE OR REPLACE FUNCTION public.admin_set_lifafa_withdrawal_status_rpc(
    p_lifafa_id UUID,
    p_status VARCHAR(20),
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_lifafa RECORD;
    v_old_status VARCHAR(20);
BEGIN
    -- Authorization: strict admin check
    IF NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Only platform administrators can modify Lifafa withdrawal status';
    END IF;

    -- Validate input status
    IF p_status NOT IN ('ALLOWED', 'BLOCKED') THEN
        RAISE EXCEPTION 'Invalid withdrawal status: %. Must be ALLOWED or BLOCKED', p_status;
    END IF;

    -- Require non-empty reason when blocking
    IF p_status = 'BLOCKED' AND (p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3) THEN
        RAISE EXCEPTION 'A clear reason (minimum 3 characters) is required when blocking Lifafa withdrawals';
    END IF;

    -- Concurrency lock on lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    v_old_status := v_lifafa.withdrawal_status;

    -- Idempotency check: if status is already the requested status, return early without duplicate log
    IF v_old_status = p_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'lifafa_id', p_lifafa_id,
            'old_status', v_old_status,
            'new_status', p_status,
            'idempotent', true
        );
    END IF;

    -- Update withdrawal status
    UPDATE public.lifafas
    SET withdrawal_status = p_status,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_lifafa_id;

    -- Create immutable admin audit log entry
    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_admin_id,
        'LIFAFA_WITHDRAWAL_' || p_status,
        'LIFAFA',
        p_lifafa_id::text,
        jsonb_build_object(
            'old_status', v_old_status,
            'new_status', p_status,
            'reason', TRIM(p_reason),
            'lifafa_title', v_lifafa.title,
            'lifafa_code', v_lifafa.code,
            'timestamp', TIMEZONE('utc'::text, NOW())
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', p_lifafa_id,
        'old_status', v_old_status,
        'new_status', p_status,
        'reason', TRIM(p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_set_lifafa_withdrawal_status_rpc(UUID, VARCHAR, TEXT) TO authenticated;

-- 5. User & System RPC: Get Withdrawable Balance Breakdown
CREATE OR REPLACE FUNCTION public.get_user_withdrawable_balance_rpc()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_blocked_amount NUMERIC(12, 2) := 0.00;
    v_withdrawable_balance NUMERIC(12, 2) := 0.00;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT available_balance, reserved_balance, total_earned, total_withdrawn
    INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'available_balance', 0.00,
            'blocked_balance', 0.00,
            'withdrawable_balance', 0.00
        );
    END IF;

    -- Calculate total unwithdrawn funds belonging to currently BLOCKED Lifafas
    SELECT COALESCE(SUM(c.amount - c.withdrawn_amount), 0.00) INTO v_blocked_amount
    FROM public.lifafa_claims c
    JOIN public.lifafas l ON l.id = c.lifafa_id
    WHERE c.user_id = v_user_id
      AND c.payout_mode = 'WALLET'
      AND l.withdrawal_status = 'BLOCKED'
      AND c.withdrawn_amount < c.amount;

    -- Withdrawable balance is available balance minus blocked funds (bounded below by 0)
    v_withdrawable_balance := GREATEST(0.00, v_wallet.available_balance - v_blocked_amount);

    RETURN jsonb_build_object(
        'available_balance', v_wallet.available_balance,
        'blocked_balance', v_blocked_amount,
        'withdrawable_balance', v_withdrawable_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_user_withdrawable_balance_rpc() TO authenticated;

-- 6. Upgraded request_withdrawal_rpc: Enforce Withdrawable Balance & Deterministic FIFO Allocation
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
    v_fee NUMERIC(12, 2) := 3.58;
    v_fee_rec RECORD;
    v_payout_amount NUMERIC(12, 2);
    v_total_deduction NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT;
    v_balance_before NUMERIC(12, 2);
    v_balance_mid NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_key TEXT;
    v_blocked_amount NUMERIC(12, 2) := 0.00;
    v_withdrawable_balance NUMERIC(12, 2) := 0.00;
    v_remaining_to_allocate NUMERIC(12, 2);
    v_claim_rec RECORD;
    v_alloc_from_claim NUMERIC(12, 2);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to withdraw';
    END IF;

    -- 1. Enforce Server-Side Withdrawal Limits (₹10.00 min, ₹1,000.00 max)
    IF p_amount IS NULL OR p_amount < 10.00 THEN
        RAISE EXCEPTION 'Minimum withdrawal amount is ₹10.00';
    END IF;

    IF p_amount > 1000.00 THEN
        RAISE EXCEPTION 'Maximum withdrawal amount is ₹1,000.00';
    END IF;

    -- 2. Server-side safety: strictly Bank Account Only
    IF p_upi_id IS NOT NULL AND TRIM(p_upi_id) != '' THEN
        RAISE EXCEPTION 'Withdrawals are bank account only. UPI withdrawals are not supported.';
    END IF;

    IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 4 THEN
        RAISE EXCEPTION 'A valid bank account number is required for withdrawal.';
    END IF;

    IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
        RAISE EXCEPTION 'A valid 11-character IFSC code is required for withdrawal.';
    END IF;

    IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
        RAISE EXCEPTION 'Account holder name is required for withdrawal.';
    END IF;

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- Idempotency check
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- Platform fee calculation: fixed ₹3.58
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'WITHDRAWAL' AND is_active = TRUE;
    
    IF FOUND AND v_fee_rec.calculation_type = 'FIXED' AND v_fee_rec.value > 0 THEN
        v_fee := v_fee_rec.value;
    END IF;

    -- Beneficiary receives p_amount; wallet debited by p_amount + v_fee
    v_payout_amount := p_amount;
    v_total_deduction := v_payout_amount + v_fee;

    -- Concurrency lock on user's wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    -- 3. Calculate blocked amount and withdrawable balance server-side
    SELECT COALESCE(SUM(c.amount - c.withdrawn_amount), 0.00) INTO v_blocked_amount
    FROM public.lifafa_claims c
    JOIN public.lifafas l ON l.id = c.lifafa_id
    WHERE c.user_id = v_user_id
      AND c.payout_mode = 'WALLET'
      AND l.withdrawal_status = 'BLOCKED'
      AND c.withdrawn_amount < c.amount;

    v_withdrawable_balance := GREATEST(0.00, v_wallet.available_balance - v_blocked_amount);

    -- 4. Enforce withdrawable balance check
    IF v_withdrawable_balance < v_total_deduction THEN
        IF v_wallet.available_balance >= v_total_deduction THEN
            RAISE EXCEPTION 'Withdrawal request exceeds your withdrawable balance. Your wallet balance is ₹%, but ₹% is restricted due to Lifafa withdrawal policy. Eligible for withdrawal: ₹%. Required (including fee): ₹%',
                v_wallet.available_balance, v_blocked_amount, v_withdrawable_balance, v_total_deduction;
        ELSE
            RAISE EXCEPTION 'Insufficient available balance. Required: ₹% (Withdrawal ₹% + Platform Fee ₹%), Available: ₹%',
                v_total_deduction, v_payout_amount, v_fee, v_wallet.available_balance;
        END IF;
    END IF;

    v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
    -- Fail-closed Vault encryption
    v_encrypted_acc := public.encrypt_bank_account(TRIM(p_bank_account_number));

    v_balance_before := v_wallet.available_balance;
    v_balance_mid := v_balance_before - v_payout_amount;
    v_balance_after := v_balance_before - v_total_deduction;

    -- Option A: available_balance debited by gross deduction (payout + fee)
    --           total_withdrawn incremented by net beneficiary payout amount
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_deduction,
        total_withdrawn = total_withdrawn + v_payout_amount,
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
        v_total_deduction,
        v_fee,
        v_payout_amount,
        TRIM(p_account_holder_name),
        v_masked_acc,
        NULL,
        UPPER(TRIM(p_ifsc_code)),
        NULL,
        'PENDING',
        'PAYRUPEE',
        v_key
    ) RETURNING id INTO v_withdrawal_id;

    -- Insert encrypted credential into isolated credentials table
    IF v_encrypted_acc IS NOT NULL THEN
        INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number)
        VALUES (v_withdrawal_id, v_encrypted_acc);
    END IF;

    -- 5. Deterministic FIFO Source Allocation for Allowed Lifafa Claims
    v_remaining_to_allocate := v_total_deduction;

    FOR v_claim_rec IN (
        SELECT c.id, c.lifafa_id, (c.amount - c.withdrawn_amount) AS available_in_claim
        FROM public.lifafa_claims c
        JOIN public.lifafas l ON l.id = c.lifafa_id
        WHERE c.user_id = v_user_id
          AND c.payout_mode = 'WALLET'
          AND l.withdrawal_status = 'ALLOWED'
          AND c.withdrawn_amount < c.amount
        ORDER BY c.claimed_at ASC, c.id ASC
        FOR UPDATE OF c
    ) LOOP
        EXIT WHEN v_remaining_to_allocate <= 0;

        v_alloc_from_claim := LEAST(v_claim_rec.available_in_claim, v_remaining_to_allocate);

        -- Increment withdrawn_amount on the allowed claim
        UPDATE public.lifafa_claims
        SET withdrawn_amount = withdrawn_amount + v_alloc_from_claim
        WHERE id = v_claim_rec.id;

        -- Record allocation
        INSERT INTO public.withdrawal_source_allocations (
            withdrawal_id,
            claim_id,
            lifafa_id,
            allocated_amount
        ) VALUES (
            v_withdrawal_id,
            v_claim_rec.id,
            v_claim_rec.lifafa_id,
            v_alloc_from_claim
        );

        v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_from_claim;
    END LOOP;

    -- Non-Lifafa wallet balance allocation (e.g. UPI deposits, ticket cash, refunds, admin adjustments)
    IF v_remaining_to_allocate > 0 THEN
        INSERT INTO public.withdrawal_source_allocations (
            withdrawal_id,
            claim_id,
            lifafa_id,
            allocated_amount
        ) VALUES (
            v_withdrawal_id,
            NULL,
            NULL,
            v_remaining_to_allocate
        );
    END IF;

    -- Dual Ledger Transactions:
    -- Row 1: WITHDRAWAL (-v_payout_amount)
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
        -v_payout_amount,
        'WITHDRAWAL',
        'PENDING'::transaction_status,
        'WITHDRAWAL',
        v_withdrawal_id::text,
        'tx_' || v_key,
        v_balance_before,
        v_balance_mid,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'payout_amount', v_payout_amount,
            'account_holder', TRIM(p_account_holder_name),
            'account_masked', v_masked_acc,
            'withdrawable_balance_before', v_withdrawable_balance,
            'blocked_balance_at_request', v_blocked_amount
        )
    );

    -- Row 2: FEE (-v_fee)
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
        -v_fee,
        'FEE',
        'PENDING'::transaction_status,
        'WITHDRAWAL_FEE',
        v_withdrawal_id::text,
        'tx_fee_' || v_key,
        v_balance_mid,
        v_balance_after,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'fee_amount', v_fee,
            'fee_type', 'WITHDRAWAL_PLATFORM_FEE'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'amount', v_total_deduction,
        'fee', v_fee,
        'net_amount', v_payout_amount,
        'status', 'PENDING',
        'withdrawable_balance_after', GREATEST(0.00, v_withdrawable_balance - v_total_deduction)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 7. Upgraded admin_update_withdrawal_rpc: Reverses Source Allocations on FAILED / REVERSED
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_rpc(
    p_withdrawal_id UUID,
    p_new_status withdrawal_status,
    p_payout_reference_id TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_is_service_role BOOLEAN := COALESCE((auth.jwt() ->> 'role'), '') = 'service_role';
    v_withdrawal RECORD;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_alloc RECORD;
BEGIN
    -- Authorization: either service_role (Edge Function) or Administrator/Super Admin
    IF NOT v_is_service_role AND NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Only Administrators or automated service role can update payout status';
    END IF;

    SELECT * INTO v_withdrawal
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal record not found';
    END IF;

    -- Terminal status prevention
    IF v_withdrawal.status IN ('SUCCESS', 'FAILED', 'REVERSED') THEN
        RAISE EXCEPTION 'Withdrawal is already in terminal status (%) and cannot be modified again', v_withdrawal.status;
    END IF;

    -- Update withdrawal record
    UPDATE public.withdrawals
    SET status = p_new_status,
        payout_reference_id = COALESCE(p_payout_reference_id, payout_reference_id),
        rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
        processed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_withdrawal_id;

    -- If FAILED or REVERSED, refund user's available balance and restore source allocations
    IF p_new_status IN ('FAILED', 'REVERSED') THEN
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_withdrawal.user_id
        FOR UPDATE;

        IF FOUND THEN
            v_balance_before := v_wallet.available_balance;
            v_balance_after := v_balance_before + v_withdrawal.amount;

            -- Refund full gross deduction (amount = payout + fee)
            -- Decrement total_withdrawn by net payout (Option A)
            UPDATE public.wallets
            SET available_balance = available_balance + v_withdrawal.amount,
                total_withdrawn = GREATEST(0, total_withdrawn - v_withdrawal.net_amount),
                updated_at = TIMEZONE('utc'::text, NOW())
            WHERE id = v_wallet.id;

            -- Restore withdrawn_amount on allocated claims
            FOR v_alloc IN (
                SELECT claim_id, allocated_amount
                FROM public.withdrawal_source_allocations
                WHERE withdrawal_id = p_withdrawal_id
                  AND claim_id IS NOT NULL
            ) LOOP
                UPDATE public.lifafa_claims
                SET withdrawn_amount = GREATEST(0.00, withdrawn_amount - v_alloc.allocated_amount)
                WHERE id = v_alloc.claim_id;
            END LOOP;

            -- Create double-entry reversal transaction
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
                'SUCCESS'::transaction_status,
                'WITHDRAWAL_REVERSAL',
                p_withdrawal_id::text,
                'reversal_' || p_withdrawal_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
                v_balance_before,
                v_balance_after,
                jsonb_build_object(
                    'reason', p_rejection_reason,
                    'previous_status', v_withdrawal.status,
                    'refunded_gross_amount', v_withdrawal.amount,
                    'refunded_fee', v_withdrawal.fee_amount,
                    'refunded_net_payout', v_withdrawal.net_amount
                )
            );
        END IF;
    END IF;

    -- Audit Log (only logged if an admin user initiated the update)
    IF v_admin_id IS NOT NULL THEN
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
                'rejection_reason', p_rejection_reason
            )
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_rpc(UUID, withdrawal_status, TEXT, TEXT) TO authenticated;
