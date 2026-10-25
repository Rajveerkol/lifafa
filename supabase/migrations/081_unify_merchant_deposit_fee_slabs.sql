-- ==============================================================================
-- MIGRATION 081: Unify Merchant Float Deposit Fee Slabs (Identical to Customer Slabs)
-- STATUS: NOT EXECUTED (FOR REVIEW ONLY - DO NOT APPLY WITHOUT AUTHORIZATION)
-- Target: Supabase SQL Editor / Migration Pipeline
-- ==============================================================================
-- Description:
--   Unifies the merchant float top-up fee calculations with the customer wallet fee rules:
--     - Deposit amounts < ₹100.00 are rejected (minimum float top-up ₹100.00).
--     - Deposit amounts ₹100.00 to ₹999.99: Flat ₹100.00 fee.
--     - Deposit amounts ₹1,000.00 and above: 2% of deposit amount.
--     - Total Payable (gross_amount) = Deposit Amount + Fee.
--     - Float Credited to Merchant (net_credited) = Deposit Amount.
--
-- Exact examples:
--   - ₹100 deposit   -> Fee ₹100 -> Paid ₹200   -> Net Credited ₹100
--   - ₹200 deposit   -> Fee ₹100 -> Paid ₹300   -> Net Credited ₹200
--   - ₹500 deposit   -> Fee ₹100 -> Paid ₹600   -> Net Credited ₹500
--   - ₹999 deposit   -> Fee ₹100 -> Paid ₹1,099 -> Net Credited ₹999
--   - ₹1,000 deposit -> Fee ₹20  -> Paid ₹1,020 -> Net Credited ₹1,000
--   - ₹2,000 deposit -> Fee ₹40  -> Paid ₹2,040 -> Net Credited ₹2,000
--   - ₹5,000 deposit -> Fee ₹100 -> Paid ₹5,100 -> Net Credited ₹5,000
--
-- Absolute Preservation of Financial Data:
--   - public.wallets is NEVER touched or dropped.
--   - public.merchant_wallets is NEVER touched or dropped.
--   - public.merchant_deposits existing records are completely preserved.
--   - public.admin_approve_merchant_deposit_rpc is completely preserved.
--   - No existing balances or pending requests are modified.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.merchant_submit_deposit_rpc(
    p_merchant_id UUID,
    p_gross_amount NUMERIC(12, 2),
    p_utr_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_clean_amount NUMERIC(12, 2);
    v_clean_utr TEXT;
    v_fee_amount NUMERIC(12, 2);
    v_total_payable NUMERIC(12, 2);
    v_net_credited NUMERIC(12, 2);
    v_deposit_id UUID;
BEGIN
    -- 1. Authorization check: caller must own active merchant or be service_role
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid AND status = 'ACTIVE'
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Access denied: caller does not own this active merchant account');
        END IF;
    END IF;

    -- 2. Validate deposit amount (Minimum ₹100.00, Maximum ₹5,00,000.00)
    v_clean_amount := ROUND(COALESCE(p_gross_amount, 0)::NUMERIC, 2);
    IF v_clean_amount < 100.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum float top-up amount is ₹100.00');
    END IF;

    IF v_clean_amount > 500000.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum float top-up amount per transaction is ₹5,00,000.00');
    END IF;

    -- 3. Clean and validate UTR
    v_clean_utr := UPPER(REGEXP_REPLACE(COALESCE(p_utr_number, ''), '[^A-Za-z0-9]', '', 'g'));
    IF LENGTH(v_clean_utr) < 6 OR LENGTH(v_clean_utr) > 30 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid UTR / reference number. Must be 6 to 30 alphanumeric characters.');
    END IF;

    -- 4. Check for duplicate UTR submissions across merchant deposits
    IF EXISTS (SELECT 1 FROM public.merchant_deposits WHERE utr_number = v_clean_utr) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Deposit request with this UTR number already exists');
    END IF;

    -- 5. Calculate Authoritative Fee Slabs (Identical to Customer Wallet):
    --    - Deposits ₹100.00 to ₹999.99: Flat ₹100.00 fee
    --    - Deposits ₹1,000.00 and above: 2% of deposit amount
    IF v_clean_amount < 1000.00 THEN
        v_fee_amount := 100.00;
    ELSE
        v_fee_amount := ROUND(v_clean_amount * 0.02, 2);
    END IF;

    v_total_payable := v_clean_amount + v_fee_amount;
    v_net_credited := v_clean_amount;
    v_deposit_id := gen_random_uuid();

    -- 6. Insert into public.merchant_deposits:
    --    gross_amount: Total money paid by merchant via UPI (v_total_payable)
    --    deposit_fee: Platform fee (v_fee_amount)
    --    net_credited: Net float credited to merchant wallet upon admin review (v_net_credited)
    INSERT INTO public.merchant_deposits (
        id,
        merchant_id,
        gross_amount,
        deposit_fee,
        net_credited,
        utr_number,
        status,
        admin_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
    ) VALUES (
        v_deposit_id,
        p_merchant_id,
        v_total_payable,
        v_fee_amount,
        v_net_credited,
        v_clean_utr,
        'PENDING',
        NULL,
        NULL,
        NULL,
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    );

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'deposit_amount', v_clean_amount,
        'fee', v_fee_amount,
        'total_payable', v_total_payable,
        'net_credited', v_net_credited,
        'utr_number', v_clean_utr,
        'status', 'PENDING',
        'message', 'Float deposit request submitted successfully. Awaiting administrator verification.'
    );
END;
$$;

-- 4. Permissions & Grants
REVOKE ALL ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) TO authenticated, service_role;
