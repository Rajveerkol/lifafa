-- ==============================================================================
-- Migration: 031_merchant_free_activation_and_unified_auth.sql
-- Description:
--   1. Enforces ₹0 setup fee defaults on public.merchants (setup_fee_amount = 0.00, setup_fee_status = 'PAID').
--   2. Implements secure server-side merchant_onboard_user_rpc() using auth.uid().
--      - Uses existing merchants_user_id_key constraint for database-level concurrency protection.
--      - Creates active merchant with ₹0 fee immediately.
--      - Creates merchant_wallets idempotently.
--   3. Implements admin_link_merchant_to_user_rpc() for explicit, audited re-linking (no guessing).
--   4. Updates handle_new_merchant() trigger function to ₹0 fee model.
--   5. Cleans up legacy setup fee requirement without altering existing status:
--      - setup_fee_status = 'PAID', setup_fee_amount = 0.00, setup_fee_payment_method = 'GRANDFATHERED_FREE', setup_fee_reference = 'EXEMPT_LEGACY'
--      - PRESERVES existing status (ACTIVE, SUSPENDED, PENDING_APPROVAL remain 100% untouched).
--      - PRESERVES setup_fee_paid_at (keeps NULL if fee was never actually paid).
-- Target: Supabase SQL Editor (Manual execution after review — NOT AUTO-APPLIED)
-- ==============================================================================

-- 1. UPDATE DEFAULT COLUMNS ON public.merchants FOR ₹0 ACTIVATION MODEL
ALTER TABLE public.merchants 
    ALTER COLUMN setup_fee_status SET DEFAULT 'PAID',
    ALTER COLUMN setup_fee_amount SET DEFAULT 0.00;

-- 2. SERVER-SIDE RPC FOR ONBOARDING GOOGLE USERS (STRICT SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.merchant_onboard_user_rpc(
    p_business_name TEXT,
    p_mobile_number TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_mobile TEXT;
    v_clean_business TEXT;
    v_merchant_code TEXT;
    v_merchant_id UUID;
    v_existing_merchant public.merchants%ROWTYPE;
    v_wallet public.merchant_wallets%ROWTYPE;
BEGIN
    -- 1. Authentication Guard: Must be signed in via Supabase Auth
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: User must be signed in with Google';
    END IF;

    -- 2. Input Sanitization & Validation
    v_clean_business := TRIM(p_business_name);
    v_clean_mobile := REGEXP_REPLACE(COALESCE(p_mobile_number, ''), '\D', '', 'g');

    IF LENGTH(v_clean_business) < 2 THEN
        RAISE EXCEPTION 'Business name must be at least 2 characters long';
    END IF;

    IF LENGTH(v_clean_mobile) <> 10 THEN
        RAISE EXCEPTION 'Please provide a valid 10-digit Indian mobile number';
    END IF;

    -- 3. Check if user already owns a merchant account (Prevent duplicate accounts per auth.uid())
    SELECT * INTO v_existing_merchant
    FROM public.merchants
    WHERE user_id = v_user_id;

    IF FOUND THEN
        SELECT * INTO v_wallet FROM public.merchant_wallets WHERE merchant_id = v_existing_merchant.id;
        RETURN jsonb_build_object(
            'success', true,
            'is_existing', true,
            'merchant', row_to_json(v_existing_merchant),
            'wallet', row_to_json(v_wallet)
        );
    END IF;

    -- 4. Check Mobile Uniqueness Across Other Merchants (Prevent collision)
    IF EXISTS (SELECT 1 FROM public.merchants WHERE mobile_number = v_clean_mobile AND user_id <> v_user_id) THEN
        RAISE EXCEPTION 'Mobile number is already registered to another merchant account';
    END IF;

    -- 5. Generate Authoritative Merchant Code
    v_merchant_code := 'MCH-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));

    -- 6. Insert Merchant Record (Active, ₹0 Setup Fee, Paid immediately)
    -- Relies on existing database constraint merchants_user_id_key for race condition protection
    INSERT INTO public.merchants (
        user_id,
        merchant_code,
        business_name,
        mobile_number,
        status,
        setup_fee_status,
        setup_fee_amount,
        setup_fee_payment_method,
        setup_fee_paid_at,
        setup_fee_reference
    ) VALUES (
        v_user_id,
        v_merchant_code,
        v_clean_business,
        v_clean_mobile,
        'ACTIVE',
        'PAID',
        0.00,
        'FREE_ACTIVATION',
        TIMEZONE('utc'::text, NOW()),
        'FREE_ACTIVATION_' || v_merchant_code
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_merchant_id;

    -- If a concurrent request created the merchant first, retrieve it safely
    IF v_merchant_id IS NULL THEN
        SELECT * INTO v_existing_merchant FROM public.merchants WHERE user_id = v_user_id;
        SELECT * INTO v_wallet FROM public.merchant_wallets WHERE merchant_id = v_existing_merchant.id;
        RETURN jsonb_build_object(
            'success', true,
            'is_existing', true,
            'merchant', row_to_json(v_existing_merchant),
            'wallet', row_to_json(v_wallet)
        );
    END IF;

    -- 7. Initialize Dedicated Float Wallet (Idempotent)
    INSERT INTO public.merchant_wallets (
        merchant_id,
        available_balance,
        locked_payout_balance,
        total_deposited,
        total_paid_out,
        total_fees_paid
    ) VALUES (
        v_merchant_id,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00
    )
    ON CONFLICT (merchant_id) DO NOTHING;

    -- 8. Fetch complete records to return
    SELECT * INTO v_existing_merchant FROM public.merchants WHERE id = v_merchant_id;
    SELECT * INTO v_wallet FROM public.merchant_wallets WHERE merchant_id = v_merchant_id;

    RETURN jsonb_build_object(
        'success', true,
        'is_existing', false,
        'merchant', row_to_json(v_existing_merchant),
        'wallet', row_to_json(v_wallet)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.merchant_onboard_user_rpc(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_onboard_user_rpc(TEXT, TEXT) TO authenticated;

-- 3. CONTROLLED ADMIN LINKING RPC (EXPLICIT, AUDITED, NO GUESSWORK)
CREATE OR REPLACE FUNCTION public.admin_link_merchant_to_user_rpc(
    p_merchant_id UUID,
    p_target_user_id UUID,
    p_admin_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_mch public.merchants%ROWTYPE;
BEGIN
    IF NOT public.is_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators may re-link merchant ownership';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
        RAISE EXCEPTION 'Target user not found in authentication system';
    END IF;

    IF EXISTS (SELECT 1 FROM public.merchants WHERE user_id = p_target_user_id AND id <> p_merchant_id) THEN
        RAISE EXCEPTION 'Target user already owns another merchant account';
    END IF;

    SELECT * INTO v_mch FROM public.merchants WHERE id = p_merchant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Merchant record not found';
    END IF;

    INSERT INTO public.admin_audit_logs (
        admin_user_id,
        action,
        target_entity,
        target_id,
        metadata
    ) VALUES (
        v_admin_id,
        'MANUAL_MERCHANT_AUTH_LINK',
        'merchants',
        p_merchant_id::text,
        jsonb_build_object(
            'old_user_id', v_mch.user_id,
            'new_user_id', p_target_user_id,
            'notes', p_admin_notes,
            'linked_at', NOW()
        )
    );

    BEGIN
        UPDATE public.merchants
        SET user_id = p_target_user_id,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = p_merchant_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Target user is already linked to another merchant account (unique constraint violated)';
    END;

    RETURN jsonb_build_object('success', true, 'merchant_id', p_merchant_id, 'new_user_id', p_target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_link_merchant_to_user_rpc(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_merchant_to_user_rpc(UUID, UUID, TEXT) TO authenticated;

-- 4. UPDATE handle_new_merchant() TRIGGER TO ZERO SETUP FEE
CREATE OR REPLACE FUNCTION public.handle_new_merchant()
RETURNS TRIGGER AS $$
DECLARE
    v_merchant_id UUID;
    v_merchant_code TEXT;
    v_business_name TEXT;
    v_mobile TEXT;
BEGIN
    IF (NEW.raw_user_meta_data->>'account_type') <> 'MERCHANT' THEN
        RETURN NEW;
    END IF;

    v_business_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'business_name',
        'Merchant Business'
    );
    v_mobile := COALESCE(
        NEW.raw_user_meta_data->>'mobile_number',
        NEW.phone,
        SUBSTRING(NEW.email FROM '^([0-9]+)@'),
        '0000000000'
    );
    v_merchant_code := 'MCH-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));

    INSERT INTO public.merchants (
        user_id,
        merchant_code,
        business_name,
        mobile_number,
        status,
        setup_fee_status,
        setup_fee_amount,
        setup_fee_payment_method,
        setup_fee_paid_at,
        setup_fee_reference
    ) VALUES (
        NEW.id,
        v_merchant_code,
        v_business_name,
        v_mobile,
        'ACTIVE',
        'PAID',
        0.00,
        'FREE_ACTIVATION',
        TIMEZONE('utc'::text, NOW()),
        'FREE_ACTIVATION_' || v_merchant_code
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_merchant_id;

    IF v_merchant_id IS NULL THEN
        SELECT id INTO v_merchant_id FROM public.merchants WHERE user_id = NEW.id;
    END IF;

    IF v_merchant_id IS NOT NULL THEN
        INSERT INTO public.merchant_wallets (
            merchant_id,
            available_balance,
            locked_payout_balance,
            total_deposited,
            total_paid_out,
            total_fees_paid
        ) VALUES (
            v_merchant_id,
            0.00,
            0.00,
            0.00,
            0.00,
            0.00
        )
        ON CONFLICT (merchant_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 5. NON-DESTRUCTIVE CLEANUP OF SETUP FEE REQUIREMENT FOR EXISTING MERCHANTS
-- STRICT DATA SAFETY:
--   - NEVER touches the `status` column!
--   - Preserves existing merchant status (ACTIVE, SUSPENDED, PENDING_APPROVAL remain 100% UNCHANGED).
--   - Does NOT set setup_fee_paid_at = NOW() (preserves NULL if no payment actually occurred).
UPDATE public.merchants
SET setup_fee_status = 'PAID',
    setup_fee_amount = 0.00,
    setup_fee_payment_method = COALESCE(setup_fee_payment_method, 'GRANDFATHERED_FREE'),
    setup_fee_reference = COALESCE(setup_fee_reference, 'EXEMPT_LEGACY')
WHERE setup_fee_status IN ('PAYMENT_REQUIRED', 'PAYMENT_PENDING');
