-- ==============================================================================
-- MIGRATION 085: MERCHANT GATEWAY COMPLETE FINANCIAL ANALYTICS & PAGINATED HISTORY
-- ==============================================================================
-- SQL STATUS: NOT EXECUTED — AWAITING MANUAL EXECUTION / AUTHORIZATION
--
-- PURPOSE:
-- 1. Provides high-performance, authoritative server-side aggregation for merchant
--    financial statistics, daily volume trends (IST timezone), and separate deposit/withdrawal totals.
-- 2. Implements authoritative server-side pagination (strictly 100 records per page)
--    with multi-parameter search, status, type, and date range filters over a unified
--    composite view of merchant_deposits and merchant_payouts.
-- 3. Adds composite indexes for stable, zero-lag tie-breaker ordering (created_at DESC, id DESC).
-- 4. Preserves strict RLS and merchant identity ownership (merchants only access their own records).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERFORMANCE INDEXES FOR STABLE COMPOSITE ORDERING & FILTERING
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mch_payouts_composite_pagination
    ON public.merchant_payouts (merchant_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_mch_deposits_composite_pagination
    ON public.merchant_deposits (merchant_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_mch_payouts_status_created
    ON public.merchant_payouts (merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mch_deposits_status_created
    ON public.merchant_deposits (merchant_id, status, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. AUTHORITATIVE SERVER-SIDE FINANCIAL ANALYTICS RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_merchant_financial_analytics_rpc(
    p_merchant_id UUID,
    p_timezone_offset_minutes INT DEFAULT 330
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
    v_user_wallet RECORD;
    v_mch_wallet RECORD;
    v_tz_interval INTERVAL;

    -- Lifetime Totals
    v_total_dep_amt NUMERIC(12, 2) := 0.00;
    v_total_dep_gross NUMERIC(12, 2) := 0.00;
    v_total_dep_count INT := 0;

    v_total_wth_amt NUMERIC(12, 2) := 0.00;
    v_total_wth_gross NUMERIC(12, 2) := 0.00;
    v_total_wth_count INT := 0;

    -- Today (IST)
    v_today_dep_amt NUMERIC(12, 2) := 0.00;
    v_today_dep_count INT := 0;
    v_today_wth_amt NUMERIC(12, 2) := 0.00;
    v_today_wth_count INT := 0;
    v_today_tx_count INT := 0;

    -- Yesterday (IST)
    v_yest_dep_amt NUMERIC(12, 2) := 0.00;
    v_yest_dep_count INT := 0;
    v_yest_wth_amt NUMERIC(12, 2) := 0.00;
    v_yest_wth_count INT := 0;
    v_yest_tx_count INT := 0;

    -- Last 7 Days
    v_week_dep_amt NUMERIC(12, 2) := 0.00;
    v_week_wth_amt NUMERIC(12, 2) := 0.00;
    v_week_tx_count INT := 0;

    -- Last 30 Days
    v_month_dep_amt NUMERIC(12, 2) := 0.00;
    v_month_wth_amt NUMERIC(12, 2) := 0.00;
    v_month_tx_count INT := 0;

    -- Pending
    v_pending_dep_count INT := 0;
    v_pending_dep_amt NUMERIC(12, 2) := 0.00;
    v_pending_wth_count INT := 0;
    v_pending_wth_amt NUMERIC(12, 2) := 0.00;

    -- Status Totals
    v_successful_count INT := 0;
    v_pending_count INT := 0;
    v_failed_count INT := 0;
    v_rejected_count INT := 0;
    v_total_tx_count INT := 0;

    -- Daily Chart Array
    v_daily_chart JSONB := '[]'::jsonb;
    v_day_record RECORD;
    v_avail_bal NUMERIC(12, 2) := 0.00;
    v_locked_bal NUMERIC(12, 2) := 0.00;
BEGIN
    -- Authorization Check
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required to access merchant analytics';
        END IF;

        SELECT * INTO v_merchant
        FROM public.merchants
        WHERE id = p_merchant_id AND user_id = v_caller_uid;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Merchant account % not found or unauthorized for user %', p_merchant_id, v_caller_uid;
        END IF;
    ELSE
        SELECT * INTO v_merchant
        FROM public.merchants
        WHERE id = p_merchant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Merchant account % not found', p_merchant_id;
        END IF;
    END IF;

    v_tz_interval := (p_timezone_offset_minutes || ' minutes')::INTERVAL;

    -- 1. Fetch Authoritative Float Balances
    SELECT * INTO v_user_wallet FROM public.wallets WHERE user_id = v_merchant.user_id;
    SELECT * INTO v_mch_wallet FROM public.merchant_wallets WHERE merchant_id = p_merchant_id;

    v_avail_bal := COALESCE(v_user_wallet.available_balance, v_mch_wallet.available_balance, 0.00);
    v_locked_bal := COALESCE(v_mch_wallet.locked_payout_balance, 0.00);

    -- 2. Aggregate Deposit Metrics (Authoritative: Only APPROVED counts as successful)
    SELECT
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN net_credited ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN gross_amount ELSE 0 END), 0.00),
        COALESCE(COUNT(CASE WHEN status = 'APPROVED' THEN 1 END), 0),
        COALESCE(COUNT(CASE WHEN status = 'PENDING' THEN 1 END), 0),
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN gross_amount ELSE 0 END), 0.00),
        COALESCE(COUNT(CASE WHEN status = 'REJECTED' THEN 1 END), 0),
        COALESCE(SUM(CASE WHEN status = 'APPROVED' AND (created_at + v_tz_interval)::date = (NOW() + v_tz_interval)::date THEN net_credited ELSE 0 END), 0.00),
        COALESCE(COUNT(CASE WHEN status = 'APPROVED' AND (created_at + v_tz_interval)::date = (NOW() + v_tz_interval)::date THEN 1 END), 0),
        COALESCE(SUM(CASE WHEN status = 'APPROVED' AND (created_at + v_tz_interval)::date = ((NOW() + v_tz_interval)::date - 1) THEN net_credited ELSE 0 END), 0.00),
        COALESCE(COUNT(CASE WHEN status = 'APPROVED' AND (created_at + v_tz_interval)::date = ((NOW() + v_tz_interval)::date - 1) THEN 1 END), 0),
        COALESCE(SUM(CASE WHEN status = 'APPROVED' AND created_at >= (NOW() - INTERVAL '7 days') THEN net_credited ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN status = 'APPROVED' AND created_at >= (NOW() - INTERVAL '30 days') THEN net_credited ELSE 0 END), 0.00),
        COUNT(*)
    INTO
        v_total_dep_amt,
        v_total_dep_gross,
        v_total_dep_count,
        v_pending_dep_count,
        v_pending_dep_amt,
        v_rejected_count,
        v_today_dep_amt,
        v_today_dep_count,
        v_yest_dep_amt,
        v_yest_dep_count,
        v_week_dep_amt,
        v_month_dep_amt,
        v_total_tx_count
    FROM public.merchant_deposits
    WHERE merchant_id = p_merchant_id;

    -- 3. Aggregate Payout Metrics (Authoritative: Only SUCCESS counts as completed withdrawal)
    DECLARE
        v_payout_total_count INT := 0;
        v_payout_failed_count INT := 0;
        v_payout_reversed_count INT := 0;
    BEGIN
        SELECT
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN total_deducted ELSE 0 END), 0.00),
            COALESCE(COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END), 0),
            COALESCE(COUNT(CASE WHEN status IN ('PENDING', 'PROCESSING') THEN 1 END), 0),
            COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PROCESSING') THEN amount ELSE 0 END), 0.00),
            COALESCE(COUNT(CASE WHEN status = 'FAILED' THEN 1 END), 0),
            COALESCE(COUNT(CASE WHEN status = 'REVERSED' THEN 1 END), 0),
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' AND (created_at + v_tz_interval)::date = (NOW() + v_tz_interval)::date THEN amount ELSE 0 END), 0.00),
            COALESCE(COUNT(CASE WHEN status = 'SUCCESS' AND (created_at + v_tz_interval)::date = (NOW() + v_tz_interval)::date THEN 1 END), 0),
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' AND (created_at + v_tz_interval)::date = ((NOW() + v_tz_interval)::date - 1) THEN amount ELSE 0 END), 0.00),
            COALESCE(COUNT(CASE WHEN status = 'SUCCESS' AND (created_at + v_tz_interval)::date = ((NOW() + v_tz_interval)::date - 1) THEN 1 END), 0),
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' AND created_at >= (NOW() - INTERVAL '7 days') THEN amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN status = 'SUCCESS' AND created_at >= (NOW() - INTERVAL '30 days') THEN amount ELSE 0 END), 0.00),
            COUNT(*)
        INTO
            v_total_wth_amt,
            v_total_wth_gross,
            v_total_wth_count,
            v_pending_wth_count,
            v_pending_wth_amt,
            v_payout_failed_count,
            v_payout_reversed_count,
            v_today_wth_amt,
            v_today_wth_count,
            v_yest_wth_amt,
            v_yest_wth_count,
            v_week_wth_amt,
            v_month_wth_amt,
            v_payout_total_count
        FROM public.merchant_payouts
        WHERE merchant_id = p_merchant_id;

        v_total_tx_count := v_total_tx_count + v_payout_total_count;
        v_failed_count := v_payout_failed_count;
        v_rejected_count := v_rejected_count + v_payout_reversed_count;
    END;

    -- Compute Combined Status Totals
    v_successful_count := v_total_dep_count + v_total_wth_count;
    v_pending_count := v_pending_dep_count + v_pending_wth_count;

    -- Combined Counts for Today, Yesterday, Week, Month
    SELECT
        (SELECT COUNT(*) FROM public.merchant_deposits WHERE merchant_id = p_merchant_id AND (created_at + v_tz_interval)::date = (NOW() + v_tz_interval)::date) +
        (SELECT COUNT(*) FROM public.merchant_payouts WHERE merchant_id = p_merchant_id AND (created_at + v_tz_interval)::date = (NOW() + v_tz_interval)::date)
    INTO v_today_tx_count;

    SELECT
        (SELECT COUNT(*) FROM public.merchant_deposits WHERE merchant_id = p_merchant_id AND (created_at + v_tz_interval)::date = ((NOW() + v_tz_interval)::date - 1)) +
        (SELECT COUNT(*) FROM public.merchant_payouts WHERE merchant_id = p_merchant_id AND (created_at + v_tz_interval)::date = ((NOW() + v_tz_interval)::date - 1))
    INTO v_yest_tx_count;

    SELECT
        (SELECT COUNT(*) FROM public.merchant_deposits WHERE merchant_id = p_merchant_id AND created_at >= (NOW() - INTERVAL '7 days')) +
        (SELECT COUNT(*) FROM public.merchant_payouts WHERE merchant_id = p_merchant_id AND created_at >= (NOW() - INTERVAL '7 days'))
    INTO v_week_tx_count;

    SELECT
        (SELECT COUNT(*) FROM public.merchant_deposits WHERE merchant_id = p_merchant_id AND created_at >= (NOW() - INTERVAL '30 days')) +
        (SELECT COUNT(*) FROM public.merchant_payouts WHERE merchant_id = p_merchant_id AND created_at >= (NOW() - INTERVAL '30 days'))
    INTO v_month_tx_count;

    -- 4. Build 14-Day Daily Chart Series
    WITH date_series AS (
        SELECT ((NOW() + v_tz_interval)::date - i) AS day_date
        FROM generate_series(0, 13) AS i
    ),
    day_deps AS (
        SELECT
            (created_at + v_tz_interval)::date AS dep_date,
            SUM(CASE WHEN status = 'APPROVED' THEN net_credited ELSE 0 END) AS dep_vol,
            COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) AS dep_succ,
            COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) AS dep_fail,
            COUNT(*) AS dep_total
        FROM public.merchant_deposits
        WHERE merchant_id = p_merchant_id AND created_at >= (NOW() - INTERVAL '15 days')
        GROUP BY (created_at + v_tz_interval)::date
    ),
    day_pays AS (
        SELECT
            (created_at + v_tz_interval)::date AS pay_date,
            SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END) AS pay_vol,
            COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) AS pay_succ,
            COUNT(CASE WHEN status IN ('FAILED', 'REVERSED') THEN 1 END) AS pay_fail,
            COUNT(*) AS pay_total
        FROM public.merchant_payouts
        WHERE merchant_id = p_merchant_id AND created_at >= (NOW() - INTERVAL '15 days')
        GROUP BY (created_at + v_tz_interval)::date
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', ds.day_date::text,
            'label', to_char(ds.day_date, 'DD Mon'),
            'deposit_volume', COALESCE(dd.dep_vol, 0.00),
            'withdrawal_volume', COALESCE(dp.pay_vol, 0.00),
            'successful_count', COALESCE(dd.dep_succ, 0) + COALESCE(dp.pay_succ, 0),
            'failed_count', COALESCE(dd.dep_fail, 0) + COALESCE(dp.pay_fail, 0),
            'total_count', COALESCE(dd.dep_total, 0) + COALESCE(dp.pay_total, 0)
        ) ORDER BY ds.day_date ASC
    ) INTO v_daily_chart
    FROM date_series ds
    LEFT JOIN day_deps dd ON dd.dep_date = ds.day_date
    LEFT JOIN day_pays dp ON dp.pay_date = ds.day_date;

    RETURN jsonb_build_object(
        'total_deposited_amount', v_total_dep_amt,
        'total_deposited_gross', v_total_dep_gross,
        'total_deposited_count', v_total_dep_count,
        'total_withdrawn_amount', v_total_wth_amt,
        'total_withdrawn_gross', v_total_wth_gross,
        'total_withdrawn_count', v_total_wth_count,

        'today_deposits_amount', v_today_dep_amt,
        'today_deposits_count', v_today_dep_count,
        'today_withdrawals_amount', v_today_wth_amt,
        'today_withdrawals_count', v_today_wth_count,
        'today_transactions_count', v_today_tx_count,

        'yesterday_deposits_amount', v_yest_dep_amt,
        'yesterday_deposits_count', v_yest_dep_count,
        'yesterday_withdrawals_amount', v_yest_wth_amt,
        'yesterday_withdrawals_count', v_yest_wth_count,
        'yesterday_transactions_count', v_yest_tx_count,

        'last_7_days_deposits_amount', v_week_dep_amt,
        'last_7_days_withdrawals_amount', v_week_wth_amt,
        'last_7_days_transactions_count', v_week_tx_count,

        'last_30_days_deposits_amount', v_month_dep_amt,
        'last_30_days_withdrawals_amount', v_month_wth_amt,
        'last_30_days_transactions_count', v_month_tx_count,

        'total_transactions_count', v_total_tx_count,
        'available_float_balance', v_avail_bal,
        'locked_payout_balance', v_locked_bal,

        'pending_deposits_count', v_pending_dep_count,
        'pending_deposits_amount', v_pending_dep_amt,
        'pending_withdrawals_count', v_pending_wth_count,
        'pending_withdrawals_amount', v_pending_wth_amt,

        'successful_count', v_successful_count,
        'pending_count', v_pending_count,
        'failed_count', v_failed_count,
        'rejected_count', v_rejected_count,

        'daily_chart', COALESCE(v_daily_chart, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_financial_analytics_rpc(UUID, INT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. UNIFIED SERVER-SIDE PAGINATED TRANSACTIONS RPC (STRICTLY 100 RECORDS/PAGE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_merchant_unified_transactions_rpc(
    p_merchant_id UUID,
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 100,
    p_type TEXT DEFAULT 'ALL',
    p_status TEXT DEFAULT 'ALL',
    p_search TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_is_service_role BOOLEAN := (auth.role() = 'service_role');
    v_merchant RECORD;
    v_page INT := GREATEST(1, COALESCE(p_page, 1));
    v_page_size INT := 100; -- Authoritative strict 100 records per page requirement
    v_offset INT := (v_page - 1) * v_page_size;
    v_total_count INT := 0;
    v_total_pages INT := 1;
    v_transactions JSONB := '[]'::jsonb;
    v_search TEXT := NULLIF(TRIM(p_search), '');
BEGIN
    -- Authorization Check
    IF NOT v_is_service_role THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authentication required';
        END IF;

        SELECT * INTO v_merchant
        FROM public.merchants
        WHERE id = p_merchant_id AND user_id = v_caller_uid;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Merchant account % not found or unauthorized', p_merchant_id;
        END IF;
    END IF;

    -- CTE to unify deposits and payouts with identical schema
    WITH unified_feed AS (
        -- Deposits
        SELECT
            d.id,
            d.merchant_id,
            'DEPOSIT' AS type,
            d.utr_number AS reference_id,
            UPPER(SUBSTRING(d.id::text FROM 1 FOR 8)) AS provider_order_id,
            d.utr_number AS provider_reference_id,
            d.gross_amount AS amount,
            d.deposit_fee AS fee,
            d.net_credited AS net_amount,
            CASE
                WHEN d.status = 'APPROVED' THEN 'SUCCESS'
                WHEN d.status = 'PENDING' THEN 'PENDING'
                ELSE 'REJECTED'
            END AS status,
            'UPI' AS payment_method,
            'Float Top-Up (PayNit / UPI)' AS recipient_or_sender,
            d.created_at,
            d.reviewed_at AS reviewed_or_processed_at,
            d.admin_notes AS notes_or_reason,
            jsonb_build_object(
                'gross_amount', d.gross_amount,
                'deposit_fee', d.deposit_fee,
                'net_credited', d.net_credited,
                'utr_number', d.utr_number
            ) AS raw_data
        FROM public.merchant_deposits d
        WHERE d.merchant_id = p_merchant_id
          AND (p_type IS NULL OR p_type = 'ALL' OR p_type = 'DEPOSIT')

        UNION ALL

        -- Withdrawals / Payouts
        SELECT
            p.id,
            p.merchant_id,
            'WITHDRAWAL' AS type,
            p.order_id AS reference_id,
            p.provider_order_id,
            COALESCE(p.provider_reference_id, p.provider_order_id) AS provider_reference_id,
            p.amount,
            p.fee_amount AS fee,
            p.total_deducted AS net_amount,
            CASE
                WHEN p.status = 'SUCCESS' THEN 'SUCCESS'
                WHEN p.status IN ('PENDING', 'PROCESSING') THEN 'PENDING'
                WHEN p.status = 'FAILED' THEN 'FAILED'
                ELSE 'REJECTED'
            END AS status,
            COALESCE(p.payout_method, 'UPI') AS payment_method,
            COALESCE(p.account_holder_name, p.upi_id, 'Beneficiary') AS recipient_or_sender,
            p.created_at,
            p.processed_at AS reviewed_or_processed_at,
            p.rejection_reason AS notes_or_reason,
            jsonb_build_object(
                'order_id', p.order_id,
                'provider_order_id', p.provider_order_id,
                'amount', p.amount,
                'fee_amount', p.fee_amount,
                'total_deducted', p.total_deducted,
                'payout_method', p.payout_method
            ) AS raw_data
        FROM public.merchant_payouts p
        WHERE p.merchant_id = p_merchant_id
          AND (p_type IS NULL OR p_type = 'ALL' OR p_type = 'WITHDRAWAL')
    ),
    filtered_feed AS (
        SELECT *
        FROM unified_feed
        WHERE
            -- Status filter
            (p_status IS NULL OR p_status = 'ALL' OR status = p_status)
            -- Search query
            AND (
                v_search IS NULL
                OR reference_id ILIKE '%' || v_search || '%'
                OR provider_order_id ILIKE '%' || v_search || '%'
                OR provider_reference_id ILIKE '%' || v_search || '%'
                OR recipient_or_sender ILIKE '%' || v_search || '%'
                OR id::text ILIKE '%' || v_search || '%'
            )
            -- Date range
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            -- Amount range
            AND (p_min_amount IS NULL OR amount >= p_min_amount)
            AND (p_max_amount IS NULL OR amount <= p_max_amount)
    )
    -- 1. Authoritative Total Matching Record Count (Evaluated across the entire filtered feed)
    SELECT COUNT(*) INTO v_total_count FROM filtered_feed;

    -- 2. Accurate Total Pages Calculation
    v_total_pages := GREATEST(1, CEIL(v_total_count::numeric / v_page_size));

    -- 3. Fetch Exactly One Page Slice (Strictly v_page_size rows with stable tie-breaker ordering)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'merchant_id', merchant_id,
                'type', type,
                'reference_id', reference_id,
                'provider_order_id', provider_order_id,
                'provider_reference_id', provider_reference_id,
                'amount', amount,
                'fee', fee,
                'net_amount', net_amount,
                'status', status,
                'payment_method', payment_method,
                'recipient_or_sender', recipient_or_sender,
                'created_at', created_at,
                'reviewed_or_processed_at', reviewed_or_processed_at,
                'notes_or_reason', notes_or_reason,
                'raw_data', raw_data
            )
            ORDER BY created_at DESC, id DESC
        ),
        '[]'::jsonb
    )
    INTO v_transactions
    FROM (
        SELECT *
        FROM filtered_feed
        ORDER BY created_at DESC, id DESC
        LIMIT v_page_size
        OFFSET v_offset
    ) page_slice;

    RETURN jsonb_build_object(
        'transactions', v_transactions,
        'total_count', v_total_count,
        'page', v_page,
        'page_size', v_page_size,
        'total_pages', v_total_pages
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_unified_transactions_rpc(UUID, INT, INT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC) TO authenticated, service_role;
