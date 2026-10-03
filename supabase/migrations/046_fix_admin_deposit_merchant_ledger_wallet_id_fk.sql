-- ==============================================================================
-- Migration: 046_fix_admin_deposit_merchant_ledger_wallet_id_fk.sql
-- Description: Fix "merchant_ledger_entries_wallet_id_fkey" foreign key violation
--              when approving Gateway merchant deposits.
--
-- Foreign Key Analysis:
--   Table: public.merchant_ledger_entries
--   Constraint: merchant_ledger_entries_wallet_id_fkey
--   Column: wallet_id UUID NOT NULL
--   Referenced Table: public.merchant_wallets(id) ON DELETE RESTRICT
--   
-- Root Cause:
--   In admin_approve_merchant_deposit_rpc (migrations 044 & 045), the INSERT into
--   public.merchant_ledger_entries passed `v_user_wallet.id` (which is a UUID from
--   public.wallets, the user wallet table).
--   Because public.merchant_ledger_entries.wallet_id has an FK referencing
--   public.merchant_wallets(id), PostgreSQL raised a foreign key constraint violation:
--     insert or update on table "merchant_ledger_entries" violates foreign key constraint
--     "merchant_ledger_entries_wallet_id_fkey"
--
-- Fix:
--   1. Explicitly lock and resolve the merchant's gateway wallet (v_mch_wallet)
--      from public.merchant_wallets FOR UPDATE (with defensive initialization if absent).
--   2. Pass `v_mch_wallet.id` to public.merchant_ledger_entries.wallet_id.
--   3. Pass `v_user_wallet.id` to public.wallet_transactions.wallet_id (which references
--      public.wallets(id)).
--   4. Preserve all existing financial logic:
--      - 2% deposit fee
--      - Gross = requested deposit + 2% fee
--      - Net = requested wallet credit amount
--      - Authoritative balance update in public.wallets
--      - Cumulative total_deposited update in public.merchant_wallets
--      - FOR UPDATE row-level locking & idempotency guards
-- ==============================================================================

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
    v_mch_wallet RECORD;
    v_bal_before NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    -- 1. Authorization check
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    -- 2. Concurrency lock on deposit record
    SELECT * INTO v_deposit
    FROM public.merchant_deposits
    WHERE id = p_deposit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant deposit request not found';
    END IF;

    -- Idempotency check
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

    -- 3. Resolve merchant details
    SELECT * INTO v_merchant
    FROM public.merchants
    WHERE id = v_deposit.merchant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant not found for deposit %', v_deposit.merchant_id;
    END IF;

    -- 4. Concurrency lock on Authoritative Shared User Wallet (public.wallets)
    SELECT * INTO v_user_wallet
    FROM public.wallets
    WHERE user_id = v_merchant.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Authoritative user wallet not found for merchant owner %', v_merchant.user_id;
    END IF;

    -- 5. Concurrency lock on Merchant Gateway Wallet (public.merchant_wallets)
    SELECT * INTO v_mch_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = v_deposit.merchant_id
    FOR UPDATE;

    v_bal_before := v_user_wallet.available_balance;
    v_bal_after := v_bal_before + v_deposit.net_credited;

    -- 6. Credit Authoritative Shared Wallet (public.wallets)
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_user_wallet.id;

    -- 7. Update Merchant Gateway Wallet (public.merchant_wallets)
    IF v_mch_wallet.id IS NOT NULL THEN
        UPDATE public.merchant_wallets
        SET available_balance = v_bal_after,
            total_deposited = total_deposited + v_deposit.gross_amount,
            total_fees_paid = total_fees_paid + v_deposit.deposit_fee,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_mch_wallet.id;
    ELSE
        -- Defensive fallback if merchant_wallets record was missing
        INSERT INTO public.merchant_wallets (
            merchant_id, available_balance, locked_payout_balance,
            total_deposited, total_paid_out, total_fees_paid,
            created_at, updated_at
        ) VALUES (
            v_deposit.merchant_id, v_bal_after, 0.00,
            v_deposit.gross_amount, 0.00, v_deposit.deposit_fee,
            TIMEZONE('utc'::text, NOW()), TIMEZONE('utc'::text, NOW())
        ) RETURNING * INTO v_mch_wallet;
    END IF;

    -- 8. Immutable Double-Entry Ledger in public.merchant_ledger_entries
    --    FK constraint requires wallet_id -> public.merchant_wallets(id)
    INSERT INTO public.merchant_ledger_entries (
        merchant_id,
        wallet_id,
        amount,
        fee_amount,
        entry_type,
        reference_type,
        reference_id,
        idempotency_key,
        balance_before,
        balance_after,
        metadata
    ) VALUES 
    (
        v_deposit.merchant_id,
        v_mch_wallet.id,            -- Correct: matches FK to public.merchant_wallets(id)
        v_deposit.net_credited,
        0.00,
        'DEPOSIT_CREDIT',
        'DEPOSIT',
        v_deposit.id::text,
        'mch_dep_net_' || v_deposit.id::text,
        v_bal_before,
        v_bal_after,
        jsonb_build_object('gross', v_deposit.gross_amount, 'utr', v_deposit.utr_number)
    ),
    (
        v_deposit.merchant_id,
        v_mch_wallet.id,            -- Correct: matches FK to public.merchant_wallets(id)
        -v_deposit.deposit_fee,
        v_deposit.deposit_fee,
        'DEPOSIT_FEE',
        'DEPOSIT',
        v_deposit.id::text,
        'mch_dep_fee_' || v_deposit.id::text,
        v_bal_after,
        v_bal_after,
        jsonb_build_object('fee', v_deposit.deposit_fee, 'utr', v_deposit.utr_number)
    );

    -- 9. Authoritative Audit Transaction in public.wallet_transactions
    --    FK constraint requires wallet_id -> public.wallets(id)
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
        v_user_wallet.id,           -- Correct: matches FK to public.wallets(id)
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

    -- 10. Update Deposit Status to APPROVED
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
