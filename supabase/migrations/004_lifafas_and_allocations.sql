-- ==============================================================================
-- Migration: 004_lifafas_and_allocations.sql
-- Description: Lifafas, atomic allocations, and unique claim constraints.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.lifafas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    message TEXT,
    total_amount NUMERIC(12, 2) NOT NULL,
    winner_count INT NOT NULL,
    distribution_type distribution_type NOT NULL,
    claimed_count INT DEFAULT 0 NOT NULL,
    remaining_amount NUMERIC(12, 2) NOT NULL,
    status lifafa_status DEFAULT 'ACTIVE' NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_public BOOLEAN DEFAULT TRUE NOT NULL,
    pin_code VARCHAR(10),
    max_claims_per_user INT DEFAULT 1 NOT NULL,
    min_claim_amount NUMERIC(12, 2),
    max_claim_amount NUMERIC(12, 2),
    allow_cancel BOOLEAN DEFAULT TRUE NOT NULL,
    show_remaining BOOLEAN DEFAULT TRUE NOT NULL,
    creator_note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    -- Financial constraints
    CONSTRAINT chk_lifafa_total_positive CHECK (total_amount > 0),
    CONSTRAINT chk_lifafa_winners_positive CHECK (winner_count > 0),
    CONSTRAINT chk_lifafa_remaining_non_negative CHECK (remaining_amount >= 0),
    CONSTRAINT chk_lifafa_claimed_count CHECK (claimed_count <= winner_count)
);

CREATE INDEX IF NOT EXISTS idx_lifafas_code ON public.lifafas(code);
CREATE INDEX IF NOT EXISTS idx_lifafas_creator ON public.lifafas(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifafas_status ON public.lifafas(status, is_public, expires_at);

-- Pre-calculated or atomic dynamic allocations for each winner spot
CREATE TABLE IF NOT EXISTS public.lifafa_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lifafa_id UUID NOT NULL REFERENCES public.lifafas(id) ON DELETE CASCADE,
    allocation_index INT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    is_claimed BOOLEAN DEFAULT FALSE NOT NULL,
    claimed_by UUID REFERENCES public.profiles(id),
    claimed_at TIMESTAMPTZ,

    CONSTRAINT uq_lifafa_allocation_index UNIQUE (lifafa_id, allocation_index),
    CONSTRAINT chk_allocation_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_allocations_unclaimed ON public.lifafa_allocations(lifafa_id, is_claimed) WHERE is_claimed = FALSE;
CREATE INDEX IF NOT EXISTS idx_allocations_claimed_by ON public.lifafa_allocations(claimed_by);

-- Immutable record of successful claims
CREATE TABLE IF NOT EXISTS public.lifafa_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lifafa_id UUID NOT NULL REFERENCES public.lifafas(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    allocation_id UUID NOT NULL REFERENCES public.lifafa_allocations(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    idempotency_key TEXT UNIQUE,
    device_fingerprint TEXT,
    ip_address TEXT,
    claimed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    -- Critical invariant: A user can claim a specific Lifafa ONLY ONCE
    CONSTRAINT uq_user_lifafa_claim UNIQUE (lifafa_id, user_id),
    CONSTRAINT chk_claim_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_claims_lifafa ON public.lifafa_claims(lifafa_id);
CREATE INDEX IF NOT EXISTS idx_claims_user ON public.lifafa_claims(user_id, claimed_at DESC);
