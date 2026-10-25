-- ==============================================================================
-- Migration: 083_fix_admin_deposit_visibility_and_rpc.sql
-- Description: Ensure full administrative visibility for deposit records,
--              canonical server-side admin listing RPC, and hardened RLS policies.
-- STATUS: NOT EXECUTED (Review and approve before running in Supabase SQL Editor)
--
-- Preserves:
--   - public.wallets, public.merchant_wallets, and all ledger balances.
--   - public.deposit_requests and public.merchant_deposits historical rows.
--   - Fee slab rules (₹100 flat for ₹100-₹999, 2% for >= ₹1,000).
--   - Strict manual verification and admin review workflow.
-- ==============================================================================

-- 1. HARDEN RLS POLICY ON public.deposit_requests FOR AUTHORIZED ADMINISTRATORS
--    Ensures that any verified administrator (via is_admin, has_admin_role, or service_role)
--    can read all customer deposit requests without silent omission by RLS.
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all deposit requests" ON public.deposit_requests;
CREATE POLICY "Admins can view all deposit requests"
    ON public.deposit_requests
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin(auth.uid())
        OR public.has_admin_role('SUPPORT')
        OR public.has_admin_role('ADMIN')
        OR public.has_admin_role('SUPER_ADMIN')
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

-- Preserve individual user policy
DROP POLICY IF EXISTS "Users can view own deposit requests" ON public.deposit_requests;
CREATE POLICY "Users can view own deposit requests"
    ON public.deposit_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 2. HARDEN RLS POLICY ON public.merchant_deposits FOR AUTHORIZED ADMINISTRATORS
ALTER TABLE public.merchant_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view own deposits or admins view all" ON public.merchant_deposits;
CREATE POLICY "Merchants can view own deposits or admins view all"
    ON public.merchant_deposits
    FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.is_admin(auth.uid())
        OR public.has_admin_role('SUPPORT')
        OR public.has_admin_role('ADMIN')
        OR public.has_admin_role('SUPER_ADMIN')
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

-- 3. CANONICAL ADMIN LISTING RPC: admin_get_deposit_requests_rpc
--    Executes as SECURITY DEFINER to avoid PostgREST relationship cache ambiguity,
--    joins profiles accurately, and returns verified status, fee, and payable columns.
CREATE OR REPLACE FUNCTION public.admin_get_deposit_requests_rpc(
    p_status TEXT DEFAULT 'ALL',
    p_limit INT DEFAULT 150,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_service_role BOOLEAN := ((auth.jwt() ->> 'role') = 'service_role');
    v_is_admin BOOLEAN := FALSE;
    v_records JSONB;
    v_total_count INT;
BEGIN
    -- Authorization check
    IF NOT v_is_service_role THEN
        IF v_caller_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Authentication required'
            );
        END IF;

        v_is_admin := (
            public.is_admin(v_caller_id)
            OR public.has_admin_role('SUPPORT')
            OR public.has_admin_role('ADMIN')
            OR public.has_admin_role('SUPER_ADMIN')
        );

        IF NOT v_is_admin THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Access denied: Administrator privileges required.'
            );
        END IF;
    END IF;

    -- Compute total count matching filter
    SELECT COUNT(*) INTO v_total_count
    FROM public.deposit_requests d
    WHERE (p_status = 'ALL' OR d.status = p_status);

    -- Query records joined with profile
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', d.id,
            'user_id', d.user_id,
            'amount', d.amount,
            'deposit_fee', COALESCE(d.deposit_fee, 0.00),
            'total_payable', COALESCE(d.total_payable, d.amount),
            'gateway_provider', COALESCE(d.gateway_provider, 'UPI'),
            'upi_id', d.upi_id,
            'utr_number', d.utr_number,
            'status', d.status,
            'admin_notes', d.admin_notes,
            'processed_by', d.processed_by,
            'processed_at', d.processed_at,
            'created_at', d.created_at,
            'updated_at', d.updated_at,
            'profile', CASE 
                WHEN p.id IS NOT NULL THEN jsonb_build_object(
                    'id', p.id,
                    'full_name', p.full_name,
                    'email', p.email,
                    'avatar_url', p.avatar_url
                )
                ELSE NULL
            END
        )
    ) INTO v_records
    FROM (
        SELECT *
        FROM public.deposit_requests
        WHERE (p_status = 'ALL' OR status = p_status)
        ORDER BY created_at DESC
        LIMIT LEAST(GREATEST(p_limit, 1), 300)
        OFFSET GREATEST(p_offset, 0)
    ) d
    LEFT JOIN public.profiles p ON p.id = d.user_id;

    RETURN jsonb_build_object(
        'success', true,
        'total_count', COALESCE(v_total_count, 0),
        'records', COALESCE(v_records, '[]'::jsonb)
    );
END;
$$;

-- Permissions & Grants
REVOKE ALL ON FUNCTION public.admin_get_deposit_requests_rpc(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_deposit_requests_rpc(TEXT, INT, INT) TO authenticated, service_role;
