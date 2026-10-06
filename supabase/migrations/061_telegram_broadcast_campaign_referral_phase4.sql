-- ==============================================================================
-- Migration: 061_telegram_broadcast_campaign_referral_phase4.sql
-- Description: Phase 4 Telegram Broadcasts, Campaigns & Referral Engine
-- Authors: Antigravity & User Pair
-- 
-- IMPORTANT: Antigravity MUST NOT execute this SQL file.
-- Manual execution by the database owner is required in Supabase SQL Editor.
-- ==============================================================================

-- 1. Broadcasts Master Table
CREATE TABLE IF NOT EXISTS public.bot_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message_text TEXT NOT NULL,
  photo_url TEXT,
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_audience TEXT NOT NULL DEFAULT 'ALL_ACTIVE_USERS' CHECK (
    target_audience IN (
      'ALL_ACTIVE_USERS',
      'ACTIVE_24H',
      'ACTIVE_7D',
      'NEW_USERS',
      'CUSTOM_SELECTED_USERS'
    )
  ),
  custom_user_ids UUID[] DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',
      'SCHEDULED',
      'PROCESSING',
      'COMPLETED',
      'PARTIAL',
      'FAILED',
      'CANCELLED'
    )
  ),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Broadcast Recipients Queue Table (Strict Idempotency)
CREATE TABLE IF NOT EXISTS public.bot_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.bot_broadcasts(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  bot_user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED')
  ),
  attempts INTEGER NOT NULL DEFAULT 0,
  telegram_message_id BIGINT,
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_broadcast_recipient UNIQUE (broadcast_id, bot_user_id)
);

-- 3. Campaigns Master Table
CREATE TABLE IF NOT EXISTS public.bot_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  message_text TEXT NOT NULL,
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_audience TEXT NOT NULL DEFAULT 'ALL_ACTIVE_USERS',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED')
  ),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  total_participants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_campaign_time CHECK (end_at > start_at)
);

-- 4. Campaign Participants Table (Prevent Duplicate Participation)
CREATE TABLE IF NOT EXISTS public.bot_campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.bot_campaigns(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  bot_user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'JOINED' CHECK (
    status IN ('JOINED', 'COMPLETED', 'DISQUALIFIED')
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_campaign_participant UNIQUE (campaign_id, bot_user_id)
);

-- 5. Referral Settings Table
CREATE TABLE IF NOT EXISTS public.bot_referral_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  reward_enabled BOOLEAN NOT NULL DEFAULT true,
  reward_amount NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  reward_currency TEXT NOT NULL DEFAULT 'POINTS',
  qualification_requirement TEXT NOT NULL DEFAULT 'JOIN_ONLY' CHECK (
    qualification_requirement IN ('JOIN_ONLY', 'ACTIVE_3_DAYS', 'MANUAL_VERIFY')
  ),
  welcome_bonus_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bot_referral_settings_bot UNIQUE (bot_id)
);

-- 6. Bot User Referral Codes Table
CREATE TABLE IF NOT EXISTS public.bot_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  bot_user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_qualified INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bot_user_referral_code UNIQUE (bot_id, bot_user_id),
  CONSTRAINT uq_bot_referral_code_namespace UNIQUE (bot_id, code)
);

-- 7. Referrals Attribution Table (Anti-Fraud: One attribution per user per bot)
CREATE TABLE IF NOT EXISTS public.bot_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  referrer_bot_user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  referred_bot_user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED')
  ),
  qualified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bot_referral_user UNIQUE (bot_id, referred_bot_user_id),
  CONSTRAINT chk_no_self_referral CHECK (referrer_bot_user_id <> referred_bot_user_id)
);

-- 8. Referral Rewards Table (Server-Authoritative Eligibility)
CREATE TABLE IF NOT EXISTS public.bot_referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES public.bot_referrals(id) ON DELETE CASCADE,
  referrer_bot_user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  reward_amount NUMERIC(10, 2) NOT NULL,
  reward_currency TEXT NOT NULL DEFAULT 'POINTS',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'ELIGIBLE', 'REWARDED', 'REJECTED', 'CANCELLED')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_referral_reward UNIQUE (referral_id)
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_bot_broadcasts_bot ON public.bot_broadcasts(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_bot_broadcast_recipients_fetch ON public.bot_broadcast_recipients(broadcast_id, status);
CREATE INDEX IF NOT EXISTS idx_bot_campaigns_bot ON public.bot_campaigns(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_bot_campaign_part_camp ON public.bot_campaign_participants(campaign_id, bot_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_referral_codes_code ON public.bot_referral_codes(bot_id, code);
CREATE INDEX IF NOT EXISTS idx_bot_referrals_referrer ON public.bot_referrals(bot_id, referrer_bot_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_referral_rewards_referrer ON public.bot_referral_rewards(bot_id, referrer_bot_user_id, status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-Bot & Cross-User Isolation
-- ==============================================================================
ALTER TABLE public.bot_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_campaign_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_referral_rewards ENABLE ROW LEVEL SECURITY;

-- 1. bot_broadcasts
DROP POLICY IF EXISTS "bot_broadcasts_owner_all" ON public.bot_broadcasts;
CREATE POLICY "bot_broadcasts_owner_all" ON public.bot_broadcasts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_broadcasts.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_broadcasts.bot_id AND b.user_id = auth.uid()));

-- 2. bot_broadcast_recipients
DROP POLICY IF EXISTS "bot_broadcast_recipients_owner_all" ON public.bot_broadcast_recipients;
CREATE POLICY "bot_broadcast_recipients_owner_all" ON public.bot_broadcast_recipients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_broadcast_recipients.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_broadcast_recipients.bot_id AND b.user_id = auth.uid()));

-- 3. bot_campaigns
DROP POLICY IF EXISTS "bot_campaigns_owner_all" ON public.bot_campaigns;
CREATE POLICY "bot_campaigns_owner_all" ON public.bot_campaigns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_campaigns.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_campaigns.bot_id AND b.user_id = auth.uid()));

-- 4. bot_campaign_participants
DROP POLICY IF EXISTS "bot_campaign_participants_owner_all" ON public.bot_campaign_participants;
CREATE POLICY "bot_campaign_participants_owner_all" ON public.bot_campaign_participants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_campaign_participants.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_campaign_participants.bot_id AND b.user_id = auth.uid()));

-- 5. bot_referral_settings
DROP POLICY IF EXISTS "bot_referral_settings_owner_all" ON public.bot_referral_settings;
CREATE POLICY "bot_referral_settings_owner_all" ON public.bot_referral_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referral_settings.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referral_settings.bot_id AND b.user_id = auth.uid()));

-- 6. bot_referral_codes
DROP POLICY IF EXISTS "bot_referral_codes_owner_all" ON public.bot_referral_codes;
CREATE POLICY "bot_referral_codes_owner_all" ON public.bot_referral_codes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referral_codes.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referral_codes.bot_id AND b.user_id = auth.uid()));

-- 7. bot_referrals
DROP POLICY IF EXISTS "bot_referrals_owner_all" ON public.bot_referrals;
CREATE POLICY "bot_referrals_owner_all" ON public.bot_referrals
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referrals.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referrals.bot_id AND b.user_id = auth.uid()));

-- 8. bot_referral_rewards
DROP POLICY IF EXISTS "bot_referral_rewards_owner_all" ON public.bot_referral_rewards;
CREATE POLICY "bot_referral_rewards_owner_all" ON public.bot_referral_rewards
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referral_rewards.bot_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_referral_rewards.bot_id AND b.user_id = auth.uid()));

-- ==============================================================================
-- SERVER-SIDE RPCs
-- ==============================================================================

-- RPC 1: Prepare Broadcast Recipients (Server-authoritative Audience calculation)
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

  -- 2. Remove existing pending recipients if any
  DELETE FROM public.bot_broadcast_recipients
  WHERE broadcast_id = p_broadcast_id
    AND status = 'PENDING';

  -- 3. Populate recipient queue according to target audience
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

  -- 4. Update broadcast recipient count
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

-- RPC 2: Generate or Fetch Bot User Referral Code
CREATE OR REPLACE FUNCTION public.get_or_create_bot_user_referral_code_rpc(
  p_bot_id UUID,
  p_bot_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code RECORD;
  v_new_code TEXT;
BEGIN
  -- Look for existing code
  SELECT * INTO v_code
  FROM public.bot_referral_codes
  WHERE bot_id = p_bot_id
    AND bot_user_id = p_bot_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'code', v_code.code);
  END IF;

  -- Generate unique code (e.g., REF_a8f9c1)
  v_new_code := 'REF_' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 8);

  INSERT INTO public.bot_referral_codes (bot_id, bot_user_id, code)
  VALUES (p_bot_id, p_bot_user_id, v_new_code)
  RETURNING * INTO v_code;

  RETURN jsonb_build_object('ok', true, 'code', v_code.code);
END;
$$;

-- RPC 3: Process Referral Attribution with Anti-Fraud Validation
CREATE OR REPLACE FUNCTION public.process_bot_referral_attribution_rpc(
  p_bot_id UUID,
  p_referred_bot_user_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ref_code RECORD;
  v_settings RECORD;
  v_existing_ref RECORD;
  v_referral_id UUID;
  v_reward_id UUID;
BEGIN
  -- Clean input code
  p_referral_code := trim(p_referral_code);

  -- 1. Verify referral code exists for this specific bot namespace
  SELECT * INTO v_ref_code
  FROM public.bot_referral_codes
  WHERE bot_id = p_bot_id
    AND code = p_referral_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_CODE');
  END IF;

  -- 2. Anti-fraud: Prevent self-referral
  IF v_ref_code.bot_user_id = p_referred_bot_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'SELF_REFERRAL_REJECTED');
  END IF;

  -- 3. Anti-fraud: Check if this user was already referred for this bot
  SELECT * INTO v_existing_ref
  FROM public.bot_referrals
  WHERE bot_id = p_bot_id
    AND referred_bot_user_id = p_referred_bot_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_REFERRED');
  END IF;

  -- 4. Get bot referral settings
  SELECT * INTO v_settings
  FROM public.bot_referral_settings
  WHERE bot_id = p_bot_id;

  -- 5. Record referral attribution
  INSERT INTO public.bot_referrals (
    bot_id,
    referrer_bot_user_id,
    referred_bot_user_id,
    referral_code,
    status,
    qualified_at
  )
  VALUES (
    p_bot_id,
    v_ref_code.bot_user_id,
    p_referred_bot_user_id,
    p_referral_code,
    CASE WHEN v_settings.qualification_requirement = 'JOIN_ONLY' THEN 'QUALIFIED' ELSE 'PENDING' END,
    CASE WHEN v_settings.qualification_requirement = 'JOIN_ONLY' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_referral_id;

  -- 6. Update referrer counters
  UPDATE public.bot_referral_codes
  SET total_referrals = total_referrals + 1,
      total_qualified = total_qualified + CASE WHEN v_settings.qualification_requirement = 'JOIN_ONLY' THEN 1 ELSE 0 END
  WHERE id = v_ref_code.id;

  -- 7. If qualified and rewards enabled, create server-authoritative reward entry
  IF (v_settings IS NULL OR v_settings.reward_enabled = true) AND (v_settings.qualification_requirement = 'JOIN_ONLY') THEN
    INSERT INTO public.bot_referral_rewards (
      bot_id,
      referral_id,
      referrer_bot_user_id,
      reward_amount,
      reward_currency,
      status
    )
    VALUES (
      p_bot_id,
      v_referral_id,
      v_ref_code.bot_user_id,
      COALESCE(v_settings.reward_amount, 10.00),
      COALESCE(v_settings.reward_currency, 'POINTS'),
      'ELIGIBLE'
    )
    RETURNING id INTO v_reward_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'referral_id', v_referral_id,
    'referrer_bot_user_id', v_ref_code.bot_user_id,
    'qualified', (v_settings.qualification_requirement = 'JOIN_ONLY')
  );
END;
$$;

-- RPC 4: Referral Leaderboard (Safe, Server-Side Aggregation)
CREATE OR REPLACE FUNCTION public.get_bot_referral_leaderboard_rpc(
  p_bot_id UUID,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  rank BIGINT,
  bot_user_id UUID,
  telegram_user_id BIGINT,
  username TEXT,
  first_name TEXT,
  total_referrals INTEGER,
  total_qualified INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.telegram_bots tb
    WHERE tb.id = p_bot_id AND tb.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.total_qualified DESC, c.total_referrals DESC) AS rank,
    u.id AS bot_user_id,
    u.telegram_user_id,
    u.username,
    u.first_name,
    c.total_referrals,
    c.total_qualified
  FROM public.bot_referral_codes c
  JOIN public.bot_users u ON u.id = c.bot_user_id
  WHERE c.bot_id = p_bot_id
    AND c.total_referrals > 0
  ORDER BY c.total_qualified DESC, c.total_referrals DESC
  LIMIT p_limit;
END;
$$;

-- ==============================================================================
-- REALTIME PUBLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_broadcasts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_broadcast_recipients;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_campaigns;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_campaign_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_referrals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_referral_rewards;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
