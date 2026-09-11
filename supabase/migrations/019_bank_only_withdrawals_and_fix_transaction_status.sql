-- Migration 019: Bank-Only Withdrawals & Fix Transaction Status Enum
-- 1. Fixes invalid 'COMPLETED' value in request_withdrawal_rpc to valid 'PENDING'::transaction_status
-- 2. Enforces BANK-ACCOUNT-ONLY server-side restriction (strictly rejecting UPI withdrawals)
-- 3. Fixes invalid 'COMPLETED' value in claim_lifafa_rpc to valid 'SUCCESS'::transaction_status
-- 4. Preserves fail-closed Vault encryption and zero credential exposure

-- Drop previous overloaded signatures if any
DROP FUNCTION IF EXISTS public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_withdrawal_rpc(
    p_amount NUMERIC(12, 2),
    p_account_holder_name TEXT,
    p_bank_account_number TEXT,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_fee NUMERIC(12, 2) := 0.00;
    v_fee_rec RECORD;
    v_net_amount NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_key TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to withdraw';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
    END IF;

    -- SERVER-SIDE SAFETY: Withdrawals are strictly Bank Account Only
    IF p_upi_id IS NOT NULL AND TRIM(p_upi_id) != '' THEN
        RAISE EXCEPTION 'Withdrawals are bank account only. UPI withdrawals are not supported.';
    END IF;

    IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 4 THEN
        RAISE EXCEPTION 'A valid bank account number is required for withdrawal.';
    END IF;

    IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
        RAISE EXCEPTION 'A valid 11-character IFSC code is required for withdrawal.';
    END IF;

    IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
        RAISE EXCEPTION 'Account holder name is required for withdrawal.';
    END IF;

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- Idempotency check
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- Platform fee calculation
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'WITHDRAWAL' AND is_active = TRUE;
    
    IF FOUND THEN
        IF v_fee_rec.calculation_type = 'FIXED' THEN
            v_fee := v_fee_rec.value;
        ELSIF v_fee_rec.calculation_type = 'PERCENTAGE' THEN
            v_fee := ROUND((p_amount * v_fee_rec.value / 100.0), 2);
        END IF;
    END IF;

    v_net_amount := p_amount - v_fee;
    IF v_net_amount <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount after fees must be greater than 0';
    END IF;

    -- Row lock on wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_wallet.available_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient available balance. Available: %, Requested: %', v_wallet.available_balance, p_amount;
    END IF;

    v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
    -- Fail-closed Vault encryption
    v_encrypted_acc := public.encrypt_bank_account(TRIM(p_bank_account_number));

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - p_amount;

    UPDATE public.wallets
    SET available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Insert withdrawal: bank_account_encrypted remains strictly NULL, upi_id strictly NULL
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
        idempotency_key
    ) VALUES (
        v_user_id,
        p_amount,
        v_fee,
        v_net_amount,
        TRIM(p_account_holder_name),
        v_masked_acc,
        NULL,
        UPPER(TRIM(p_ifsc_code)),
        NULL,
        'PENDING',
        'PAYRUPEE',
        v_key
    ) RETURNING id INTO v_withdrawal_id;

    -- Insert encrypted credential into isolated credentials table
    IF v_encrypted_acc IS NOT NULL THEN
        INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number)
        VALUES (v_withdrawal_id, v_encrypted_acc);
    END IF;

    -- Ledger transaction: MUST use valid transaction_status enum value ('PENDING'::transaction_status)
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
        v_wallet.id,
        -p_amount,
        'WITHDRAWAL',
        'PENDING'::transaction_status,
        'WITHDRAWAL',
        v_withdrawal_id,
        'tx_' || v_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'fee_amount', v_fee,
            'net_amount', v_net_amount,
            'account_holder', TRIM(p_account_holder_name),
            'account_masked', v_masked_acc
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'amount', p_amount,
        'fee', v_fee,
        'net_amount', v_net_amount,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Also update claim_lifafa_rpc to replace invalid 'COMPLETED' with 'SUCCESS'::transaction_status for wallet credits
CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc(
    p_lifafa_code TEXT,
    p_idempotency_key TEXT DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
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
    v_claim_id UUID;
    v_claim_amount NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_user_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_requires_verification BOOLEAN;
    v_all_verified BOOLEAN;
    v_task_count INT;
    v_withdrawal_id UUID;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim Lifafa';
    END IF;

    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE code = UPPER(TRIM(p_lifafa_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    IF v_lifafa.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Lifafa is not active. Current status: %', v_lifafa.status;
    END IF;

    IF v_lifafa.expires_at <= TIMEZONE('utc'::text, NOW()) THEN
        UPDATE public.lifafas SET status = 'EXPIRED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'Lifafa has expired';
    END IF;

    IF v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0.00 THEN
        UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'Lifafa pool has been completely claimed';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.lifafa_claims
        WHERE lifafa_id = v_lifafa.id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'You have already claimed this Lifafa';
    END IF;

    SELECT COUNT(*) INTO v_task_count
    FROM public.lifafa_tasks
    WHERE lifafa_id = v_lifafa.id AND is_required = TRUE;

    IF v_task_count > 0 THEN
        SELECT bool_and(is_verified) INTO v_all_verified
        FROM (
            SELECT lt.id, COALESCE(tc.is_verified, FALSE) AS is_verified
            FROM public.lifafa_tasks lt
            LEFT JOIN public.task_completions tc
                ON tc.task_id = lt.id AND tc.user_id = v_user_id
            WHERE lt.lifafa_id = v_lifafa.id AND lt.is_required = TRUE
        ) task_audit;

        IF NOT COALESCE(v_all_verified, FALSE) THEN
            RAISE EXCEPTION 'You must complete all mandatory verification tasks before claiming';
        END IF;
    END IF;

    v_effective_idempotency := COALESCE(
        p_idempotency_key,
        'claim_' || v_lifafa.id::text || '_' || v_user_id::text
    );

    SELECT id, amount INTO v_claim_id, v_claim_amount
    FROM public.lifafa_claims
    WHERE idempotency_key = v_effective_idempotency;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'idempotent', true
        );
    END IF;

    SELECT * INTO v_allocation
    FROM public.lifafa_allocations
    WHERE lifafa_id = v_lifafa.id
      AND is_claimed = FALSE
    ORDER BY allocation_order ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        IF v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0.00 THEN
            UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        END IF;
        RAISE EXCEPTION 'No allocations available to claim in this Lifafa';
    END IF;

    v_claim_amount := v_allocation.amount;

    UPDATE public.lifafa_allocations
    SET is_claimed = TRUE,
        claimed_by = v_user_id,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = remaining_amount - v_claim_amount,
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0.00 
                THEN 'COMPLETED'::lifafa_status 
            ELSE status 
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        IF (p_bank_account_number IS NULL OR TRIM(p_bank_account_number) = '') AND (p_upi_id IS NULL OR TRIM(p_upi_id) = '') THEN
            RAISE EXCEPTION 'Payout details (Bank Account or UPI ID) are required for direct payout Lifafa';
        END IF;

        IF p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) != '' THEN
            IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
                RAISE EXCEPTION 'Valid IFSC code is required when providing bank account number';
            END IF;
            IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
                RAISE EXCEPTION 'Account holder name is required for bank payout';
            END IF;
            v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
            v_encrypted_acc := public.encrypt_bank_account(TRIM(p_bank_account_number));
        ELSE
            IF p_upi_id IS NULL OR NOT (LOWER(TRIM(p_upi_id)) ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
                RAISE EXCEPTION 'Valid UPI ID format required (e.g., username@bank)';
            END IF;
            v_masked_acc := 'UPI: ' || TRIM(p_upi_id);
            v_encrypted_acc := NULL;
        END IF;

        UPDATE public.wallets
        SET reserved_balance = reserved_balance - v_claim_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE user_id = v_lifafa.creator_id;

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
            idempotency_key
        ) VALUES (
            v_user_id,
            v_claim_amount,
            0.00,
            v_claim_amount,
            TRIM(p_account_holder_name),
            v_masked_acc,
            NULL,
            NULLIF(UPPER(TRIM(p_ifsc_code)), ''),
            NULLIF(LOWER(TRIM(p_upi_id)), ''),
            'PENDING',
            'PAYRUPEE',
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        IF v_encrypted_acc IS NOT NULL THEN
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
            'withdrawal_id', v_withdrawal_id,
            'withdrawal_status', 'PENDING',
            'new_balance', v_balance_after
        );

    ELSE
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

        -- Ledger transaction: MUST use valid transaction_status enum value ('SUCCESS'::transaction_status)
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
            'SUCCESS'::transaction_status,
            'LIFAFA_CLAIM',
            v_claim_id,
            'tx_claim_' || v_effective_idempotency,
            v_balance_before,
            v_balance_after,
            jsonb_build_object(
                'lifafa_id', v_lifafa.id,
                'lifafa_code', v_lifafa.code,
                'claim_id', v_claim_id,
                'creator_id', v_lifafa.creator_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
