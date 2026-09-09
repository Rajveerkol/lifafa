-- ==============================================================================
-- Migration: 011_telegram_verification.sql
-- Description: Schema extensions for Telegram channel admin verification
--              and claimant membership validation.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

-- 1. Extend lifafa_tasks to store verified Telegram channel metadata
ALTER TABLE public.lifafa_tasks
    ADD COLUMN IF NOT EXISTS telegram_channel_username TEXT,
    ADD COLUMN IF NOT EXISTS telegram_channel_id BIGINT,
    ADD COLUMN IF NOT EXISTS telegram_channel_title TEXT,
    ADD COLUMN IF NOT EXISTS is_channel_verified BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS verified_bot_username TEXT,
    ADD COLUMN IF NOT EXISTS channel_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_telegram_channel 
    ON public.lifafa_tasks(telegram_channel_username) 
    WHERE task_type IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT');

-- 2. Extend profiles to store claimant's Telegram user handle and ID
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS telegram_username TEXT,
    ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram ON public.profiles(telegram_user_id);

-- 3. Extend task_completions with Telegram membership validation details
ALTER TABLE public.task_completions
    ADD COLUMN IF NOT EXISTS telegram_member_status TEXT, -- 'creator', 'administrator', 'member', 'restricted', 'left', 'kicked'
    ADD COLUMN IF NOT EXISTS verified_via_bot BOOLEAN DEFAULT FALSE NOT NULL;

-- 4. RPC for server-side recording of verified Telegram channel (called by Edge Function with service-role or caller)
CREATE OR REPLACE FUNCTION public.set_task_telegram_verified_rpc(
    p_task_id UUID,
    p_channel_username TEXT,
    p_channel_id BIGINT,
    p_channel_title TEXT,
    p_bot_username TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lifafa_id UUID;
    v_creator_id UUID;
BEGIN
    SELECT lifafa_id INTO v_lifafa_id FROM public.lifafa_tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT creator_id INTO v_creator_id FROM public.lifafas WHERE id = v_lifafa_id;

    -- Verify caller is creator or admin
    IF v_user_id <> v_creator_id AND NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized to verify channel for this task';
    END IF;

    UPDATE public.lifafa_tasks
    SET telegram_channel_username = LOWER(REPLACE(TRIM(p_channel_username), '@', '')),
        telegram_channel_id = p_channel_id,
        telegram_channel_title = p_channel_title,
        verified_bot_username = p_bot_username,
        is_channel_verified = TRUE,
        channel_verified_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_task_id;

    RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'is_verified', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. RPC for recording claimant's verified Telegram membership
CREATE OR REPLACE FUNCTION public.record_telegram_member_completion_rpc(
    p_task_id UUID,
    p_telegram_user_id BIGINT,
    p_telegram_username TEXT,
    p_member_status TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_task RECORD;
    v_valid_statuses TEXT[] := ARRAY['creator', 'administrator', 'member', 'restricted'];
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_task FROM public.lifafa_tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    IF NOT (p_member_status = ANY(v_valid_statuses)) THEN
        RAISE EXCEPTION 'User is not an active member of this channel (Status: %)', p_member_status;
    END IF;

    -- Save user's telegram handle if provided
    IF p_telegram_username IS NOT NULL THEN
        UPDATE public.profiles
        SET telegram_username = LOWER(REPLACE(TRIM(p_telegram_username), '@', '')),
            telegram_user_id = COALESCE(p_telegram_user_id, telegram_user_id)
        WHERE id = v_user_id;
    END IF;

    -- Upsert task completion record
    INSERT INTO public.task_completions (
        task_id,
        lifafa_id,
        user_id,
        status,
        verification_method,
        telegram_member_status,
        verified_via_bot,
        metadata
    ) VALUES (
        p_task_id,
        v_task.lifafa_id,
        v_user_id,
        'VERIFIED',
        'TELEGRAM_BOT_API',
        p_member_status,
        TRUE,
        jsonb_build_object(
            'telegram_user_id', p_telegram_user_id,
            'telegram_username', p_telegram_username,
            'channel_username', v_task.telegram_channel_username,
            'verified_at', TIMEZONE('utc'::text, NOW())
        )
    )
    ON CONFLICT (task_id, user_id) DO UPDATE SET
        status = 'VERIFIED',
        telegram_member_status = EXCLUDED.telegram_member_status,
        verified_via_bot = TRUE,
        metadata = EXCLUDED.metadata;

    RETURN jsonb_build_object('success', true, 'status', 'VERIFIED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
