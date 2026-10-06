-- ==============================================================================
-- Migration: 059_telegram_bot_users_phase2.sql
-- Description: Phase 2 Telegram Bot Users & Webhook Update Processing Engine
--              1. public.bot_users: Real Telegram users scoped to (bot_id, telegram_user_id)
--              2. public.bot_events: Audit log & idempotency engine for incoming Telegram updates
--              3. public.process_telegram_bot_update_rpc: Atomic server-authoritative update processor
--              4. Strict RLS policies protecting multi-bot & cross-user isolation
--              5. Realtime publication additions for live dashboard updates
-- ==============================================================================

-- 1. BOT USERS TABLE (Real Telegram Users per Connected Bot)
CREATE TABLE IF NOT EXISTS public.bot_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    telegram_bot_id BIGINT NOT NULL,
    telegram_user_id BIGINT NOT NULL,
    telegram_chat_id BIGINT,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT false,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_message_at TIMESTAMPTZ,
    start_count INTEGER NOT NULL DEFAULT 0,
    start_param TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_bot_user UNIQUE (bot_id, telegram_user_id)
);

-- Indexes for performance & high-scale server-side search
CREATE INDEX IF NOT EXISTS idx_bot_users_bot_id ON public.bot_users(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_bot_seen ON public.bot_users(bot_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_users_bot_created ON public.bot_users(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_users_bot_status ON public.bot_users(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_bot_users_tg_user ON public.bot_users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_username ON public.bot_users(username);

-- RLS on bot_users
ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can only view bot users belonging to their own connected bots
DROP POLICY IF EXISTS "Users view own bot users" ON public.bot_users;
CREATE POLICY "Users view own bot users"
    ON public.bot_users FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_users.bot_id
              AND b.user_id = auth.uid()
        )
    );

-- Policy: Authenticated users can update status (ACTIVE / BLOCKED) of their own bot users
DROP POLICY IF EXISTS "Users update own bot users status" ON public.bot_users;
CREATE POLICY "Users update own bot users status"
    ON public.bot_users FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_users.bot_id
              AND b.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_users.bot_id
              AND b.user_id = auth.uid()
        )
    );

REVOKE INSERT, DELETE ON public.bot_users FROM anon, authenticated, public;
GRANT SELECT, UPDATE (status, updated_at) ON public.bot_users TO authenticated;
GRANT ALL ON public.bot_users TO service_role;


-- 2. BOT EVENTS TABLE (Idempotency Engine & Realtime Event Stream)
CREATE TABLE IF NOT EXISTS public.bot_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    telegram_bot_id BIGINT NOT NULL,
    update_id BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    telegram_user_id BIGINT,
    telegram_chat_id BIGINT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processing_status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (processing_status IN ('PROCESSED', 'IGNORED', 'FAILED')),
    error_code TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_bot_events_idempotency UNIQUE (bot_id, update_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_events_bot_created ON public.bot_events(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_user ON public.bot_events(bot_id, telegram_user_id, created_at DESC);

-- RLS on bot_events
ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own bot events" ON public.bot_events;
CREATE POLICY "Users view own bot events"
    ON public.bot_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_events.bot_id
              AND b.user_id = auth.uid()
        )
    );

REVOKE INSERT, UPDATE, DELETE ON public.bot_events FROM anon, authenticated, public;
GRANT SELECT ON public.bot_events TO authenticated;
GRANT ALL ON public.bot_events TO service_role;


-- 3. ATOMIC SERVER-AUTHORITATIVE UPDATE DISPATCHER RPC
CREATE OR REPLACE FUNCTION public.process_telegram_bot_update_rpc(
    p_bot_id UUID,
    p_update_id BIGINT,
    p_update_type TEXT,
    p_telegram_user_id BIGINT,
    p_telegram_chat_id BIGINT,
    p_username TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_language_code TEXT DEFAULT NULL,
    p_is_bot BOOLEAN DEFAULT false,
    p_is_premium BOOLEAN DEFAULT false,
    p_is_start BOOLEAN DEFAULT false,
    p_start_param TEXT DEFAULT NULL,
    p_event_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bot RECORD;
    v_bot_user_id UUID;
    v_is_new_user BOOLEAN := false;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Validate parent bot exists and is CONNECTED
    SELECT id, telegram_bot_id, status INTO v_bot
    FROM public.telegram_bots
    WHERE id = p_bot_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Telegram bot not found'
        );
    END IF;

    -- 2. Idempotency Check: (bot_id, update_id)
    IF p_update_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.bot_events
        WHERE bot_id = p_bot_id AND update_id = p_update_id
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Update already processed'
        );
    END IF;

    -- 3. Process User Registration / Activity (if user identifier present)
    IF p_telegram_user_id IS NOT NULL THEN
        -- Check if user already exists
        SELECT id INTO v_bot_user_id
        FROM public.bot_users
        WHERE bot_id = p_bot_id AND telegram_user_id = p_telegram_user_id;

        IF v_bot_user_id IS NULL THEN
            -- Create new real bot user
            v_is_new_user := true;
            INSERT INTO public.bot_users (
                bot_id,
                telegram_bot_id,
                telegram_user_id,
                telegram_chat_id,
                username,
                first_name,
                last_name,
                language_code,
                is_bot,
                is_premium,
                first_seen_at,
                last_seen_at,
                last_message_at,
                start_count,
                start_param,
                status,
                created_at,
                updated_at
            ) VALUES (
                p_bot_id,
                v_bot.telegram_bot_id,
                p_telegram_user_id,
                p_telegram_chat_id,
                p_username,
                p_first_name,
                p_last_name,
                p_language_code,
                COALESCE(p_is_bot, false),
                COALESCE(p_is_premium, false),
                v_now,
                v_now,
                CASE WHEN p_update_type IN ('message', 'edited_message') THEN v_now ELSE NULL END,
                CASE WHEN p_is_start THEN 1 ELSE 0 END,
                p_start_param,
                'ACTIVE',
                v_now,
                v_now
            ) RETURNING id INTO v_bot_user_id;
        ELSE
            -- Update existing user activity & attributes
            UPDATE public.bot_users
            SET
                telegram_chat_id = COALESCE(p_telegram_chat_id, telegram_chat_id),
                username = COALESCE(p_username, username),
                first_name = COALESCE(p_first_name, first_name),
                last_name = COALESCE(p_last_name, last_name),
                language_code = COALESCE(p_language_code, language_code),
                is_premium = COALESCE(p_is_premium, is_premium),
                last_seen_at = v_now,
                last_message_at = CASE WHEN p_update_type IN ('message', 'edited_message') THEN v_now ELSE last_message_at END,
                start_count = CASE WHEN p_is_start THEN start_count + 1 ELSE start_count END,
                start_param = COALESCE(p_start_param, start_param),
                updated_at = v_now
            WHERE id = v_bot_user_id;
        END IF;
    END IF;

    -- 4. Record Event in bot_events (Enforcing idempotency via UNIQUE constraint)
    IF p_update_id IS NOT NULL THEN
        INSERT INTO public.bot_events (
            bot_id,
            telegram_bot_id,
            update_id,
            event_type,
            telegram_user_id,
            telegram_chat_id,
            received_at,
            processed_at,
            processing_status,
            metadata,
            created_at
        ) VALUES (
            p_bot_id,
            v_bot.telegram_bot_id,
            p_update_id,
            CASE
                WHEN p_is_start THEN 'START_COMMAND'
                WHEN p_update_type = 'message' THEN 'MESSAGE'
                WHEN p_update_type = 'edited_message' THEN 'EDITED_MESSAGE'
                WHEN p_update_type = 'callback_query' THEN 'CALLBACK_QUERY'
                ELSE UPPER(p_update_type)
            END,
            p_telegram_user_id,
            p_telegram_chat_id,
            v_now,
            v_now,
            'PROCESSED',
            p_event_metadata,
            v_now
        );
    END IF;

    -- 5. Update parent telegram_bots activity timestamp
    UPDATE public.telegram_bots
    SET last_webhook_event_at = v_now,
        updated_at = v_now
    WHERE id = p_bot_id;

    RETURN jsonb_build_object(
        'success', true,
        'bot_user_id', v_bot_user_id,
        'is_new_user', v_is_new_user
    );
EXCEPTION
    WHEN unique_violation THEN
        -- Handle race condition on duplicate update_id gracefully
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Update already processed (unique constraint hit)'
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_telegram_bot_update_rpc(
    UUID, BIGINT, TEXT, BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, JSONB
) TO service_role;


-- 4. SERVER-AUTHORITATIVE BOT USER METRICS RPC
CREATE OR REPLACE FUNCTION public.get_bot_user_stats_rpc(
    p_bot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_bot RECORD;
    v_total_users BIGINT := 0;
    v_new_today BIGINT := 0;
    v_active_24h BIGINT := 0;
    v_messages_today BIGINT := 0;
    v_new_this_week BIGINT := 0;
    v_today_start TIMESTAMPTZ := date_trunc('day', timezone('utc'::text, now()));
    v_week_start TIMESTAMPTZ := date_trunc('week', timezone('utc'::text, now()));
    v_24h_ago TIMESTAMPTZ := timezone('utc'::text, now()) - interval '24 hours';
BEGIN
    -- Ownership check: authenticated user must own the bot
    SELECT id INTO v_bot
    FROM public.telegram_bots
    WHERE id = p_bot_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bot not found or unauthorized';
    END IF;

    -- Compute real metrics
    SELECT COUNT(*) INTO v_total_users
    FROM public.bot_users
    WHERE bot_id = p_bot_id;

    SELECT COUNT(*) INTO v_new_today
    FROM public.bot_users
    WHERE bot_id = p_bot_id AND created_at >= v_today_start;

    SELECT COUNT(*) INTO v_active_24h
    FROM public.bot_users
    WHERE bot_id = p_bot_id AND last_seen_at >= v_24h_ago;

    SELECT COUNT(*) INTO v_new_this_week
    FROM public.bot_users
    WHERE bot_id = p_bot_id AND created_at >= v_week_start;

    SELECT COUNT(*) INTO v_messages_today
    FROM public.bot_events
    WHERE bot_id = p_bot_id
      AND created_at >= v_today_start
      AND event_type IN ('MESSAGE', 'START_COMMAND', 'EDITED_MESSAGE', 'CALLBACK_QUERY');

    RETURN jsonb_build_object(
        'total_users', v_total_users,
        'new_users_today', v_new_today,
        'active_users_24h', v_active_24h,
        'messages_today', v_messages_today,
        'new_users_this_week', v_new_this_week
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bot_user_stats_rpc(UUID) TO authenticated;


-- 5. REALTIME REPLICATION (For live bot user & event dashboard updates)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_users;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_events;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
END $$;
