-- ==============================================================================
-- Migration: 003_wallets_and_ledger.sql
-- Description: Financial wallet architecture and double-entry ledger transactions.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    available_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    reserved_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    total_earned NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    total_withdrawn NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    -- Financial invariant constraints: Never allow negative balances
    CONSTRAINT chk_available_balance_non_negative CHECK (available_balance >= 0),
    CONSTRAINT chk_reserved_balance_non_negative CHECK (reserved_balance >= 0),
    CONSTRAINT chk_total_earned_non_negative CHECK (total_earned >= 0),
    CONSTRAINT chk_total_withdrawn_non_negative CHECK (total_withdrawn >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);

-- Double-Entry Ledger for all financial events
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    type transaction_type NOT NULL,
    status transaction_status DEFAULT 'SUCCESS' NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    balance_before NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_idempotency ON public.wallet_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON public.wallet_transactions(reference_type, reference_id);

-- Automatically create wallet upon profile insertion
CREATE OR REPLACE FUNCTION public.handle_user_wallet_init()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, available_balance, reserved_balance, total_earned, total_withdrawn)
    VALUES (NEW.id, 0.00, 0.00, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_profile_created_init_wallet ON public.profiles;
CREATE TRIGGER on_profile_created_init_wallet
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_wallet_init();
