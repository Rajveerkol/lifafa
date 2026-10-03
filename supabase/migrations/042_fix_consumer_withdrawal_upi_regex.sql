-- ==============================================================================
-- Migration: 042_fix_consumer_withdrawal_upi_regex.sql
-- Description: Minimal Production Fix for Consumer Wallet UPI Withdrawal Regex
--              1. Fixes Spencer's regex engine crash (SQLSTATE 2201B) by replacing
--                 invalid repetition quantifier {2,256} with PostgreSQL-compliant
--                 POSIX regex: ^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$
--              2. Preserves all UPI-only architecture requirements
--              3. Preserves all platform fees (₹3.58) and withdrawal limits (₹10 - ₹1,000)
--              4. Preserves double-entry ledger, FIFO claim source allocations, and idempotency
-- ==============================================================================

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
    v_fee NUMERIC(12, 2) := 3.58; -- Mandatory unchanged consumer fee: ₹3.58
    v_fee_rec RECORD;
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

    -- 1. Strict UPI-Only Architecture Enforcement: Reject IMPS / Bank Account parameters
    IF p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> '' THEN
        RAISE EXCEPTION 'Bank account (IMPS) withdrawals are no longer supported. All withdrawals are processed via UPI only.';
    END IF;

    -- 2. Validate UPI ID (Fixed Spencer POSIX Regex DUPMAX=255)
    IF p_upi_id IS NULL OR TRIM(p_upi_id) = '' THEN
        RAISE EXCEPTION 'A valid UPI ID is required for withdrawal.';
    END IF;

    v_clean_upi := LOWER(TRIM(p_upi_id));
    IF NOT (v_clean_upi ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$') THEN
        RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
    END IF;

    -- 3. Enforce Server-Side Withdrawal Limits (₹10.00 min, ₹1,000.00 max)
    IF p_amount IS NULL OR p_amount < 10.00 THEN
        RAISE EXCEPTION 'Minimum withdrawal amount is ₹10.00';
    END IF;

    IF p_amount > 1000.00 THEN
        RAISE EXCEPTION 'Maximum withdrawal amount is ₹1,000.00';
    END IF;

    -- Beneficiary name fallback
    SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
    v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Beneficiary');

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- 4. Idempotency Check
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- 5. Authoritative Platform Fee Calculation: Fixed ₹3.58
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'WITHDRAWAL' AND is_active = TRUE;
    
    IF FOUND AND v_fee_rec.calculation_type = 'FIXED' AND v_fee_rec.value > 0 THEN
        v_fee := v_fee_rec.value;
    END IF;

    -- Beneficiary receives p_amount; wallet debited by p_amount + v_fee (₹3.58)
    v_payout_amount := p_amount;
    v_total_deduction := v_payout_amount + v_fee;

    -- 6. Concurrency lock on user's wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    -- 7. Calculate blocked amount and withdrawable balance server-side
    SELECT COALESCE(SUM(c.amount - c.withdrawn_amount), 0.00) INTO v_blocked_amount
    FROM public.lifafa_claims c
    JOIN public.lifafas l ON l.id = c.lifafa_id
    WHERE c.user_id = v_user_id
      AND c.payout_mode = 'WALLET'
      AND l.withdrawal_status = 'BLOCKED'
      AND c.withdrawn_amount < c.amount;

    v_withdrawable_balance := GREATEST(0.00, v_wallet.available_balance - v_blocked_amount);

    -- 8. Enforce withdrawable balance check
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

    -- 9. Debit available_balance by gross deduction (payout + fee); increment total_withdrawn by net payout
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_deduction,
        total_withdrawn = total_withdrawn + v_payout_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 10. Insert withdrawal record with payout_method = 'UPI' and payout_provider = 'PAYNIT'
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
        'PAYNIT', -- ENFORCE PAYNIT
        'UPI',    -- ENFORCE UPI
        v_key
    ) RETURNING id INTO v_withdrawal_id;

    -- 11. Deterministic FIFO Source Allocation for Allowed Lifafa Claims
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

    -- 12. Immutable Double-Entry Ledger Transactions
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

-- ----------------------------------------------------------------------------
-- PERMISSIONS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
