-- ==============================================================================
-- MIGRATION 080: Resolve RPC Ambiguity & Establish Canonical submit_deposit_request_rpc
-- STATUS: NOT EXECUTED (FOR REVIEW ONLY - DO NOT APPLY WITHOUT AUTHORIZATION)
-- Target: Supabase SQL Editor / Migration Pipeline
-- ==============================================================================
-- Root Cause:
--   PostgreSQL catalog currently holds two conflicting overloads:
--     1) submit_deposit_request_rpc(p_amount NUMERIC, p_utr_number TEXT)
--     2) submit_deposit_request_rpc(p_amount NUMERIC, p_utr_number TEXT, p_payment_method TEXT DEFAULT 'UPI')
--   When called with (p_amount, p_utr_number), PostgreSQL cannot choose the candidate function
--   (PGRST203) because the 3-argument version has a default value for p_payment_method.
--   Furthermore, the 3-argument version attempted to insert into non-existent columns (fee_amount,
--   payment_method) and omitted the NOT NULL upi_id column.
--
-- Solution:
--   1. Drop both ambiguous overloads completely.
--   2. Re-create a single canonical function submit_deposit_request_rpc(NUMERIC, TEXT, TEXT DEFAULT 'UPI')
--      mapping to exact verified columns in public.deposit_requests:
--        - amount (wallet credit)
--        - deposit_fee (fee slab: flat ₹100 for <₹1000, 2% for >=₹1000)
--        - total_payable (amount + deposit_fee)
--        - upi_id (authoritative merchant UPI VPA from public.platform_settings)
--        - utr_number (verified 6-30 uppercase alphanumeric chars)
--        - gateway_provider (defaults to 'MANUAL_UPI' or p_payment_method)
--        - status ('PENDING')
--   3. Absolute data preservation:
--        - public.wallets is NEVER touched or dropped.
--        - public.merchant_wallets is NEVER touched or dropped.
--        - public.wallet_transactions is NEVER touched or dropped.
--        - public.deposit_requests existing rows are completely preserved.
--        - public.admin_review_deposit_rpc is completely preserved.
-- ==============================================================================

-- 1. Safely drop both existing conflicting overloads
DROP FUNCTION IF EXISTS public.submit_deposit_request_rpc(NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.submit_deposit_request_rpc(NUMERIC(12, 2), TEXT);
DROP FUNCTION IF EXISTS public.submit_deposit_request_rpc(NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_deposit_request_rpc(NUMERIC(12, 2), TEXT, TEXT);

-- 2. Create the single canonical RPC function
CREATE OR REPLACE FUNCTION public.submit_deposit_request_rpc(
    p_amount NUMERIC,
    p_utr_number TEXT,
    p_payment_method TEXT DEFAULT 'UPI'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_utr TEXT;
    v_clean_amount NUMERIC(12, 2);
    v_clean_method TEXT;
    v_authoritative_upi_id TEXT;
    v_deposit_id UUID;
    v_fee NUMERIC(12, 2);
    v_total_payable NUMERIC(12, 2);
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Authentication required to submit deposit request.'
        );
    END IF;

    -- 2. Validate and clean amount
    v_clean_amount := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
    IF v_clean_amount < 100.00 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Minimum deposit amount is ₹100.00.'
        );
    END IF;

    IF v_clean_amount > 100000.00 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Maximum deposit amount per transaction is ₹1,00,000.00.'
        );
    END IF;

    -- 3. Clean and validate UTR
    v_clean_utr := UPPER(REGEXP_REPLACE(COALESCE(p_utr_number, ''), '[^A-Za-z0-9]', '', 'g'));
    IF LENGTH(v_clean_utr) < 6 OR LENGTH(v_clean_utr) > 30 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid UTR / reference number. Must be 6 to 30 alphanumeric characters.'
        );
    END IF;

    -- 4. Check for duplicate UTR submissions
    IF EXISTS (SELECT 1 FROM public.deposit_requests WHERE utr_number = v_clean_utr) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This UTR number (' || v_clean_utr || ') has already been submitted. Please check your deposit history.'
        );
    END IF;

    -- 5. Retrieve authoritative UPI ID directly from platform_settings
    SELECT value INTO v_authoritative_upi_id
    FROM public.platform_settings
    WHERE key = 'DEPOSIT_UPI_ID';

    IF v_authoritative_upi_id IS NULL OR TRIM(v_authoritative_upi_id) = '' THEN
        v_authoritative_upi_id := 'createlifafa@upi';
    END IF;

    -- 6. Authoritative Deposit Fee Slabs:
    --    - Deposits ₹100.00 to ₹999.99: Flat fee of ₹100.00
    --    - Deposits ₹1,000.00 and above: 2% fee of deposit amount
    IF v_clean_amount < 1000.00 THEN
        v_fee := 100.00;
    ELSE
        v_fee := ROUND(v_clean_amount * 0.02, 2);
    END IF;
    v_total_payable := v_clean_amount + v_fee;

    v_clean_method := UPPER(COALESCE(NULLIF(TRIM(p_payment_method), ''), 'UPI'));

    -- 7. Insert into public.deposit_requests using verified schema columns:
    --    (user_id, amount, deposit_fee, total_payable, upi_id, utr_number, gateway_provider, status)
    INSERT INTO public.deposit_requests (
        user_id,
        amount,
        deposit_fee,
        total_payable,
        upi_id,
        utr_number,
        gateway_provider,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_clean_amount,
        v_fee,
        v_total_payable,
        v_authoritative_upi_id,
        v_clean_utr,
        v_clean_method,
        'PENDING',
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    )
    RETURNING id INTO v_deposit_id;

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'amount', v_clean_amount,
        'fee', v_fee,
        'total_payable', v_total_payable,
        'upi_id', v_authoritative_upi_id,
        'utr_number', v_clean_utr,
        'status', 'PENDING',
        'message', 'Deposit request submitted successfully. Awaiting administrator verification.'
    );
END;
$$;

-- 3. Restrict and grant execution permissions
REVOKE ALL ON FUNCTION public.submit_deposit_request_rpc(NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_deposit_request_rpc(NUMERIC, TEXT, TEXT) TO authenticated, service_role;
