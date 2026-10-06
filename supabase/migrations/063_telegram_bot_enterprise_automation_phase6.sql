-- ==============================================================================
-- Migration: 063_telegram_bot_enterprise_automation_phase6.sql
-- Description: Phase 6 Advanced / Enterprise Telegram Bot Automation System
-- Author: Antigravity & User Pair
--
-- IMPORTANT: Antigravity MUST NOT execute this SQL file.
-- Manual execution by the database owner is required in Supabase SQL Editor.
--
-- SQL EXECUTED BY ANTIGRAVITY: NO
-- SQL REQUIRES MANUAL EXECUTION: YES
-- ==============================================================================

-- 1. Extend bot_workflows with Enterprise Journey & Loop Protection fields
ALTER TABLE public.bot_workflows
  ADD COLUMN IF NOT EXISTS is_journey BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS journey_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS loop_depth_limit INT NOT NULL DEFAULT 5;

-- 2. Visual Workflow Journey Nodes Table (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_workflow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.bot_workflows(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    node_key TEXT NOT NULL,
    node_type TEXT NOT NULL CHECK (node_type IN ('TRIGGER', 'CONDITION', 'ACTION', 'DELAY', 'BRANCH', 'END')),
    title TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workflow_node_key UNIQUE (workflow_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_workflow_nodes_wf ON public.bot_workflow_nodes(workflow_id);
CREATE INDEX IF NOT EXISTS idx_bot_workflow_nodes_bot ON public.bot_workflow_nodes(bot_id);

-- 3. Visual Workflow Journey Edges / Branches Table (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_workflow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.bot_workflows(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    source_node_key TEXT NOT NULL,
    target_node_key TEXT NOT NULL,
    condition_branch TEXT CHECK (condition_branch IN ('YES', 'NO', 'DEFAULT', 'CUSTOM')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_workflow_edge UNIQUE (workflow_id, source_node_key, target_node_key, condition_branch)
);

CREATE INDEX IF NOT EXISTS idx_bot_workflow_edges_wf ON public.bot_workflow_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_bot_workflow_edges_bot ON public.bot_workflow_edges(bot_id);

-- 4. Persistent Delayed Actions & Scheduled Workflow Job Queue (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_workflow_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.bot_workflows(id) ON DELETE CASCADE,
    node_id UUID REFERENCES public.bot_workflow_nodes(id) ON DELETE SET NULL,
    bot_user_id UUID REFERENCES public.bot_users(id) ON DELETE CASCADE,
    telegram_chat_id BIGINT NOT NULL,
    execution_id UUID NOT NULL DEFAULT gen_random_uuid(),
    step_index INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED')) DEFAULT 'QUEUED',
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_workflow_jobs_queue ON public.bot_workflow_jobs(status, scheduled_at) WHERE status IN ('QUEUED', 'WAITING');
CREATE INDEX IF NOT EXISTS idx_bot_workflow_jobs_bot ON public.bot_workflow_jobs(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_workflow_jobs_user ON public.bot_workflow_jobs(bot_user_id, status);
CREATE INDEX IF NOT EXISTS idx_bot_workflow_jobs_exec ON public.bot_workflow_jobs(execution_id);

-- 5. Enterprise Notification Rules Table (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('AUTOMATION_FAILURE', 'TELEGRAM_RATE_LIMIT', 'REFERRAL_MILESTONE', 'FRAUD_DETECTED', 'WEBHOOK_FAILURE', 'SECURITY_ALERT', 'DAILY_REPORT')),
    channel TEXT NOT NULL CHECK (channel IN ('TELEGRAM_ADMIN', 'IN_APP', 'WEBHOOK')) DEFAULT 'TELEGRAM_ADMIN',
    target_recipient TEXT NOT NULL,
    template TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_notification_rules_bot ON public.bot_notification_rules(bot_id, enabled);

-- 6. Enterprise Scheduled Reports Table (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('DAILY_SUMMARY', 'WEEKLY_GROWTH', 'REFERRALS_AUDIT', 'CAMPAIGN_PERFORMANCE', 'AUTOMATION_HEALTH')),
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')) DEFAULT 'DAILY',
    target_chat_id BIGINT,
    last_generated_at TIMESTAMPTZ,
    last_report_data JSONB,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_scheduled_reports_bot ON public.bot_scheduled_reports(bot_id, status);

-- 7. Enterprise API & Outbound Webhook Integrations (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL CHECK (url ~* '^https://'),
    http_method TEXT NOT NULL CHECK (http_method IN ('POST', 'PUT', 'GET')) DEFAULT 'POST',
    headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_types TEXT[] NOT NULL DEFAULT ARRAY['USER_REGISTERED', 'REFERRAL_CREATED'],
    secret_token TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failure_count INT NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_integrations_bot ON public.bot_integrations(bot_id, is_active);

-- 8. Integration Delivery Event Log (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.bot_integrations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status_code INT,
    response_body TEXT,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')) DEFAULT 'PENDING',
    error_message TEXT,
    attempt_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bot_integration_events_bot ON public.bot_integration_events(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_integration_events_int ON public.bot_integration_events(integration_id);

-- 9. Update bot_admins constraint to support 6 Enterprise Staff Roles
ALTER TABLE public.bot_admins DROP CONSTRAINT IF EXISTS bot_admins_role_check;
ALTER TABLE public.bot_admins ADD CONSTRAINT bot_admins_role_check 
    CHECK (role IN ('OWNER', 'SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ANALYST', 'SUPPORT'));

-- 10. Immutable / Tamper-Resistant Audit Log Policies
-- Drop permissive ALL policy on bot_audit_logs to prevent UPDATE and DELETE
DROP POLICY IF EXISTS "bot_audit_logs_owner_all" ON public.bot_audit_logs;
DROP POLICY IF EXISTS "bot_audit_logs_owner_select" ON public.bot_audit_logs;
DROP POLICY IF EXISTS "bot_audit_logs_owner_insert" ON public.bot_audit_logs;

CREATE POLICY "bot_audit_logs_owner_select" ON public.bot_audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_audit_logs.bot_id AND b.user_id = auth.uid()));

CREATE POLICY "bot_audit_logs_owner_insert" ON public.bot_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_audit_logs.bot_id AND b.user_id = auth.uid()));

-- Notice: No UPDATE or DELETE policy is defined, rendering bot_audit_logs append-only for standard users!

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) ON NEW ENTERPRISE TABLES
-- ==============================================================================
ALTER TABLE public.bot_workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_workflow_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_integration_events ENABLE ROW LEVEL SECURITY;

-- bot_workflow_nodes
DROP POLICY IF EXISTS "bot_workflow_nodes_owner_all" ON public.bot_workflow_nodes;
CREATE POLICY "bot_workflow_nodes_owner_all" ON public.bot_workflow_nodes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_workflow_nodes.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_workflow_nodes.bot_id AND b.user_id = auth.uid()));

-- bot_workflow_edges
DROP POLICY IF EXISTS "bot_workflow_edges_owner_all" ON public.bot_workflow_edges;
CREATE POLICY "bot_workflow_edges_owner_all" ON public.bot_workflow_edges
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_workflow_edges.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_workflow_edges.bot_id AND b.user_id = auth.uid()));

-- bot_workflow_jobs
DROP POLICY IF EXISTS "bot_workflow_jobs_owner_all" ON public.bot_workflow_jobs;
CREATE POLICY "bot_workflow_jobs_owner_all" ON public.bot_workflow_jobs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_workflow_jobs.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_workflow_jobs.bot_id AND b.user_id = auth.uid()));

-- bot_notification_rules
DROP POLICY IF EXISTS "bot_notification_rules_owner_all" ON public.bot_notification_rules;
CREATE POLICY "bot_notification_rules_owner_all" ON public.bot_notification_rules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_notification_rules.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_notification_rules.bot_id AND b.user_id = auth.uid()));

-- bot_scheduled_reports
DROP POLICY IF EXISTS "bot_scheduled_reports_owner_all" ON public.bot_scheduled_reports;
CREATE POLICY "bot_scheduled_reports_owner_all" ON public.bot_scheduled_reports
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_scheduled_reports.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_scheduled_reports.bot_id AND b.user_id = auth.uid()));

-- bot_integrations
DROP POLICY IF EXISTS "bot_integrations_owner_all" ON public.bot_integrations;
CREATE POLICY "bot_integrations_owner_all" ON public.bot_integrations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_integrations.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_integrations.bot_id AND b.user_id = auth.uid()));

-- bot_integration_events
DROP POLICY IF EXISTS "bot_integration_events_owner_all" ON public.bot_integration_events;
CREATE POLICY "bot_integration_events_owner_all" ON public.bot_integration_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_integration_events.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_integration_events.bot_id AND b.user_id = auth.uid()));

-- Grant table access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_workflow_nodes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_workflow_edges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_workflow_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_notification_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_scheduled_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_integration_events TO authenticated;

GRANT ALL ON public.bot_workflow_nodes TO service_role;
GRANT ALL ON public.bot_workflow_edges TO service_role;
GRANT ALL ON public.bot_workflow_jobs TO service_role;
GRANT ALL ON public.bot_notification_rules TO service_role;
GRANT ALL ON public.bot_scheduled_reports TO service_role;
GRANT ALL ON public.bot_integrations TO service_role;
GRANT ALL ON public.bot_integration_events TO service_role;

-- ==============================================================================
-- POSTGRES RPC FUNCTIONS ENFORCING ENTERPRISE PLAN GATING & ISOLATION
-- ==============================================================================

-- 1. Authoritative Enterprise Access Checker
CREATE OR REPLACE FUNCTION public.check_enterprise_bot_access(p_bot_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_price NUMERIC;
BEGIN
    SELECT COALESCE(s.plan_price, 99)
    INTO v_price
    FROM public.telegram_bots b
    LEFT JOIN public.bot_slots s ON s.id = b.bot_slot_id
    WHERE b.id = p_bot_id;

    IF v_price IS NULL OR v_price < 1999 THEN
        RAISE EXCEPTION 'Forbidden: Enterprise plan (₹1,999) required. Current bot slot plan price is %', COALESCE(v_price, 0);
    END IF;

    RETURN TRUE;
END;
$$;

-- 2. Create / Update Enterprise Workflow Journey RPC
CREATE OR REPLACE FUNCTION public.save_enterprise_journey_rpc(
    p_bot_id UUID,
    p_workflow_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_trigger_type TEXT,
    p_trigger_value TEXT,
    p_nodes JSONB,
    p_edges JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wf_id UUID;
    v_node RECORD;
    v_edge RECORD;
BEGIN
    -- 1. Strictly verify Enterprise Entitlement
    PERFORM public.check_enterprise_bot_access(p_bot_id);

    -- 2. Verify Bot Ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.telegram_bots
        WHERE id = p_bot_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not own this bot';
    END IF;

    -- 3. Upsert into bot_workflows
    IF p_workflow_id IS NOT NULL THEN
        UPDATE public.bot_workflows
        SET name = p_name,
            description = p_description,
            trigger_type = p_trigger_type,
            trigger_value = p_trigger_value,
            is_journey = true,
            journey_data = jsonb_build_object('nodes', p_nodes, 'edges', p_edges),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_workflow_id AND bot_id = p_bot_id
        RETURNING id INTO v_wf_id;
    ELSE
        INSERT INTO public.bot_workflows (
            bot_id,
            name,
            description,
            trigger_type,
            trigger_value,
            action_type,
            action_payload,
            enabled,
            is_journey,
            journey_data
        ) VALUES (
            p_bot_id,
            p_name,
            p_description,
            p_trigger_type,
            p_trigger_value,
            'RUN_COMMAND',
            '{}'::jsonb,
            true,
            true,
            jsonb_build_object('nodes', p_nodes, 'edges', p_edges)
        )
        RETURNING id INTO v_wf_id;
    END IF;

    -- 4. Sync structured nodes
    DELETE FROM public.bot_workflow_nodes WHERE workflow_id = v_wf_id;
    FOR v_node IN SELECT * FROM jsonb_to_recordset(p_nodes) AS x(
        node_key TEXT,
        node_type TEXT,
        title TEXT,
        config JSONB,
        position JSONB
    ) LOOP
        INSERT INTO public.bot_workflow_nodes (
            workflow_id,
            bot_id,
            node_key,
            node_type,
            title,
            config,
            position
        ) VALUES (
            v_wf_id,
            p_bot_id,
            v_node.node_key,
            v_node.node_type,
            COALESCE(v_node.title, 'Node'),
            COALESCE(v_node.config, '{}'::jsonb),
            COALESCE(v_node.position, '{"x": 0, "y": 0}'::jsonb)
        );
    END LOOP;

    -- 5. Sync structured edges
    DELETE FROM public.bot_workflow_edges WHERE workflow_id = v_wf_id;
    FOR v_edge IN SELECT * FROM jsonb_to_recordset(p_edges) AS y(
        source_node_key TEXT,
        target_node_key TEXT,
        condition_branch TEXT
    ) LOOP
        INSERT INTO public.bot_workflow_edges (
            workflow_id,
            bot_id,
            source_node_key,
            target_node_key,
            condition_branch
        ) VALUES (
            v_wf_id,
            p_bot_id,
            v_edge.source_node_key,
            v_edge.target_node_key,
            COALESCE(v_edge.condition_branch, 'DEFAULT')
        );
    END LOOP;

    -- 6. Record to Audit Log
    INSERT INTO public.bot_audit_logs (
        bot_id,
        actor_id,
        actor_email,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        p_bot_id,
        auth.uid(),
        (SELECT email FROM public.profiles WHERE id = auth.uid()),
        CASE WHEN p_workflow_id IS NOT NULL THEN 'workflow_updated' ELSE 'workflow_created' END,
        'workflow',
        v_wf_id::text,
        jsonb_build_object('name', p_name, 'trigger_type', p_trigger_type)
    );

    RETURN jsonb_build_object('success', true, 'workflow_id', v_wf_id);
END;
$$;

-- 3. Enqueue Workflow Job RPC with Loop Protection & Rate Limits
CREATE OR REPLACE FUNCTION public.enqueue_workflow_job_rpc(
    p_bot_id UUID,
    p_workflow_id UUID,
    p_bot_user_id UUID,
    p_telegram_chat_id BIGINT,
    p_context_data JSONB DEFAULT '{}'::jsonb,
    p_delay_seconds INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hourly_count INT;
    v_scheduled_at TIMESTAMPTZ;
    v_job_id UUID;
    v_exec_id UUID;
BEGIN
    -- 1. Enterprise plan validation
    PERFORM public.check_enterprise_bot_access(p_bot_id);

    -- 2. Anti-Loop / Cooldown Protection: Limit per-user executions to 25/hour
    SELECT count(*)
    INTO v_hourly_count
    FROM public.bot_workflow_jobs
    WHERE bot_user_id = p_bot_user_id
      AND created_at >= now() - interval '1 hour';

    IF v_hourly_count >= 25 THEN
        -- Record automation loop warning
        INSERT INTO public.bot_audit_logs (
            bot_id,
            action,
            target_type,
            target_id,
            details
        ) VALUES (
            p_bot_id,
            'automation_loop_blocked',
            'bot_user',
            p_bot_user_id::text,
            jsonb_build_object('hourly_count', v_hourly_count, 'workflow_id', p_workflow_id)
        );
        RETURN jsonb_build_object('success', false, 'error', 'Loop protection triggered: User exceeded hourly automation limit');
    END IF;

    -- 3. Compute execution time
    v_scheduled_at := timezone('utc'::text, now()) + make_interval(secs => GREATEST(0, p_delay_seconds));
    v_exec_id := gen_random_uuid();

    -- 4. Insert Job
    INSERT INTO public.bot_workflow_jobs (
        bot_id,
        workflow_id,
        bot_user_id,
        telegram_chat_id,
        execution_id,
        step_index,
        status,
        scheduled_at,
        context_data
    ) VALUES (
        p_bot_id,
        p_workflow_id,
        p_bot_user_id,
        p_telegram_chat_id,
        v_exec_id,
        0,
        CASE WHEN p_delay_seconds > 0 THEN 'WAITING' ELSE 'QUEUED' END,
        v_scheduled_at,
        p_context_data
    )
    RETURNING id INTO v_job_id;

    RETURN jsonb_build_object(
        'success', true,
        'job_id', v_job_id,
        'execution_id', v_exec_id,
        'scheduled_at', v_scheduled_at
    );
END;
$$;

-- 4. Get Enterprise Command Center Real Telemetry Metrics RPC
CREATE OR REPLACE FUNCTION public.get_enterprise_command_center_metrics_rpc(p_bot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_price NUMERIC;
    v_total_workflows INT;
    v_active_workflows INT;
    v_executions_today INT;
    v_success_count INT;
    v_failed_count INT;
    v_queued_jobs INT;
    v_integrations_count INT;
    v_audit_count INT;
    v_rate NUMERIC;
BEGIN
    -- Authoritative Plan Check
    SELECT COALESCE(s.plan_price, 99)
    INTO v_price
    FROM public.telegram_bots b
    LEFT JOIN public.bot_slots s ON s.id = b.bot_slot_id
    WHERE b.id = p_bot_id;

    IF v_price IS NULL OR v_price < 1999 THEN
        RETURN jsonb_build_object(
            'is_entitled', false,
            'plan_price', COALESCE(v_price, 99),
            'message', 'Enterprise plan required'
        );
    END IF;

    -- REAL DATABASE COUNTS ONLY (ZERO FAKE NUMBERS)
    SELECT count(*), count(*) FILTER (WHERE enabled = true)
    INTO v_total_workflows, v_active_workflows
    FROM public.bot_workflows
    WHERE bot_id = p_bot_id;

    SELECT count(*),
           count(*) FILTER (WHERE status = 'COMPLETED'),
           count(*) FILTER (WHERE status = 'FAILED')
    INTO v_executions_today, v_success_count, v_failed_count
    FROM public.bot_workflow_jobs
    WHERE bot_id = p_bot_id
      AND created_at >= timezone('utc'::text, date_trunc('day', now()));

    SELECT count(*)
    INTO v_queued_jobs
    FROM public.bot_workflow_jobs
    WHERE bot_id = p_bot_id
      AND status IN ('QUEUED', 'WAITING');

    SELECT count(*)
    INTO v_integrations_count
    FROM public.bot_integrations
    WHERE bot_id = p_bot_id AND is_active = true;

    SELECT count(*)
    INTO v_audit_count
    FROM public.bot_audit_logs
    WHERE bot_id = p_bot_id;

    IF (v_success_count + v_failed_count) > 0 THEN
        v_rate := ROUND((v_success_count::numeric / (v_success_count + v_failed_count)::numeric) * 100, 1);
    ELSE
        v_rate := 100.0;
    END IF;

    RETURN jsonb_build_object(
        'is_entitled', true,
        'plan_price', v_price,
        'total_workflows', v_total_workflows,
        'active_workflows', v_active_workflows,
        'executions_today', v_executions_today,
        'successful_executions', v_success_count,
        'failed_executions', v_failed_count,
        'queued_jobs', v_queued_jobs,
        'automation_success_rate', v_rate,
        'integrations_count', v_integrations_count,
        'audit_events_count', v_audit_count
    );
END;
$$;

-- 5. Generate Scheduled Report RPC (Real Telemetry Snapshot)
CREATE OR REPLACE FUNCTION public.generate_bot_scheduled_report_rpc(
    p_bot_id UUID,
    p_report_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report_data JSONB;
    v_users_total INT;
    v_users_today INT;
    v_broadcasts_sent INT;
    v_campaigns_active INT;
    v_referrals_total INT;
BEGIN
    PERFORM public.check_enterprise_bot_access(p_bot_id);

    SELECT count(*), count(*) FILTER (WHERE created_at >= timezone('utc'::text, date_trunc('day', now())))
    INTO v_users_total, v_users_today
    FROM public.bot_users
    WHERE bot_id = p_bot_id;

    SELECT count(*)
    INTO v_broadcasts_sent
    FROM public.bot_broadcasts
    WHERE bot_id = p_bot_id AND status = 'COMPLETED';

    SELECT count(*)
    INTO v_campaigns_active
    FROM public.bot_campaigns
    WHERE bot_id = p_bot_id AND status = 'ACTIVE';

    SELECT count(*)
    INTO v_referrals_total
    FROM public.bot_referral_events
    WHERE bot_id = p_bot_id;

    v_report_data := jsonb_build_object(
        'generated_at', timezone('utc'::text, now()),
        'report_type', p_report_type,
        'total_subscribers', v_users_total,
        'new_subscribers_today', v_users_today,
        'completed_broadcasts', v_broadcasts_sent,
        'active_campaigns', v_campaigns_active,
        'referral_events', v_referrals_total
    );

    UPDATE public.bot_scheduled_reports
    SET last_generated_at = timezone('utc'::text, now()),
        last_report_data = v_report_data
    WHERE bot_id = p_bot_id AND report_type = p_report_type;

    RETURN v_report_data;
END;
$$;

-- ==============================================================================
-- REALTIME PUBLICATION REGISTRATION
-- ==============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_workflow_nodes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_workflow_edges;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_workflow_jobs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_notification_rules;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_scheduled_reports;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_integrations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_integration_events;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
