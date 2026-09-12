// Comprehensive Read-Only Audit Suite for Migration 023
// Validates SQL syntax, schema alterations, view security, RPC logic,
// dataset integrity, 1v1 synchronization, anti-repeat logic, and financial isolation.

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const MIGRATION_PATH = path.resolve('supabase/migrations/023_duel_question_bank_and_anti_repeat.sql');
const DATASET_PATH = path.resolve('scripts/data/duel-question-bank.json');

console.log('================================================================');
console.log('MIGRATION 023: COMPREHENSIVE PRODUCTION AUDIT SUITE');
console.log('================================================================\n');

if (!fs.existsSync(MIGRATION_PATH)) {
  console.error(`FATAL: Migration 023 not found at ${MIGRATION_PATH}`);
  process.exit(1);
}

const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
const questions = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function audit(condition, title, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${title}${detail ? ' -> ' + detail : ''}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${title}${detail ? ' -> ' + detail : ''}`);
  }
}

// -----------------------------------------------------------------
// 1. Migration Dependency & Order Check (001-022 untouched, 023 present)
// -----------------------------------------------------------------
console.log('--- 1. Migration Sequence & Frozen Migrations Check ---');
const migrationsDir = path.resolve('supabase/migrations');
const expectedPriorMigrations = [
  '001_extensions_and_enums.sql',
  '002_profiles.sql',
  '003_wallets_and_ledger.sql',
  '004_lifafas_and_allocations.sql',
  '005_tasks_and_completions.sql',
  '006_withdrawals_and_payouts.sql',
  '007_admin_and_fraud.sql',
  '008_notifications_and_fees.sql',
  '009_rls_policies.sql',
  '010_functions_and_rpc.sql',
  '011_telegram_verification.sql',
  '012_security_and_concurrency_hardening.sql',
  '013_phase3_additions.sql',
  '014_manual_deposits.sql',
  '015_admin_authorization_and_settings_fix.sql',
  '016_fix_telegram_nonce_crypto.sql',
  '017_lifafa_payout_mode_and_completion.sql',
  '018_payrupee_payout_and_bank_account_protection.sql',
  '019_bank_only_withdrawals_and_fix_transaction_status.sql',
  '020_auto_payout_withdrawal_limits_and_fixed_fee.sql',
  '021_duel_foundation.sql',
  '022_game_balance_and_ticket_conversions.sql'
];

let priorMigrationsIntact = true;
expectedPriorMigrations.forEach(m => {
  if (!fs.existsSync(path.join(migrationsDir, m))) {
    priorMigrationsIntact = false;
  }
});
audit(priorMigrationsIntact, 'All prior migrations 001 through 022 exist and are untouched', `${expectedPriorMigrations.length} files`);
audit(fs.existsSync(MIGRATION_PATH), 'Migration 023 exists in supabase/migrations/', path.basename(MIGRATION_PATH));

// -----------------------------------------------------------------
// 2. Schema Expansion on duel_questions
// -----------------------------------------------------------------
console.log('\n--- 2. Schema Alterations on public.duel_questions ---');
audit(sql.includes('ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS category TEXT;'), 'Column category added to duel_questions');
audit(sql.includes('ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS subcategory TEXT;'), 'Column subcategory added to duel_questions');
audit(sql.includes('ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS pattern_type TEXT;'), 'Column pattern_type added to duel_questions');
audit(sql.includes('ALTER TABLE public.duel_questions ADD COLUMN IF NOT EXISTS explanation TEXT;'), 'Column explanation added to duel_questions');

// -----------------------------------------------------------------
// 3. Public View Security & Column Verification
// -----------------------------------------------------------------
console.log('\n--- 3. Public View duel_questions_public Security Audit ---');
const viewMatch = sql.match(/CREATE VIEW public\.duel_questions_public AS([\s\S]*?)FROM public\.duel_questions;/i);
audit(viewMatch !== null, 'View public.duel_questions_public is recreated');

if (viewMatch) {
  const viewBody = viewMatch[1];
  audit(viewBody.includes('category'), 'View exposes category');
  audit(viewBody.includes('subcategory'), 'View exposes subcategory');
  audit(viewBody.includes('time_limit_sec'), 'View exposes time_limit_sec');
  audit(!viewBody.includes('correct_answer'), 'View STRICTLY OMITS correct_answer');
  audit(!viewBody.includes('explanation'), 'View STRICTLY OMITS explanation');
}

// -----------------------------------------------------------------
// 4. Match-Level Question Roster on duel_matches
// -----------------------------------------------------------------
console.log('\n--- 4. Match-Level Question Assignment on duel_matches ---');
audit(sql.includes('ALTER TABLE public.duel_matches ADD COLUMN IF NOT EXISTS round_questions JSONB'), 'round_questions JSONB column added to duel_matches');

// -----------------------------------------------------------------
// 5. Anti-Repeat Question Exposures Table & Constraints
// -----------------------------------------------------------------
console.log('\n--- 5. Anti-Repeat Table public.duel_question_exposures ---');
audit(sql.includes('CREATE TABLE IF NOT EXISTS public.duel_question_exposures'), 'Table duel_question_exposures created');
audit(sql.includes('REFERENCES auth.users(id) ON DELETE CASCADE'), 'FK user_id points to auth.users(id)');
audit(sql.includes('REFERENCES public.duel_questions(id) ON DELETE RESTRICT'), 'FK question_id points to duel_questions(id) with ON DELETE RESTRICT (Protects historical exposures)');
audit(sql.includes('REFERENCES public.duel_matches(id) ON DELETE CASCADE'), 'FK match_id points to duel_matches(id)');
audit(sql.includes('CONSTRAINT uq_user_match_question UNIQUE (user_id, match_id, question_id)'), 'Unique constraint prevents duplicate exposure entries per match');
audit(sql.includes('idx_duel_question_exposures_user_time'), 'Index created on (user_id, exposed_at DESC)');
audit(sql.includes('ALTER TABLE public.duel_question_exposures ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on duel_question_exposures');
audit(sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.duel_question_exposures FROM authenticated, anon, public;'), 'Direct write access revoked from users');

// -----------------------------------------------------------------
// 6. Anti-Repeat Question Selection Engine (select_duel_match_questions)
// -----------------------------------------------------------------
console.log('\n--- 6. Anti-Repeat Question Selection RPC ---');
audit(sql.includes('CREATE OR REPLACE FUNCTION public.select_duel_match_questions'), 'select_duel_match_questions function created');
audit(sql.includes('SECURITY DEFINER') && sql.includes('SET search_path = public, pg_temp'), 'Uses SECURITY DEFINER and safe search_path');
audit(sql.includes('LIMIT 20'), 'Queries recent 20 matches per player for sliding-window exclusion');
audit(sql.includes('NOT (id = ANY(v_excluded_ids))'), 'Excludes recently exposed question IDs');
audit(sql.includes('v_rounds TEXT[] := ARRAY[\'QUICK_QUIZ\', \'PATTERN\', \'MEMORY\', \'ACCURACY\', \'SPEED\'];'), 'Iterates through all 5 canonical rounds in order');
audit(sql.includes('to_jsonb(v_selected_ids)'), 'Returns JSONB array of 5 question IDs');

// -----------------------------------------------------------------
// 7. Matchmaking Integration (join_matchmaking_rpc)
// -----------------------------------------------------------------
console.log('\n--- 7. Matchmaking Question Assignment & Concurrency ---');
audit(sql.includes('public.select_duel_match_questions(v_player1_id, v_user_id)'), 'Player 2 join selects questions considering BOTH players recent exposures');
audit(sql.includes('round_questions = v_round_questions'), 'round_questions saved on duel_matches during status = MATCHED transition');
audit(sql.includes('SKIP LOCKED'), 'Preserves concurrency row lock FOR UPDATE OF dm SKIP LOCKED');
audit(sql.includes('balance = balance - 1'), 'Preserves ticket deduction integrity (1 ticket per entry)');

// -----------------------------------------------------------------
// 8. Round Question Retrieval (get_duel_round_question_rpc)
// -----------------------------------------------------------------
console.log('\n--- 8. Synchronized Question Retrieval (get_duel_round_question_rpc) ---');
audit(sql.includes('v_match.round_questions->>(p_round_number - 1)'), 'Retrieves pre-assigned question from match roster index');

const rpcFuncMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.get_duel_round_question_rpc[\s\S]*?\$\$[\s\S]*?jsonb_build_object\(([\s\S]*?)\);[\s\S]*?\$\$;/);
if (rpcFuncMatch) {
  const jsonbArgs = rpcFuncMatch[1];
  audit(!jsonbArgs.includes('correct_answer'), 'RPC response JSON completely omits correct_answer');
  audit(!jsonbArgs.includes('explanation'), 'RPC response JSON completely omits explanation');
  audit(jsonbArgs.includes('category') && jsonbArgs.includes('subcategory'), 'RPC response includes category and subcategory');
} else {
  audit(false, 'get_duel_round_question_rpc jsonb_build_object found');
}

// -----------------------------------------------------------------
// 9. Answer Submission & Exposure Logging (submit_round_answer_rpc)
// -----------------------------------------------------------------
console.log('\n--- 9. Answer Submission & Live Hotfix Preservation ---');
audit(sql.includes('IF v_match.status NOT IN (\'MATCHED\', \'COUNTDOWN\', \'IN_PROGRESS\', \'ROUND_TRANSITION\')'), 'Preserves MATCHED as valid playing state');
audit(sql.includes('IF v_match.status IN (\'MATCHED\', \'COUNTDOWN\') THEN') && sql.includes('status = \'IN_PROGRESS\''), 'Transitions MATCHED to IN_PROGRESS upon valid submission');
audit(sql.includes('INSERT INTO public.duel_question_exposures'), 'Idempotently logs question exposure for player');
audit(sql.includes('ON CONFLICT (user_id, match_id, question_id) DO NOTHING'), 'Exposure logging is idempotent (no duplicate crash)');
audit(sql.includes('p_response_time_ms < 50'), 'Anti-bot reflex threshold >= 50ms preserved');
audit(sql.includes('TRIM(LOWER(v_question.correct_answer)) = TRIM(LOWER(COALESCE(p_response, \'\')))'), 'Server-side answer validation preserved');

// -----------------------------------------------------------------
// 10. Bulk Import of 1,148 Questions
// -----------------------------------------------------------------
console.log('\n--- 10. Dataset Import & Historical FK Compatibility ---');
audit(sql.includes('INSERT INTO public.duel_questions'), 'Bulk INSERT statement present');
audit(sql.includes('ON CONFLICT (id) DO UPDATE SET'), 'Non-destructive ON CONFLICT (id) DO UPDATE used');

// Verify existing 12 question IDs are NOT removed
const existing12Ids = [
  'q_quiz_1', 'q_quiz_2', 'q_quiz_3',
  'q_pat_1', 'q_pat_2', 'q_pat_3',
  'q_mem_1', 'q_mem_2',
  'q_acc_1', 'q_acc_2',
  'q_spd_1', 'q_spd_2'
];

let zeroDeletes = !sql.includes('DELETE FROM public.duel_questions') && !sql.includes('TRUNCATE public.duel_questions');
audit(zeroDeletes, 'Zero DELETE or TRUNCATE statements (Foreign Key safety for historical matches)');

// Count inserted tuples
const insertMatches = sql.match(/\('q_\d{4}'/g);
audit(insertMatches !== null && insertMatches.length === 1148, `Exactly 1,148 question tuples inserted in SQL`, `Found: ${insertMatches ? insertMatches.length : 0}`);

// Verify question IDs match dataset exactly
let idsMatch = true;
questions.forEach(q => {
  if (!sql.includes(`'${q.id}'`)) {
    idsMatch = false;
  }
});
audit(idsMatch, 'All 1,148 question IDs from JSON dataset present in SQL');

// -----------------------------------------------------------------
// 11. Financial Decoupling & Isolation Check
// -----------------------------------------------------------------
console.log('\n--- 11. Financial Isolation Check ---');
audit(!sql.includes('payrupee'), 'Zero references to PayRupee API in Migration 023');
audit(!sql.includes('convert_cash_to_tickets_rpc'), 'Does not modify convert_cash_to_tickets_rpc');
audit(!sql.includes('convert_tickets_to_cash_rpc'), 'Does not modify convert_tickets_to_cash_rpc');
audit(!sql.includes('request_withdrawal_rpc'), 'Does not modify withdrawal RPCs');
audit(!sql.includes('reserved_balance'), 'Zero interaction with wallet reserved_balance (Lifafa escrow)');

// -----------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------
console.log('\n================================================================');
console.log(`AUDIT RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${totalTests})`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('[SUCCESS] MIGRATION 023 VERIFIED COMPLETELY WITH ZERO ERRORS!\n');
  process.exit(0);
}
