-- ==============================================================================
-- MIGRATION 069: UPDATE GLOBAL TRANSACTION FEE STRUCTURE ACROSS ALL MODULES
-- ==============================================================================
-- SQL STATUS: NOT EXECUTED — AWAITING MANUAL EXECUTION
--
-- PURPOSE:
-- 1. Updates the global transaction fee structure across all modules:
--    - ₹1.00 to ₹499.99         -> Fixed Charge = ₹2.50
--    - ₹500.00 to ₹999.99       -> Fixed Charge = ₹5.00
--    - ₹1,000.00 to ₹2,000.00   -> Fixed Charge = ₹10.00
--    - Above ₹2,000.00 (up to platform max limit ₹5,000.00) -> Fixed Charge = ₹10.00
--
-- 2. Affected Database Objects & Signatures:
--    - FUNCTION public.get_lifafa_payout_fee(NUMERIC)
--      -> Used by create_lifafa_rpc (escrow calculation) & claim_lifafa_rpc (escrow consumption).
--    - FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT)
--      -> Used by consumer website wallet withdrawals via PayNit UPI.
--    - FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
--      -> Used by Merchant Gateway outbound disbursements via PayNit UPI.
--    - TABLE public.platform_settings
--      -> Authoritative configuration rows for fee slab tiers.
--
-- 3. Historical Transaction Protection:
--    - All existing transactions, ledger records, past withdrawals, and existing Lifafa
--      escrows retain their recorded historical fee amounts (fee_amount / remaining_fee_amount).
--    - Zero retroactive recalculation or debit/credit.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTHORITATIVE SERVER-SIDE LIFAFA PAYOUT FEE FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lifafa_payout_fee(p_amount NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    IF p_amount IS NULL OR p_amount <= 0.00 THEN
        RETURN 0.00;
    ELSIF p_amount < 500.00 THEN
        RETURN 2.50;
    ELSIF p_amount < 1000.00 THEN
        RETURN 5.00;
    ELSE
        RETURN 10.00;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.get_lifafa_payout_fee(NUMERIC) TO PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. UPDATE PLATFORM SETTINGS CONFIGURATION
-- ------------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('WITHDRAWAL_FEE_SLAB_1_MAX', '499.99', 'Upper bound for Tier 1 transaction fee'),
    ('WITHDRAWAL_FEE_SLAB_1', '2.50', 'Fixed fee for transactions <= ₹499.99'),
    ('WITHDRAWAL_FEE_SLAB_2_MAX', '999.99', 'Upper bound for Tier 2 transaction fee'),
    ('WITHDRAWAL_FEE_SLAB_2', '5.00', 'Fixed fee for transactions ₹500.00 to ₹999.99'),
    ('WITHDRAWAL_FEE_SLAB_3_MAX', '2000.00', 'Upper bound for Tier 3 transaction fee'),
    ('WITHDRAWAL_FEE_SLAB_3', '10.00', 'Fixed fee for transactions ₹1,000.00 to ₹2,000.00')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = TIMEZONE('utc'::text, NOW());

-- ------------------------------------------------------------------------------
-- 3. CONSUMER WALLET WITHDRAWAL RPC (NEW FEE STRUCTURE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal_rpc(
    p_amount NUMERIC(12, 2),
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_fee NUMERIC(12, 2);
    v_payout_amount NUMERIC(12, 2);
    v_total_deduction NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_clean_upi TEXT := NULL;
    v_account_name TEXT := NULL;
    v_balance_before NUMERIC(12, 2);
    v_balance_mid NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_key TEXT;
    v_blocked_amount NUMERIC(12, 2) := 0.00;
    v_withdrawable_balance NUMERIC(12, 2) := 0.00;
    v_remaining_to_allocate NUMERIC(12, 2);
    v_claim_rec RECORD;
    v_alloc_from_claim NUMERIC(12, 2);
    v_profile_name TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to withdraw';
    END IF;

    -- A. Strict UPI-Only Architecture Enforcement
    IF p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> '' THEN
        RAISE EXCEPTION 'Bank account (IMPS) withdrawals are no longer supported. All withdrawals are processed via UPI only.';
    END IF;

    -- B. Validate UPI ID
    IF p_upi_id IS NULL OR TRIM(p_upi_id) = '' THEN
        RAISE EXCEPTION 'A valid UPI ID is required for withdrawal.';
    END IF;

    v_clean_upi := LOWER(TRIM(p_upi_id));
    IF NOT (v_clean_upi ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$') THEN
        RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
    END IF;

    -- C. Enforce Server-Side Withdrawal Limits (₹1.00 min, ₹5,000.00 max)
    IF p_amount IS NULL OR p_amount < 1.00 THEN
        RAISE EXCEPTION 'Minimum withdrawal amount is ₹1.00';
    END IF;

    IF p_amount > 5000.00 THEN
        RAISE EXCEPTION 'Maximum withdrawal amount is ₹5,000.00';
    END IF;

    -- Beneficiary name fallback
    SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
    v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Beneficiary');

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- D. Idempotency Check
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- E. Authoritative Server-Side Fee Slab Calculation:
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

    v_payout_amount := p_amount;
    v_total_deduction := v_payout_amount + v_fee;

    -- F. Concurrency lock on user's authoritative wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    -- G. Calculate blocked amount and withdrawable balance server-side
    SELECT COALESCE(SUM(c.amount - c.withdrawn_amount), 0.00) INTO v_blocked_amount
    FROM public.lifafa_claims c
    JOIN public.lifafas l ON l.id = c.lifafa_id
    WHERE c.user_id = v_user_id
      AND c.payout_mode = 'WALLET'
      AND l.withdrawal_status = 'BLOCKED'
      AND c.withdrawn_amount < c.amount;

    v_withdrawable_balance := GREATEST(0.00, v_wallet.available_balance - v_blocked_amount);

    -- H. Enforce withdrawable balance check
    IF v_withdrawable_balance < v_total_deduction THEN
        IF v_wallet.available_balance >= v_total_deduction THEN
            RAISE EXCEPTION 'Withdrawal request exceeds your withdrawable balance. Your wallet balance is ₹%, but ₹% is restricted due to Lifafa withdrawal policy. Eligible for withdrawal: ₹%. Required (including fee): ₹%',
                v_wallet.available_balance, v_blocked_amount, v_withdrawable_balance, v_total_deduction;
        ELSE
            RAISE EXCEPTION 'Insufficient available balance. Required: ₹% (Withdrawal ₹% + Platform Fee ₹%), Available: ₹%',
                v_total_deduction, v_payout_amount, v_fee, v_wallet.available_balance;
        END IF;
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_mid := v_balance_before - v_payout_amount;
    v_balance_after := v_balance_before - v_total_deduction;

    -- I. Debit available_balance on authoritative shared wallet
    UPDATE public.wallets
    SET available_balance = v_balance_after,
        total_withdrawn = total_withdrawn + v_payout_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Keep public.merchant_wallets synchronized in real-time
    UPDATE public.merchant_wallets
    SET available_balance = v_balance_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = v_user_id);

    -- J. Insert withdrawal record
    INSERT INTO public.withdrawals (
        user_id,
        amount,
        fee_amount,
        net_amount,
        account_holder_name,
        bank_account_number_masked,
        bank_account_encrypted,
        ifsc_code,
        upi_id,
        status,
        payout_provider,
        payout_method,
        idempotency_key
    ) VALUES (
        v_user_id,
        v_total_deduction,
        v_fee,
        v_payout_amount,
        v_account_name,
        NULL,
        NULL,
        NULL,
        v_clean_upi,
        'PENDING',
        'PAYNIT',
        'UPI',
        v_key
    ) RETURNING id INTO v_withdrawal_id;

    -- K. Deterministic FIFO Source Allocation for Allowed Lifafa Claims
    v_remaining_to_allocate := v_total_deduction;

    FOR v_claim_rec IN (
        SELECT c.id, c.lifafa_id, (c.amount - c.withdrawn_amount) AS available_in_claim
        FROM public.lifafa_claims c
        JOIN public.lifafas l ON l.id = c.lifafa_id
        WHERE c.user_id = v_user_id
          AND c.payout_mode = 'WALLET'
          AND l.withdrawal_status = 'ALLOWED'
          AND c.withdrawn_amount < c.amount
        ORDER BY c.claimed_at ASC, c.id ASC
        FOR UPDATE OF c
    ) LOOP
        EXIT WHEN v_remaining_to_allocate <= 0;

        v_alloc_from_claim := LEAST(v_claim_rec.available_in_claim, v_remaining_to_allocate);

        UPDATE public.lifafa_claims
        SET withdrawn_amount = withdrawn_amount + v_alloc_from_claim
        WHERE id = v_claim_rec.id;

        INSERT INTO public.withdrawal_source_allocations (
            withdrawal_id,
            claim_id,
            lifafa_id,
            allocated_amount
        ) VALUES (
            v_withdrawal_id,
            v_claim_rec.id,
            v_claim_rec.lifafa_id,
            v_alloc_from_claim
        );

        v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_from_claim;
    END LOOP;

    -- L. Immutable Double-Entry Ledger Transactions
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
        v_user_id,
        v_wallet.id,
        -v_payout_amount,
        'WITHDRAWAL',
        'PENDING',
        'WITHDRAWAL',
        v_withdrawal_id::text,
        'tx_' || v_key,
        v_balance_before,
        v_balance_mid,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'payout_amount', v_payout_amount,
            'payout_method', 'UPI',
            'payout_provider', 'PAYNIT',
            'upi_id', v_clean_upi,
            'account_holder', v_account_name,
            'withdrawable_balance_before', v_withdrawable_balance,
            'blocked_balance_at_request', v_blocked_amount
        )
    ),
    (
        v_user_id,
        v_wallet.id,
        -v_fee,
        'FEE',
        'PENDING',
        'WITHDRAWAL_FEE',
        v_withdrawal_id::text,
        'tx_fee_' || v_key,
        v_balance_mid,
        v_balance_after,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'fee_type', 'WITHDRAWAL_PLATFORM_FEE',
            'fee_amount', v_fee
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'amount', v_payout_amount,
        'fee', v_fee,
        'total_deducted', v_total_deduction,
        'payout_method', 'UPI',
        'payout_provider', 'PAYNIT',
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. MERCHANT GATEWAY PAYOUT RPC (NEW FEE STRUCTURE)
-- ------------------------------------------------------------------------------
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

    -- 1. Deduct authoritative single user wallet
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

    -- K. Double-entry audit ledger
    IF v_mch_wallet.id IS NOT NULL THEN
        INSERT INTO public.merchant_ledger_entries (
            merchant_id, wallet_id, amount, fee_amount, entry_type,
            reference_type, reference_id, idempotency_key,
            balance_before, balance_after, metadata
        ) VALUES 
        (
            p_merchant_id, v_mch_wallet.id, -p_amount, 0.00, 'PAYOUT_LOCK',
            'PAYOUT', v_payout_id::text, 'mch_py_amt_' || v_idem_key,
            v_bal_before, v_bal_mid,
            jsonb_build_object('order_id', p_order_id, 'payout_method', 'UPI', 'upi_id', v_clean_upi)
        ),
        (
            p_merchant_id, v_mch_wallet.id, -v_fee, 0.00, 'PAYOUT_FEE_LOCK',
            'PAYOUT', v_payout_id::text, 'mch_py_fee_' || v_idem_key,
            v_bal_mid, v_bal_after,
            jsonb_build_object('order_id', p_order_id, 'fee', v_fee)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'order_id', TRIM(p_order_id),
        'provider_order_id', v_provider_order_id,
        'amount', p_amount,
        'fee', v_fee,
        'total_deducted', v_total_deducted,
        'status', 'PENDING',
        'payout_method', 'UPI',
        'new_balance', v_bal_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
