-- ==============================================================================
-- Migration: 062_telegram_bot_plan_gating_analytics_admin_phase5.sql
-- Description: Phase 5 Plan-Based Feature Gating, Multi-Admin & Advanced Analytics
-- Authors: Antigravity & User Pair
-- 
-- IMPORTANT: Antigravity MUST NOT execute this SQL file.
-- Manual execution by the database owner is required in Supabase SQL Editor.
-- ==============================================================================

-- 1. Bot Multi-Admin Table (Pro ₹499+)
CREATE TABLE IF NOT EXISTS public.bot_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MODERATOR', 'ANALYST')) DEFAULT 'MODERATOR',
  permissions TEXT[] NOT NULL DEFAULT ARRAY['VIEW_USERS', 'VIEW_ANALYTICS'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bot_admin_email UNIQUE (bot_id, email)
);

-- 2. User Tags for Segmentation (Business ₹999+)
CREATE TABLE IF NOT EXISTS public.bot_user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bot_user_tag UNIQUE (bot_id, name)
);

CREATE TABLE IF NOT EXISTS public.bot_user_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  bot_user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.bot_user_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bot_user_tag_assignment UNIQUE (bot_user_id, tag_id)
);

-- 3. Detailed Audit Log Table (Enterprise ₹1,999)
CREATE TABLE IF NOT EXISTS public.bot_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_bot_admins_bot ON public.bot_admins(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_user_tags_bot ON public.bot_user_tags(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_user_tag_assignments_user ON public.bot_user_tag_assignments(bot_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_audit_logs_bot ON public.bot_audit_logs(bot_id, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict bot & user isolation
-- ==============================================================================
ALTER TABLE public.bot_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_user_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. bot_admins
DROP POLICY IF EXISTS "bot_admins_owner_all" ON public.bot_admins;
CREATE POLICY "bot_admins_owner_all" ON public.bot_admins
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_admins.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_admins.bot_id AND b.user_id = auth.uid()));

-- 2. bot_user_tags
DROP POLICY IF EXISTS "bot_user_tags_owner_all" ON public.bot_user_tags;
CREATE POLICY "bot_user_tags_owner_all" ON public.bot_user_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_user_tags.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_user_tags.bot_id AND b.user_id = auth.uid()));

-- 3. bot_user_tag_assignments
DROP POLICY IF EXISTS "bot_user_tag_assignments_owner_all" ON public.bot_user_tag_assignments;
CREATE POLICY "bot_user_tag_assignments_owner_all" ON public.bot_user_tag_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_user_tag_assignments.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_user_tag_assignments.bot_id AND b.user_id = auth.uid()));

-- 4. bot_audit_logs
DROP POLICY IF EXISTS "bot_audit_logs_owner_all" ON public.bot_audit_logs;
CREATE POLICY "bot_audit_logs_owner_all" ON public.bot_audit_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_audit_logs.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_audit_logs.bot_id AND b.user_id = auth.uid()));

-- ==============================================================================
-- CENTRALIZED PLAN ENTITLEMENT HELPER FUNCTIONS
-- Source of Truth: telegram_bots.bot_slot_id -> bot_slots.plan_price
-- ==============================================================================

-- Helper 1: Get Authoritative Plan Price for a Bot
CREATE OR REPLACE FUNCTION public.get_bot_plan_price(p_bot_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(s.plan_price, 99.00)
  FROM public.telegram_bots b
  JOIN public.bot_slots s ON s.id = b.bot_slot_id
  WHERE b.id = p_bot_id;
$$;

-- Helper 2: Check if Bot Has Specific Feature Entitlement
CREATE OR REPLACE FUNCTION public.check_bot_feature_access(
  p_bot_id UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan_price NUMERIC;
  v_required_price NUMERIC := 99.00;
BEGIN
  -- Fetch bot slot plan price directly from authoritative chain
  v_plan_price := public.get_bot_plan_price(p_bot_id);
  IF v_plan_price IS NULL THEN
    RETURN false;
  END IF;

  -- Determine required threshold price based on centralized registry
  CASE p_feature_key
    -- ₹99 Starter Features
    WHEN 'bot.basic', 'bot.setup', 'bot.start_command', 'bot.user_directory', 'bot.status_metrics' THEN
      v_required_price := 99.00;

    -- ₹299 Basic Features
    WHEN 'bot.commands', 'bot.menus', 'bot.auto_replies', 'bot.broadcast', 'bot.scheduled_broadcast', 'bot.basic_referrals', 'bot.basic_analytics', 'bot.data_export' THEN
      v_required_price := 299.00;

    -- ₹499 Pro Features
    WHEN 'bot.campaigns', 'bot.scheduled_campaigns', 'bot.targeted_broadcast', 'bot.user_segmentation', 'bot.advanced_referrals', 'bot.advanced_analytics', 'bot.multiple_admins', 'bot.fraud_controls' THEN
      v_required_price := 499.00;

    -- ₹999 Business Features
    WHEN 'bot.campaign_sequences', 'bot.user_tags', 'bot.advanced_audience', 'bot.commission_rules', 'bot.api_webhooks', 'bot.business_branding' THEN
      v_required_price := 999.00;

    -- ₹1,999 Enterprise Features
    WHEN 'bot.enterprise_workflows', 'bot.enterprise_staff', 'bot.audit_logs', 'bot.custom_integrations' THEN
      v_required_price := 1999.00;

    ELSE
      -- Unrecognized feature defaults to enterprise protection
      v_required_price := 1999.00;
  END CASE;

  RETURN v_plan_price >= v_required_price;
END;
$$;

-- ==============================================================================
-- SERVER-SIDE RPCs
-- ==============================================================================

-- RPC 1: Authoritative Bot Entitlements Resolver
CREATE OR REPLACE FUNCTION public.get_bot_entitlements_rpc(p_bot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bot RECORD;
  v_slot RECORD;
  v_price NUMERIC;
  v_tier TEXT;
  v_limits JSONB;
BEGIN
  -- Validate ownership
  SELECT b.* INTO v_bot
  FROM public.telegram_bots b
  WHERE b.id = p_bot_id
    AND b.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bot not found or unauthorized';
  END IF;

  SELECT s.* INTO v_slot
  FROM public.bot_slots s
  WHERE s.id = v_bot.bot_slot_id;

  v_price := COALESCE(v_slot.plan_price, 99.00);

  IF v_price >= 1999 THEN
    v_tier := 'ENTERPRISE';
    v_limits := jsonb_build_object(
      'max_admins', 999,
      'max_custom_commands', 50,
      'max_broadcast_recipients_daily', 50000,
      'max_active_campaigns', 25,
      'has_api_access', true,
      'has_audit_logs', true
    );
  ELSIF v_price >= 999 THEN
    v_tier := 'BUSINESS';
    v_limits := jsonb_build_object(
      'max_admins', 10,
      'max_custom_commands', 30,
      'max_broadcast_recipients_daily', 20000,
      'max_active_campaigns', 10,
      'has_api_access', true,
      'has_audit_logs', false
    );
  ELSIF v_price >= 499 THEN
    v_tier := 'PRO';
    v_limits := jsonb_build_object(
      'max_admins', 3,
      'max_custom_commands', 15,
      'max_broadcast_recipients_daily', 5000,
      'max_active_campaigns', 5,
      'has_api_access', false,
      'has_audit_logs', false
    );
  ELSIF v_price >= 299 THEN
    v_tier := 'BASIC';
    v_limits := jsonb_build_object(
      'max_admins', 1,
      'max_custom_commands', 8,
      'max_broadcast_recipients_daily', 1000,
      'max_active_campaigns', 0,
      'has_api_access', false,
      'has_audit_logs', false
    );
  ELSE
    v_tier := 'STARTER';
    v_limits := jsonb_build_object(
      'max_admins', 1,
      'max_custom_commands', 0,
      'max_broadcast_recipients_daily', 0,
      'max_active_campaigns', 0,
      'has_api_access', false,
      'has_audit_logs', false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'bot_id', p_bot_id,
    'bot_slot_id', v_bot.bot_slot_id,
    'plan_price', v_price,
    'plan_name', COALESCE(v_slot.plan_name, 'Starter Bot Slot'),
    'tier', v_tier,
    'limits', v_limits,
    'features', jsonb_build_object(
      'commands', (v_price >= 299),
      'menus', (v_price >= 299),
      'auto_replies', (v_price >= 299),
      'broadcast', (v_price >= 299),
      'scheduled_broadcast', (v_price >= 299),
      'referrals', (v_price >= 299),
      'campaigns', (v_price >= 499),
      'targeted_broadcast', (v_price >= 499),
      'user_segmentation', (v_price >= 499),
      'advanced_analytics', (v_price >= 499),
      'multiple_admins', (v_price >= 499),
      'user_tags', (v_price >= 999),
      'api_webhooks', (v_price >= 999),
      'audit_logs', (v_price >= 1999),
      'enterprise_workflows', (v_price >= 1999)
    )
  );
END;
$$;

-- RPC 2: Server-Enforced Admin Invitation (Pro ₹499+)
CREATE OR REPLACE FUNCTION public.create_bot_admin_rpc(
  p_bot_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'MODERATOR',
  p_permissions TEXT[] DEFAULT ARRAY['VIEW_USERS', 'VIEW_ANALYTICS']
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_price NUMERIC;
  v_current_count INTEGER;
  v_max_admins INTEGER;
  v_new_id UUID;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.telegram_bots b
    WHERE b.id = p_bot_id AND b.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_price := public.get_bot_plan_price(p_bot_id);

  -- Gating: Multiple admins requires Pro ₹499+
  IF v_price < 499 THEN
    RAISE EXCEPTION 'Multiple admins is a Pro feature (₹499+). Current plan is ₹%.', v_price;
  END IF;

  IF v_price >= 1999 THEN
    v_max_admins := 999;
  ELSIF v_price >= 999 THEN
    v_max_admins := 10;
  ELSE
    v_max_admins := 3;
  END IF;

  SELECT count(*) INTO v_current_count
  FROM public.bot_admins
  WHERE bot_id = p_bot_id;

  IF v_current_count >= v_max_admins THEN
    RAISE EXCEPTION 'Plan admin limit reached (% max for your plan).', v_max_admins;
  END IF;

  INSERT INTO public.bot_admins (bot_id, email, role, permissions)
  VALUES (p_bot_id, lower(trim(p_email)), p_role, p_permissions)
  RETURNING id INTO v_new_id;

  -- Record audit log if Enterprise
  IF v_price >= 1999 THEN
    INSERT INTO public.bot_audit_logs (bot_id, actor_id, action, target_type, target_id, details)
    VALUES (p_bot_id, auth.uid(), 'ADD_ADMIN', 'ADMIN', v_new_id::text, jsonb_build_object('email', p_email, 'role', p_role));
  END IF;

  RETURN jsonb_build_object('ok', true, 'admin_id', v_new_id);
END;
$$;

-- RPC 3: Plan-Tiered Server-Side Analytics Resolver
CREATE OR REPLACE FUNCTION public.get_bot_plan_analytics_rpc(
  p_bot_id UUID,
  p_timeframe TEXT DEFAULT '7D'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_price NUMERIC;
  v_total_users INTEGER := 0;
  v_active_24h INTEGER := 0;
  v_messages_today INTEGER := 0;
  v_total_broadcasts INTEGER := 0;
  v_total_campaigns INTEGER := 0;
  v_total_referrals INTEGER := 0;
  v_qualified_referrals INTEGER := 0;
  v_user_growth JSONB := '[]'::jsonb;
  v_tag_breakdown JSONB := '[]'::jsonb;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.telegram_bots b
    WHERE b.id = p_bot_id AND b.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_price := public.get_bot_plan_price(p_bot_id);

  -- 1. Base counts (All plans including ₹99)
  SELECT count(*) INTO v_total_users
  FROM public.bot_users
  WHERE bot_id = p_bot_id;

  SELECT count(*) INTO v_active_24h
  FROM public.bot_users
  WHERE bot_id = p_bot_id
    AND last_seen_at >= now() - INTERVAL '24 hours';

  SELECT count(*) INTO v_messages_today
  FROM public.bot_events
  WHERE bot_id = p_bot_id
    AND created_at >= date_trunc('day', now());

  -- If Starter ₹99: return basic telemetry only
  IF v_price < 299 THEN
    RETURN jsonb_build_object(
      'tier', 'STARTER',
      'plan_price', v_price,
      'total_users', v_total_users,
      'active_users_24h', v_active_24h,
      'messages_today', v_messages_today,
      'advanced_analytics_locked', true
    );
  END IF;

  -- 2. Basic Analytics (₹299+)
  SELECT count(*) INTO v_total_broadcasts
  FROM public.bot_broadcasts
  WHERE bot_id = p_bot_id;

  SELECT count(*), count(*) FILTER (WHERE status = 'QUALIFIED')
  INTO v_total_referrals, v_qualified_referrals
  FROM public.bot_referrals
  WHERE bot_id = p_bot_id;

  -- Daily registration growth
  SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) INTO v_user_growth
  FROM (
    SELECT date(first_seen_at) as date, count(*) as count
    FROM public.bot_users
    WHERE bot_id = p_bot_id
      AND first_seen_at >= now() - INTERVAL '7 days'
    GROUP BY date(first_seen_at)
    ORDER BY date ASC
  ) d;

  IF v_price < 499 THEN
    RETURN jsonb_build_object(
      'tier', 'BASIC',
      'plan_price', v_price,
      'total_users', v_total_users,
      'active_users_24h', v_active_24h,
      'messages_today', v_messages_today,
      'total_broadcasts', v_total_broadcasts,
      'total_referrals', v_total_referrals,
      'qualified_referrals', v_qualified_referrals,
      'user_growth', v_user_growth,
      'pro_analytics_locked', true
    );
  END IF;

  -- 3. Pro Analytics (₹499+)
  SELECT count(*) INTO v_total_campaigns
  FROM public.bot_campaigns
  WHERE bot_id = p_bot_id;

  -- 4. Business & Enterprise additions (₹999+)
  IF v_price >= 999 THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_tag_breakdown
    FROM (
      SELECT tag.name, count(assign.id) as user_count
      FROM public.bot_user_tags tag
      LEFT JOIN public.bot_user_tag_assignments assign ON assign.tag_id = tag.id
      WHERE tag.bot_id = p_bot_id
      GROUP BY tag.name
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'tier', CASE WHEN v_price >= 1999 THEN 'ENTERPRISE' WHEN v_price >= 999 THEN 'BUSINESS' ELSE 'PRO' END,
    'plan_price', v_price,
    'total_users', v_total_users,
    'active_users_24h', v_active_24h,
    'messages_today', v_messages_today,
    'total_broadcasts', v_total_broadcasts,
    'total_campaigns', v_total_campaigns,
    'total_referrals', v_total_referrals,
    'qualified_referrals', v_qualified_referrals,
    'user_growth', v_user_growth,
    'tag_breakdown', v_tag_breakdown,
    'audit_analytics_unlocked', (v_price >= 1999)
  );
END;
$$;

-- ==============================================================================
-- HARDENING: UPDATE EXISTING RPCs WITH SERVER-SIDE PLAN ENTITLEMENT GATING
-- ==============================================================================

-- Enforce ₹299+ on Broadcast Preparation & ₹499+ on Audience Segmentation
CREATE OR REPLACE FUNCTION public.prepare_bot_broadcast_recipients_rpc(
  p_broadcast_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_broadcast RECORD;
  v_price NUMERIC;
  v_count INTEGER := 0;
BEGIN
  -- 1. Validate broadcast existence & ownership
  SELECT b.* INTO v_broadcast
  FROM public.bot_broadcasts b
  JOIN public.telegram_bots tb ON tb.id = b.bot_id
  WHERE b.id = p_broadcast_id
    AND tb.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Broadcast not found or unauthorized';
  END IF;

  -- 2. Authoritative Plan Gating Check
  v_price := public.get_bot_plan_price(v_broadcast.bot_id);

  IF v_price < 299 THEN
    RAISE EXCEPTION 'Broadcasts are locked on Starter (₹99). Upgrade to Basic (₹299) or higher to broadcast.';
  END IF;

  IF v_broadcast.target_audience IN ('ACTIVE_24H', 'ACTIVE_7D', 'NEW_USERS', 'CUSTOM_SELECTED_USERS') AND v_price < 499 THEN
    RAISE EXCEPTION 'Targeted audience segmentation requires Pro (₹499) or higher. Current plan is ₹%.', v_price;
  END IF;

  -- 3. Clear existing pending recipients
  DELETE FROM public.bot_broadcast_recipients
  WHERE broadcast_id = p_broadcast_id
    AND status = 'PENDING';

  -- 4. Populate recipient queue
  IF v_broadcast.target_audience = 'ALL_ACTIVE_USERS' THEN
    INSERT INTO public.bot_broadcast_recipients (broadcast_id, bot_id, bot_user_id, telegram_user_id, status)
    SELECT v_broadcast.id, v_broadcast.bot_id, u.id, u.telegram_user_id, 'PENDING'
    FROM public.bot_users u
    WHERE u.bot_id = v_broadcast.bot_id
      AND u.status = 'ACTIVE'
    ON CONFLICT (broadcast_id, bot_user_id) DO NOTHING;

  ELSIF v_broadcast.target_audience = 'ACTIVE_24H' THEN
    INSERT INTO public.bot_broadcast_recipients (broadcast_id, bot_id, bot_user_id, telegram_user_id, status)
    SELECT v_broadcast.id, v_broadcast.bot_id, u.id, u.telegram_user_id, 'PENDING'
    FROM public.bot_users u
    WHERE u.bot_id = v_broadcast.bot_id
      AND u.status = 'ACTIVE'
      AND u.last_seen_at >= now() - INTERVAL '24 hours'
    ON CONFLICT (broadcast_id, bot_user_id) DO NOTHING;

  ELSIF v_broadcast.target_audience = 'ACTIVE_7D' THEN
    INSERT INTO public.bot_broadcast_recipients (broadcast_id, bot_id, bot_user_id, telegram_user_id, status)
    SELECT v_broadcast.id, v_broadcast.bot_id, u.id, u.telegram_user_id, 'PENDING'
    FROM public.bot_users u
    WHERE u.bot_id = v_broadcast.bot_id
      AND u.status = 'ACTIVE'
      AND u.last_seen_at >= now() - INTERVAL '7 days'
    ON CONFLICT (broadcast_id, bot_user_id) DO NOTHING;

  ELSIF v_broadcast.target_audience = 'NEW_USERS' THEN
    INSERT INTO public.bot_broadcast_recipients (broadcast_id, bot_id, bot_user_id, telegram_user_id, status)
    SELECT v_broadcast.id, v_broadcast.bot_id, u.id, u.telegram_user_id, 'PENDING'
    FROM public.bot_users u
    WHERE u.bot_id = v_broadcast.bot_id
      AND u.status = 'ACTIVE'
      AND u.first_seen_at >= now() - INTERVAL '48 hours'
    ON CONFLICT (broadcast_id, bot_user_id) DO NOTHING;

  ELSIF v_broadcast.target_audience = 'CUSTOM_SELECTED_USERS' AND v_broadcast.custom_user_ids IS NOT NULL THEN
    INSERT INTO public.bot_broadcast_recipients (broadcast_id, bot_id, bot_user_id, telegram_user_id, status)
    SELECT v_broadcast.id, v_broadcast.bot_id, u.id, u.telegram_user_id, 'PENDING'
    FROM public.bot_users u
    WHERE u.bot_id = v_broadcast.bot_id
      AND u.status = 'ACTIVE'
      AND u.id = ANY(v_broadcast.custom_user_ids)
    ON CONFLICT (broadcast_id, bot_user_id) DO NOTHING;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.bot_broadcasts
  SET total_recipients = v_count,
      updated_at = now()
  WHERE id = p_broadcast_id;

  RETURN jsonb_build_object(
    'ok', true,
    'broadcast_id', p_broadcast_id,
    'total_recipients', v_count
  );
END;
$$;

-- ==============================================================================
-- REALTIME PUBLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_admins;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_user_tags;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_audit_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
