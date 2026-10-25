-- ==============================================================================
-- MIGRATION 079: Update Deposit Fee Slabs (₹100 Flat for <₹1000, 2% for >=₹1000)
-- STATUS: NOT EXECUTED (FOR REVIEW ONLY - DO NOT APPLY WITHOUT AUTHORIZATION)
-- Target: Supabase SQL Editor / Migration Pipeline
-- ==============================================================================
-- 1. Updates public.submit_deposit_request_rpc to enforce authoritative fee slabs:
--      - Minimum deposit amount: ₹100.00 (rejects amounts < ₹100.00).
--      - Deposits ₹100.00 to ₹999.99: Flat fee of ₹100.00.
--      - Deposits ₹1,000.00 and above: 2% of deposit amount.
--      - Total Payable = Deposit Amount + Fee.
--      - Wallet Credit = Deposit Amount.
-- 2. ABSOLUTE PRESERVATION OF FINANCIAL DATA:
--      - public.wallets is NEVER touched or dropped.
--      - public.deposit_requests is completely preserved with all existing records intact.
--      - public.wallet_transactions (ledger) is completely preserved.
--      - public.admin_review_deposit_rpc is completely preserved.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.submit_deposit_request_rpc(
    p_amount NUMERIC(12, 2),
    p_utr_number TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_utr TEXT;
    v_authoritative_upi_id TEXT;
    v_deposit_id UUID;
    v_fee NUMERIC(12, 2);
    v_total_payable NUMERIC(12, 2);
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit deposit request';
    END IF;

    -- 2. Amount boundary validation (Minimum ₹100.00, Maximum ₹1,00,000.00)
    IF p_amount IS NULL OR p_amount < 100.00 THEN
        RAISE EXCEPTION 'Deposit amount must be at least ₹100.00';
    END IF;

    IF p_amount > 100000.00 THEN
        RAISE EXCEPTION 'Maximum deposit amount per transaction is ₹1,00,000.00';
    END IF;

    -- 3. UTR format and length validation
    v_clean_utr := UPPER(TRIM(p_utr_number));
    IF v_clean_utr IS NULL OR LENGTH(v_clean_utr) < 6 OR LENGTH(v_clean_utr) > 30 THEN
        RAISE EXCEPTION 'Invalid UTR/Transaction reference number. Must be 6-30 alphanumeric characters.';
    END IF;

    -- 4. Check for duplicate UTR submissions
    IF EXISTS (SELECT 1 FROM public.deposit_requests WHERE utr_number = v_clean_utr) THEN
        RAISE EXCEPTION 'This UTR number (%) has already been submitted. Please check your deposit history.', v_clean_utr;
    END IF;

    -- 5. Authoritative UPI ID retrieval directly from platform_settings
    SELECT value INTO v_authoritative_upi_id
    FROM public.platform_settings
    WHERE key = 'DEPOSIT_UPI_ID';

    IF v_authoritative_upi_id IS NULL OR TRIM(v_authoritative_upi_id) = '' THEN
        v_authoritative_upi_id := 'createlifafa@upi';
    END IF;

    -- 6. Authoritative Fee Calculation:
    --    - ₹100 to ₹999.99  -> Flat ₹100.00 fee
    --    - ₹1,000 and above -> 2% of deposit amount
    --    Total Payable = Deposit Amount + Fee
    --    Wallet Credit = Deposit Amount
    IF p_amount < 1000.00 THEN
        v_fee := 100.00;
    ELSE
        v_fee := ROUND(p_amount * 0.02, 2);
    END IF;

    v_total_payable := p_amount + v_fee;

    -- 7. Record deposit request with PENDING status
    INSERT INTO public.deposit_requests (
        user_id,
        amount,
        deposit_fee,
        total_payable,
        upi_id,
        utr_number,
        status
    ) VALUES (
        v_user_id,
        p_amount,
        v_fee,
        v_total_payable,
        v_authoritative_upi_id,
        v_clean_utr,
        'PENDING'
    )
    RETURNING id INTO v_deposit_id;

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'amount', p_amount,
        'deposit_fee', v_fee,
        'total_payable', v_total_payable,
        'upi_id', v_authoritative_upi_id,
        'utr_number', v_clean_utr,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp;

-- Permissions
REVOKE ALL ON FUNCTION public.submit_deposit_request_rpc(NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_deposit_request_rpc(NUMERIC, TEXT) TO authenticated, service_role;
