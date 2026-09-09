-- ==============================================================================
-- Migration: 014_manual_deposits.sql
-- Description: Manual UPI deposit workflow with UTR verification and admin approval.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

-- 1. Platform Settings Table (for authoritative configurable settings such as DEPOSIT_UPI_ID)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Seed default deposit settings if not already present
INSERT INTO public.platform_settings (key, value, description)
VALUES 
    ('DEPOSIT_UPI_ID', 'createlifafa@upi', 'Authoritative platform UPI ID for user manual deposits'),
    ('DEPOSIT_PAYEE_NAME', 'CreatLifafa', 'Merchant/Payee name displayed in UPI apps and deposit modal'),
    ('DEPOSIT_QR_IMAGE_URL', '', 'Custom QR Code image URL or base64 data for manual deposit modal'),
    ('DEPOSIT_QR_MODE', 'DYNAMIC', 'QR mode: DYNAMIC (auto QR with amount) or CUSTOM_IMAGE')
ON CONFLICT (key) DO NOTHING;

-- 2. Deposit Requests Table
CREATE TABLE IF NOT EXISTS public.deposit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 1.00),
    upi_id TEXT NOT NULL,
    utr_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    admin_notes TEXT,
    processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for querying deposit requests
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user ON public.deposit_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON public.deposit_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_utr ON public.deposit_requests(utr_number);

-- 3. Row Level Security Policies
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

-- Platform settings RLS: Authenticated users can read (needed to fetch official UPI ID)
DROP POLICY IF EXISTS "Authenticated users can view platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated users can view platform settings"
    ON public.platform_settings
    FOR SELECT
    TO authenticated
    USING (TRUE);

-- Platform settings RLS: Only Admins can modify settings
DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Admins can update platform settings"
    ON public.platform_settings
    FOR ALL
    TO authenticated
    USING (public.has_admin_role('ADMIN') OR public.has_admin_role('SUPER_ADMIN'))
    WITH CHECK (public.has_admin_role('ADMIN') OR public.has_admin_role('SUPER_ADMIN'));

-- Deposit requests RLS: Users can view their own requests
DROP POLICY IF EXISTS "Users can view own deposit requests" ON public.deposit_requests;
CREATE POLICY "Users can view own deposit requests"
    ON public.deposit_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Deposit requests RLS: Admins can view all deposit requests
DROP POLICY IF EXISTS "Admins can view all deposit requests" ON public.deposit_requests;
CREATE POLICY "Admins can view all deposit requests"
    ON public.deposit_requests
    FOR SELECT
    TO authenticated
    USING (public.has_admin_role('SUPPORT') OR public.has_admin_role('ADMIN') OR public.has_admin_role('SUPER_ADMIN'));

-- 4. RPC: submit_deposit_request_rpc
-- Submits a deposit request with server-authoritative UPI ID from platform_settings
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
BEGIN
    -- 1. Authentication Check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit deposit request';
    END IF;

    -- 2. Validate Amount
    IF p_amount IS NULL OR p_amount < 1.00 THEN
        RAISE EXCEPTION 'Deposit amount must be at least ₹1.00';
    END IF;

    -- 3. Clean and Validate UTR Number
    v_clean_utr := UPPER(TRIM(p_utr_number));
    IF v_clean_utr IS NULL OR LENGTH(v_clean_utr) < 6 OR LENGTH(v_clean_utr) > 30 THEN
        RAISE EXCEPTION 'Invalid UTR/Transaction reference number. Must be 6-30 alphanumeric characters.';
    END IF;

    -- Check if UTR has already been submitted
    IF EXISTS (SELECT 1 FROM public.deposit_requests WHERE utr_number = v_clean_utr) THEN
        RAISE EXCEPTION 'This UTR number (%) has already been submitted. Please check your deposit history.', v_clean_utr;
    END IF;

    -- 4. Authoritative UPI ID retrieval directly from public.platform_settings (NEVER trust client input)
    SELECT value INTO v_authoritative_upi_id
    FROM public.platform_settings
    WHERE key = 'DEPOSIT_UPI_ID';

    IF v_authoritative_upi_id IS NULL OR TRIM(v_authoritative_upi_id) = '' THEN
        v_authoritative_upi_id := 'createlifafa@upi';
    END IF;

    -- 5. Insert Deposit Request
    INSERT INTO public.deposit_requests (
        user_id,
        amount,
        upi_id,
        utr_number,
        status
    ) VALUES (
        v_user_id,
        p_amount,
        v_authoritative_upi_id,
        v_clean_utr,
        'PENDING'
    )
    RETURNING id INTO v_deposit_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'deposit_id', v_deposit_id,
        'amount', p_amount,
        'upi_id', v_authoritative_upi_id,
        'utr_number', v_clean_utr,
        'status', 'PENDING',
        'message', 'Deposit request submitted successfully. Awaiting administrator verification.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. RPC: admin_review_deposit_rpc
-- Strictly idempotent review: approved deposits credit wallet and write ledger exactly once
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
    -- 1. Authorization Check (Only ADMIN or SUPER_ADMIN)
    IF NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can review and approve deposits';
    END IF;

    IF p_action NOT IN ('APPROVE', 'REJECT') THEN
        RAISE EXCEPTION 'Invalid review action. Must be APPROVE or REJECT.';
    END IF;

    -- 2. Concurrency Lock: Lock the deposit request row
    SELECT * INTO v_deposit
    FROM public.deposit_requests
    WHERE id = p_deposit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deposit request % not found', p_deposit_id;
    END IF;

    -- 3. Strict Idempotency Check: Request must be currently in PENDING status
    IF v_deposit.status != 'PENDING' THEN
        RAISE EXCEPTION 'Deposit request % is already processed with status %', p_deposit_id, v_deposit.status;
    END IF;

    v_idempotency_key := 'deposit_approve_' || p_deposit_id::text;

    -- 4. Process APPROVE
    IF p_action = 'APPROVE' THEN
        -- Check if a ledger transaction with this idempotency key already exists
        IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE idempotency_key = v_idempotency_key) THEN
            RAISE EXCEPTION 'Ledger transaction for deposit % already exists. Double-credit prevented.', p_deposit_id;
        END IF;

        -- Concurrency Lock: Lock target user's wallet row
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = v_deposit.user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'User wallet not found for user %', v_deposit.user_id;
        END IF;

        v_balance_before := v_wallet.available_balance;
        v_balance_after := v_balance_before + v_deposit.amount;

        -- Atomic Wallet Balance Credit
        UPDATE public.wallets
        SET available_balance = v_balance_after,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_wallet.id;

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
                'reviewed_by', v_admin_id,
                'admin_notes', p_notes
            )
        );

        -- Update Deposit Request Status to APPROVED
        UPDATE public.deposit_requests
        SET status = 'APPROVED',
            processed_by = v_admin_id,
            processed_at = TIMEZONE('utc'::text, NOW()),
            admin_notes = p_notes,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = p_deposit_id;

        -- Create in-app notification for the user
        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (
            v_deposit.user_id,
            'Deposit Approved! ₹' || v_deposit.amount::text,
            'Your manual UPI deposit of ₹' || v_deposit.amount::text || ' (UTR: ' || v_deposit.utr_number || ') has been verified and added to your wallet balance.',
            'SYSTEM',
            p_deposit_id::text
        );

        -- Write Admin Audit Log
        INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
        VALUES (
            v_admin_id,
            'APPROVE_DEPOSIT',
            'DEPOSIT_REQUEST',
            p_deposit_id::text,
            jsonb_build_object(
                'amount', v_deposit.amount,
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

    -- 5. Process REJECT
    ELSIF p_action = 'REJECT' THEN
        -- Update Deposit Request Status to REJECTED (Wallet remains untouched)
        UPDATE public.deposit_requests
        SET status = 'REJECTED',
            processed_by = v_admin_id,
            processed_at = TIMEZONE('utc'::text, NOW()),
            admin_notes = p_notes,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = p_deposit_id;

        -- Create in-app notification for the user
        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (
            v_deposit.user_id,
            'Deposit Request Rejected',
            'Your manual UPI deposit request of ₹' || v_deposit.amount::text || ' (UTR: ' || v_deposit.utr_number || ') was rejected: ' || COALESCE(p_notes, 'UTR reference could not be verified in platform accounts.'),
            'SYSTEM',
            p_deposit_id::text
        );

        -- Write Admin Audit Log
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

-- 6. RPC: admin_update_platform_setting_rpc
-- Allows administrators to configure settings like DEPOSIT_UPI_ID
CREATE OR REPLACE FUNCTION public.admin_update_platform_setting_rpc(
    p_key TEXT,
    p_value TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can update platform settings';
    END IF;

    IF p_key IS NULL OR TRIM(p_key) = '' THEN
        RAISE EXCEPTION 'Setting key cannot be empty';
    END IF;

    INSERT INTO public.platform_settings (key, value, description, updated_at)
    VALUES (p_key, p_value, p_description, TIMEZONE('utc'::text, NOW()))
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        description = COALESCE(EXCLUDED.description, public.platform_settings.description),
        updated_at = TIMEZONE('utc'::text, NOW());

    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
    VALUES (
        v_admin_id,
        'UPDATE_SETTING',
        'PLATFORM_SETTINGS',
        p_key,
        jsonb_build_object('key', p_key, 'new_value', p_value)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'key', p_key,
        'value', p_value
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
