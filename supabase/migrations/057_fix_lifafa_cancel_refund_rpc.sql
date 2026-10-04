-- ==============================================================================
-- MIGRATION 057: AUTHORITATIVE LIFAFA CANCELLATION & REFUND WITH PREVIEW BREAKDOWN
-- ==============================================================================
-- BUSINESS REQUIREMENTS:
-- 1. Fix the production error: column "role" does not exist.
--    Root cause: live RPC referenced public.profiles.role which does not exist
--    (roles are stored in public.admin_users).
-- 2. Provide an authoritative server-side PREVIEW RPC:
--    public.preview_cancel_lifafa_refund_rpc(p_lifafa_id UUID)
--    Calculates live breakdown (claimed, distributed, consumed fee, remaining prize,
--    remaining fee reserve, total refundable) so the frontend NEVER calculates money.
-- 3. Provide an authoritative server-side EXECUTION RPC:
--    public.refund_expired_or_cancelled_lifafa_rpc(p_lifafa_id UUID)
--    Locks target Lifafa and Creator Wallet, recalculates live balances, prevents
--    double refunds, handles UPI fee escrow, updates ledger and lifafa status.
--
-- FINANCIAL INVARIANTS:
-- - Creator-only or Admin authorization.
-- - Only unallocated remaining prize and unconsumed fee reserve are refundable.
-- - Already claimed winner rewards are NEVER refunded.
-- - Already consumed payout charges are NEVER refunded.
-- - Double cancellation is completely idempotent (returns 0 refund).
-- - Preserves double-entry ledger in public.wallet_transactions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PREVIEW RPC: READ-ONLY AUTHORITATIVE FINANCIAL BREAKDOWN BEFORE CANCELLATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_cancel_lifafa_refund_rpc(
    p_lifafa_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_service_role BOOLEAN := (
        COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
        OR auth.role() = 'service_role'
        OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );
    v_is_admin BOOLEAN := FALSE;
    v_lifafa RECORD;
    v_total_prize NUMERIC(12, 2) := 0.00;
    v_remaining_prize NUMERIC(12, 2) := 0.00;
    v_distributed_prize NUMERIC(12, 2) := 0.00;
    v_total_fee_escrow NUMERIC(12, 2) := 0.00;
    v_remaining_fee_escrow NUMERIC(12, 2) := 0.00;
    v_consumed_fee NUMERIC(12, 2) := 0.00;
    v_total_refundable NUMERIC(12, 2) := 0.00;
    v_is_eligible BOOLEAN := TRUE;
    v_eligibility_message TEXT := 'Eligible for cancellation and refund';
BEGIN
    -- Authentication Check
    IF NOT v_is_service_role THEN
        IF v_caller_id IS NULL THEN
            RAISE EXCEPTION 'Authentication required to preview Lifafa refund';
        END IF;
    END IF;

    -- Fetch target Lifafa
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    -- Authorization Check: Creator or Admin
    IF NOT v_is_service_role THEN
        v_is_admin := (public.has_admin_role('ADMIN') OR public.is_admin(v_caller_id));
        IF v_caller_id <> v_lifafa.creator_id AND NOT v_is_admin THEN
            RAISE EXCEPTION 'Unauthorized: only the Lifafa creator or an administrator can preview cancellation';
        END IF;
    END IF;

    -- Compute prize amounts
    v_total_prize := GREATEST(0.00, COALESCE(v_lifafa.total_amount, 0.00));
    v_remaining_prize := GREATEST(0.00, COALESCE(v_lifafa.remaining_amount, 0.00));
    v_distributed_prize := GREATEST(0.00, v_total_prize - v_remaining_prize);

    -- Compute fee escrow amounts for UPI Lifafas
    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        v_total_fee_escrow := GREATEST(0.00, COALESCE(v_lifafa.total_fee_amount, 0.00));
        v_remaining_fee_escrow := GREATEST(0.00, COALESCE(v_lifafa.remaining_fee_amount, 0.00));
        v_consumed_fee := GREATEST(0.00, v_total_fee_escrow - v_remaining_fee_escrow);
    ELSE
        v_total_fee_escrow := 0.00;
        v_remaining_fee_escrow := 0.00;
        v_consumed_fee := 0.00;
    END IF;

    -- Authoritative total refundable amount
    v_total_refundable := v_remaining_prize + v_remaining_fee_escrow;

    -- Eligibility checks
    IF v_lifafa.status IN ('CANCELLED'::lifafa_status, 'EXHAUSTED'::lifafa_status) THEN
        v_is_eligible := FALSE;
        v_eligibility_message := 'Lifafa has already been cancelled and refunded.';
        v_total_refundable := 0.00;
    ELSIF v_lifafa.status = 'COMPLETED'::lifafa_status THEN
        v_is_eligible := FALSE;
        v_eligibility_message := 'Lifafa is completed and all rewards have been claimed.';
        v_total_refundable := 0.00;
    ELSIF v_lifafa.status NOT IN ('ACTIVE'::lifafa_status, 'EXPIRED'::lifafa_status) THEN
        v_is_eligible := FALSE;
        v_eligibility_message := 'Lifafa status (' || v_lifafa.status || ') is not eligible for cancellation.';
        v_total_refundable := 0.00;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lifafa_id', v_lifafa.id,
        'code', v_lifafa.code,
        'title', v_lifafa.title,
        'status', v_lifafa.status,
        'payout_mode', v_lifafa.payout_mode,
        'claimed_count', COALESCE(v_lifafa.claimed_count, 0),
        'winner_count', COALESCE(v_lifafa.winner_count, 0),
        'total_prize_pool', v_total_prize,
        'already_distributed_amount', v_distributed_prize,
        'remaining_prize', v_remaining_prize,
        'total_payout_fee_escrow', v_total_fee_escrow,
        'consumed_payout_fee', v_consumed_fee,
        'remaining_payout_fee_reserve', v_remaining_fee_escrow,
        'creation_fee_note', 'Creation fee: Non-refundable',
        'total_refundable_amount', v_total_refundable,
        'is_eligible', v_is_eligible,
        'eligibility_message', v_eligibility_message
    );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_cancel_lifafa_refund_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_cancel_lifafa_refund_rpc(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 2. EXECUTION RPC: ATOMIC CANCELLATION & REFUND WITH AUDIT TRAIL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(
    p_lifafa_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_service_role BOOLEAN := (
        COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
        OR auth.role() = 'service_role'
        OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    );
    v_is_admin BOOLEAN := FALSE;
    v_lifafa RECORD;
    v_creator_wallet RECORD;
    v_total_prize NUMERIC(12, 2) := 0.00;
    v_refund_prize NUMERIC(12, 2) := 0.00;
    v_refund_fee NUMERIC(12, 2) := 0.00;
    v_total_refund NUMERIC(12, 2) := 0.00;
    v_distributed_prize NUMERIC(12, 2) := 0.00;
    v_consumed_fee NUMERIC(12, 2) := 0.00;
    v_balance_before NUMERIC(12, 2);
    v_balance_after NUMERIC(12, 2);
    v_idempotency_key TEXT;
    v_new_status lifafa_status;
BEGIN
    -- 1. Authentication Check
    IF NOT v_is_service_role THEN
        IF v_caller_id IS NULL THEN
            RAISE EXCEPTION 'Authentication required to refund this Lifafa';
        END IF;
    END IF;

    -- 2. Concurrency Row Lock on Target Lifafa
    SELECT * INTO v_lifafa
    FROM public.lifafas
    WHERE id = p_lifafa_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lifafa not found';
    END IF;

    -- 3. Authorization Check (No invalid profiles.role query!)
    IF NOT v_is_service_role THEN
        v_is_admin := (public.has_admin_role('ADMIN') OR public.is_admin(v_caller_id));
        IF v_caller_id <> v_lifafa.creator_id AND NOT v_is_admin THEN
            RAISE EXCEPTION 'Unauthorized: only the Lifafa creator or an administrator can cancel/refund';
        END IF;
    END IF;

    -- 4. Idempotency & Status Checks
    IF v_lifafa.status IN ('CANCELLED'::lifafa_status, 'EXHAUSTED'::lifafa_status) THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Lifafa has already been cancelled and refunded.',
            'lifafa_id', v_lifafa.id,
            'code', v_lifafa.code,
            'status', v_lifafa.status,
            'claimed_count', COALESCE(v_lifafa.claimed_count, 0),
            'winner_count', COALESCE(v_lifafa.winner_count, 0),
            'total_refunded', 0.00,
            'refunded_amount', 0.00,
            'refunded_prize', 0.00,
            'refunded_fee_reserve', 0.00
        );
    END IF;

    IF v_lifafa.status = 'COMPLETED'::lifafa_status THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Lifafa is completed and all rewards have been claimed.',
            'lifafa_id', v_lifafa.id,
            'code', v_lifafa.code,
            'status', v_lifafa.status,
            'total_refunded', 0.00,
            'refunded_amount', 0.00
        );
    END IF;

    IF v_lifafa.status NOT IN ('ACTIVE'::lifafa_status, 'EXPIRED'::lifafa_status) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Lifafa status (' || v_lifafa.status || ') is not eligible for cancellation or refund.',
            'lifafa_id', v_lifafa.id,
            'code', v_lifafa.code,
            'status', v_lifafa.status,
            'total_refunded', 0.00,
            'refunded_amount', 0.00
        );
    END IF;

    -- 5. Live Authoritative Recalculation (Protects against any race condition claims)
    v_total_prize := GREATEST(0.00, COALESCE(v_lifafa.total_amount, 0.00));
    v_refund_prize := GREATEST(0.00, COALESCE(v_lifafa.remaining_amount, 0.00));
    v_distributed_prize := GREATEST(0.00, v_total_prize - v_refund_prize);

    IF v_lifafa.payout_mode = 'UPI_BANK' THEN
        v_refund_fee := GREATEST(0.00, COALESCE(v_lifafa.remaining_fee_amount, 0.00));
        v_consumed_fee := GREATEST(0.00, COALESCE(v_lifafa.total_fee_amount, 0.00) - v_refund_fee);
    ELSE
        v_refund_fee := 0.00;
        v_consumed_fee := 0.00;
    END IF;

    v_total_refund := v_refund_prize + v_refund_fee;

    -- Determine new status: EXPIRED if expired, else CANCELLED
    IF v_lifafa.expires_at <= NOW() THEN
        v_new_status := 'EXPIRED'::lifafa_status;
    ELSE
        v_new_status := 'CANCELLED'::lifafa_status;
    END IF;

    -- 6. Zero Balance Edge Case (All claimed or empty)
    IF v_total_refund <= 0.00 THEN
        UPDATE public.lifafas
        SET status = v_new_status,
            remaining_amount = 0.00,
            remaining_fee_amount = 0.00,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_lifafa.id;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Lifafa marked as ' || v_new_status || '; zero remaining balance to refund.',
            'lifafa_id', v_lifafa.id,
            'code', v_lifafa.code,
            'status', v_new_status,
            'claimed_count', COALESCE(v_lifafa.claimed_count, 0),
            'winner_count', COALESCE(v_lifafa.winner_count, 0),
            'total_prize_pool', v_total_prize,
            'distributed_amount', v_distributed_prize,
            'consumed_fees', v_consumed_fee,
            'total_refunded', 0.00,
            'refunded_amount', 0.00,
            'refunded_prize', 0.00,
            'refunded_fee_reserve', 0.00
        );
    END IF;

    -- 7. Lock Creator Wallet
    SELECT * INTO v_creator_wallet
    FROM public.wallets
    WHERE user_id = v_lifafa.creator_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Creator wallet not found for user ID %', v_lifafa.creator_id;
    END IF;

    v_balance_before := v_creator_wallet.available_balance;
    v_balance_after := v_balance_before + v_total_refund;

    -- 8. Atomically Refund Creator Wallet:
    -- Credit available_balance and release reserved_balance
    UPDATE public.wallets
    SET available_balance = v_balance_after,
        reserved_balance = GREATEST(0.00, reserved_balance - v_total_refund),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_creator_wallet.id;

    -- 9. Update Lifafa Record
    UPDATE public.lifafas
    SET status = v_new_status,
        remaining_amount = 0.00,
        remaining_fee_amount = 0.00,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_lifafa.id;

    -- 10. Record Immutable Audit Ledger Entry in public.wallet_transactions
    v_idempotency_key := 'LIFAFA_REFUND_' || v_lifafa.id::text || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;

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
        v_total_refund,
        'REFUND'::transaction_type,
        'SUCCESS'::transaction_status,
        'LIFAFA_REFUND',
        v_lifafa.id::text,
        v_idempotency_key,
        v_balance_before,
        v_balance_after,
        jsonb_build_object(
            'lifafa_id', v_lifafa.id,
            'lifafa_code', v_lifafa.code,
            'lifafa_title', v_lifafa.title,
            'new_status', v_new_status,
            'claimed_count', v_lifafa.claimed_count,
            'winner_count', v_lifafa.winner_count,
            'total_prize_pool', v_total_prize,
            'distributed_prize', v_distributed_prize,
            'consumed_payout_fee', v_consumed_fee,
            'refunded_prize', v_refund_prize,
            'refunded_fee_reserve', v_refund_fee,
            'total_refund', v_total_refund,
            'cancelled_by', COALESCE(v_caller_id, v_lifafa.creator_id)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Lifafa cancelled and ' || v_total_refund || ' refunded successfully.',
        'lifafa_id', v_lifafa.id,
        'code', v_lifafa.code,
        'title', v_lifafa.title,
        'status', v_new_status,
        'claimed_count', COALESCE(v_lifafa.claimed_count, 0),
        'winner_count', COALESCE(v_lifafa.winner_count, 0),
        'total_prize_pool', v_total_prize,
        'distributed_amount', v_distributed_prize,
        'consumed_fees', v_consumed_fee,
        'total_refunded', v_total_refund,
        'refunded_amount', v_total_refund,
        'refunded_prize', v_refund_prize,
        'refunded_fee_reserve', v_refund_fee,
        'new_balance', v_balance_after
    );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) TO authenticated, service_role;
