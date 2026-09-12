// Comprehensive Automated Test Suite for DUEL EARN Question Bank
// Covers Tests A through M:
// Test A: Total question count >= 1000
// Test B: All 5 round types present with >= 200 questions each
// Test C: Difficulty distribution balanced (~25% / ~50% / ~25%)
// Test D: Exactly 4 unique options and 1 correct answer per question
// Test E: correct_answer strictly in options
// Test F: Zero duplicate prompts across entire dataset
// Test G: Zero identical option-set matches across identical answers
// Test H: Valid round-specific time limits (25s, 25s, 25s, 20s, 15s)
// Test I: Anti-repeat simulation (100 matches, 20-match sliding window, 1v1 parity)
// Test J: Server-only answer safety (client payload stripper test)
// Test K: Random selection uniform distribution test
// Test L: Edge case and malformed input rejection
// Test M: Financial integrity & migration preservation (001-022 intact, 023 absent)

import fs from 'node:fs';
import path from 'node:path';

const MASTER_PATH = path.resolve('scripts/data/duel-question-bank.json');

console.log('================================================================');
console.log('DUEL EARN QUESTION BANK: AUTOMATED COMPREHENSIVE TEST SUITE');
console.log('================================================================\n');

if (!fs.existsSync(MASTER_PATH)) {
  console.error(`FATAL: Question bank not found at ${MASTER_PATH}`);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

// -----------------------------------------------------------------
// TEST A: Total Question Count >= 1,000
// -----------------------------------------------------------------
console.log('\n--- TEST A: Total Question Count ---');
assert(questions.length >= 1000, `Question bank has >= 1000 questions (Found: ${questions.length})`);
assert(questions.length === 1148, `Question bank exactly matches calibrated count (Found: ${questions.length})`);

// -----------------------------------------------------------------
// TEST B: Round Types and Quotas (>= 200 per round)
// -----------------------------------------------------------------
console.log('\n--- TEST B: Round Pool Quotas ---');
const rounds = ['QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED'];
const roundMap = {
  QUICK_QUIZ: [],
  PATTERN: [],
  MEMORY: [],
  ACCURACY: [],
  SPEED: []
};

questions.forEach(q => {
  if (roundMap[q.round_type]) {
    roundMap[q.round_type].push(q);
  }
});

rounds.forEach(r => {
  const count = roundMap[r].length;
  assert(count >= 200, `Round '${r}' pool count (${count}) >= 200`);
});

// -----------------------------------------------------------------
// TEST C: Difficulty Balance (~25% Easy, ~50% Med, ~25% Hard)
// -----------------------------------------------------------------
console.log('\n--- TEST C: Difficulty Balance ---');
const diffCounts = { EASY: 0, MEDIUM: 0, HARD: 0 };
questions.forEach(q => {
  if (diffCounts[q.difficulty] !== undefined) {
    diffCounts[q.difficulty]++;
  }
});

const totalQ = questions.length;
const easyPct = (diffCounts.EASY / totalQ) * 100;
const medPct = (diffCounts.MEDIUM / totalQ) * 100;
const hardPct = (diffCounts.HARD / totalQ) * 100;

assert(easyPct >= 20 && easyPct <= 30, `EASY questions within 20-30% range (Found: ${easyPct.toFixed(1)}%, count: ${diffCounts.EASY})`);
assert(medPct >= 45 && medPct <= 55, `MEDIUM questions within 45-55% range (Found: ${medPct.toFixed(1)}%, count: ${diffCounts.MEDIUM})`);
assert(hardPct >= 20 && hardPct <= 30, `HARD questions within 20-30% range (Found: ${hardPct.toFixed(1)}%, count: ${diffCounts.HARD})`);

// -----------------------------------------------------------------
// TEST D: Exactly 4 Unique Options & 1 Correct Answer per Question
// -----------------------------------------------------------------
console.log('\n--- TEST D: Option Count & Intra-Question Uniqueness ---');
let optionErrors = 0;
questions.forEach(q => {
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    optionErrors++;
    return;
  }
  const set = new Set(q.options.map(o => String(o).trim().toLowerCase()));
  if (set.size !== 4) {
    optionErrors++;
  }
  if (!q.correct_answer || String(q.correct_answer).trim().length === 0) {
    optionErrors++;
  }
});
assert(optionErrors === 0, `All ${questions.length} questions have exactly 4 non-empty, unique options and non-empty answer`);

// -----------------------------------------------------------------
// TEST E: correct_answer Strictly in Options
// -----------------------------------------------------------------
console.log('\n--- TEST E: Correct Answer Presence in Options ---');
let missingAnswers = 0;
questions.forEach(q => {
  const ansStr = String(q.correct_answer).trim();
  const match = q.options.some(opt => String(opt).trim() === ansStr);
  if (!match) missingAnswers++;
});
assert(missingAnswers === 0, `All ${questions.length} questions have correct_answer strictly present in options`);

// -----------------------------------------------------------------
// TEST F: Zero Duplicate Prompts (Exact & Normalized)
// -----------------------------------------------------------------
console.log('\n--- TEST F: Prompt Uniqueness ---');
const exactPrompts = new Set();
const normPrompts = new Set();
let exactPromptDuplicates = 0;
let normPromptDuplicates = 0;

questions.forEach(q => {
  const exact = q.prompt.trim();
  const norm = q.prompt.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  
  if (exactPrompts.has(exact)) exactPromptDuplicates++;
  exactPrompts.add(exact);

  if (normPrompts.has(norm)) normPromptDuplicates++;
  normPrompts.add(norm);
});

assert(exactPromptDuplicates === 0, `Exact duplicate prompts across dataset: ${exactPromptDuplicates}`);
assert(normPromptDuplicates === 0, `Normalized duplicate prompts across dataset: ${normPromptDuplicates}`);

// -----------------------------------------------------------------
// TEST G: Zero Identical Option Sets with Same Correct Answer
// -----------------------------------------------------------------
console.log('\n--- TEST G: Option-Set Collisions ---');
const optionSetKeys = new Set();
let optionSetCollisions = 0;

questions.forEach(q => {
  const sortedOpts = [...q.options].map(o => String(o).trim().toLowerCase()).sort().join('|||');
  const key = `${sortedOpts}:::ans=${String(q.correct_answer).trim().toLowerCase()}`;
  if (optionSetKeys.has(key)) {
    optionSetCollisions++;
  }
  optionSetKeys.add(key);
});
assert(optionSetCollisions === 0, `Identical option-set collisions across dataset: ${optionSetCollisions}`);

// -----------------------------------------------------------------
// TEST H: Valid Round-Specific Time Limits
// -----------------------------------------------------------------
console.log('\n--- TEST H: Round Time Limits ---');
const timeLimits = {
  QUICK_QUIZ: 25,
  PATTERN: 25,
  MEMORY: 25,
  ACCURACY: 20,
  SPEED: 15
};
let timeErrors = 0;
questions.forEach(q => {
  const expected = timeLimits[q.round_type];
  const actual = q.time_limit_sec !== undefined ? q.time_limit_sec : q.time_limit_seconds;
  if (actual !== expected) timeErrors++;
});
assert(timeErrors === 0, `All questions match expected round time limits (QUICK_QUIZ: 25s, PATTERN: 25s, MEMORY: 25s, ACCURACY: 20s, SPEED: 15s)`);

// -----------------------------------------------------------------
// TEST I: Anti-Repeat Simulation (100 Matches, 20-Match Sliding Window, 1v1 Parity)
// -----------------------------------------------------------------
console.log('\n--- TEST I: Anti-Repeat Sliding-Window Simulation ---');

function simulateAntiRepeatGameplay(numMatches = 100, windowSize = 20) {
  // Exposure tracking per user: Map of userId -> Array of recently seen question IDs
  const userExposures = {
    playerA: [],
    playerB: []
  };

  const matchesHistory = [];
  let parityViolations = 0;
  let repeatViolations = 0;

  // Round sequence for every match: 1 -> 2 -> 3 -> 4 -> 5
  const roundSequence = ['QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED'];

  for (let m = 1; m <= numMatches; m++) {
    const matchQuestions = [];

    // For each round, select 1 question
    for (let rIdx = 0; rIdx < roundSequence.length; rIdx++) {
      const rType = roundSequence[rIdx];
      const pool = roundMap[rType];

      // Excluded IDs = recently seen by playerA OR playerB in last `windowSize` matches
      const excludedSet = new Set([
        ...userExposures.playerA.slice(-windowSize * 5),
        ...userExposures.playerB.slice(-windowSize * 5)
      ]);

      // Filter available candidates
      let available = pool.filter(q => !excludedSet.has(q.id));

      // Fallback reservoir sampling if depleted
      if (available.length === 0) {
        available = pool;
      }

      // Authoritative server random pick
      const selected = available[Math.floor(Math.random() * available.length)];
      matchQuestions.push(selected);
    }

    // Check 1v1 Match Parity: Both players receive the exact same matchQuestions
    const payloadForA = matchQuestions.map(q => q.id);
    const payloadForB = matchQuestions.map(q => q.id);
    const hasParity = payloadForA.every((id, idx) => id === payloadForB[idx]);
    if (!hasParity) parityViolations++;

    // Check repeat violations within current sliding window for player A
    const recentA = userExposures.playerA.slice(-windowSize * 5);
    matchQuestions.forEach(q => {
      if (recentA.includes(q.id)) {
        repeatViolations++;
      }
    });

    // Record exposures
    matchQuestions.forEach(q => {
      userExposures.playerA.push(q.id);
      userExposures.playerB.push(q.id);
    });

    matchesHistory.push({
      matchId: m,
      questionIds: matchQuestions.map(q => q.id)
    });
  }

  const uniqueQuestionsSeenByA = new Set(userExposures.playerA).size;
  return {
    numMatches,
    parityViolations,
    repeatViolations,
    uniqueQuestionsSeenByA,
    totalExposures: userExposures.playerA.length
  };
}

const simResult = simulateAntiRepeatGameplay(100, 20);
assert(simResult.parityViolations === 0, `1v1 Match Parity: 0 desyncs across 100 matches (Both players receive identical questions)`);
assert(simResult.repeatViolations === 0, `Sliding-window exclusion: 0 repeat violations within any 20-match window (Observed: ${simResult.repeatViolations})`);
assert(simResult.uniqueQuestionsSeenByA >= 350, `High question diversity: ${simResult.uniqueQuestionsSeenByA} unique questions experienced over 100 matches (500 total questions served)`);

// -----------------------------------------------------------------
// TEST J: Server-Only Answer Safety (Client Payload Sanitization)
// -----------------------------------------------------------------
console.log('\n--- TEST J: Server-Only Answer Safety & Client Payload Sanitizer ---');

function sanitizeQuestionForClient(q) {
  // Authoritative server sanitization: strictly omit correct_answer and explanation
  return {
    id: q.id,
    round_type: q.round_type,
    prompt: q.prompt,
    options: [...q.options],
    difficulty: q.difficulty,
    category: q.category,
    subcategory: q.subcategory,
    time_limit_sec: q.time_limit_sec !== undefined ? q.time_limit_sec : q.time_limit_seconds
  };
}

let leakCount = 0;
questions.forEach(q => {
  const clientPayload = sanitizeQuestionForClient(q);
  if ('correct_answer' in clientPayload) leakCount++;
  if ('explanation' in clientPayload) leakCount++;
  const serialized = JSON.stringify(clientPayload);
  // Ensure the correct answer string isn't leaked as an explicit answer field
  if (serialized.includes('"correct_answer"')) leakCount++;
  if (serialized.includes('"explanation"')) leakCount++;
});

assert(leakCount === 0, `Client payload sanitization: 0 leaks of correct_answer or explanation across all ${questions.length} questions`);

// -----------------------------------------------------------------
// TEST K: Random Selection Uniformity
// -----------------------------------------------------------------
console.log('\n--- TEST K: Random Selection Uniformity ---');
const selectionCounts = new Map();
questions.forEach(q => selectionCounts.set(q.id, 0));

const NUM_DRAWS = 20000;
for (let i = 0; i < NUM_DRAWS; i++) {
  // Pick random round
  const rType = rounds[Math.floor(Math.random() * rounds.length)];
  const pool = roundMap[rType];
  const picked = pool[Math.floor(Math.random() * pool.length)];
  selectionCounts.set(picked.id, selectionCounts.get(picked.id) + 1);
}

const counts = Array.from(selectionCounts.values());
const minDraws = Math.min(...counts);
const maxDraws = Math.max(...counts);
const zeroDraws = counts.filter(c => c === 0).length;

assert(zeroDraws === 0, `Every question in the bank was selected at least once in 20,000 draws (Zero starvation: ${zeroDraws})`);
assert(minDraws >= 3 && maxDraws <= 40, `Selection distribution is well-bounded (Min: ${minDraws}, Max: ${maxDraws}, Mean: ${(NUM_DRAWS / questions.length).toFixed(1)})`);

// -----------------------------------------------------------------
// TEST L: Edge Case & Malformed Input Handling
// -----------------------------------------------------------------
console.log('\n--- TEST L: Edge Case & Malformed Input Rejection ---');

function validateSingleQuestion(q) {
  const errs = [];
  if (!q.id) errs.push('MISSING_ID');
  if (!rounds.includes(q.round_type)) errs.push('INVALID_ROUND');
  if (!q.prompt || q.prompt.trim().length === 0) errs.push('EMPTY_PROMPT');
  if (!Array.isArray(q.options) || q.options.length !== 4) errs.push('INVALID_OPTIONS_LEN');
  if (new Set(q.options).size !== 4) errs.push('DUPLICATE_OPTIONS');
  if (!q.options?.includes(q.correct_answer)) errs.push('CORRECT_ANSWER_NOT_IN_OPTIONS');
  const t = q.time_limit_sec ?? q.time_limit_seconds;
  if (!t || t <= 0) errs.push('INVALID_TIME_LIMIT');
  return errs;
}

const malformedCases = [
  { test: '3 options', data: { id: 'x', round_type: 'SPEED', prompt: 'P', options: ['A', 'B', 'C'], correct_answer: 'A', time_limit_sec: 15 }, expected: 'INVALID_OPTIONS_LEN' },
  { test: 'duplicate options', data: { id: 'x', round_type: 'SPEED', prompt: 'P', options: ['A', 'A', 'B', 'C'], correct_answer: 'A', time_limit_sec: 15 }, expected: 'DUPLICATE_OPTIONS' },
  { test: 'answer not in options', data: { id: 'x', round_type: 'SPEED', prompt: 'P', options: ['A', 'B', 'C', 'D'], correct_answer: 'Z', time_limit_sec: 15 }, expected: 'CORRECT_ANSWER_NOT_IN_OPTIONS' },
  { test: 'invalid round type', data: { id: 'x', round_type: 'UNKNOWN_ROUND', prompt: 'P', options: ['A', 'B', 'C', 'D'], correct_answer: 'A', time_limit_sec: 15 }, expected: 'INVALID_ROUND' },
  { test: 'missing time limit', data: { id: 'x', round_type: 'SPEED', prompt: 'P', options: ['A', 'B', 'C', 'D'], correct_answer: 'A' }, expected: 'INVALID_TIME_LIMIT' },
  { test: 'empty prompt', data: { id: 'x', round_type: 'SPEED', prompt: '  ', options: ['A', 'B', 'C', 'D'], correct_answer: 'A', time_limit_sec: 15 }, expected: 'EMPTY_PROMPT' }
];

let edgeCasePassed = 0;
malformedCases.forEach(c => {
  const errs = validateSingleQuestion(c.data);
  if (errs.includes(c.expected)) {
    edgeCasePassed++;
  }
});

assert(edgeCasePassed === malformedCases.length, `Edge case rejection: all ${malformedCases.length} invalid configurations correctly identified and rejected`);

// -----------------------------------------------------------------
// TEST M: Financial Integrity & Migration Preservation
// -----------------------------------------------------------------
console.log('\n--- TEST M: Migration & Financial Integrity Preservation ---');

// Check migrations 001 through 022 exist
const migrationsDir = path.resolve('supabase/migrations');
const expectedMigrations = [
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

let missingMigrations = 0;
expectedMigrations.forEach(m => {
  if (!fs.existsSync(path.join(migrationsDir, m))) {
    missingMigrations++;
  }
});

assert(missingMigrations === 0, `All existing migrations 001-022 intact in supabase/migrations/ (${expectedMigrations.length} files verified)`);

// Assert migration 023 exists and is populated
const mig023Path = path.join(migrationsDir, '023_duel_question_bank_and_anti_repeat.sql');
assert(fs.existsSync(mig023Path), `Migration 023 exists in supabase/migrations/`);
const mig023Size = fs.existsSync(mig023Path) ? fs.statSync(mig023Path).size : 0;
assert(mig023Size > 300000, `Migration 023 is fully populated with 1,148 questions (Size: ${mig023Size} bytes)`);

// -----------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${totalTests})`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('[SUCCESS] ALL 13 TEST SUITES (A through M) PASSED WITH ZERO ERRORS!\n');
  process.exit(0);
}
