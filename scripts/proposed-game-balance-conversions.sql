-- =====================================================================
-- PROPOSED GAME BALANCE & TICKET CONVERSION ARCHITECTURE
-- (FOR REVIEW ONLY - DO NOT EXECUTE IN SUPABASE - DO NOT ADD TO MIGRATIONS)
-- =====================================================================
-- Purpose:
--   Enables atomic, auditable conversion between user's real cash balance
--   (wallets table) and Game Tickets (game_tickets table) at the canonical
--   server-authoritative rate of ₹10.00 = 1 Game Ticket.
--
-- STRICT SAFETY GUARANTEES:
--   1. Zero direct connection between Game Tickets and PayRupee payout API.
--   2. Withdrawals remain 100% bound to existing bank-account withdrawal architecture.
--   3. All conversions execute under row-level SELECT ... FOR UPDATE locks.
--   4. Global locking hierarchy: ALWAYS lock 'wallets' FIRST, 'game_tickets' SECOND.
--   5. Idempotency protection prevents duplicate debits or double credits.
--   6. Free-ticket creation retired for new users (default balance 0, daily claim disabled).
--   7. Historical INITIAL_GRANT and DAILY_CLAIM audit records fully preserved.
--   8. Atomic cross-store conversion ledger/bridge writes to both stores in one transaction.
-- =====================================================================

-- 1. Dedicated Game Balance Conversions Bridge Ledger Table
CREATE TABLE IF NOT EXISTS public.game_balance_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    conversion_type TEXT NOT NULL CHECK (conversion_type IN ('CASH_TO_TICKETS', 'TICKETS_TO_CASH')),
    cash_amount NUMERIC(12, 2) NOT NULL CHECK (cash_amount > 0),
    ticket_count INTEGER NOT NULL CHECK (ticket_count > 0),
    conversion_rate NUMERIC(12, 2) NOT NULL DEFAULT 10.00 CHECK (conversion_rate > 0),
    cash_balance_before NUMERIC(12, 2) NOT NULL CHECK (cash_balance_before >= 0),
    cash_balance_after NUMERIC(12, 2) NOT NULL CHECK (cash_balance_after >= 0),
    ticket_balance_before INTEGER NOT NULL CHECK (ticket_balance_before >= 0),
    ticket_balance_after INTEGER NOT NULL CHECK (ticket_balance_after >= 0),
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'REVERSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_game_conversions_user ON public.game_balance_conversions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_conversions_idempotency ON public.game_balance_conversions(idempotency_key);

-- Enable RLS on conversion ledger: users can only read their own conversion history
ALTER TABLE public.game_balance_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own game balance conversions"
    ON public.game_balance_conversions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.game_balance_conversions FROM authenticated, anon, public;
GRANT SELECT ON public.game_balance_conversions TO authenticated;


-- 2. Update CHECK Constraint on game_ticket_transactions for Conversions
-- (Preserves existing historical types INITIAL_GRANT and DAILY_CLAIM for complete auditability)
DO $$
BEGIN
    ALTER TABLE public.game_ticket_transactions 
    DROP CONSTRAINT IF EXISTS game_ticket_transactions_transaction_type_check;

    ALTER TABLE public.game_ticket_transactions 
    ADD CONSTRAINT game_ticket_transactions_transaction_type_check 
    CHECK (transaction_type IN (
        'INITIAL_GRANT',
        'DAILY_CLAIM',
        'MATCH_ENTRY',
        'MATCH_REFUND',
        'MATCH_REWARD',
        'ADMIN_GRANT',
        'CASH_TO_TICKETS',
        'TICKETS_TO_CASH'
    ));
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;


-- 3. Retire Free-Ticket Default on game_tickets (New users start with 0)
ALTER TABLE public.game_tickets ALTER COLUMN balance SET DEFAULT 0;


-- 4. Atomic Server-Authoritative CASH -> TICKETS RPC
-- Lock Hierarchy: wallets (1st) -> game_tickets (2nd)
CREATE OR REPLACE FUNCTION public.convert_cash_to_tickets_rpc(
    p_amount NUMERIC,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_ticket_rec RECORD;
    v_rate NUMERIC := 10.00; -- Canonical Server Rate: ₹10.00 = 1 Ticket
    v_ticket_count INTEGER;
    v_conversion_id UUID;
    v_cash_before NUMERIC;
    v_cash_after NUMERIC;
    v_ticket_before INTEGER;
    v_ticket_after INTEGER;
    v_existing RECORD;
    v_idempotency_key TEXT;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 2. Input validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Conversion amount must be strictly greater than 0';
    END IF;

    IF (p_amount % v_rate) != 0 THEN
        RAISE EXCEPTION 'Amount must be an exact multiple of ₹% (current rate: ₹% = 1 Ticket)', v_rate, v_rate;
    END IF;

    -- Normalize idempotency key (auto-generated if not supplied)
    v_idempotency_key := COALESCE(NULLIF(TRIM(p_idempotency_key), ''), 'c2t_' || gen_random_uuid()::text);

    -- 3. Idempotency Check: Return existing record if already processed
    SELECT * INTO v_existing
    FROM public.game_balance_conversions
    WHERE idempotency_key = v_idempotency_key;

    IF FOUND THEN
        -- Prevent collision with different conversion types or other users
        IF v_existing.conversion_type != 'CASH_TO_TICKETS' OR v_existing.user_id != v_user_id THEN
            RAISE EXCEPTION 'Idempotency key already used for a different conversion operation';
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'conversion_id', v_existing.id,
            'conversion_type', v_existing.conversion_type,
            'cash_amount', v_existing.cash_amount,
            'ticket_count', v_existing.ticket_count,
            'conversion_rate', v_existing.conversion_rate,
            'new_cash_balance', v_existing.cash_balance_after,
            'new_ticket_balance', v_existing.ticket_balance_after
        );
    END IF;

    -- 4. Calculate tickets authoritatively server-side
    v_ticket_count := (p_amount / v_rate)::INTEGER;

    -- 5. Lock user's wallet for update FIRST (Global Lock Order: 1)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    -- 6. Validate balance sufficiency
    IF v_wallet.available_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient available balance. Required: ₹%, Available: ₹%', p_amount, v_wallet.available_balance;
    END IF;

    -- 7. Lock or initialize user's ticket balance for update SECOND (Global Lock Order: 2)
    INSERT INTO public.game_tickets (user_id, balance)
    VALUES (v_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_ticket_rec
    FROM public.game_tickets
    WHERE user_id = v_user_id
    FOR UPDATE;

    -- Record snapshots
    v_cash_before := v_wallet.available_balance;
    v_cash_after := v_cash_before - p_amount;
    v_ticket_before := v_ticket_rec.balance;
    v_ticket_after := v_ticket_before + v_ticket_count;
    v_conversion_id := gen_random_uuid();

    -- 8. Atomic balance updates
    UPDATE public.wallets
    SET available_balance = v_cash_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    UPDATE public.game_tickets
    SET balance = v_ticket_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_user_id;

    -- 9. Insert wallet_transactions row (Audit Ledger 1)
    INSERT INTO public.wallet_transactions (
        user_id, wallet_id, amount, type, status,
        reference_type, reference_id, idempotency_key,
        balance_before, balance_after, metadata
    ) VALUES (
        v_user_id, v_wallet.id, -p_amount, 'DEBIT'::transaction_type, 'SUCCESS'::transaction_status,
        'CASH_TO_TICKETS', v_conversion_id::text, 'wtx_' || v_idempotency_key,
        v_cash_before, v_cash_after,
        jsonb_build_object(
            'conversion_id', v_conversion_id,
            'tickets_purchased', v_ticket_count,
            'rate', v_rate
        )
    );

    -- 10. Insert game_ticket_transactions row (Audit Ledger 2)
    INSERT INTO public.game_ticket_transactions (
        user_id, amount, balance_after, transaction_type,
        reference_id, description
    ) VALUES (
        v_user_id, v_ticket_count, v_ticket_after, 'CASH_TO_TICKETS',
        v_conversion_id::text,
        'Converted ₹' || p_amount::text || ' to ' || v_ticket_count::text || ' Game Tickets'
    );

    -- 11. Insert game_balance_conversions row (Bridge Reconciliation Ledger)
    INSERT INTO public.game_balance_conversions (
        id, user_id, conversion_type, cash_amount, ticket_count,
        conversion_rate, cash_balance_before, cash_balance_after,
        ticket_balance_before, ticket_balance_after, idempotency_key, status
    ) VALUES (
        v_conversion_id, v_user_id, 'CASH_TO_TICKETS', p_amount, v_ticket_count,
        v_rate, v_cash_before, v_cash_after,
        v_ticket_before, v_ticket_after, v_idempotency_key, 'SUCCESS'
    );

    RETURN jsonb_build_object(
        'success', true,
        'conversion_id', v_conversion_id,
        'conversion_type', 'CASH_TO_TICKETS',
        'cash_amount', p_amount,
        'ticket_count', v_ticket_count,
        'conversion_rate', v_rate,
        'new_cash_balance', v_cash_after,
        'new_ticket_balance', v_ticket_after
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_cash_to_tickets_rpc(NUMERIC, TEXT) TO authenticated;


-- 5. Atomic Server-Authoritative TICKETS -> CASH RPC
-- Lock Hierarchy: wallets (1st) -> game_tickets (2nd) [Exact Same Global Order]
CREATE OR REPLACE FUNCTION public.convert_tickets_to_cash_rpc(
    p_tickets INTEGER,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_ticket_rec RECORD;
    v_rate NUMERIC := 10.00; -- Canonical Server Rate: 1 Ticket = ₹10.00
    v_cash_amount NUMERIC(12, 2);
    v_conversion_id UUID;
    v_cash_before NUMERIC;
    v_cash_after NUMERIC;
    v_ticket_before INTEGER;
    v_ticket_after INTEGER;
    v_existing RECORD;
    v_idempotency_key TEXT;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 2. Input validation
    IF p_tickets IS NULL OR p_tickets < 1 THEN
        RAISE EXCEPTION 'Ticket count must be an integer of at least 1';
    END IF;

    -- Normalize idempotency key (auto-generated if not supplied)
    v_idempotency_key := COALESCE(NULLIF(TRIM(p_idempotency_key), ''), 't2c_' || gen_random_uuid()::text);

    -- 3. Idempotency Check: Return existing record if already processed
    SELECT * INTO v_existing
    FROM public.game_balance_conversions
    WHERE idempotency_key = v_idempotency_key;

    IF FOUND THEN
        -- Prevent collision with different conversion types or other users
        IF v_existing.conversion_type != 'TICKETS_TO_CASH' OR v_existing.user_id != v_user_id THEN
            RAISE EXCEPTION 'Idempotency key already used for a different conversion operation';
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'conversion_id', v_existing.id,
            'conversion_type', v_existing.conversion_type,
            'cash_amount', v_existing.cash_amount,
            'ticket_count', v_existing.ticket_count,
            'conversion_rate', v_existing.conversion_rate,
            'new_cash_balance', v_existing.cash_balance_after,
            'new_ticket_balance', v_existing.ticket_balance_after
        );
    END IF;

    -- 4. Calculate cash value authoritatively server-side
    v_cash_amount := (p_tickets * v_rate)::NUMERIC(12, 2);

    -- 5. Lock user's wallet for update FIRST (Global Lock Order: 1 - Prevents Deadlocks)
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;

    -- 6. Lock ticket balance for update SECOND (Global Lock Order: 2)
    SELECT * INTO v_ticket_rec
    FROM public.game_tickets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_ticket_rec.balance < p_tickets THEN
        RAISE EXCEPTION 'Insufficient Game Tickets. Required: %, Available: %',
            p_tickets, COALESCE(v_ticket_rec.balance, 0);
    END IF;

    -- Record snapshots
    v_ticket_before := v_ticket_rec.balance;
    v_ticket_after := v_ticket_before - p_tickets;
    v_cash_before := v_wallet.available_balance;
    v_cash_after := v_cash_before + v_cash_amount;
    v_conversion_id := gen_random_uuid();

    -- 7. Atomic balance updates
    UPDATE public.game_tickets
    SET balance = v_ticket_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE user_id = v_user_id;

    UPDATE public.wallets
    SET available_balance = v_cash_after,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_wallet.id;

    -- 8. Insert game_ticket_transactions row (Audit Ledger 1)
    INSERT INTO public.game_ticket_transactions (
        user_id, amount, balance_after, transaction_type,
        reference_id, description
    ) VALUES (
        v_user_id, -p_tickets, v_ticket_after, 'TICKETS_TO_CASH',
        v_conversion_id::text,
        'Converted ' || p_tickets::text || ' Game Tickets to ₹' || v_cash_amount::text
    );

    -- 9. Insert wallet_transactions row (Audit Ledger 2)
    INSERT INTO public.wallet_transactions (
        user_id, wallet_id, amount, type, status,
        reference_type, reference_id, idempotency_key,
        balance_before, balance_after, metadata
    ) VALUES (
        v_user_id, v_wallet.id, v_cash_amount, 'CREDIT'::transaction_type, 'SUCCESS'::transaction_status,
        'TICKETS_TO_CASH', v_conversion_id::text, 'wtx_' || v_idempotency_key,
        v_cash_before, v_cash_after,
        jsonb_build_object(
            'conversion_id', v_conversion_id,
            'tickets_redeemed', p_tickets,
            'rate', v_rate
        )
    );

    -- 10. Insert game_balance_conversions row (Bridge Reconciliation Ledger)
    INSERT INTO public.game_balance_conversions (
        id, user_id, conversion_type, cash_amount, ticket_count,
        conversion_rate, cash_balance_before, cash_balance_after,
        ticket_balance_before, ticket_balance_after, idempotency_key, status
    ) VALUES (
        v_conversion_id, v_user_id, 'TICKETS_TO_CASH', v_cash_amount, p_tickets,
        v_rate, v_cash_before, v_cash_after,
        v_ticket_before, v_ticket_after, v_idempotency_key, 'SUCCESS'
    );

    RETURN jsonb_build_object(
        'success', true,
        'conversion_id', v_conversion_id,
        'conversion_type', 'TICKETS_TO_CASH',
        'cash_amount', v_cash_amount,
        'ticket_count', p_tickets,
        'conversion_rate', v_rate,
        'new_cash_balance', v_cash_after,
        'new_ticket_balance', v_ticket_after
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_tickets_to_cash_rpc(INTEGER, TEXT) TO authenticated;


-- 6. Updated get_game_ticket_balance_rpc (Retires 5-ticket welcome bonus for new users)
CREATE OR REPLACE FUNCTION public.get_game_ticket_balance_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_balance INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Ensure game_tickets row exists with 0 default balance (no free promotional grant)
    INSERT INTO public.game_tickets (user_id, balance)
    VALUES (v_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance INTO v_balance FROM public.game_tickets WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'balance', COALESCE(v_balance, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_ticket_balance_rpc() TO authenticated;


-- 7. Updated join_matchmaking_rpc (Retires 5-ticket fallback on join)
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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to join Duel matchmaking';
    END IF;

    v_clean_name := COALESCE(TRIM(p_display_name), 'Challenger');
    IF LENGTH(v_clean_name) = 0 THEN
        v_clean_name := 'Challenger';
    END IF;

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

    -- Initialize with 0 tickets if new user (requires cash conversion if balance < 1)
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

        -- Join as PLAYER_2 and advance status to MATCHED
        INSERT INTO public.duel_players (
            match_id, player_id, player_slot, status, display_name, avatar_url, is_test_opponent
        ) VALUES (
            v_match.id, v_user_id, 'PLAYER_2', 'READY', v_clean_name, p_avatar_url, false
        );

        UPDATE public.duel_matches
        SET status = 'MATCHED',
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

    -- Normal Matchmaking: Deduct 1 ticket, create match and wait in queue
    UPDATE public.game_tickets
    SET balance = balance - 1, updated_at = NOW()
    WHERE user_id = v_user_id;

    INSERT INTO public.duel_matches (
        status, current_round, is_test_opponent
    ) VALUES (
        'WAITING', 1, false
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

GRANT EXECUTE ON FUNCTION public.join_matchmaking_rpc(TEXT, TEXT, BOOLEAN) TO authenticated;


-- 8. Neutralized claim_daily_game_ticket_rpc (Cleanly retired, zero balance mutation)
CREATE OR REPLACE FUNCTION public.claim_daily_game_ticket_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_balance INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT balance INTO v_balance
    FROM public.game_tickets
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', false,
        'message', 'Daily promotional claims have been retired in favor of the Game Balance system.',
        'balance', COALESCE(v_balance, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_game_ticket_rpc() TO authenticated;
