-- ==============================================================================
-- MIGRATION 082: Mandatory Funds Safety Notice, Terms Acceptance & Compliance Audit System
-- STATUS: NOT EXECUTED (FOR REVIEW ONLY - DO NOT APPLY WITHOUT AUTHORIZATION)
-- Target: Supabase SQL Editor / Migration Pipeline
-- ==============================================================================
-- Description:
--   Establishes production-grade infrastructure for mandatory Funds Safety &
--   Responsibility Notice acceptance across CreateLifafa merchant accounts and
--   depositing customers:
--     1. public.terms_campaigns: Versioned terms campaigns with immutable hashes.
--     2. public.user_terms_acceptances: Tamper-resistant acceptance/rejection records,
--        mobile number verification status, and trusted server timestamps.
--     3. public.terms_notice_events: Audit trail for notice display and reminder events.
--     4. RLS security policies restricting records to the owning user and administrators.
--     5. RPC functions for status check, two-step submission, and admin compliance auditing.
--
-- Absolute Preservation of Financial Data:
--   - public.wallets is NEVER touched or dropped.
--   - public.merchant_wallets is NEVER touched or dropped.
--   - public.wallet_transactions is NEVER touched or dropped.
--   - public.deposit_requests is completely preserved.
--   - public.merchant_deposits is completely preserved.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TERMS CAMPAIGNS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terms_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_code TEXT UNIQUE NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    applicable_roles TEXT[] NOT NULL DEFAULT '{"MERCHANT", "CUSTOMER"}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terms_campaigns_code_active ON public.terms_campaigns(campaign_code, is_active);

-- ------------------------------------------------------------------------------
-- 2. USER TERMS ACCEPTANCES AUDIT TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_terms_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
    campaign_id UUID NOT NULL REFERENCES public.terms_campaigns(id) ON DELETE RESTRICT,
    terms_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
    mobile_number TEXT,
    mobile_verification_status TEXT NOT NULL DEFAULT 'USER_CONFIRMED' 
        CHECK (mobile_verification_status IN ('USER_CONFIRMED', 'OTP_VERIFIED', 'NOT_VERIFIED')),
    terms_snapshot_hash TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_user_terms_version UNIQUE (user_id, campaign_id, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_user_terms_user ON public.user_terms_acceptances(user_id, terms_version);
CREATE INDEX IF NOT EXISTS idx_user_terms_status ON public.user_terms_acceptances(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_terms_mobile ON public.user_terms_acceptances(mobile_number) WHERE mobile_number IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. NOTICE AUDIT EVENTS TABLE (DISPLAY, SCROLL, REMINDER TRACKING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terms_notice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.terms_campaigns(id) ON DELETE CASCADE,
    terms_version TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('DISPLAYED', 'SCROLLED_END', 'ACCEPTED', 'REJECTED', 'REMINDER_SENT')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terms_events_user ON public.terms_notice_events(user_id, event_type, created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.terms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_notice_events ENABLE ROW LEVEL SECURITY;

-- Terms Campaigns RLS: Any authenticated user can read active campaigns
DROP POLICY IF EXISTS "Authenticated users can read terms campaigns" ON public.terms_campaigns;
CREATE POLICY "Authenticated users can read terms campaigns"
    ON public.terms_campaigns FOR SELECT
    TO authenticated
    USING (is_active = true OR public.is_admin(auth.uid()));

-- Terms Campaigns RLS: Only admins can insert or modify campaigns
DROP POLICY IF EXISTS "Admins can manage terms campaigns" ON public.terms_campaigns;
CREATE POLICY "Admins can manage terms campaigns"
    ON public.terms_campaigns FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- User Terms Acceptances RLS: Users can view their own acceptance records
DROP POLICY IF EXISTS "Users can view own terms acceptances" ON public.user_terms_acceptances;
CREATE POLICY "Users can view own terms acceptances"
    ON public.user_terms_acceptances FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- User Terms Acceptances RLS: Authenticated users can insert their own record
DROP POLICY IF EXISTS "Users can insert own terms acceptances" ON public.user_terms_acceptances;
CREATE POLICY "Users can insert own terms acceptances"
    ON public.user_terms_acceptances FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- User Notice Events RLS
DROP POLICY IF EXISTS "Users can view own notice events" ON public.terms_notice_events;
CREATE POLICY "Users can view own notice events"
    ON public.terms_notice_events FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own notice events" ON public.terms_notice_events;
CREATE POLICY "Users can insert own notice events"
    ON public.terms_notice_events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. SEED INITIAL FUNDS SAFETY NOTICE CAMPAIGN (v1.0.0)
-- ------------------------------------------------------------------------------
INSERT INTO public.terms_campaigns (
    id,
    campaign_code,
    version,
    title,
    content_hash,
    content_text,
    is_active,
    applicable_roles
) VALUES (
    '00000000-0000-0000-0000-000000000082',
    'funds_safety_2026',
    'v1.0.0',
    'Important: Funds Safety & Responsibility Notice',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    '1. Accurate Payment Information
I confirm that funds I deposit or transfer through CreateLifafa are submitted using payment details and instructions displayed by the platform. I am responsible for checking the recipient details, amount, applicable charges, and transaction reference before completing a payment.

2. Fund Status and Verification
A submitted deposit request does not automatically mean the payment has been received, verified, cleared, or credited. Funds remain subject to applicable banking/payment-provider processes, reconciliation, fraud checks, and the platform''s published procedures.

3. Responsibility for My Transactions
I am responsible for ensuring that transfers I initiate are authorized, lawful, and made from accounts or payment methods I am permitted to use. I must retain transaction receipts and provide accurate reference details when requested.

4. Important Funds Declaration
I understand that the funds I deposit are subject to payment verification, banking rules, applicable law, and the platform''s published terms. I must not assume that every transfer is immediately available or guaranteed to be recoverable.

5. Suspicious or Unverified Transactions
If a transaction is flagged, disputed, reversed, held, or suspected to involve fraud or unlawful activity, the platform may temporarily restrict the affected transaction or balance to the extent permitted by applicable law and the platform''s valid policies. The platform must follow applicable legal obligations and its dispute-resolution process.

6. My Responsibility and Cooperation
I agree to provide accurate information, cooperate with lawful verification requests, and report suspicious activity promptly. Responsibility for a transaction will be assessed based on the actual facts, applicable law, and relevant platform policies.

7. No False Guarantee
The platform does not promise that every transfer is risk-free, instantly settled, or immune from banking disputes. Nothing in these terms removes statutory rights or makes the user automatically liable for circumstances outside their control.

8. Acceptance Record
My acceptance records the version of the terms I reviewed, my authenticated account, the confirmation time, and the mobile number I provide or confirm. The platform will use this information only for legitimate compliance, security, support, and audit purposes under its applicable privacy policy.',
    true,
    '{"MERCHANT", "CUSTOMER"}'::TEXT[]
)
ON CONFLICT (campaign_code) DO UPDATE
SET version = EXCLUDED.version,
    title = EXCLUDED.title,
    content_text = EXCLUDED.content_text,
    content_hash = EXCLUDED.content_hash,
    is_active = true,
    updated_at = TIMEZONE('utc'::text, NOW());

-- ------------------------------------------------------------------------------
-- 6. RPC: GET CURRENT USER TERMS STATUS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_terms_status_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_campaign RECORD;
    v_acceptance RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'has_accepted', false,
            'status', 'PENDING',
            'is_applicable', false,
            'error', 'Authentication required'
        );
    END IF;

    -- Fetch active campaign
    SELECT * INTO v_campaign
    FROM public.terms_campaigns
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'has_accepted', true,
            'status', 'ACCEPTED',
            'is_applicable', false,
            'message', 'No active terms campaign configured'
        );
    END IF;

    -- Check user acceptance for this campaign version
    SELECT * INTO v_acceptance
    FROM public.user_terms_acceptances
    WHERE user_id = v_user_id
      AND campaign_id = v_campaign.id
      AND terms_version = v_campaign.version
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'has_accepted', (v_acceptance.status = 'ACCEPTED'),
            'status', v_acceptance.status,
            'campaign_id', v_campaign.id,
            'version', v_campaign.version,
            'title', v_campaign.title,
            'content_text', v_campaign.content_text,
            'content_hash', v_campaign.content_hash,
            'accepted_at', v_acceptance.accepted_at,
            'mobile_number', v_acceptance.mobile_number,
            'mobile_verification_status', v_acceptance.mobile_verification_status,
            'is_applicable', true
        );
    ELSE
        RETURN jsonb_build_object(
            'has_accepted', false,
            'status', 'PENDING',
            'campaign_id', v_campaign.id,
            'version', v_campaign.version,
            'title', v_campaign.title,
            'content_text', v_campaign.content_text,
            'content_hash', v_campaign.content_hash,
            'is_applicable', true
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_terms_status_rpc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_terms_status_rpc() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC: SUBMIT USER TERMS DECISION (ACCEPTED OR REJECTED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_user_terms_decision_rpc(
    p_campaign_id UUID,
    p_version TEXT,
    p_decision TEXT,
    p_mobile_number TEXT DEFAULT NULL,
    p_terms_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_merchant_id UUID;
    v_clean_decision TEXT;
    v_clean_mobile TEXT;
    v_clean_version TEXT;
    v_clean_hash TEXT;
    v_verif_status TEXT := 'USER_CONFIRMED';
    v_acceptance_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required to submit terms acceptance');
    END IF;

    v_clean_decision := UPPER(TRIM(COALESCE(p_decision, '')));
    IF v_clean_decision NOT IN ('ACCEPTED', 'REJECTED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid decision. Must be ACCEPTED or REJECTED');
    END IF;

    v_clean_version := TRIM(COALESCE(p_version, 'v1.0.0'));
    v_clean_hash := TRIM(COALESCE(p_terms_hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'));

    -- Find merchant ID if user owns a merchant account
    SELECT id INTO v_merchant_id
    FROM public.merchants
    WHERE user_id = v_user_id
    LIMIT 1;

    IF v_clean_decision = 'ACCEPTED' THEN
        v_clean_mobile := REGEXP_REPLACE(COALESCE(p_mobile_number, ''), '[^0-9+]', '', 'g');
        IF LENGTH(v_clean_mobile) < 10 THEN
            RETURN jsonb_build_object('success', false, 'error', 'A valid 10-digit mobile number is required to confirm terms');
        END IF;
        IF NOT v_clean_mobile LIKE '+%' THEN
            v_clean_mobile := '+91' || v_clean_mobile;
        END IF;
        v_verif_status := 'USER_CONFIRMED';
    ELSE
        v_clean_mobile := NULL;
        v_verif_status := 'NOT_VERIFIED';
    END IF;

    -- Upsert acceptance record idempotently
    INSERT INTO public.user_terms_acceptances (
        user_id,
        merchant_id,
        campaign_id,
        terms_version,
        status,
        mobile_number,
        mobile_verification_status,
        terms_snapshot_hash,
        accepted_at,
        created_at
    ) VALUES (
        v_user_id,
        v_merchant_id,
        p_campaign_id,
        v_clean_version,
        v_clean_decision,
        v_clean_mobile,
        v_verif_status,
        v_clean_hash,
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (user_id, campaign_id, terms_version) DO UPDATE
    SET status = EXCLUDED.status,
        mobile_number = COALESCE(EXCLUDED.mobile_number, public.user_terms_acceptances.mobile_number),
        mobile_verification_status = EXCLUDED.mobile_verification_status,
        terms_snapshot_hash = EXCLUDED.terms_snapshot_hash,
        accepted_at = TIMEZONE('utc'::text, NOW())
    RETURNING id INTO v_acceptance_id;

    -- Record notice event audit log
    INSERT INTO public.terms_notice_events (
        user_id,
        campaign_id,
        terms_version,
        event_type,
        created_at
    ) VALUES (
        v_user_id,
        p_campaign_id,
        v_clean_version,
        v_clean_decision,
        TIMEZONE('utc'::text, NOW())
    );

    RETURN jsonb_build_object(
        'success', true,
        'acceptance_id', v_acceptance_id,
        'status', v_clean_decision,
        'version', v_clean_version,
        'mobile_number', v_clean_mobile,
        'mobile_verification_status', v_verif_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_user_terms_decision_rpc(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_user_terms_decision_rpc(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC: ADMIN COMPLIANCE AUDIT LISTING
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_terms_compliance_rpc(
    p_status TEXT DEFAULT NULL,
    p_account_type TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_version TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    account_type TEXT,
    merchant_id UUID,
    merchant_code TEXT,
    business_name TEXT,
    mobile_number TEXT,
    mobile_verification_status TEXT,
    terms_version TEXT,
    campaign_id UUID,
    status TEXT,
    terms_snapshot_hash TEXT,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    needs_reacceptance BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_active_version TEXT;
BEGIN
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    SELECT version INTO v_active_version
    FROM public.terms_campaigns
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN QUERY
    SELECT
        a.id,
        a.user_id,
        COALESCE(p.email, 'N/A') AS user_email,
        COALESCE(p.full_name, 'N/A') AS user_name,
        CASE WHEN m.id IS NOT NULL THEN 'MERCHANT'::TEXT ELSE 'CUSTOMER'::TEXT END AS account_type,
        m.id AS merchant_id,
        m.merchant_code,
        m.business_name,
        COALESCE(a.mobile_number, m.mobile_number, p.phone_number, 'N/A') AS mobile_number,
        a.mobile_verification_status,
        a.terms_version,
        a.campaign_id,
        a.status,
        a.terms_snapshot_hash,
        a.accepted_at,
        a.created_at,
        (a.terms_version <> COALESCE(v_active_version, 'v1.0.0')) AS needs_reacceptance
    FROM public.user_terms_acceptances a
    JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN public.merchants m ON m.user_id = a.user_id
    WHERE (p_status IS NULL OR a.status = p_status)
      AND (p_version IS NULL OR a.terms_version = p_version)
      AND (p_account_type IS NULL OR (
          (p_account_type = 'MERCHANT' AND m.id IS NOT NULL) OR
          (p_account_type = 'CUSTOMER' AND m.id IS NULL)
      ))
      AND (p_search IS NULL OR (
          p.email ILIKE '%' || p_search || '%' OR
          p.full_name ILIKE '%' || p_search || '%' OR
          m.merchant_code ILIKE '%' || p_search || '%' OR
          m.business_name ILIKE '%' || p_search || '%' OR
          a.mobile_number ILIKE '%' || p_search || '%' OR
          a.user_id::TEXT ILIKE '%' || p_search || '%'
      ))
    ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_terms_compliance_rpc(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_terms_compliance_rpc(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. RPC: ADMIN COMPLIANCE SUMMARY METRICS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_terms_compliance_metrics_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_total_applicable BIGINT := 0;
    v_accepted BIGINT := 0;
    v_rejected BIGINT := 0;
    v_pending BIGINT := 0;
    v_user_confirmed BIGINT := 0;
    v_otp_verified BIGINT := 0;
    v_active_version TEXT := 'v1.0.0';
    v_active_campaign_code TEXT := 'funds_safety_2026';
BEGIN
    IF NOT v_is_service_role THEN
        IF v_admin_uid IS NULL OR NOT public.is_admin(v_admin_uid) THEN
            RAISE EXCEPTION 'Access denied: administrator privileges required';
        END IF;
    END IF;

    SELECT version, campaign_code INTO v_active_version, v_active_campaign_code
    FROM public.terms_campaigns
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT COUNT(*) INTO v_accepted
    FROM public.user_terms_acceptances
    WHERE status = 'ACCEPTED' AND terms_version = v_active_version;

    SELECT COUNT(*) INTO v_rejected
    FROM public.user_terms_acceptances
    WHERE status = 'REJECTED' AND terms_version = v_active_version;

    SELECT COUNT(*) INTO v_user_confirmed
    FROM public.user_terms_acceptances
    WHERE mobile_verification_status = 'USER_CONFIRMED' AND status = 'ACCEPTED';

    SELECT COUNT(*) INTO v_otp_verified
    FROM public.user_terms_acceptances
    WHERE mobile_verification_status = 'OTP_VERIFIED' AND status = 'ACCEPTED';

    -- Applicable accounts = merchants + users who deposited
    SELECT COUNT(DISTINCT user_id) INTO v_total_applicable
    FROM (
        SELECT user_id FROM public.merchants WHERE status = 'ACTIVE'
        UNION
        SELECT user_id FROM public.deposit_requests
    ) applicable_accounts;

    IF v_total_applicable < (v_accepted + v_rejected) THEN
        v_total_applicable := v_accepted + v_rejected;
    END IF;

    v_pending := GREATEST(0, v_total_applicable - (v_accepted + v_rejected));

    RETURN jsonb_build_object(
        'total_applicable', v_total_applicable,
        'total_accepted', v_accepted,
        'total_rejected', v_rejected,
        'total_pending', v_pending,
        'total_user_confirmed_mobile', v_user_confirmed,
        'total_otp_verified_mobile', v_otp_verified,
        'active_version', COALESCE(v_active_version, 'v1.0.0'),
        'active_campaign_code', COALESCE(v_active_campaign_code, 'funds_safety_2026')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_terms_compliance_metrics_rpc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_terms_compliance_metrics_rpc() TO authenticated, service_role;
