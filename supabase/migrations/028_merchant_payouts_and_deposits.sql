-- ==============================================================================
-- Migration: 028_merchant_payouts_and_deposits.sql
-- Description: Multi-Merchant Payouts, Isolated Vault Bank Credentials,
--              Manual UPI Deposits with 2% fee tracking, and Inbound Webhook Events.
-- Target: Supabase SQL Editor (Manual Execution after Review)
-- ==============================================================================

-- 1. DEDICATED MERCHANT PAYOUTS (ISOLATED FROM public.withdrawals)
CREATE TABLE IF NOT EXISTS public.merchant_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
    order_id TEXT NOT NULL,
    provider_order_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    fee_amount NUMERIC(12, 2) NOT NULL CHECK (fee_amount >= 0),
    total_deducted NUMERIC(12, 2) NOT NULL CHECK (total_deducted >= amount),
    account_holder_name TEXT NOT NULL,
    bank_account_number_masked TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED')),
    payout_provider TEXT DEFAULT 'PAYRUPEE' NOT NULL,
    provider_reference_id TEXT,
    rejection_reason TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_merchant_order UNIQUE (merchant_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_mch_payouts_merchant ON public.merchant_payouts(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mch_payouts_status ON public.merchant_payouts(status);
CREATE INDEX IF NOT EXISTS idx_mch_payouts_provider_order ON public.merchant_payouts(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_mch_payouts_idempotency ON public.merchant_payouts(idempotency_key);

-- 2. DEDICATED ISOLATED BANK CREDENTIALS (VAULT ENCRYPTED, 0 POSTGREST ACCESS)
CREATE TABLE IF NOT EXISTS public.merchant_payout_bank_credentials (
    payout_id UUID PRIMARY KEY REFERENCES public.merchant_payouts(id) ON DELETE CASCADE,
    encrypted_account_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on credentials table immediately
ALTER TABLE public.merchant_payout_bank_credentials ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from public, anon, and authenticated
REVOKE ALL ON TABLE public.merchant_payout_bank_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.merchant_payout_bank_credentials TO service_role;

-- 3. DEDICATED MERCHANT DEPOSITS (MANUAL UPI, 2% FEE, ADMIN REVIEW ONLY)
CREATE TABLE IF NOT EXISTS public.merchant_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
    gross_amount NUMERIC(12, 2) NOT NULL CHECK (gross_amount > 0),
    deposit_fee NUMERIC(12, 2) NOT NULL CHECK (deposit_fee >= 0),
    net_credited NUMERIC(12, 2) NOT NULL CHECK (net_credited > 0),
    utr_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mch_deposits_merchant ON public.merchant_deposits(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mch_deposits_status ON public.merchant_deposits(status);
CREATE INDEX IF NOT EXISTS idx_mch_deposits_utr ON public.merchant_deposits(utr_number);

-- 4. INBOUND PAYRUPEE WEBHOOK IDEMPOTENCY & AUDIT LOG
CREATE TABLE IF NOT EXISTS public.merchant_payout_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id TEXT UNIQUE NOT NULL,
    payout_id UUID REFERENCES public.merchant_payouts(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mch_payout_events_id ON public.merchant_payout_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_mch_payout_events_payout ON public.merchant_payout_events(payout_id);

-- 5. SEED CENTRALIZED GATEWAY CONFIGURATION IN PLATFORM SETTINGS
INSERT INTO public.platform_settings (key, value, description)
VALUES 
    ('MERCHANT_MIN_PAYOUT_AMOUNT', '10.00', 'Configurable minimum merchant payout amount (admin controlled)'),
    ('MERCHANT_MAX_PAYOUT_AMOUNT', '1000.00', 'Maximum single merchant payout amount supported by tier structure'),
    ('MERCHANT_DEPOSIT_FEE_PERCENT', '2.00', 'Standard 2% platform fee on approved merchant UPI deposits'),
    ('MERCHANT_PAYOUT_FEE_TIER1_MAX', '100.00', 'Ceiling amount for Tier 1 payout fee'),
    ('MERCHANT_PAYOUT_FEE_TIER1', '3.70', 'Flat ₹3.70 fee for payouts <= ₹100.00'),
    ('MERCHANT_PAYOUT_FEE_TIER2_MAX', '1000.00', 'Ceiling amount for Tier 2 payout fee'),
    ('MERCHANT_PAYOUT_FEE_TIER2', '3.80', 'Flat ₹3.80 fee for payouts > ₹100.00 and <= ₹1000.00'),
    ('MERCHANT_SETUP_FEE_STATUS', 'PENDING_SPECIFICATION', 'Open decision: ₹999 setup charge payment mechanism is left unimplemented until specified')
ON CONFLICT (key) DO NOTHING;
