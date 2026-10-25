-- ==============================================================================
-- MIGRATION 075: YouPI-PG Serverless Architecture (PostgreSQL Schema & RPCs)
-- STATUS: NOT EXECUTED (FOR REVIEW ONLY - DO NOT APPLY WITHOUT AUTHORIZATION)
-- Target: Supabase SQL Editor / Migration Pipeline
-- ==============================================================================
-- 1. Creates dedicated, isolated schema: "youpi" (Zero collision with "public").
-- 2. Creates youpi.receiving_accounts (Serverless VPA management & slot locking).
-- 3. Creates youpi.payment_observations (Cryptographic bank email alert deduplication).
-- 4. Creates youpi.gmail_sync_state (Singleton tracking Gmail historyId and watch lease).
-- 5. Implements atomic RPC: youpi.acquire_payment_slot_rpc (Serverless single-slot queue).
-- 6. Implements atomic RPC: youpi.process_bank_observation_rpc (Deterministic settlement & wallet credit).
-- 7. Implements maintenance RPC: youpi.release_expired_slots_rpc (Lazy/Cron session expiry).
-- 8. Enforces double-entry ledger invariants into public.wallet_transactions (balance_before, balance_after).
-- 9. Strict isolation: NEVER accesses or modifies public.merchant_wallets.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ISOLATED "youpi" SCHEMA CREATION
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS youpi;

-- ------------------------------------------------------------------------------
-- 2. youpi.receiving_accounts (VPA Management & Single-Slot Concurrency)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youpi.receiving_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upi_id VARCHAR(255) NOT NULL,
    payee_name VARCHAR(255) NOT NULL DEFAULT 'Createlifafa',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_slot_busy BOOLEAN NOT NULL DEFAULT false,
    current_active_deposit_id UUID REFERENCES public.deposit_requests(id) ON DELETE SET NULL,
    slot_acquired_at TIMESTAMPTZ,
    slot_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Unique index to prevent duplicate active VPA registration
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_vpa_upi 
    ON youpi.receiving_accounts (upi_id) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_receiving_accounts_slot_status 
    ON youpi.receiving_accounts (is_active, is_slot_busy, slot_expires_at);

-- Seed platform receiving UPI account if empty
INSERT INTO youpi.receiving_accounts (upi_id, payee_name, is_active, is_slot_busy)
VALUES ('createlifafa@upi', 'Createlifafa', true, false)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. youpi.payment_observations (Bank Email Alerts & Cryptographic Deduplication)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youpi.payment_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_account_id UUID REFERENCES youpi.receiving_accounts(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'GMAIL_PUBSUB',
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    amount NUMERIC(12, 2) GENERATED ALWAYS AS (ROUND(amount_paise / 100.0, 2)) STORED,
    observed_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    sender_vpa VARCHAR(255),
    bank_reference_number VARCHAR(255), -- 12-digit UTR or Bank RRN
    fingerprint_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256(messageId:amountPaise:utr)
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attribution_status VARCHAR(50) NOT NULL DEFAULT 'UNATTRIBUTED',
    -- Allowed statuses: 'UNATTRIBUTED', 'ATTRIBUTED', 'SUSPICIOUS', 'DUPLICATE', 'LATE_OBSERVATION'
    attributed_deposit_id UUID REFERENCES public.deposit_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_obs_match 
    ON youpi.payment_observations (amount_paise, attribution_status);

CREATE INDEX IF NOT EXISTS idx_obs_bank_ref 
    ON youpi.payment_observations (bank_reference_number) 
    WHERE bank_reference_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_unique_attributed_bank_ref 
    ON youpi.payment_observations (bank_reference_number) 
    WHERE bank_reference_number IS NOT NULL AND attributed_deposit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obs_fingerprint 
    ON youpi.payment_observations (fingerprint_hash);

-- ------------------------------------------------------------------------------
-- 4. youpi.gmail_sync_state (Singleton Lease & History Synchronization)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youpi.gmail_sync_state (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    history_id VARCHAR(64),
    watch_expiration TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    last_status VARCHAR(50) DEFAULT 'INITIALIZED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

INSERT INTO youpi.gmail_sync_state (id, history_id, last_status)
VALUES (1, '0', 'INITIALIZED')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. RPC 1: youpi.acquire_payment_slot_rpc
-- Description: Serverless Single-Slot FIFO Queue Acquisition & Order Reservation.
-- Inputs:
--   p_amount: Deposit principal (₹1.00 to ₹1,00,000.00).
--   p_order_id: Merchant reference (e.g. DEP_...).
-- Locking Strategy:
--   Pessimistic lock (SELECT ... FOR UPDATE) on active youpi.receiving_accounts.
-- Failure Behavior:
--   Throws exception if all slots are actively locked by non-expired sessions.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION youpi.acquire_payment_slot_rpc(
    p_amount NUMERIC(12, 2),
    p_order_id TEXT
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

    -- 2. Amount boundary validation
    IF p_amount IS NULL OR p_amount < 1.00 OR p_amount > 100000.00 THEN
        RAISE EXCEPTION 'Deposit amount must be between ₹1.00 and ₹1,00,000.00';
    END IF;

    -- 3. Sanitize order reference
    v_clean_order_id := TRIM(p_order_id);
    IF v_clean_order_id IS NULL OR LENGTH(v_clean_order_id) < 5 OR LENGTH(v_clean_order_id) > 64 THEN
        RAISE EXCEPTION 'Invalid order reference format';
    END IF;

    IF EXISTS (SELECT 1 FROM public.deposit_requests WHERE gateway_order_id = v_clean_order_id) THEN
        RAISE EXCEPTION 'Duplicate order reference % already exists.', v_clean_order_id;
    END IF;

    -- 4. Calculate authoritative 2% platform fee
    -- Fee = Amount * 0.02, Total = Amount + Fee. Wallet credit = Amount.
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
            -- Reclaim the slot
            v_account.is_slot_busy := false;
        ELSE
            -- Slot is actively occupied by another customer paying
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = youpi, public, pg_temp;

REVOKE ALL ON FUNCTION youpi.acquire_payment_slot_rpc(NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION youpi.acquire_payment_slot_rpc(NUMERIC, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC 2: youpi.process_bank_observation_rpc
-- Description: Deterministic Serverless Observation Settlement & Double-Entry Wallet Crediting.
-- Inputs:
--   p_amount_paise: Exact observed credit amount in integer paise (e.g. 10200 for ₹102.00).
--   p_bank_reference_number: 12-digit UTR / RRN extracted from bank alert.
--   p_observed_at: Bank alert timestamp.
--   p_sender_vpa: Optional sender UPI ID.
--   p_source: Observation source ('GMAIL_PUBSUB', 'GMAIL_POLL').
--   p_message_id: Gmail unique message ID.
--   p_raw_payload: Full sanitized email headers and snippet.
-- Locking Strategy:
--   Pessimistic lock on public.deposit_requests candidate, then pessimistic lock on public.wallets.
-- Failure Behavior:
--   Rejects duplicate fingerprints, checks exact amounts, flags suspicious mismatches in VERIFYING.
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
    v_candidate RECORD;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
    v_obs_id UUID;
    v_account_id UUID;
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

    -- 2. Observation Replay Protection Check
    IF EXISTS (SELECT 1 FROM youpi.payment_observations WHERE fingerprint_hash = v_fingerprint) THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'already_processed', TRUE,
            'message', 'Duplicate bank observation fingerprint ignored.'
        );
    END IF;

    -- 3. Duplicate UTR check across all previously APPROVED deposits
    IF v_clean_utr <> '' THEN
        IF EXISTS (
            SELECT 1 FROM public.deposit_requests 
            WHERE utr_number = v_clean_utr 
              AND status = 'APPROVED'
        ) THEN
            -- Record as suspicious duplicate alert
            INSERT INTO youpi.payment_observations (
                source, amount_paise, observed_at, sender_vpa,
                bank_reference_number, fingerprint_hash, raw_payload,
                attribution_status
            ) VALUES (
                p_source, p_amount_paise, p_observed_at, p_sender_vpa,
                v_clean_utr, v_fingerprint, p_raw_payload,
                'DUPLICATE_UTR'
            );

            RETURN jsonb_build_object(
                'success', FALSE,
                'error_code', 'DUPLICATE_UTR',
                'message', 'Bank UTR ' || v_clean_utr || ' was already credited on a previous deposit.'
            );
        END IF;
    END IF;

    -- 4. Candidate Session Match (Single-Slot FIFO Invariant)
    -- Searches for a pending deposit request on YOUPI_PG expecting this EXACT amount (Principal + 2% fee)
    SELECT * INTO v_candidate
    FROM public.deposit_requests
    WHERE gateway_provider = 'YOUPI_PG'
      AND status IN ('PENDING', 'VERIFYING')
      AND (ROUND(total_payable * 100)::BIGINT = p_amount_paise OR ROUND(amount * 100)::BIGINT = p_amount_paise)
      AND created_at >= (p_observed_at - INTERVAL '15 minutes')
      AND created_at <= (p_observed_at + INTERVAL '5 minutes')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    -- 5. Handle Unattributed / Ambiguous Alerts
    IF v_candidate.id IS NULL THEN
        -- Check if late observation for an expired deposit
        SELECT * INTO v_candidate
        FROM public.deposit_requests
        WHERE gateway_provider = 'YOUPI_PG'
          AND status = 'EXPIRED'
          AND (ROUND(total_payable * 100)::BIGINT = p_amount_paise)
          AND created_at >= (p_observed_at - INTERVAL '35 minutes')
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;

        IF v_candidate.id IS NULL THEN
            -- Quarantined as UNATTRIBUTED
            INSERT INTO youpi.payment_observations (
                source, amount_paise, observed_at, sender_vpa,
                bank_reference_number, fingerprint_hash, raw_payload,
                attribution_status
            ) VALUES (
                p_source, p_amount_paise, p_observed_at, p_sender_vpa,
                v_clean_utr, v_fingerprint, p_raw_payload,
                'UNATTRIBUTED'
            ) RETURNING id INTO v_obs_id;

            RETURN jsonb_build_object(
                'success', FALSE,
                'status', 'UNATTRIBUTED',
                'observation_id', v_obs_id,
                'message', 'No matching active deposit session found for amount ₹' || v_observed_rupees::text || '. Stored for admin reconciliation.'
            );
        END IF;
    END IF;

    -- 6. Strict Amount Invariant Validation
    -- Customer must have paid the exact total payable
    IF ABS(v_observed_rupees - v_candidate.total_payable) > 0.05 THEN
        -- Amount mismatch: quarantine candidate in VERIFYING
        UPDATE public.deposit_requests
        SET status = 'VERIFYING',
            admin_notes = COALESCE(admin_notes, '') || ' [Amount Mismatch: Expected ₹' || v_candidate.total_payable::text || ', Received ₹' || v_observed_rupees::text || ']',
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_candidate.id;

        INSERT INTO youpi.payment_observations (
            source, amount_paise, observed_at, sender_vpa,
            bank_reference_number, fingerprint_hash, raw_payload,
            attribution_status, attributed_deposit_id
        ) VALUES (
            p_source, p_amount_paise, p_observed_at, p_sender_vpa,
            v_clean_utr, v_fingerprint, p_raw_payload,
            'SUSPICIOUS', v_candidate.id
        );

        RETURN jsonb_build_object(
            'success', FALSE,
            'status', 'AMOUNT_MISMATCH',
            'deposit_id', v_candidate.id,
            'message', 'Amount mismatch held in VERIFYING for administrative review.'
        );
    END IF;

    -- 7. Deterministic Ledger Idempotency Key
    v_idempotency_key := 'youpi_credit_' || v_candidate.id::text;
    IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE idempotency_key = v_idempotency_key) THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'deposit_id', v_candidate.id,
            'already_processed', TRUE,
            'message', 'Ledger transaction already exists. Duplicate credit prevented.'
        );
    END IF;

    -- 8. Pessimistic Concurrency Lock on Customer Consumer Wallet
    -- CRITICAL INVARIANT: Only locks public.wallets. Never touches public.merchant_wallets.
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_candidate.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumer wallet not found for user %', v_candidate.user_id;
    END IF;

    v_balance_before := v_wallet.available_balance;
    v_balance_after := v_balance_before + v_candidate.amount;

    -- 9. Credit Consumer Wallet (Exact Deposit Principal)
    UPDATE public.wallets
    SET available_balance = v_balance_after,
        total_deposited = total_deposited + v_candidate.amount,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 10. Double-Entry Ledger Transaction Insertion
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

    -- 11. Finalize Deposit Request as APPROVED
    UPDATE public.deposit_requests
    SET status = 'APPROVED',
        utr_number = COALESCE(NULLIF(v_clean_utr, ''), utr_number),
        verification_source = p_source,
        verification_level = 1,
        gmail_message_id = COALESCE(p_message_id, gmail_message_id),
        processed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_candidate.id;

    -- 12. Release VPA Slot
    UPDATE youpi.receiving_accounts
    SET is_slot_busy = false,
        current_active_deposit_id = NULL,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE current_active_deposit_id = v_candidate.id;

    -- 13. Record Observation as ATTRIBUTED
    INSERT INTO youpi.payment_observations (
        source, amount_paise, observed_at, sender_vpa,
        bank_reference_number, fingerprint_hash, raw_payload,
        attribution_status, attributed_deposit_id
    ) VALUES (
        p_source, p_amount_paise, p_observed_at, p_sender_vpa,
        v_clean_utr, v_fingerprint, p_raw_payload,
        'ATTRIBUTED', v_candidate.id
    ) RETURNING id INTO v_obs_id;

    -- 14. Customer In-App Notification
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
        v_candidate.user_id,
        'Deposit Confirmed! ₹' || v_candidate.amount::text,
        'Your UPI transfer of ₹' || v_candidate.total_payable::text || ' (UTR: ' || COALESCE(NULLIF(v_clean_utr, ''), 'Verified') || ') has been verified and ₹' || v_candidate.amount::text || ' is now available in your wallet.',
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = youpi, public, pg_temp;

REVOKE ALL ON FUNCTION youpi.process_bank_observation_rpc(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION youpi.process_bank_observation_rpc(BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC 3: youpi.release_expired_slots_rpc
-- Description: Sweeps abandoned 5-minute sessions and frees VPA slots.
-- Can be invoked every 1 minute via Supabase pg_cron or Cloudflare Worker Cron.
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = youpi, public, pg_temp;

REVOKE ALL ON FUNCTION youpi.release_expired_slots_rpc() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION youpi.release_expired_slots_rpc() TO service_role;

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) FOR youpi SCHEMA
-- ------------------------------------------------------------------------------
ALTER TABLE youpi.receiving_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE youpi.payment_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE youpi.gmail_sync_state ENABLE ROW LEVEL SECURITY;

-- Anonymous and general authenticated users cannot directly read or mutate youpi tables
CREATE POLICY "Deny direct public access to receiving_accounts" 
    ON youpi.receiving_accounts FOR ALL 
    TO PUBLIC 
    USING (false);

CREATE POLICY "Deny direct public access to payment_observations" 
    ON youpi.payment_observations FOR ALL 
    TO PUBLIC 
    USING (false);

CREATE POLICY "Deny direct public access to gmail_sync_state" 
    ON youpi.gmail_sync_state FOR ALL 
    TO PUBLIC 
    USING (false);

-- Service-role full access for Edge Functions
CREATE POLICY "Allow service_role full access on receiving_accounts" 
    ON youpi.receiving_accounts FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow service_role full access on payment_observations" 
    ON youpi.payment_observations FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow service_role full access on gmail_sync_state" 
    ON youpi.gmail_sync_state FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);
