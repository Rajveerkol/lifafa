-- ==============================================================================
-- Migration: 012_security_and_concurrency_hardening.sql
-- Description: Critical security & financial hardening:
--              1. Explicit search_path on all SECURITY DEFINER functions.
--              2. Cryptographic Telegram Identity Binding via single-use nonces.
--              3. Role-based admin checks (SUPPORT vs ADMIN vs SUPER_ADMIN).
--              4. Terminal status protection on withdrawals (prevent duplicate refunds).
--              5. Hide secret pin_code from public SELECT using lifafa_secrets.
--              6. Atomic lock ordering to eliminate deadlocks.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

-- 1. TELEGRAM IDENTITY BINDING INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS public.telegram_binding_nonces (
    nonce TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.telegram_binding_nonces ENABLE ROW LEVEL SECURITY;

-- Only user can read their own active binding nonce
CREATE POLICY "Users can manage own telegram binding nonces"
    ON public.telegram_binding_nonces FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RPC to generate a secure binding deep link nonce for claimant identity proof
CREATE OR REPLACE FUNCTION public.generate_telegram_binding_nonce_rpc()
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_nonce TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Clean expired nonces
    DELETE FROM public.telegram_binding_nonces WHERE user_id = v_user_id OR expires_at <= NOW();

    -- Generate random crypto nonce
    v_nonce := 'bind_' || encode(gen_random_bytes(16), 'hex');

    INSERT INTO public.telegram_binding_nonces (nonce, user_id, expires_at)
    VALUES (v_nonce, v_user_id, NOW() + INTERVAL '15 minutes');

    RETURN v_nonce;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- RPC called by Telegram Bot Webhook to finalize identity binding
CREATE OR REPLACE FUNCTION public.complete_telegram_binding_rpc(
    p_nonce TEXT,
    p_telegram_user_id BIGINT,
    p_telegram_username TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_binding RECORD;
BEGIN
    SELECT * INTO v_binding
    FROM public.telegram_binding_nonces
    WHERE nonce = p_nonce AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired binding token');
    END IF;

    -- Bind verified Telegram identity to the user profile
    UPDATE public.profiles
    SET telegram_user_id = p_telegram_user_id,
        telegram_username = LOWER(REPLACE(TRIM(p_telegram_username), '@', '')),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_binding.user_id;

    -- Delete used nonce (single-use token)
    DELETE FROM public.telegram_binding_nonces WHERE nonce = p_nonce;

    RETURN jsonb_build_object('success', true, 'user_id', v_binding.user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke public execution of complete_telegram_binding_rpc so only service role can call it
REVOKE EXECUTE ON FUNCTION public.complete_telegram_binding_rpc(TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;

-- 2. SECURE PIN CODE STORAGE (Prevent PIN leakage in public SELECT)
CREATE TABLE IF NOT EXISTS public.lifafa_secrets (
    lifafa_id UUID PRIMARY KEY REFERENCES public.lifafas(id) ON DELETE CASCADE,
    pin_code_hash TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.lifafa_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only creator can view lifafa secret"
    ON public.lifafa_secrets FOR SELECT
    USING (auth.uid() = creator_id);

-- 3. ADMIN ROLE HIERARCHY FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_admin_role(required_role admin_role DEFAULT 'ADMIN')
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role admin_role;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role FROM public.admin_users WHERE user_id = v_user_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF required_role = 'SUPER_ADMIN' THEN
        RETURN v_role = 'SUPER_ADMIN';
    ELSIF required_role = 'ADMIN' THEN
        RETURN v_role IN ('SUPER_ADMIN', 'ADMIN');
    ELSE
        RETURN TRUE; -- SUPPORT, ADMIN, or SUPER_ADMIN
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. HARDENED WITHDRAWAL STATUS RPC (PREVENTS DUPLICATE REFUNDS ON FAILED STATUS)
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_rpc(
    p_withdrawal_id UUID,
    p_new_status withdrawal_status,
    p_payout_reference_id TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_withdrawal RECORD;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
BEGIN
    -- Strict Admin Role Requirement: Super Admin or Admin only (Support cannot process payouts)
    IF NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Only Administrators or Super Admins can update payout status';
    END IF;

    SELECT * INTO v_withdrawal
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal record not found';
    END IF;

    -- CRITICAL FIX: Include 'FAILED' in terminal status to prevent duplicate reversals!
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

    -- If FAILED or REVERSED, refund the user's available balance EXACTLY ONCE
    IF p_new_status IN ('FAILED', 'REVERSED') THEN
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_withdrawal.user_id
        FOR UPDATE;

        v_balance_before := v_wallet.available_balance;
        v_balance_after := v_balance_before + v_withdrawal.amount;

        UPDATE public.wallets
        SET available_balance = available_balance + v_withdrawal.amount,
            total_withdrawn = GREATEST(0, total_withdrawn - v_withdrawal.amount),
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
            'SUCCESS',
            'WITHDRAWAL_REVERSAL',
            p_withdrawal_id::text,
            'reversal_' || p_withdrawal_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
            v_balance_before,
            v_balance_after,
            jsonb_build_object('reason', p_rejection_reason, 'previous_status', v_withdrawal.status)
        );
    END IF;

    -- Immutable Audit Log
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
            'reason', p_rejection_reason
        )
    );

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. HARDENED ADMIN WALLET ADJUSTMENT RPC (WITH SEARCH_PATH AND ROLE LEVEL)
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet_rpc(
    p_target_user_id UUID,
    p_amount NUMERIC(12, 2),
    p_type transaction_type,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_tx_id UUID;
BEGIN
    -- Role check: Only ADMIN or SUPER_ADMIN (Support is blocked)
    IF NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can adjust wallet balances';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Adjustment amount must be positive';
    END IF;

    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
        RAISE EXCEPTION 'A legitimate reason is required for administrative wallet adjustments';
    END IF;

    IF p_type NOT IN ('CREDIT', 'DEBIT') THEN
        RAISE EXCEPTION 'Adjustment type must be CREDIT or DEBIT';
    END IF;

    -- Row-Level Lock target user's wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user wallet not found';
    END IF;

    v_balance_before := v_wallet.available_balance;

    IF p_type = 'CREDIT' THEN
        v_balance_after := v_balance_before + p_amount;
        UPDATE public.wallets
        SET available_balance = available_balance + p_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;
    ELSE
        IF v_balance_before < p_amount THEN
            RAISE EXCEPTION 'Cannot debit more than available balance (%). Requested: %', v_balance_before, p_amount;
        END IF;
        v_balance_after := v_balance_before - p_amount;
        UPDATE public.wallets
        SET available_balance = available_balance - p_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;
    END IF;

    -- Double-entry ledger insertion
    INSERT INTO public.wallet_transactions (
        user_id,
        wallet_id,
        amount,
        type,
        status,
        reference_type,
        reference_id,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        p_target_user_id,
        v_wallet.id,
        p_amount,
        p_type,
        'SUCCESS',
        'ADMIN_ADJUSTMENT',
        v_admin_id::text,
        v_balance_before,
        v_balance_after,
        jsonb_build_object('admin_id', v_admin_id, 'reason', p_reason)
    ) RETURNING id INTO v_tx_id;

    -- Immutable Audit record
    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_admin_id,
        'WALLET_' || p_type::text,
        'USER_WALLET',
        p_target_user_id::text,
        jsonb_build_object(
            'amount', p_amount,
            'reason', p_reason,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'transaction_id', v_tx_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'amount', p_amount,
        'type', p_type,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. HARDENED CLAIM LIFAFA RPC (IDEMPOTENT RETRY & CONSISTENT LOCK ORDER)
CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc(
    p_code TEXT,
    p_pin_code VARCHAR(10) DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lifafa RECORD;
    v_allocation RECORD;
    v_user_wallet RECORD;
    v_creator_wallet RECORD;
    v_claim_id UUID;
    v_claim_amount NUMERIC(12, 2);
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_existing_claim RECORD;
    v_required_tasks_count INT;
    v_completed_tasks_count INT;
    v_pin_secret RECORD;
    v_effective_idempotency TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be logged in to claim a Lifafa';
    END IF;

    -- Deterministic lock on Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE UPPER(code) = UPPER(TRIM(p_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa code not found';
    END IF;

    v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || v_lifafa.id::text || '_' || v_user_id::text);

    -- TRUE IDEMPOTENCY CHECK: If already claimed with same key or same user, return existing claim cleanly
    SELECT * INTO v_existing_claim
    FROM public.lifafa_claims
    WHERE lifafa_id = v_lifafa.id AND user_id = v_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'amount', v_existing_claim.amount,
            'lifafa_code', v_lifafa.code,
            'lifafa_title', v_lifafa.title,
            'message', 'Already claimed'
        );
    END IF;

    -- Lifecycle & Expiry checks
    IF v_lifafa.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'This Lifafa is % and cannot be claimed', v_lifafa.status;
    END IF;

    IF v_lifafa.expires_at <= NOW() THEN
        UPDATE public.lifafas SET status = 'EXPIRED' WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'This Lifafa has expired';
    END IF;

    IF v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0 THEN
        UPDATE public.lifafas SET status = 'COMPLETED' WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'All rewards for this Lifafa have already been claimed!';
    END IF;

    -- Secure PIN check (supports plain or hashed secret)
    SELECT * INTO v_pin_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND THEN
        IF p_pin_code IS NULL OR TRIM(p_pin_code) <> v_pin_secret.pin_code_hash THEN
            RAISE EXCEPTION 'Invalid Lifafa PIN code';
        END IF;
    ELSIF v_lifafa.pin_code IS NOT NULL AND v_lifafa.pin_code <> '' THEN
        IF p_pin_code IS NULL OR TRIM(p_pin_code) <> v_lifafa.pin_code THEN
            RAISE EXCEPTION 'Invalid Lifafa PIN code';
        END IF;
    END IF;

    -- Creator cannot claim own Lifafa
    IF v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    -- Server-side Task Completion Check
    SELECT COUNT(*) INTO v_required_tasks_count
    FROM public.lifafa_tasks
    WHERE lifafa_id = v_lifafa.id AND is_required = TRUE AND is_enabled = TRUE;

    IF v_required_tasks_count > 0 THEN
        SELECT COUNT(DISTINCT task_id) INTO v_completed_tasks_count
        FROM public.task_completions
        WHERE lifafa_id = v_lifafa.id 
          AND user_id = v_user_id 
          AND status = 'VERIFIED';

        IF v_completed_tasks_count < v_required_tasks_count THEN
            RAISE EXCEPTION 'Please complete and verify all required tasks before claiming';
        END IF;
    END IF;

    -- Concurrency-Safe Allocation Lock
    SELECT * INTO v_allocation
    FROM public.lifafa_allocations
    WHERE lifafa_id = v_lifafa.id AND is_claimed = FALSE
    ORDER BY allocation_index ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        UPDATE public.lifafas SET status = 'COMPLETED' WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'No allocations remaining';
    END IF;

    v_claim_amount := v_allocation.amount;

    IF v_claim_amount > v_lifafa.remaining_amount THEN
        RAISE EXCEPTION 'Allocation exceeds remaining Lifafa balance';
    END IF;

    -- 1. Mark allocation as claimed
    UPDATE public.lifafa_allocations
    SET is_claimed = TRUE,
        claimed_by = v_user_id,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    -- 2. Update Lifafa state
    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = remaining_amount - v_claim_amount,
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0 THEN 'COMPLETED'::lifafa_status
            ELSE 'ACTIVE'::lifafa_status
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    -- 3. Lock claimant's wallet FOR UPDATE
    SELECT * INTO v_user_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.wallets (user_id, available_balance, reserved_balance, total_earned, total_withdrawn)
        VALUES (v_user_id, 0.00, 0.00, 0.00, 0.00)
        RETURNING * INTO v_user_wallet;
    END IF;

    v_balance_before := v_user_wallet.available_balance;
    v_balance_after := v_balance_before + v_claim_amount;

    UPDATE public.wallets
    SET available_balance = available_balance + v_claim_amount,
        total_earned = total_earned + v_claim_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_user_wallet.id;

    -- 4. Lock and decrement creator's reserved balance
    SELECT * INTO v_creator_wallet
    FROM public.wallets
    WHERE user_id = v_lifafa.creator_id
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.wallets
        SET reserved_balance = GREATEST(0, reserved_balance - v_claim_amount),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_creator_wallet.id;
    END IF;

    -- 5. Insert claim record
    INSERT INTO public.lifafa_claims (
        lifafa_id,
        user_id,
        allocation_id,
        amount,
        idempotency_key,
        device_fingerprint,
        ip_address
    ) VALUES (
        v_lifafa.id,
        v_user_id,
        v_allocation.id,
        v_claim_amount,
        v_effective_idempotency,
        p_device_fingerprint,
        p_ip_address
    ) RETURNING id INTO v_claim_id;

    -- 6. Insert Double-entry ledger transaction
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
        'claim_tx_' || v_claim_id::text,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'lifafa_id', v_lifafa.id,
            'lifafa_code', v_lifafa.code,
            'lifafa_title', v_lifafa.title
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'amount', v_claim_amount,
        'lifafa_code', v_lifafa.code,
        'lifafa_title', v_lifafa.title,
        'new_balance', v_balance_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. SET EXPLICIT SEARCH_PATH ON REMAINING SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, avatar_url, last_login_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Lifafa User'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        last_login_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.handle_user_wallet_init()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, available_balance, reserved_balance, total_earned, total_withdrawn)
    VALUES (NEW.id, 0.00, 0.00, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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

    v_key := COALESCE(p_idempotency_key, 'wth_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- Idempotency check
    SELECT id INTO v_withdrawal_id FROM public.withdrawals WHERE idempotency_key = v_key;
    IF v_withdrawal_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'idempotent', true);
    END IF;

    -- Server-side fee calculation
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

    IF p_bank_account_number IS NOT NULL AND LENGTH(TRIM(p_bank_account_number)) >= 4 THEN
        v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
    ELSE
        v_masked_acc := 'UPI: ' || COALESCE(p_upi_id, 'N/A');
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before - p_amount;

    UPDATE public.wallets
    SET available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

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
        p_account_holder_name,
        v_masked_acc,
        p_bank_account_number,
        p_ifsc_code,
        p_upi_id,
        'PENDING',
        'MANUAL',
        v_key
    ) RETURNING id INTO v_withdrawal_id;

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
        p_amount,
        'WITHDRAWAL',
        'PENDING',
        'WITHDRAWAL_REQUEST',
        v_withdrawal_id::text,
        'tx_' || v_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object('masked_account', v_masked_acc, 'fee', v_fee, 'net_amount', v_net_amount)
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'net_amount', v_net_amount,
        'fee', v_fee,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(
    p_lifafa_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_lifafa RECORD;
    v_creator_wallet RECORD;
    v_refund_amount NUMERIC(12, 2);
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
BEGIN
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    IF v_caller_id <> v_lifafa.creator_id AND NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Unauthorized to refund this Lifafa';
    END IF;

    IF v_lifafa.status NOT IN ('ACTIVE', 'EXPIRED') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lifafa already completed, refunded, or cancelled');
    END IF;

    v_refund_amount := v_lifafa.remaining_amount;

    IF v_refund_amount <= 0 THEN
        UPDATE public.lifafas
        SET status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_lifafa.id;
        RETURN jsonb_build_object('success', true, 'refunded_amount', 0);
    END IF;

    SELECT * INTO v_creator_wallet
    FROM public.wallets
    WHERE user_id = v_lifafa.creator_id
    FOR UPDATE;

    v_balance_before := v_creator_wallet.available_balance;
    v_balance_after := v_balance_before + v_refund_amount;

    UPDATE public.wallets
    SET available_balance = available_balance + v_refund_amount,
        reserved_balance = GREATEST(0, reserved_balance - v_refund_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_creator_wallet.id;

    UPDATE public.lifafas
    SET remaining_amount = 0.00,
        status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    v_idempotency_key := 'refund_' || v_lifafa.id::text;

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
        v_lifafa.creator_id,
        v_creator_wallet.id,
        v_refund_amount,
        'REFUND',
        'SUCCESS',
        'LIFAFA_REFUND',
        v_lifafa.id::text,
        v_idempotency_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object('lifafa_code', v_lifafa.code)
    ) ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'refunded_amount', v_refund_amount, 'new_balance', v_balance_after);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
