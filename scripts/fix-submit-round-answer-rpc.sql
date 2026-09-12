-- =====================================================================
-- SURGICAL FIX FOR submit_round_answer_rpc (FOR REVIEW ONLY - DO NOT EXECUTE YET)
-- =====================================================================
-- Issue: When Player 2 joins via join_matchmaking_rpc, duel_matches.status
--        transitions to 'MATCHED'. However, submit_round_answer_rpc previously
--        only permitted ('COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION'),
--        causing round 1 answer submissions to be rejected when match status is 'MATCHED'.
--
-- Fix:
--   1. Allow 'MATCHED' as a valid active playing state alongside
--      'COUNTDOWN', 'IN_PROGRESS', and 'ROUND_TRANSITION'.
--   2. Transition match status to 'IN_PROGRESS' if status is 'MATCHED' or 'COUNTDOWN'
--      upon the first valid round submission.
-- =====================================================================

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

    -- SURGICAL FIX 1: Allow 'MATCHED' alongside active states
    IF v_match.status NOT IN ('MATCHED', 'COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION') THEN
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

    -- Validate response_time_ms bounds server-side
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

    -- SURGICAL FIX 2: Transition match to IN_PROGRESS if in MATCHED or COUNTDOWN
    IF v_match.status IN ('MATCHED', 'COUNTDOWN') THEN
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

GRANT EXECUTE ON FUNCTION public.submit_round_answer_rpc(UUID, INT, TEXT, TEXT, TEXT, INT) TO authenticated;
