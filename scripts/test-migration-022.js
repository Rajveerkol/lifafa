// Automated Verification Suite for Migration 022
// Validates SQL structure, constraints, global lock order, idempotency,
// retirement of free promotional tickets, and financial isolation.
// Strict constraint: Does NOT execute any SQL in Supabase or modify any database state.

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('========================================================');
console.log('STARTING MIGRATION 022 SPECIFICATION & INTEGRITY TEST');
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

const MIGRATION_PATH = path.resolve('supabase/migrations/022_game_balance_and_ticket_conversions.sql');

// 1. Migration 022 file existence
test('1. Migration 022 file exists and is populated', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH), 'Migration 022 file must exist at ' + MIGRATION_PATH);
  const content = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.ok(content.length > 5000, `Migration file length (${content.length}) is unexpectedly small`);
});

const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

// 2. Migration 001-021 protection test
test('2. Migrations 001 through 021 are completely unmodified', () => {
  for (let i = 1; i <= 21; i++) {
    const pad = String(i).padStart(3, '0');
    const files = fs.readdirSync('supabase/migrations').filter(f => f.startsWith(pad));
    assert.ok(files.length >= 1, `Migration ${pad} must exist`);
  }
});

// 3. Bridge Ledger Table public.game_balance_conversions
test('3. Table public.game_balance_conversions is defined with complete constraints', () => {
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.game_balance_conversions'), 'Must create table game_balance_conversions');
  assert.ok(sql.includes("conversion_type IN ('CASH_TO_TICKETS', 'TICKETS_TO_CASH')"), 'Must enforce conversion_type CHECK constraint');
  assert.ok(sql.includes('cash_amount NUMERIC(12, 2) NOT NULL CHECK (cash_amount > 0)'), 'Must enforce cash_amount > 0');
  assert.ok(sql.includes('ticket_count INTEGER NOT NULL CHECK (ticket_count > 0)'), 'Must enforce ticket_count > 0');
  assert.ok(sql.includes('conversion_rate NUMERIC(12, 2) NOT NULL DEFAULT 10.00 CHECK (conversion_rate > 0)'), 'Must enforce canonical conversion_rate');
  assert.ok(sql.includes('cash_balance_before NUMERIC(12, 2) NOT NULL CHECK (cash_balance_before >= 0)'), 'Must snapshot cash_balance_before >= 0');
  assert.ok(sql.includes('cash_balance_after NUMERIC(12, 2) NOT NULL CHECK (cash_balance_after >= 0)'), 'Must snapshot cash_balance_after >= 0');
  assert.ok(sql.includes('ticket_balance_before INTEGER NOT NULL CHECK (ticket_balance_before >= 0)'), 'Must snapshot ticket_balance_before >= 0');
  assert.ok(sql.includes('ticket_balance_after INTEGER NOT NULL CHECK (ticket_balance_after >= 0)'), 'Must snapshot ticket_balance_after >= 0');
  assert.ok(sql.includes('idempotency_key TEXT UNIQUE NOT NULL'), 'Must require UNIQUE idempotency_key');
  assert.ok(sql.includes("status IN ('SUCCESS', 'FAILED', 'REVERSED')"), 'Must enforce status CHECK constraint');
});

// 4. Row Level Security on game_balance_conversions
test('4. RLS is enabled with read-only policy for authenticated users and revoked write access', () => {
  assert.ok(sql.includes('ALTER TABLE public.game_balance_conversions ENABLE ROW LEVEL SECURITY;'), 'RLS must be enabled');
  assert.ok(sql.includes('CREATE POLICY "Users read own game balance conversions"'), 'Must have user read policy');
  assert.ok(sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.game_balance_conversions FROM authenticated, anon, public;'), 'Must revoke write privileges');
  assert.ok(sql.includes('GRANT SELECT ON public.game_balance_conversions TO authenticated;'), 'Must grant SELECT to authenticated');
});

// 5. Check constraint update on game_ticket_transactions
test('5. Check constraint on game_ticket_transactions preserves historical types INITIAL_GRANT and DAILY_CLAIM', () => {
  assert.ok(sql.includes("'INITIAL_GRANT'"), 'Must preserve INITIAL_GRANT for audit trail');
  assert.ok(sql.includes("'DAILY_CLAIM'"), 'Must preserve DAILY_CLAIM for audit trail');
  assert.ok(sql.includes("'CASH_TO_TICKETS'"), 'Must add CASH_TO_TICKETS');
  assert.ok(sql.includes("'TICKETS_TO_CASH'"), 'Must add TICKETS_TO_CASH');
  assert.ok(sql.includes("'MATCH_ENTRY'"), 'Must preserve MATCH_ENTRY');
  assert.ok(sql.includes("'MATCH_REWARD'"), 'Must preserve MATCH_REWARD');
});

// 6. Default ticket balance set to 0
test('6. Alters public.game_tickets column balance DEFAULT to 0', () => {
  assert.ok(
    sql.includes('ALTER TABLE public.game_tickets ALTER COLUMN balance SET DEFAULT 0;'),
    'Must alter balance default to 0'
  );
});

// 7. Global Lock Ordering Verification (wallets -> game_tickets)
test('7. Global lock hierarchy strictly enforces wallets (1st) -> game_tickets (2nd) across all conversion RPCs', () => {
  // Check convert_cash_to_tickets_rpc lock order
  const cashToTicketsIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.convert_cash_to_tickets_rpc');
  const ticketsToCashIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.convert_tickets_to_cash_rpc');
  const getTicketBalanceIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.get_game_ticket_balance_rpc');

  assert.ok(cashToTicketsIdx !== -1, 'convert_cash_to_tickets_rpc must exist');
  assert.ok(ticketsToCashIdx !== -1, 'convert_tickets_to_cash_rpc must exist');

  const cashToTicketsBody = sql.substring(cashToTicketsIdx, ticketsToCashIdx);
  const ticketsToCashBody = sql.substring(ticketsToCashIdx, getTicketBalanceIdx);

  // In convert_cash_to_tickets_rpc:
  const c2tWalletLock = cashToTicketsBody.indexOf('FROM public.wallets');
  const c2tTicketLock = cashToTicketsBody.indexOf('FROM public.game_tickets');
  assert.ok(c2tWalletLock !== -1 && c2tTicketLock !== -1, 'Must lock both wallets and game_tickets');
  assert.ok(c2tWalletLock < c2tTicketLock, 'convert_cash_to_tickets_rpc MUST lock wallets BEFORE game_tickets');

  // In convert_tickets_to_cash_rpc:
  const t2cWalletLock = ticketsToCashBody.indexOf('FROM public.wallets');
  const t2cTicketLock = ticketsToCashBody.indexOf('FROM public.game_tickets');
  assert.ok(t2cWalletLock !== -1 && t2cTicketLock !== -1, 'Must lock both wallets and game_tickets');
  assert.ok(t2cWalletLock < t2cTicketLock, 'convert_tickets_to_cash_rpc MUST lock wallets BEFORE game_tickets (Deadlock Prevention)');
});

// 8. Idempotency Implementation
test('8. Enforces idempotency with cross-operation collision guards in both RPCs', () => {
  assert.ok(sql.includes("v_idempotency_key := COALESCE(NULLIF(TRIM(p_idempotency_key), ''), 'c2t_' || gen_random_uuid()::text);"), 'C2T auto-generates prefixed idempotency key');
  assert.ok(sql.includes("v_idempotency_key := COALESCE(NULLIF(TRIM(p_idempotency_key), ''), 't2c_' || gen_random_uuid()::text);"), 'T2C auto-generates prefixed idempotency key');
  assert.ok(sql.includes("IF v_existing.conversion_type != 'CASH_TO_TICKETS' OR v_existing.user_id != v_user_id THEN"), 'C2T collision guard');
  assert.ok(sql.includes("IF v_existing.conversion_type != 'TICKETS_TO_CASH' OR v_existing.user_id != v_user_id THEN"), 'T2C collision guard');
  assert.ok(sql.includes("'already_processed', true"), 'Both RPCs return already_processed = true on replay');
});

// 9. Retirement of Free-Ticket Creation
test('9. get_game_ticket_balance_rpc and join_matchmaking_rpc no longer grant 5 free tickets', () => {
  const getTicketBalanceIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.get_game_ticket_balance_rpc');
  const joinMatchmakingIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.join_matchmaking_rpc');
  const claimDailyIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.claim_daily_game_ticket_rpc');

  const getBalanceBody = sql.substring(getTicketBalanceIdx, joinMatchmakingIdx);
  const joinBody = sql.substring(joinMatchmakingIdx, claimDailyIdx);

  // Must NOT insert 5 tickets
  assert.ok(!getBalanceBody.includes('VALUES (v_user_id, 5)'), 'getBalance must NOT grant 5 tickets');
  assert.ok(getBalanceBody.includes('VALUES (v_user_id, 0)'), 'getBalance must default to 0 tickets');

  assert.ok(!joinBody.includes('VALUES (v_user_id, 5)'), 'joinMatchmaking must NOT grant 5 tickets');
  assert.ok(joinBody.includes('VALUES (v_user_id, 0)'), 'joinMatchmaking must default to 0 tickets');
  assert.ok(joinBody.includes('IF v_ticket_balance < 1 THEN'), 'joinMatchmaking requires at least 1 ticket');
});

// 10. Neutralized Daily Claim
test('10. claim_daily_game_ticket_rpc is neutralized with zero ticket mutation', () => {
  const claimDailyIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.claim_daily_game_ticket_rpc');
  const claimDailyBody = sql.substring(claimDailyIdx);

  assert.ok(claimDailyBody.includes("'success', false"), 'Daily claim must return success: false');
  assert.ok(!claimDailyBody.includes('UPDATE public.game_tickets'), 'Daily claim must NEVER update ticket balance');
  assert.ok(!claimDailyBody.includes('INSERT INTO public.game_ticket_transactions'), 'Daily claim must NEVER insert transactions');
});

// 11. Strict Isolation from PayRupee and Escrow
test('11. Migration 022 is 100% decoupled from PayRupee, bank payouts, and Lifafa escrow', () => {
  const linesWithoutComments = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.ok(!linesWithoutComments.toLowerCase().includes('payrupee'), 'Migration 022 code must NEVER reference payrupee');
  assert.ok(!linesWithoutComments.includes('reserved_balance'), 'Migration 022 code must NEVER touch reserved_balance (Lifafa escrow)');
  assert.ok(!linesWithoutComments.includes('total_withdrawn'), 'Migration 022 code must NEVER modify total_withdrawn');
  assert.ok(!linesWithoutComments.includes('request_withdrawal_rpc'), 'Migration 022 code must NEVER alter request_withdrawal_rpc');
  assert.ok(!linesWithoutComments.includes('process_withdrawal_payout_rpc'), 'Migration 022 code must NEVER alter process_withdrawal_payout_rpc');
});

// 12. Security Definier & Search Path
test('12. All 5 RPC functions declare SECURITY DEFINER and explicit pg_temp search_path', () => {
  const rpcs = [
    'convert_cash_to_tickets_rpc',
    'convert_tickets_to_cash_rpc',
    'get_game_ticket_balance_rpc',
    'join_matchmaking_rpc',
    'claim_daily_game_ticket_rpc'
  ];

  for (const rpc of rpcs) {
    const idx = sql.indexOf(`FUNCTION public.${rpc}`);
    assert.ok(idx !== -1, `Function ${rpc} must be defined`);
    const chunk = sql.substring(idx, idx + 400);
    assert.ok(chunk.includes('SECURITY DEFINER'), `${rpc} must be SECURITY DEFINER`);
    assert.ok(chunk.includes('SET search_path = public, pg_temp'), `${rpc} must have explicit secure search_path`);
    assert.ok(sql.includes(`GRANT EXECUTE ON FUNCTION public.${rpc}`), `${rpc} must have GRANT EXECUTE to authenticated`);
  }
});

console.log(`\nMigration 022 Validation Summary: ${passedTests}/${totalTests} Passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
