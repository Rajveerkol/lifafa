-- ==============================================================================
-- Migration: 038_unify_consumer_and_lifafa_payouts_paynit.sql
-- Description: Unify Consumer Wallet and External Lifafa Claim Payouts under PayNit
--              1. Adds payout_method ('UPI' | 'IMPS') to public.withdrawals
--              2. Drops NOT NULL from bank_account_number_masked, ifsc_code, and
--                 account_holder_name on public.withdrawals to support UPI payouts
--              3. Sets default payout_provider = 'PAYNIT' on public.withdrawals
--                 (Historical records remain untouched as PAYRUPEE)
--              4. Upgrades public.request_withdrawal_rpc for Consumer UPI + IMPS
--              5. Upgrades public.claim_lifafa_rpc for External Lifafa UPI + IMPS
--              6. Preserves existing fees: Consumer fee = ₹3.58, Lifafa fee = ₹0
--              7. Preserves Creator refund invariant on failed Lifafa payouts
-- Status: DRAFT / PENDING MANUAL REVIEW — DO NOT EXECUTE AUTOMATICALLY
-- ==============================================================================

-- ----------------------------------------------------------------------------
-- 1. UPGRADE public.withdrawals SCHEMA FOR DUAL UPI + IMPS SUPPORT
-- ----------------------------------------------------------------------------

-- Add payout_method column defaulting to 'IMPS' (existing rows are all bank/IMPS)
ALTER TABLE public.withdrawals
    ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'IMPS' CHECK (payout_method IN ('UPI', 'IMPS'));

-- Make bank-specific columns nullable to support direct UPI withdrawals
ALTER TABLE public.withdrawals
    ALTER COLUMN bank_account_number_masked DROP NOT NULL,
    ALTER COLUMN ifsc_code DROP NOT NULL,
    ALTER COLUMN account_holder_name DROP NOT NULL,
    ALTER COLUMN payout_provider SET DEFAULT 'PAYNIT';

-- Enforce strict field constraints: UPI requires upi_id; IMPS requires bank account + IFSC
ALTER TABLE public.withdrawals
    DROP CONSTRAINT IF EXISTS chk_withdrawal_payout_destination;

ALTER TABLE public.withdrawals
    ADD CONSTRAINT chk_withdrawal_payout_destination CHECK (
        (payout_method = 'UPI' AND upi_id IS NOT NULL AND LENGTH(TRIM(upi_id)) > 0) OR
        (payout_method = 'IMPS' AND bank_account_number_masked IS NOT NULL AND ifsc_code IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_withdrawals_method ON public.withdrawals(payout_method);
CREATE INDEX IF NOT EXISTS idx_withdrawals_provider ON public.withdrawals(payout_provider);


-- ----------------------------------------------------------------------------
-- 2. UPGRADE public.request_withdrawal_rpc (CONSUMER WALLET UPI + IMPS VIA PAYNIT)
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
    v_masked_acc TEXT := NULL;
    v_encrypted_acc TEXT := NULL;
    v_clean_upi TEXT := NULL;
    v_payout_method TEXT := 'IMPS';
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

    -- 1. Enforce Server-Side Withdrawal Limits (₹10.00 min, ₹1,000.00 max)
    IF p_amount IS NULL OR p_amount < 10.00 THEN
        RAISE EXCEPTION 'Minimum withdrawal amount is ₹10.00';
    END IF;

    IF p_amount > 1000.00 THEN
        RAISE EXCEPTION 'Maximum withdrawal amount is ₹1,000.00';
    END IF;

    -- 2. Determine Method and Validate Destination Fields
    IF p_upi_id IS NOT NULL AND TRIM(p_upi_id) <> '' THEN
        v_clean_upi := LOWER(TRIM(p_upi_id));
        IF NOT (v_clean_upi ~ '^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
            RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
        END IF;
        v_payout_method := 'UPI';

        -- For UPI, account holder name is optional (fallback to profile full_name)
        SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
        v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Beneficiary');
    ELSE
        -- IMPS/Bank Account Withdrawal
        v_payout_method := 'IMPS';

        IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 4 THEN
            RAISE EXCEPTION 'A valid bank account number (min 4 digits) is required for withdrawal.';
        END IF;

        IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
            RAISE EXCEPTION 'A valid 11-character IFSC code is required for bank withdrawal.';
        END IF;

        IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
            RAISE EXCEPTION 'Account holder name is required for bank withdrawal.';
        END IF;

        v_account_name := TRIM(p_account_holder_name);
        v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
        v_encrypted_acc := public.encrypt_bank_account(TRIM(p_bank_account_number));
    END IF;

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- 3. Idempotency Check
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- 4. Authoritative Platform Fee Calculation: Fixed ₹3.58
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'WITHDRAWAL' AND is_active = TRUE;
    
    IF FOUND AND v_fee_rec.calculation_type = 'FIXED' AND v_fee_rec.value > 0 THEN
        v_fee := v_fee_rec.value;
    END IF;

    -- Beneficiary receives p_amount; wallet debited by p_amount + v_fee
    v_payout_amount := p_amount;
    v_total_deduction := v_payout_amount + v_fee;

    -- 5. Concurrency lock on user's wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    -- 6. Calculate blocked amount and withdrawable balance server-side
    SELECT COALESCE(SUM(c.amount - c.withdrawn_amount), 0.00) INTO v_blocked_amount
    FROM public.lifafa_claims c
    JOIN public.lifafas l ON l.id = c.lifafa_id
    WHERE c.user_id = v_user_id
      AND c.payout_mode = 'WALLET'
      AND l.withdrawal_status = 'BLOCKED'
      AND c.withdrawn_amount < c.amount;

    v_withdrawable_balance := GREATEST(0.00, v_wallet.available_balance - v_blocked_amount);

    -- 7. Enforce withdrawable balance check
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

    -- 8. Debit available_balance by gross deduction (payout + fee); increment total_withdrawn by net payout
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_deduction,
        total_withdrawn = total_withdrawn + v_payout_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 9. Insert withdrawal record with payout_provider = 'PAYNIT'
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
        v_masked_acc,
        NULL,
        UPPER(TRIM(p_ifsc_code)),
        v_clean_upi,
        'PENDING',
        'PAYNIT', -- NEW WITHDRAWALS ARE ASSIGNED TO PAYNIT
        v_payout_method,
        v_key
    ) RETURNING id INTO v_withdrawal_id;

    -- 10. Store encrypted credential in vault if IMPS
    IF v_payout_method = 'IMPS' AND v_encrypted_acc IS NOT NULL THEN
        INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number)
        VALUES (v_withdrawal_id, v_encrypted_acc);
    END IF;

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
            'payout_method', v_payout_method,
            'payout_provider', 'PAYNIT',
            'upi_id', v_clean_upi,
            'account_masked', v_masked_acc,
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
        'payout_method', v_payout_method,
        'payout_provider', 'PAYNIT',
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ----------------------------------------------------------------------------
-- 3. UPGRADE public.claim_lifafa_rpc (EXTERNAL LIFAFA CLAIMS VIA PAYNIT)
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
    v_masked_acc TEXT := NULL;
    v_encrypted_acc TEXT := NULL;
    v_clean_upi TEXT := NULL;
    v_payout_method TEXT := 'IMPS';
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

    -- [BUG-CRIT-02 FIX] Prevent Lifafa creator from claiming their own Lifafa
    IF v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    -- [BUG-CRIT-04 FIX] Authoritatively reject claims on BLOCKED Lifafas
    IF v_lifafa.withdrawal_status = 'BLOCKED' THEN
        RAISE EXCEPTION 'This Lifafa has been blocked by platform administration';
    END IF;

    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa has not started yet. Starts at: %', v_lifafa.starts_at;
    END IF;

    -- Status validation
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

    -- 3. External Payout Details Validation (UPI or Bank)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        IF p_upi_id IS NOT NULL AND TRIM(p_upi_id) <> '' THEN
            v_clean_upi := LOWER(TRIM(p_upi_id));
            IF NOT (v_clean_upi ~ '^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
                RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
            END IF;
            v_payout_method := 'UPI';

            SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
            v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Claimant');
        ELSE
            -- IMPS/Bank Account
            v_payout_method := 'IMPS';

            IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
                RAISE EXCEPTION 'Account holder name as per bank records is required';
            END IF;

            IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 6 THEN
                RAISE EXCEPTION 'A valid Bank Account Number (min 6 digits) is required for direct bank payout';
            END IF;

            IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
                RAISE EXCEPTION 'A valid 11-character IFSC code is required for bank payout (e.g. SBIN0001234)';
            END IF;

            v_account_name := TRIM(p_account_holder_name);
            v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
            v_encrypted_acc := public.encrypt_bank_account(TRIM(p_bank_account_number));
        END IF;
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

    -- 6. Payout Routing: UPI_BANK (External PayNit) vs WALLET (Internal Instant)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Insert into public.withdrawals for external PayNit dispatch
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
            v_masked_acc,
            NULL,
            UPPER(TRIM(p_ifsc_code)),
            v_clean_upi,
            'PENDING',
            'PAYNIT', -- NEW EXTERNAL CLAIMS ARE ASSIGNED TO PAYNIT
            v_payout_method,
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        IF v_payout_method = 'IMPS' AND v_encrypted_acc IS NOT NULL THEN
            INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number)
            VALUES (v_withdrawal_id, v_encrypted_acc);
        END IF;

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
            'payout_method', v_payout_method,
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
        ) VALUES (
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
-- 4. PERMISSIONS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
