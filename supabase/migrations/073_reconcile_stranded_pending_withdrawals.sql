-- ==============================================================================
-- STATUS: NOT EXECUTED — AWAITING MANUAL REVIEW AND EXECUTION
-- Migration 073: Administrative Reconciliation for Stranded PENDING Withdrawals
-- Project: Create Lifafa (pxqyeonymwlpiklfyjbb)
-- Date: 2026-10-13
-- Author: Antigravity Autonomous Incident Remediation
--
-- NON-NEGOTIABLE SAFETY CONSTRAINT:
-- Under the incident operating rules, this migration file MUST NOT be executed
-- automatically. It is provided for database administrator inspection and
-- controlled execution after verifying payment gateway logs.
-- ==============================================================================

-- ==============================================================================
-- CONTEXT & ROOT CAUSE:
-- On 2026-10-13, withdrawals requested through consumer-paynit-payout action
-- 'request_and_dispatch' executed request_withdrawal_rpc(), which debited the
-- user's wallet balance and created a row in public.withdrawals with status 'PENDING'.
-- Immediately following the RPC commit, a PostgREST GET query attempted to fetch
-- the record. Due to read-replica replication lag / transient PostgREST lookup lag,
-- data was returned as null, prompting the function to return:
--   404: { "error": "Withdrawal record not found" }
-- As a result, the Edge Function halted before dispatching to the PayNit API,
-- stranding these withdrawals in 'PENDING' without a provider transaction reference,
-- while the user's wallet had already been debited.
-- ==============================================================================

-- STEP 1: READ-ONLY AUDIT QUERY (SAFE TO RUN IN DB QUERY CONSOLE)
-- Run this query first to inspect all stranded PENDING withdrawals:
/*
SELECT 
    w.id AS withdrawal_id,
    w.user_id,
    u.email,
    w.amount,
    w.fee,
    (w.amount + COALESCE(w.fee, 0)) AS total_debited,
    w.payment_method,
    w.upi_id,
    w.status,
    w.created_at,
    w.payout_batch_id,
    pt.provider_reference,
    pt.status AS provider_tx_status
FROM public.withdrawals w
LEFT JOIN auth.users u ON u.id = w.user_id
LEFT JOIN public.payout_transactions pt ON pt.withdrawal_id = w.id
WHERE w.status = 'PENDING'
  AND (w.payout_batch_id IS NULL OR w.payout_batch_id LIKE 'BATCH-INIT%')
  AND pt.id IS NULL
ORDER BY w.created_at DESC;
*/

-- STEP 2: RECONCILIATION FUNCTION (NOT EXECUTED)
-- This function allows an authorized administrator to either:
--   a) Refund the debited amount + fee back to the user's wallet and mark status = 'REJECTED' / 'FAILED'
--   b) Cancel cleanly if no gateway transaction took place
CREATE OR REPLACE FUNCTION public.admin_reconcile_stranded_withdrawal(
    p_withdrawal_id UUID,
    p_action TEXT, -- 'REFUND' or 'CANCEL'
    p_admin_reason TEXT DEFAULT 'Automated incident reconciliation for undispatched pending withdrawal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_withdrawal RECORD;
    v_wallet RECORD;
    v_total_refund NUMERIC(14, 2);
    v_new_balance NUMERIC(14, 2);
    v_existing_provider_tx RECORD;
BEGIN
    -- Verify caller is admin
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required');
    END IF;

    -- Lock withdrawal record for update
    SELECT * INTO v_withdrawal
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal record not found');
    END IF;

    -- Guard: Only allow reconciling PENDING withdrawals
    IF v_withdrawal.status != 'PENDING' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Withdrawal is not in PENDING status (current: %s)', v_withdrawal.status)
        );
    END IF;

    -- Safety check: Ensure no payout_transaction exists with a provider reference
    SELECT * INTO v_existing_provider_tx
    FROM public.payout_transactions
    WHERE withdrawal_id = p_withdrawal_id
      AND provider_reference IS NOT NULL
      AND status NOT IN ('FAILED', 'REJECTED');

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Provider payout already exists with ref: %s. Cannot refund without gateway verification.', v_existing_provider_tx.provider_reference)
        );
    END IF;

    v_total_refund := v_withdrawal.amount + COALESCE(v_withdrawal.fee, 0);

    IF p_action = 'REFUND' THEN
        -- Lock and update wallet balance
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_withdrawal.user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Wallet not found for user');
        END IF;

        v_new_balance := v_wallet.balance + v_total_refund;

        UPDATE public.wallets
        SET 
            balance = v_new_balance,
            updated_at = NOW()
        WHERE user_id = v_withdrawal.user_id;

        -- Record compensating ledger transaction
        INSERT INTO public.wallet_transactions (
            wallet_id,
            user_id,
            amount,
            type,
            status,
            description,
            balance_after,
            created_at
        ) VALUES (
            v_wallet.id,
            v_withdrawal.user_id,
            v_total_refund,
            'WITHDRAWAL_REFUND',
            'COMPLETED',
            format('Refund for undispatched withdrawal %s: %s', p_withdrawal_id, p_admin_reason),
            v_new_balance,
            NOW()
        );

        -- Update withdrawal record
        UPDATE public.withdrawals
        SET 
            status = 'REJECTED',
            rejection_reason = p_admin_reason,
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_withdrawal_id;

        -- If a placeholder payout_transactions record exists, mark it failed
        UPDATE public.payout_transactions
        SET 
            status = 'FAILED',
            failure_reason = p_admin_reason,
            updated_at = NOW()
        WHERE withdrawal_id = p_withdrawal_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'REFUND',
            'withdrawal_id', p_withdrawal_id,
            'user_id', v_withdrawal.user_id,
            'refunded_amount', v_total_refund,
            'new_balance', v_new_balance
        );

    ELSIF p_action = 'CANCEL' THEN
        -- Mark as cancelled without balance alteration (if balance was not deducted)
        UPDATE public.withdrawals
        SET 
            status = 'CANCELLED',
            rejection_reason = p_admin_reason,
            updated_at = NOW()
        WHERE id = p_withdrawal_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'CANCEL',
            'withdrawal_id', p_withdrawal_id
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action: must be REFUND or CANCEL');
    END IF;
END;
$$;

-- STEP 3: BATCH RECONCILIATION TEMPLATE (NOT EXECUTED)
-- Once confirmed with PayNit dashboard that the following 9 orders were never dispatched to gateway:
--
-- 1. 59c3bf91-539e-4e64-a069-0fa14c11b84f (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 2. df8f1b41-11fb-4299-8800-84382e70ec4a (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 3. d209c7c1-dfa0-4a87-9bc8-5d207ec2d829 (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 4. eb160a35-c335-4ae0-a29d-ee2f15fdf8b1 (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 5. 31d13d7a-425b-4394-bb9e-bf0a2c040d7c (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 6. 30295795-0f6f-40ff-9f4a-ea843be6858e (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 7. 7b5b3f4a-0a79-43c3-b4cf-d61fb3a1213f (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 8. 8472e8d5-1815-4ba5-a6e5-49ce8fb8bf53 (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
-- 9. f16b4b52-e87f-47cf-b499-47007be49033 (User: 860f19e0-3b75-4b42-91db-dc7a3cf29d9a, Net: 10.00, Fee: 2.50)
--
-- The administrator can execute:
/*
DO $$
DECLARE
    r UUID;
    w_ids UUID[] := ARRAY[
        '59c3bf91-539e-4e64-a069-0fa14c11b84f'::uuid,
        'df8f1b41-11fb-4299-8800-84382e70ec4a'::uuid,
        'd209c7c1-dfa0-4a87-9bc8-5d207ec2d829'::uuid,
        'eb160a35-c335-4ae0-a29d-ee2f15fdf8b1'::uuid,
        '31d13d7a-425b-4394-bb9e-bf0a2c040d7c'::uuid,
        '30295795-0f6f-40ff-9f4a-ea843be6858e'::uuid,
        '7b5b3f4a-0a79-43c3-b4cf-d61fb3a1213f'::uuid,
        '8472e8d5-1815-4ba5-a6e5-49ce8fb8bf53'::uuid,
        'f16b4b52-e87f-47cf-b499-47007be49033'::uuid
    ];
BEGIN
    FOREACH r IN ARRAY w_ids LOOP
        PERFORM public.admin_reconcile_stranded_withdrawal(r, 'REFUND', 'Stranded pending withdrawal due to 2026-10-13 edge lookup lag incident');
    END LOOP;
END;
$$;
*/
