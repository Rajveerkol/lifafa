-- ==============================================================================
-- Migration: 009_rls_policies.sql
-- Description: Strict Row Level Security (RLS) for all tables and admin authorization.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

-- Admin check helper function (SECURITY DEFINER to avoid recursive policy evaluation)
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifafas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifafa_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifafa_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifafa_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;
CREATE POLICY "Users can view own profile or admins view all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- Enforce that non-admins cannot modify suspension status, id, or timestamps
CREATE OR REPLACE FUNCTION public.enforce_profile_update_security()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their own suspension status';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Unauthorized: User ID cannot be modified';
        END IF;
        NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_profile_update_security ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update_security
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update_security();

-- 2. WALLETS POLICIES (Read-only for clients; updates only via server-side RPC functions)
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet"
    ON public.wallets FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- Disallow direct client INSERT/UPDATE/DELETE on wallets to prevent frontend balance tampering
-- (All mutations happen through SECURITY DEFINER RPC functions)

-- 3. WALLET TRANSACTIONS POLICIES (Read-only ledger for users)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- 4. LIFAFAS POLICIES
DROP POLICY IF EXISTS "Public can view active public lifafas or own created" ON public.lifafas;
CREATE POLICY "Public can view active public lifafas or own created"
    ON public.lifafas FOR SELECT
    USING (
        (is_public = TRUE AND status IN ('ACTIVE', 'COMPLETED', 'EXPIRED'))
        OR auth.uid() = creator_id
        OR public.is_admin()
    );

-- 5. LIFAFA ALLOCATIONS POLICIES
-- Non-admins can only see allocations they claimed, to avoid leaking private randomized winner amounts
DROP POLICY IF EXISTS "Users view own claimed allocation or creator/admin view" ON public.lifafa_allocations;
CREATE POLICY "Users view own claimed allocation or creator/admin view"
    ON public.lifafa_allocations FOR SELECT
    USING (
        claimed_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.lifafas WHERE id = lifafa_id AND creator_id = auth.uid())
        OR public.is_admin()
    );

-- 6. LIFAFA CLAIMS POLICIES
DROP POLICY IF EXISTS "Users can view own claims or creator/admin view" ON public.lifafa_claims;
CREATE POLICY "Users can view own claims or creator/admin view"
    ON public.lifafa_claims FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.lifafas WHERE id = lifafa_id AND creator_id = auth.uid())
        OR public.is_admin()
    );

-- 7. LIFAFA TASKS POLICIES
DROP POLICY IF EXISTS "Public can view tasks of accessible lifafas" ON public.lifafa_tasks;
CREATE POLICY "Public can view tasks of accessible lifafas"
    ON public.lifafa_tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.lifafas 
            WHERE id = lifafa_id 
              AND (is_public = TRUE OR creator_id = auth.uid() OR public.is_admin())
        )
    );

-- 8. TASK COMPLETIONS POLICIES
DROP POLICY IF EXISTS "Users can view and insert own task completions" ON public.task_completions;
DROP POLICY IF EXISTS "Users can view own task completions" ON public.task_completions;
CREATE POLICY "Users can view own task completions"
    ON public.task_completions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own task completions" ON public.task_completions;
CREATE POLICY "Users can insert own task completions"
    ON public.task_completions FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        AND (
            status = 'PENDING'
            OR (
                status = 'VERIFIED'
                AND verification_method = 'URL_VISIT'
                AND EXISTS (
                    SELECT 1 FROM public.lifafa_tasks t
                    WHERE t.id = task_id 
                      AND t.task_type IN ('VISIT_WEBSITE', 'CUSTOM')
                )
            )
            OR public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Only server or admin can update task completions" ON public.task_completions;
CREATE POLICY "Only server or admin can update task completions"
    ON public.task_completions FOR UPDATE
    USING (public.is_admin());

-- 9. WITHDRAWALS POLICIES (Users view own, admins view and update all)
DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can view own withdrawals"
    ON public.withdrawals FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- 10. PAYOUT TRANSACTIONS POLICIES (Admin and system only)
DROP POLICY IF EXISTS "Only admins can view payout transactions" ON public.payout_transactions;
CREATE POLICY "Only admins can view payout transactions"
    ON public.payout_transactions FOR ALL
    USING (public.is_admin());

-- 11. ADMIN TABLES POLICIES
DROP POLICY IF EXISTS "Admin tables restricted to admins" ON public.admin_users;
CREATE POLICY "Admin tables restricted to admins"
    ON public.admin_users FOR SELECT
    USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Audit logs viewable only by admins" ON public.admin_audit_logs;
CREATE POLICY "Audit logs viewable only by admins"
    ON public.admin_audit_logs FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Fraud flags viewable only by admins" ON public.fraud_flags;
CREATE POLICY "Fraud flags viewable only by admins"
    ON public.fraud_flags FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Device sessions viewable by user or admin" ON public.device_sessions;
CREATE POLICY "Device sessions viewable by user or admin"
    ON public.device_sessions FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- 12. PLATFORM FEES POLICIES
DROP POLICY IF EXISTS "Anyone can view platform fees" ON public.platform_fees;
CREATE POLICY "Anyone can view platform fees"
    ON public.platform_fees FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Only admins can update fees" ON public.platform_fees;
CREATE POLICY "Only admins can update fees"
    ON public.platform_fees FOR ALL
    USING (public.is_admin());

-- 13. NOTIFICATIONS & PREFERENCES POLICIES
DROP POLICY IF EXISTS "Users can view and update own notifications" ON public.notifications;
CREATE POLICY "Users can view and update own notifications"
    ON public.notifications FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view and update own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view and update own preferences"
    ON public.notification_preferences FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id);
