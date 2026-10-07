-- ==============================================================================
-- Migration: 065_merchant_gateway_order_status_check.sql
-- Description: Merchant Gateway Order Status Verification & Atomic Refund RPC
--              Provides hardened, concurrency-safe, idempotent status synchronization
--              and single-entry wallet refund for definitive PayNit provider failures.
-- Target: Supabase SQL Editor (Manual Review and Execution by Platform Administrator)
-- Status: NOT EXECUTED — USER MUST RUN THIS MANUALLY
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.merchant_reconcile_payout_status_rpc(
    p_merchant_id UUID,
    p_order_id TEXT,
    p_target_status TEXT,
    p_provider_reference_id TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
    v_payout RECORD;
    v_wallet RECORD;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
    v_event_id TEXT;
    v_clean_order_id TEXT;
BEGIN
    v_clean_order_id := TRIM(p_order_id);
    IF v_clean_order_id IS NULL OR LENGTH(v_clean_order_id) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order ID is required');
    END IF;

    -- 1. Authorization: Verify caller owns active merchant account
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        SELECT * INTO v_merchant
        FROM public.merchants
        WHERE id = p_merchant_id AND user_id = v_caller_uid AND status = 'ACTIVE';

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Transaction not found.');
        END IF;
    ELSE
        SELECT * INTO v_merchant
        FROM public.merchants
        WHERE id = p_merchant_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Transaction not found.');
        END IF;
    END IF;

    -- 2. Lock target payout row (concurrency protection)
    SELECT * INTO v_payout
    FROM public.merchant_payouts
    WHERE merchant_id = p_merchant_id
      AND (order_id = v_clean_order_id OR provider_order_id = v_clean_order_id OR provider_reference_id = v_clean_order_id)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found.');
    END IF;

    -- 3. Case A: Target Status is SUCCESS
    IF UPPER(TRIM(p_target_status)) = 'SUCCESS' THEN
        -- If already SUCCESS, return idempotent confirmation
        IF v_payout.status = 'SUCCESS' THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'SUCCESS',
                'idempotent', true,
                'order_id', v_payout.order_id,
                'provider_reference_id', COALESCE(p_provider_reference_id, v_payout.provider_reference_id)
            );
        END IF;

        -- Terminal conflict: Cannot convert FAILED/REVERSED to SUCCESS
        IF v_payout.status IN ('FAILED', 'REVERSED') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Terminal conflict: Payout is already FAILED/REVERSED and cannot be marked SUCCESS'
            );
        END IF;

        -- Update payout to SUCCESS
        UPDATE public.merchant_payouts
        SET
            status = 'SUCCESS',
            provider_reference_id = COALESCE(NULLIF(TRIM(p_provider_reference_id), ''), v_payout.provider_reference_id),
            processed_at = COALESCE(processed_at, TIMEZONE('utc'::text, NOW())),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_payout.id;

        -- Record audit event
        v_event_id := 'recon_succ_' || v_payout.id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (v_event_id, v_payout.id, 'payout.reconcile_success', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'SUCCESS',
            'order_id', v_payout.order_id,
            'provider_reference_id', COALESCE(p_provider_reference_id, v_payout.provider_reference_id)
        );
    END IF;

    -- 4. Case B: Target Status is FAILED (Definitive Provider Failure -> Wallet Refund)
    IF UPPER(TRIM(p_target_status)) = 'FAILED' THEN
        -- If already FAILED or REVERSED, do NOT double-refund
        IF v_payout.status IN ('FAILED', 'REVERSED') THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'FAILED',
                'already_refunded', true,
                'idempotent', true,
                'refund_amount', v_payout.total_deducted,
                'order_id', v_payout.order_id
            );
        END IF;

        -- Terminal conflict: A payout already SUCCESS cannot be marked FAILED or refunded
        IF v_payout.status = 'SUCCESS' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Terminal conflict: Payout is already finalized as SUCCESS and cannot be refunded'
            );
        END IF;

        -- Lock merchant wallet
        SELECT * INTO v_wallet
        FROM public.merchant_wallets
        WHERE merchant_id = p_merchant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Merchant wallet not found for merchant %', p_merchant_id;
        END IF;

        v_bal_before := v_wallet.available_balance;
        v_bal_mid := v_bal_before + v_payout.amount;
        v_bal_after := v_bal_mid + v_payout.fee_amount;

        -- Restore locked float: return amount + fee to available_balance, release locked float
        UPDATE public.merchant_wallets
        SET
            available_balance = v_bal_after,
            locked_payout_balance = GREATEST(0.00, locked_payout_balance - v_payout.total_deducted),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;

        -- Append immutable double-entry ledger audit entries
        v_event_id := 'recon_fail_' || v_payout.id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;

        INSERT INTO public.merchant_ledger_entries (
            merchant_id, wallet_id, amount, fee_amount, entry_type,
            reference_type, reference_id, idempotency_key,
            balance_before, balance_after, metadata
        ) VALUES 
        (
            p_merchant_id, v_wallet.id, v_payout.amount, 0.00, 'PAYOUT_REFUND',
            'PAYOUT', v_payout.id::text, 'mch_py_ref_amt_' || v_event_id,
            v_bal_before, v_bal_mid,
            jsonb_build_object('reason', p_rejection_reason, 'event_id', v_event_id, 'order_id', v_payout.order_id)
        ),
        (
            p_merchant_id, v_wallet.id, v_payout.fee_amount, 0.00, 'PAYOUT_FEE_REFUND',
            'PAYOUT', v_payout.id::text, 'mch_py_ref_fee_' || v_event_id,
            v_bal_mid, v_bal_after,
            jsonb_build_object('reason', p_rejection_reason, 'fee_refunded', v_payout.fee_amount, 'order_id', v_payout.order_id)
        );

        -- Mark payout FAILED
        UPDATE public.merchant_payouts
        SET
            status = 'FAILED',
            rejection_reason = COALESCE(NULLIF(TRIM(p_rejection_reason), ''), 'Payment failed at banking provider'),
            processed_at = TIMEZONE('utc'::text, NOW()),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_payout.id;

        -- Record event
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (v_event_id, v_payout.id, 'payout.failed_reconcile', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'FAILED',
            'refunded', true,
            'refund_amount', v_payout.total_deducted,
            'order_id', v_payout.order_id
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Invalid target status. Must be SUCCESS or FAILED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Permissions: Revoke from public/anon, grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.merchant_reconcile_payout_status_rpc(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_reconcile_payout_status_rpc(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
