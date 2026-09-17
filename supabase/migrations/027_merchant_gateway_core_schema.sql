-- ==============================================================================
-- Migration: 027_merchant_gateway_core_schema.sql
-- Description: Core schema for Multi-Merchant Payout Gateway.
--              1. Updates handle_new_user() to bypass consumer profiles/wallets
--                 for users with account_type = 'MERCHANT'.
--              2. Dedicated public.merchants table (Mobile + Password, no KYC).
--              3. Dedicated public.merchant_wallets (isolated from consumer wallets).
--              4. Dedicated public.merchant_ledger_entries (immutable float audit ledger).
--              5. Dedicated public.merchant_api_keys & public.merchant_ip_whitelist.
--              6. Dedicated handle_new_merchant() trigger on auth.users ensuring
--                 guaranteed creation of merchants and merchant_wallets upon signup.
-- Target: Supabase SQL Editor (Manual Execution after Review)
-- ==============================================================================

-- 1. PRESERVE CONSUMER FLOW & BYPASS CONSUMER CREATION FOR MERCHANTS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Strict Isolation Guard: If user signs up as a MERCHANT, bypass consumer profile & wallet creation entirely
    IF (NEW.raw_user_meta_data->>'account_type') = 'MERCHANT' THEN
        RETURN NEW;
    END IF;

    -- Existing consumer profile creation (100% untouched for Google OAuth users)
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        avatar_url,
        last_login_at
    ) VALUES (
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

-- 2. DEDICATED MERCHANTS TABLE
CREATE TABLE IF NOT EXISTS public.merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    merchant_code TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    mobile_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON public.merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_mobile ON public.merchants(mobile_number);
CREATE INDEX IF NOT EXISTS idx_merchants_code ON public.merchants(merchant_code);

-- 3. DEDICATED MERCHANT WALLETS (COMPLETELY ISOLATED FROM public.wallets)
CREATE TABLE IF NOT EXISTS public.merchant_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID UNIQUE NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
    available_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (available_balance >= 0),
    locked_payout_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (locked_payout_balance >= 0),
    total_deposited NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (total_deposited >= 0),
    total_paid_out NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (total_paid_out >= 0),
    total_fees_paid NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (total_fees_paid >= 0),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merchant_wallets_merchant ON public.merchant_wallets(merchant_id);

-- 4. IMMUTABLE MERCHANT AUDIT LEDGER (SINGLE-ACCOUNT AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.merchant_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
    wallet_id UUID NOT NULL REFERENCES public.merchant_wallets(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    fee_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'DEPOSIT_CREDIT',
        'DEPOSIT_FEE',
        'PAYOUT_LOCK',
        'PAYOUT_FEE_LOCK',
        'PAYOUT_CONFIRM',
        'PAYOUT_FEE_CONFIRM',
        'PAYOUT_REFUND',
        'PAYOUT_FEE_REFUND',
        'ADJUSTMENT'
    )),
    reference_type TEXT NOT NULL CHECK (reference_type IN ('DEPOSIT', 'PAYOUT', 'ADJUSTMENT')),
    reference_id TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    balance_before NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mch_ledger_merchant ON public.merchant_ledger_entries(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mch_ledger_idempotency ON public.merchant_ledger_entries(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_mch_ledger_reference ON public.merchant_ledger_entries(reference_type, reference_id);

-- 5. MERCHANT API KEYS (CLIENT ID & SHA-256 SECRET HASH)
CREATE TABLE IF NOT EXISTS public.merchant_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL DEFAULT 'Primary API Key',
    client_id TEXT UNIQUE NOT NULL,
    client_secret_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mch_api_keys_client_id ON public.merchant_api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_mch_api_keys_merchant ON public.merchant_api_keys(merchant_id);

-- 6. MERCHANT IP WHITELIST
CREATE TABLE IF NOT EXISTS public.merchant_ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_merchant_ip UNIQUE (merchant_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_mch_ip_whitelist_merchant ON public.merchant_ip_whitelist(merchant_id);

-- 7. DEDICATED MERCHANT CREATION TRIGGER ON auth.users
-- Automatically guarantees public.merchants and public.merchant_wallets creation for merchants
CREATE OR REPLACE FUNCTION public.handle_new_merchant()
RETURNS TRIGGER AS $$
DECLARE
    v_merchant_id UUID;
    v_merchant_code TEXT;
    v_business_name TEXT;
    v_mobile TEXT;
BEGIN
    -- Strict Isolation Guard: Only execute for users registered as MERCHANT
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

    -- 1. Insert into public.merchants
    INSERT INTO public.merchants (
        user_id,
        merchant_code,
        business_name,
        mobile_number,
        status
    ) VALUES (
        NEW.id,
        v_merchant_code,
        v_business_name,
        v_mobile,
        'ACTIVE'
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_merchant_id;

    -- Handle conflict / re-retrieval if row already existed
    IF v_merchant_id IS NULL THEN
        SELECT id INTO v_merchant_id FROM public.merchants WHERE user_id = NEW.id;
    END IF;

    -- 2. Insert into public.merchant_wallets
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

-- Bind trigger to auth.users for merchant signups
DROP TRIGGER IF EXISTS on_auth_user_created_merchant ON auth.users;
CREATE TRIGGER on_auth_user_created_merchant
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_merchant();

-- 8. DEDICATED MERCHANT AUTO-CONFIRM TRIGGER ON auth.users
-- Guarantees email_confirmed_at is set for synthetic merchant emails upon insert,
-- ensuring immediate session generation even under projects where Supabase email confirmation is enabled.
CREATE OR REPLACE FUNCTION public.handle_merchant_auto_confirm()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.raw_user_meta_data->>'account_type') = 'MERCHANT' THEN
        NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, TIMEZONE('utc'::text, NOW()));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_before_insert_merchant ON auth.users;
CREATE TRIGGER on_auth_user_before_insert_merchant
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_merchant_auto_confirm();
