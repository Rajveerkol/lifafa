-- ==============================================================================
-- Migration: 044_unified_wallet_fee_slabs_and_deposit_fee.sql
-- Description: 
--   1. Authoritative Tiered Withdrawal & Payout Fee Slabs (Unified):
--        ₹1.00 to ₹500.00         -> Fee = ₹2.50
--        Above ₹500.00 to ₹1,000  -> Fee = ₹2.70
--        Above ₹1,000 to ₹5,000   -> Fee = ₹3.50
--        Exact boundaries:
--          ₹500.00   -> ₹2.50  (Total: ₹502.50)
--          ₹500.01   -> ₹2.70  (Total: ₹502.71)
--          ₹1,000.00 -> ₹2.70  (Total: ₹1,002.70)
--          ₹1,000.01 -> ₹3.50  (Total: ₹1,003.51)
--          ₹5,000.00 -> ₹3.50  (Total: ₹5,003.50)
--   2. Authoritative 2% Deposit Fee (Unified Website & Merchant Gateway):
--        Formula:
--          Deposit Fee   = Deposit Amount * 2%
--          Total Payable = Deposit Amount + 2% Fee
--          Wallet Credit = Deposit Amount
--   3. One Shared Wallet Balance:
--        Website Wallet (public.wallets) and Merchant Gateway Wallet (public.merchant_wallets)
--        read and write the EXACT same underlying user balance.
--        Any deposit, withdrawal, payout, or refund instantly reflects across both interfaces.
--   4. Bidirectional Triggers & Initial Balance Alignment.
-- Target: Supabase SQL Editor (Manual Execution by Platform Administrator)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATE PLATFORM SETTINGS WITH NEW FEE SLABS & CONFIGURATION
-- ------------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('WITHDRAWAL_MIN_AMOUNT', '1.00', 'Minimum wallet withdrawal amount'),
    ('WITHDRAWAL_MAX_AMOUNT', '5000.00', 'Maximum wallet withdrawal amount'),
    ('WITHDRAWAL_FEE_SLAB_1_MAX', '500.00', 'Upper bound for Tier 1 withdrawal fee'),
    ('WITHDRAWAL_FEE_SLAB_1', '2.50', 'Flat fee for withdrawals <= ₹500.00'),
    ('WITHDRAWAL_FEE_SLAB_2_MAX', '1000.00', 'Upper bound for Tier 2 withdrawal fee'),
    ('WITHDRAWAL_FEE_SLAB_2', '2.70', 'Flat fee for withdrawals > ₹500.00 and <= ₹1000.00'),
    ('WITHDRAWAL_FEE_SLAB_3_MAX', '5000.00', 'Upper bound for Tier 3 withdrawal fee'),
    ('WITHDRAWAL_FEE_SLAB_3', '3.50', 'Flat fee for withdrawals > ₹1000.00 and <= ₹5000.00'),
    ('DEPOSIT_FEE_PERCENT', '2.00', 'Authoritative 2% fee charged on all wallet deposits'),
    ('MERCHANT_MIN_PAYOUT_AMOUNT', '1.00', 'Minimum merchant payout amount'),
    ('MERCHANT_MAX_PAYOUT_AMOUNT', '5000.00', 'Maximum merchant payout amount')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = TIMEZONE('utc'::text, NOW());

-- Add tracking columns to deposit_requests if not already present
ALTER TABLE public.deposit_requests ADD COLUMN IF NOT EXISTS deposit_fee NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.deposit_requests ADD COLUMN IF NOT EXISTS total_payable NUMERIC(12, 2) DEFAULT 0.00;

-- ------------------------------------------------------------------------------
-- 2. CONSUMER WALLET WITHDRAWAL RPC (SERVER-SIDE TIERED FEE SLABS & SHARED BALANCE)
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

    -- Also keep public.merchant_wallets synchronized in real-time
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
-- 3. MERCHANT GATEWAY PAYOUT RPC (UNIFIED TIERED FEE SLABS & SHARED WALLET BALANCE)
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

    -- E. UPI ID Validation
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

    -- I. Insert Payout Record
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
        bank_account_encrypted,
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

-- ------------------------------------------------------------------------------
-- 4. WEBSITE DEPOSIT REQUEST RPC (AUTHORITATIVE 2% DEPOSIT FEE)
-- ------------------------------------------------------------------------------
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
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit deposit request';
    END IF;

    IF p_amount IS NULL OR p_amount < 1.00 THEN
        RAISE EXCEPTION 'Deposit amount must be at least ₹1.00';
    END IF;

    v_clean_utr := UPPER(TRIM(p_utr_number));
    IF v_clean_utr IS NULL OR LENGTH(v_clean_utr) < 6 OR LENGTH(v_clean_utr) > 30 THEN
        RAISE EXCEPTION 'Invalid UTR/Transaction reference number. Must be 6-30 alphanumeric characters.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.deposit_requests WHERE utr_number = v_clean_utr) THEN
        RAISE EXCEPTION 'This UTR number (%) has already been submitted. Please check your deposit history.', v_clean_utr;
    END IF;

    SELECT value INTO v_authoritative_upi_id
    FROM public.platform_settings
    WHERE key = 'DEPOSIT_UPI_ID';

    IF v_authoritative_upi_id IS NULL OR TRIM(v_authoritative_upi_id) = '' THEN
        v_authoritative_upi_id := 'createlifafa@upi';
    END IF;

    -- Authoritative 2% fee:
    --   Deposit Fee = Deposit Amount * 2%
    --   Total Payable = Deposit Amount + Fee
    --   Wallet Credit = Deposit Amount
    v_fee := ROUND(p_amount * 0.02, 2);
    v_total_payable := p_amount + v_fee;

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
        'success', TRUE,
        'deposit_id', v_deposit_id,
        'deposit_amount', p_amount,
        'deposit_fee', v_fee,
        'total_payable', v_total_payable,
        'wallet_credit', p_amount,
        'upi_id', v_authoritative_upi_id,
        'utr_number', v_clean_utr,
        'status', 'PENDING',
        'message', 'Deposit request submitted successfully. Awaiting administrator verification.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 5. ADMIN REVIEW WEBSITE DEPOSIT RPC (CREDITS EXACT DEPOSIT AMOUNT TO SHARED WALLET)
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

        -- Credit authoritative wallet with exact deposit amount
        UPDATE public.wallets
        SET available_balance = v_balance_after,
            total_deposited = total_deposited + v_deposit.amount,
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
            'Deposit Approved! ₹' || v_deposit.amount::text,
            'Your manual UPI deposit of ₹' || v_deposit.amount::text || ' (UTR: ' || v_deposit.utr_number || ') has been verified and added to your wallet balance.',
            'SYSTEM',
            p_deposit_id::text
        );

        INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
        VALUES (
            v_admin_id,
            'APPROVE_DEPOSIT',
            'DEPOSIT_REQUEST',
            p_deposit_id::text,
            jsonb_build_object(
                'amount', v_deposit.amount,
                'deposit_fee', v_deposit.deposit_fee,
                'utr_number', v_deposit.utr_number,
                'target_user_id', v_deposit.user_id,
                'notes', p_notes,
                'balance_before', v_balance_before,
                'balance_after', v_balance_after
            )
        );

        RETURN jsonb_build_object(
            'success', TRUE,
            'deposit_id', p_deposit_id,
            'status', 'APPROVED',
            'amount_credited', v_deposit.amount,
            'new_balance', v_balance_after,
            'message', 'Deposit approved and wallet credited successfully.'
        );

    ELSIF p_action = 'REJECT' THEN
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
            'Deposit Request Rejected',
            'Your manual UPI deposit request of ₹' || v_deposit.amount::text || ' (UTR: ' || v_deposit.utr_number || ') was rejected: ' || COALESCE(p_notes, 'UTR reference could not be verified in platform accounts.'),
            'SYSTEM',
            p_deposit_id::text
        );

        INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
        VALUES (
            v_admin_id,
            'REJECT_DEPOSIT',
            'DEPOSIT_REQUEST',
            p_deposit_id::text,
            jsonb_build_object(
                'amount', v_deposit.amount,
                'utr_number', v_deposit.utr_number,
                'target_user_id', v_deposit.user_id,
                'reason', p_notes
            )
        );

        RETURN jsonb_build_object(
            'success', TRUE,
            'deposit_id', p_deposit_id,
            'status', 'REJECTED',
            'message', 'Deposit request rejected. No funds were added to user wallet.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 6. MERCHANT DEPOSIT SUBMISSION RPC (AUTHORITATIVE 2% DEPOSIT FEE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merchant_submit_deposit_rpc(
    p_merchant_id UUID,
    p_gross_amount NUMERIC(12, 2),
    p_utr_number TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_fee_pct NUMERIC(12, 2) := 2.00;
    v_fee_amount NUMERIC(12, 2);
    v_total_payable NUMERIC(12, 2);
    v_net_credited NUMERIC(12, 2);
    v_deposit_id UUID;
    v_clean_utr TEXT;
BEGIN
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this active merchant account';
        END IF;
    END IF;

    IF p_gross_amount IS NULL OR p_gross_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit amount must be greater than zero';
    END IF;

    v_clean_utr := UPPER(TRIM(COALESCE(p_utr_number, '')));
    IF LENGTH(v_clean_utr) < 6 THEN
        RAISE EXCEPTION 'A valid UPI UTR or Transaction Reference Number is required';
    END IF;

    IF EXISTS (SELECT 1 FROM public.merchant_deposits WHERE utr_number = v_clean_utr) THEN
        RAISE EXCEPTION 'Deposit request with this UTR number already exists';
    END IF;

    -- Reconcile 2% Deposit Fee Formula:
    -- If caller passed Total Payable (Deposit + 2%), back out Deposit Amount:
    -- Or if caller passed Deposit Amount, calculate Total Payable.
    -- Here: gross_amount represents total money paid by user; net_credited represents wallet credit.
    -- If gross_amount is 1020, fee is 20, net_credited is 1000.
    v_fee_amount := ROUND(p_gross_amount * (v_fee_pct / (100.0 + v_fee_pct)), 2);
    v_net_credited := p_gross_amount - v_fee_amount;
    v_total_payable := p_gross_amount;

    v_deposit_id := gen_random_uuid();

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
        reviewed_at
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
        NULL
    );

    RETURN jsonb_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'deposit_amount', v_net_credited,
        'deposit_fee', v_fee_amount,
        'total_payable', v_total_payable,
        'wallet_credit', v_net_credited,
        'utr_number', v_clean_utr,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_submit_deposit_rpc(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. ADMIN APPROVE MERCHANT DEPOSIT RPC (CREDITS SHARED USER WALLET)
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
    v_mch_wallet RECORD;
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

    -- Credit Authoritative Shared Wallet
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        total_deposited = total_deposited + v_deposit.net_credited,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_user_wallet.id;

    -- Update merchant_wallets record
    UPDATE public.merchant_wallets
    SET available_balance = v_bal_after,
        total_deposited = total_deposited + v_deposit.gross_amount,
        total_fees_paid = total_fees_paid + v_deposit.deposit_fee,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE merchant_id = v_deposit.merchant_id;

    -- Ledger entries in merchant_ledger_entries
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 8. BIDIRECTIONAL SHARED WALLET BALANCE SYNCHRONIZATION TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_wallet_to_merchant_wallet()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.merchant_wallets mw
    SET available_balance = NEW.available_balance,
        updated_at = TIMEZONE('utc'::text, NOW())
    FROM public.merchants m
    WHERE mw.merchant_id = m.id
      AND m.user_id = NEW.user_id
      AND mw.available_balance IS DISTINCT FROM NEW.available_balance;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_user_wallet_to_merchant_wallet ON public.wallets;
CREATE TRIGGER trg_sync_user_wallet_to_merchant_wallet
AFTER UPDATE OF available_balance ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_wallet_to_merchant_wallet();

-- ------------------------------------------------------------------------------
-- 9. INITIAL ONE-TIME BALANCE ALIGNMENT QUERY
-- ------------------------------------------------------------------------------
-- Synchronize any existing divergent merchant wallet float balances to match the user's authoritative balance
UPDATE public.merchant_wallets mw
SET available_balance = w.available_balance,
    updated_at = TIMEZONE('utc'::text, NOW())
FROM public.merchants m, public.wallets w
WHERE mw.merchant_id = m.id
  AND m.user_id = w.user_id
  AND mw.available_balance IS DISTINCT FROM w.available_balance;
