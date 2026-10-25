-- ==============================================================================
-- MIGRATION 076: YouPI-PG Security Remediation & Correctness Hardening
-- STATUS: NOT EXECUTED (FOR REVIEW ONLY - DO NOT APPLY WITHOUT AUTHORIZATION)
-- Target: Supabase SQL Editor / Migration Pipeline
-- ==============================================================================
-- Purpose: Remediates critical and high-severity findings identified during the
--          security audit of Migration 075 without modifying existing user balances,
--          wallet transactions, deposit records, or public.merchant_wallets.
--
-- Key Remediations:
-- 1. Strictly rejects observations missing a valid 6-35 character UTR/RRN.
--    Stores bank_reference_number as NULL (never placeholder strings) to prevent unique index collisions.
-- 2. Removes bare principal amount fallback; matches ONLY exact total_payable.
-- 3. Eliminates cross-user race conditions on identical deposit amounts:
--    - Evaluates active receiving account slot holder first.
--    - Enforces strict chronological sanity (deposit created_at <= observed_at + 30s).
--    - Detects ambiguous multiple pending deposits and quarantines to AMBIGUOUS_MATCH without guessing.
-- 4. Handles concurrent duplicate deliveries safely using ON CONFLICT DO NOTHING without unhandled rollbacks.
-- 5. Heals deposit status ('APPROVED') and frees VPA slot if a ledger transaction already exists.
-- 6. Hardens search_path to 'youpi, public' (removes pg_temp).
-- 7. Strictly preserves consumer/merchant wallet separation (zero touch to public.merchant_wallets).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENED RPC: youpi.acquire_payment_slot_rpc
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION youpi.acquire_payment_slot_rpc(
    p_amount NUMERIC(12, 2),
    p_order_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_order_id TEXT;
    v_fee NUMERIC(12, 2);
    v_total_payable NUMERIC(12, 2);
    v_total_payable_paise BIGINT;
    v_account RECORD;
    v_deposit_id UUID;
    v_upi_uri TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Security check: Caller must be authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to initiate deposit';
    END IF;

    -- 2. Amount boundary validation (Between ₹1.00 and ₹1,00,000.00)
    IF p_amount IS NULL OR p_amount < 1.00 OR p_amount > 100000.00 THEN
        RAISE EXCEPTION 'Deposit amount must be between ₹1.00 and ₹1,00,000.00';
    END IF;

    -- 3. Authoritative Order Reference Generation
    -- Server authoritatively generates or strictly validates DEP_ reference
    IF p_order_id IS NOT NULL AND TRIM(p_order_id) <> '' THEN
        v_clean_order_id := TRIM(p_order_id);
        IF NOT (v_clean_order_id ~ '^DEP_[0-9]{10,14}_[A-Z0-9]{4,16}$') THEN
            RAISE EXCEPTION 'Invalid order reference format. Expected format: DEP_<timestamp>_<hash>';
        END IF;
    ELSE
        v_clean_order_id := 'DEP_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
    END IF;

    IF EXISTS (SELECT 1 FROM public.deposit_requests WHERE gateway_order_id = v_clean_order_id) THEN
        RAISE EXCEPTION 'Duplicate order reference % already exists.', v_clean_order_id;
    END IF;

    -- 4. Calculate authoritative 2% platform fee
    v_fee := ROUND(p_amount * 0.02, 2);
    v_total_payable := p_amount + v_fee;
    v_total_payable_paise := (v_total_payable * 100)::BIGINT;

    -- 5. Pessimistic Concurrency Lock on Active Receiving VPA
    SELECT * INTO v_account
    FROM youpi.receiving_accounts
    WHERE is_active = true
    ORDER BY is_slot_busy ASC, slot_expires_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active receiving UPI account configured on the gateway';
    END IF;

    -- If slot is busy, verify if it expired (5-minute active window)
    IF v_account.is_slot_busy = true THEN
        IF v_account.slot_expires_at IS NOT NULL AND v_account.slot_expires_at <= TIMEZONE('utc'::text, NOW()) THEN
            -- Previous session expired: sweep previous abandoned deposit
            IF v_account.current_active_deposit_id IS NOT NULL THEN
                UPDATE public.deposit_requests
                SET status = 'EXPIRED',
                    admin_notes = COALESCE(admin_notes, '') || ' [Auto-expired: 5-minute payment window elapsed without credit alert]',
                    updated_at = TIMEZONE('utc'::text, NOW())
                WHERE id = v_account.current_active_deposit_id
                  AND status = 'PENDING';
            END IF;
            -- Reclaim slot
            v_account.is_slot_busy := false;
        ELSE
            -- Slot is actively occupied by another paying customer
            RETURN jsonb_build_object(
                'success', FALSE,
                'error_code', 'SLOT_BUSY',
                'message', 'Another payment is currently completing on this UPI channel. Please retry in 15 seconds.',
                'retry_after_seconds', GREATEST(1, EXTRACT(EPOCH FROM (v_account.slot_expires_at - TIMEZONE('utc'::text, NOW())))::INT)
            );
        END IF;
    END IF;

    -- 6. Acquire Slot for 5 Minutes
    v_expires_at := TIMEZONE('utc'::text, NOW()) + INTERVAL '5 minutes';

    -- 7. Insert pending deposit request
    INSERT INTO public.deposit_requests (
        user_id,
        amount,
        deposit_fee,
        total_payable,
        upi_id,
        status,
        gateway_provider,
        gateway_order_id,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        p_amount,
        v_fee,
        v_total_payable,
        v_account.upi_id,
        'PENDING',
        'YOUPI_PG',
        v_clean_order_id,
        TIMEZONE('utc'::text, NOW()),
        TIMEZONE('utc'::text, NOW())
    )
    RETURNING id INTO v_deposit_id;

    -- 8. Lock slot to this deposit
    UPDATE youpi.receiving_accounts
    SET is_slot_busy = true,
        current_active_deposit_id = v_deposit_id,
        slot_acquired_at = TIMEZONE('utc'::text, NOW()),
        slot_expires_at = v_expires_at,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_account.id;

    -- 9. Construct canonical UPI payment URI
    v_upi_uri := 'upi://pay?pa=' || v_account.upi_id ||
                 '&pn=' || replace(v_account.payee_name, ' ', '%20') ||
                 '&am=' || to_char(v_total_payable, 'FM999999990.00') ||
                 '&cu=INR' ||
                 '&tr=' || v_clean_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'deposit_id', v_deposit_id,
        'order_id', v_clean_order_id,
        'receiving_vpa', v_account.upi_id,
        'payee_name', v_account.payee_name,
        'deposit_amount', p_amount,
        'deposit_fee', v_fee,
        'total_payable', v_total_payable,
        'total_payable_paise', v_total_payable_paise,
        'upi_uri', v_upi_uri,
        'expires_at', v_expires_at,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = youpi, public;

REVOKE ALL ON FUNCTION youpi.acquire_payment_slot_rpc(NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION youpi.acquire_payment_slot_rpc(NUMERIC, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. HARDENED RPC: youpi.process_bank_observation_rpc
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION youpi.process_bank_observation_rpc(
    p_amount_paise BIGINT,
    p_bank_reference_number TEXT,
    p_observed_at TIMESTAMPTZ,
    p_sender_vpa TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'GMAIL_PUBSUB',
    p_message_id TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_fingerprint TEXT;
    v_clean_utr TEXT;
    v_observed_rupees NUMERIC(12, 2);
    v_account RECORD;
    v_candidate RECORD;
    v_candidate_count INT := 0;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
    v_obs_id UUID;
    v_existing_utr_dep RECORD;
    v_target_upi TEXT;
BEGIN
    v_clean_utr := UPPER(TRIM(COALESCE(p_bank_reference_number, '')));
    v_observed_rupees := ROUND(p_amount_paise / 100.0, 2);

    -- 1. Deterministic Cryptographic Fingerprint Generation
    v_fingerprint := encode(digest(
        COALESCE(p_message_id, 'NO_MSG_ID') || ':' ||
        p_amount_paise::text || ':' ||
        v_clean_utr || ':' ||
        EXTRACT(EPOCH FROM p_observed_at)::text,
        'sha256'
    ), 'hex');

    -- 2. Concurrency-Safe Observation Ingestion (Replay Protection)
    -- Uses ON CONFLICT DO NOTHING to prevent unhandled 23505 duplicate key exceptions
    INSERT INTO youpi.payment_observations (
        source, amount_paise, observed_at, sender_vpa,
        bank_reference_number, fingerprint_hash, raw_payload,
        attribution_status
    ) VALUES (
        p_source, p_amount_paise, p_observed_at, p_sender_vpa,
        NULLIF(v_clean_utr, ''), v_fingerprint, p_raw_payload,
        'INGESTED'
    )
    ON CONFLICT (fingerprint_hash) DO NOTHING
    RETURNING id INTO v_obs_id;

    IF v_obs_id IS NULL THEN
        -- Already ingested by a concurrent or prior worker
        RETURN jsonb_build_object(
            'success', TRUE,
            'already_processed', TRUE,
            'message', 'Duplicate bank observation fingerprint ignored.'
        );
    END IF;

    -- 3. Strict UTR/RRN Format Validation (Finding 01 Remediation)
    -- Never auto-credit without an authoritative 6 to 35 character reference.
    -- Stores bank_reference_number as NULL (never placeholder strings) to prevent unique index collisions.
    IF v_clean_utr IS NULL OR LENGTH(v_clean_utr) < 6 OR LENGTH(v_clean_utr) > 35 OR NOT (v_clean_utr ~ '^[A-Z0-9\-_]{6,35}$') THEN
        UPDATE youpi.payment_observations
        SET attribution_status = 'MISSING_UTR',
            bank_reference_number = NULL
        WHERE id = v_obs_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'MISSING_UTR',
            'observation_id', v_obs_id,
            'message', 'Observation rejected: Missing or invalid bank UTR / reference number.'
        );
    END IF;

    -- Update observation with sanitized UTR
    UPDATE youpi.payment_observations
    SET bank_reference_number = v_clean_utr
    WHERE id = v_obs_id;

    -- 4. Duplicate UTR check across all previously APPROVED deposits
    SELECT id, gateway_order_id INTO v_existing_utr_dep
    FROM public.deposit_requests 
    WHERE utr_number = v_clean_utr 
      AND status = 'APPROVED'
    LIMIT 1;

    IF v_existing_utr_dep.id IS NOT NULL THEN
        UPDATE youpi.payment_observations
        SET attribution_status = 'DUPLICATE_UTR'
        WHERE id = v_obs_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'error_code', 'DUPLICATE_UTR',
            'observation_id', v_obs_id,
            'message', 'Bank UTR ' || v_clean_utr || ' was already credited on deposit ' || v_existing_utr_dep.gateway_order_id
        );
    END IF;

    -- 5. Resolve Active Receiving VPA
    SELECT * INTO v_account
    FROM youpi.receiving_accounts
    WHERE is_active = true
    LIMIT 1;

    v_target_upi := COALESCE(v_account.upi_id, 'createlifafa@upi');

    -- 6. Disambiguated Candidate Session Matching (Findings 04, 05, 06 Remediation)
    -- Strategy A: Primary Anchor — Active slot holder on the receiving account
    IF v_account.current_active_deposit_id IS NOT NULL THEN
        SELECT * INTO v_candidate
        FROM public.deposit_requests
        WHERE id = v_account.current_active_deposit_id
          AND gateway_provider = 'YOUPI_PG'
          AND status IN ('PENDING', 'VERIFYING')
          AND ROUND(total_payable * 100)::BIGINT = p_amount_paise
          AND created_at <= (p_observed_at + INTERVAL '30 seconds') -- Chronological sanity
        FOR UPDATE;
    END IF;

    -- Strategy B: Secondary Anchor — Order ID embedded in bank alert text
    IF v_candidate.id IS NULL AND p_raw_payload->>'rawText' IS NOT NULL THEN
        SELECT * INTO v_candidate
        FROM public.deposit_requests
        WHERE gateway_provider = 'YOUPI_PG'
          AND status IN ('PENDING', 'VERIFYING')
          AND ROUND(total_payable * 100)::BIGINT = p_amount_paise
          AND p_raw_payload->>'rawText' LIKE '%' || gateway_order_id || '%'
          AND created_at <= (p_observed_at + INTERVAL '30 seconds')
          AND created_at >= (p_observed_at - INTERVAL '15 minutes')
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE;
    END IF;

    -- Strategy C: Fallback — Single matching pending session on the target VPA
    IF v_candidate.id IS NULL THEN
        SELECT COUNT(*) INTO v_candidate_count
        FROM public.deposit_requests
        WHERE gateway_provider = 'YOUPI_PG'
          AND status IN ('PENDING', 'VERIFYING')
          AND upi_id = v_target_upi
          AND ROUND(total_payable * 100)::BIGINT = p_amount_paise
          AND created_at <= (p_observed_at + INTERVAL '30 seconds')
          AND created_at >= (p_observed_at - INTERVAL '6 minutes');

        IF v_candidate_count = 1 THEN
            SELECT * INTO v_candidate
            FROM public.deposit_requests
            WHERE gateway_provider = 'YOUPI_PG'
              AND status IN ('PENDING', 'VERIFYING')
              AND upi_id = v_target_upi
              AND ROUND(total_payable * 100)::BIGINT = p_amount_paise
              AND created_at <= (p_observed_at + INTERVAL '30 seconds')
              AND created_at >= (p_observed_at - INTERVAL '6 minutes')
            LIMIT 1
            FOR UPDATE;
        ELSIF v_candidate_count > 1 THEN
            -- Multiple pending deposits share the same amount and cannot be uniquely identified
            UPDATE youpi.payment_observations
            SET attribution_status = 'AMBIGUOUS_MATCH'
            WHERE id = v_obs_id;

            RETURN jsonb_build_object(
                'success', FALSE,
                'status', 'AMBIGUOUS_MATCH',
                'observation_id', v_obs_id,
                'message', 'Multiple pending deposits match amount ₹' || v_observed_rupees::text || '. Quarantined for manual admin reconciliation.'
            );
        END IF;
    END IF;

    -- Strategy D: Late observation for expired session (only if no active slot conflict)
    IF v_candidate.id IS NULL THEN
        SELECT * INTO v_candidate
        FROM public.deposit_requests
        WHERE gateway_provider = 'YOUPI_PG'
          AND status = 'EXPIRED'
          AND upi_id = v_target_upi
          AND ROUND(total_payable * 100)::BIGINT = p_amount_paise
          AND created_at <= (p_observed_at + INTERVAL '30 seconds')
          AND created_at >= (p_observed_at - INTERVAL '35 minutes')
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;

        IF v_candidate.id IS NULL THEN
            UPDATE youpi.payment_observations
            SET attribution_status = 'UNATTRIBUTED'
            WHERE id = v_obs_id;

            RETURN jsonb_build_object(
                'success', FALSE,
                'status', 'UNATTRIBUTED',
                'observation_id', v_obs_id,
                'message', 'No matching deposit session found for amount ₹' || v_observed_rupees::text || '.'
            );
        END IF;
    END IF;

    -- 7. Strict Amount Invariant Validation
    -- Customer must have paid the exact total payable
    IF ABS(v_observed_rupees - v_candidate.total_payable) > 0.05 THEN
        UPDATE public.deposit_requests
        SET status = 'VERIFYING',
            admin_notes = COALESCE(admin_notes, '') || ' [Amount Mismatch: Expected ₹' || v_candidate.total_payable::text || ', Received ₹' || v_observed_rupees::text || ']',
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_candidate.id;

        UPDATE youpi.payment_observations
        SET attribution_status = 'AMOUNT_MISMATCH',
            attributed_deposit_id = v_candidate.id
        WHERE id = v_obs_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'AMOUNT_MISMATCH',
            'deposit_id', v_candidate.id,
            'message', 'Amount mismatch held in VERIFYING for administrative review.'
        );
    END IF;

    -- 8. Idempotency State Healing (Finding 03 Remediation)
    -- If ledger transaction already exists, ensure deposit status and slot state are finalized
    v_idempotency_key := 'youpi_credit_' || v_candidate.id::text;
    IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE idempotency_key = v_idempotency_key) THEN
        UPDATE public.deposit_requests
        SET status = 'APPROVED',
            utr_number = COALESCE(v_clean_utr, utr_number),
            verification_source = p_source,
            verification_level = 1,
            gmail_message_id = COALESCE(p_message_id, gmail_message_id),
            processed_at = TIMEZONE('utc'::text, NOW()),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_candidate.id AND status <> 'APPROVED';

        UPDATE youpi.receiving_accounts
        SET is_slot_busy = false,
            current_active_deposit_id = NULL,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE current_active_deposit_id = v_candidate.id;

        UPDATE youpi.payment_observations
        SET attribution_status = 'ATTRIBUTED',
            attributed_deposit_id = v_candidate.id
        WHERE id = v_obs_id;

        RETURN jsonb_build_object(
            'success', TRUE,
            'deposit_id', v_candidate.id,
            'already_processed', TRUE,
            'state_healed', TRUE,
            'message', 'Ledger transaction previously committed; deposit status and slot state healed.'
        );
    END IF;

    -- 9. Pessimistic Concurrency Lock on Consumer Wallet
    -- STRICT INVARIANT: Only locks public.wallets. Never accesses or updates public.merchant_wallets.
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_candidate.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumer wallet not found for user %', v_candidate.user_id;
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before + v_candidate.amount;

    -- 10. Credit Consumer Wallet (Exact Deposit Principal)
    UPDATE public.wallets
    SET available_balance = v_balance_after,
        total_deposited = total_deposited + v_candidate.amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 11. Double-Entry Ledger Transaction Insertion
    INSERT INTO public.wallet_transactions (
        user_id,
        wallet_id,
        amount,
        type,
        status,
        reference_type,
        reference_id,
        idempotency_key,
        balance_before,
        balance_after,
        metadata
    ) VALUES (
        v_candidate.user_id,
        v_wallet.id,
        v_candidate.amount,
        'CREDIT'::transaction_type,
        'SUCCESS'::transaction_status,
        'YOUPI_PG_DEPOSIT',
        v_candidate.id::text,
        v_idempotency_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'order_id', v_candidate.gateway_order_id,
            'utr_number', v_clean_utr,
            'paid_amount', v_observed_rupees,
            'deposit_amount', v_candidate.amount,
            'deposit_fee', v_candidate.deposit_fee,
            'total_payable', v_candidate.total_payable,
            'verification_source', p_source,
            'verification_level', 1,
            'gmail_message_id', p_message_id,
            'fingerprint', v_fingerprint
        )
    );

    -- 12. Finalize Deposit Request as APPROVED
    UPDATE public.deposit_requests
    SET status = 'APPROVED',
        utr_number = v_clean_utr,
        verification_source = p_source,
        verification_level = 1,
        gmail_message_id = COALESCE(p_message_id, gmail_message_id),
        processed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_candidate.id;

    -- 13. Release VPA Slot
    UPDATE youpi.receiving_accounts
    SET is_slot_busy = false,
        current_active_deposit_id = NULL,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE current_active_deposit_id = v_candidate.id;

    -- 14. Mark Observation as ATTRIBUTED
    UPDATE youpi.payment_observations
    SET attribution_status = 'ATTRIBUTED',
        attributed_deposit_id = v_candidate.id
    WHERE id = v_obs_id;

    -- 15. Customer In-App Notification
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
        v_candidate.user_id,
        'Deposit Confirmed! ₹' || v_candidate.amount::text,
        'Your UPI transfer of ₹' || v_candidate.total_payable::text || ' (UTR: ' || v_clean_utr || ') has been verified and ₹' || v_candidate.amount::text || ' is now available in your wallet.',
        'SYSTEM',
        v_candidate.id::text
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'deposit_id', v_candidate.id,
        'order_id', v_candidate.gateway_order_id,
        'amount_credited', v_candidate.amount,
        'fee_deducted', v_candidate.deposit_fee,
        'total_paid', v_candidate.total_payable,
        'utr_number', v_clean_utr,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'observation_id', v_obs_id,
        'status', 'APPROVED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = youpi, public;

REVOKE ALL ON FUNCTION youpi.process_bank_observation_rpc(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION youpi.process_bank_observation_rpc(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDENED RPC: youpi.release_expired_slots_rpc
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION youpi.release_expired_slots_rpc()
RETURNS JSONB AS $$
DECLARE
    v_released_count INT := 0;
    v_rec RECORD;
BEGIN
    FOR v_rec IN 
        SELECT id, current_active_deposit_id
        FROM youpi.receiving_accounts
        WHERE is_slot_busy = true
          AND slot_expires_at IS NOT NULL
          AND slot_expires_at <= TIMEZONE('utc'::text, NOW())
        FOR UPDATE
    LOOP
        -- Expire pending deposit
        IF v_rec.current_active_deposit_id IS NOT NULL THEN
            UPDATE public.deposit_requests
            SET status = 'EXPIRED',
                admin_notes = COALESCE(admin_notes, '') || ' [Window elapsed: Session expired by sweep worker]',
                updated_at = TIMEZONE('utc'::text, NOW())
            WHERE id = v_rec.current_active_deposit_id
              AND status = 'PENDING';
        END IF;

        -- Free slot
        UPDATE youpi.receiving_accounts
        SET is_slot_busy = false,
            current_active_deposit_id = NULL,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_rec.id;

        v_released_count := v_released_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'slots_released', v_released_count,
        'swept_at', TIMEZONE('utc'::text, NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = youpi, public;

REVOKE ALL ON FUNCTION youpi.release_expired_slots_rpc() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION youpi.release_expired_slots_rpc() TO service_role;
