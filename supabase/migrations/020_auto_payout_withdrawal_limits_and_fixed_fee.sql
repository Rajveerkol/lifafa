-- ==============================================================================
-- Migration: 020_auto_payout_withdrawal_limits_and_fixed_fee.sql
-- Description:
-- 1. Enforce ₹10.00 min and ₹1,000.00 max withdrawal limits in request_withdrawal_rpc
-- 2. Fixed ₹3.58 platform fee accounting (Wallet deduction = Payout + ₹3.58)
-- 3. Option A accounting: wallets.total_withdrawn tracks net beneficiary payout
-- 4. Dual-entry ledger records: WITHDRAWAL (-payout) and FEE (-₹3.58)
-- 5. Updated admin_update_withdrawal_rpc for service_role support, full refund (gross deduction), and Option A total_withdrawn reversal
-- 6. Update platform_fees table row for WITHDRAWAL to FIXED 3.58
-- 7. Preserve bank-only restrictions and fail-closed Vault encryption
-- ==============================================================================

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
    v_fee NUMERIC(12, 2) := 3.58;
    v_fee_rec RECORD;
    v_payout_amount NUMERIC(12, 2);
    v_total_deduction NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT;
    v_balance_before NUMERIC(12, 2);
    v_balance_mid NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_key TEXT;
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

    -- 2. Server-side safety: strictly Bank Account Only
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

    -- Platform fee calculation: fixed ₹3.58
    SELECT value, calculation_type INTO v_fee_rec
    FROM public.platform_fees
    WHERE fee_type = 'WITHDRAWAL' AND is_active = TRUE;
    
    IF FOUND AND v_fee_rec.calculation_type = 'FIXED' AND v_fee_rec.value > 0 THEN
        v_fee := v_fee_rec.value;
    END IF;

    -- Beneficiary receives p_amount; wallet debited by p_amount + v_fee
    v_payout_amount := p_amount;
    v_total_deduction := v_payout_amount + v_fee;

    -- Concurrency lock on user's wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    IF v_wallet.available_balance < v_total_deduction THEN
        RAISE EXCEPTION 'Insufficient available balance. Required: ₹% (Withdrawal ₹% + Platform Fee ₹%), Available: ₹%',
            v_total_deduction, v_payout_amount, v_fee, v_wallet.available_balance;
    END IF;

    v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
    -- Fail-closed Vault encryption
    v_encrypted_acc := public.encrypt_bank_account(TRIM(p_bank_account_number));

    v_balance_before := v_wallet.available_balance;
    v_balance_mid := v_balance_before - v_payout_amount;
    v_balance_after := v_balance_before - v_total_deduction;

    -- Option A: available_balance debited by gross deduction (payout + fee)
    --           total_withdrawn incremented by net beneficiary payout amount
    UPDATE public.wallets
    SET available_balance = available_balance - v_total_deduction,
        total_withdrawn = total_withdrawn + v_payout_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- Insert withdrawal:
    --   amount = total gross deduction (payout + fee, e.g. 103.58)
    --   fee_amount = fixed fee (3.58)
    --   net_amount = beneficiary payout amount (100.00)
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
        v_total_deduction,
        v_fee,
        v_payout_amount,
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

    -- Dual Ledger Transactions:
    -- Row 1: WITHDRAWAL (-v_payout_amount, e.g. -100.00)
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
        -v_payout_amount,
        'WITHDRAWAL',
        'PENDING'::transaction_status,
        'WITHDRAWAL',
        v_withdrawal_id::text,
        'tx_' || v_key,
        v_balance_before,
        v_balance_mid,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'payout_amount', v_payout_amount,
            'account_holder', TRIM(p_account_holder_name),
            'account_masked', v_masked_acc
        )
    );

    -- Row 2: FEE (-v_fee, e.g. -3.58)
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
        -v_fee,
        'FEE',
        'PENDING'::transaction_status,
        'WITHDRAWAL_FEE',
        v_withdrawal_id::text,
        'tx_fee_' || v_key,
        v_balance_mid,
        v_balance_after,
        jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'fee_amount', v_fee,
            'fee_type', 'WITHDRAWAL_PLATFORM_FEE'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'amount', v_total_deduction,
        'fee', v_fee,
        'net_amount', v_payout_amount,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

GRANT EXECUTE ON FUNCTION public.request_withdrawal_rpc(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Hardened admin_update_withdrawal_rpc:
-- Allows service_role OR admin role; refunds full gross deduction (v_withdrawal.amount); decrements total_withdrawn by net beneficiary amount (Option A)
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_rpc(
    p_withdrawal_id UUID,
    p_new_status withdrawal_status,
    p_payout_reference_id TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_is_service_role BOOLEAN := COALESCE((auth.jwt() ->> 'role'), '') = 'service_role';
    v_withdrawal RECORD;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
BEGIN
    -- Authorization: either service_role (Edge Function) or Administrator/Super Admin
    IF NOT v_is_service_role AND NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Only Administrators or automated service role can update payout status';
    END IF;

    SELECT * INTO v_withdrawal
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal record not found';
    END IF;

    -- Terminal status prevention
    IF v_withdrawal.status IN ('SUCCESS', 'FAILED', 'REVERSED') THEN
        RAISE EXCEPTION 'Withdrawal is already in terminal status (%) and cannot be modified again', v_withdrawal.status;
    END IF;

    -- Update withdrawal record
    UPDATE public.withdrawals
    SET status = p_new_status,
        payout_reference_id = COALESCE(p_payout_reference_id, payout_reference_id),
        rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
        processed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_withdrawal_id;

    -- If FAILED or REVERSED, refund user's available balance EXACTLY ONCE
    IF p_new_status IN ('FAILED', 'REVERSED') THEN
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_withdrawal.user_id
        FOR UPDATE;

        IF FOUND THEN
            v_balance_before := v_wallet.available_balance;
            v_balance_after := v_balance_before + v_withdrawal.amount;

            -- Refund full gross deduction (amount = payout + fee)
            -- Decrement total_withdrawn by net payout (Option A)
            UPDATE public.wallets
            SET available_balance = available_balance + v_withdrawal.amount,
                total_withdrawn = GREATEST(0, total_withdrawn - v_withdrawal.net_amount),
                updated_at = TIMEZONE('utc'::text, NOW())
            WHERE id = v_wallet.id;

            -- Create double-entry reversal transaction
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
                v_withdrawal.user_id,
                v_wallet.id,
                v_withdrawal.amount,
                'WITHDRAWAL_REVERSAL',
                'SUCCESS'::transaction_status,
                'WITHDRAWAL_REVERSAL',
                p_withdrawal_id::text,
                'reversal_' || p_withdrawal_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
                v_balance_before,
                v_balance_after,
                jsonb_build_object(
                    'reason', p_rejection_reason,
                    'previous_status', v_withdrawal.status,
                    'refunded_gross_amount', v_withdrawal.amount,
                    'refunded_fee', v_withdrawal.fee_amount,
                    'refunded_net_payout', v_withdrawal.net_amount
                )
            );
        END IF;
    END IF;

    -- Audit Log (only logged if an admin user initiated the update)
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO public.admin_audit_logs (
            admin_id,
            action,
            target_type,
            target_id,
            details
        ) VALUES (
            v_admin_id,
            'WITHDRAWAL_' || p_new_status::text,
            'WITHDRAWAL',
            p_withdrawal_id::text,
            jsonb_build_object(
                'old_status', v_withdrawal.status,
                'new_status', p_new_status,
                'payout_reference_id', p_payout_reference_id,
                'rejection_reason', p_rejection_reason
            )
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_rpc(UUID, withdrawal_status, TEXT, TEXT) TO authenticated;

-- Update platform_fees table for WITHDRAWAL to fixed ₹3.58
UPDATE public.platform_fees
SET value = 3.58,
    calculation_type = 'FIXED',
    is_active = TRUE,
    updated_at = TIMEZONE('utc'::text, NOW())
WHERE fee_type = 'WITHDRAWAL';
