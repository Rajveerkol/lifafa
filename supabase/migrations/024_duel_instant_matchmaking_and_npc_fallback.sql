-- ============================================================================
-- Migration 024: Duel Instant Matchmaking & Ramesh Dalle NPC Fallback
-- Status: REVIEW ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ============================================================================
-- Purpose:
-- 1. Schema Enhancement: Add match_type ('PVP', 'NPC_FALLBACK', 'DEV_TEST') to
--    duel_matches and player_type ('HUMAN', 'NPC', 'DEV_TEST') to duel_players.
-- 2. Strict Separation: Production NPC sets match_type = 'NPC_FALLBACK',
--    player_type = 'NPC', npc_id = 'ramesh_dalle', and is_test_opponent = false.
-- 3. Atomic NPC Fallback RPC (fallback_to_npc_match_rpc): Transitions a WAITING
--    match to Ramesh Dalle after 6s timeout, generating a deterministic,
--    match-scoped 5-round behavior plan in match_config->'npc_plan'.
-- 4. Enhanced submit_round_answer_rpc: Executes the pre-determined NPC plan
--    strictly when match_type = 'NPC_FALLBACK' (without per-request random()).
--    Legacy DEV_TEST behavior is preserved separately.
-- 5. Updated finalize_duel_match_rpc: Explicitly recognizes match_type = 'PVP'
--    for 2-player round completion checks. Guarantees 0 tickets if NPC wins,
--    and +2 tickets to human if human wins.
-- 6. Truthful get_games_live_activity_rpc: Reports genuine presence evidence
--    without unverified profile timestamps and without artificial floors (0 is valid).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema Extensions for Clean Identity Separation
-- ----------------------------------------------------------------------------
ALTER TABLE public.duel_matches
ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'PVP'
CHECK (match_type IN ('PVP', 'NPC_FALLBACK', 'DEV_TEST'));

ALTER TABLE public.duel_players
ADD COLUMN IF NOT EXISTS player_type TEXT NOT NULL DEFAULT 'HUMAN'
CHECK (player_type IN ('HUMAN', 'NPC', 'DEV_TEST'));

ALTER TABLE public.duel_players
ADD COLUMN IF NOT EXISTS npc_id TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_duel_matches_type ON public.duel_matches(match_type);
CREATE INDEX IF NOT EXISTS idx_duel_players_type ON public.duel_players(player_type);


-- ----------------------------------------------------------------------------
-- 2. Atomic NPC Fallback RPC with Match-Scoped Deterministic Behavior Plan
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fallback_to_npc_match_rpc(
    p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_p1 RECORD;
    v_round_questions JSONB;
    v_hash TEXT;
    v_seed1 BIGINT;
    v_seed2 BIGINT;
    v_target_wins INT;
    v_loss_round1 INT;
    v_loss_round2 INT;
    v_npc_plan JSONB := '[]'::jsonb;
    v_r INT;
    v_is_correct BOOLEAN;
    v_time_ms INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock match row
    SELECT * INTO v_match
    FROM public.duel_matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match % not found', p_match_id;
    END IF;

    -- Verify caller is Player 1
    SELECT * INTO v_p1
    FROM public.duel_players
    WHERE match_id = p_match_id AND player_slot = 'PLAYER_1' AND player_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller % is not Player 1 of match %', v_user_id, p_match_id;
    END IF;

    -- Concurrency check: If another real player already joined, gracefully return matched state
    IF v_match.status != 'WAITING' THEN
        RETURN jsonb_build_object(
            'success', true,
            'match_id', v_match.id,
            'status', v_match.status,
            'match_type', v_match.match_type,
            'is_test_opponent', v_match.is_test_opponent,
            'note', 'Match already matched with real player or active flow'
        );
    END IF;

    -- Ensure round_questions exists
    IF v_match.round_questions IS NULL OR jsonb_array_length(v_match.round_questions) < 5 THEN
        v_round_questions := public.select_duel_match_questions(v_user_id, NULL);
    ELSE
        v_round_questions := v_match.round_questions;
    END IF;

    -- Generate match-scoped deterministic NPC behavior plan
    v_hash := md5(p_match_id::text || '_ramesh_dalle_plan');
    v_seed1 := ('x' || substring(v_hash from 1 for 8))::bit(32)::bigint;
    v_seed2 := ('x' || substring(v_hash from 9 for 8))::bit(32)::bigint;

    -- Natural challenger win curve: 3 or 4 rounds correct out of 5 (60% to 80%)
    v_target_wins := 3 + (v_seed1 % 2); -- either 3 or 4
    v_loss_round1 := 1 + (v_seed2 % 5); -- first loss round (1..5)
    v_loss_round2 := 1 + ((v_seed2 / 5) % 5); -- second loss round (if target_wins = 3)
    IF v_loss_round2 = v_loss_round1 THEN
        v_loss_round2 := (v_loss_round1 % 5) + 1;
    END IF;

    FOR v_r IN 1..5 LOOP
        IF v_target_wins = 4 THEN
            v_is_correct := (v_r != v_loss_round1);
        ELSE
            v_is_correct := (v_r != v_loss_round1 AND v_r != v_loss_round2);
        END IF;

        -- Category-realistic reaction times
        CASE v_r
            WHEN 1 THEN -- QUICK_QUIZ
                v_time_ms := 2200 + ((v_seed1 + v_r * 313) % 1400); -- 2200..3600ms
            WHEN 2 THEN -- PATTERN
                v_time_ms := 2600 + ((v_seed2 + v_r * 419) % 1500); -- 2600..4100ms
            WHEN 3 THEN -- MEMORY
                v_time_ms := 3100 + ((v_seed1 + v_r * 521) % 1600); -- 3100..4700ms
            WHEN 4 THEN -- ACCURACY
                v_time_ms := 2400 + ((v_seed2 + v_r * 631) % 1400); -- 2400..3800ms
            WHEN 5 THEN -- SPEED
                v_time_ms := 1500 + ((v_seed1 + v_r * 743) % 1100); -- 1500..2600ms
        END CASE;

        v_npc_plan := v_npc_plan || jsonb_build_object(
            'round_number', v_r,
            'is_correct', v_is_correct,
            'response_time_ms', v_time_ms
        );
    END LOOP;

    -- Update duel_matches with clean match_type and authoritative NPC behavior plan
    -- STRICT: is_test_opponent is set to FALSE for production NPC
    UPDATE public.duel_matches
    SET status = 'MATCHED',
        match_type = 'NPC_FALLBACK',
        is_test_opponent = false,
        round_questions = v_round_questions,
        match_config = jsonb_set(COALESCE(match_config, '{}'::jsonb), '{npc_plan}', v_npc_plan),
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_match_id;

    -- Update Player 1 to READY
    UPDATE public.duel_players
    SET status = 'READY',
        player_type = 'HUMAN',
        is_test_opponent = false,
        updated_at = NOW()
    WHERE match_id = p_match_id AND player_slot = 'PLAYER_1';

    -- Insert Player 2 as Ramesh Dalle (player_id = NULL, player_type = 'NPC', is_test_opponent = false)
    INSERT INTO public.duel_players (
        match_id, player_id, player_slot, player_type, npc_id, status, display_name, avatar_url, is_test_opponent, score
    ) VALUES (
        p_match_id, NULL, 'PLAYER_2', 'NPC', 'ramesh_dalle', 'READY', 'Ramesh Dalle', NULL, false, 0
    ) ON CONFLICT (match_id, player_slot) DO UPDATE
    SET display_name = 'Ramesh Dalle',
        player_id = NULL,
        player_type = 'NPC',
        npc_id = 'ramesh_dalle',
        is_test_opponent = false,
        status = 'READY',
        score = 0,
        updated_at = NOW();

    -- Audit event
    INSERT INTO public.duel_events (match_id, player_id, event_type, payload)
    VALUES (p_match_id, v_user_id, 'NPC_FALLBACK_MATCHED', jsonb_build_object(
        'opponent_name', 'Ramesh Dalle',
        'match_type', 'NPC_FALLBACK',
        'slot', 'PLAYER_2'
    ));

    RETURN jsonb_build_object(
        'success', true,
        'match_id', p_match_id,
        'player_slot', 'PLAYER_1',
        'status', 'MATCHED',
        'match_type', 'NPC_FALLBACK',
        'is_test_opponent', false,
        'opponent_name', 'Ramesh Dalle'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fallback_to_npc_match_rpc(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. Enhanced submit_round_answer_rpc with Strict Branch Separation
-- ----------------------------------------------------------------------------
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

    -- Deterministic NPC Round Plan Variables
    v_npc_round_plan JSONB;
    v_npc_correct BOOLEAN := false;
    v_npc_response_time_ms INTEGER := 0;
    v_npc_speed_bonus INTEGER := 0;
    v_npc_score INTEGER := 0;
    v_npc_new_total_score INTEGER := 0;
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

    IF v_match.status NOT IN ('MATCHED', 'COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION') THEN
        RAISE EXCEPTION 'Match is not in an active playing state (current status: %)', v_match.status;
    END IF;

    IF v_match.status IN ('MATCHED', 'COUNTDOWN') THEN
        UPDATE public.duel_matches
        SET status = 'IN_PROGRESS', updated_at = NOW()
        WHERE id = p_match_id;
    END IF;

    -- Verify player
    SELECT * INTO v_player
    FROM public.duel_players
    WHERE match_id = p_match_id AND player_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caller % is not a registered player in match %', v_user_id, p_match_id;
    END IF;

    -- Sequential round check
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_expected_round
    FROM public.duel_rounds
    WHERE match_id = p_match_id AND player_id = v_user_id;

    IF p_round_number != v_expected_round THEN
        RAISE EXCEPTION 'Round submission out of sequence. Expected round %, received round %', v_expected_round, p_round_number;
    END IF;

    IF p_round_number < 1 OR p_round_number > 5 THEN
        RAISE EXCEPTION 'Invalid round number %. Must be between 1 and 5', p_round_number;
    END IF;

    -- Duplicate submission guard
    IF EXISTS (
        SELECT 1 FROM public.duel_rounds
        WHERE match_id = p_match_id AND round_number = p_round_number AND player_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Round % already submitted for player %', p_round_number, v_user_id;
    END IF;

    -- Validate question against match roster
    IF v_match.round_questions IS NOT NULL AND jsonb_array_length(v_match.round_questions) >= p_round_number THEN
        IF p_question_id != (v_match.round_questions->>(p_round_number - 1)) THEN
            RAISE EXCEPTION 'Submitted question % does not match assigned question for round %', p_question_id, p_round_number;
        END IF;
    END IF;

    -- Authoritative Question Verification
    SELECT * INTO v_question
    FROM public.duel_questions
    WHERE id = p_question_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid question_id: % does not exist in authoritative question bank', p_question_id;
    END IF;

    IF v_question.round_type != p_round_type THEN
        RAISE EXCEPTION 'Question round type mismatch: question is % but submission claimed %', v_question.round_type, p_round_type;
    END IF;

    IF p_response_time_ms < 50 THEN
        RAISE EXCEPTION 'Response time anomaly: % ms (below human reflex threshold)', p_response_time_ms;
    END IF;

    -- Human score calculation
    IF p_response_time_ms > (v_question.time_limit_sec * 1000 + 5000) THEN
        v_is_correct := false;
        v_score_awarded := 0;
    ELSE
        v_is_correct := (TRIM(LOWER(v_question.correct_answer)) = TRIM(LOWER(COALESCE(p_response, ''))));
        IF v_is_correct THEN
            v_speed_bonus := GREATEST(0, LEAST(50, 50 - FLOOR(p_response_time_ms / 500)::INTEGER));
            v_score_awarded := 100 + v_speed_bonus;
        ELSE
            v_score_awarded := 0;
        END IF;
    END IF;

    -- Record round submission for human
    INSERT INTO public.duel_rounds (
        match_id, round_number, round_type, player_id, question_id,
        player_response, response_time_ms, is_correct, score_awarded
    ) VALUES (
        p_match_id, p_round_number, p_round_type, v_user_id, p_question_id,
        COALESCE(p_response, 'TIMEOUT'), GREATEST(0, p_response_time_ms), v_is_correct, v_score_awarded
    );

    -- Record question exposure
    INSERT INTO public.duel_question_exposures (
        user_id, question_id, match_id, exposed_at
    ) VALUES (
        v_user_id, p_question_id, p_match_id, NOW()
    ) ON CONFLICT (user_id, match_id, question_id) DO NOTHING;

    -- Update human score
    UPDATE public.duel_players
    SET score = score + v_score_awarded,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE match_id = p_match_id AND player_id = v_user_id
    RETURNING score INTO v_new_total_score;

    -- ------------------------------------------------------------------------
    -- BRANCH A: PRODUCTION NPC (Ramesh Dalle)
    -- STRICT REQUIREMENT: Triggers ONLY when match_type = 'NPC_FALLBACK'
    -- ------------------------------------------------------------------------
    IF v_match.match_type = 'NPC_FALLBACK' THEN
        v_npc_round_plan := v_match.match_config->'npc_plan'->(p_round_number - 1);

        IF v_npc_round_plan IS NOT NULL THEN
            v_npc_correct := COALESCE((v_npc_round_plan->>'is_correct')::boolean, false);
            v_npc_response_time_ms := COALESCE((v_npc_round_plan->>'response_time_ms')::integer, 2500);
        ELSE
            v_npc_correct := true;
            v_npc_response_time_ms := 2800;
        END IF;

        IF v_npc_correct THEN
            v_npc_speed_bonus := GREATEST(0, LEAST(50, 50 - FLOOR(v_npc_response_time_ms / 500)::INTEGER));
            v_npc_score := 100 + v_npc_speed_bonus;
        ELSE
            v_npc_score := 0;
        END IF;

        -- Update Ramesh Dalle score atomically
        UPDATE public.duel_players
        SET score = score + v_npc_score,
            last_heartbeat_at = NOW(),
            updated_at = NOW()
        WHERE match_id = p_match_id AND player_slot = 'PLAYER_2'
        RETURNING score INTO v_npc_new_total_score;

        -- Advance match state
        IF p_round_number < 5 THEN
            UPDATE public.duel_matches
            SET current_round = p_round_number + 1,
                status = 'ROUND_TRANSITION',
                updated_at = NOW()
            WHERE id = p_match_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'round_number', p_round_number,
            'is_correct', v_is_correct,
            'score_awarded', v_score_awarded,
            'total_score', v_new_total_score,
            'opponent_round_score', v_npc_score,
            'opponent_total_score', v_npc_new_total_score,
            'opponent_response_time_ms', v_npc_response_time_ms
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- BRANCH B: LEGACY DEV_TEST (Vortex sandbox bypass)
    -- Preserves existing developer test behavior without touching NPC logic
    -- ------------------------------------------------------------------------
    IF v_match.match_type = 'DEV_TEST' OR v_match.is_test_opponent THEN
        IF p_round_number < 5 THEN
            UPDATE public.duel_matches
            SET current_round = p_round_number + 1,
                status = 'ROUND_TRANSITION',
                updated_at = NOW()
            WHERE id = p_match_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'round_number', p_round_number,
            'is_correct', v_is_correct,
            'score_awarded', v_score_awarded,
            'total_score', v_new_total_score
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- BRANCH C: REAL 2-PLAYER MATCH
    -- ------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 4. Updated finalize_duel_match_rpc with Explicit match_type Recognition
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
    IF v_match.match_type = 'PVP' AND NOT v_match.is_test_opponent AND v_p2.player_id IS NOT NULL THEN
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
        v_winner_id := v_p2.player_id; -- NULL for Ramesh Dalle
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

    -- Reward 2 promotional game tickets to human winner (Idempotent)
    -- If NPC wins, v_winner_id is NULL, so ZERO tickets are awarded
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

GRANT EXECUTE ON FUNCTION public.finalize_duel_match_rpc(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. Truthful Games Live Activity Metrics RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_games_live_activity_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_currently_playing INTEGER := 0;
    v_matches_today INTEGER := 0;
    v_players_online INTEGER := 0;
BEGIN
    -- 1. Currently Playing: Distinct real human players with active heartbeat or update in an active match
    SELECT COUNT(DISTINCT dp.player_id) INTO v_currently_playing
    FROM public.duel_players dp
    JOIN public.duel_matches dm ON dm.id = dp.match_id
    WHERE dp.player_id IS NOT NULL
      AND dm.status IN ('WAITING', 'MATCHED', 'COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION')
      AND (dp.last_heartbeat_at >= NOW() - INTERVAL '60 seconds' OR dm.updated_at >= NOW() - INTERVAL '60 seconds');

    -- 2. Matches Today: Actual matches created today since midnight UTC
    SELECT COUNT(*) INTO v_matches_today
    FROM public.duel_matches
    WHERE created_at >= date_trunc('day', NOW());

    -- 3. Players Online: Users with genuine recent presence evidence
    -- Evidence: real players active in matches (last 5 min) OR users with recent login (last 15 min).
    -- Unverified profile modification timestamps are STRICTLY EXCLUDED. Zero is fully valid if no activity.
    SELECT COUNT(DISTINCT u.id) INTO v_players_online
    FROM (
        SELECT dp.player_id AS id
        FROM public.duel_players dp
        WHERE dp.player_id IS NOT NULL
          AND dp.last_heartbeat_at >= NOW() - INTERVAL '5 minutes'
        UNION
        SELECT p.id
        FROM public.profiles p
        WHERE p.last_login_at >= NOW() - INTERVAL '15 minutes'
    ) u;

    RETURN jsonb_build_object(
        'success', true,
        'currently_playing', COALESCE(v_currently_playing, 0),
        'matches_today', COALESCE(v_matches_today, 0),
        'players_online', COALESCE(v_players_online, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_games_live_activity_rpc() TO anon, authenticated;
