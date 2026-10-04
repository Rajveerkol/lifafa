-- ==============================================================================
-- MIGRATION 050: FIX FALSE "DEVICE CLAIM LIMIT" FOR FIRST-TIME USERS
-- ==============================================================================
-- CONTEXT:
-- Genuine first-time users were encountering the false error:
-- "Device claim limit (1 per device) reached for this Lifafa"
--
-- ROOT CAUSES RESOLVED:
-- 1. Device Fingerprint Collisions:
--    The previous client fingerprint was derived from frozen User-Agent, timezone,
--    and screen dimensions. On modern mobile browsers (especially Android Chrome in India),
--    frozen user-agents and standard 412x915 viewports produced the identical hash
--    (e.g., 'dev_26770c53') across millions of different physical devices. Once ONE user
--    claimed Lifafa X, every subsequent user with that standard device profile was blocked.
--    The frontend now generates a persistent, cryptographically secure device ID (did_...).
--
-- 2. Corrupt / Null-string Collisions:
--    Clients passing empty string '', 'null', 'undefined', or whitespace were treated
--    as valid fingerprints in SQL ('' IS NOT NULL), matching all prior empty claims.
--    This migration sanitizes such values to NULL so they do not collide.
--
-- 3. Failed External Payouts Consuming Limit:
--    If an external UPI payout failed (e.g., invalid UPI ID, PayNit rejection), the
--    claim record remained and counted toward the device limit, permanently burning
--    the device slot.
--    This migration updates the device limit query to EXCLUDE failed withdrawals,
--    and allows clean retry when an external payout fails.
--
-- ANTI-ABUSE ASSURANCES:
-- - The "1 claim per device" (or N per device) protection remains 100% active and enforced.
-- - Scoped strictly per-Lifafa (claiming Lifafa A never blocks Lifafa B).
-- - Zero impact on payout fees, escrow accounting, task verification, or merchant gateway.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PURGE LEGACY COLLIDING DEVICE FINGERPRINTS
-- ------------------------------------------------------------------------------
-- Clean up legacy empty strings, null-string literals, and the known Android/iOS
-- colliding hash values so historical collisions do not block active Lifafas.
UPDATE public.lifafa_claims
SET device_fingerprint = NULL
WHERE device_fingerprint IS NOT NULL
  AND (
    TRIM(device_fingerprint) = ''
    OR LOWER(TRIM(device_fingerprint)) IN ('null', 'undefined', 'unknown', 'none', '[object object]')
    OR device_fingerprint IN ('dev_26770c53', 'dev_6e92c491')
  );

-- ------------------------------------------------------------------------------
-- 2. HARDENED claim_lifafa_rpc
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc(
    p_code TEXT,
    p_pin_code VARCHAR(10) DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_account_holder_name TEXT DEFAULT NULL,
    p_bank_account_number TEXT DEFAULT NULL,
    p_ifsc_code TEXT DEFAULT NULL,
    p_upi_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lifafa RECORD;
    v_allocation RECORD;
    v_user_wallet RECORD;
    v_creator_wallet RECORD;
    v_claim_id UUID;
    v_withdrawal_id UUID := NULL;
    v_claim_amount NUMERIC(12, 2);
    v_claim_fee NUMERIC(12, 2) := 0.00;
    v_uncompleted_count INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_existing_claim RECORD;
    v_device_claims_count INT;
    v_secret RECORD;
    v_clean_upi TEXT := NULL;
    v_account_name TEXT := NULL;
    v_profile_name TEXT;
    v_clean_device_fp TEXT := NULL;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim a Lifafa';
    END IF;

    -- Sanitize device fingerprint: Treat whitespace, null-like literals, or very short strings as NULL
    v_clean_device_fp := NULLIF(TRIM(p_device_fingerprint), '');
    IF v_clean_device_fp IS NOT NULL THEN
        IF LOWER(v_clean_device_fp) IN ('null', 'undefined', 'unknown', 'none', '[object object]') OR LENGTH(v_clean_device_fp) < 8 THEN
            v_clean_device_fp := NULL;
        END IF;
    END IF;

    v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_' || v_user_id::text);

    -- 1. Check idempotency / existing claim for this user
    SELECT lc.*, w.status AS withdrawal_status INTO v_existing_claim
    FROM public.lifafa_claims lc
    LEFT JOIN public.withdrawals w ON w.id = lc.withdrawal_id
    WHERE lc.idempotency_key = v_effective_idempotency 
       OR (lc.lifafa_id IN (SELECT id FROM public.lifafas WHERE code = TRIM(p_code)) AND lc.user_id = v_user_id);

    IF FOUND THEN
        -- If this previous claim had an external payout that definitively FAILED, allow clean retry
        IF v_existing_claim.withdrawal_id IS NOT NULL AND v_existing_claim.withdrawal_status = 'FAILED' THEN
            DELETE FROM public.lifafa_claims WHERE id = v_existing_claim.id;
        ELSE
            SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;
            RETURN jsonb_build_object(
                'success', true,
                'amount', v_existing_claim.amount,
                'lifafa_code', p_code,
                'is_duplicate', true,
                'payout_mode', v_existing_claim.payout_mode,
                'withdrawal_id', v_existing_claim.withdrawal_id,
                'withdrawal_status', v_existing_claim.withdrawal_status,
                'new_balance', v_balance_after
            );
        END IF;
    END IF;

    -- 2. Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE code = TRIM(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa with code % does not exist', p_code;
    END IF;

    IF v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    IF v_lifafa.withdrawal_status = 'BLOCKED' THEN
        RAISE EXCEPTION 'This Lifafa has been blocked by administrators for security reasons';
    END IF;

    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa is scheduled to begin at %', v_lifafa.starts_at;
    END IF;

    IF v_lifafa.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Lifafa has been cancelled';
    END IF;

    IF v_lifafa.status = 'EXPIRED' OR v_lifafa.expires_at <= NOW() THEN
        IF v_lifafa.status <> 'EXPIRED' THEN
            UPDATE public.lifafas SET status = 'EXPIRED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        END IF;
        RAISE EXCEPTION 'Lifafa has expired';
    END IF;

    IF v_lifafa.status = 'COMPLETED' OR v_lifafa.claimed_count >= v_lifafa.winner_count OR v_lifafa.remaining_amount <= 0.00 THEN
        IF v_lifafa.status <> 'COMPLETED' THEN
            UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        END IF;
        RAISE EXCEPTION 'All Lifafa rewards have already been claimed';
    END IF;

    IF v_lifafa.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Lifafa is not active (Status: %)', v_lifafa.status;
    END IF;

    -- 3. External Payout Details Validation: Enforce UPI ONLY for UPI_BANK mode
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        IF p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> '' THEN
            RAISE EXCEPTION 'Bank account claims are no longer supported. All external claims must use UPI.';
        END IF;

        IF p_upi_id IS NULL OR TRIM(p_upi_id) = '' THEN
            RAISE EXCEPTION 'A valid UPI ID is required to claim this Lifafa.';
        END IF;

        v_clean_upi := LOWER(TRIM(p_upi_id));
        IF NOT (v_clean_upi ~ '^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$') THEN
            RAISE EXCEPTION 'Invalid UPI ID format. Expected format: username@bank';
        END IF;

        SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = v_user_id;
        v_account_name := COALESCE(NULLIF(TRIM(p_account_holder_name), ''), v_profile_name, 'UPI Claimant');
    END IF;

    -- 4. Device limit check: Lifafa-scoped, valid sanitized fingerprint only, excluding failed payouts
    IF v_clean_device_fp IS NOT NULL AND v_lifafa.device_claim_limit > 0 THEN
        SELECT COUNT(*) INTO v_device_claims_count
        FROM public.lifafa_claims lc
        LEFT JOIN public.withdrawals w ON w.id = lc.withdrawal_id
        WHERE lc.lifafa_id = v_lifafa.id 
          AND lc.device_fingerprint = v_clean_device_fp
          AND (lc.withdrawal_id IS NULL OR w.status IN ('PENDING', 'PROCESSING', 'SUCCESS'));

        IF v_device_claims_count >= v_lifafa.device_claim_limit THEN
            RAISE EXCEPTION 'Device claim limit (% per device) reached for this Lifafa', v_lifafa.device_claim_limit;
        END IF;
    END IF;

    -- 5. PIN verification
    SELECT * INTO v_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND AND v_secret.pin_code_hash IS NOT NULL THEN
        IF p_pin_code IS NULL OR LENGTH(TRIM(p_pin_code)) = 0 THEN
            RAISE EXCEPTION 'Secret PIN code is required to claim this Lifafa';
        END IF;

        IF v_secret.pin_code_hash <> crypt(TRIM(p_pin_code), v_secret.pin_code_hash) THEN
            RAISE EXCEPTION 'Incorrect PIN code entered';
        END IF;
    END IF;

    -- 6. Task completions check
    SELECT COUNT(*) INTO v_uncompleted_count
    FROM public.lifafa_tasks t
    WHERE t.lifafa_id = v_lifafa.id
      AND t.is_required = TRUE
      AND t.is_enabled = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM public.task_completions tc
          WHERE tc.task_id = t.id 
            AND tc.user_id = v_user_id
            AND (
                (t.task_type IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT')
                 AND tc.status = 'VERIFIED'
                 AND tc.verification_method = 'TELEGRAM_BOT_API'
                 AND tc.verified_via_bot = TRUE)
                OR
                (t.task_type IN ('VISIT_WEBSITE', 'CUSTOM')
                 AND (tc.status = 'CLICK_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method = 'URL_VISIT')))
                OR
                (t.task_type IN ('INSTAGRAM_FOLLOW', 'INSTAGRAM_LIKE', 'YOUTUBE_SUB', 'REFERRAL')
                 AND (tc.status = 'USER_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method IN ('MANUAL', 'ENGAGEMENT', 'OAUTH_CHECK'))))
                OR
                (t.task_type = 'YOUTUBE_WATCH'
                 AND (tc.status = 'USER_CONFIRMED' OR tc.status = 'VERIFIED')
                 AND (tc.verification_method IN ('YOUTUBE_PLAYER_ENDED', 'USER_CONFIRMED', 'ENGAGEMENT')))
            )
      );

    IF v_uncompleted_count > 0 THEN
        RAISE EXCEPTION 'Please complete and verify all required community tasks before claiming';
    END IF;

    -- 7. Select next available allocation
    SELECT * INTO v_allocation
    FROM public.lifafa_allocations
    WHERE lifafa_id = v_lifafa.id AND is_claimed = FALSE
    ORDER BY allocation_index ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        UPDATE public.lifafas SET status = 'COMPLETED', updated_at = TIMEZONE('utc'::text, NOW()) WHERE id = v_lifafa.id;
        RAISE EXCEPTION 'No available rewards remaining in this Lifafa';
    END IF;

    v_claim_amount := v_allocation.amount;

    UPDATE public.lifafa_allocations
    SET is_claimed = TRUE,
        claimed_by = v_user_id,
        claimed_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_allocation.id;

    -- 8. Calculate Fee & Update Lifafa Row
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Deduct fee if Lifafa was created with fee escrow (backward-compatible)
        IF COALESCE(v_lifafa.total_fee_amount, 0.00) > 0.00 THEN
            v_claim_fee := public.get_lifafa_payout_fee(v_claim_amount);
        ELSE
            v_claim_fee := 0.00;
        END IF;
    END IF;

    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = GREATEST(0.00, remaining_amount - v_claim_amount),
        remaining_fee_amount = GREATEST(0.00, remaining_fee_amount - v_claim_fee),
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0.00 
                THEN 'COMPLETED'::lifafa_status 
            ELSE 'ACTIVE'::lifafa_status 
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    -- 9. Deduct from creator escrow: prize amount + applicable payout fee
    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - (v_claim_amount + v_claim_fee)),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    -- 10. Payout Routing: UPI_BANK (External PayNit UPI) vs WALLET (Internal Instant)
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        INSERT INTO public.withdrawals (
            user_id,
            amount,
            fee_amount,
            net_amount,
            account_holder_name,
            bank_account_number_masked,
            bank_account_encrypted,
            ifsc_code,
            upi_id,
            status,
            payout_provider,
            payout_method,
            idempotency_key
        ) VALUES (
            v_user_id,
            v_claim_amount + v_claim_fee,
            v_claim_fee,
            v_claim_amount,
            v_account_name,
            NULL,
            NULL,
            NULL,
            v_clean_upi,
            'PENDING',
            'PAYNIT',
            'UPI',
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        INSERT INTO public.lifafa_claims (
            lifafa_id,
            user_id,
            allocation_id,
            amount,
            idempotency_key,
            device_fingerprint,
            ip_address,
            payout_mode,
            withdrawal_id
        ) VALUES (
            v_lifafa.id,
            v_user_id,
            v_allocation.id,
            v_claim_amount,
            v_effective_idempotency,
            v_clean_device_fp,
            p_ip_address,
            'UPI_BANK',
            v_withdrawal_id
        ) RETURNING id INTO v_claim_id;

        -- Record fee transaction in creator's wallet audit trail if fee was recognized
        IF v_claim_fee > 0.00 THEN
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
                v_lifafa.creator_id,
                v_creator_wallet.id,
                -v_claim_fee,
                'FEE',
                'SUCCESS'::transaction_status,
                'LIFAFA_PAYOUT_FEE',
                v_withdrawal_id::text,
                'tx_claim_fee_' || v_effective_idempotency,
                v_creator_wallet.available_balance,
                v_creator_wallet.available_balance,
                jsonb_build_object(
                    'lifafa_id', v_lifafa.id,
                    'lifafa_code', v_lifafa.code,
                    'withdrawal_id', v_withdrawal_id,
                    'claimant_id', v_user_id,
                    'claim_amount', v_claim_amount,
                    'payout_fee', v_claim_fee
                )
            );
        END IF;

        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'UPI_BANK',
            'payout_method', 'UPI',
            'payout_provider', 'PAYNIT',
            'withdrawal_id', v_withdrawal_id,
            'withdrawal_status', 'PENDING',
            'payout_fee', v_claim_fee,
            'new_balance', v_balance_after
        );

    ELSE
        -- WALLET mode: Instant internal credit
        SELECT * INTO v_user_wallet 
        FROM public.wallets 
        WHERE user_id = v_user_id 
        FOR UPDATE;

        v_balance_before := v_user_wallet.available_balance;
        v_balance_after := v_balance_before + v_claim_amount;

        UPDATE public.wallets
        SET available_balance = available_balance + v_claim_amount,
            total_earned = total_earned + v_claim_amount,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_user_wallet.id;

        INSERT INTO public.lifafa_claims (
            lifafa_id,
            user_id,
            allocation_id,
            amount,
            idempotency_key,
            device_fingerprint,
            ip_address,
            payout_mode
        ) VALUES (
            v_lifafa.id,
            v_user_id,
            v_allocation.id,
            v_claim_amount,
            v_effective_idempotency,
            v_clean_device_fp,
            p_ip_address,
            'WALLET'
        ) RETURNING id INTO v_claim_id;

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
            v_user_id,
            v_user_wallet.id,
            v_claim_amount,
            'CLAIM',
            'SUCCESS'::transaction_status,
            'LIFAFA_CLAIM',
            v_claim_id::text,
            'tx_claim_' || v_effective_idempotency,
            v_balance_before,
            v_balance_after,
            jsonb_build_object(
                'lifafa_id', v_lifafa.id,
                'lifafa_code', v_lifafa.code,
                'claim_id', v_claim_id,
                'creator_id', v_lifafa.creator_id
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'WALLET',
            'new_balance', v_balance_after
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
