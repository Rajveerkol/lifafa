-- ==============================================================================
-- Migration: 041_fix_merchant_payout_schema_columns.sql
-- Description: Production Fix for Merchant Payout RPC Schema Alignment
--              Removes non-existent column 'bank_account_encrypted' from
--              public.merchant_payouts INSERT statement.
--              (bank_account_encrypted was an isolated table in merchant gateway,
--               never a column on public.merchant_payouts).
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
    v_existing_status TEXT;
    v_wallet RECORD;
    v_min_payout NUMERIC(12, 2);
    v_max_payout NUMERIC(12, 2);
    v_fee NUMERIC(12, 2) := 2.50; -- MANDATORY FLAT ₹2.50 FEE
    v_total_deducted NUMERIC(12, 2);
    v_payout_id UUID;
    v_provider_order_id TEXT;
    v_clean_upi TEXT := NULL;
    v_idem_key TEXT;
    v_bal_before NUMERIC(12, 2);
    v_bal_mid NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
BEGIN
    -- A. Strict UPI-Only Architecture Enforcement: Reject IMPS / Bank Account parameters
    IF (p_payout_method IS NOT NULL AND UPPER(TRIM(p_payout_method)) = 'IMPS')
       OR (p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> '') THEN
        RAISE EXCEPTION 'IMPS and bank account payouts are no longer supported. All merchant payouts are processed via UPI only.';
    END IF;

    -- B. Authorization check: Target merchant must be ACTIVE and have PAID setup fee
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE' 
          AND setup_fee_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active or setup fee is unpaid/pending approval';
    END IF;

    -- C. Merchant Isolation: If caller is authenticated user, verify ownership
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    -- D. Input Validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payout amount must be greater than zero';
    END IF;

    SELECT COALESCE(value::NUMERIC, 1.00) INTO v_min_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MIN_PAYOUT_AMOUNT';
    IF v_min_payout IS NULL THEN v_min_payout := 1.00; END IF;

    SELECT COALESCE(value::NUMERIC, 1000.00) INTO v_max_payout
    FROM public.platform_settings WHERE key = 'MERCHANT_MAX_PAYOUT_AMOUNT';
    IF v_max_payout IS NULL THEN v_max_payout := 1000.00; END IF;

    IF p_amount < v_min_payout THEN
        RAISE EXCEPTION 'Payout amount % is below minimum allowed %', p_amount, v_min_payout;
    END IF;
    IF p_amount > v_max_payout THEN
        RAISE EXCEPTION 'Payout amount % exceeds maximum allowed %', p_amount, v_max_payout;
    END IF;

    -- E. UPI ID Validation (Spencer POSIX Regex DUPMAX=255 safe)
    IF p_upi_id IS NULL OR LENGTH(TRIM(p_upi_id)) < 3 THEN
        RAISE EXCEPTION 'A valid UPI ID is required for payout';
    END IF;
    v_clean_upi := LOWER(TRIM(p_upi_id));
    IF NOT (v_clean_upi ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$') THEN
        RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
    END IF;

    -- F. Mandatory Authoritative Fee Calculation: Flat ₹2.50
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

    -- H. Float Wallet Lock & Debit (Locks principal + flat fee into locked_payout_balance)
    SELECT * INTO v_wallet
    FROM public.merchant_wallets
    WHERE merchant_id = p_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant wallet not found';
    END IF;

    IF v_wallet.available_balance < v_total_deducted THEN
        RAISE EXCEPTION 'Insufficient float balance. Required: % (Payout % + Fee %), Available: %',
            v_total_deducted, p_amount, v_fee, v_wallet.available_balance;
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_mid := v_bal_before - p_amount;
    v_bal_after := v_bal_before - v_total_deducted;

    UPDATE public.merchant_wallets
    SET available_balance = available_balance - v_total_deducted,
        locked_payout_balance = locked_payout_balance + v_total_deducted,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- I. Insert Payout Record with ONLY valid public.merchant_payouts columns
    -- NOTE: bank_account_encrypted does NOT exist on merchant_payouts and is omitted.
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

    -- J. Double-Entry Float Ledger Entries (Strict Schema & Check Constraints)
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
        v_wallet.id,
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
        v_wallet.id,
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

-- 4. PERMISSIONS
REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
