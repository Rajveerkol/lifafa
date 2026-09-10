-- ==============================================================================
-- Migration: 016_fix_telegram_nonce_crypto.sql
-- Description: Fix cryptographic random nonce generation in generate_telegram_binding_nonce_rpc
--              by using core PostgreSQL CSPRNG (gen_random_uuid) and adding extensions schema.
-- Target: Supabase SQL Editor
-- ==============================================================================

-- Replace generate_telegram_binding_nonce_rpc with bulletproof CSPRNG
CREATE OR REPLACE FUNCTION public.generate_telegram_binding_nonce_rpc()
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_nonce TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Clean expired nonces for this user or globally expired nonces
    DELETE FROM public.telegram_binding_nonces WHERE user_id = v_user_id OR expires_at <= NOW();

    -- Generate cryptographically secure server-side random nonce.
    -- Uses gen_random_uuid() (128-bit RFC 4122 v4 CSPRNG) formatted as 32 hex characters.
    -- gen_random_uuid() is built into core PostgreSQL (pg_catalog), making it 100% immune
    -- to search_path stripping or extension schema differences.
    v_nonce := 'bind_' || replace(gen_random_uuid()::text, '-', '');

    INSERT INTO public.telegram_binding_nonces (nonce, user_id, expires_at)
    VALUES (v_nonce, v_user_id, NOW() + INTERVAL '15 minutes');

    RETURN v_nonce;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_telegram_binding_nonce_rpc() TO authenticated;
