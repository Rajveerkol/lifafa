-- ==============================================================================
-- MIGRATION 056: ADMIN-CONTROLLED PUBLIC LIFAFA LISTING VISIBILITY
-- ==============================================================================
-- BUSINESS REQUIREMENT:
-- On the public /lifafa listing page, DO NOT show every Lifafa automatically.
-- Only Lifafas that are explicitly enabled by Admin from the Admin Panel should
-- appear in the public Lifafa listing.
--
-- ARCHITECTURE & NON-REGRESSION:
-- 1. Adds public.lifafas.is_public_visible BOOLEAN NOT NULL DEFAULT FALSE.
--    - For newly created Lifafas, default is FALSE (does not auto-appear on /lifafa).
--    - For existing historical Lifafas, default is FALSE (disappear from public listing).
-- 2. Preserves public.lifafas.is_public (default TRUE) so direct claim links
--    (/claim/LF-XXXXXX) continue to function under existing RLS policies.
-- 3. Creates public.admin_set_lifafa_public_visibility_rpc:
--    - Strict server-side admin check (has_admin_role('ADMIN') OR is_admin()).
--    - Atomically updates public.lifafas.is_public_visible with concurrency lock.
--    - Records immutable admin audit log in public.admin_audit_logs.
-- 4. High-performance partial index on (is_public_visible, status, created_at DESC).
-- 5. Does NOT touch:
--    - Prize amounts, winner counts, allocations, wallet balances.
--    - Payout fee escrow, claim logic, Telegram/YouTube tasks, device limits.
-- ==============================================================================

-- 1. Add authoritative is_public_visible column
ALTER TABLE public.lifafas
ADD COLUMN IF NOT EXISTS is_public_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Ensure all existing historical records are set to FALSE initially
UPDATE public.lifafas
SET is_public_visible = FALSE
WHERE is_public_visible IS NULL;

-- 3. High-performance partial index for public listing queries
CREATE INDEX IF NOT EXISTS idx_lifafas_public_listing
ON public.lifafas (is_public_visible, status, created_at DESC)
WHERE is_public_visible = TRUE;

-- 4. Authoritative Admin RPC to toggle public listing visibility
CREATE OR REPLACE FUNCTION public.admin_set_lifafa_public_visibility_rpc(
    p_lifafa_id UUID,
    p_is_public_visible BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_lifafa RECORD;
    v_old_visibility BOOLEAN;
BEGIN
    -- Strict authorization check: Caller must be a platform administrator
    IF NOT (public.has_admin_role('ADMIN') OR public.is_admin(v_admin_id)) THEN
        RAISE EXCEPTION 'Access denied: only platform administrators can modify Lifafa public visibility';
    END IF;

    IF p_is_public_visible IS NULL THEN
        RAISE EXCEPTION 'p_is_public_visible must be a non-null boolean';
    END IF;

    -- Concurrency row lock on target Lifafa
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa with ID % not found', p_lifafa_id;
    END IF;

    v_old_visibility := COALESCE(v_lifafa.is_public_visible, FALSE);

    -- If visibility is already at requested state, return early idempotently
    IF v_old_visibility = p_is_public_visible THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'lifafa_id', p_lifafa_id,
            'code', v_lifafa.code,
            'is_public_visible', p_is_public_visible
        );
    END IF;

    -- Update authoritative public listing visibility
    UPDATE public.lifafas
    SET is_public_visible = p_is_public_visible,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_lifafa_id;

    -- Record immutable admin audit log entry
    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        details
    ) VALUES (
        v_admin_id,
        CASE WHEN p_is_public_visible THEN 'LIFAFA_VISIBILITY_ENABLED' ELSE 'LIFAFA_VISIBILITY_DISABLED' END,
        'LIFAFA',
        p_lifafa_id::text,
        jsonb_build_object(
            'lifafa_id', p_lifafa_id,
            'lifafa_code', v_lifafa.code,
            'old_visibility', v_old_visibility,
            'new_visibility', p_is_public_visible
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', p_lifafa_id,
        'code', v_lifafa.code,
        'old_visibility', v_old_visibility,
        'is_public_visible', p_is_public_visible
    );
END;
$$;

-- Revoke all permissions from anon / public, grant execute only to authenticated & service_role
REVOKE ALL ON FUNCTION public.admin_set_lifafa_public_visibility_rpc(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_lifafa_public_visibility_rpc(UUID, BOOLEAN) TO authenticated, service_role;
