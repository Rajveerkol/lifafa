# Production Architecture Specification: Duel Anti-Repeat & Question Selection Engine

## 1. Executive Summary

In head-to-head 1v1 duels ("DUEL EARN"), repeating the same question patterns degrades user experience, rewards memorization over skill, and creates competitive imbalance. This specification defines the server-authoritative question selection and anti-repeat architecture designed to power the 1,000+ question bank without requiring database modifications in Migration 022.

---

## 2. Core Architecture Requirements

1. **Deterministic Match Fairness**: In any 1v1 duel, both Player 1 and Player 2 must receive the **identical question** for a given round number so scoring and response-time metrics are 100% fair.
2. **Sliding-Window Anti-Repeat**: Neither player should receive questions they have recently answered within a configurable window (e.g., last 50 questions or 48 hours).
3. **Zero Frontend Answer Exposure**: The `correct_answer` column and validation logic must remain exclusively inside `SECURITY DEFINER` server functions with strict `search_path = public, pg_temp`.
4. **High-Performance Scalability**: Avoid costly table-wide `ORDER BY RANDOM()` scans across thousands of questions; utilize indexed reservoir sampling and exposure exclusions.

---

## 3. Database Schema Design (For Future Migration 023)

```sql
-- 1. Exposure tracking table to record every question served to every user
CREATE TABLE IF NOT EXISTS public.duel_question_exposures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES public.duel_questions(id) ON DELETE CASCADE,
    round_type TEXT NOT NULL CHECK (round_type IN ('QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED')),
    match_id UUID NOT NULL REFERENCES public.duel_matches(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 5),
    served_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Fast lookup of a user's recently served questions
CREATE INDEX IF NOT EXISTS idx_duel_exposures_user_recent 
    ON public.duel_question_exposures(user_id, served_at DESC);

-- Fast exclusion join during question selection
CREATE INDEX IF NOT EXISTS idx_duel_exposures_user_question 
    ON public.duel_question_exposures(user_id, question_id);

-- Match-level audit
CREATE INDEX IF NOT EXISTS idx_duel_exposures_match 
    ON public.duel_question_exposures(match_id, round_number);
```

---

## 4. Match-Level Question Assignment (Fair Play)

To prevent Player 1 and Player 2 from getting different questions in the same round, question assignment occurs at the **match level**:

```
Match Creation / Matchmaking Paired
               │
               ▼
[select_match_questions_rpc(p_match_id)]
   ├── Round 1 (QUICK_QUIZ): Exclude recent P1 & P2 exposures → Pick Q_A
   ├── Round 2 (PATTERN):    Exclude recent P1 & P2 exposures → Pick Q_B
   ├── Round 3 (MEMORY):     Exclude recent P1 & P2 exposures → Pick Q_C
   ├── Round 4 (ACCURACY):   Exclude recent P1 & P2 exposures → Pick Q_D
   └── Round 5 (SPEED):      Exclude recent P1 & P2 exposures → Pick Q_E
               │
               ▼
Stored in duel_matches.match_config -> 'assigned_questions': { '1': 'q_qq_042', ... }
               │
               ▼
When P1 or P2 calls get_active_duel_round_rpc(p_match_id, round_number):
   - Reads the pre-assigned question_id from match_config
   - Returns { id, round_type, prompt, options, difficulty, time_limit_sec }
   - DOES NOT RETURN correct_answer
   - Logs entry to duel_question_exposures for the caller
```

---

## 5. Server-Side Selection Algorithm (Anti-Repeat Logic)

```sql
CREATE OR REPLACE FUNCTION public.select_eligible_question_for_round(
    p_round_type TEXT,
    p_player_1_id UUID,
    p_player_2_id UUID DEFAULT NULL,
    p_exclusion_limit INTEGER DEFAULT 50
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_question_id TEXT;
BEGIN
    -- 1. Try to select a question that NEITHER player has seen in their last p_exclusion_limit exposures
    WITH recent_exposures AS (
        SELECT DISTINCT question_id
        FROM public.duel_question_exposures
        WHERE user_id IN (p_player_1_id, COALESCE(p_player_2_id, p_player_1_id))
          AND served_at > NOW() - INTERVAL '7 days'
        ORDER BY served_at DESC
        LIMIT (p_exclusion_limit * 2)
    ),
    eligible_questions AS (
        SELECT id
        FROM public.duel_questions q
        WHERE q.round_type = p_round_type
          AND q.id NOT IN (SELECT question_id FROM recent_exposures)
    )
    SELECT id INTO v_question_id
    FROM eligible_questions
    ORDER BY random()
    LIMIT 1;

    -- 2. Fallback: If pool is exhausted (e.g. power user), pick the least-recently-seen question
    IF v_question_id IS NULL THEN
        SELECT q.id INTO v_question_id
        FROM public.duel_questions q
        LEFT JOIN public.duel_question_exposures e 
            ON q.id = e.question_id 
           AND e.user_id = p_player_1_id
        WHERE q.round_type = p_round_type
        GROUP BY q.id
        ORDER BY MAX(e.served_at) NULLS FIRST, random()
        LIMIT 1;
    END IF;

    RETURN v_question_id;
END;
$$;
```

---

## 6. Security Guarantees Preserved

1. **Server-Authoritative Evaluation**:
   - `submit_round_answer_rpc` compares `player_response` directly against `public.duel_questions.correct_answer`.
   - The client never has access to `correct_answer`, hash digests, or option indices.
2. **Idempotency & Tamper Prevention**:
   - `duel_rounds` enforces a unique constraint on `(match_id, round_number, player_id)`.
   - Players cannot submit multiple answers or overwrite past responses.
3. **Round Progression Enforced**:
   - Current round must match `duel_matches.current_round`.
   - Players cannot jump to future questions or re-submit expired rounds.
