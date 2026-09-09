-- ==============================================================================
-- Migration: 006_withdrawals_and_payouts.sql
-- Description: Bank/UPI withdrawals, payout abstraction, and webhook logs.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    fee_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    net_amount NUMERIC(12, 2) NOT NULL,
    account_holder_name TEXT NOT NULL,
    bank_account_number_masked TEXT NOT NULL, -- e.g. 'XXXX-XXXX-1234'
    bank_account_encrypted TEXT, -- For real payout worker integration
    ifsc_code TEXT,
    upi_id TEXT,
    status withdrawal_status DEFAULT 'PENDING' NOT NULL,
    payout_provider TEXT DEFAULT 'MANUAL', -- e.g. 'RAZORPAYX', 'CASHFREE', 'MANUAL'
    payout_reference_id TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    processed_at TIMESTAMPTZ,

    CONSTRAINT chk_withdrawal_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_withdrawal_fee_non_negative CHECK (fee_amount >= 0),
    CONSTRAINT chk_withdrawal_net_positive CHECK (net_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_idempotency ON public.withdrawals(idempotency_key);

-- Payout webhook and execution log to prevent duplicate webhook processing
CREATE TABLE IF NOT EXISTS public.payout_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_event_id TEXT UNIQUE,
    provider_reference_id TEXT,
    status TEXT NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payout_tx_withdrawal ON public.payout_transactions(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_payout_provider_event ON public.payout_transactions(provider_event_id);
