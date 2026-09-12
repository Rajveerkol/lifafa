-- ====================================================================
-- Migration 021: Production Duel Earn Architecture & Security Foundation
-- Phase 1 Foundation: Two-player match engine, authoritative scoring,
-- private round submissions, non-withdrawable game ticket economy,
-- match history, and competitive leaderboard.
-- 
-- STRICT ISOLATION NOTICE:
-- Completely decoupled from wallets, withdrawals, and PayRupee.
-- Migrations 001-020 remain 100% untouched.
-- ====================================================================

-- 1. Game Tickets Table (Non-Withdrawable Promotional Game Credits Only)
CREATE TABLE IF NOT EXISTS public.game_tickets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 5 CHECK (balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Game Ticket Transactions (Audit ledger & idempotency for ticket mutations)
CREATE TABLE IF NOT EXISTS public.game_ticket_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'INITIAL_GRANT',
        'DAILY_CLAIM',
        'MATCH_ENTRY',
        'MATCH_REFUND',
        'MATCH_REWARD',
        'ADMIN_GRANT'
    )),
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT uq_ticket_tx_idempotency UNIQUE (user_id, transaction_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_game_ticket_tx_user ON public.game_ticket_transactions(user_id, created_at DESC);

-- 3. Canonical Questions Bank for Server-Side Answer Verification
CREATE TABLE IF NOT EXISTS public.duel_questions (
    id TEXT PRIMARY KEY,
    round_type TEXT NOT NULL CHECK (round_type IN ('QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED')),
    prompt TEXT NOT NULL,
    options JSONB DEFAULT '[]'::jsonb,
    correct_answer TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    time_limit_sec INTEGER NOT NULL DEFAULT 25 CHECK (time_limit_sec BETWEEN 5 AND 60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Seed initial authoritative questions
INSERT INTO public.duel_questions (id, round_type, prompt, options, correct_answer, difficulty, time_limit_sec) VALUES
('q_quiz_1', 'QUICK_QUIZ', 'Which protocol powers real-time, low-latency web communication?', '["HTTP/1.1", "WebSockets", "FTP", "SMTP"]'::jsonb, 'WebSockets', 'EASY', 25),
('q_quiz_2', 'QUICK_QUIZ', 'What is the largest planet in our solar system?', '["Earth", "Mars", "Jupiter", "Saturn"]'::jsonb, 'Jupiter', 'EASY', 25),
('q_quiz_3', 'QUICK_QUIZ', 'What is 15 * 14?', '["210", "190", "225", "200"]'::jsonb, '210', 'MEDIUM', 25),
('q_pat_1', 'PATTERN', 'Complete the sequence: 2, 4, 8, 16, ?', '["24", "32", "30", "64"]'::jsonb, '32', 'EASY', 25),
('q_pat_2', 'PATTERN', 'Complete the sequence: 3, 7, 15, 31, ?', '["48", "62", "63", "64"]'::jsonb, '63', 'MEDIUM', 25),
('q_pat_3', 'PATTERN', 'Complete the sequence: 1, 1, 2, 3, 5, 8, ?', '["11", "13", "15", "12"]'::jsonb, '13', 'MEDIUM', 25),
('q_mem_1', 'MEMORY', 'Memorize & recall the 4-symbol sequence: [💎, ⚡, 👑, 🔥]', '["💎, ⚡, 👑, 🔥", "⚡, 💎, 🔥, 👑", "👑, 💎, ⚡, 🔥", "🔥, ⚡, 💎, 👑"]'::jsonb, '💎, ⚡, 👑, 🔥', 'MEDIUM', 25),
('q_mem_2', 'MEMORY', 'Memorize & recall the 4-color pattern: [Red, Blue, Green, Yellow]', '["Red, Blue, Green, Yellow", "Blue, Red, Yellow, Green", "Green, Red, Blue, Yellow", "Yellow, Blue, Green, Red"]'::jsonb, 'Red, Blue, Green, Yellow', 'MEDIUM', 25),
('q_acc_1', 'ACCURACY', 'Identify the target with the highest point value:', '["100 pts", "250 pts", "500 pts", "75 pts"]'::jsonb, '500 pts', 'EASY', 20),
('q_acc_2', 'ACCURACY', 'Which geometric shape has exactly 8 sides?', '["Hexagon", "Octagon", "Decagon", "Heptagon"]'::jsonb, 'Octagon', 'EASY', 20),
('q_spd_1', 'SPEED', 'Reaction test: Tap the ACTIVE GREEN target before time runs out!', '["GREEN_ACTIVE", "RED_INACTIVE", "BLUE_INACTIVE", "GRAY_INACTIVE"]'::jsonb, 'GREEN_ACTIVE', 'EASY', 15),
('q_spd_2', 'SPEED', 'Quick calculation: 12 + 28 = ?', '["40", "38", "42", "50"]'::jsonb, '40', 'EASY', 15)
ON CONFLICT (id) DO UPDATE SET
    round_type = EXCLUDED.round_type,
    prompt = EXCLUDED.prompt,
    options = EXCLUDED.options,
    correct_answer = EXCLUDED.correct_answer,
    difficulty = EXCLUDED.difficulty,
    time_limit_sec = EXCLUDED.time_limit_sec;

-- 4. Secure Public View for Questions (EXCLUDES correct_answer entirely)
CREATE OR REPLACE VIEW public.duel_questions_public AS
SELECT
    id,
    round_type,
    prompt,
    options,
    difficulty,
    time_limit_sec,
    created_at
FROM public.duel_questions;

-- 5. Duel Matches Table
CREATE TABLE IF NOT EXISTS public.duel_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN (
        'WAITING',
        'MATCHED',
        'COUNTDOWN',
        'IN_PROGRESS',
        'ROUND_TRANSITION',
        'COMPLETED',
        'CANCELLED',
        'DISCONNECTED'
    )),
    current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round BETWEEN 1 AND 5),
    winner_id UUID REFERENCES auth.users(id),
    is_test_opponent BOOLEAN NOT NULL DEFAULT FALSE,
    match_config JSONB DEFAULT '{"max_rounds": 5, "round_duration_sec": 25}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_duel_matches_status ON public.duel_matches(status);
CREATE INDEX IF NOT EXISTS idx_duel_matches_created_at ON public.duel_matches(created_at DESC);

-- 6. Duel Players Table (Strictly 2 Player Slots: PLAYER_1 and PLAYER_2)
CREATE TABLE IF NOT EXISTS public.duel_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.duel_matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player_slot TEXT NOT NULL CHECK (player_slot IN ('PLAYER_1', 'PLAYER_2')),
    status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'READY', 'PLAYING', 'FINISHED', 'DISCONNECTED')),
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    result TEXT NOT NULL DEFAULT 'PLAYING' CHECK (result IN ('PLAYING', 'WON', 'LOST', 'DRAW')),
    is_test_opponent BOOLEAN NOT NULL DEFAULT FALSE,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT uq_duel_match_slot UNIQUE (match_id, player_slot)
);

CREATE INDEX IF NOT EXISTS idx_duel_players_user ON public.duel_players(player_id);
CREATE INDEX IF NOT EXISTS idx_duel_players_match ON public.duel_players(match_id);

-- 7. Duel Rounds Table (Private round submissions per player)
CREATE TABLE IF NOT EXISTS public.duel_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.duel_matches(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 5),
    round_type TEXT NOT NULL CHECK (round_type IN ('QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED')),
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES public.duel_questions(id),
    player_response TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
    is_correct BOOLEAN NOT NULL,
    score_awarded INTEGER NOT NULL DEFAULT 0 CHECK (score_awarded >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT uq_player_match_round UNIQUE (match_id, round_number, player_id)
);

CREATE INDEX IF NOT EXISTS idx_duel_rounds_match ON public.duel_rounds(match_id);
CREATE INDEX IF NOT EXISTS idx_duel_rounds_player ON public.duel_rounds(player_id);

-- 8. Duel Stats Table (Overall Competitive Player Record)
CREATE TABLE IF NOT EXISTS public.duel_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_matches INTEGER NOT NULL DEFAULT 0 CHECK (total_matches >= 0),
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
    draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
    win_streak INTEGER NOT NULL DEFAULT 0 CHECK (win_streak >= 0),
    highest_score INTEGER NOT NULL DEFAULT 0 CHECK (highest_score >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 9. Duel Events (Audit trail for lifecycle and disconnect tracking)
CREATE TABLE IF NOT EXISTS public.duel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.duel_matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_duel_events_match ON public.duel_events(match_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) HELPER & POLICIES
-- ====================================================================

-- Security Definer Participant Check Helper
-- CRITICAL FIX: Eliminates infinite RLS recursion on duel_players
CREATE OR REPLACE FUNCTION public.check_is_duel_participant(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.duel_players
        WHERE match_id = p_match_id AND player_id = auth.uid()
    );
$$;

ALTER TABLE public.game_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_ticket_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_events ENABLE ROW LEVEL SECURITY;

-- 1. game_tickets: Only owner can read balance
CREATE POLICY "Users read own ticket balance"
    ON public.game_tickets FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 2. game_ticket_transactions: Only owner can read ticket history
CREATE POLICY "Users read own ticket transactions"
    ON public.game_ticket_transactions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 3. duel_questions:
-- CRITICAL SECURITY FIX: Client SELECT on duel_questions is completely disabled.
-- Direct table access is blocked; clients use public.duel_questions_public or RPC.
-- No policy on duel_questions means default deny for authenticated/anon!

-- 4. duel_matches: Participants can read matches they belong to
CREATE POLICY "Participants read duel_matches"
    ON public.duel_matches FOR SELECT
    TO authenticated
    USING (public.check_is_duel_participant(id));

-- 5. duel_players:
-- CRITICAL NON-RECURSIVE RLS FIX: Uses SECURITY DEFINER helper to prevent recursion loop
CREATE POLICY "Participants read duel_players in same match"
    ON public.duel_players FOR SELECT
    TO authenticated
    USING (public.check_is_duel_participant(match_id));

-- 6. duel_rounds:
-- CRITICAL OPPONENT PRIVACY ENFORCEMENT:
-- Players can ONLY view their OWN round submissions.
-- A player can NEVER inspect the opponent's private answers or response times!
CREATE POLICY "Strict Privacy: Only read own round submissions"
    ON public.duel_rounds FOR SELECT
    TO authenticated
    USING (player_id = auth.uid());

-- 7. duel_stats: Public leaderboard read
CREATE POLICY "Public read duel_stats leaderboard"
    ON public.duel_stats FOR SELECT
    TO authenticated, anon
    USING (true);

-- 8. duel_events: Participants can read match events
CREATE POLICY "Participants read duel_events"
    ON public.duel_events FOR SELECT
    TO authenticated
    USING (public.check_is_duel_participant(match_id));

-- ====================================================================
-- SERVER-AUTHORITATIVE RPC FUNCTIONS
-- ====================================================================

-- 1. Game Ticket Balance RPC (Auto-initializes 5 promotional tickets)
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

    -- Ensure game_tickets row exists with 5 initial promotional tickets
    INSERT INTO public.game_tickets (user_id, balance)
    VALUES (v_user_id, 5)
    ON CONFLICT (user_id) DO NOTHING;

    -- Record initial grant transaction if first time
    INSERT INTO public.game_ticket_transactions (
        user_id, amount, balance_after, transaction_type, reference_id, description
    ) VALUES (
        v_user_id, 5, 5, 'INITIAL_GRANT', 'welcome_bonus', 'Initial promotional game tickets grant'
    ) ON CONFLICT (user_id, transaction_type, reference_id) DO NOTHING;

    SELECT balance INTO v_balance FROM public.game_tickets WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'balance', COALESCE(v_balance, 0)
    );
END;
$$;

-- 2. Claim Daily Free Game Ticket RPC (Once every 24 hours)
CREATE OR REPLACE FUNCTION public.claim_daily_game_ticket_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_last_claimed TIMESTAMPTZ;
    v_new_balance INTEGER;
    v_ref_id TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock tickets row
    SELECT balance INTO v_new_balance
    FROM public.game_tickets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.game_tickets (user_id, balance) VALUES (v_user_id, 5);
        v_new_balance := 5;
    END IF;

    -- Check last daily claim within 24 hours
    SELECT created_at INTO v_last_claimed
    FROM public.game_ticket_transactions
    WHERE user_id = v_user_id
      AND transaction_type = 'DAILY_CLAIM'
      AND created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Daily ticket already claimed. Next claim available in 24 hours.',
            'balance', v_new_balance
        );
    END IF;

    v_ref_id := 'daily_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS');
    v_new_balance := v_new_balance + 1;

    UPDATE public.game_tickets
    SET balance = v_new_balance, updated_at = NOW()
    WHERE user_id = v_user_id;

    INSERT INTO public.game_ticket_transactions (
        user_id, amount, balance_after, transaction_type, reference_id, description
    ) VALUES (
        v_user_id, 1, v_new_balance, 'DAILY_CLAIM', v_ref_id, 'Daily free promotional game ticket'
    );

    RETURN jsonb_build_object(
        'success', true,
        'balance', v_new_balance,
        'message', 'Daily free ticket claimed successfully!'
    );
END;
$$;

-- 3. Atomic Matchmaking: Deduct 1 Ticket, Join queue or pair with waiting human
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

    -- Verify and debit 1 Game Ticket atomically
    INSERT INTO public.game_tickets (user_id, balance)
    VALUES (v_user_id, 5)
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

    -- If development mode explicitly requested a test opponent:
    IF p_allow_test_opponent THEN
        -- Deduct 1 ticket for human entry
        UPDATE public.game_tickets
        SET balance = balance - 1, updated_at = NOW()
        WHERE user_id = v_user_id;

        INSERT INTO public.duel_matches (
            status, current_round, is_test_opponent, started_at
        ) VALUES (
            'MATCHED', 1, true, NOW()
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

-- 4. Secure Round Question Retrieval RPC (Sanitized: NO correct_answer returned)
CREATE OR REPLACE FUNCTION public.get_duel_round_question_rpc(
    p_match_id UUID,
    p_round_number INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_round_type TEXT;
    v_question RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify match and caller participation
    SELECT * INTO v_match FROM public.duel_matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    IF NOT public.check_is_duel_participant(p_match_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not a participant in this match';
    END IF;

    IF p_round_number < 1 OR p_round_number > 5 THEN
        RAISE EXCEPTION 'Invalid round number: %', p_round_number;
    END IF;

    -- Canonical round types
    v_round_type := CASE p_round_number
        WHEN 1 THEN 'QUICK_QUIZ'
        WHEN 2 THEN 'PATTERN'
        WHEN 3 THEN 'MEMORY'
        WHEN 4 THEN 'ACCURACY'
        WHEN 5 THEN 'SPEED'
    END;

    -- Fetch a canonical question for this round type
    SELECT id, round_type, prompt, options, difficulty, time_limit_sec
    INTO v_question
    FROM public.duel_questions
    WHERE round_type = v_round_type
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Question unavailable for round %', p_round_number;
    END IF;

    -- Notice: correct_answer is completely omitted!
    RETURN jsonb_build_object(
        'success', true,
        'round_number', p_round_number,
        'round_type', v_question.round_type,
        'question_id', v_question.id,
        'prompt', v_question.prompt,
        'options', v_question.options,
        'difficulty', v_question.difficulty,
        'time_limit_sec', v_question.time_limit_sec
    );
END;
$$;

-- 5. Server-Authoritative Round Answer Submission
CREATE OR REPLACE FUNCTION public.submit_round_answer_rpc(
    p_match_id UUID,
    p_round_number INT,
    p_round_type TEXT,
    p_question_id TEXT,
    p_response TEXT,
    p_response_time_ms INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_player RECORD;
    v_question RECORD;
    v_expected_round INT;
    v_is_correct BOOLEAN := false;
    v_score_awarded INTEGER := 0;
    v_speed_bonus INTEGER := 0;
    v_new_total_score INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock and verify match
    SELECT * INTO v_match
    FROM public.duel_matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match % not found', p_match_id;
    END IF;

    IF v_match.status NOT IN ('COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION') THEN
        RAISE EXCEPTION 'Match is not in an active playing state (current status: %)', v_match.status;
    END IF;

    -- Verify player is in this match
    SELECT * INTO v_player
    FROM public.duel_players
    WHERE match_id = p_match_id AND player_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller % is not a registered player in match %', v_user_id, p_match_id;
    END IF;

    -- CRITICAL SEQUENCE ENFORCEMENT:
    -- Verify round is submitted in strictly increasing sequential order (1, 2, 3, 4, 5)
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_expected_round
    FROM public.duel_rounds
    WHERE match_id = p_match_id AND player_id = v_user_id;

    IF p_round_number != v_expected_round THEN
        RAISE EXCEPTION 'Round submission out of sequence. Expected round %, received round %', v_expected_round, p_round_number;
    END IF;

    IF p_round_number < 1 OR p_round_number > 5 THEN
        RAISE EXCEPTION 'Invalid round number %. Must be between 1 and 5', p_round_number;
    END IF;

    -- Reject duplicate submission atomically
    IF EXISTS (
        SELECT 1 FROM public.duel_rounds
        WHERE match_id = p_match_id AND round_number = p_round_number AND player_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Round % already submitted for player %', p_round_number, v_user_id;
    END IF;

    -- CRITICAL FIX: Server-Authoritative Question Verification against duel_questions table
    -- REMOVED all fallback behavior: question MUST exist in duel_questions!
    SELECT * INTO v_question
    FROM public.duel_questions
    WHERE id = p_question_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid question_id: % does not exist in authoritative question bank', p_question_id;
    END IF;

    IF v_question.round_type != p_round_type THEN
        RAISE EXCEPTION 'Question round type mismatch: question is % but submission claimed %', v_question.round_type, p_round_type;
    END IF;

    -- CRITICAL FIX: Validate response_time_ms bounds server-side
    IF p_response_time_ms < 50 THEN
        RAISE EXCEPTION 'Response time anomaly: % ms (below human reflex threshold)', p_response_time_ms;
    END IF;

    -- If response exceeded time limit + grace period (5000ms), consider timed out
    IF p_response_time_ms > (v_question.time_limit_sec * 1000 + 5000) THEN
        v_is_correct := false;
        v_score_awarded := 0;
    ELSE
        -- Compare answer strictly server-side
        v_is_correct := (TRIM(LOWER(v_question.correct_answer)) = TRIM(LOWER(COALESCE(p_response, ''))));
        IF v_is_correct THEN
            -- Base 100 pts + up to 50 pts speed bonus
            v_speed_bonus := GREATEST(0, LEAST(50, 50 - FLOOR(p_response_time_ms / 500)::INTEGER));
            v_score_awarded := 100 + v_speed_bonus;
        ELSE
            v_score_awarded := 0;
        END IF;
    END IF;

    -- Record round submission
    INSERT INTO public.duel_rounds (
        match_id, round_number, round_type, player_id, question_id,
        player_response, response_time_ms, is_correct, score_awarded
    ) VALUES (
        p_match_id, p_round_number, p_round_type, v_user_id, p_question_id,
        COALESCE(p_response, 'TIMEOUT'), GREATEST(0, p_response_time_ms), v_is_correct, v_score_awarded
    );

    -- Update player score atomically
    UPDATE public.duel_players
    SET score = score + v_score_awarded,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE id = v_player.id
    RETURNING score INTO v_new_total_score;

    -- Transition match to IN_PROGRESS if in COUNTDOWN
    IF v_match.status = 'COUNTDOWN' THEN
        UPDATE public.duel_matches SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = p_match_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'round_number', p_round_number,
        'is_correct', v_is_correct,
        'score_awarded', v_score_awarded,
        'total_score', v_new_total_score
    );
END;
$$;

-- 6. Server-Authoritative Match Finalization & Winner Determination
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
BEGIN
    -- CRITICAL CHECK 1: Caller must be authenticated
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

    -- CRITICAL CHECK 2: Idempotent return for already completed match
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

    -- CRITICAL CHECK 3: Verify caller is an active participant in this match
    IF NOT public.check_is_duel_participant(p_match_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller % is not a participant in match %', v_user_id, p_match_id;
    END IF;

    -- CRITICAL CHECK 4: Both player slots must exist
    SELECT * INTO v_p1 FROM public.duel_players WHERE match_id = p_match_id AND player_slot = 'PLAYER_1';
    SELECT * INTO v_p2 FROM public.duel_players WHERE match_id = p_match_id AND player_slot = 'PLAYER_2';

    IF v_p1.id IS NULL OR v_p2.id IS NULL THEN
        RAISE EXCEPTION 'Match cannot be finalized: player slots are incomplete';
    END IF;

    -- CRITICAL CHECK 5: Verify required rounds completed before finalization
    SELECT COUNT(*) INTO v_p1_rounds
    FROM public.duel_rounds
    WHERE match_id = p_match_id AND player_id = v_p1.player_id;

    IF v_p1_rounds < 5 THEN
        RAISE EXCEPTION 'Match cannot be finalized: Player 1 has only completed % of 5 rounds', v_p1_rounds;
    END IF;

    IF NOT v_match.is_test_opponent AND v_p2.player_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_p2_rounds
        FROM public.duel_rounds
        WHERE match_id = p_match_id AND player_id = v_p2.player_id;

        IF v_p2_rounds < 5 THEN
            RAISE EXCEPTION 'Match cannot be finalized: Player 2 has only completed % of 5 rounds', v_p2_rounds;
        END IF;
    END IF;

    -- Determine winner authoritatively based on verified total scores
    IF v_p1.score > v_p2.score THEN
        v_winner_id := v_p1.player_id;
        v_p1_result := 'WON';
        v_p2_result := 'LOST';
    ELSIF v_p2.score > v_p1.score THEN
        v_winner_id := v_p2.player_id;
        v_p1_result := 'LOST';
        v_p2_result := 'WON';
    ELSE
        v_winner_id := NULL;
        v_p1_result := 'DRAW';
        v_p2_result := 'DRAW';
    END IF;

    -- Update player results
    UPDATE public.duel_players SET result = v_p1_result, status = 'FINISHED', updated_at = NOW() WHERE id = v_p1.id;
    UPDATE public.duel_players SET result = v_p2_result, status = 'FINISHED', updated_at = NOW() WHERE id = v_p2.id;

    -- Mark match completed
    UPDATE public.duel_matches
    SET status = 'COMPLETED',
        winner_id = v_winner_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_match_id;

    -- Update player stats for human players
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

    -- CRITICAL: Reward 2 promotional game tickets to human winner (Idempotent)
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

-- 7. Safe Cancel Matchmaking & Ticket Refund
CREATE OR REPLACE FUNCTION public.cancel_matchmaking_rpc(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_new_balance INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock and verify match
    SELECT * INTO v_match
    FROM public.duel_matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    IF v_match.status != 'WAITING' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Match is no longer in WAITING queue');
    END IF;

    -- Verify caller is the creator
    IF NOT EXISTS (
        SELECT 1 FROM public.duel_players
        WHERE match_id = p_match_id AND player_id = v_user_id AND player_slot = 'PLAYER_1'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the queue owner';
    END IF;

    UPDATE public.duel_matches
    SET status = 'CANCELLED', updated_at = NOW()
    WHERE id = p_match_id;

    -- Atomically refund 1 Game Ticket with idempotency
    UPDATE public.game_tickets
    SET balance = balance + 1, updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.game_ticket_transactions (
        user_id, amount, balance_after, transaction_type, reference_id, description
    ) VALUES (
        v_user_id, 1, v_new_balance, 'MATCH_REFUND', p_match_id::text, 'Matchmaking Cancelled Ticket Refund'
    ) ON CONFLICT (user_id, transaction_type, reference_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'refunded', true, 'balance', v_new_balance);
END;
$$;

-- 8. Player Heartbeat for Reconnect & Liveness Tracking
CREATE OR REPLACE FUNCTION public.duel_heartbeat_rpc(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NOT NULL THEN
        UPDATE public.duel_players
        SET last_heartbeat_at = NOW(), updated_at = NOW()
        WHERE match_id = p_match_id AND player_id = v_user_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ====================================================================
-- PRIVILEGES & ACCESS CONTROL
-- ====================================================================

-- Explicitly revoke direct client mutations on all authoritative tables
REVOKE INSERT, UPDATE, DELETE ON public.game_tickets FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.game_ticket_transactions FROM authenticated, anon, public;
REVOKE ALL ON public.duel_questions FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.duel_matches FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.duel_players FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.duel_rounds FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.duel_stats FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.duel_events FROM authenticated, anon, public;

-- Grant SELECT only through RLS and public sanitized views
GRANT SELECT ON public.duel_questions_public TO authenticated, anon;
GRANT SELECT ON public.game_tickets TO authenticated;
GRANT SELECT ON public.game_ticket_transactions TO authenticated;
GRANT SELECT ON public.duel_matches TO authenticated;
GRANT SELECT ON public.duel_players TO authenticated;
GRANT SELECT ON public.duel_rounds TO authenticated;
GRANT SELECT ON public.duel_stats TO authenticated, anon;
GRANT SELECT ON public.duel_events TO authenticated;

-- Grant EXECUTE on controlled SECURITY DEFINER RPCs
GRANT EXECUTE ON FUNCTION public.get_game_ticket_balance_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_game_ticket_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_matchmaking_rpc(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_duel_round_question_rpc(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_round_answer_rpc(UUID, INT, TEXT, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_duel_match_rpc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_matchmaking_rpc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duel_heartbeat_rpc(UUID) TO authenticated;
