-- ==============================================================================
-- Migration: 015_admin_authorization_and_settings_fix.sql
-- Description: Server-side admin authorization backfill, owner bootstrap in 
--              handle_new_user, secure profile update rules, and platform settings.
-- Target: Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure public.admin_users exists with correct schema
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    role admin_role DEFAULT 'ADMIN' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 2. Backfill existing owner/admin accounts into public.admin_users
-- Grants SUPER_ADMIN strictly to the confirmed platform owner emails.
INSERT INTO public.admin_users (user_id, role)
SELECT p.id, 'SUPER_ADMIN'::admin_role
FROM public.profiles p
WHERE LOWER(p.email) IN ('kolrajveer33@gmail.com', 'jayakol796@gmail.com')
ON CONFLICT (user_id) DO UPDATE
SET role = 'SUPER_ADMIN';

-- 3. Authoritative admin check function (relies strictly on public.admin_users)
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

-- 4. Authoritative role hierarchy check (relies strictly on public.admin_users)
CREATE OR REPLACE FUNCTION public.has_admin_role(required_role admin_role DEFAULT 'ADMIN')
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role admin_role;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role 
    FROM public.admin_users 
    WHERE user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF required_role = 'SUPER_ADMIN' THEN
        RETURN v_role = 'SUPER_ADMIN';
    ELSIF required_role = 'ADMIN' THEN
        RETURN v_role IN ('SUPER_ADMIN', 'ADMIN');
    ELSE
        RETURN TRUE; -- SUPPORT, ADMIN, or SUPER_ADMIN
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Update handle_new_user() trigger:
-- Normal users receive standard profile & wallet.
-- ONLY explicitly authorized owner email accounts receive SUPER_ADMIN in admin_users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT := LOWER(COALESCE(NEW.email, ''));
BEGIN
    -- Insert profile from Google OAuth metadata
    INSERT INTO public.profiles (id, full_name, email, avatar_url, last_login_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Lifafa User'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        last_login_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW());

    -- Automatically assign SUPER_ADMIN ONLY if the email is an explicitly confirmed owner email.
    -- Normal users never receive admin privileges.
    IF v_user_email IN ('kolrajveer33@gmail.com', 'jayakol796@gmail.com') THEN
        INSERT INTO public.admin_users (user_id, role)
        VALUES (NEW.id, 'SUPER_ADMIN')
        ON CONFLICT (user_id) DO UPDATE SET role = 'SUPER_ADMIN';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Enforce profile update security:
-- Non-admins can update their full_name, but CANNOT modify email, is_suspended, or id.
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
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Unauthorized: Email cannot be modified directly';
        END IF;
        NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Ensure RLS on platform_settings allows admins to manage settings
DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Admins can update platform settings"
    ON public.platform_settings
    FOR ALL
    TO authenticated
    USING (public.has_admin_role('ADMIN'))
    WITH CHECK (public.has_admin_role('ADMIN'));

DROP POLICY IF EXISTS "Authenticated users can view platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated users can view platform settings"
    ON public.platform_settings
    FOR SELECT
    TO authenticated
    USING (TRUE);
