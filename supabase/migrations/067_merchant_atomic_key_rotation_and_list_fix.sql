-- ==============================================================================
-- Migration: 067_merchant_atomic_key_rotation_and_list_fix.sql
-- Purpose: Atomic single-active-key rotation, secure listing, and key history
-- Status: NOT EXECUTED — USER MUST RUN THIS MANUALLY
-- ==============================================================================

-- 1. Ensure table public.merchant_api_keys exists with proper columns and indices
CREATE TABLE IF NOT EXISTS public.merchant_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL DEFAULT 'Primary API Key',
    client_id TEXT NOT NULL UNIQUE,
    client_secret_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mch_api_keys_client_id ON public.merchant_api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_mch_api_keys_merchant ON public.merchant_api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_mch_api_keys_active ON public.merchant_api_keys(merchant_id, is_active);

-- Enable RLS
ALTER TABLE public.merchant_api_keys ENABLE ROW LEVEL SECURITY;

-- 2. Clean permissions: Only safe columns exposed to authenticated role
REVOKE ALL ON public.merchant_api_keys FROM anon, PUBLIC;
GRANT SELECT (id, merchant_id, key_name, client_id, is_active, last_used_at, created_at)
    ON public.merchant_api_keys TO authenticated;
GRANT ALL ON public.merchant_api_keys TO service_role;

-- 3. RLS Select Policy: Merchant owners and admins can read their safe metadata
DROP POLICY IF EXISTS "Merchants can read own api keys" ON public.merchant_api_keys;
DROP POLICY IF EXISTS "Merchants manage own api keys" ON public.merchant_api_keys;

CREATE POLICY "Merchants can read own api keys"
    ON public.merchant_api_keys FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.merchants m
            WHERE m.id = merchant_api_keys.merchant_id
              AND (m.user_id = auth.uid() OR auth.role() = 'service_role')
        )
    );

-- 4. RPC: Atomic Single-Active-Key Rotation
CREATE OR REPLACE FUNCTION public.merchant_rotate_api_key_rpc(
    p_merchant_id UUID,
    p_key_name TEXT DEFAULT 'Primary API Key'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_key_id UUID;
    v_client_id TEXT;
    v_raw_secret TEXT;
    v_secret_hash TEXT;
    v_revoked_count INT := 0;
BEGIN
    -- 1. Verify target merchant is active
    IF NOT EXISTS (
        SELECT 1 FROM public.merchants
        WHERE id = p_merchant_id 
          AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'Access denied: merchant account is not active';
    END IF;

    -- 2. Verify caller ownership
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    -- 3. Generate cryptographically secure credentials
    -- Prefix mk_live_ for merchant keys (32 hex characters)
    v_client_id := 'mk_live_' || encode(extensions.gen_random_bytes(16), 'hex');
    v_raw_secret := 'sk_live_' || encode(extensions.gen_random_bytes(24), 'hex');
    v_secret_hash := encode(extensions.digest(v_raw_secret, 'sha256'), 'hex');
    v_key_id := gen_random_uuid();

    -- 4. Atomically REVOKE all existing active keys for this merchant
    UPDATE public.merchant_api_keys
    SET is_active = FALSE
    WHERE merchant_id = p_merchant_id AND is_active = TRUE;
    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

    -- 5. Insert new key as ACTIVE
    INSERT INTO public.merchant_api_keys (
        id,
        merchant_id,
        key_name,
        client_id,
        client_secret_hash,
        is_active,
        created_at
    ) VALUES (
        v_key_id,
        p_merchant_id,
        COALESCE(NULLIF(TRIM(p_key_name), ''), 'Primary API Key'),
        v_client_id,
        v_secret_hash,
        TRUE,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'key_id', v_key_id,
        'client_id', v_client_id,
        'client_secret', v_raw_secret,
        'key_name', COALESCE(NULLIF(TRIM(p_key_name), ''), 'Primary API Key'),
        'revoked_count', v_revoked_count,
        'created_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_rotate_api_key_rpc(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_rotate_api_key_rpc(UUID, TEXT) TO authenticated, service_role;

-- 5. RPC: Also update merchant_generate_api_key_rpc to enforce atomic rotation
CREATE OR REPLACE FUNCTION public.merchant_generate_api_key_rpc(
    p_merchant_id UUID,
    p_key_name TEXT DEFAULT 'Primary API Key'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN public.merchant_rotate_api_key_rpc(p_merchant_id, p_key_name);
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_generate_api_key_rpc(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_generate_api_key_rpc(UUID, TEXT) TO authenticated, service_role;

-- 6. RPC: List API Keys (Safe Metadata Only, Ordered by Created At DESC)
CREATE OR REPLACE FUNCTION public.merchant_list_api_keys_rpc(p_merchant_id UUID)
RETURNS TABLE (
    id UUID,
    merchant_id UUID,
    key_name TEXT,
    client_id TEXT,
    is_active BOOLEAN,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
BEGIN
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchants
            WHERE id = p_merchant_id AND user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this merchant account';
        END IF;
    END IF;

    RETURN QUERY
    SELECT 
        k.id,
        k.merchant_id,
        k.key_name,
        k.client_id,
        k.is_active,
        k.last_used_at,
        k.created_at
    FROM public.merchant_api_keys k
    WHERE k.merchant_id = p_merchant_id
    ORDER BY k.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_list_api_keys_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_list_api_keys_rpc(UUID) TO authenticated, service_role;

-- 7. RPC: Explicitly Revoke Key by Key ID
CREATE OR REPLACE FUNCTION public.merchant_revoke_api_key_rpc(p_key_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
BEGIN
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.merchant_api_keys k
            JOIN public.merchants m ON m.id = k.merchant_id
            WHERE k.id = p_key_id AND m.user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Access denied: caller does not own this API key';
        END IF;
    END IF;

    UPDATE public.merchant_api_keys
    SET is_active = FALSE
    WHERE id = p_key_id;

    RETURN jsonb_build_object('success', true, 'key_id', p_key_id, 'is_active', false);
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_revoke_api_key_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_revoke_api_key_rpc(UUID) TO authenticated, service_role;
