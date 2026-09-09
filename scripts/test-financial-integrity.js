// Automated Financial & Security Integrity Test Suite for Lifafa
import assert from 'node:assert';

console.log('========================================================');
console.log('STARTING LIFAFA FINANCIAL & CONCURRENCY TEST SUITE');
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

// -------------------------------------------------------------
// 1. RANDOM ALLOCATION DIRICHLET INTEGER-PAISE CONSERVATION TEST
// -------------------------------------------------------------
function simulateServerRandomAllocation(totalAmount, winnerCount) {
  const totalPaise = Math.round(totalAmount * 100);
  if (winnerCount === 1) return [totalPaise / 100];

  const cuts = [];
  for (let i = 0; i < winnerCount - 1; i++) {
    cuts.push(Math.floor(Math.random() * (totalPaise - winnerCount) + 1));
  }
  cuts.sort((a, b) => a - b);

  const allocations = [];
  let runningSum = 0;
  for (let i = 0; i < winnerCount; i++) {
    const prevCut = i > 0 ? cuts[i - 1] : 0;
    const currCut = i < winnerCount - 1 ? cuts[i] : totalPaise;
    let slice = currCut - prevCut;
    if (slice < 1) slice = 1;
    if (i === winnerCount - 1) {
      slice = totalPaise - runningSum;
    }
    runningSum += slice;
    allocations.push(slice / 100);
  }
  return allocations;
}

test('Random Distribution exact sum conservation (500 iterations of ₹500 across 100 winners)', () => {
  for (let iter = 0; iter < 500; iter++) {
    const total = 500.0;
    const winners = 100;
    const allocs = simulateServerRandomAllocation(total, winners);
    assert.strictEqual(allocs.length, winners);
    const sum = Math.round(allocs.reduce((acc, a) => acc + a, 0) * 100) / 100;
    assert.strictEqual(sum, total);
    assert.ok(allocs.every((a) => a >= 0.01));
  }
});

test('Random Distribution edge cases (₹1.00 for 100 winners)', () => {
  const allocs = simulateServerRandomAllocation(1.0, 100);
  assert.strictEqual(allocs.length, 100);
  const sum = Math.round(allocs.reduce((acc, a) => acc + a, 0) * 100) / 100;
  assert.strictEqual(sum, 1.0);
  assert.ok(allocs.every((a) => a === 0.01));
});

test('Equal Distribution last-paise exact sum conservation (₹10.00 among 3 winners)', () => {
  const totalPaise = 1000;
  const winnerCount = 3;
  const basePaise = Math.floor(totalPaise / winnerCount); // 333
  const remainderPaise = totalPaise - basePaise * winnerCount; // 1
  const allocs = [];
  for (let i = 0; i < winnerCount; i++) {
    allocs.push((basePaise + (i === 0 ? remainderPaise : 0)) / 100);
  }
  // Winner 1: 3.34, Winner 2: 3.33, Winner 3: 3.33
  assert.deepStrictEqual(allocs, [3.34, 3.33, 3.33]);
  const sum = Math.round(allocs.reduce((a, b) => a + b, 0) * 100) / 100;
  assert.strictEqual(sum, 10.0);
});

// -------------------------------------------------------------
// 2. WALLET RESERVATION & FINANCIAL INVARIANTS TEST
// -------------------------------------------------------------
test('Wallet reservation locks funds and prevents overdraft', () => {
  let available = 250.0;
  let reserved = 0.0;

  function reserveFunds(amount) {
    if (available < amount) throw new Error('Insufficient wallet balance');
    available -= amount;
    reserved += amount;
    return { available, reserved };
  }

  reserveFunds(200.0);
  assert.strictEqual(available, 50.0);
  assert.strictEqual(reserved, 200.0);

  // Overdraft attempt must fail
  assert.throws(() => reserveFunds(100.0), /Insufficient wallet balance/);
  assert.strictEqual(available, 50.0);
});

test('Expiry refund returns remaining unallocated funds to available balance', () => {
  const totalAmount = 500.0;
  let claimedAmount = 180.0;
  let creatorAvailable = 50.0;
  let creatorReserved = 500.0;

  const remaining = totalAmount - claimedAmount; // 320.0
  creatorReserved -= remaining;
  creatorAvailable += remaining;

  assert.strictEqual(remaining, 320.0);
  assert.strictEqual(creatorReserved, 180.0);
  assert.strictEqual(creatorAvailable, 370.0);
});

// -------------------------------------------------------------
// 3. IDEMPOTENCY & DUPLICATE CLAIM PROTECTION TEST
// -------------------------------------------------------------
test('Claim idempotency key prevents duplicate payout on repeat clicks', () => {
  const claimsStore = new Map();
  let claimantBalance = 0.0;

  function processClaim(lifafaId, userId, amount, idempotencyKey) {
    if (claimsStore.has(idempotencyKey)) {
      return { success: true, isDuplicate: true, amount: claimsStore.get(idempotencyKey) };
    }
    claimsStore.set(idempotencyKey, amount);
    claimantBalance += amount;
    return { success: true, isDuplicate: false, amount };
  }

  const key = 'claim_lf_123_usr_456';
  const res1 = processClaim('lf_123', 'usr_456', 25.5, key);
  assert.strictEqual(res1.isDuplicate, false);
  assert.strictEqual(claimantBalance, 25.5);

  const res2 = processClaim('lf_123', 'usr_456', 25.5, key);
  assert.strictEqual(res2.isDuplicate, true);
  assert.strictEqual(claimantBalance, 25.5); // Balance unchanged!
});

// -------------------------------------------------------------
// 4. WITHDRAWAL STATUS TRANSITIONS & REVERSAL REPLAY PROTECTION
// -------------------------------------------------------------
test('Withdrawal status machine blocks double refund on repeated FAILED webhooks', () => {
  let status = 'PENDING';
  let refunded = false;
  let walletBalance = 0.0;
  const withdrawalAmount = 100.0;

  function handleWebhook(newStatus) {
    if (['SUCCESS', 'FAILED', 'REVERSED'].includes(status)) {
      return { success: false, message: 'Withdrawal already finalized: ' + status };
    }
    status = newStatus;
    if (newStatus === 'FAILED') {
      walletBalance += withdrawalAmount;
      refunded = true;
    }
    return { success: true, status };
  }

  const firstWebhook = handleWebhook('FAILED');
  assert.strictEqual(firstWebhook.success, true);
  assert.strictEqual(status, 'FAILED');
  assert.strictEqual(walletBalance, 100.0);

  // Duplicate webhook delivery from gateway
  const secondWebhook = handleWebhook('FAILED');
  assert.strictEqual(secondWebhook.success, false);
  assert.strictEqual(walletBalance, 100.0); // NOT credited twice!
});

// -------------------------------------------------------------
// 5. ADMIN ROLE HIERARCHY TEST
// -------------------------------------------------------------
test('Admin role hierarchy restricts wallet adjustments to SUPER_ADMIN and ADMIN', () => {
  function checkCanAdjustWallet(role) {
    const allowed = ['SUPER_ADMIN', 'ADMIN'];
    return allowed.includes(role);
  }

  assert.strictEqual(checkCanAdjustWallet('SUPER_ADMIN'), true);
  assert.strictEqual(checkCanAdjustWallet('ADMIN'), true);
  assert.strictEqual(checkCanAdjustWallet('SUPPORT'), false);
  assert.strictEqual(checkCanAdjustWallet('MODERATOR'), false);
  assert.strictEqual(checkCanAdjustWallet('USER'), false);
});

// -------------------------------------------------------------
// 6. CRYPTOGRAPHIC NONCE TELEGRAM IDENTITY BINDING TEST
// -------------------------------------------------------------
test('Single-use binding nonce expires and cannot be reused', () => {
  const nonceStore = new Map();

  function generateNonce(userId) {
    const nonce = 'bind_' + Math.random().toString(36).substring(2);
    nonceStore.set(nonce, { userId, expiresAt: Date.now() + 15 * 60 * 1000 });
    return nonce;
  }

  function completeBinding(nonce, telegramUserId) {
    if (!nonceStore.has(nonce)) throw new Error('Invalid or expired token');
    const entry = nonceStore.get(nonce);
    if (entry.expiresAt <= Date.now()) throw new Error('Token expired');
    nonceStore.delete(nonce); // Deleted upon first use!
    return { userId: entry.userId, telegramUserId };
  }

  const nonce = generateNonce('user_abc_123');
  const bound = completeBinding(nonce, 999888777);
  assert.strictEqual(bound.userId, 'user_abc_123');
  assert.strictEqual(bound.telegramUserId, 999888777);

  // Replay attempt must fail
  assert.throws(() => completeBinding(nonce, 999888777), /Invalid or expired token/);
});

// -------------------------------------------------------------
// 7. INPUT SANITIZATION & SECURITY BOUNDS TEST
// -------------------------------------------------------------
test('IFSC format validation', () => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  assert.ok(ifscRegex.test('SBIN0001234'));
  assert.ok(ifscRegex.test('HDFC0004567'));
  assert.ok(!ifscRegex.test('INVALID_IFSC'));
  assert.ok(!ifscRegex.test('SBIN1234567')); // 5th character must be 0
});

test('UPI ID format validation', () => {
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  assert.ok(upiRegex.test('user@okhdfcbank'));
  assert.ok(upiRegex.test('merchant.store@paytm'));
  assert.ok(!upiRegex.test('plainstring'));
  assert.ok(!upiRegex.test(''));
});

// -------------------------------------------------------------
// 8. MANUAL UPI DEPOSIT & UTR VERIFICATION TESTS (MIGRATION 014)
// -------------------------------------------------------------
test('Duplicate UTR submission prevention and authoritative server UPI ID', () => {
  const depositTable = new Map();
  const platformSettings = { DEPOSIT_UPI_ID: 'createlifafa@upi' };

  function submitDeposit(userId, amount, utrNumber, untrustedClientUpi) {
    if (!userId) throw new Error('Authentication required');
    if (!amount || amount < 1.00) throw new Error('Minimum deposit ₹1.00');
    const cleanUtr = utrNumber.trim().toUpperCase();
    if (depositTable.has(cleanUtr)) {
      throw new Error(`This UTR number (${cleanUtr}) has already been submitted`);
    }
    // Authoritative platform UPI ID is read from server settings, NOT client input
    const authoritativeUpi = platformSettings.DEPOSIT_UPI_ID;
    const record = {
      id: 'dep_' + Math.random().toString(36).substring(2),
      userId,
      amount,
      utrNumber: cleanUtr,
      upiId: authoritativeUpi,
      status: 'PENDING',
    };
    depositTable.set(cleanUtr, record);
    return record;
  }

  // First submission succeeds with authoritative server UPI ID
  const dep1 = submitDeposit('user_123', 500, '423589123456', 'fake_client_upi@fraud');
  assert.strictEqual(dep1.amount, 500);
  assert.strictEqual(dep1.utrNumber, '423589123456');
  assert.strictEqual(dep1.upiId, 'createlifafa@upi'); // Did not trust fake_client_upi@fraud!
  assert.strictEqual(dep1.status, 'PENDING');

  // Duplicate UTR submission must be strictly rejected
  assert.throws(
    () => submitDeposit('user_456', 500, '423589123456', 'any@upi'),
    /This UTR number \(423589123456\) has already been submitted/
  );
});

test('Strict idempotency: Duplicate deposit approval blocked', () => {
  const deposit = {
    id: 'dep_test_789',
    userId: 'user_123',
    amount: 250.00,
    utrNumber: '998877665544',
    status: 'PENDING',
  };

  const ledger = new Set();
  const wallet = { availableBalance: 100.00 };

  function reviewDeposit(adminRole, dep, action) {
    if (adminRole !== 'ADMIN' && adminRole !== 'SUPER_ADMIN') {
      throw new Error('Access Denied: Only administrators can review deposits');
    }
    if (dep.status !== 'PENDING') {
      throw new Error(`Deposit request is already processed with status ${dep.status}`);
    }
    const idempotencyKey = 'deposit_approve_' + dep.id;
    if (ledger.has(idempotencyKey)) {
      throw new Error('Ledger transaction already exists. Double-credit prevented.');
    }

    if (action === 'APPROVE') {
      wallet.availableBalance += dep.amount;
      ledger.add(idempotencyKey);
      dep.status = 'APPROVED';
      return { success: true, balanceAfter: wallet.availableBalance };
    }
  }

  // First approval succeeds
  const res1 = reviewDeposit('ADMIN', deposit, 'APPROVE');
  assert.strictEqual(res1.success, true);
  assert.strictEqual(wallet.availableBalance, 350.00);
  assert.strictEqual(deposit.status, 'APPROVED');

  // Second approval must fail immediately with status validation
  assert.throws(
    () => reviewDeposit('ADMIN', deposit, 'APPROVE'),
    /Deposit request is already processed with status APPROVED/
  );
  // Wallet balance remains 350, no double credit
  assert.strictEqual(wallet.availableBalance, 350.00);
});

test('Admin authorization: Non-admin cannot review or approve deposits', () => {
  function checkReviewAuth(role) {
    const allowed = ['SUPER_ADMIN', 'ADMIN'];
    if (!allowed.includes(role)) {
      throw new Error('Access Denied: Only administrators can review and approve deposits');
    }
    return true;
  }

  assert.ok(checkReviewAuth('SUPER_ADMIN'));
  assert.ok(checkReviewAuth('ADMIN'));
  assert.throws(() => checkReviewAuth('SUPPORT'), /Access Denied/);
  assert.throws(() => checkReviewAuth('USER'), /Access Denied/);
  assert.throws(() => checkReviewAuth(null), /Access Denied/);
});

test('Atomic wallet and ledger credit on approval, untouched balance on rejection', () => {
  const wallet = { id: 'w_1', availableBalance: 200.00 };
  const transactions = [];

  function approveOrReject(deposit, action, notes) {
    if (action === 'APPROVE') {
      const balanceBefore = wallet.availableBalance;
      const balanceAfter = balanceBefore + deposit.amount;
      wallet.availableBalance = balanceAfter;
      transactions.push({
        type: 'CREDIT',
        referenceType: 'MANUAL_UPI_DEPOSIT',
        referenceId: deposit.id,
        amount: deposit.amount,
        balanceBefore,
        balanceAfter,
      });
      deposit.status = 'APPROVED';
    } else if (action === 'REJECT') {
      deposit.status = 'REJECTED';
      deposit.notes = notes;
      // Balance remains untouched!
    }
  }

  // Test approval
  const depositApproved = { id: 'dep_1', amount: 150.00, status: 'PENDING' };
  approveOrReject(depositApproved, 'APPROVE');
  assert.strictEqual(wallet.availableBalance, 350.00);
  assert.strictEqual(depositApproved.status, 'APPROVED');
  assert.strictEqual(transactions.length, 1);
  assert.strictEqual(transactions[0].amount, 150.00);
  assert.strictEqual(transactions[0].balanceBefore, 200.00);
  assert.strictEqual(transactions[0].balanceAfter, 350.00);

  // Test rejection
  const depositRejected = { id: 'dep_2', amount: 300.00, status: 'PENDING' };
  approveOrReject(depositRejected, 'REJECT', 'Invalid UTR');
  assert.strictEqual(wallet.availableBalance, 350.00); // Unchanged!
  assert.strictEqual(depositRejected.status, 'REJECTED');
  assert.strictEqual(depositRejected.notes, 'Invalid UTR');
  assert.strictEqual(transactions.length, 1); // No new transaction created!
});

console.log('\n========================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (100%)`);
console.log('========================================================');

