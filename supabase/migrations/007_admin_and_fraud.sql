-- ==============================================================================
-- Migration: 007_admin_and_fraud.sql
-- Description: Admin roles, immutable audit logs, fraud flags, and device tracking.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    role admin_role DEFAULT 'ADMIN' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Immutable Admin Audit Trail
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.admin_audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.admin_audit_logs(target_type, target_id);

-- Fraud & Risk Detection Logs
CREATE TABLE IF NOT EXISTS public.fraud_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL, -- e.g. 'MULTIPLE_ACCOUNTS_SAME_IP', 'RAPID_CLAIMS', 'UNUSUAL_WITHDRAWAL'
    severity fraud_severity DEFAULT 'MEDIUM' NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN DEFAULT FALSE NOT NULL,
    resolved_by UUID REFERENCES public.profiles(id),
    resolution_note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fraud_user ON public.fraud_flags(user_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_fraud_severity ON public.fraud_flags(severity, is_resolved);

-- Device & Session Fingerprint tracking for risk signals
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_device ON public.device_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_ip ON public.device_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON public.device_sessions(user_id);
