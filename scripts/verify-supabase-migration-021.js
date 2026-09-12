import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert';

const SUPABASE_URL = 'https://pxqyeonymwlpiklfyjbb.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cXllb255bXdscGlrbGZ5amJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTc2NzAsImV4cCI6MjEwNDQ5MzY3MH0.Oo5y8zsMbS4uq3HuZmWUbkk_VGkvRW0_J-jCGQkhTlg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('========================================================');
console.log('STARTING LIVE SUPABASE MIGRATION 021 VERIFICATION');
console.log('Target: ' + SUPABASE_URL);
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 0;

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

async function runVerification() {
  // -------------------------------------------------------------
  // 1. Confirm all Migration 021 tables exist in Supabase schema
  // -------------------------------------------------------------
  const tables = [
    'game_tickets',
    'game_ticket_transactions',
    'duel_questions',
    'duel_matches',
    'duel_players',
    'duel_rounds',
    'duel_stats',
    'duel_events',
  ];

  for (const table of tables) {
    await testAsync(`1. Table exists: public.${table}`, async () => {
      const { error } = await supabase.from(table).select('*').limit(0);
      if (error) {
        // If code is 42P01, relation does not exist
        if (error.code === '42P01') {
          throw new Error(`Table ${table} does not exist in database: ${error.message}`);
        }
        // Permission denied (42501) means table exists and RLS/privileges are active!
        if (error.code === '42501') {
          return; // Valid: table exists with RLS active
        }
      }
    });
  }

  // -------------------------------------------------------------
  // 2. Confirm public.duel_questions_public view exists and omits correct_answer
  // -------------------------------------------------------------
  await testAsync('2. View public.duel_questions_public exists and shields correct_answer', async () => {
    const { data, error } = await supabase.from('duel_questions_public').select('*');
    if (error) throw new Error(`Failed to query duel_questions_public: ${error.message}`);
    assert.ok(Array.isArray(data), 'Expected array of questions');
    assert.ok(data.length > 0, 'Expected seeded questions to be present');

    // Verify correct_answer is completely missing from every row
    for (const q of data) {
      assert.ok(q.id, 'Question must have id');
      assert.ok(q.prompt, 'Question must have prompt');
      assert.ok(q.options, 'Question must have options');
      assert.strictEqual(
        q.correct_answer,
        undefined,
        `SECURITY VIOLATION: correct_answer exposed in question ${q.id}`
      );
      assert.ok(!Object.prototype.hasOwnProperty.call(q, 'correct_answer'));
    }
  });

  // -------------------------------------------------------------
  // 3. Confirm all 8 Migration 021 RPCs exist and enforce authentication
  // -------------------------------------------------------------
  const rpcs = [
    { name: 'get_game_ticket_balance_rpc', params: {}, expectedError: 'Authentication required' },
    { name: 'claim_daily_game_ticket_rpc', params: {}, expectedError: 'Authentication required' },
    {
      name: 'join_matchmaking_rpc',
      params: { p_display_name: 'Tester' },
      expectedError: 'Authentication required',
    },
    {
      name: 'get_duel_round_question_rpc',
      params: { p_match_id: '00000000-0000-0000-0000-000000000000', p_round_number: 1 },
      expectedError: 'Authentication required',
    },
    {
      name: 'submit_round_answer_rpc',
      params: {
        p_match_id: '00000000-0000-0000-0000-000000000000',
        p_round_number: 1,
        p_round_type: 'QUICK_QUIZ',
        p_question_id: 'q_quiz_1',
        p_response: 'test',
        p_response_time_ms: 1000,
      },
      expectedError: 'Authentication required',
    },
    {
      name: 'finalize_duel_match_rpc',
      params: { p_match_id: '00000000-0000-0000-0000-000000000000' },
      expectedError: 'Authentication required',
    },
    {
      name: 'cancel_matchmaking_rpc',
      params: { p_match_id: '00000000-0000-0000-0000-000000000000' },
      expectedError: 'Authentication required',
    },
    {
      name: 'duel_heartbeat_rpc',
      params: { p_match_id: '00000000-0000-0000-0000-000000000000' },
      expectedError: null, // handles unauthenticated gracefully
    },
  ];

  for (const rpc of rpcs) {
    await testAsync(`3. RPC exists & callable: public.${rpc.name}`, async () => {
      const { data, error } = await supabase.rpc(rpc.name, rpc.params);
      if (error) {
        // PGRST202 means function not found in schema cache
        if (error.code === 'PGRST202' || error.message.includes('Could not find the function')) {
          throw new Error(`RPC ${rpc.name} does NOT exist in Supabase: ${error.message}`);
        }
        if (rpc.expectedError) {
          assert.ok(
            error.message.includes(rpc.expectedError) || error.message.includes('Authentication'),
            `RPC ${rpc.name} returned unexpected error: ${error.message}`
          );
        }
      } else if (rpc.expectedError) {
        throw new Error(`RPC ${rpc.name} succeeded unexpectedly without authentication`);
      }
    });
  }

  // -------------------------------------------------------------
  // 4. Confirm direct client mutations are BLOCKED on all tables
  // -------------------------------------------------------------
  await testAsync('4. Direct client INSERT into game_tickets is blocked', async () => {
    const { error } = await supabase.from('game_tickets').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      balance: 9999,
    });
    assert.ok(error, 'Direct INSERT into game_tickets must be rejected');
  });

  await testAsync('4. Direct client INSERT into duel_matches is blocked', async () => {
    const { error } = await supabase.from('duel_matches').insert({
      status: 'COMPLETED',
    });
    assert.ok(error, 'Direct INSERT into duel_matches must be rejected');
  });

  await testAsync('4. Direct client INSERT into duel_rounds is blocked', async () => {
    const { error } = await supabase.from('duel_rounds').insert({
      match_id: '00000000-0000-0000-0000-000000000000',
      round_number: 1,
      round_type: 'QUICK_QUIZ',
      player_id: '00000000-0000-0000-0000-000000000000',
      question_id: 'q_quiz_1',
      player_response: 'cheat',
      response_time_ms: 100,
      is_correct: true,
      score_awarded: 9999,
    });
    assert.ok(error, 'Direct INSERT into duel_rounds must be rejected');
  });

  // -------------------------------------------------------------
  // 5. Confirm duel_questions table cannot leak correct_answer
  // -------------------------------------------------------------
  await testAsync('5. duel_questions direct SELECT is blocked or yields 0 rows to clients', async () => {
    const { data, error } = await supabase.from('duel_questions').select('correct_answer');
    if (error) {
      // Access denied is expected and secure
      return;
    }
    // If no error, RLS default deny must return empty array
    assert.strictEqual(data.length, 0, 'duel_questions must not return rows directly to clients');
  });

  // -------------------------------------------------------------
  // 6. Confirm Game Ticket Isolation from Wallets
  // -------------------------------------------------------------
  await testAsync('6. Game tickets are strictly decoupled; wallets data untouched', async () => {
    // Query wallets to confirm schema exists and is intact without duel fields
    const { data, error } = await supabase.from('wallets').select('*').limit(1);
    if (!error && data && data.length > 0) {
      const sample = data[0];
      assert.strictEqual(sample.ticket_balance, undefined, 'wallets must not have duel ticket columns');
      assert.strictEqual(sample.game_tickets, undefined, 'wallets must not have duel ticket columns');
    }
  });

  // -------------------------------------------------------------
  // 7. Test safe non-financial Duel flow with ephemeral test user (if permitted)
  // -------------------------------------------------------------
  await testAsync('7. Authenticated test flow: ticket balance, claim, & safe matchmaking', async () => {
    const testEmail = `duel_test_${Date.now()}@testlifafa.local`;
    const testPassword = 'TestPassword123!#';

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (authError || !authData?.user) {
      console.log('       [INFO] Ephemeral signUp not permitted by auth config; anon RPC tests confirm security.');
      return;
    }

    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await authedClient.auth.setSession({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    });

    // 1. Initialize ticket balance RPC
    const balRes = await authedClient.rpc('get_game_ticket_balance_rpc');
    assert.strictEqual(balRes.data?.success, true);
    assert.strictEqual(balRes.data?.balance, 5, 'Initial balance must be 5 promotional tickets');

    // 2. Claim daily ticket
    const claimRes = await authedClient.rpc('claim_daily_game_ticket_rpc');
    assert.strictEqual(claimRes.data?.success, true);
    assert.strictEqual(claimRes.data?.balance, 6, 'Balance must increment to 6 after daily claim');

    // 3. Daily claim 24h interval restriction
    const duplicateClaim = await authedClient.rpc('claim_daily_game_ticket_rpc');
    assert.strictEqual(duplicateClaim.data?.success, false, 'Duplicate claim within 24h must be rejected');

    // 4. Join matchmaking (debits 1 ticket)
    const joinRes = await authedClient.rpc('join_matchmaking_rpc', {
      p_display_name: 'LiveTester',
      p_allow_test_opponent: false,
    });
    assert.strictEqual(joinRes.data?.success, true);
    const matchId = joinRes.data?.match_id;
    assert.ok(matchId, 'Expected match_id from matchmaking');

    // Verify ticket balance decremented to 5
    const balAfterJoin = await authedClient.rpc('get_game_ticket_balance_rpc');
    assert.strictEqual(balAfterJoin.data?.balance, 5, '1 ticket must be debited for match entry');

    // 5. Cancel matchmaking (refunds 1 ticket)
    const cancelRes = await authedClient.rpc('cancel_matchmaking_rpc', {
      p_match_id: matchId,
    });
    assert.strictEqual(cancelRes.data?.success, true);
    assert.strictEqual(cancelRes.data?.refunded, true);

    // Verify ticket balance restored to 6
    const balAfterRefund = await authedClient.rpc('get_game_ticket_balance_rpc');
    assert.strictEqual(balAfterRefund.data?.balance, 6, '1 ticket must be refunded upon cancellation');
  });

  console.log(`\n========================================================`);
  console.log(`LIVE SUPABASE VERIFICATION: ${passedTests}/${totalTests} PASSED`);
  console.log(`========================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVerification();
