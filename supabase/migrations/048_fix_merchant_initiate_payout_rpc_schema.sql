-- ==============================================================================
-- Migration: 048_fix_merchant_initiate_payout_rpc_schema.sql
-- Description: Production Fix for Merchant Gateway Payout RPC Schema Alignment
--              Removes non-existent encrypted bank account column from
--              public.merchant_payouts INSERT statement in
--              public.merchant_initiate_payout_rpc.
--
--              PRESERVES:
--              1. Strict UPI-Only Architecture (IMPS / Bank Account rejected).
--              2. Authoritative Unified Tiered Fee Slabs:
--                 - ₹1.00 to ₹500.00        -> ₹2.50
--                 - Above ₹500.00 to ₹1,000 -> ₹2.70
--                 - Above ₹1,000 to ₹5,000  -> ₹3.50
--              3. Shared Single Wallet architecture (public.wallets balance lock).
--              4. Merchant Gateway float tracking (public.merchant_wallets).
--              5. Double-entry ledger entries in public.merchant_ledger_entries.
--              6. Authoritative transaction records in public.wallet_transactions.
--              7. Strict input validation, idempotency guard, and DUPMAX-safe regex.
-- Status: MANUAL REVIEW ONLY — DO NOT EXECUTE AUTOMATICALLY
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.merchant_initiate_payout_rpc(
    p_merchant_id UUID,
    p_order_id TEXT,
    p_amount NUMERIC(12, 2),
    p_payout_method TEXT DEFAULT 'UPI',
    p_upi_id TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
    v_existing_status TEXT;
    v_user_wallet RECORD;
    v_mch_wallet RECORD;
    v_fee NUMERIC(12, 2);
    v_total_deducted NUMERIC(12, 2);
    v_payout_id UUID;
    v_provider_order_id TEXT;
    v_clean_upi TEXT := NULL;
    v_idem_key TEXT;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
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

    -- E. UPI ID Validation (Spencer POSIX Regex DUPMAX=255 safe)
    IF p_upi_id IS NULL OR LENGTH(TRIM(p_upi_id)) < 3 THEN
        RAISE EXCEPTION 'A valid UPI ID is required for payout';
    END IF;
    v_clean_upi := LOWER(TRIM(p_upi_id));
    IF NOT (v_clean_upi ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$') THEN
        RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
    END IF;

    -- F. Authoritative Server-Side Fee Slab Calculation (Unified with Website Wallet):
    --    ₹1.00 to ₹500.00         -> ₹2.50
    --    Above ₹500.00 to ₹1,000  -> ₹2.70
    --    Above ₹1,000 to ₹5,000   -> ₹3.50
    IF p_amount <= 500.00 THEN
        v_fee := 2.50;
    ELSIF p_amount <= 1000.00 THEN
        v_fee := 2.70;
    ELSE
        v_fee := 3.50;
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
            'status', v_existing_status
        );
    END IF;

    -- H. SHARED WALLET LOCK & DEBIT:
    --    Lock the authoritative single user wallet in public.wallets
    SELECT * INTO v_user_wallet
    FROM public.wallets
    WHERE user_id = v_merchant.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Authoritative user wallet not found for merchant owner %', v_merchant.user_id;
    END IF;

    IF v_user_wallet.available_balance < v_total_deducted THEN
        RAISE EXCEPTION 'Insufficient available balance. Required: ₹% (Payout ₹% + Fee ₹%), Available: ₹%',
            v_total_deducted, p_amount, v_fee, v_user_wallet.available_balance;
    END IF;

    -- Also lock merchant_wallets row
    SELECT * INTO v_mch_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = p_merchant_id
    FOR UPDATE;

    v_bal_before := v_user_wallet.available_balance;
    v_bal_mid := v_bal_before - p_amount;
    v_bal_after := v_bal_before - v_total_deducted;

    -- Debit authoritative user wallet
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_user_wallet.id;

    -- Keep merchant_wallets synchronized & track in-transit locked float
    IF v_mch_wallet.id IS NOT NULL THEN
        UPDATE public.merchant_wallets
        SET available_balance = v_bal_after,
            locked_payout_balance = locked_payout_balance + v_total_deducted,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_mch_wallet.id;
    END IF;

    -- I. Insert Payout Record (Only existing columns are specified)
    v_provider_order_id := 'ORD_' || p_merchant_id::text || '_' || TRIM(p_order_id) || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;

    INSERT INTO public.merchant_payouts (
        merchant_id,
        order_id,
        amount,
        fee_amount,
        total_deducted,
        status,
        payout_method,
        upi_id,
        bank_account_number_masked,
        ifsc_code,
        account_holder_name,
        payout_provider,
        provider_order_id,
        idempotency_key
    ) VALUES (
        p_merchant_id,
        TRIM(p_order_id),
        p_amount,
        v_fee,
        v_total_deducted,
        'PENDING',
        'UPI',
        v_clean_upi,
        NULL,
        NULL,
        COALESCE(NULLIF(TRIM(p_account_holder_name), ''), 'UPI Beneficiary'),
        'PAYNIT',
        v_provider_order_id,
        v_idem_key
    ) RETURNING id INTO v_payout_id;

    -- J. Double-Entry Float Ledger Entries in merchant_ledger_entries
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
            v_idem_key || '_lock_principal',
            v_bal_before,
            v_bal_mid,
            jsonb_build_object('order_id', TRIM(p_order_id), 'provider_order_id', v_provider_order_id, 'method', 'UPI')
        ),
        (
            p_merchant_id,
            v_mch_wallet.id,
            -v_fee,
            v_fee,
            'PAYOUT_FEE_LOCK',
            'PAYOUT',
            v_payout_id::text,
            v_idem_key || '_lock_fee',
            v_bal_mid,
            v_bal_after,
            jsonb_build_object('order_id', TRIM(p_order_id), 'provider_order_id', v_provider_order_id, 'method', 'UPI')
        );
    END IF;

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
    ) VALUES
    (
        v_merchant.user_id,
        v_user_wallet.id,
        -p_amount,
        'WITHDRAWAL',
        'PENDING',
        'MERCHANT_PAYOUT',
        v_payout_id::text,
        'tx_mch_' || v_idem_key,
        v_bal_before,
        v_bal_mid,
        jsonb_build_object('merchant_id', p_merchant_id, 'order_id', TRIM(p_order_id), 'upi_id', v_clean_upi)
    ),
    (
        v_merchant.user_id,
        v_user_wallet.id,
        -v_fee,
        'FEE',
        'PENDING',
        'MERCHANT_PAYOUT_FEE',
        v_payout_id::text,
        'tx_mch_fee_' || v_idem_key,
        v_bal_mid,
        v_bal_after,
        jsonb_build_object('merchant_id', p_merchant_id, 'order_id', TRIM(p_order_id), 'fee', v_fee)
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'provider_order_id', v_provider_order_id,
        'amount', p_amount,
        'fee', v_fee,
        'total_debited', v_total_deducted,
        'total_deducted', v_total_deducted,
        'payout_method', 'UPI',
        'payout_provider', 'PAYNIT',
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
