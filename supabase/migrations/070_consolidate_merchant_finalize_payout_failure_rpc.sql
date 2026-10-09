-- ==============================================================================
-- MIGRATION 070: CONSOLIDATE & HARDEN MERCHANT FINALIZE PAYOUT FAILURE RPC
-- ==============================================================================
-- SQL STATUS: NOT EXECUTED — AWAITING MANUAL EXECUTION
--
-- AUDIT & PURPOSE:
-- 1. Eliminate all competing / historical overloaded definitions of
--    public.merchant_finalize_payout_failure_rpc in pg_proc.
-- 2. Define the single authoritative canonical function matching the exact
--    signature called by all deployed Edge Functions:
--    (p_provider_order_id TEXT, p_rejection_reason TEXT, p_provider_event_id TEXT, p_raw_payload JSONB)
-- 3. Correct wallet column references:
--    - public.wallets: available_balance, total_withdrawn (NOT "balance")
--    - public.merchant_wallets: available_balance, locked_payout_balance
-- 4. Correct ledger entry types:
--    - Verify PAYOUT_LOCK and PAYOUT_FEE_LOCK from public.merchant_ledger_entries
--      (NOT non-existent PAYOUT_DEBIT)
-- 5. Prevent partial deduction over-refunding:
--    - Only refunds the exact locked principal and fee found in the ledger.
-- 6. Enforce historical transaction protection:
--    - Payouts created before 2026-10-07T10:45:00.000Z are marked FAILED with zero refund.
-- 7. Ensure absolute idempotency and terminal SUCCESS immutability.
-- 8. Restrict execution strictly to service_role with SECURITY DEFINER and explicit search_path.
-- ==============================================================================

-- STEP 1: DYNAMICALLY DROP ALL EXISTING OVERLOADS OF merchant_finalize_payout_failure_rpc
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'merchant_finalize_payout_failure_rpc'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE;';
    END LOOP;
END;
$$;

-- STEP 2: CREATE CANONICAL 4-PARAMETER RPC
CREATE OR REPLACE FUNCTION public.merchant_finalize_payout_failure_rpc(
    p_provider_order_id TEXT,
    p_rejection_reason TEXT,
    p_provider_event_id TEXT,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payout RECORD;
    v_merchant RECORD;
    v_user_wallet RECORD;
    v_mch_wallet RECORD;
    v_clean_provider_order_id TEXT;
    v_boundary TIMESTAMPTZ := '2026-10-07 10:45:00+00';
    v_is_historical BOOLEAN := FALSE;
    v_has_refund BOOLEAN := FALSE;
    v_deducted_principal NUMERIC(12, 2) := 0.00;
    v_deducted_fee NUMERIC(12, 2) := 0.00;
    v_total_to_refund NUMERIC(12, 2) := 0.00;
    v_u_bal_before NUMERIC(12, 2);
    v_u_bal_mid NUMERIC(12, 2);
    v_u_bal_after NUMERIC(12, 2);
    v_m_bal_before NUMERIC(12, 2);
    v_m_bal_mid NUMERIC(12, 2);
    v_m_bal_after NUMERIC(12, 2);
    v_timestamp_ms BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
    -- 1. Security Gate: Only service_role may finalize provider failure & issue refund
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: service_role required';
    END IF;

    v_clean_provider_order_id := TRIM(p_provider_order_id);
    IF v_clean_provider_order_id IS NULL OR LENGTH(v_clean_provider_order_id) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Provider order ID is required');
    END IF;

    -- 2. Idempotency Check on Provider Event ID
    IF p_provider_event_id IS NOT NULL AND LENGTH(TRIM(p_provider_event_id)) > 0 THEN
        IF EXISTS (SELECT 1 FROM public.merchant_payout_events WHERE provider_event_id = TRIM(p_provider_event_id)) THEN
            RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Event already processed');
        END IF;
    END IF;

    -- 3. Lock Target Payout Row (concurrency lock)
    SELECT * INTO v_payout
    FROM public.merchant_payouts
    WHERE provider_order_id = v_clean_provider_order_id
       OR order_id = v_clean_provider_order_id
       OR provider_reference_id = v_clean_provider_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant payout not found for provider order %', v_clean_provider_order_id;
    END IF;

    -- 4. Terminal State Protection
    -- Case A: If already FAILED or REVERSED -> Idempotent response
    IF UPPER(v_payout.status) IN ('FAILED', 'REVERSED') THEN
        IF p_provider_event_id IS NOT NULL THEN
            INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
            VALUES (TRIM(p_provider_event_id), v_payout.id, 'payout.already_failed', p_raw_payload)
            ON CONFLICT (provider_event_id) DO NOTHING;
        END IF;
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'FAILED', 'refunded', false);
    END IF;

    -- Case B: If already SUCCESS -> Terminal conflict. NEVER fail or refund an already-completed payout.
    IF UPPER(v_payout.status) = 'SUCCESS' THEN
        IF p_provider_event_id IS NOT NULL THEN
            INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
            VALUES (TRIM(p_provider_event_id), v_payout.id, 'payout.conflict_already_success', p_raw_payload)
            ON CONFLICT (provider_event_id) DO NOTHING;
        END IF;
        RETURN jsonb_build_object(
            'success', false,
            'idempotent', true,
            'status', 'SUCCESS',
            'error', 'Terminal conflict: Payout is already SUCCESS and cannot be marked FAILED or refunded'
        );
    END IF;

    -- 5. Historical Payout Boundary Check
    IF v_payout.created_at < v_boundary THEN
        v_is_historical := TRUE;
        UPDATE public.merchant_payouts
        SET status = 'FAILED',
            rejection_reason = COALESCE(p_rejection_reason, 'Payment failed at banking provider'),
            processed_at = COALESCE(processed_at, TIMEZONE('utc'::text, NOW())),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_payout.id;

        IF p_provider_event_id IS NOT NULL THEN
            INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
            VALUES (TRIM(p_provider_event_id), v_payout.id, 'payout.historical_failed_no_refund', p_raw_payload)
            ON CONFLICT (provider_event_id) DO NOTHING;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'payout_id', v_payout.id,
            'status', 'FAILED',
            'refunded', false,
            'is_historical', true,
            'refund_amount', 0.00
        );
    END IF;

    -- 6. Double-Refund Protection Check
    SELECT EXISTS (
        SELECT 1 FROM public.merchant_ledger_entries
        WHERE reference_id = v_payout.id::TEXT
          AND entry_type IN ('PAYOUT_REFUND', 'PAYOUT_FEE_REFUND')
    ) INTO v_has_refund;

    IF v_has_refund THEN
        UPDATE public.merchant_payouts
        SET status = 'FAILED',
            rejection_reason = COALESCE(p_rejection_reason, 'Payment failed at banking provider'),
            processed_at = COALESCE(processed_at, TIMEZONE('utc'::text, NOW())),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_payout.id;

        RETURN jsonb_build_object(
            'success', true,
            'payout_id', v_payout.id,
            'status', 'FAILED',
            'already_refunded', true,
            'refunded', false,
            'refund_amount', 0.00
        );
    END IF;

    -- 7. Verify Actual Deduction in Ledger (Anti-Over-Refund Guard)
    SELECT COALESCE(SUM(ABS(amount)), 0.00) INTO v_deducted_principal
    FROM public.merchant_ledger_entries
    WHERE reference_id = v_payout.id::TEXT
      AND entry_type = 'PAYOUT_LOCK';

    SELECT COALESCE(SUM(ABS(amount)), 0.00) INTO v_deducted_fee
    FROM public.merchant_ledger_entries
    WHERE reference_id = v_payout.id::TEXT
      AND entry_type = 'PAYOUT_FEE_LOCK';

    v_total_to_refund := v_deducted_principal + v_deducted_fee;

    -- If no funds were ever locked/deducted, mark FAILED but do NOT credit wallet
    IF v_total_to_refund <= 0.00 THEN
        UPDATE public.merchant_payouts
        SET status = 'FAILED',
            rejection_reason = COALESCE(p_rejection_reason, 'Payment failed at banking provider'),
            processed_at = COALESCE(processed_at, TIMEZONE('utc'::text, NOW())),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_payout.id;

        IF p_provider_event_id IS NOT NULL THEN
            INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
            VALUES (TRIM(p_provider_event_id), v_payout.id, 'payout.failed_no_deduction', p_raw_payload)
            ON CONFLICT (provider_event_id) DO NOTHING;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'payout_id', v_payout.id,
            'status', 'FAILED',
            'refunded', false,
            'no_deduction', true,
            'refund_amount', 0.00
        );
    END IF;

    -- 8. Fetch Merchant & Lock Wallets
    SELECT * INTO v_merchant
    FROM public.merchants
    WHERE id = v_payout.merchant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant record not found for payout %', v_payout.id;
    END IF;

    -- Lock Authoritative User Wallet
    SELECT * INTO v_user_wallet
    FROM public.wallets
    WHERE user_id = v_merchant.user_id
    FOR UPDATE;

    -- Lock Merchant Gateway Float Wallet
    SELECT * INTO v_mch_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = v_payout.merchant_id
    FOR UPDATE;

    -- 9. Atomic Double-Wallet Crediting
    -- A. Update public.wallets (Authoritative User Balance)
    IF v_user_wallet.id IS NOT NULL THEN
        v_u_bal_before := v_user_wallet.available_balance;
        v_u_bal_mid := v_u_bal_before + v_deducted_principal;
        v_u_bal_after := v_u_bal_before + v_total_to_refund;

        UPDATE public.wallets
        SET available_balance = v_u_bal_after,
            total_withdrawn = GREATEST(0.00, total_withdrawn - v_deducted_principal),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_user_wallet.id;

        -- Insert audit transactions in public.wallet_transactions
        INSERT INTO public.wallet_transactions (
            user_id, wallet_id, amount, type, status,
            reference_type, reference_id, idempotency_key,
            balance_before, balance_after, metadata
        ) VALUES
        (
            v_merchant.user_id, v_user_wallet.id, v_deducted_principal,
            'REFUND', 'SUCCESS', 'MERCHANT_PAYOUT', v_payout.id::TEXT,
            'tx_mch_ref_amt_' || v_payout.id::TEXT || '_' || v_timestamp_ms,
            v_u_bal_before, v_u_bal_mid,
            jsonb_build_object('order_id', v_payout.order_id, 'reason', p_rejection_reason)
        );

        IF v_deducted_fee > 0.00 THEN
            INSERT INTO public.wallet_transactions (
                user_id, wallet_id, amount, type, status,
                reference_type, reference_id, idempotency_key,
                balance_before, balance_after, metadata
            ) VALUES
            (
                v_merchant.user_id, v_user_wallet.id, v_deducted_fee,
                'REFUND', 'SUCCESS', 'MERCHANT_PAYOUT_FEE', v_payout.id::TEXT,
                'tx_mch_ref_fee_' || v_payout.id::TEXT || '_' || v_timestamp_ms,
                v_u_bal_mid, v_u_bal_after,
                jsonb_build_object('order_id', v_payout.order_id, 'reason', p_rejection_reason)
            );
        END IF;
    END IF;

    -- B. Update public.merchant_wallets (Merchant Float Tracking)
    IF v_mch_wallet.id IS NOT NULL THEN
        v_m_bal_before := v_mch_wallet.available_balance;
        v_m_bal_mid := v_m_bal_before + v_deducted_principal;
        v_m_bal_after := v_m_bal_before + v_total_to_refund;

        UPDATE public.merchant_wallets
        SET available_balance = v_m_bal_after,
            locked_payout_balance = GREATEST(0.00, locked_payout_balance - v_total_to_refund),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_mch_wallet.id;

        -- Insert double-entry ledger entries in public.merchant_ledger_entries
        INSERT INTO public.merchant_ledger_entries (
            merchant_id, wallet_id, amount, fee_amount, entry_type,
            reference_type, reference_id, idempotency_key,
            balance_before, balance_after, metadata
        ) VALUES
        (
            v_payout.merchant_id, v_mch_wallet.id, v_deducted_principal, 0.00,
            'PAYOUT_REFUND', 'PAYOUT', v_payout.id::TEXT,
            'mch_py_ref_amt_' || v_payout.id::TEXT || '_' || v_timestamp_ms,
            v_m_bal_before, v_m_bal_mid,
            jsonb_build_object('order_id', v_payout.order_id, 'reason', p_rejection_reason)
        );

        IF v_deducted_fee > 0.00 THEN
            INSERT INTO public.merchant_ledger_entries (
                merchant_id, wallet_id, amount, fee_amount, entry_type,
                reference_type, reference_id, idempotency_key,
                balance_before, balance_after, metadata
            ) VALUES
            (
                v_payout.merchant_id, v_mch_wallet.id, v_deducted_fee, 0.00,
                'PAYOUT_FEE_REFUND', 'PAYOUT', v_payout.id::TEXT,
                'mch_py_ref_fee_' || v_payout.id::TEXT || '_' || v_timestamp_ms,
                v_m_bal_mid, v_m_bal_after,
                jsonb_build_object('order_id', v_payout.order_id, 'reason', p_rejection_reason)
            );
        END IF;
    END IF;

    -- 10. Update Payout Status to FAILED
    UPDATE public.merchant_payouts
    SET status = 'FAILED',
        rejection_reason = COALESCE(p_rejection_reason, 'Payment failed at banking provider'),
        processed_at = COALESCE(processed_at, TIMEZONE('utc'::text, NOW())),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_payout.id;

    -- 11. Record Event in merchant_payout_events
    IF p_provider_event_id IS NOT NULL THEN
        INSERT INTO public.merchant_payout_events (provider_event_id, payout_id, event_type, raw_payload)
        VALUES (TRIM(p_provider_event_id), v_payout.id, 'payout.failed_refunded', p_raw_payload)
        ON CONFLICT (provider_event_id) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout.id,
        'order_id', v_payout.order_id,
        'status', 'FAILED',
        'refunded', true,
        'refund_amount', v_total_to_refund
    );
END;
$$;

-- STEP 3: STRICT SECURITY GRANTS (SERVICE ROLE ONLY)
REVOKE ALL ON FUNCTION public.merchant_finalize_payout_failure_rpc(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_finalize_payout_failure_rpc(TEXT, TEXT, TEXT, JSONB) TO service_role;
