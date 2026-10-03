-- ==============================================================================
-- Migration: 045_fix_admin_deposit_approval_total_deposited.sql
-- Description: Fix "column total_deposited does not exist" error in Admin Deposits.
-- 
-- Root Cause:
--   public.wallets schema (003_wallets_and_ledger.sql) has columns:
--     (id, user_id, available_balance, reserved_balance, total_earned, total_withdrawn, created_at, updated_at)
--   It does NOT have total_deposited.
--   Migration 044 introduced:
--     UPDATE public.wallets SET available_balance = ..., total_deposited = total_deposited + ...
--   which causes PostgreSQL error:
--     column "total_deposited" of relation "wallets" does not exist
--   during deposit approvals.
--
-- Fix:
--   1. In admin_approve_merchant_deposit_rpc:
--      - Remove invalid total_deposited update from public.wallets.
--      - Preserve total_deposited update on public.merchant_wallets (where column exists).
--      - Preserve all financial calculations: 2% fee, gross amount, net credited.
--   2. In admin_review_deposit_rpc:
--      - Remove invalid total_deposited update from public.wallets.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADMIN APPROVE MERCHANT DEPOSIT RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_merchant_deposit_rpc(
    p_deposit_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_deposit RECORD;
    v_merchant RECORD;
    v_user_wallet RECORD;
    v_bal_before NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    SELECT * INTO v_deposit
    FROM public.merchant_deposits
    WHERE id = p_deposit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant deposit request not found';
    END IF;

    IF v_deposit.status = 'APPROVED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'deposit_id', v_deposit.id,
            'status', 'APPROVED',
            'idempotent', true,
            'net_credited', v_deposit.net_credited
        );
    END IF;

    IF v_deposit.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Deposit cannot be approved in status %', v_deposit.status;
    END IF;

    -- Resolve merchant & user_id
    SELECT * INTO v_merchant
    FROM public.merchants
    WHERE id = v_deposit.merchant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant not found for deposit %', v_deposit.merchant_id;
    END IF;

    -- Concurrency Lock on Authoritative Shared User Wallet
    SELECT * INTO v_user_wallet
    FROM public.wallets
    WHERE user_id = v_merchant.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found for user %', v_merchant.user_id;
    END IF;

    v_bal_before := v_user_wallet.available_balance;
    v_bal_after := v_bal_before + v_deposit.net_credited;

    -- Credit Authoritative Shared Wallet (public.wallets only tracks available_balance, reserved_balance, total_earned, total_withdrawn)
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_user_wallet.id;

    -- Update merchant_wallets record (where total_deposited exists and tracks cumulative float deposited)
    UPDATE public.merchant_wallets
    SET available_balance = v_bal_after,
        total_deposited = total_deposited + v_deposit.gross_amount,
        total_fees_paid = total_fees_paid + v_deposit.deposit_fee,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE merchant_id = v_deposit.merchant_id;

    -- Ledger entries in merchant_ledger_entries (immutable double-entry)
    INSERT INTO public.merchant_ledger_entries (
        merchant_id, wallet_id, amount, fee_amount, entry_type,
        reference_type, reference_id, idempotency_key,
        balance_before, balance_after, metadata
    ) VALUES 
    (
        v_deposit.merchant_id, v_user_wallet.id, v_deposit.net_credited, 0.00, 'DEPOSIT_CREDIT',
        'DEPOSIT', v_deposit.id::text, 'mch_dep_net_' || v_deposit.id::text,
        v_bal_before, v_bal_after,
        jsonb_build_object('gross', v_deposit.gross_amount, 'utr', v_deposit.utr_number)
    ),
    (
        v_deposit.merchant_id, v_user_wallet.id, -v_deposit.deposit_fee, v_deposit.deposit_fee, 'DEPOSIT_FEE',
        'DEPOSIT', v_deposit.id::text, 'mch_dep_fee_' || v_deposit.id::text,
        v_bal_after, v_bal_after,
        jsonb_build_object('fee', v_deposit.deposit_fee, 'utr', v_deposit.utr_number)
    );

    -- Also record in authoritative public.wallet_transactions
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
        v_merchant.user_id,
        v_user_wallet.id,
        v_deposit.net_credited,
        'CREDIT'::transaction_type,
        'SUCCESS'::transaction_status,
        'MANUAL_UPI_DEPOSIT',
        v_deposit.id::text,
        'tx_mch_dep_' || v_deposit.id::text,
        v_bal_before,
        v_bal_after,
        jsonb_build_object(
            'merchant_id', v_deposit.merchant_id,
            'utr_number', v_deposit.utr_number,
            'deposit_fee', v_deposit.deposit_fee,
            'gross_payable', v_deposit.gross_amount
        )
    );

    -- Update deposit record
    UPDATE public.merchant_deposits
    SET status = 'APPROVED',
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        reviewed_by = v_admin_uid,
        reviewed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_deposit.id;

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit.id,
        'deposit_amount', v_deposit.net_credited,
        'deposit_fee', v_deposit.deposit_fee,
        'total_payable', v_deposit.gross_amount,
        'net_credited', v_deposit.net_credited,
        'new_balance', v_bal_after,
        'status', 'APPROVED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 2. ADMIN REVIEW DEPOSIT RPC (WEBSITE WALLET DEPOSITS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_deposit_rpc(
    p_deposit_id UUID,
    p_action TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_deposit RECORD;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
BEGIN
    IF NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can review and approve deposits';
    END IF;

    IF p_action NOT IN ('APPROVE', 'REJECT') THEN
        RAISE EXCEPTION 'Invalid review action. Must be APPROVE or REJECT.';
    END IF;

    SELECT * INTO v_deposit
    FROM public.deposit_requests
    WHERE id = p_deposit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deposit request % not found', p_deposit_id;
    END IF;

    IF v_deposit.status != 'PENDING' THEN
        RAISE EXCEPTION 'Deposit request % is already processed with status %', p_deposit_id, v_deposit.status;
    END IF;

    v_idempotency_key := 'deposit_approve_' || p_deposit_id::text;

    IF p_action = 'APPROVE' THEN
        IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE idempotency_key = v_idempotency_key) THEN
            RAISE EXCEPTION 'Ledger transaction for deposit % already exists. Double-credit prevented.', p_deposit_id;
        END IF;

        -- Concurrency Lock on Authoritative Shared User Wallet
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_deposit.user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'User wallet not found for user %', v_deposit.user_id;
        END IF;

        v_balance_before := v_wallet.available_balance;
        v_balance_after := v_balance_before + v_deposit.amount;

        -- Credit authoritative wallet with exact deposit amount (public.wallets does not have total_deposited)
        UPDATE public.wallets
        SET available_balance = v_balance_after,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;

        -- Synchronize merchant_wallets in real-time
        UPDATE public.merchant_wallets
        SET available_balance = v_balance_after,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = v_deposit.user_id);

        -- Double-Entry Ledger Transaction Insertion
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
            v_deposit.user_id,
            v_wallet.id,
            v_deposit.amount,
            'CREDIT'::transaction_type,
            'SUCCESS'::transaction_status,
            'MANUAL_UPI_DEPOSIT',
            p_deposit_id::text,
            v_idempotency_key,
            v_balance_before,
            v_balance_after,
            jsonb_build_object(
                'utr_number', v_deposit.utr_number,
                'upi_id', v_deposit.upi_id,
                'deposit_amount', v_deposit.amount,
                'deposit_fee', v_deposit.deposit_fee,
                'total_payable', v_deposit.total_payable,
                'reviewed_by', v_admin_id,
                'admin_notes', p_notes
            )
        );

        UPDATE public.deposit_requests
        SET status = 'APPROVED',
            processed_by = v_admin_id,
            processed_at = TIMEZONE('utc'::text, NOW()),
            admin_notes = p_notes,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = p_deposit_id;

        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (
            v_deposit.user_id,
            'Deposit Approved',
            'Your manual UPI deposit of ₹' || v_deposit.amount || ' has been verified and credited to your wallet.',
            'SYSTEM',
            p_deposit_id::text
        );
    ELSE
        -- REJECT branch
        UPDATE public.deposit_requests
        SET status = 'REJECTED',
            processed_by = v_admin_id,
            processed_at = TIMEZONE('utc'::text, NOW()),
            admin_notes = p_notes,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = p_deposit_id;

        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (
            v_deposit.user_id,
            'Deposit Rejected',
            'Your manual UPI deposit of ₹' || v_deposit.amount || ' was rejected.' || CASE WHEN p_notes IS NOT NULL THEN ' Reason: ' || p_notes ELSE '' END,
            'SECURITY',
            p_deposit_id::text
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', p_deposit_id,
        'action', p_action,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
