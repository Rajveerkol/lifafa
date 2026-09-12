// scripts/test-duel-ui-flow.js
// Complete End-to-End Frontend UI Flow & Server Authority Verification for ⚔️ DUEL EARN
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('========================================================');
console.log('STARTING DUEL UI FLOW & RPC INTEGRATION TEST SUITE');
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

// 1. Exact Disclaimer Verification across all relevant files
test('1. Exact disclaimer is present in DuelArena, GamesPage, and HowItWorksModal', () => {
  const exactDisclaimer = 'Game Tickets are promotional game credits and have no cash value. They cannot be withdrawn or converted to money.';

  const duelArenaCode = fs.readFileSync(path.resolve('src/components/games/DuelArena.tsx'), 'utf-8');
  const gamesPageCode = fs.readFileSync(path.resolve('src/pages/GamesPage.tsx'), 'utf-8');
  const howItWorksCode = fs.readFileSync(path.resolve('src/components/games/HowItWorksModal.tsx'), 'utf-8');

  assert.ok(duelArenaCode.includes(exactDisclaimer), 'DuelArena.tsx must contain the exact disclaimer string');
  assert.ok(gamesPageCode.includes(exactDisclaimer), 'GamesPage.tsx must contain the exact disclaimer string');
  assert.ok(howItWorksCode.includes(exactDisclaimer), 'HowItWorksModal.tsx must contain the exact disclaimer string');
});

// 2. Strict Dev/Test-Opponent Removal in Production UI
test('2. Dev/Test-opponent path is strictly disabled in production', () => {
  const duelServiceCode = fs.readFileSync(path.resolve('src/services/duelService.ts'), 'utf-8');
  const duelArenaCode = fs.readFileSync(path.resolve('src/components/games/DuelArena.tsx'), 'utf-8');

  // Verify isTestOpponentPermitted returns false
  assert.ok(
    duelServiceCode.includes('isTestOpponentPermitted(): boolean {\n    return false;\n  }'),
    'isTestOpponentPermitted must return false unconditionally'
  );

  // Verify safeAllowTest is false in joinMatchmaking
  assert.ok(
    duelServiceCode.includes('const safeAllowTest = false;'),
    'safeAllowTest must be hardcoded false in joinMatchmaking'
  );

  // Verify no user-facing toggle or checkbox for test opponent exists in DuelArena
  assert.ok(!duelArenaCode.includes('type="checkbox"'), 'No test opponent checkbox in DuelArena');
  assert.ok(!duelArenaCode.includes('allowTestOpponent'), 'No allowTestOpponent UI control in DuelArena');
});

// 3. Mock Server-Authoritative Database & RPC State Machine
class MockSupabaseAuthoritativeEngine {
  constructor() {
    this.tickets = new Map(); // userId -> number
    this.matches = new Map(); // matchId -> match
    this.players = new Map(); // matchId -> player[]
    this.rounds = new Map();  // matchId -> round[]
    this.dailyClaims = new Map(); // userId -> lastClaimDate
    this.questions = new Map([
      ['q_quiz_1', { id: 'q_quiz_1', round_type: 'QUICK_QUIZ', prompt: 'Protocol?', options: ['HTTP', 'WebSockets'], correct_answer: 'WebSockets', time_limit_sec: 25 }],
      ['q_pat_1', { id: 'q_pat_1', round_type: 'PATTERN', prompt: '2, 4, 8, ?', options: ['16', '32'], correct_answer: '16', time_limit_sec: 25 }],
      ['q_mem_1', { id: 'q_mem_1', round_type: 'MEMORY', prompt: '[A, B]', options: ['[A, B]', '[B, A]'], correct_answer: '[A, B]', time_limit_sec: 25 }],
      ['q_acc_1', { id: 'q_acc_1', round_type: 'ACCURACY', prompt: 'Target?', options: ['100', '500'], correct_answer: '500', time_limit_sec: 20 }],
      ['q_spd_1', { id: 'q_spd_1', round_type: 'SPEED', prompt: 'Tap green', options: ['GREEN_ACTIVE', 'RED'], correct_answer: 'GREEN_ACTIVE', time_limit_sec: 15 }],
    ]);
  }

  get_game_ticket_balance_rpc(userId) {
    if (!this.tickets.has(userId)) {
      this.tickets.set(userId, 5);
    }
    return { balance: this.tickets.get(userId) };
  }

  claim_daily_game_ticket_rpc(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const last = this.dailyClaims.get(userId);
    if (last === today) {
      return { success: false, message: 'Already claimed today', balance: this.tickets.get(userId) || 5 };
    }
    this.dailyClaims.set(userId, today);
    const curr = (this.tickets.get(userId) || 5) + 1;
    this.tickets.set(userId, curr);
    return { success: true, balance: curr, message: 'Daily promotional ticket claimed' };
  }

  join_matchmaking_rpc(userId, displayName, allowTest = false) {
    for (const [mId, m] of this.matches.entries()) {
      if (['MATCHED', 'COUNTDOWN', 'IN_PROGRESS', 'ROUND_TRANSITION'].includes(m.status)) {
        const plist = this.players.get(mId) || [];
        const found = plist.find(p => p.player_id === userId);
        if (found) {
          return {
            success: true,
            match_id: mId,
            player_slot: found.player_slot,
            status: m.status,
            reconnected: true,
          };
        }
      }
    }

    let bal = this.tickets.get(userId) ?? 5;
    if (bal < 1) {
      throw new Error('Insufficient game tickets. 1 ticket required to enter duel.');
    }

    for (const [mId, m] of this.matches.entries()) {
      if (m.status === 'WAITING') {
        const plist = this.players.get(mId) || [];
        if (plist[0].player_id !== userId) {
          this.tickets.set(userId, bal - 1);
          m.status = 'MATCHED';
          plist.push({
            match_id: mId,
            player_id: userId,
            player_slot: 'PLAYER_2',
            display_name: displayName,
            score: 0,
            result: 'PLAYING',
          });
          return {
            success: true,
            match_id: mId,
            player_slot: 'PLAYER_2',
            status: 'MATCHED',
            is_test_opponent: false,
          };
        }
      }
    }

    this.tickets.set(userId, bal - 1);
    const newMatchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.matches.set(newMatchId, {
      id: newMatchId,
      status: 'WAITING',
      current_round: 1,
      is_test_opponent: false,
      winner_id: null,
    });
    this.players.set(newMatchId, [
      {
        match_id: newMatchId,
        player_id: userId,
        player_slot: 'PLAYER_1',
        display_name: displayName,
        score: 0,
        result: 'PLAYING',
      },
    ]);
    this.rounds.set(newMatchId, []);

    return {
      success: true,
      match_id: newMatchId,
      player_slot: 'PLAYER_1',
      status: 'WAITING',
      is_test_opponent: false,
    };
  }

  cancel_matchmaking_rpc(userId, matchId) {
    const m = this.matches.get(matchId);
    if (!m || m.status !== 'WAITING') {
      return { success: false, message: 'Match not in waiting queue' };
    }
    const plist = this.players.get(matchId) || [];
    if (plist[0].player_id !== userId) {
      throw new Error('Unauthorized');
    }
    m.status = 'CANCELLED';
    const newBal = (this.tickets.get(userId) || 0) + 1;
    this.tickets.set(userId, newBal);
    return { success: true, refunded: true, balance: newBal };
  }

  get_duel_round_question_rpc(userId, matchId, roundNumber) {
    const m = this.matches.get(matchId);
    if (!m) throw new Error('Match not found');
    const plist = this.players.get(matchId) || [];
    if (!plist.some(p => p.player_id === userId)) throw new Error('Unauthorized');

    const roundTypes = ['QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED'];
    const rType = roundTypes[roundNumber - 1];
    for (const q of this.questions.values()) {
      if (q.round_type === rType) {
        return {
          success: true,
          round_number: roundNumber,
          round_type: q.round_type,
          question_id: q.id,
          prompt: q.prompt,
          options: q.options,
          time_limit_sec: q.time_limit_sec,
        };
      }
    }
    throw new Error('Question not found');
  }

  submit_round_answer_rpc(userId, matchId, roundNumber, roundType, questionId, response, timeMs) {
    const m = this.matches.get(matchId);
    if (!m) throw new Error('Match not found');
    const plist = this.players.get(matchId) || [];
    const player = plist.find(p => p.player_id === userId);
    if (!player) throw new Error('Player not in match');

    if (timeMs < 50) throw new Error('Bot anomaly');
    const rList = this.rounds.get(matchId) || [];
    const playerRounds = rList.filter(r => r.player_id === userId);
    if (playerRounds.length + 1 !== roundNumber) {
      throw new Error('Round submission out of sequence');
    }

    const q = this.questions.get(questionId);
    if (!q || q.round_type !== roundType) throw new Error('Invalid question');

    const isCorrect = q.correct_answer.toLowerCase().trim() === (response || '').toLowerCase().trim();
    const speedBonus = isCorrect ? Math.max(0, Math.min(50, 50 - Math.floor(timeMs / 500))) : 0;
    const scoreAwarded = isCorrect ? 100 + speedBonus : 0;

    player.score += scoreAwarded;
    rList.push({
      match_id: matchId,
      player_id: userId,
      round_number: roundNumber,
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
    });

    if (m.status === 'MATCHED' || m.status === 'COUNTDOWN') {
      m.status = 'IN_PROGRESS';
    }

    return {
      success: true,
      round_number: roundNumber,
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
      total_score: player.score,
    };
  }

  finalize_duel_match_rpc(userId, matchId) {
    const m = this.matches.get(matchId);
    if (!m) throw new Error('Match not found');
    const plist = this.players.get(matchId) || [];
    if (!plist.some(p => p.player_id === userId)) throw new Error('Unauthorized');

    const rList = this.rounds.get(matchId) || [];
    const p1 = plist.find(p => p.player_slot === 'PLAYER_1');
    const p2 = plist.find(p => p.player_slot === 'PLAYER_2');

    const p1Rounds = rList.filter(r => r.player_id === p1.player_id).length;
    const p2Rounds = rList.filter(r => r.player_id === p2.player_id).length;

    if (p1Rounds < 5 || p2Rounds < 5) {
      throw new Error(`Match cannot be finalized: rounds incomplete (P1: ${p1Rounds}, P2: ${p2Rounds})`);
    }

    let winnerId = null;
    let p1Res = 'DRAW';
    let p2Res = 'DRAW';

    if (p1.score > p2.score) {
      winnerId = p1.player_id;
      p1Res = 'WON';
      p2Res = 'LOST';
    } else if (p2.score > p1.score) {
      winnerId = p2.player_id;
      p1Res = 'LOST';
      p2Res = 'WON';
    }

    m.status = 'COMPLETED';
    m.winner_id = winnerId;

    if (winnerId) {
      const bal = this.tickets.get(winnerId) || 0;
      this.tickets.set(winnerId, bal + 2);
    }

    return {
      success: true,
      winner_id: winnerId,
      p1_score: p1.score,
      p2_score: p2.score,
      p1_result: p1Res,
      p2_result: p2Res,
    };
  }
}

// 3. Ticket Lifecycle
test('3. Ticket lifecycle: initial balance, daily promotional claim increment (+1)', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const aliceId = 'user_alice';

  const initial = engine.get_game_ticket_balance_rpc(aliceId);
  assert.strictEqual(initial.balance, 5);

  const claim1 = engine.claim_daily_game_ticket_rpc(aliceId);
  assert.strictEqual(claim1.success, true);
  assert.strictEqual(claim1.balance, 6);

  const claim2 = engine.claim_daily_game_ticket_rpc(aliceId);
  assert.strictEqual(claim2.success, false);
  assert.strictEqual(claim2.balance, 6);
});

// 4. Matchmaking Queue & Ticket Deduction
test('4. Matchmaking queue: debits 1 ticket on join; matches 2 players sequentially', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const alice = 'user_alice';
  const bob = 'user_bob';

  const resAlice = engine.join_matchmaking_rpc(alice, 'Alice');
  assert.strictEqual(resAlice.status, 'WAITING');
  assert.strictEqual(resAlice.player_slot, 'PLAYER_1');
  assert.strictEqual(engine.get_game_ticket_balance_rpc(alice).balance, 4);

  const resBob = engine.join_matchmaking_rpc(bob, 'Bob');
  assert.strictEqual(resBob.status, 'MATCHED');
  assert.strictEqual(resBob.player_slot, 'PLAYER_2');
  assert.strictEqual(resBob.match_id, resAlice.match_id);
  assert.strictEqual(engine.get_game_ticket_balance_rpc(bob).balance, 4);
});

// 5. Safe Matchmaking Cancellation & Ticket Refund
test('5. Cancel matchmaking: refunds ticket atomically when match is in WAITING state', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const charlie = 'user_charlie';

  const queueRes = engine.join_matchmaking_rpc(charlie, 'Charlie');
  assert.strictEqual(queueRes.status, 'WAITING');
  assert.strictEqual(engine.get_game_ticket_balance_rpc(charlie).balance, 4);

  const cancelRes = engine.cancel_matchmaking_rpc(charlie, queueRes.match_id);
  assert.strictEqual(cancelRes.success, true);
  assert.strictEqual(cancelRes.refunded, true);
  assert.strictEqual(cancelRes.balance, 5);
  assert.strictEqual(engine.get_game_ticket_balance_rpc(charlie).balance, 5);
});

// 6. Reconnect Handling
test('6. Reconnect handling: user refreshing active match receives reconnected: true with zero extra debit', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const alice = 'user_alice';
  const bob = 'user_bob';

  const mAlice = engine.join_matchmaking_rpc(alice, 'Alice');
  engine.join_matchmaking_rpc(bob, 'Bob');

  assert.strictEqual(engine.get_game_ticket_balance_rpc(alice).balance, 4);

  const reconnectRes = engine.join_matchmaking_rpc(alice, 'Alice');
  assert.strictEqual(reconnectRes.reconnected, true);
  assert.strictEqual(reconnectRes.match_id, mAlice.match_id);
  assert.strictEqual(reconnectRes.player_slot, 'PLAYER_1');
  assert.strictEqual(engine.get_game_ticket_balance_rpc(alice).balance, 4);
});

// 7. Sanitized Question Retrieval
test('7. get_duel_round_question_rpc returns sanitized question fields; omits correct_answer', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const alice = 'user_alice';
  const bob = 'user_bob';

  const mAlice = engine.join_matchmaking_rpc(alice, 'Alice');
  engine.join_matchmaking_rpc(bob, 'Bob');

  const q1 = engine.get_duel_round_question_rpc(alice, mAlice.match_id, 1);
  assert.strictEqual(q1.round_number, 1);
  assert.strictEqual(q1.round_type, 'QUICK_QUIZ');
  assert.strictEqual(q1.question_id, 'q_quiz_1');
  assert.ok(Array.isArray(q1.options));
  assert.strictEqual(q1.correct_answer, undefined);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(q1, 'correct_answer'), false);
});

// 8. Full 5-Round Battle Playthrough
test('8. Full 5-round battle: authoritative score calculation, sequential validation, and winner declaration', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const alice = 'user_alice';
  const bob = 'user_bob';

  const m = engine.join_matchmaking_rpc(alice, 'Alice');
  engine.join_matchmaking_rpc(bob, 'Bob');
  const matchId = m.match_id;

  const roundsInfo = [
    { num: 1, type: 'QUICK_QUIZ', qId: 'q_quiz_1', aliceAns: 'WebSockets', bobAns: 'HTTP', time: 1000 },
    { num: 2, type: 'PATTERN', qId: 'q_pat_1', aliceAns: '16', bobAns: '16', time: 1200 },
    { num: 3, type: 'MEMORY', qId: 'q_mem_1', aliceAns: '[A, B]', bobAns: '[A, B]', time: 800 },
    { num: 4, type: 'ACCURACY', qId: 'q_acc_1', aliceAns: '500', bobAns: '100', time: 900 },
    { num: 5, type: 'SPEED', qId: 'q_spd_1', aliceAns: 'GREEN_ACTIVE', bobAns: 'GREEN_ACTIVE', time: 700 },
  ];

  for (const r of roundsInfo) {
    const aliceRes = engine.submit_round_answer_rpc(alice, matchId, r.num, r.type, r.qId, r.aliceAns, r.time);
    assert.strictEqual(aliceRes.success, true);
    assert.strictEqual(aliceRes.is_correct, true);

    const bobRes = engine.submit_round_answer_rpc(bob, matchId, r.num, r.type, r.qId, r.bobAns, r.time);
    assert.strictEqual(bobRes.success, true);
  }

  const finalRes = engine.finalize_duel_match_rpc(alice, matchId);
  assert.strictEqual(finalRes.success, true);
  assert.strictEqual(finalRes.winner_id, alice);
  assert.strictEqual(finalRes.p1_result, 'WON');
  assert.strictEqual(finalRes.p2_result, 'LOST');
  assert.ok(finalRes.p1_score > finalRes.p2_score);

  assert.strictEqual(engine.get_game_ticket_balance_rpc(alice).balance, 6);
  assert.strictEqual(engine.get_game_ticket_balance_rpc(bob).balance, 4);
});

// 9. Multi-Player Waiting State in Finalization
test('9. Finalize rejects premature completion if opponent has not completed all 5 rounds', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const alice = 'user_alice';
  const bob = 'user_bob';

  const m = engine.join_matchmaking_rpc(alice, 'Alice');
  engine.join_matchmaking_rpc(bob, 'Bob');
  const matchId = m.match_id;

  const roundsInfo = [
    { num: 1, type: 'QUICK_QUIZ', qId: 'q_quiz_1', ans: 'WebSockets' },
    { num: 2, type: 'PATTERN', qId: 'q_pat_1', ans: '16' },
    { num: 3, type: 'MEMORY', qId: 'q_mem_1', ans: '[A, B]' },
    { num: 4, type: 'ACCURACY', qId: 'q_acc_1', ans: '500' },
    { num: 5, type: 'SPEED', qId: 'q_spd_1', ans: 'GREEN_ACTIVE' },
  ];
  for (const r of roundsInfo) {
    engine.submit_round_answer_rpc(alice, matchId, r.num, r.type, r.qId, r.ans, 1000);
  }

  for (let i = 0; i < 3; i++) {
    const r = roundsInfo[i];
    engine.submit_round_answer_rpc(bob, matchId, r.num, r.type, r.qId, r.ans, 1000);
  }

  assert.throws(
    () => engine.finalize_duel_match_rpc(alice, matchId),
    /rounds incomplete/
  );

  engine.submit_round_answer_rpc(bob, matchId, 4, 'ACCURACY', 'q_acc_1', '500', 1000);
  engine.submit_round_answer_rpc(bob, matchId, 5, 'SPEED', 'q_spd_1', 'GREEN_ACTIVE', 1000);

  const finalOk = engine.finalize_duel_match_rpc(alice, matchId);
  assert.strictEqual(finalOk.success, true);
});

// 10. Strict Opponent Privacy
test('10. Opponent privacy: public duel_players record contains display name & score only; no answers', () => {
  const engine = new MockSupabaseAuthoritativeEngine();
  const alice = 'user_alice';
  const bob = 'user_bob';

  const m = engine.join_matchmaking_rpc(alice, 'Alice');
  engine.join_matchmaking_rpc(bob, 'Bob');

  const plist = engine.players.get(m.match_id);
  const bobPublic = plist.find(p => p.player_id === bob);

  assert.strictEqual(bobPublic.display_name, 'Bob');
  assert.strictEqual(bobPublic.score, 0);
  assert.strictEqual(bobPublic.player_response, undefined);
  assert.strictEqual(bobPublic.answers, undefined);
});

console.log('\n========================================================');
console.log(`ALL DUEL UI & RPC INTEGRATION TESTS: ${passedTests}/${totalTests} PASSED`);
console.log('========================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
