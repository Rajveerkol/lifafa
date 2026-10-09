-- ==============================================================================
-- MIGRATION 071: FIX MERCHANT INITIATE PAYOUT RPC WALLETS COLUMN
-- ==============================================================================
-- SQL STATUS: NOT EXECUTED — AWAITING MANUAL EXECUTION
--
-- ROOT CAUSE:
-- In Migration 069, merchant_initiate_payout_rpc attempted to execute:
--   UPDATE public.wallets SET total_fees_paid = total_fees_paid + v_fee
-- However, public.wallets has NO "total_fees_paid" column (that column exists
-- on public.merchant_wallets). This caused PostgreSQL runtime error:
--   column "total_fees_paid" does not exist (HTTP 400)
--
-- FIX:
-- 1. Updates public.wallets: available_balance and total_withdrawn (+ p_amount).
-- 2. Preserves public.merchant_wallets: available_balance and locked_payout_balance.
-- 3. Retains authoritative global fee slabs:
--      ₹1.00 - ₹499.99   -> ₹2.50
--      ₹500.00 - ₹999.99 -> ₹5.00
--      ₹1,000.00+        -> ₹10.00
-- 4. Full double-entry audit logging in merchant_ledger_entries and wallet_transactions.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.merchant_initiate_payout_rpc(
    p_merchant_id UUID,
    p_order_id TEXT,
    p_amount NUMERIC(12, 2),
    p_payout_method TEXT,
    p_upi_id TEXT,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
    v_user_wallet RECORD;
    v_mch_wallet RECORD;
    v_clean_upi TEXT;
    v_fee NUMERIC(12, 2);
    v_total_deducted NUMERIC(12, 2);
    v_idem_key TEXT;
    v_payout_id UUID;
    v_existing_status TEXT;
    v_provider_order_id TEXT;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
    v_timestamp_ms BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
    -- A. Strict UPI-Only Architecture Enforcement
    IF (p_payout_method IS NOT NULL AND UPPER(TRIM(p_payout_method)) = 'IMPS')
       OR (p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> '') THEN
        RAISE EXCEPTION 'IMPS and bank account payouts are no longer supported. All merchant payouts are processed via UPI only.';
    END IF;

    -- B. Authorization check: Target merchant must be ACTIVE and have PAID setup fee
    SELECT * INTO v_merchant
    FROM public.merchants
    WHERE id = p_merchant_id;

    IF NOT FOUND OR v_merchant.status <> 'ACTIVE' OR v_merchant.setup_fee_status <> 'PAID' THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or setup fee is unpaid/pending approval';
    END IF;

    -- C. Ownership verification for user callers
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF v_merchant.user_id <> v_caller_uid THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    -- D. Input Validation & Limits (₹1.00 min, ₹5,000.00 max)
    IF p_amount IS NULL OR p_amount < 1.00 THEN
        RAISE EXCEPTION 'Payout amount must be at least ₹1.00';
    END IF;

    IF p_amount > 5000.00 THEN
        RAISE EXCEPTION 'Payout amount % exceeds maximum allowed ₹5,000.00', p_amount;
    END IF;

    -- E. UPI ID Validation (Spencer POSIX Regex safe)
    IF p_upi_id IS NULL OR LENGTH(TRIM(p_upi_id)) < 3 THEN
        RAISE EXCEPTION 'A valid UPI ID is required for payout';
    END IF;
    v_clean_upi := LOWER(TRIM(p_upi_id));
    IF NOT (v_clean_upi ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$') THEN
        RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
    END IF;

    -- F. Authoritative Server-Side Fee Slab Calculation:
    --    ₹1.00 to ₹499.99         -> ₹2.50
    --    ₹500.00 to ₹999.99       -> ₹5.00
    --    ₹1,000.00 to ₹2,000.00   -> ₹10.00
    --    Above ₹2,000.00          -> ₹10.00
    IF p_amount < 500.00 THEN
        v_fee := 2.50;
    ELSIF p_amount < 1000.00 THEN
        v_fee := 5.00;
    ELSE
        v_fee := 10.00;
    END IF;

    v_total_deducted := p_amount + v_fee;

    -- G. Idempotency Guard
    v_idem_key := COALESCE(p_idempotency_key, 'mch_idem_' || p_merchant_id::text || '_' || TRIM(p_order_id));

    SELECT id, status, provider_order_id INTO v_payout_id, v_existing_status, v_provider_order_id
    FROM public.merchant_payouts
    WHERE idempotency_key = v_idem_key OR (merchant_id = p_merchant_id AND order_id = TRIM(p_order_id));

    IF v_payout_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'payout_id', v_payout_id,
            'provider_order_id', v_provider_order_id,
            'status', v_existing_status,
            'amount', p_amount,
            'fee', v_fee,
            'total_deducted', v_total_deducted
        );
    END IF;

    -- H. SHARED WALLET LOCK & DEBIT:
    SELECT * INTO v_user_wallet
    FROM public.wallets
    WHERE user_id = v_merchant.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Authoritative user wallet not found for merchant owner %', v_merchant.user_id;
    END IF;

    IF v_user_wallet.available_balance < v_total_deducted THEN
        RAISE EXCEPTION 'Insufficient float balance. Available: ₹%, Required: ₹% (Payout ₹% + Fee ₹%)',
            v_user_wallet.available_balance, v_total_deducted, p_amount, v_fee;
    END IF;

    SELECT * INTO v_mch_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = p_merchant_id
    FOR UPDATE;

    v_bal_before := v_user_wallet.available_balance;
    v_bal_mid := v_bal_before - p_amount;
    v_bal_after := v_bal_before - v_total_deducted;

    -- 1. Deduct authoritative single user wallet (CORRECTED: total_withdrawn, NOT total_fees_paid)
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_user_wallet.id;

    -- 2. Keep merchant_wallets view strictly synchronized
    IF v_mch_wallet.id IS NOT NULL THEN
        UPDATE public.merchant_wallets
        SET available_balance = v_bal_after,
            locked_payout_balance = locked_payout_balance + v_total_deducted,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_mch_wallet.id;
    END IF;

    -- I. Generate Provider Order ID
    v_provider_order_id := 'PO-' || UPPER(SUBSTRING(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));

    -- J. Insert merchant_payouts record
    INSERT INTO public.merchant_payouts (
        merchant_id,
        order_id,
        provider_order_id,
        amount,
        fee_amount,
        total_deducted,
        payout_method,
        upi_id,
        account_holder_name,
        bank_account_number_masked,
        ifsc_code,
        status,
        idempotency_key
    ) VALUES (
        p_merchant_id,
        TRIM(p_order_id),
        v_provider_order_id,
        p_amount,
        v_fee,
        v_total_deducted,
        'UPI',
        v_clean_upi,
        p_account_holder_name,
        NULL,
        NULL,
        'PENDING',
        v_idem_key
    ) RETURNING id INTO v_payout_id;

    -- K. Double-Entry Audit Ledger in merchant_ledger_entries
    IF v_mch_wallet.id IS NOT NULL THEN
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
            p_merchant_id,
            v_mch_wallet.id,
            -p_amount,
            0.00,
            'PAYOUT_LOCK',
            'PAYOUT',
            v_payout_id::text,
            'mch_py_lock_amt_' || v_idem_key,
            v_bal_before,
            v_bal_mid,
            jsonb_build_object('order_id', TRIM(p_order_id), 'fee', v_fee, 'method', 'UPI')
        ),
        (
            p_merchant_id,
            v_mch_wallet.id,
            -v_fee,
            0.00,
            'PAYOUT_FEE_LOCK',
            'PAYOUT',
            v_payout_id::text,
            'mch_py_lock_fee_' || v_idem_key,
            v_bal_mid,
            v_bal_after,
            jsonb_build_object('order_id', TRIM(p_order_id), 'fee', v_fee, 'method', 'UPI')
        );
    END IF;

    -- L. Wallet Transactions Double-Entry Audit
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
    ) VALUES
    (
        v_merchant.user_id,
        v_user_wallet.id,
        p_amount,
        'WITHDRAWAL',
        'PENDING',
        'MERCHANT_PAYOUT',
        v_payout_id::text,
        'tx_mch_lock_amt_' || v_idem_key,
        v_bal_before,
        v_bal_mid,
        jsonb_build_object('order_id', TRIM(p_order_id), 'fee', v_fee, 'method', 'UPI')
    ),
    (
        v_merchant.user_id,
        v_user_wallet.id,
        v_fee,
        'PLATFORM_FEE',
        'SUCCESS',
        'MERCHANT_PAYOUT_FEE',
        v_payout_id::text,
        'tx_mch_lock_fee_' || v_idem_key,
        v_bal_mid,
        v_bal_after,
        jsonb_build_object('order_id', TRIM(p_order_id), 'fee', v_fee, 'method', 'UPI')
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'provider_order_id', v_provider_order_id,
        'order_id', TRIM(p_order_id),
        'status', 'PENDING',
        'amount', p_amount,
        'fee', v_fee,
        'total_deducted', v_total_deducted
    );
END;
$$;

-- Security Grants
REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
