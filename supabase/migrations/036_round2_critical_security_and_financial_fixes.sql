-- ============================================================================
-- Migration 036: Round 2 Critical Financial and Security Bug Fixes
--
-- Fixes:
-- 1. BUG-CRIT-01: Unauthenticated Lifafa Force-Cancel / Refund Bypass
--    - Target: public.refund_expired_or_cancelled_lifafa_rpc
--    - Closes PostgreSQL three-valued boolean logic bypass where auth.uid() IS NULL
--      evaluated NULL <> creator_id to NULL, bypassing authorization.
--    - Strictly requires auth.uid() IS NOT NULL unless called by service_role.
--    - Revokes execute from anon and PUBLIC.
--
-- 2. BUG-CRIT-02: Creator Can Claim Own UPI_BANK / WALLET Lifafa
--    - Target: public.claim_lifafa_rpc
--    - Authoritatively rejects claims where auth.uid() = lifafa.creator_id.
--    - Prevents creator self-claim, self-allocation, and unauthorized payouts.
--
-- 3. BUG-CRIT-03: Duel Reward / Ticket Farming -> Unlimited Withdrawable Money
--    - Target: public.finalize_duel_match_rpc & public.join_matchmaking_rpc
--    - Enforces that AI/NPC/test matches cannot generate positive net game tickets.
--    - In AI/NPC matches, returns at most the 1 entry ticket (net gain: 0 tickets).
--    - Restricts p_allow_test_opponent to administrative callers.
--    - Conserves total ticket economy in 1v1 human PVP matches.
--
-- 4. BUG-CRIT-04: BLOCKED Lifafa Can Still Trigger UPI_BANK Payout
--    - Target: public.claim_lifafa_rpc
--    - Authoritatively rejects claims for Lifafas with withdrawal_status = 'BLOCKED'.
--    - Explicitly validates status model ('ACTIVE' required; 'CANCELLED', 'EXPIRED',
--      'COMPLETED' rejected).
--
-- 5. BUG-CRIT-05: UPI-Only Claim / Balance-Laundering / Refund Abuse
--    - Target: public.claim_lifafa_rpc & public.admin_update_withdrawal_rpc
--    - Enforces valid bank account number + IFSC regex for UPI_BANK claims;
--      rejects UPI-only claims prior to payout creation.
--    - In admin_update_withdrawal_rpc, when a direct UPI_BANK claim payout fails
--      or reverses, the refund is returned to the CREATOR's wallet, NOT the claimant's
--      wallet, eliminating free money creation and balance laundering.
-- ============================================================================

-- Index for high-performance claim-to-withdrawal lookups during refund handling
CREATE INDEX IF NOT EXISTS idx_lifafa_claims_withdrawal_id ON public.lifafa_claims(withdrawal_id);

-- ----------------------------------------------------------------------------
-- 1. BUG-CRIT-01: Patch public.refund_expired_or_cancelled_lifafa_rpc
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(
    p_lifafa_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_service_role BOOLEAN := (
        COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
        OR auth.role() = 'service_role'
        OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );
    v_lifafa RECORD;
    v_creator_wallet RECORD;
    v_refund_amount NUMERIC(12, 2);
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
BEGIN
    -- Explicitly reject anonymous callers
    IF NOT v_is_service_role THEN
        IF v_caller_id IS NULL THEN
            RAISE EXCEPTION 'Authentication required to refund this Lifafa';
        END IF;
    END IF;

    -- Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    -- Authorize: service_role (expiry sweep), Lifafa creator, or Administrator
    IF NOT v_is_service_role THEN
        IF v_caller_id <> v_lifafa.creator_id AND NOT public.has_admin_role('ADMIN') THEN
            RAISE EXCEPTION 'Unauthorized to refund this Lifafa';
        END IF;
    END IF;

    -- Status eligibility check
    IF v_lifafa.status NOT IN ('ACTIVE', 'EXPIRED') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lifafa already completed, refunded, or cancelled');
    END IF;

    v_refund_amount := v_lifafa.remaining_amount;

    IF v_refund_amount <= 0 THEN
        UPDATE public.lifafas
        SET status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_lifafa.id;
        RETURN jsonb_build_object('success', true, 'refunded_amount', 0);
    END IF;

    SELECT * INTO v_creator_wallet
    FROM public.wallets
    WHERE user_id = v_lifafa.creator_id
    FOR UPDATE;

    v_balance_before := v_creator_wallet.available_balance;
    v_balance_after := v_balance_before + v_refund_amount;

    UPDATE public.wallets
    SET available_balance = available_balance + v_refund_amount,
        reserved_balance = GREATEST(0, reserved_balance - v_refund_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_creator_wallet.id;

    UPDATE public.lifafas
    SET remaining_amount = 0.00,
        status = CASE WHEN expires_at <= NOW() THEN 'EXPIRED'::lifafa_status ELSE 'CANCELLED'::lifafa_status END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    v_idempotency_key := 'refund_' || v_lifafa.id::text;

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
        v_refund_amount,
        'REFUND',
        'SUCCESS',
        'LIFAFA_REFUND',
        v_lifafa.id::text,
        v_idempotency_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object('lifafa_code', v_lifafa.code)
    ) ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'refunded_amount', v_refund_amount, 'new_balance', v_balance_after);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. BUG-CRIT-02, BUG-CRIT-04, BUG-CRIT-05: Patch public.claim_lifafa_rpc
-- ----------------------------------------------------------------------------
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
    v_uncompleted_count INT;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_effective_idempotency TEXT;
    v_existing_claim RECORD;
    v_secret RECORD;
    v_device_claims_count INT;
    v_masked_acc TEXT;
    v_encrypted_acc TEXT := NULL;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim a Lifafa';
    END IF;

    v_effective_idempotency := COALESCE(p_idempotency_key, 'claim_' || TRIM(p_code) || '_' || v_user_id::text);

    -- 1. Check idempotency
    SELECT * INTO v_existing_claim
    FROM public.lifafa_claims
    WHERE idempotency_key = v_effective_idempotency 
       OR (lifafa_id IN (SELECT id FROM public.lifafas WHERE code = TRIM(p_code)) AND user_id = v_user_id);

    IF FOUND THEN
        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;
        RETURN jsonb_build_object(
            'success', true,
            'amount', v_existing_claim.amount,
            'lifafa_code', p_code,
            'is_duplicate', true,
            'payout_mode', v_existing_claim.payout_mode,
            'withdrawal_id', v_existing_claim.withdrawal_id,
            'new_balance', v_balance_after
        );
    END IF;

    -- 2. Lock Lifafa row
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE code = TRIM(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa with code % does not exist', p_code;
    END IF;

    -- [BUG-CRIT-02 FIX] Prevent Lifafa creator from claiming their own Lifafa
    IF v_lifafa.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Creators cannot claim their own Lifafa';
    END IF;

    -- [BUG-CRIT-04 FIX] Authoritatively reject claims on BLOCKED Lifafas
    IF v_lifafa.withdrawal_status = 'BLOCKED' THEN
        RAISE EXCEPTION 'This Lifafa has been blocked by platform administration';
    END IF;

    IF v_lifafa.starts_at IS NOT NULL AND v_lifafa.starts_at > NOW() THEN
        RAISE EXCEPTION 'This Lifafa has not started yet. Starts at: %', v_lifafa.starts_at;
    END IF;

    -- [BUG-CRIT-04 FIX] Explicit status validation
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

    -- [BUG-CRIT-05 FIX] Strict bank credential validation; reject UPI-only for direct bank payout
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        IF p_account_holder_name IS NULL OR LENGTH(TRIM(p_account_holder_name)) < 2 THEN
            RAISE EXCEPTION 'Account holder name as per bank records is required';
        END IF;

        IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 6 THEN
            RAISE EXCEPTION 'A valid Bank Account Number is required for direct bank payout';
        END IF;

        IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
            RAISE EXCEPTION 'A valid 11-character IFSC code is required for bank payout (e.g. SBIN0001234)';
        END IF;

        IF p_upi_id IS NOT NULL AND LENGTH(TRIM(p_upi_id)) > 0 AND NOT (TRIM(p_upi_id) ~ '^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$') THEN
            RAISE EXCEPTION 'Invalid UPI ID format (e.g. name@okhdfcbank)';
        END IF;
    END IF;

    IF p_device_fingerprint IS NOT NULL AND v_lifafa.device_claim_limit > 0 THEN
        SELECT COUNT(*) INTO v_device_claims_count
        FROM public.lifafa_claims
        WHERE lifafa_id = v_lifafa.id AND device_fingerprint = p_device_fingerprint;

        IF v_device_claims_count >= v_lifafa.device_claim_limit THEN
            RAISE EXCEPTION 'Device claim limit (% per device) reached for this Lifafa', v_lifafa.device_claim_limit;
        END IF;
    END IF;

    SELECT * INTO v_secret FROM public.lifafa_secrets WHERE lifafa_id = v_lifafa.id;
    IF FOUND THEN
        IF p_pin_code IS NULL OR LENGTH(TRIM(p_pin_code)) = 0 THEN
            RAISE EXCEPTION 'Secret PIN code is required to claim this Lifafa';
        END IF;

        IF v_secret.pin_code_hash <> crypt(TRIM(p_pin_code), v_secret.pin_code_hash) THEN
            RAISE EXCEPTION 'Incorrect PIN code entered';
        END IF;
    END IF;

    -- MULTI-TIER COMMUNITY TASK VERIFICATION (INCLUDES YOUTUBE_WATCH)
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
                -- Tier 1: Telegram tasks strictly require true server verification via Bot API
                (t.task_type IN ('TELEGRAM_JOIN', 'TELEGRAM_BOT')
                 AND tc.status = 'VERIFIED'
                 AND tc.verification_method = 'TELEGRAM_BOT_API'
                 AND tc.verified_via_bot = TRUE)
                OR
                -- Tier 2: Visit website / custom link tasks require CLICK_CONFIRMED (or historical URL_VISIT)
                (t.task_type IN ('VISIT_WEBSITE', 'CUSTOM')
                 AND (tc.status = 'CLICK_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method = 'URL_VISIT')))
                OR
                -- Tier 3: Social follow / sub tasks require USER_CONFIRMED (or historical attestation)
                (t.task_type IN ('INSTAGRAM_FOLLOW', 'INSTAGRAM_LIKE', 'YOUTUBE_SUB', 'REFERRAL')
                 AND (tc.status = 'USER_CONFIRMED' OR (tc.status = 'VERIFIED' AND tc.verification_method IN ('MANUAL', 'ENGAGEMENT', 'OAUTH_CHECK'))))
                OR
                -- Tier 4: Watch YouTube Video tasks require player completion confirmation
                (t.task_type = 'YOUTUBE_WATCH'
                 AND (tc.status = 'USER_CONFIRMED' OR tc.status = 'VERIFIED')
                 AND (tc.verification_method IN ('YOUTUBE_PLAYER_ENDED', 'USER_CONFIRMED', 'ENGAGEMENT')))
            )
      );

    IF v_uncompleted_count > 0 THEN
        RAISE EXCEPTION 'Please complete and verify all required community tasks before claiming';
    END IF;

    -- 3. Select next available allocation
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

    UPDATE public.lifafas
    SET claimed_count = claimed_count + 1,
        remaining_amount = GREATEST(0.00, remaining_amount - v_claim_amount),
        status = CASE 
            WHEN (claimed_count + 1) >= winner_count OR (remaining_amount - v_claim_amount) <= 0.00 
                THEN 'COMPLETED'::lifafa_status 
            ELSE 'ACTIVE'::lifafa_status 
        END,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    SELECT * INTO v_creator_wallet 
    FROM public.wallets 
    WHERE user_id = v_lifafa.creator_id 
    FOR UPDATE;

    UPDATE public.wallets
    SET reserved_balance = GREATEST(0.00, reserved_balance - v_claim_amount),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_lifafa.creator_id;

    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        -- Bank account is guaranteed to be validated above
        v_masked_acc := 'XXXX-XXXX-' || RIGHT(TRIM(p_bank_account_number), 4);
        v_encrypted_acc := public.encrypt_bank_account(p_bank_account_number);

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
            idempotency_key
        ) VALUES (
            v_user_id,
            v_claim_amount,
            0.00,
            v_claim_amount,
            TRIM(p_account_holder_name),
            v_masked_acc,
            NULL,
            UPPER(TRIM(p_ifsc_code)),
            NULLIF(LOWER(TRIM(p_upi_id)), ''),
            'PENDING',
            'PAYRUPEE',
            'payout_claim_' || v_effective_idempotency
        ) RETURNING id INTO v_withdrawal_id;

        IF v_encrypted_acc IS NOT NULL THEN
            INSERT INTO public.withdrawal_bank_credentials (withdrawal_id, encrypted_account_number)
            VALUES (v_withdrawal_id, v_encrypted_acc);
        END IF;

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
            p_device_fingerprint,
            p_ip_address,
            'UPI_BANK',
            v_withdrawal_id
        ) RETURNING id INTO v_claim_id;

        SELECT available_balance INTO v_balance_after FROM public.wallets WHERE user_id = v_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'amount', v_claim_amount,
            'lifafa_code', v_lifafa.code,
            'payout_mode', 'UPI_BANK',
            'withdrawal_id', v_withdrawal_id,
            'withdrawal_status', 'PENDING',
            'new_balance', v_balance_after
        );

    ELSE
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
            p_device_fingerprint,
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
            v_claim_id,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_temp;

REVOKE ALL ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lifafa_rpc(TEXT, VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. BUG-CRIT-05: Patch public.admin_update_withdrawal_rpc
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_rpc(
    p_withdrawal_id UUID,
    p_new_status withdrawal_status,
    p_payout_reference_id TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_is_service_role BOOLEAN := COALESCE((auth.jwt() ->> 'role'), '') = 'service_role';
    v_withdrawal RECORD;
    v_wallet RECORD;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_alloc RECORD;
    v_claim RECORD;
BEGIN
    -- Authorization: either service_role (Edge Function) or Administrator/Super Admin
    IF NOT v_is_service_role AND NOT public.has_admin_role('ADMIN') THEN
        RAISE EXCEPTION 'Only Administrators or automated service role can update payout status';
    END IF;

    SELECT * INTO v_withdrawal
    FROM public.withdrawals
    WHERE id = p_withdrawal_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal record not found';
    END IF;

    -- Terminal status prevention
    IF v_withdrawal.status IN ('SUCCESS', 'FAILED', 'REVERSED') THEN
        RAISE EXCEPTION 'Withdrawal is already in terminal status (%) and cannot be modified again', v_withdrawal.status;
    END IF;

    -- Update withdrawal record
    UPDATE public.withdrawals
    SET status = p_new_status,
        payout_reference_id = COALESCE(p_payout_reference_id, payout_reference_id),
        rejection_reason = COALESCE(p_rejection_reason, rejection_reason),
        processed_at = TIMEZONE('utc'::text, NOW()),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_withdrawal_id;

    -- [BUG-CRIT-05 FIX] Correct destination for FAILED / REVERSED payouts
    IF p_new_status IN ('FAILED', 'REVERSED') THEN
        -- Check if this withdrawal originated from a direct UPI_BANK Lifafa claim
        SELECT c.*, l.creator_id, l.code AS lifafa_code
        INTO v_claim
        FROM public.lifafa_claims c
        JOIN public.lifafas l ON l.id = c.lifafa_id
        WHERE c.withdrawal_id = p_withdrawal_id
        LIMIT 1;

        IF FOUND THEN
            -- Direct UPI_BANK claim payout was funded by creator escrow, NOT claimant wallet!
            -- Refunding claimant would allow free money creation / balance-laundering.
            -- Safe & correct destination: refund the CREATOR's available wallet balance:
            SELECT * INTO v_wallet
            FROM public.wallets
            WHERE user_id = v_claim.creator_id
            FOR UPDATE;

            IF FOUND THEN
                v_balance_before := v_wallet.available_balance;
                v_balance_after := v_balance_before + v_withdrawal.amount;

                UPDATE public.wallets
                SET available_balance = available_balance + v_withdrawal.amount,
                    updated_at = TIMEZONE('utc'::text, NOW())
                WHERE id = v_wallet.id;

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
                    v_claim.creator_id,
                    v_wallet.id,
                    v_withdrawal.amount,
                    'REFUND',
                    'SUCCESS'::transaction_status,
                    'CLAIM_PAYOUT_REVERSAL',
                    p_withdrawal_id::text,
                    'reversal_creator_' || p_withdrawal_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
                    v_balance_before,
                    v_balance_after,
                    jsonb_build_object(
                        'reason', p_rejection_reason,
                        'claim_id', v_claim.id,
                        'lifafa_id', v_claim.lifafa_id,
                        'lifafa_code', v_claim.lifafa_code,
                        'refunded_amount', v_withdrawal.amount,
                        'previous_status', v_withdrawal.status
                    )
                );
            END IF;

        ELSE
            -- Normal user withdrawal funded from user's own wallet balance!
            SELECT * INTO v_wallet
            FROM public.wallets
            WHERE user_id = v_withdrawal.user_id
            FOR UPDATE;

            IF FOUND THEN
                v_balance_before := v_wallet.available_balance;
                v_balance_after := v_balance_before + v_withdrawal.amount;

                -- Refund full gross deduction (amount = payout + fee)
                -- Decrement total_withdrawn by net payout
                UPDATE public.wallets
                SET available_balance = available_balance + v_withdrawal.amount,
                    total_withdrawn = GREATEST(0, total_withdrawn - v_withdrawal.net_amount),
                    updated_at = TIMEZONE('utc'::text, NOW())
                WHERE id = v_wallet.id;

                -- Restore withdrawn_amount on allocated claims
                FOR v_alloc IN (
                    SELECT claim_id, allocated_amount
                    FROM public.withdrawal_source_allocations
                    WHERE withdrawal_id = p_withdrawal_id
                      AND claim_id IS NOT NULL
                ) LOOP
                    UPDATE public.lifafa_claims
                    SET withdrawn_amount = GREATEST(0.00, withdrawn_amount - v_alloc.allocated_amount)
                    WHERE id = v_alloc.claim_id;
                END LOOP;

                -- Create double-entry reversal transaction
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
                    v_withdrawal.user_id,
                    v_wallet.id,
                    v_withdrawal.amount,
                    'WITHDRAWAL_REVERSAL',
                    'SUCCESS'::transaction_status,
                    'WITHDRAWAL_REVERSAL',
                    p_withdrawal_id::text,
                    'reversal_' || p_withdrawal_id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
                    v_balance_before,
                    v_balance_after,
                    jsonb_build_object(
                        'reason', p_rejection_reason,
                        'previous_status', v_withdrawal.status,
                        'refunded_gross_amount', v_withdrawal.amount,
                        'refunded_fee', v_withdrawal.fee_amount,
                        'refunded_net_payout', v_withdrawal.net_amount
                    )
                );
            END IF;
        END IF;
    END IF;

    -- Audit Log (only logged if an admin user initiated the update)
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO public.admin_audit_logs (
            admin_id,
            action,
            target_type,
            target_id,
            details
        ) VALUES (
            v_admin_id,
            'WITHDRAWAL_' || p_new_status::text,
            'WITHDRAWAL',
            p_withdrawal_id::text,
            jsonb_build_object(
                'old_status', v_withdrawal.status,
                'new_status', p_new_status,
                'payout_reference_id', p_payout_reference_id,
                'rejection_reason', p_rejection_reason
            )
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_update_withdrawal_rpc(UUID, withdrawal_status, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_rpc(UUID, withdrawal_status, TEXT, TEXT) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. BUG-CRIT-03: Patch public.finalize_duel_match_rpc
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_duel_match_rpc(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_p1 RECORD;
    v_p2 RECORD;
    v_winner_id UUID := NULL;
    v_p1_result TEXT;
    v_p2_result TEXT;
    v_p1_rounds INTEGER;
    v_p2_rounds INTEGER;
    v_winner_tickets INTEGER;
    v_is_real_pvp BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock match
    SELECT * INTO v_match
    FROM public.duel_matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match % not found', p_match_id;
    END IF;

    -- Idempotent return for already completed match
    IF v_match.status = 'COMPLETED' THEN
        SELECT * INTO v_p1 FROM public.duel_players WHERE match_id = p_match_id AND player_slot = 'PLAYER_1';
        SELECT * INTO v_p2 FROM public.duel_players WHERE match_id = p_match_id AND player_slot = 'PLAYER_2';
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'winner_id', v_match.winner_id,
            'p1_score', v_p1.score,
            'p2_score', v_p2.score,
            'p1_result', v_p1.result,
            'p2_result', v_p2.result
        );
    END IF;

    -- Verify caller is participant
    IF NOT public.check_is_duel_participant(p_match_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller % is not a participant in match %', v_user_id, p_match_id;
    END IF;

    SELECT * INTO v_p1 FROM public.duel_players WHERE match_id = p_match_id AND player_slot = 'PLAYER_1';
    SELECT * INTO v_p2 FROM public.duel_players WHERE match_id = p_match_id AND player_slot = 'PLAYER_2';

    IF v_p1.id IS NULL OR v_p2.id IS NULL THEN
        RAISE EXCEPTION 'Match cannot be finalized: player slots are incomplete';
    END IF;

    -- Verify Player 1 completed all 5 rounds
    SELECT COUNT(*) INTO v_p1_rounds
    FROM public.duel_rounds
    WHERE match_id = p_match_id AND player_id = v_p1.player_id;

    IF v_p1_rounds < 5 THEN
        RAISE EXCEPTION 'Match cannot be finalized: Player 1 has only completed % of 5 rounds', v_p1_rounds;
    END IF;

    -- Player 2 round verification: STRICTLY for real 2-player PVP matches where Player 2 is human
    IF v_match.match_type = 'PVP' AND NOT COALESCE(v_match.is_test_opponent, FALSE) AND v_p2.player_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_p2_rounds
        FROM public.duel_rounds
        WHERE match_id = p_match_id AND player_id = v_p2.player_id;

        IF v_p2_rounds < 5 THEN
            RAISE EXCEPTION 'Match cannot be finalized: Player 2 has only completed % of 5 rounds', v_p2_rounds;
        END IF;
    END IF;

    -- Authoritative score comparison
    IF v_p1.score > v_p2.score THEN
        v_winner_id := v_p1.player_id;
        v_p1_result := 'WON';
        v_p2_result := 'LOST';
    ELSIF v_p2.score > v_p1.score THEN
        v_winner_id := v_p2.player_id; -- NULL for AI/NPC bot
        v_p1_result := 'LOST';
        v_p2_result := 'WON';
    ELSE
        v_winner_id := NULL;
        v_p1_result := 'DRAW';
        v_p2_result := 'DRAW';
    END IF;

    UPDATE public.duel_players SET result = v_p1_result, status = 'FINISHED', updated_at = NOW() WHERE id = v_p1.id;
    UPDATE public.duel_players SET result = v_p2_result, status = 'FINISHED', updated_at = NOW() WHERE id = v_p2.id;

    UPDATE public.duel_matches
    SET status = 'COMPLETED',
        winner_id = v_winner_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_match_id;

    -- Update stats for human players only
    IF v_p1.player_id IS NOT NULL THEN
        UPDATE public.duel_stats
        SET total_matches = total_matches + 1,
            wins = wins + CASE WHEN v_p1_result = 'WON' THEN 1 ELSE 0 END,
            losses = losses + CASE WHEN v_p1_result = 'LOST' THEN 1 ELSE 0 END,
            draws = draws + CASE WHEN v_p1_result = 'DRAW' THEN 1 ELSE 0 END,
            win_streak = CASE WHEN v_p1_result = 'WON' THEN win_streak + 1 ELSE 0 END,
            highest_score = GREATEST(highest_score, v_p1.score),
            updated_at = NOW()
        WHERE user_id = v_p1.player_id;
    END IF;

    IF v_p2.player_id IS NOT NULL THEN
        UPDATE public.duel_stats
        SET total_matches = total_matches + 1,
            wins = wins + CASE WHEN v_p2_result = 'WON' THEN 1 ELSE 0 END,
            losses = losses + CASE WHEN v_p2_result = 'LOST' THEN 1 ELSE 0 END,
            draws = draws + CASE WHEN v_p2_result = 'DRAW' THEN 1 ELSE 0 END,
            win_streak = CASE WHEN v_p2_result = 'WON' THEN win_streak + 1 ELSE 0 END,
            highest_score = GREATEST(highest_score, v_p2.score),
            updated_at = NOW()
        WHERE user_id = v_p2.player_id;
    END IF;

    -- [BUG-CRIT-03 FIX] Duel Ticket Economics & Anti-Farming Rule
    -- Real PVP: Two real distinct humans with 1 ticket stake each (ticket pool = 2).
    -- Winner gets 2 tickets (the combined 2-ticket stake).
    -- Draw returns 1 ticket to each human.
    -- AI / NPC / Test match: Bot staked ZERO tickets. NO economic tickets may be minted from thin air!
    -- Winning against AI returns at most the human player's 1 entry ticket (NET PROFIT: ZERO).
    v_is_real_pvp := (
        v_match.match_type = 'PVP'
        AND NOT COALESCE(v_match.is_test_opponent, FALSE)
        AND v_p1.player_id IS NOT NULL
        AND v_p2.player_id IS NOT NULL
        AND NOT COALESCE(v_p1.is_test_opponent, FALSE)
        AND NOT COALESCE(v_p2.is_test_opponent, FALSE)
        AND v_p1.player_id <> v_p2.player_id
    );

    IF v_is_real_pvp THEN
        IF v_winner_id IS NOT NULL THEN
            UPDATE public.game_tickets
            SET balance = balance + 2, updated_at = NOW()
            WHERE user_id = v_winner_id
            RETURNING balance INTO v_winner_tickets;

            INSERT INTO public.game_ticket_transactions (
                user_id, amount, balance_after, transaction_type, reference_id, description
            ) VALUES (
                v_winner_id, 2, v_winner_tickets, 'MATCH_REWARD', p_match_id::text, '1v1 Duel Victory Prize (2 Tickets)'
            ) ON CONFLICT (user_id, transaction_type, reference_id) DO NOTHING;
        ELSE
            -- Draw in real PVP: Return the 1 staked ticket to both human players
            UPDATE public.game_tickets
            SET balance = balance + 1, updated_at = NOW()
            WHERE user_id = v_p1.player_id
            RETURNING balance INTO v_winner_tickets;

            INSERT INTO public.game_ticket_transactions (
                user_id, amount, balance_after, transaction_type, reference_id, description
            ) VALUES (
                v_p1.player_id, 1, v_winner_tickets, 'MATCH_REFUND', p_match_id::text, '1v1 Duel Draw Entry Refund (1 Ticket)'
            ) ON CONFLICT (user_id, transaction_type, reference_id) DO NOTHING;

            UPDATE public.game_tickets
            SET balance = balance + 1, updated_at = NOW()
            WHERE user_id = v_p2.player_id
            RETURNING balance INTO v_winner_tickets;

            INSERT INTO public.game_ticket_transactions (
                user_id, amount, balance_after, transaction_type, reference_id, description
            ) VALUES (
                v_p2.player_id, 1, v_winner_tickets, 'MATCH_REFUND', p_match_id::text, '1v1 Duel Draw Entry Refund (1 Ticket)'
            ) ON CONFLICT (user_id, transaction_type, reference_id) DO NOTHING;
        END IF;

    ELSE
        -- AI / NPC / Test match: Return at most 1 ticket (entry ticket return) on win or draw.
        -- Net profit from AI/NPC is strictly 0 tickets. Cannot farm tickets or withdrawable money!
        IF v_p1.player_id IS NOT NULL AND (v_p1_result = 'WON' OR v_p1_result = 'DRAW') THEN
            UPDATE public.game_tickets
            SET balance = balance + 1, updated_at = NOW()
            WHERE user_id = v_p1.player_id
            RETURNING balance INTO v_winner_tickets;

            INSERT INTO public.game_ticket_transactions (
                user_id, amount, balance_after, transaction_type, reference_id, description
            ) VALUES (
                v_p1.player_id, 1, v_winner_tickets, 'MATCH_REFUND', p_match_id::text, '1v1 NPC Match Entry Ticket Return (Net Gain: 0)'
            ) ON CONFLICT (user_id, transaction_type, reference_id) DO NOTHING;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'winner_id', v_winner_id,
        'p1_score', v_p1.score,
        'p2_score', v_p2.score,
        'p1_result', v_p1_result,
        'p2_result', v_p2_result
    );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_duel_match_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_duel_match_rpc(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. BUG-CRIT-03: Patch public.join_matchmaking_rpc
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_matchmaking_rpc(
    p_display_name TEXT,
    p_avatar_url TEXT DEFAULT NULL,
    p_allow_test_opponent BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_new_match_id UUID;
    v_clean_name TEXT;
    v_existing_active_match RECORD;
    v_ticket_balance INTEGER;
    v_player1_id UUID;
    v_round_questions JSONB;
    v_is_admin BOOLEAN := FALSE;
    v_effective_allow_test BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to join Duel matchmaking';
    END IF;

    v_clean_name := COALESCE(TRIM(p_display_name), 'Challenger');
    IF LENGTH(v_clean_name) = 0 THEN
        v_clean_name := 'Challenger';
    END IF;

    -- Only admins or service role may explicitly request test AI opponent
    v_is_admin := public.has_admin_role('ADMIN') OR COALESCE((auth.jwt() ->> 'role'), '') = 'service_role';
    v_effective_allow_test := COALESCE(p_allow_test_opponent, FALSE) AND v_is_admin;

    -- Ensure duel_stats row exists for caller
    INSERT INTO public.duel_stats (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Check if player is already in an active match
    SELECT dm.id, dm.status INTO v_existing_active_match
    FROM public.duel_matches dm
    JOIN public.duel_players dp ON dp.match_id = dm.id
    WHERE dp.player_id = v_user_id
      AND dm.status IN ('MATCHED', 'COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION')
    ORDER BY dm.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'match_id', v_existing_active_match.id,
            'status', v_existing_active_match.status,
            'reconnected', true
        );
    END IF;

    -- Initialize with 0 tickets if new user
    INSERT INTO public.game_tickets (user_id, balance)
    VALUES (v_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance INTO v_ticket_balance
    FROM public.game_tickets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_ticket_balance < 1 THEN
        RAISE EXCEPTION 'Insufficient game tickets. 1 ticket required to enter duel.';
    END IF;

    -- Try to find an existing WAITING match with row lock to avoid race conditions
    SELECT dm.* INTO v_match
    FROM public.duel_matches dm
    JOIN public.duel_players dp ON dp.match_id = dm.id
    WHERE dm.status = 'WAITING'
      AND dp.player_id != v_user_id
      AND dm.created_at >= NOW() - INTERVAL '60 seconds'
    ORDER BY dm.created_at ASC
    FOR UPDATE OF dm SKIP LOCKED
    LIMIT 1;

    IF FOUND THEN
        -- Deduct ticket for Player 2
        UPDATE public.game_tickets
        SET balance = balance - 1, updated_at = NOW()
        WHERE user_id = v_user_id;

        INSERT INTO public.game_ticket_transactions (
            user_id, amount, balance_after, transaction_type, reference_id, description
        ) VALUES (
            v_user_id, -1, v_ticket_balance - 1, 'MATCH_ENTRY', v_match.id::text, '1v1 Duel Match Entry'
        );

        -- Find Player 1 ID to calculate combined anti-repeat exclusion
        SELECT player_id INTO v_player1_id
        FROM public.duel_players
        WHERE match_id = v_match.id AND player_slot = 'PLAYER_1'
        LIMIT 1;

        -- Authoritatively select 5 match questions considering both players' recent exposures
        v_round_questions := public.select_duel_match_questions(v_player1_id, v_user_id);

        -- Join as PLAYER_2 and advance status to MATCHED
        INSERT INTO public.duel_players (
            match_id, player_id, player_slot, status, display_name, avatar_url, is_test_opponent
        ) VALUES (
            v_match.id, v_user_id, 'PLAYER_2', 'READY', v_clean_name, p_avatar_url, false
        );

        UPDATE public.duel_matches
        SET status = 'MATCHED',
            round_questions = v_round_questions,
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = v_match.id;

        UPDATE public.duel_players
        SET status = 'READY', updated_at = NOW()
        WHERE match_id = v_match.id AND player_slot = 'PLAYER_1';

        INSERT INTO public.duel_events (match_id, player_id, event_type, payload)
        VALUES (v_match.id, v_user_id, 'PLAYER_JOINED_MATCHED', jsonb_build_object('slot', 'PLAYER_2'));

        RETURN jsonb_build_object(
            'success', true,
            'match_id', v_match.id,
            'player_slot', 'PLAYER_2',
            'status', 'MATCHED',
            'is_test_opponent', false
        );
    END IF;

    -- Test Opponent branch (strictly authorized admin/test only)
    IF v_effective_allow_test THEN
        UPDATE public.game_tickets
        SET balance = balance - 1, updated_at = NOW()
        WHERE user_id = v_user_id;

        v_round_questions := public.select_duel_match_questions(v_user_id, NULL);

        INSERT INTO public.duel_matches (
            status, current_round, is_test_opponent, match_type, round_questions, started_at
        ) VALUES (
            'MATCHED', 1, true, 'DEV_TEST', v_round_questions, NOW()
        ) RETURNING id INTO v_new_match_id;

        INSERT INTO public.game_ticket_transactions (
            user_id, amount, balance_after, transaction_type, reference_id, description
        ) VALUES (
            v_user_id, -1, v_ticket_balance - 1, 'MATCH_ENTRY', v_new_match_id::text, '1v1 Duel Test Match Entry'
        );

        INSERT INTO public.duel_players (
            match_id, player_id, player_slot, status, display_name, avatar_url, is_test_opponent
        ) VALUES (
            v_new_match_id, v_user_id, 'PLAYER_1', 'READY', v_clean_name, p_avatar_url, false
        );

        INSERT INTO public.duel_players (
            match_id, player_id, player_slot, status, display_name, avatar_url, is_test_opponent
        ) VALUES (
            v_new_match_id, NULL, 'PLAYER_2', 'READY', 'Vortex (AI)', NULL, true
        );

        INSERT INTO public.duel_events (match_id, player_id, event_type, payload)
        VALUES (v_new_match_id, v_user_id, 'TEST_MATCH_CREATED', jsonb_build_object('slot', 'PLAYER_1'));

        RETURN jsonb_build_object(
            'success', true,
            'match_id', v_new_match_id,
            'player_slot', 'PLAYER_1',
            'status', 'MATCHED',
            'is_test_opponent', true
        );
    END IF;

    -- Normal Matchmaking: Deduct 1 ticket, pre-select questions for Player 1, wait in queue
    UPDATE public.game_tickets
    SET balance = balance - 1, updated_at = NOW()
    WHERE user_id = v_user_id;

    v_round_questions := public.select_duel_match_questions(v_user_id, NULL);

    INSERT INTO public.duel_matches (
        status, current_round, is_test_opponent, match_type, round_questions
    ) VALUES (
        'WAITING', 1, false, 'PVP', v_round_questions
    ) RETURNING id INTO v_new_match_id;

    INSERT INTO public.game_ticket_transactions (
        user_id, amount, balance_after, transaction_type, reference_id, description
    ) VALUES (
        v_user_id, -1, v_ticket_balance - 1, 'MATCH_ENTRY', v_new_match_id::text, '1v1 Duel Match Entry'
    );

    INSERT INTO public.duel_players (
        match_id, player_id, player_slot, status, display_name, avatar_url, is_test_opponent
    ) VALUES (
        v_new_match_id, v_user_id, 'PLAYER_1', 'WAITING', v_clean_name, p_avatar_url, false
    );

    INSERT INTO public.duel_events (match_id, player_id, event_type, payload)
    VALUES (v_new_match_id, v_user_id, 'WAITING_IN_QUEUE', jsonb_build_object('slot', 'PLAYER_1'));

    RETURN jsonb_build_object(
        'success', true,
        'match_id', v_new_match_id,
        'player_slot', 'PLAYER_1',
        'status', 'WAITING',
        'is_test_opponent', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_matchmaking_rpc(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_matchmaking_rpc(TEXT, TEXT, BOOLEAN) TO authenticated;
