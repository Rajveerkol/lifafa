-- ==============================================================================
-- Migration: 039_enforce_upi_only_payout_architecture.sql
-- Description: Enforce UPI-Only Payout Architecture Across Entire Platform
--              1. Updates public.request_withdrawal_rpc:
--                 - Strictly enforces UPI-only for all new consumer withdrawals.
--                 - Rejects bank account / IMPS withdrawal attempts.
--                 - Requires valid UPI ID format.
--                 - Preserves flat fee = ₹3.58 (total debit = amount + ₹3.58).
--                 - Sets payout_method = 'UPI' and payout_provider = 'PAYNIT'.
--              2. Updates public.claim_lifafa_rpc:
--                 - Strictly enforces UPI-only for new external claims (payout_mode = 'UPI_BANK').
--                 - Rejects bank account / IMPS submissions.
--                 - Requires valid UPI ID format.
--                 - Claimant fee remains ₹0.00.
--                 - Preserves creator refund on payout failure.
--                 - Sets payout_method = 'UPI' and payout_provider = 'PAYNIT'.
--              3. Updates public.merchant_initiate_payout_rpc:
--                 - Strictly enforces UPI-only for all new merchant payouts.
--                 - Rejects IMPS / bank account payout attempts.
--                 - Requires valid UPI ID format.
--                 - Preserves flat fee = ₹2.50 (total debit = amount + ₹2.50).
--                 - Sets payout_method = 'UPI' and payout_provider = 'PAYNIT'.
--              4. Preserves all historical columns and historical IMPS/PayRupee rows.
-- Status: READY FOR MANUAL EXECUTION — NOT EXECUTED
-- ==============================================================================

-- ----------------------------------------------------------------------------
-- 1. UPDATE public.request_withdrawal_rpc (UPI-ONLY CONSUMER WITHDRAWALS VIA PAYNIT)
-- ----------------------------------------------------------------------------

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

    -- 2. Validate UPI ID
    IF p_upi_id IS NULL OR TRIM(p_upi_id) = '' THEN
        RAISE EXCEPTION 'A valid UPI ID is required for withdrawal.';
    END IF;

    v_clean_upi := LOWER(TRIM(p_upi_id));
    IF NOT (v_clean_upi ~ '^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
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
-- 2. UPDATE public.claim_lifafa_rpc (UPI-ONLY EXTERNAL CLAIMS VIA PAYNIT)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc(
    p_code TEXT,
    p_pin_code VARCHAR(10) DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lifafa RECORD;
    v_allocation RECORD;
    v_user_wallet RECORD;
    v_creator_wallet RECORD;
    v_claim_id UUID;
    v_withdrawal_id UUID := NULL;
    v_claim_amount NUMERIC(12, 2);
    v_uncompleted_count INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_existing_claim RECORD;
    v_secret RECORD;
    v_device_claims_count INT;
    v_clean_upi TEXT := NULL;
    v_account_name TEXT := NULL;
    v_profile_name TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim a Lifafa';
    END IF;

    v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_' || v_user_id::text);

    -- 1. Check idempotency
    SELECT * INTO v_existing_claim
    FROM public.lifafa_claims
    WHERE idempotency_key = v_effective_idempotency 
       OR (lifafa_id IN (SELECT id FROM public.lifafas WHERE code = TRIM(p_code)) AND user_id = v_user_id);

    IF FOUND THEN
        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;
        RETURN jsonb_build_object(
            'success', true,
            'amount', v_existing_claim.amount,
            'lifafa_code', p_code,
            'is_duplicate', true,
            'payout_mode', v_existing_claim.payout_mode,
            'withdrawal_id', v_existing_claim.withdrawal_id,
            'new_balance', v_balance_after
        );
    END IF;

    -- 2. Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE code = TRIM(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa with code % does not exist', p_code;
    END IF;

    IF v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    IF v_lifafa.withdrawal_status = 'BLOCKED' THEN
        RAISE EXCEPTION 'This Lifafa has been blocked by platform administration';
    END IF;

    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa has not started yet. Starts at: %', v_lifafa.starts_at;
    END IF;

    IF v_lifafa.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Lifafa has been cancelled';
    END IF;

    IF v_lifafa.status = 'EXPIRED' OR v_lifafa.expires_at <= NOW() THEN
        IF v_lifafa.status <> 'EXPIRED' THEN
            UPDATE public.lifafas SET status = 'EXPIRED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        END IF;
        RAISE EXCEPTION 'Lifafa has expired';
    END IF;

    IF v_lifafa.status = 'COMPLETED' OR v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0.00 THEN
        IF v_lifafa.status <> 'COMPLETED' THEN
            UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        END IF;
        RAISE EXCEPTION 'All Lifafa rewards have already been claimed';
    END IF;

    IF v_lifafa.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Lifafa is not active (Status: %)', v_lifafa.status;
    END IF;

    -- 3. External Payout Details Validation: Enforce UPI ONLY for UPI_BANK mode
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Reject bank account parameters
        IF p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> '' THEN
            RAISE EXCEPTION 'Bank account claims are no longer supported. All external claims must use UPI.';
        END IF;

        IF p_upi_id IS NULL OR TRIM(p_upi_id) = '' THEN
            RAISE EXCEPTION 'A valid UPI ID is required to claim this Lifafa.';
        END IF;

        v_clean_upi := LOWER(TRIM(p_upi_id));
        IF NOT (v_clean_upi ~ '^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
            RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
        END IF;

        SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
        v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Claimant');
    END IF;

    -- Device limit check
    IF p_device_fingerprint IS NOT NULL AND v_lifafa.device_claim_limit > 0 THEN
        SELECT COUNT(*) INTO v_device_claims_count
        FROM public.lifafa_claims
        WHERE lifafa_id = v_lifafa.id AND device_fingerprint = p_device_fingerprint;

        IF v_device_claims_count >= v_lifafa.device_claim_limit THEN
            RAISE EXCEPTION 'Device claim limit (% per device) reached for this Lifafa', v_lifafa.device_claim_limit;
        END IF;
    END IF;

    -- PIN verification
    SELECT * INTO v_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND THEN
        IF p_pin_code IS NULL OR LENGTH(TRIM(p_pin_code)) = 0 THEN
            RAISE EXCEPTION 'Secret PIN code is required to claim this Lifafa';
        END IF;

        IF v_secret.pin_code_hash <> crypt(TRIM(p_pin_code), v_secret.pin_code_hash) THEN
            RAISE EXCEPTION 'Incorrect PIN code entered';
        END IF;
    END IF;

    -- Task completions check
    SELECT COUNT(*) INTO v_uncompleted_count
    FROM public.lifafa_tasks t
    WHERE t.lifafa_id = v_lifafa.id
      AND t.is_required = TRUE
      AND t.is_enabled = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM public.task_completions tc
          WHERE tc.task_id = t.id 
            AND tc.user_id = v_user_id
            AND (
                (t.task_type IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT')
                 AND tc.status = 'VERIFIED'
                 AND tc.verification_method = 'TELEGRAM_BOT_API'
                 AND tc.verified_via_bot = TRUE)
                OR
                (t.task_type IN ('VISIT_WEBSITE', 'CUSTOM')
                 AND (tc.status = 'CLICK_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method = 'URL_VISIT')))
                OR
                (t.task_type IN ('INSTAGRAM_FOLLOW', 'INSTAGRAM_LIKE', 'YOUTUBE_SUB', 'REFERRAL')
                 AND (tc.status = 'USER_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method IN ('MANUAL', 'ENGAGEMENT', 'OAUTH_CHECK'))))
                OR
                (t.task_type = 'YOUTUBE_WATCH'
                 AND (tc.status = 'USER_CONFIRMED' OR tc.status = 'VERIFIED')
                 AND (tc.verification_method IN ('YOUTUBE_PLAYER_ENDED', 'USER_CONFIRMED', 'ENGAGEMENT')))
            )
      );

    IF v_uncompleted_count > 0 THEN
        RAISE EXCEPTION 'Please complete and verify all required community tasks before claiming';
    END IF;

    -- 4. Select next available allocation
    SELECT * INTO v_allocation
    FROM public.lifafa_allocations
    WHERE lifafa_id = v_lifafa.id AND is_claimed = FALSE
    ORDER BY allocation_index ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'No available rewards remaining in this Lifafa';
    END IF;

    v_claim_amount := v_allocation.amount;

    UPDATE public.lifafa_allocations
    SET is_claimed = TRUE,
        claimed_by = v_user_id,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = GREATEST(0.00, remaining_amount - v_claim_amount),
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0.00 
                THEN 'COMPLETED'::lifafa_status 
            ELSE 'ACTIVE'::lifafa_status 
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    -- 5. Deduct from creator escrow
    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - v_claim_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- 6. Payout Routing: UPI_BANK (External PayNit UPI) vs WALLET (Internal Instant)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Insert into public.withdrawals for external PayNit UPI dispatch
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
            v_claim_amount,
            0.00, -- Free to claimant
            v_claim_amount,
            v_account_name,
            NULL,
            NULL,
            NULL,
            v_clean_upi,
            'PENDING',
            'PAYNIT', -- ENFORCE PAYNIT
            'UPI',    -- ENFORCE UPI
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        INSERT INTO public.lifafa_claims (
            lifafa_id,
            user_id,
            allocation_id,
            amount,
            idempotency_key,
            device_fingerprint,
            ip_address,
            payout_mode,
            withdrawal_id
        ) VALUES (
            v_lifafa.id,
            v_user_id,
            v_allocation.id,
            v_claim_amount,
            v_effective_idempotency,
            p_device_fingerprint,
            p_ip_address,
            'UPI_BANK',
            v_withdrawal_id
        ) RETURNING id INTO v_claim_id;

        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'UPI_BANK',
            'payout_method', 'UPI',
            'payout_provider', 'PAYNIT',
            'withdrawal_id', v_withdrawal_id,
            'withdrawal_status', 'PENDING',
            'new_balance', v_balance_after
        );

    ELSE
        -- WALLET mode: Instant internal credit (UNCHANGED)
        SELECT * INTO v_user_wallet 
        FROM public.wallets 
        WHERE user_id = v_user_id 
        FOR UPDATE;

        v_balance_before := v_user_wallet.available_balance;
        v_balance_after := v_balance_before + v_claim_amount;

        UPDATE public.wallets
        SET available_balance = available_balance + v_claim_amount,
            total_earned = total_earned + v_claim_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_user_wallet.id;

        INSERT INTO public.lifafa_claims (
            lifafa_id,
            user_id,
            allocation_id,
            amount,
            idempotency_key,
            device_fingerprint,
            ip_address,
            payout_mode
        ) VALUES (
            v_lifafa.id,
            v_user_id,
            v_allocation.id,
            v_claim_amount,
            v_effective_idempotency,
            p_device_fingerprint,
            p_ip_address,
            'WALLET'
        ) RETURNING id INTO v_claim_id;

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
            v_user_wallet.id,
            v_claim_amount,
            'CLAIM',
            'SUCCESS',
            'LIFAFA_CLAIM',
            v_claim_id::text,
            'claim_tx_' || v_effective_idempotency,
            v_balance_before,
            v_balance_after,
            jsonb_build_object(
                'lifafa_id', v_lifafa.id,
                'lifafa_code', v_lifafa.code,
                'allocation_id', v_allocation.id
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'WALLET',
            'new_balance', v_balance_after
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ----------------------------------------------------------------------------
-- 3. UPDATE public.merchant_initiate_payout_rpc (UPI-ONLY MERCHANT PAYOUTS VIA PAYNIT)
-- ----------------------------------------------------------------------------

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

    -- E. UPI ID Validation
    IF p_upi_id IS NULL OR LENGTH(TRIM(p_upi_id)) < 3 THEN
        RAISE EXCEPTION 'A valid UPI ID is required for payout';
    END IF;
    v_clean_upi := LOWER(TRIM(p_upi_id));
    IF NOT (v_clean_upi ~ '^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
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

    -- H. Float Wallet Lock & Debit
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
        locked_payout_balance = locked_payout_balance + p_amount,
        total_fees_paid = total_fees_paid + v_fee,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- I. Insert Payout Record with payout_method = 'UPI' and payout_provider = 'PAYNIT'
    v_provider_order_id := 'ORD_' || p_merchant_id::text || '_' || TRIM(p_order_id) || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;

    INSERT INTO public.merchant_payouts (
        merchant_id,
        order_id,
        amount,
        fee_amount,
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
        'PENDING',
        'UPI', -- ENFORCE UPI
        v_clean_upi,
        NULL,
        NULL,
        NULL,
        COALESCE(NULLIF(TRIM(p_account_holder_name), ''), 'UPI Beneficiary'),
        'PAYNIT', -- ENFORCE PAYNIT
        v_provider_order_id,
        v_idem_key
    ) RETURNING id INTO v_payout_id;

    -- J. Double-Entry Float Ledger Entries
    INSERT INTO public.merchant_ledger_entries (
        merchant_id,
        wallet_id,
        entry_type,
        amount,
        fee_amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        description
    ) VALUES
    (
        p_merchant_id,
        v_wallet.id,
        'DEBIT',
        p_amount,
        0.00,
        v_bal_before,
        v_bal_mid,
        'PAYOUT',
        v_payout_id::text,
        'Merchant payout principal reserved for order ' || TRIM(p_order_id) || ' via PayNit UPI'
    ),
    (
        p_merchant_id,
        v_wallet.id,
        'FEE',
        v_fee,
        v_fee,
        v_bal_mid,
        v_bal_after,
        'PAYOUT_FEE',
        v_payout_id::text,
        'Merchant payout fee (Flat ₹2.50) for order ' || TRIM(p_order_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'provider_order_id', v_provider_order_id,
        'amount', p_amount,
        'fee', v_fee,
        'total_debited', v_total_deducted,
        'payout_method', 'UPI',
        'payout_provider', 'PAYNIT',
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 4. PERMISSIONS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
