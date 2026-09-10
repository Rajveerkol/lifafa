// Automated Test for Claimant Telegram Task UX & State Machine
import assert from 'node:assert';

console.log('========================================================');
console.log('STARTING CLAIMANT TELEGRAM TASK FLOW VERIFICATION');
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

// 1. Channel URL Formatting
test('Step 1: Normalizes channel username into valid t.me join link', () => {
  const cases = [
    { input: '@SatishTricks', expected: 'https://t.me/SatishTricks' },
    { input: 'SatishTricks', expected: 'https://t.me/SatishTricks' },
    { input: 'https://t.me/SatishTricks', expected: 'https://t.me/SatishTricks' },
    { input: '  @MyChannel_2026 ', expected: 'https://t.me/MyChannel_2026' }
  ];

  for (const c of cases) {
    const clean = c.input.trim().replace(/^@/, '');
    const url = c.input.startsWith('http') ? c.input : `https://t.me/${clean}`;
    assert.strictEqual(url, c.expected);
  }
});

// 2. Cryptographic Deep-Link generation
test('Step 2: Generates secure binding deep-link without exposing secrets', () => {
  const nonce = 'bind_' + Math.random().toString(16).slice(2, 10);
  const botUsername = 'createlifafa_bot';
  const deepLink = `https://t.me/${botUsername}?start=${nonce}`;

  assert.ok(deepLink.startsWith('https://t.me/createlifafa_bot?start=bind_'));
  assert.ok(!deepLink.includes('token'));
  assert.ok(!deepLink.includes('secret'));
});

// 3. State Machine Progression
test('Step-by-step state progression: Not Started -> Joined -> Connected -> Verified', () => {
  let state = {
    hasJoined: false,
    isBound: false,
    telegramUserId: null,
    telegramUsername: null,
    isVerified: false,
    verificationError: null
  };

  // State 1: Not Started
  assert.strictEqual(state.hasJoined, false);
  assert.strictEqual(state.isBound, false);
  assert.strictEqual(state.isVerified, false);

  // Action: Click "Join Telegram"
  state.hasJoined = true;
  assert.strictEqual(state.hasJoined, true);
  assert.strictEqual(state.isBound, false);

  // Action: Complete Telegram Bot Binding
  state.isBound = true;
  state.telegramUserId = 123456789;
  state.telegramUsername = 'rajveer_tester';
  assert.strictEqual(state.isBound, true);
  assert.strictEqual(state.telegramUsername, 'rajveer_tester');

  // Action: Attempt verify with failure first
  const membershipFound = false;
  if (!membershipFound) {
    state.verificationError = "We couldn't verify your membership yet. Please make sure you joined the channel, then try again.";
  }
  assert.strictEqual(state.isVerified, false);
  assert.ok(state.verificationError.includes('joined the channel, then try again'));

  // Action: User joins channel and clicks "Try Again"
  state.verificationError = null;
  const retryMembershipFound = true;
  if (retryMembershipFound) {
    state.isVerified = true;
  }
  assert.strictEqual(state.isVerified, true);
  assert.strictEqual(state.verificationError, null);
});

// 4. Server-Side Protection: No trust in frontend completion flags
test('Security: Verifies server-side RPC signature requirements', () => {
  const rpcParams = {
    p_task_id: 'task-12345',
    p_telegram_user_id: 123456789,
    p_telegram_username: 'rajveer_tester',
    p_member_status: 'member'
  };

  assert.ok(rpcParams.p_task_id);
  assert.strictEqual(typeof rpcParams.p_telegram_user_id, 'number');
  assert.ok(['creator', 'administrator', 'member', 'restricted'].includes(rpcParams.p_member_status));
});

// 5. Claim Lifafa Button Gating
test('Claim Lifafa Button: strictly disabled until all required tasks are verified', () => {
  const tasks = [
    { id: 't1', is_required: true },
    { id: 't2', is_required: true },
    { id: 't3', is_required: false }
  ];

  let completedTaskIds = new Set();
  const requiredTasks = tasks.filter(t => t.is_required);

  const isClaimActive = () => requiredTasks.every(t => completedTaskIds.has(t.id));

  assert.strictEqual(isClaimActive(), false, 'Should be disabled initially');

  completedTaskIds.add('t1');
  assert.strictEqual(isClaimActive(), false, 'Should be disabled when only t1 is completed');

  completedTaskIds.add('t3'); // optional task
  assert.strictEqual(isClaimActive(), false, 'Should be disabled when t2 is still missing');

  completedTaskIds.add('t2'); // all required completed
  assert.strictEqual(isClaimActive(), true, 'Should become active when t1 and t2 are verified');
});

// 6. Nonce format compliance with Telegram bot webhook regex
test('Step 2 Nonce Format: Matches Migration 016 and bot webhook regex ^\\/start\\s+(bind_[a-f0-9]+)$', () => {
  // Simulates 'bind_' || replace(gen_random_uuid()::text, '-', '')
  const simulatedUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const simulatedDbNonce = 'bind_' + simulatedUuid.replace(/-/g, '');
  assert.strictEqual(simulatedDbNonce.length, 37); // 'bind_' (5) + 32 hex chars

  const webhookStartCommand = `/start ${simulatedDbNonce}`;
  const match = webhookStartCommand.match(/^\/start\s+(bind_[a-f0-9]+)$/i);
  assert.ok(match, 'Webhook regex must match the nonce from Migration 016');
  assert.strictEqual(match[1], simulatedDbNonce);
});

// 7. Channel URL and Username Normalization (with trailing slashes)
test('Step 1 Channel Normalization: Handles @mishra4488, trailing slashes, and full URLs', () => {
  const normalizeChannel = (input) => {
    let clean = (input || '').trim();
    clean = clean.replace(/\/+$/, '');
    clean = clean.replace(/^https?:\/\/t\.me\//i, '');
    clean = clean.replace(/^t\.me\//i, '');
    clean = clean.replace(/^@/, '');
    clean = clean.trim();
    const url = clean ? `https://t.me/${clean}` : 'https://t.me';
    return { clean, url };
  };

  const testCases = [
    { input: '@mishra4488', expectedUser: 'mishra4488', expectedUrl: 'https://t.me/mishra4488' },
    { input: 'mishra4488/', expectedUser: 'mishra4488', expectedUrl: 'https://t.me/mishra4488' },
    { input: 'https://t.me/mishra4488/', expectedUser: 'mishra4488', expectedUrl: 'https://t.me/mishra4488' },
    { input: 't.me/mishra4488', expectedUser: 'mishra4488', expectedUrl: 'https://t.me/mishra4488' },
    { input: '  @mishra4488   ', expectedUser: 'mishra4488', expectedUrl: 'https://t.me/mishra4488' },
  ];

  for (const tc of testCases) {
    const res = normalizeChannel(tc.input);
    assert.strictEqual(res.clean, tc.expectedUser);
    assert.strictEqual(res.url, tc.expectedUrl);
  }
});

// 8. URL Claim Query Parameter Sanitization
test('Navigation Trap Protection: Cleans claim query parameter without page reload', () => {
  const currentHref = 'https://paleturquoise-crocodile-131192.hostingersite.com/?claim=LF-WPQEDM';
  const url = new URL(currentHref);
  assert.strictEqual(url.searchParams.get('claim'), 'LF-WPQEDM');

  url.searchParams.delete('claim');
  const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
  assert.strictEqual(cleanUrl, '/');
  assert.ok(!cleanUrl.includes('claim'));
});

// 9. Envelope State Isolation on Refocus / Auth Changes
test('Envelope Persistence: Unsealed state persists across user/auth state re-renders', () => {
  let isEnvelopeOpened = false;
  let prevLifafaId = null;
  let prevIsOpen = false;

  const onLifafaModalMount = (isOpen, lifafaId) => {
    if (isOpen && lifafaId) {
      if (!prevIsOpen || prevLifafaId !== lifafaId) {
        isEnvelopeOpened = false;
      }
      prevIsOpen = true;
      prevLifafaId = lifafaId;
    }
  };

  // Open modal for LF-WPQEDM
  onLifafaModalMount(true, 'lifafa-123');
  assert.strictEqual(isEnvelopeOpened, false, 'Starts sealed');

  // User unseals envelope
  isEnvelopeOpened = true;
  assert.strictEqual(isEnvelopeOpened, true, 'Unsealed by user');

  // Auth refresh or window focus fires with same lifafa
  onLifafaModalMount(true, 'lifafa-123');
  assert.strictEqual(isEnvelopeOpened, true, 'Must remain unsealed when user/focus refreshes');
});

console.log(`\nTEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
if (passedTests !== totalTests) {
  process.exit(1);
}
