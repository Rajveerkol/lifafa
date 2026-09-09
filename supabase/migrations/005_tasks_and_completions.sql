-- ==============================================================================
-- Migration: 005_tasks_and_completions.sql
-- Description: Lifafa engagement tasks and verifiable completion tracking.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.lifafa_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lifafa_id UUID NOT NULL REFERENCES public.lifafas(id) ON DELETE CASCADE,
    task_type task_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_url TEXT,
    is_required BOOLEAN DEFAULT TRUE NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lifafa_tasks ON public.lifafa_tasks(lifafa_id, sort_order);

-- Task completion tracking with server-side validation status
CREATE TABLE IF NOT EXISTS public.task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.lifafa_tasks(id) ON DELETE CASCADE,
    lifafa_id UUID NOT NULL REFERENCES public.lifafas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'VERIFIED' NOT NULL CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED')),
    verification_method TEXT DEFAULT 'URL_VISIT' NOT NULL, -- e.g., 'OAUTH_CHECK', 'TELEGRAM_BOT_CHECK', 'URL_VISIT', 'MANUAL'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    CONSTRAINT uq_user_task_completion UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_comp_user ON public.task_completions(lifafa_id, user_id);
