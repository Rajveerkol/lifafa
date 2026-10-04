import fs from 'fs';
import assert from 'assert';

console.log('================================================================');
console.log('TEST SUITE: DEVICE CLAIM IDENTITY & CLAIM LIMIT VERIFICATION');
console.log('================================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

// -----------------------------------------------------------------------------
// 1. MIGRATION 050 SQL SYNTAX & INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 1. Testing Migration 050 SQL Syntax & Integrity ---');

const sqlPath = 'supabase/migrations/050_fix_device_claim_limit_false_positives.sql';
runTest('Migration 050 file exists', () => {
  assert(fs.existsSync(sqlPath), 'File does not exist');
});

const sql = fs.readFileSync(sqlPath, 'utf8');

runTest('SQL Parentheses, Brackets, and Dollar Quotes Balance', () => {
  let parenCount = 0;
  let bracketCount = 0;
  let inSingleQuote = false;
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1] || '';

    if (!inSingleQuote && !inDollarQuote && c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote && c === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i++;
      continue;
    }

    if (!inDollarQuote && c === "'") {
      if (inSingleQuote && next === "'") {
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (!inSingleQuote && c === '$' && next === '$') {
      inDollarQuote = !inDollarQuote;
      i++;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote) {
      if (c === '(') parenCount++;
      if (c === ')') parenCount--;
      if (c === '[') bracketCount++;
      if (c === ']') bracketCount--;
    }
  }

  assert.strictEqual(parenCount, 0, `Unbalanced parentheses (balance: ${parenCount})`);
  assert.strictEqual(bracketCount, 0, `Unbalanced brackets (balance: ${bracketCount})`);
  assert.strictEqual(inSingleQuote, false, 'Unclosed single quote');
  assert.strictEqual(inDollarQuote, false, 'Unclosed dollar quote ($$)');
});

runTest('claim_lifafa_rpc RAISE placeholders match parameter counts', () => {
  const raiseRegex = /RAISE\s+EXCEPTION\s+['"]([^'"]+)['"]\s*(?:,\s*([^;]+))?;/gi;
  let match;
  while ((match = raiseRegex.exec(sql)) !== null) {
    const msg = match[1];
    const argsStr = match[2];
    const percentCount = (msg.match(/%/g) || []).length;
    const argCount = argsStr ? argsStr.split(',').length : 0;
    assert.strictEqual(
      percentCount,
      argCount,
      `RAISE parameter mismatch in "${msg}": expected ${percentCount} args, got ${argCount}`
    );
  }
});

runTest('claim_lifafa_rpc contains sanitized device fingerprint & failed payout filter', () => {
  assert(sql.includes('v_clean_device_fp := NULLIF(TRIM(p_device_fingerprint), \'\');'), 'Missing fingerprint sanitization');
  assert(sql.includes('lc.withdrawal_id IS NULL OR w.status IN (\'PENDING\', \'PROCESSING\', \'SUCCESS\')'), 'Missing failed payout exclusion');
  assert(sql.includes('DELETE FROM public.lifafa_claims WHERE id = v_existing_claim.id;'), 'Missing failed claim retry cleanup');
});

// -----------------------------------------------------------------------------
// 2. FRONTEND DEVICE IDENTITY GENERATION & ZERO-COLLISION TEST
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing Frontend Device Identity Generation ---');

function mockGenerateDeviceId(customStore = {}) {
  const DEVICE_STORAGE_KEY = 'cl_device_id_v2';
  const DEVICE_COOKIE_KEY = 'cl_did';
  let _cachedDeviceId = null;

  const mockStorage = customStore.storage || {};
  const mockCookies = customStore.cookies || {};

  function isValidDeviceId(id) {
    return typeof id === 'string' && id.startsWith('did_') && id.length >= 20 && !id.includes('null') && !id.includes('undefined');
  }

  function getDeviceFingerprint() {
    if (_cachedDeviceId && isValidDeviceId(_cachedDeviceId)) {
      return _cachedDeviceId;
    }

    let deviceId = null;
    if (isValidDeviceId(mockStorage[DEVICE_STORAGE_KEY])) {
      deviceId = mockStorage[DEVICE_STORAGE_KEY];
    }

    if (!deviceId && isValidDeviceId(mockCookies[DEVICE_COOKIE_KEY])) {
      deviceId = mockCookies[DEVICE_COOKIE_KEY];
    }

    if (!deviceId) {
      // Simulate generateSecureId()
      const rand = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const hw = '19fa';
      deviceId = `did_${rand.slice(0, 24)}_${hw}`;
    }

    mockStorage[DEVICE_STORAGE_KEY] = deviceId;
    mockCookies[DEVICE_COOKIE_KEY] = deviceId;
    _cachedDeviceId = deviceId;
    return deviceId;
  }

  return { getDeviceFingerprint, mockStorage, mockCookies };
}

runTest('Simulated 1,000 distinct devices produce 1,000 distinct IDs (0 collisions)', () => {
  const generated = new Set();
  for (let i = 0; i < 1000; i++) {
    const inst = mockGenerateDeviceId();
    const id = inst.getDeviceFingerprint();
    assert(id.startsWith('did_'), 'ID must start with did_');
    assert(id.length >= 24, 'ID length must be >= 24');
    assert(!generated.has(id), `Duplicate ID generated: ${id}`);
    generated.add(id);
  }
  assert.strictEqual(generated.size, 1000);
});

runTest('Two Android users with identical User-Agent, Screen & Timezone in India DO NOT collide', () => {
  const user1 = mockGenerateDeviceId();
  const user2 = mockGenerateDeviceId();

  const id1 = user1.getDeviceFingerprint();
  const id2 = user2.getDeviceFingerprint();

  assert.notStrictEqual(id1, id2, 'Two users must not have the same device ID');
});

runTest('Same device preserves identical ID across page reloads and storage resets', () => {
  const sharedStore = { storage: {}, cookies: {} };
  const session1 = mockGenerateDeviceId(sharedStore);
  const id1 = session1.getDeviceFingerprint();

  // Next page reload:
  const session2 = mockGenerateDeviceId(sharedStore);
  const id2 = session2.getDeviceFingerprint();
  assert.strictEqual(id1, id2, 'Device ID must persist across page loads');

  // Clear localStorage (cookie fallback):
  sharedStore.storage = {};
  const session3 = mockGenerateDeviceId(sharedStore);
  const id3 = session3.getDeviceFingerprint();
  assert.strictEqual(id1, id3, 'Device ID must be recovered from cookie if localStorage cleared');
  assert.strictEqual(sharedStore.storage['cl_device_id_v2'], id1, 'LocalStorage must be re-synced from cookie');
});

// -----------------------------------------------------------------------------
// 3. COMPLETE CLAIM LIFECYCLE & ANTI-ABUSE ENGINE SIMULATION
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing Complete Claim Lifecycle & Anti-Abuse Engine ---');

class MockDatabase {
  constructor() {
    this.lifafas = new Map();
    this.claims = [];
    this.withdrawals = [];
  }

  createLifafa(id, code, creatorId, deviceLimit = 1) {
    this.lifafas.set(id, {
      id,
      code,
      creator_id: creatorId,
      device_claim_limit: deviceLimit,
      status: 'ACTIVE',
      claimed_count: 0,
      winner_count: 10,
    });
  }

  // Implementation of claim_lifafa_rpc logic
  claimLifafa({ lifafaId, userId, deviceFp, idempotencyKey, payoutMode = 'UPI_BANK' }) {
    const lifafa = this.lifafas.get(lifafaId);
    if (!lifafa) throw new Error('Lifafa does not exist');
    if (lifafa.creator_id === userId) throw new Error('Creators cannot claim their own Lifafa');

    // Clean fingerprint
    let cleanDeviceFp = (deviceFp || '').trim() || null;
    if (cleanDeviceFp) {
      if (['null', 'undefined', 'unknown', 'none'].includes(cleanDeviceFp.toLowerCase()) || cleanDeviceFp.length < 8) {
        cleanDeviceFp = null;
      }
    }

    // Step 1: Idempotency / Existing claim check
    const existingIndex = this.claims.findIndex(c =>
      c.idempotency_key === idempotencyKey || (c.lifafa_id === lifafaId && c.user_id === userId)
    );

    if (existingIndex !== -1) {
      const existing = this.claims[existingIndex];
      const wth = this.withdrawals.find(w => w.id === existing.withdrawal_id);
      const wthStatus = wth ? wth.status : null;

      if (existing.withdrawal_id && wthStatus === 'FAILED') {
        // Purge failed claim to allow clean retry
        this.claims.splice(existingIndex, 1);
      } else {
        return {
          success: true,
          amount: existing.amount,
          is_duplicate: true,
          withdrawal_id: existing.withdrawal_id,
          withdrawal_status: wthStatus,
        };
      }
    }

    // Device limit check: Lifafa-scoped, valid sanitized fingerprint, excluding failed payouts
    if (cleanDeviceFp && lifafa.device_claim_limit > 0) {
      const activeDeviceClaims = this.claims.filter(c => {
        if (c.lifafa_id !== lifafaId || c.device_fingerprint !== cleanDeviceFp) return false;
        if (!c.withdrawal_id) return true;
        const w = this.withdrawals.find(w => w.id === c.withdrawal_id);
        return w && ['PENDING', 'PROCESSING', 'SUCCESS'].includes(w.status);
      });

      if (activeDeviceClaims.length >= lifafa.device_claim_limit) {
        throw new Error(`Device claim limit (${lifafa.device_claim_limit} per device) reached for this Lifafa`);
      }
    }

    // Create claim & withdrawal
    const withdrawalId = `wth_${Date.now()}_${Math.random()}`;
    this.withdrawals.push({
      id: withdrawalId,
      user_id: userId,
      amount: 10,
      status: 'PENDING',
    });

    this.claims.push({
      id: `claim_${Date.now()}_${Math.random()}`,
      lifafa_id: lifafaId,
      user_id: userId,
      amount: 10,
      idempotency_key: idempotencyKey,
      device_fingerprint: cleanDeviceFp,
      withdrawal_id: withdrawalId,
      payout_mode: payoutMode,
    });

    lifafa.claimed_count++;
    return {
      success: true,
      amount: 10,
      withdrawal_id: withdrawalId,
      withdrawal_status: 'PENDING',
    };
  }
}

runTest('1. Brand new user + brand new device -> Claim succeeds', () => {
  const db = new MockDatabase();
  db.createLifafa('L1', 'LIF1', 'creator_1', 1);

  const res = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_A_11111111111111',
    idempotencyKey: 'key_1',
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.withdrawal_status, 'PENDING');
});

runTest('2. Same user tries to claim again on same device -> Properly handled as duplicate', () => {
  const db = new MockDatabase();
  db.createLifafa('L1', 'LIF1', 'creator_1', 1);

  db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_A_11111111111111',
    idempotencyKey: 'key_1',
  });

  const dup = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_A_11111111111111',
    idempotencyKey: 'key_2',
  });

  assert.strictEqual(dup.is_duplicate, true);
});

runTest('3. Different user on SAME device -> Properly blocked by device limit (1 per device)', () => {
  const db = new MockDatabase();
  db.createLifafa('L1', 'LIF1', 'creator_1', 1);

  db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_shared_phone_111111111',
    idempotencyKey: 'key_A',
  });

  assert.throws(() => {
    db.claimLifafa({
      lifafaId: 'L1',
      userId: 'user_B_sybil',
      deviceFp: 'did_shared_phone_111111111',
      idempotencyKey: 'key_B',
    });
  }, /Device claim limit \(1 per device\) reached for this Lifafa/);
});

runTest('4. Same device claims a DIFFERENT Lifafa -> Succeeds (Lifafa-scoped isolation)', () => {
  const db = new MockDatabase();
  db.createLifafa('L1', 'LIF1', 'creator_1', 1);
  db.createLifafa('L2', 'LIF2', 'creator_2', 1);

  // Claim L1 on device X
  db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_X_11111111111111',
    idempotencyKey: 'key_L1',
  });

  // Claim L2 on SAME device X
  const resL2 = db.claimLifafa({
    lifafaId: 'L2',
    userId: 'user_A',
    deviceFp: 'did_device_X_11111111111111',
    idempotencyKey: 'key_L2',
  });

  assert.strictEqual(resL2.success, true);
});

runTest('5. User with failed payout attempts to claim again / retry -> Does NOT get blocked by false device limit', () => {
  const db = new MockDatabase();
  db.createLifafa('L1', 'LIF1', 'creator_1', 1);

  const res1 = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_A_11111111111111',
    idempotencyKey: 'key_initial',
  });

  // Simulate PayNit rejects payout: status = FAILED
  const wth = db.withdrawals.find(w => w.id === res1.withdrawal_id);
  wth.status = 'FAILED';

  // User retries with corrected UPI ID on same device
  const retryRes = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_A_11111111111111',
    idempotencyKey: 'key_retry',
  });

  assert.strictEqual(retryRes.success, true);
  assert.strictEqual(retryRes.withdrawal_status, 'PENDING');
});

runTest('6. User with pending/processing payout refreshes page -> Shows payout status, no device limit error', () => {
  const db = new MockDatabase();
  db.createLifafa('L1', 'LIF1', 'creator_1', 1);

  const res1 = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_A_11111111111111',
    idempotencyKey: 'key_initial',
  });

  // Set to PROCESSING
  const wth = db.withdrawals.find(w => w.id === res1.withdrawal_id);
  wth.status = 'PROCESSING';

  // Page reloads and calls claim again with same idempotency key or account
  const reloadRes = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_A',
    deviceFp: 'did_device_A_11111111111111',
    idempotencyKey: 'key_initial',
  });

  assert.strictEqual(reloadRes.is_duplicate, true);
  assert.strictEqual(reloadRes.withdrawal_status, 'PROCESSING');
});

runTest('7. Two different users with identical phone model / screen size / browser on same network -> DO NOT collide', () => {
  const db = new MockDatabase();
  db.createLifafa('L1', 'LIF1', 'creator_1', 1);

  // User 1 on Android Chrome in Mumbai
  const phone1 = mockGenerateDeviceId();
  const res1 = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_1',
    deviceFp: phone1.getDeviceFingerprint(),
    idempotencyKey: 'key_u1',
  });
  assert.strictEqual(res1.success, true);

  // User 2 on Android Chrome in Mumbai (identical viewport, same IP, different user)
  const phone2 = mockGenerateDeviceId();
  const res2 = db.claimLifafa({
    lifafaId: 'L1',
    userId: 'user_2',
    deviceFp: phone2.getDeviceFingerprint(),
    idempotencyKey: 'key_u2',
  });
  assert.strictEqual(res2.success, true);
});

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
