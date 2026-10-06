-- ==============================================================================
-- Migration: 060_telegram_bot_commands_automation_phase3.sql
-- Description: Phase 3 Telegram Bot Commands, Menus, Auto-Replies & Automation Engine
--              1. public.bot_commands: Custom & built-in Telegram bot command definitions
--              2. public.bot_menus: Interactive Telegram menus with keyboard/inline buttons
--              3. public.bot_auto_replies: Keyword & phrase auto-reply rules
--              4. public.bot_workflows: Automation triggers & actions
--              5. public.bot_automation_executions: Audit log for command & automated responses
--              6. Server-authoritative helper RPCs
--              7. Strict RLS enforcing multi-bot isolation
--              8. Realtime publication integration
-- ==============================================================================

-- 1. BOT COMMANDS TABLE
CREATE TABLE IF NOT EXISTS public.bot_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    description TEXT NOT NULL,
    response_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (response_type IN ('TEXT', 'PHOTO', 'BUTTON_MENU', 'INLINE_BUTTONS')),
    response_text TEXT NOT NULL,
    buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_bot_command UNIQUE (bot_id, command),
    CONSTRAINT chk_command_format CHECK (command ~ '^[a-z0-9_]{1,32}$')
);

CREATE INDEX IF NOT EXISTS idx_bot_commands_bot_id ON public.bot_commands(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_commands_bot_cmd ON public.bot_commands(bot_id, command);
CREATE INDEX IF NOT EXISTS idx_bot_commands_enabled ON public.bot_commands(bot_id, enabled);

-- RLS on bot_commands
ALTER TABLE public.bot_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own bot commands" ON public.bot_commands;
CREATE POLICY "Users view own bot commands"
    ON public.bot_commands FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_commands.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users insert own bot commands" ON public.bot_commands;
CREATE POLICY "Users insert own bot commands"
    ON public.bot_commands FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_commands.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users update own bot commands" ON public.bot_commands;
CREATE POLICY "Users update own bot commands"
    ON public.bot_commands FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_commands.bot_id
              AND b.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_commands.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users delete own bot commands" ON public.bot_commands;
CREATE POLICY "Users delete own bot commands"
    ON public.bot_commands FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_commands.bot_id
              AND b.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_commands TO authenticated;
GRANT ALL ON public.bot_commands TO service_role;


-- 2. BOT MENUS TABLE
CREATE TABLE IF NOT EXISTS public.bot_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Main Menu',
    message_text TEXT NOT NULL DEFAULT 'Please choose an option from the menu below:',
    menu_type TEXT NOT NULL DEFAULT 'INLINE' CHECK (menu_type IN ('INLINE', 'REPLY_KEYBOARD')),
    buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_main_menu BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_bot_main_menu UNIQUE (bot_id, is_main_menu)
);

CREATE INDEX IF NOT EXISTS idx_bot_menus_bot_id ON public.bot_menus(bot_id);

-- RLS on bot_menus
ALTER TABLE public.bot_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own bot menus" ON public.bot_menus;
CREATE POLICY "Users view own bot menus"
    ON public.bot_menus FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_menus.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users insert own bot menus" ON public.bot_menus;
CREATE POLICY "Users insert own bot menus"
    ON public.bot_menus FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_menus.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users update own bot menus" ON public.bot_menus;
CREATE POLICY "Users update own bot menus"
    ON public.bot_menus FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_menus.bot_id
              AND b.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_menus.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users delete own bot menus" ON public.bot_menus;
CREATE POLICY "Users delete own bot menus"
    ON public.bot_menus FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_menus.bot_id
              AND b.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_menus TO authenticated;
GRANT ALL ON public.bot_menus TO service_role;


-- 3. BOT AUTO-REPLIES TABLE
CREATE TABLE IF NOT EXISTS public.bot_auto_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('EXACT_TEXT', 'CONTAINS_TEXT', 'STARTS_WITH', 'COMMAND')),
    trigger_value TEXT NOT NULL,
    response_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (response_type IN ('TEXT', 'BUTTON_MENU', 'INLINE_BUTTONS')),
    response_text TEXT NOT NULL,
    buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    priority INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_auto_replies_bot ON public.bot_auto_replies(bot_id, enabled, priority DESC);

-- RLS on bot_auto_replies
ALTER TABLE public.bot_auto_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own auto replies" ON public.bot_auto_replies;
CREATE POLICY "Users view own auto replies"
    ON public.bot_auto_replies FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_auto_replies.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users insert own auto replies" ON public.bot_auto_replies;
CREATE POLICY "Users insert own auto replies"
    ON public.bot_auto_replies FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_auto_replies.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users update own auto replies" ON public.bot_auto_replies;
CREATE POLICY "Users update own auto replies"
    ON public.bot_auto_replies FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_auto_replies.bot_id
              AND b.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_auto_replies.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users delete own auto replies" ON public.bot_auto_replies;
CREATE POLICY "Users delete own auto replies"
    ON public.bot_auto_replies FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_auto_replies.bot_id
              AND b.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_auto_replies TO authenticated;
GRANT ALL ON public.bot_auto_replies TO service_role;


-- 4. BOT WORKFLOWS TABLE
CREATE TABLE IF NOT EXISTS public.bot_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('COMMAND', 'KEYWORD', 'BUTTON_CLICK', 'NEW_USER')),
    trigger_value TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('SEND_MESSAGE', 'SHOW_MENU', 'RUN_COMMAND')),
    action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_workflows_bot ON public.bot_workflows(bot_id, enabled);

-- RLS on bot_workflows
ALTER TABLE public.bot_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own workflows" ON public.bot_workflows;
CREATE POLICY "Users view own workflows"
    ON public.bot_workflows FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_workflows.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users insert own workflows" ON public.bot_workflows;
CREATE POLICY "Users insert own workflows"
    ON public.bot_workflows FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_workflows.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users update own workflows" ON public.bot_workflows;
CREATE POLICY "Users update own workflows"
    ON public.bot_workflows FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_workflows.bot_id
              AND b.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_workflows.bot_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users delete own workflows" ON public.bot_workflows;
CREATE POLICY "Users delete own workflows"
    ON public.bot_workflows FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_workflows.bot_id
              AND b.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_workflows TO authenticated;
GRANT ALL ON public.bot_workflows TO service_role;


-- 5. BOT AUTOMATION EXECUTIONS TABLE (Audit Log)
CREATE TABLE IF NOT EXISTS public.bot_automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    telegram_bot_id BIGINT NOT NULL,
    update_id BIGINT,
    telegram_user_id BIGINT,
    telegram_chat_id BIGINT,
    trigger_type TEXT NOT NULL,
    trigger_value TEXT,
    action_type TEXT NOT NULL,
    execution_status TEXT NOT NULL CHECK (execution_status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
    error_code TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_exec_bot_created ON public.bot_automation_executions(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_exec_user ON public.bot_automation_executions(bot_id, telegram_user_id, created_at DESC);

-- RLS on bot_automation_executions
ALTER TABLE public.bot_automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own execution logs" ON public.bot_automation_executions;
CREATE POLICY "Users view own execution logs"
    ON public.bot_automation_executions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.telegram_bots b
            WHERE b.id = bot_automation_executions.bot_id
              AND b.user_id = auth.uid()
        )
    );

REVOKE INSERT, UPDATE, DELETE ON public.bot_automation_executions FROM anon, authenticated, public;
GRANT SELECT ON public.bot_automation_executions TO authenticated;
GRANT ALL ON public.bot_automation_executions TO service_role;


-- 6. HELPER RPC: GET DYNAMIC HELP COMMANDS
CREATE OR REPLACE FUNCTION public.get_bot_help_commands_rpc(
    p_bot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_custom_commands JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'command', command,
                'description', description
            ) ORDER BY sort_order ASC, command ASC
        ),
        '[]'::jsonb
    ) INTO v_custom_commands
    FROM public.bot_commands
    WHERE bot_id = p_bot_id AND enabled = true;

    RETURN jsonb_build_object(
        'success', true,
        'commands', v_custom_commands
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bot_help_commands_rpc(UUID) TO service_role, authenticated;


-- 7. REALTIME REPLICATION (For live dashboard updates)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_commands;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_menus;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_auto_replies;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_workflows;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_automation_executions;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
END $$;
