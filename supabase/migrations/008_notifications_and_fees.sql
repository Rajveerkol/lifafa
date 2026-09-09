-- ==============================================================================
-- Migration: 008_notifications_and_fees.sql
-- Description: Dynamic platform fees and user notification infrastructure.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_type TEXT UNIQUE NOT NULL, -- 'LIFAFA_CREATION', 'WITHDRAWAL'
    calculation_type fee_calculation_type DEFAULT 'FIXED' NOT NULL,
    value NUMERIC(10, 2) DEFAULT 0.00 NOT NULL, -- Default 0 fee
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Seed platform fee defaults (0 fee by default)
INSERT INTO public.platform_fees (fee_type, calculation_type, value, is_active)
VALUES 
    ('LIFAFA_CREATION', 'FIXED', 0.00, TRUE),
    ('WITHDRAWAL', 'FIXED', 0.00, TRUE)
ON CONFLICT (fee_type) DO NOTHING;

-- In-App Notification System
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'CLAIM_SUCCESS', 'LIFAFA_EXPIRED', 'WITHDRAWAL_UPDATE', 'BOT_ALERT', 'SYSTEM'
    reference_id TEXT,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

-- User Notification Preferences (including Telegram Bot Alert and Bot Coming Soon Notify Me)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    telegram_alerts BOOLEAN DEFAULT FALSE NOT NULL,
    bot_coming_soon_alerts BOOLEAN DEFAULT FALSE NOT NULL,
    telegram_chat_id TEXT,
    email_alerts BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
