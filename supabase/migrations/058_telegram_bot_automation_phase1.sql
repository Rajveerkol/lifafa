-- ==============================================================================
-- Migration: 058_telegram_bot_automation_phase1.sql
-- Description: Phase 1 Telegram Bot Automation Foundation
--              1. public.bot_slots: Purchased bot connection entitlement slots
--              2. public.telegram_bots: Connected bot metadata & health status
--              3. public.telegram_bot_secrets: Isolated, encrypted bot token & webhook secrets (zero client access)
--              4. public.telegram_bot_events: Audit log & real-time webhook event records
--              5. public.purchase_bot_slot_rpc: Server-authoritative atomic slot purchase from wallet
-- ==============================================================================

-- 1. BOT SLOTS TABLE (Purchased Entitlements)
CREATE TABLE IF NOT EXISTS public.bot_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_price NUMERIC(12, 2) NOT NULL CHECK (plan_price IN (99.00, 299.00, 499.00, 999.00, 1999.00)),
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ACTIVE', 'EXPIRED', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_slots_user_status ON public.bot_slots(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bot_slots_created_at ON public.bot_slots(created_at DESC);

-- RLS on bot_slots
ALTER TABLE public.bot_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own bot slots" ON public.bot_slots;
CREATE POLICY "Users view own bot slots"
    ON public.bot_slots FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.bot_slots FROM anon, authenticated, public;
GRANT SELECT ON public.bot_slots TO authenticated;
GRANT ALL ON public.bot_slots TO service_role;


-- 2. TELEGRAM BOTS TABLE (Connected Bots Public Metadata)
CREATE TABLE IF NOT EXISTS public.telegram_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bot_slot_id UUID NOT NULL REFERENCES public.bot_slots(id) ON DELETE RESTRICT,
    telegram_bot_id BIGINT NOT NULL UNIQUE,
    telegram_username TEXT NOT NULL,
    telegram_display_name TEXT NOT NULL,
    telegram_first_name TEXT NOT NULL,
    telegram_can_join_groups BOOLEAN NOT NULL DEFAULT true,
    telegram_can_read_all_group_messages BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (status IN ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR')),
    connection_status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (connection_status IN ('CONNECTED', 'DISCONNECTED', 'DEGRADED', 'ERROR')),
    webhook_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (webhook_status IN ('ACTIVE', 'PENDING', 'FAILED', 'REMOVED')),
    webhook_url TEXT NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_webhook_event_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_bots_bot_id ON public.telegram_bots(telegram_bot_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bots_user ON public.telegram_bots(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_bots_active_slot ON public.telegram_bots(bot_slot_id) WHERE status = 'CONNECTED';

-- RLS on telegram_bots
ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own telegram bots" ON public.telegram_bots;
CREATE POLICY "Users view own telegram bots"
    ON public.telegram_bots FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.telegram_bots FROM anon, authenticated, public;
GRANT SELECT ON public.telegram_bots TO authenticated;
GRANT ALL ON public.telegram_bots TO service_role;


-- 3. TELEGRAM BOT SECRETS TABLE (Zero Client Access - Server-Side Only)
CREATE TABLE IF NOT EXISTS public.telegram_bot_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE UNIQUE,
    encrypted_bot_token TEXT NOT NULL,
    bot_token_hash TEXT NOT NULL,
    webhook_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_telegram_bot_secrets_hash ON public.telegram_bot_secrets(bot_token_hash);

-- RLS on telegram_bot_secrets: ZERO client access
ALTER TABLE public.telegram_bot_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_bot_secrets FROM anon, authenticated, public;
GRANT ALL ON public.telegram_bot_secrets TO service_role;


-- 4. TELEGRAM BOT EVENTS TABLE (Audit Log & Real-time Webhook Events)
CREATE TABLE IF NOT EXISTS public.telegram_bot_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'BOT_CONNECT_ATTEMPT',
        'BOT_VERIFIED',
        'BOT_WEBHOOK_SET',
        'BOT_CONNECTION_FAILED',
        'BOT_DISCONNECT_ATTEMPT',
        'BOT_DISCONNECTED',
        'BOT_WEBHOOK_FAILED',
        'WEBHOOK_UPDATE'
    )),
    telegram_update_id BIGINT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_events_bot ON public.telegram_bot_events(bot_id, created_at DESC);

-- RLS on telegram_bot_events
ALTER TABLE public.telegram_bot_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own bot events" ON public.telegram_bot_events;
CREATE POLICY "Users view own bot events"
    ON public.telegram_bot_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = telegram_bot_events.bot_id
              AND b.user_id = auth.uid()
        )
    );

REVOKE INSERT, UPDATE, DELETE ON public.telegram_bot_events FROM anon, authenticated, public;
GRANT SELECT ON public.telegram_bot_events TO authenticated;
GRANT ALL ON public.telegram_bot_events TO service_role;


-- 5. ATOMIC SERVER-AUTHORITATIVE BOT SLOT PURCHASE RPC
CREATE OR REPLACE FUNCTION public.purchase_bot_slot_rpc(
    p_plan_price NUMERIC,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_plan_name TEXT;
    v_slot_id UUID;
    v_bal_before NUMERIC(12, 2);
    v_bal_after NUMERIC(12, 2);
    v_idem_key TEXT;
    v_existing_slot RECORD;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to purchase a bot slot';
    END IF;

    -- 2. Validate valid bot plan price
    IF p_plan_price IS NULL OR p_plan_price NOT IN (99.00, 299.00, 499.00, 999.00, 1999.00) THEN
        RAISE EXCEPTION 'Invalid bot plan price: ₹%. Allowed plans: ₹99, ₹299, ₹499, ₹999, ₹1,999', p_plan_price;
    END IF;

    -- Map canonical plan name
    IF p_plan_price = 99.00 THEN
        v_plan_name := 'Starter Bot Slot';
    ELSIF p_plan_price = 299.00 THEN
        v_plan_name := 'Growth Bot Slot';
    ELSIF p_plan_price = 499.00 THEN
        v_plan_name := 'Pro Bot Slot';
    ELSIF p_plan_price = 999.00 THEN
        v_plan_name := 'Business Bot Slot';
    ELSE
        v_plan_name := 'Enterprise Bot Slot';
    END IF;

    -- Idempotency key
    v_idem_key := COALESCE(NULLIF(TRIM(p_idempotency_key), ''), 'slot_buy_' || v_user_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT);

    -- 3. Check if transaction already processed with this idempotency key
    IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE idempotency_key = v_idem_key) THEN
        SELECT * INTO v_existing_slot
        FROM public.bot_slots
        WHERE user_id = v_user_id
        ORDER BY created_at DESC
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'slot_id', v_existing_slot.id,
            'plan_price', v_existing_slot.plan_price,
            'plan_name', v_existing_slot.plan_name,
            'status', v_existing_slot.status
        );
    END IF;

    -- 4. Concurrency lock on user authoritative wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    -- 5. Validate balance sufficiency
    IF v_wallet.available_balance < p_plan_price THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Required: ₹%, Available: ₹%', p_plan_price, v_wallet.available_balance;
    END IF;

    v_bal_before := v_wallet.available_balance;
    v_bal_after  := v_bal_before - p_plan_price;

    -- 6. Atomic wallet deduction
    UPDATE public.wallets
    SET available_balance = v_bal_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 7. Insert bot slot entitlement
    INSERT INTO public.bot_slots (
        user_id,
        plan_price,
        plan_name,
        status
    ) VALUES (
        v_user_id,
        p_plan_price,
        v_plan_name,
        'AVAILABLE'
    ) RETURNING id INTO v_slot_id;

    -- 8. Record in authoritative wallet_transactions
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
        -p_plan_price,
        'DEBIT'::transaction_type,
        'SUCCESS'::transaction_status,
        'BOT_SLOT_PURCHASE',
        v_slot_id::text,
        v_idem_key,
        v_bal_before,
        v_bal_after,
        jsonb_build_object(
            'slot_id', v_slot_id,
            'plan_price', p_plan_price,
            'plan_name', v_plan_name,
            'purchased_at', TIMEZONE('utc'::text, NOW())
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'slot_id', v_slot_id,
        'plan_price', p_plan_price,
        'plan_name', v_plan_name,
        'status', 'AVAILABLE',
        'wallet_balance_after', v_bal_after
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_bot_slot_rpc(NUMERIC, TEXT) TO authenticated;

-- 6. REALTIME REPLICATION (For live dashboard updates)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_slots;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_bots;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_bot_events;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
END $$;

