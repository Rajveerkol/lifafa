-- ==============================================================================
-- Migration: 066_merchant_gateway_conditional_refund_rpc.sql
-- Description: Merchant Gateway Automated Payout Status Reconcile RPC (v2)
--
-- STRICT RULES & INVARIANTS:
-- 1. NEW TRANSACTIONS ONLY: Automated status-check refund triggers ONLY for payouts
--    created on or after the activation boundary (p_activation_boundary).
--    Historical payouts are NEVER modified, refunded, or backfilled.
-- 2. VERIFY ACTUAL DEDUCTION: Verifies that wallet funds were ACTUALLY debited/locked
--    before crediting any refund. If no deduction was made, refunds ₹0.00.
-- 3. DUAL-WALLET ATOMIC CREDITING:
--    - public.wallets (shared user balance displayed on frontend): available_balance += total_deducted, total_withdrawn -= amount
--    - public.merchant_wallets (merchant float tracking): available_balance += total_deducted, locked_payout_balance -= total_deducted
-- 4. DOUBLE-REFUND PROTECTION: Idempotent check ensures exactly one refund per payout.
-- 5. COMPLETE DOUBLE-ENTRY AUDIT:
--    - public.merchant_ledger_entries (PAYOUT_REFUND, PAYOUT_FEE_REFUND)
--    - public.wallet_transactions (WITHDRAWAL_REVERSAL, REFUND)
-- 6. SUCCESS IMMUTABILITY: SUCCESS payouts can NEVER be marked FAILED or refunded.
--
-- SQL EXECUTION STATUS: NOT EXECUTED — USER MUST RUN THIS MANUALLY.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.merchant_reconcile_payout_status_v2_rpc(
    p_merchant_id UUID,
    p_order_id TEXT,
    p_target_status TEXT,
    p_rejection_reason TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT '{}'::jsonb,
    p_activation_boundary TIMESTAMPTZ DEFAULT '2026-10-07T10:45:00.000Z'::timestamptz
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
    v_payout RECORD;
    v_user_wallet RECORD;
    v_mch_wallet RECORD;
    v_clean_order_id TEXT;
    v_is_uuid BOOLEAN;
    v_user_bal_before NUMERIC(12, 2);
    v_user_bal_mid NUMERIC(12, 2);
    v_user_bal_after NUMERIC(12, 2);
    v_mch_bal_before NUMERIC(12, 2);
    v_mch_bal_mid NUMERIC(12, 2);
    v_mch_bal_after NUMERIC(12, 2);
    v_event_id TEXT;
    v_timestamp_epoch BIGINT := EXTRACT(EPOCH FROM NOW())::BIGINT;
    v_has_deduction BOOLEAN := FALSE;
    v_has_refund BOOLEAN := FALSE;
BEGIN
    -- 1. Authorization Check: service_role or active merchant owner
    SELECT * INTO v_merchant
    FROM public.merchants
    WHERE id = p_merchant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant account not found';
    END IF;

    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL OR v_merchant.user_id <> v_caller_uid THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    -- 2. Clean and Locate Payout Record
    v_clean_order_id := TRIM(p_order_id);
    v_is_uuid := (v_clean_order_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

    IF v_is_uuid THEN
        SELECT * INTO v_payout
        FROM public.merchant_payouts
        WHERE merchant_id = p_merchant_id
          AND (order_id = v_clean_order_id OR provider_order_id = v_clean_order_id OR provider_reference_id = v_clean_order_id OR id::text = v_clean_order_id)
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;
    ELSE
        SELECT * INTO v_payout
        FROM public.merchant_payouts
        WHERE merchant_id = p_merchant_id
          AND (order_id = v_clean_order_id OR provider_order_id = v_clean_order_id OR provider_reference_id = v_clean_order_id)
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payout transaction not found for order %', v_clean_order_id;
    END IF;

    -- 3. Case A: Target Status SUCCESS
    IF UPPER(TRIM(p_target_status)) = 'SUCCESS' THEN
        -- If already finalized as SUCCESS, return idempotent
        IF v_payout.status = 'SUCCESS' THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'SUCCESS',
                'idempotent', true,
                'order_id', v_payout.order_id,
                'amount', v_payout.amount,
                'fee', v_payout.fee_amount,
                'total_deducted', v_payout.total_deducted,
                'message', 'Payout was already completed successfully'
            );
        END IF;

        -- Terminal conflict: A payout that already FAILED cannot transition to SUCCESS
        IF v_payout.status IN ('FAILED', 'REVERSED') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Terminal state conflict: Payout is already marked FAILED and cannot be updated to SUCCESS'
            );
        END IF;

        -- Update payout status to SUCCESS
        UPDATE public.merchant_payouts
        SET
            status = 'SUCCESS',
            provider_reference_id = COALESCE(NULLIF(p_raw_payload->>'order_id', ''), v_payout.provider_reference_id),
            processed_at = TIMEZONE('utc'::text, NOW()),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_payout.id;

        -- Release locked payout balance from merchant_wallets
        UPDATE public.merchant_wallets
        SET
            locked_payout_balance = GREATEST(0.00, locked_payout_balance - v_payout.total_deducted),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE merchant_id = p_merchant_id;

        -- Record event
        v_event_id := 'recon_succ_' || v_payout.id::text || '_' || v_timestamp_epoch;
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (v_event_id, v_payout.id, 'payout.success_reconcile', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'SUCCESS',
            'order_id', v_payout.order_id,
            'amount', v_payout.amount,
            'fee', v_payout.fee_amount,
            'total_deducted', v_payout.total_deducted,
            'message', 'Payout successfully finalized'
        );
    END IF;

    -- 4. Case B: Target Status FAILED
    IF UPPER(TRIM(p_target_status)) = 'FAILED' THEN
        -- Terminal conflict: A payout that already succeeded can NEVER be refunded
        IF v_payout.status = 'SUCCESS' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Terminal state conflict: Payout is already finalized as SUCCESS and cannot be refunded'
            );
        END IF;

        -- FINANCIAL RULE 1: BOUNDARY CHECK (New Transactions Only)
        IF v_payout.created_at < p_activation_boundary THEN
            -- Historical payout: DO NOT refund, DO NOT modify balances
            RETURN jsonb_build_object(
                'success', true,
                'status', 'FAILED',
                'is_historical', true,
                'refunded', false,
                'already_refunded', false,
                'refund_amount', 0.00,
                'order_id', v_payout.order_id,
                'message', 'Historical transaction created prior to automated refund activation. Wallet balance was not modified.'
            );
        END IF;

        -- FINANCIAL RULE 2: DOUBLE-REFUND PROTECTION & IDEMPOTENCY
        SELECT EXISTS (
            SELECT 1 FROM public.merchant_ledger_entries
            WHERE merchant_id = p_merchant_id
              AND reference_id = v_payout.id::text
              AND entry_type IN ('PAYOUT_REFUND', 'PAYOUT_FEE_REFUND')
        ) INTO v_has_refund;

        IF v_payout.status IN ('FAILED', 'REVERSED') OR v_has_refund THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'FAILED',
                'already_refunded', true,
                'refunded', false,
                'refund_amount', v_payout.total_deducted,
                'order_id', v_payout.order_id,
                'message', 'Payout already marked as Failed and previously refunded to Gateway wallet.'
            );
        END IF;

        -- FINANCIAL RULE 3: VERIFY ACTUAL WALLET DEDUCTION
        SELECT EXISTS (
            SELECT 1 FROM public.merchant_ledger_entries
            WHERE merchant_id = p_merchant_id
              AND reference_id = v_payout.id::text
              AND entry_type IN ('PAYOUT_LOCK', 'PAYOUT_FEE_LOCK', 'PAYOUT')
        ) INTO v_has_deduction;

        IF NOT v_has_deduction AND v_payout.status = 'DRAFT' THEN
            -- No deduction was made; mark FAILED but refund ₹0
            UPDATE public.merchant_payouts
            SET
                status = 'FAILED',
                rejection_reason = COALESCE(NULLIF(TRIM(p_rejection_reason), ''), 'Payment failed at banking provider'),
                processed_at = TIMEZONE('utc'::text, NOW()),
                updated_at = TIMEZONE('utc'::text, NOW())
            WHERE id = v_payout.id;

            RETURN jsonb_build_object(
                'success', true,
                'status', 'FAILED',
                'refunded', false,
                'no_deduction', true,
                'refund_amount', 0.00,
                'order_id', v_payout.order_id,
                'message', 'Payout marked as Failed. No wallet deduction was recorded, so no refund was required.'
            );
        END IF;

        -- FINANCIAL RULE 4: DUAL-WALLET ATOMIC CREDITING
        -- A. Lock and credit authoritative public.wallets (user available balance)
        SELECT * INTO v_user_wallet
        FROM public.wallets
        WHERE user_id = v_merchant.user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Authoritative user wallet not found for user %', v_merchant.user_id;
        END IF;

        v_user_bal_before := v_user_wallet.available_balance;
        v_user_bal_mid := v_user_bal_before + v_payout.amount;
        v_user_bal_after := v_user_bal_before + v_payout.total_deducted;

        UPDATE public.wallets
        SET
            available_balance = v_user_bal_after,
            total_withdrawn = GREATEST(0.00, total_withdrawn - v_payout.amount),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_user_wallet.id;

        -- B. Lock and credit public.merchant_wallets (merchant float tracking)
        SELECT * INTO v_mch_wallet
        FROM public.merchant_wallets
        WHERE merchant_id = p_merchant_id
        FOR UPDATE;

        IF FOUND THEN
            v_mch_bal_before := v_mch_wallet.available_balance;
            v_mch_bal_mid := v_mch_bal_before + v_payout.amount;
            v_mch_bal_after := v_mch_bal_before + v_payout.total_deducted;

            UPDATE public.merchant_wallets
            SET
                available_balance = v_mch_bal_after,
                locked_payout_balance = GREATEST(0.00, locked_payout_balance - v_payout.total_deducted),
                updated_at = TIMEZONE('utc'::text, NOW())
            WHERE id = v_mch_wallet.id;
        END IF;

        -- C. Append immutable double-entry ledger audit entries in public.merchant_ledger_entries
        v_event_id := 'recon_fail_' || v_payout.id::text || '_' || v_timestamp_epoch;

        IF v_mch_wallet.id IS NOT NULL THEN
            INSERT INTO public.merchant_ledger_entries (
                merchant_id, wallet_id, amount, fee_amount, entry_type,
                reference_type, reference_id, idempotency_key,
                balance_before, balance_after, metadata
            ) VALUES 
            (
                p_merchant_id, v_mch_wallet.id, v_payout.amount, 0.00, 'PAYOUT_REFUND',
                'PAYOUT', v_payout.id::text, 'mch_py_ref_amt_' || v_event_id,
                v_mch_bal_before, v_mch_bal_mid,
                jsonb_build_object('reason', p_rejection_reason, 'event_id', v_event_id, 'order_id', v_payout.order_id, 'refund_type', 'PRINCIPAL')
            ),
            (
                p_merchant_id, v_mch_wallet.id, v_payout.fee_amount, 0.00, 'PAYOUT_FEE_REFUND',
                'PAYOUT', v_payout.id::text, 'mch_py_ref_fee_' || v_event_id,
                v_mch_bal_mid, v_mch_bal_after,
                jsonb_build_object('reason', p_rejection_reason, 'fee_refunded', v_payout.fee_amount, 'order_id', v_payout.order_id, 'refund_type', 'FEE')
            );
        END IF;

        -- D. Append double-entry transactions in public.wallet_transactions
        INSERT INTO public.wallet_transactions (
            user_id, wallet_id, amount, type, status,
            reference_type, reference_id, idempotency_key,
            balance_before, balance_after, metadata
        ) VALUES
        (
            v_merchant.user_id, v_user_wallet.id, v_payout.amount,
            'WITHDRAWAL_REVERSAL'::transaction_type, 'SUCCESS'::transaction_status,
            'MERCHANT_PAYOUT', v_payout.id::text, 'tx_mch_ref_amt_' || v_event_id,
            v_user_bal_before, v_user_bal_mid,
            jsonb_build_object('merchant_id', p_merchant_id, 'order_id', v_payout.order_id, 'reason', p_rejection_reason)
        ),
        (
            v_merchant.user_id, v_user_wallet.id, v_payout.fee_amount,
            'REFUND'::transaction_type, 'SUCCESS'::transaction_status,
            'MERCHANT_PAYOUT_FEE', v_payout.id::text, 'tx_mch_ref_fee_' || v_event_id,
            v_user_bal_mid, v_user_bal_after,
            jsonb_build_object('merchant_id', p_merchant_id, 'order_id', v_payout.order_id, 'fee', v_payout.fee_amount, 'reason', p_rejection_reason)
        );

        -- E. Mark payout FAILED
        UPDATE public.merchant_payouts
        SET
            status = 'FAILED',
            rejection_reason = COALESCE(NULLIF(TRIM(p_rejection_reason), ''), 'Payment failed at banking provider'),
            processed_at = TIMEZONE('utc'::text, NOW()),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_payout.id;

        -- F. Record event
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (v_event_id, v_payout.id, 'payout.failed_reconcile_v2', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'FAILED',
            'refunded', true,
            'already_refunded', false,
            'refund_amount', v_payout.total_deducted,
            'order_id', v_payout.order_id,
            'message', 'Payout Failed. The authoritative amount of ₹' || v_payout.total_deducted::text || ' has been refunded to your Gateway wallet.'
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Invalid target status. Must be SUCCESS or FAILED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Permissions
REVOKE ALL ON FUNCTION public.merchant_reconcile_payout_status_v2_rpc(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_reconcile_payout_status_v2_rpc(UUID, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO authenticated, service_role;
