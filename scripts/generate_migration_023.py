import json
import os

DATA_FILE = 'scripts/data/duel-question-bank.json'
OUT_FILE = 'supabase/migrations/023_duel_question_bank_and_anti_repeat.sql'

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    questions = json.load(f)

print(f'Loaded {len(questions)} questions from {DATA_FILE}')

def sql_escape(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

def sql_escape_json(obj):
    json_str = json.dumps(obj, ensure_ascii=False)
    return "'" + json_str.replace("'", "''") + "'::jsonb"

header = """-- ====================================================================
-- Migration 023: Production Question Bank & Anti-Repeat Architecture
-- Phase 3 Foundation: 1,148-Question Authoritative Master Bank,
-- Synchronized 1v1 Match Question Assignment, 20-Match Sliding-Window
-- Exposure Tracking, Server-Only Answer Security, and MATCHED State Preservation.
--
-- STRICT ISOLATION & COMPATIBILITY NOTICE:
-- 1. Migrations 001-022 remain 100% untouched and preserved.
-- 2. Wallets, Ticket Conversions, Withdrawals, Lifafa Escrow, and PayRupee are 100% untouched.
-- 3. Historical duel_rounds foreign key integrity is preserved (Existing 12 questions remain).
-- 4. Correct answers remain strictly server-only; zero leakage to client views or RPCs.
-- 5. MATCHED -> IN_PROGRESS hotfix is formalized and preserved.
-- ====================================================================

-- 1. Schema Expansion for public.duel_questions
ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS pattern_type TEXT;
ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS explanation TEXT;

-- Update existing 12 questions with appropriate metadata
UPDATE public.duel_questions SET
    category = COALESCE(category, 'General'),
    subcategory = COALESCE(subcategory, round_type),
    pattern_type = COALESCE(pattern_type, 'Standard'),
    explanation = COALESCE(explanation, 'Authoritative answer verified by platform engine.')
WHERE category IS NULL;

-- 2. Update Sanitized Public View for Questions
-- Strictly EXCLUDES correct_answer and explanation
DROP VIEW IF EXISTS public.duel_questions_public CASCADE;
CREATE VIEW public.duel_questions_public AS
SELECT
    id,
    round_type,
    prompt,
    options,
    difficulty,
    time_limit_sec,
    category,
    subcategory,
    created_at
FROM public.duel_questions;

REVOKE ALL ON public.duel_questions_public FROM public, anon, authenticated;
GRANT SELECT ON public.duel_questions_public TO authenticated, anon;


-- 3. Add Authoritative Match-Level Question Roster to duel_matches
-- Stores exactly 5 question IDs [q_r1, q_r2, q_r3, q_r4, q_r5] assigned to the match.
-- Both Player A and Player B receive the exact same assigned questions.
ALTER TABLE public.duel_matches ADD COLUMN IF NOT EXISTS round_questions JSONB DEFAULT NULL;


-- 4. Anti-Repeat Question Exposure Ledger Table
-- Tracks question exposures per user to enforce the 20-match sliding-window exclusion.
CREATE TABLE IF NOT EXISTS public.duel_question_exposures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES public.duel_questions(id) ON DELETE RESTRICT,
    match_id UUID NOT NULL REFERENCES public.duel_matches(id) ON DELETE CASCADE,
    exposed_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT uq_user_match_question UNIQUE (user_id, match_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_duel_question_exposures_user_time 
    ON public.duel_question_exposures(user_id, exposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_duel_question_exposures_match 
    ON public.duel_question_exposures(match_id);
CREATE INDEX IF NOT EXISTS idx_duel_question_exposures_q 
    ON public.duel_question_exposures(question_id);

-- Enable RLS on exposure tracking (Users can only inspect their own history)
ALTER TABLE public.duel_question_exposures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own question exposures" ON public.duel_question_exposures;
CREATE POLICY "Users view own question exposures"
    ON public.duel_question_exposures FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.duel_question_exposures FROM authenticated, anon, public;
GRANT SELECT ON public.duel_question_exposures TO authenticated;


-- 5. Authoritative Match Question Selection Engine (Anti-Repeat Sliding Window)
-- Selects 5 questions (1 per round) excluding questions seen by participating players
-- in their last 20 matches. Includes fallback reservoir sampling if candidate pool is depleted.
CREATE OR REPLACE FUNCTION public.select_duel_match_questions(
    p_user_a UUID,
    p_user_b UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rounds TEXT[] := ARRAY['QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED'];
    v_round_type TEXT;
    v_selected_ids TEXT[] := ARRAY[]::TEXT[];
    v_qid TEXT;
    v_excluded_ids TEXT[];
BEGIN
    -- Gather questions exposed to player A or player B within their last 20 matches
    WITH recent_matches_a AS (
        SELECT DISTINCT match_id, exposed_at
        FROM public.duel_question_exposures
        WHERE user_id = p_user_a
        ORDER BY exposed_at DESC
        LIMIT 20
    ),
    recent_matches_b AS (
        SELECT DISTINCT match_id, exposed_at
        FROM public.duel_question_exposures
        WHERE p_user_b IS NOT NULL AND user_id = p_user_b
        ORDER BY exposed_at DESC
        LIMIT 20
    ),
    excluded AS (
        SELECT question_id FROM public.duel_question_exposures
        WHERE user_id = p_user_a AND match_id IN (SELECT match_id FROM recent_matches_a)
        UNION
        SELECT question_id FROM public.duel_question_exposures
        WHERE p_user_b IS NOT NULL AND user_id = p_user_b AND match_id IN (SELECT match_id FROM recent_matches_b)
    )
    SELECT ARRAY_AGG(question_id) INTO v_excluded_ids FROM excluded;

    IF v_excluded_ids IS NULL THEN
        v_excluded_ids := ARRAY[]::TEXT[];
    END IF;

    -- Pick 1 authoritative question for each of the 5 battle rounds
    FOREACH v_round_type IN ARRAY v_rounds
    LOOP
        -- Primary attempt: select random question excluding recent exposures
        SELECT id INTO v_qid
        FROM public.duel_questions
        WHERE round_type = v_round_type
          AND NOT (id = ANY(v_excluded_ids))
        ORDER BY random()
        LIMIT 1;

        -- Fallback reservoir: if exhausted, pick any question from round pool
        IF v_qid IS NULL THEN
            SELECT id INTO v_qid
            FROM public.duel_questions
            WHERE round_type = v_round_type
            ORDER BY random()
            LIMIT 1;
        END IF;

        IF v_qid IS NOT NULL THEN
            v_selected_ids := ARRAY_APPEND(v_selected_ids, v_qid);
        END IF;
    END LOOP;

    RETURN to_jsonb(v_selected_ids);
END;
$$;


-- 6. Updated join_matchmaking_rpc
-- Authoritatively selects 5 questions when match is formed, applying the 20-match
-- anti-repeat window for both players, and saves round_questions to duel_matches.
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

    -- Initialize with 0 tickets if new user (no promotional ticket grant)
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

    -- Test Opponent branch (immediate 1-player match with AI)
    IF p_allow_test_opponent THEN
        UPDATE public.game_tickets
        SET balance = balance - 1, updated_at = NOW()
        WHERE user_id = v_user_id;

        v_round_questions := public.select_duel_match_questions(v_user_id, NULL);

        INSERT INTO public.duel_matches (
            status, current_round, is_test_opponent, round_questions, started_at
        ) VALUES (
            'MATCHED', 1, true, v_round_questions, NOW()
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
        status, current_round, is_test_opponent, round_questions
    ) VALUES (
        'WAITING', 1, false, v_round_questions
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


-- 7. Updated get_duel_round_question_rpc
-- Strictly retrieves the pre-assigned authoritative question from duel_matches.round_questions.
-- Guaranteed identical question for Player A and Player B. Zero answer leakage.
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
    v_question_id TEXT;
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

    -- Canonical round sequence
    v_round_type := CASE p_round_number
        WHEN 1 THEN 'QUICK_QUIZ'
        WHEN 2 THEN 'PATTERN'
        WHEN 3 THEN 'MEMORY'
        WHEN 4 THEN 'ACCURACY'
        WHEN 5 THEN 'SPEED'
    END;

    -- Retrieve authoritative assigned question ID from match roster
    IF v_match.round_questions IS NOT NULL AND jsonb_array_length(v_match.round_questions) >= p_round_number THEN
        v_question_id := v_match.round_questions->>(p_round_number - 1);
    END IF;

    -- Fetch question details
    IF v_question_id IS NOT NULL THEN
        SELECT id, round_type, prompt, options, difficulty, time_limit_sec, category, subcategory
        INTO v_question
        FROM public.duel_questions
        WHERE id = v_question_id;
    END IF;

    -- Fallback safety (for legacy matches created prior to Migration 023)
    IF v_question.id IS NULL THEN
        SELECT id, round_type, prompt, options, difficulty, time_limit_sec, category, subcategory
        INTO v_question
        FROM public.duel_questions
        WHERE round_type = v_round_type
        LIMIT 1;
    END IF;

    IF v_question.id IS NULL THEN
        RAISE EXCEPTION 'Question unavailable for round %', p_round_number;
    END IF;

    -- Notice: correct_answer and explanation are strictly shielded from client response
    RETURN jsonb_build_object(
        'success', true,
        'round_number', p_round_number,
        'round_type', v_question.round_type,
        'question_id', v_question.id,
        'prompt', v_question.prompt,
        'options', v_question.options,
        'difficulty', v_question.difficulty,
        'time_limit_sec', v_question.time_limit_sec,
        'category', v_question.category,
        'subcategory', v_question.subcategory
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_duel_round_question_rpc(UUID, INT) TO authenticated;


-- 8. Updated submit_round_answer_rpc
-- Preserves MATCHED -> IN_PROGRESS transition, validates submitted question against
-- match roster, scores answer server-side, and records exposure in duel_question_exposures.
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

    -- Formalize & preserve MATCHED alongside active playing states
    IF v_match.status NOT IN ('MATCHED', 'COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION') THEN
        RAISE EXCEPTION 'Match is not in an active playing state (current status: %)', v_match.status;
    END IF;

    -- Transition MATCHED or COUNTDOWN to IN_PROGRESS upon valid submission
    IF v_match.status IN ('MATCHED', 'COUNTDOWN') THEN
        UPDATE public.duel_matches
        SET status = 'IN_PROGRESS', updated_at = NOW()
        WHERE id = p_match_id;
    END IF;

    -- Verify player is in this match
    SELECT * INTO v_player
    FROM public.duel_players
    WHERE match_id = p_match_id AND player_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller % is not a registered player in match %', v_user_id, p_match_id;
    END IF;

    -- Sequential round enforcement (1 -> 2 -> 3 -> 4 -> 5)
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

    -- Validate question against match roster if available
    IF v_match.round_questions IS NOT NULL AND jsonb_array_length(v_match.round_questions) >= p_round_number THEN
        IF p_question_id != (v_match.round_questions->>(p_round_number - 1)) THEN
            RAISE EXCEPTION 'Submitted question % does not match assigned question for round %', p_question_id, p_round_number;
        END IF;
    END IF;

    -- Server-Authoritative Question Verification against duel_questions table
    SELECT * INTO v_question
    FROM public.duel_questions
    WHERE id = p_question_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid question_id: % does not exist in authoritative question bank', p_question_id;
    END IF;

    IF v_question.round_type != p_round_type THEN
        RAISE EXCEPTION 'Question round type mismatch: question is % but submission claimed %', v_question.round_type, p_round_type;
    END IF;

    -- Validate response_time_ms bounds (reflex threshold >= 50ms)
    IF p_response_time_ms < 50 THEN
        RAISE EXCEPTION 'Response time anomaly: % ms (below human reflex threshold)', p_response_time_ms;
    END IF;

    -- Score calculation with 5000ms timeout grace period
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

    -- Record question exposure for anti-repeat tracking (idempotent)
    INSERT INTO public.duel_question_exposures (
        user_id, question_id, match_id, exposed_at
    ) VALUES (
        v_user_id, p_question_id, p_match_id, NOW()
    ) ON CONFLICT (user_id, match_id, question_id) DO NOTHING;

    -- Update player score atomically
    UPDATE public.duel_players
    SET score = score + v_score_awarded,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE match_id = p_match_id AND player_id = v_user_id
    RETURNING score INTO v_new_total_score;

    -- Advance match round if both players completed current round
    IF (
        SELECT COUNT(*) FROM public.duel_rounds
        WHERE match_id = p_match_id AND round_number = p_round_number
    ) = 2 THEN
        IF p_round_number < 5 THEN
            UPDATE public.duel_matches
            SET current_round = p_round_number + 1,
                status = 'ROUND_TRANSITION',
                updated_at = NOW()
            WHERE id = p_match_id;
        END IF;
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

GRANT EXECUTE ON FUNCTION public.submit_round_answer_rpc(UUID, INT, TEXT, TEXT, TEXT, INT) TO authenticated;


-- 9. Import Authoritative 1,148-Question Master Bank
-- Non-destructive bulk upsert preserving existing historical question IDs.
INSERT INTO public.duel_questions (
    id, round_type, prompt, options, correct_answer, difficulty, time_limit_sec, category, subcategory, pattern_type, explanation
) VALUES
"""

# Format questions into SQL VALUES
value_rows = []
for q in questions:
    val = (
        f"({sql_escape(q['id'])}, "
        f"{sql_escape(q['round_type'])}, "
        f"{sql_escape(q['prompt'])}, "
        f"{sql_escape_json(q['options'])}, "
        f"{sql_escape(q['correct_answer'])}, "
        f"{sql_escape(q['difficulty'])}, "
        f"{int(q.get('time_limit_sec', q.get('time_limit_seconds', 25)))}, "
        f"{sql_escape(q.get('category', 'General'))}, "
        f"{sql_escape(q.get('subcategory', q['round_type']))}, "
        f"{sql_escape(q.get('pattern_type', 'Standard'))}, "
        f"{sql_escape(q.get('explanation', ''))})"
    )
    value_rows.append(val)

footer = """
ON CONFLICT (id) DO UPDATE SET
    round_type = EXCLUDED.round_type,
    prompt = EXCLUDED.prompt,
    options = EXCLUDED.options,
    correct_answer = EXCLUDED.correct_answer,
    difficulty = EXCLUDED.difficulty,
    time_limit_sec = EXCLUDED.time_limit_sec,
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    pattern_type = EXCLUDED.pattern_type,
    explanation = EXCLUDED.explanation;

-- ====================================================================
-- End of Migration 023
-- ====================================================================
"""

full_sql = header + ",\n".join(value_rows) + footer

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(full_sql)

print(f'Successfully generated {OUT_FILE} ({os.path.getsize(OUT_FILE)} bytes)')
