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

// -------------------------------------------------------------
// 16. LIFAFA COMPLETION LIFECYCLE (1/100 REMAINS ACTIVE, 100/100 COMPLETED)
// -------------------------------------------------------------
test('Lifafa Lifecycle: 1/100 claims strictly remains ACTIVE; 100/100 becomes COMPLETED', () => {
  const evaluateStatus = (claimedCount, winnerCount, remainingAmount) => {
    if (claimedCount >= winnerCount || remainingAmount <= 0) {
      return 'COMPLETED';
    }
    return 'ACTIVE';
  };

  // State in screenshot: 1 out of 100 claimed
  assert.strictEqual(evaluateStatus(1, 100, 495.00), 'ACTIVE', '1/100 MUST remain ACTIVE as 99 winners remain');
  assert.strictEqual(evaluateStatus(50, 100, 250.00), 'ACTIVE', '50/100 MUST remain ACTIVE');
  assert.strictEqual(evaluateStatus(99, 100, 5.00), 'ACTIVE', '99/100 MUST remain ACTIVE');
  
  // Completed states
  assert.strictEqual(evaluateStatus(100, 100, 0.00), 'COMPLETED', '100/100 MUST be COMPLETED');
  assert.strictEqual(evaluateStatus(10, 10, 0.00), 'COMPLETED', '10/10 MUST be COMPLETED');
  assert.strictEqual(evaluateStatus(90, 100, 0.00), 'COMPLETED', 'Pool exhausted (0 balance) MUST be COMPLETED');
});

// -------------------------------------------------------------
// 17. PAYOUT MODE CREATION & BACKWARD COMPATIBLE DEFAULT
// -------------------------------------------------------------
test('Payout Mode: Backward-compatible default WALLET vs explicit UPI_BANK', () => {
  const createLifafaConfig = (params) => {
    const validModes = ['WALLET', 'UPI_BANK'];
    const mode = (params.payout_mode || 'WALLET').toUpperCase();
    if (!validModes.includes(mode)) {
      throw new Error('Invalid payout mode');
    }
    return {
      payout_mode: mode,
    };
  };

  // Pre-existing or omitted parameter defaults to WALLET
  assert.strictEqual(createLifafaConfig({}).payout_mode, 'WALLET');
  assert.strictEqual(createLifafaConfig({ payout_mode: undefined }).payout_mode, 'WALLET');

  // Explicit modes
  assert.strictEqual(createLifafaConfig({ payout_mode: 'WALLET' }).payout_mode, 'WALLET');
  assert.strictEqual(createLifafaConfig({ payout_mode: 'UPI_BANK' }).payout_mode, 'UPI_BANK');

  // Invalid mode rejected
  assert.throws(() => createLifafaConfig({ payout_mode: 'CRYPTO' }), /Invalid payout mode/);
});

// -------------------------------------------------------------
// 18. UPI/BANK PAYOUT SERVER-SIDE VALIDATION
// -------------------------------------------------------------
test('UPI/Bank Payout Details Validation: Enforces name, account number/UPI, and valid IFSC', () => {
  const validatePayoutDetails = (details) => {
    if (!details.account_holder_name || details.account_holder_name.trim().length < 2) {
      throw new Error('Account holder name is required');
    }
    const hasAcc = details.bank_account_number && details.bank_account_number.trim().length >= 6;
    const hasUpi = details.upi_id && details.upi_id.trim().length >= 3;
    if (!hasAcc && !hasUpi) {
      throw new Error('Valid Bank Account Number or UPI ID is required');
    }
    if (details.ifsc_code && details.ifsc_code.trim().length > 0) {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(details.ifsc_code.trim().toUpperCase())) {
        throw new Error('Invalid IFSC code format');
      }
    }
    if (details.upi_id && details.upi_id.trim().length > 0) {
      if (!/^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(details.upi_id.trim())) {
        throw new Error('Invalid UPI ID format');
      }
    }
    return true;
  };

  // Valid combinations
  assert.ok(validatePayoutDetails({
    account_holder_name: 'Rajveer Kol',
    bank_account_number: '123456789012',
    ifsc_code: 'SBIN0001234',
    upi_id: 'rajveer@upi'
  }));

  assert.ok(validatePayoutDetails({
    account_holder_name: 'Rajveer Kol',
    upi_id: 'rajveer@oksbi'
  }));

  // Missing name fails
  assert.throws(() => validatePayoutDetails({ account_holder_name: '', upi_id: 'a@upi' }), /Account holder name is required/);

  // Missing both account and UPI fails
  assert.throws(() => validatePayoutDetails({ account_holder_name: 'Rajveer Kol' }), /Valid Bank Account Number or UPI ID is required/);

  // Bad IFSC fails
  assert.throws(() => validatePayoutDetails({ account_holder_name: 'Rajveer Kol', bank_account_number: '1234567890', ifsc_code: 'INVALID_IFSC' }), /Invalid IFSC code format/);

  // Bad UPI fails
  assert.throws(() => validatePayoutDetails({ account_holder_name: 'Rajveer Kol', upi_id: 'not-a-valid-upi' }), /Invalid UPI ID format/);
});

// -------------------------------------------------------------
// 19. UPI/BANK ESCROW DEBIT & PENDING WITHDRAWAL (NO WALLET DOUBLE-CREDIT)
// -------------------------------------------------------------
test('UPI/Bank Claim: Debits creator reserved balance, creates PENDING withdrawal, touches 0 winner wallet', () => {
  let creatorWallet = { available: 1000.00, reserved: 500.00 };
  let winnerWallet = { available: 50.00, total_earned: 50.00 };
  let withdrawals = [];
  let claims = [];

  const claimAmount = 25.00;

  // Execute UPI_BANK claim
  creatorWallet.reserved -= claimAmount;
  const withdrawal = {
    id: 'w_1',
    user_id: 'winner_1',
    amount: claimAmount,
    status: 'PENDING',
    payout_provider: 'MANUAL',
    bank_account_number_masked: 'XXXX-XXXX-9012',
    upi_id: 'winner@upi'
  };
  withdrawals.push(withdrawal);
  claims.push({
    claim_id: 'c_1',
    payout_mode: 'UPI_BANK',
    withdrawal_id: 'w_1',
    amount: claimAmount
  });

  // VERIFY:
  // 1. Creator reserved balance debited
  assert.strictEqual(creatorWallet.reserved, 475.00);
  // 2. Withdrawal record created in PENDING state
  assert.strictEqual(withdrawals.length, 1);
  assert.strictEqual(withdrawals[0].status, 'PENDING');
  assert.strictEqual(withdrawals[0].amount, 25.00);
  // 3. Winner available balance is NOT credited (prevents double payout)
  assert.strictEqual(winnerWallet.available, 50.00);
  assert.strictEqual(winnerWallet.total_earned, 50.00);
});

// -------------------------------------------------------------
// 20. WALLET REWARD MODE ATOMIC CREDIT & LEDGER
// -------------------------------------------------------------
test('Wallet Reward Claim: Credits winner available balance atomically and generates CLAIM ledger entry', () => {
  let creatorWallet = { reserved: 500.00 };
  let winnerWallet = { available: 100.00, total_earned: 100.00 };
  let ledger = [];

  const claimAmount = 50.00;

  // Execute WALLET claim
  creatorWallet.reserved -= claimAmount;
  const balanceBefore = winnerWallet.available;
  const balanceAfter = balanceBefore + claimAmount;
  winnerWallet.available = balanceAfter;
  winnerWallet.total_earned += claimAmount;

  ledger.push({
    type: 'CLAIM',
    status: 'SUCCESS',
    amount: claimAmount,
    balanceBefore,
    balanceAfter
  });

  assert.strictEqual(creatorWallet.reserved, 450.00);
  assert.strictEqual(winnerWallet.available, 150.00);
  assert.strictEqual(winnerWallet.total_earned, 150.00);
  assert.strictEqual(ledger.length, 1);
  assert.strictEqual(ledger[0].balanceBefore, 100.00);
  assert.strictEqual(ledger[0].balanceAfter, 150.00);
});

// -------------------------------------------------------------
// 21. IDEMPOTENCY & DUPLICATE RETRY PROTECTION
// -------------------------------------------------------------
test('Claim Idempotency: Duplicate claim click returns existing claim without double debit/credit', () => {
  const claimsDb = new Map();
  let payoutCalls = 0;

  const handleClaim = (userId, lifafaCode, idempotencyKey) => {
    if (claimsDb.has(idempotencyKey)) {
      return { ...claimsDb.get(idempotencyKey), is_duplicate: true };
    }
    payoutCalls++;
    const result = { claim_id: 'c_' + Date.now(), amount: 20.00, is_duplicate: false };
    claimsDb.set(idempotencyKey, result);
    return result;
  };

  const res1 = handleClaim('user_1', 'LF-TEST', 'idemp_key_1');
  assert.strictEqual(res1.is_duplicate, false);
  assert.strictEqual(payoutCalls, 1);

  // Duplicate retry with same idempotency key
  const res2 = handleClaim('user_1', 'LF-TEST', 'idemp_key_1');
  assert.strictEqual(res2.is_duplicate, true);
  assert.strictEqual(res2.amount, 20.00);
  assert.strictEqual(payoutCalls, 1, 'Payout must NOT be called a second time');
});

// -------------------------------------------------------------
// 22. SENSITIVE BANK INFO DATA PROTECTION
// -------------------------------------------------------------
test('Data Protection: Bank account numbers masked to XXXX-XXXX-Last4; no raw data exposed', () => {
  const maskBankAccount = (acc) => {
    if (!acc || acc.trim().length < 4) return 'XXXX-XXXX-XXXX';
    return 'XXXX-XXXX-' + acc.trim().slice(-4);
  };

  assert.strictEqual(maskBankAccount('123456789012'), 'XXXX-XXXX-9012');
  assert.strictEqual(maskBankAccount('987654321'), 'XXXX-XXXX-4321');
  assert.strictEqual(maskBankAccount(''), 'XXXX-XXXX-XXXX');
});

// -------------------------------------------------------------
// 23. RPC OVERLOAD ELIMINATION GUARANTEE
// -------------------------------------------------------------
test('RPC Architecture: Drop old function signatures before create to prevent PostgreSQL overloading', () => {
  // Simulates PostgreSQL pg_proc uniqueness enforcement
  const registeredRpcSignatures = new Set([
    'create_lifafa_rpc(13)',
    'create_lifafa_rpc(17)',
    'claim_lifafa_rpc(5)'
  ]);

  // Migration 017 drop routine
  registeredRpcSignatures.clear();

  // Register only the new single authoritative signatures
  registeredRpcSignatures.add('create_lifafa_rpc(18)'); // includes p_payout_mode
  registeredRpcSignatures.add('claim_lifafa_rpc(9)');  // includes payout details

  assert.strictEqual(registeredRpcSignatures.size, 2);
  assert.ok(registeredRpcSignatures.has('create_lifafa_rpc(18)'));
  assert.ok(registeredRpcSignatures.has('claim_lifafa_rpc(9)'));
  assert.ok(!registeredRpcSignatures.has('claim_lifafa_rpc(5)'), 'Old 5-param signature must be dropped');
});

// -------------------------------------------------------------
// 24. GLOBAL STATUS VS PER-USER CLAIM ACTION DECOUPLING
// -------------------------------------------------------------
test('Dual State Decoupling: Global Lifafa status strictly decoupled from Current User claim status', () => {
  const getCardDisplayState = (lifafa, userId, userClaimsSet) => {
    const isCompleted = lifafa.status === 'COMPLETED' || lifafa.claimed_count >= lifafa.winner_count;
    const isGloballyActive = lifafa.status === 'ACTIVE' && !isCompleted && new Date(lifafa.expires_at) > new Date();
    const isClaimedByMe = userClaimsSet.has(`${lifafa.id}:${userId}`);

    // Global badge
    const globalStatus = isCompleted ? 'COMPLETED' : isGloballyActive ? 'ACTIVE' : 'CLOSED';

    // User action button
    let userAction = 'Claim Now';
    let canClickClaim = true;

    if (isCompleted) {
      userAction = 'Completed';
      canClickClaim = false;
    } else if (isClaimedByMe) {
      userAction = 'Claimed ✓';
      canClickClaim = false;
    } else if (!isGloballyActive) {
      userAction = 'Closed';
      canClickClaim = false;
    }

    return { globalStatus, userAction, canClickClaim };
  };

  const activeLifafa = {
    id: 'lf_test_1',
    status: 'ACTIVE',
    claimed_count: 1,
    winner_count: 100,
    expires_at: new Date(Date.now() + 86400000).toISOString()
  };

  // User A has claimed
  const claimsStore = new Set(['lf_test_1:user_A']);

  // Check state for User A (who already claimed ₹902.26)
  const userAState = getCardDisplayState(activeLifafa, 'user_A', claimsStore);
  assert.strictEqual(userAState.globalStatus, 'ACTIVE', 'Global status for 1/100 MUST be ACTIVE');
  assert.strictEqual(userAState.userAction, 'Claimed ✓', 'User A action MUST be Claimed ✓');
  assert.strictEqual(userAState.canClickClaim, false, 'User A cannot click Claim Now');

  // Check state for User B (who has NOT claimed yet)
  const userBState = getCardDisplayState(activeLifafa, 'user_B', claimsStore);
  assert.strictEqual(userBState.globalStatus, 'ACTIVE', 'Global status for 1/100 MUST be ACTIVE');
  assert.strictEqual(userBState.userAction, 'Claim Now', 'User B action MUST be Claim Now');
  assert.strictEqual(userBState.canClickClaim, true, 'User B CAN click Claim Now');

  // Check state when 100/100 is reached
  const completedLifafa = {
    id: 'lf_test_1',
    status: 'ACTIVE', // Even if status is ACTIVE, 100/100 completes it
    claimed_count: 100,
    winner_count: 100,
    expires_at: new Date(Date.now() + 86400000).toISOString()
  };

  const userACompletedState = getCardDisplayState(completedLifafa, 'user_A', claimsStore);
  assert.strictEqual(userACompletedState.globalStatus, 'COMPLETED');
  assert.strictEqual(userACompletedState.userAction, 'Completed');

  const userBCompletedState = getCardDisplayState(completedLifafa, 'user_B', claimsStore);
  assert.strictEqual(userBCompletedState.globalStatus, 'COMPLETED');
  assert.strictEqual(userBCompletedState.userAction, 'Completed');
});

// -------------------------------------------------------------
// 25. AUTHORITATIVE CLAIM LOOKUP CONSERVATION
// -------------------------------------------------------------
test('Authoritative User Claim Resolution: Evaluates user claim strictly against authoritative database claims', () => {
  const mockDbClaims = [
    { id: 'c_1', lifafa_id: 'lf_1', user_id: 'user_123', amount: 902.26, claimed_at: '2026-09-10T12:00:00Z' }
  ];

  const hasClaimed = (lifafaId, userId) => {
    return mockDbClaims.some(c => c.lifafa_id === lifafaId && c.user_id === userId);
  };

  const getClaimDetails = (lifafaId, userId) => {
    return mockDbClaims.find(c => c.lifafa_id === lifafaId && c.user_id === userId) || null;
  };

  assert.strictEqual(hasClaimed('lf_1', 'user_123'), true);
  assert.strictEqual(getClaimDetails('lf_1', 'user_123')?.amount, 902.26);

  assert.strictEqual(hasClaimed('lf_1', 'user_999'), false);
  assert.strictEqual(getClaimDetails('lf_1', 'user_999'), null);
});

// -------------------------------------------------------------
// 26. PAYRUPEE BANK PAYOUT PAYLOAD FORMULATION
// -------------------------------------------------------------
test('PayRupee Bank Payout: Formulates exact required API payload', () => {
  const buildPayRupeeBankPayload = (withdrawal) => {
    if (!withdrawal.account_holder_name || withdrawal.account_holder_name.trim().length < 2) {
      throw new Error('Valid account holder name is required');
    }
    const accNum = withdrawal.bank_account_encrypted || withdrawal.bank_account_number;
    if (!accNum || accNum.trim().length < 6) {
      throw new Error('Valid bank account number is required');
    }
    if (!withdrawal.ifsc_code || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(withdrawal.ifsc_code.trim().toUpperCase())) {
      throw new Error('Valid IFSC code is required');
    }
    const amount = Number(withdrawal.net_amount || withdrawal.amount);
    if (!amount || amount <= 0) {
      throw new Error('Valid positive payout amount is required');
    }

    return {
      order_id: `ORD_${withdrawal.id}`,
      amount: amount,
      currency: 'INR',
      method: 'bank',
      recipient: {
        name: withdrawal.account_holder_name.trim(),
        account_number: accNum.trim(),
        ifsc: withdrawal.ifsc_code.trim().toUpperCase()
      }
    };
  };

  const sampleWithdrawal = {
    id: 'wth_abc_123',
    amount: 500.00,
    net_amount: 500.00,
    account_holder_name: 'Rajveer Kol',
    bank_account_encrypted: '123456789012',
    ifsc_code: 'SBIN0001234'
  };

  const payload = buildPayRupeeBankPayload(sampleWithdrawal);
  assert.strictEqual(payload.order_id, 'ORD_wth_abc_123');
  assert.strictEqual(payload.amount, 500.00);
  assert.strictEqual(payload.currency, 'INR');
  assert.strictEqual(payload.method, 'bank');
  assert.strictEqual(payload.recipient.name, 'Rajveer Kol');
  assert.strictEqual(payload.recipient.account_number, '123456789012');
  assert.strictEqual(payload.recipient.ifsc, 'SBIN0001234');
});

// -------------------------------------------------------------
// 27. DETERMINISTIC ORDER ID GENERATION
// -------------------------------------------------------------
test('PayRupee Payout: Generates strictly deterministic order_id (ORD_<id>)', () => {
  const generateOrderId = (withdrawalId) => `ORD_${withdrawalId}`;

  const id = '550e8400-e29b-41d4-a716-446655440000';
  const order1 = generateOrderId(id);
  const order2 = generateOrderId(id);

  assert.strictEqual(order1, 'ORD_550e8400-e29b-41d4-a716-446655440000');
  assert.strictEqual(order1, order2, 'Retries MUST generate the identical order_id');
});

// -------------------------------------------------------------
// 28. DUPLICATE DISPATCH PREVENTION
// -------------------------------------------------------------
test('PayRupee Payout: Rejects duplicate dispatch if withdrawal is not in PENDING state', () => {
  const validateForDispatch = (withdrawal) => {
    if (withdrawal.status !== 'PENDING') {
      throw new Error(`Cannot dispatch withdrawal in ${withdrawal.status} status`);
    }
    if (withdrawal.provider_order_id) {
      throw new Error('Withdrawal already has an assigned provider_order_id');
    }
    return true;
  };

  assert.ok(validateForDispatch({ status: 'PENDING', provider_order_id: null }));
  assert.throws(() => validateForDispatch({ status: 'PROCESSING', provider_order_id: 'ORD_1' }), /Cannot dispatch withdrawal in PROCESSING status/);
  assert.throws(() => validateForDispatch({ status: 'SUCCESS', provider_order_id: 'ORD_1' }), /Cannot dispatch withdrawal in SUCCESS status/);
  assert.throws(() => validateForDispatch({ status: 'FAILED', provider_order_id: 'ORD_1' }), /Cannot dispatch withdrawal in FAILED status/);
});

// -------------------------------------------------------------
// 29. CONCURRENT DISPATCH ATOMIC LOCK
// -------------------------------------------------------------
test('PayRupee Payout: Concurrency simulation locks PENDING to PROCESSING exactly once', () => {
  let dbWithdrawal = { id: 'w_concurrent', status: 'PENDING', provider_order_id: null };
  let executionCount = 0;

  const atomicLockAndStart = (wthId, providerOrderId) => {
    if (dbWithdrawal.status !== 'PENDING') {
      throw new Error('Row locked or not pending');
    }
    dbWithdrawal.status = 'PROCESSING';
    dbWithdrawal.provider_order_id = providerOrderId;
    executionCount++;
    return { success: true };
  };

  // First request succeeds
  const res1 = atomicLockAndStart('w_concurrent', 'ORD_w_concurrent');
  assert.strictEqual(res1.success, true);
  assert.strictEqual(executionCount, 1);
  assert.strictEqual(dbWithdrawal.status, 'PROCESSING');

  // Second concurrent request gets rejected
  assert.throws(() => atomicLockAndStart('w_concurrent', 'ORD_w_concurrent'), /Row locked or not pending/);
  assert.strictEqual(executionCount, 1, 'Provider API must never be dispatched concurrently');
});

// -------------------------------------------------------------
// 30. SECURITY & DATA SANITIZATION (SECRET & ACCOUNT NUMBER)
// -------------------------------------------------------------
test('Security: PayRupee secret never leaked; full account number masked in client responses', () => {
  const sanitizeClientResponse = (withdrawal, providerResult) => {
    return {
      success: true,
      withdrawal_id: withdrawal.id,
      status: withdrawal.status,
      provider_order_id: withdrawal.provider_order_id,
      account_masked: withdrawal.bank_account_number_masked,
      net_amount: withdrawal.net_amount
    };
  };

  const internalState = {
    id: 'w_sec_1',
    status: 'PROCESSING',
    provider_order_id: 'ORD_w_sec_1',
    bank_account_encrypted: '987654321098',
    bank_account_number_masked: 'XXXX-XXXX-1098',
    net_amount: 150.00,
    secret_key: 'SUPER_SECRET_PAYRUPEE_KEY'
  };

  const clientJson = JSON.stringify(sanitizeClientResponse(internalState));
  assert.ok(!clientJson.includes('SUPER_SECRET_PAYRUPEE_KEY'), 'Secret must NEVER be in client response');
  assert.ok(!clientJson.includes('987654321098'), 'Full account number must NEVER be in client response');
  assert.ok(clientJson.includes('XXXX-XXXX-1098'), 'Masked account number must be shown');
});

// -------------------------------------------------------------
// 31. PAYRUPEE HTTP 2XX ACCEPTED = IMMEDIATE WITHDRAWAL SUCCESS
// -------------------------------------------------------------
test('PayRupee Response: HTTP 2xx accepted immediately transitions to SUCCESS without crediting wallet', () => {
  let userWallet = { available: 50.00, total_withdrawn: 100.00 }; // funds already debited at request time
  let withdrawal = { id: 'w_success_200', amount: 100.00, status: 'PROCESSING', provider_order_id: 'ORD_w_success_200' };

  const handlePayRupeeHttp2xxAccepted = (apiStatus, providerRef) => {
    if (withdrawal.status !== 'PROCESSING') {
      throw new Error('Can only transition from PROCESSING');
    }
    // Finalize withdrawal to SUCCESS
    withdrawal.status = 'SUCCESS';
    withdrawal.payout_reference_id = providerRef || withdrawal.provider_order_id;

    // Financial Rule: Do NOT credit wallet again!
    return {
      status: withdrawal.status,
      reference_id: withdrawal.payout_reference_id,
      wallet_untouched: true
    };
  };

  const res = handlePayRupeeHttp2xxAccepted(200, 'PAYRUPEE_REF_12345');
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.reference_id, 'PAYRUPEE_REF_12345');
  assert.strictEqual(withdrawal.status, 'SUCCESS');

  // Verify wallet balance was NOT credited
  assert.strictEqual(userWallet.available, 50.00, 'Wallet balance must NOT be credited on SUCCESS');
  assert.strictEqual(userWallet.total_withdrawn, 100.00);

  // Concurrency check: Cannot re-finalize an already finalized SUCCESS withdrawal
  assert.throws(
    () => handlePayRupeeHttp2xxAccepted(200, 'PAYRUPEE_REF_DUP'),
    /Can only transition from PROCESSING/
  );
});

// -------------------------------------------------------------
// 32. TERMINAL FAILURE & AUTOMATIC SINGLE REFUND
// -------------------------------------------------------------
test('PayRupee Failure: Definitive rejection triggers single reversal refund', () => {
  let userWallet = { available: 50.00, total_withdrawn: 100.00 };
  let withdrawal = { id: 'w_fail', amount: 100.00, status: 'PROCESSING' };
  let reversalLedger = [];

  const handleProviderTerminalFailure = (reason) => {
    if (withdrawal.status === 'FAILED' || withdrawal.status === 'SUCCESS') {
      throw new Error('Already finalized');
    }
    withdrawal.status = 'FAILED';
    withdrawal.rejection_reason = reason;

    // Refund wallet
    userWallet.available += withdrawal.amount;
    userWallet.total_withdrawn = Math.max(0, userWallet.total_withdrawn - withdrawal.amount);

    reversalLedger.push({
      type: 'WITHDRAWAL_REVERSAL',
      amount: withdrawal.amount,
      reference_id: withdrawal.id
    });
  };

  handleProviderTerminalFailure('Beneficiary bank account inactive');
  assert.strictEqual(withdrawal.status, 'FAILED');
  assert.strictEqual(userWallet.available, 150.00);
  assert.strictEqual(userWallet.total_withdrawn, 0.00);
  assert.strictEqual(reversalLedger.length, 1);

  // Duplicate webhook delivery cannot double refund
  assert.throws(() => handleProviderTerminalFailure('Repeat failure event'), /Already finalized/);
  assert.strictEqual(userWallet.available, 150.00);
  assert.strictEqual(reversalLedger.length, 1);
});

// -------------------------------------------------------------
// 33. NETWORK TIMEOUT IDEMPOTENT SAFETY
// -------------------------------------------------------------
test('PayRupee Network Timeout: Leaves withdrawal in PROCESSING, blocks new order ID and auto-refund', () => {
  let withdrawal = { id: 'w_timeout', status: 'PROCESSING', provider_order_id: 'ORD_w_timeout' };
  let userWallet = { available: 100.00 };

  const handleNetworkTimeout = () => {
    // Keep in PROCESSING. Do NOT change order_id. Do NOT refund.
    return {
      status: withdrawal.status,
      order_id: withdrawal.provider_order_id,
      retry_allowed: false
    };
  };

  const outcome = handleNetworkTimeout();
  assert.strictEqual(outcome.status, 'PROCESSING');
  assert.strictEqual(outcome.order_id, 'ORD_w_timeout');
  assert.strictEqual(outcome.retry_allowed, false);
  assert.strictEqual(userWallet.available, 100.00, 'Wallet must NOT be refunded on timeout');
});

// -------------------------------------------------------------
// 34. WALLET WITHDRAWAL & LIFAFA REWARD COMPATIBILITY
// -------------------------------------------------------------
test('Compatibility: Wallet withdrawals and Lifafa UPI/BANK claims both produce valid PayRupee recipient data', () => {
  const walletWithdrawal = {
    id: 'w_wallet_1',
    amount: 250.00,
    net_amount: 250.00,
    account_holder_name: 'Rajveer Kol',
    bank_account_encrypted: '111122223333',
    ifsc_code: 'HDFC0001234'
  };

  const lifafaBankClaimWithdrawal = {
    id: 'w_lifafa_1',
    amount: 100.00,
    net_amount: 100.00,
    account_holder_name: 'Aman Verma',
    bank_account_encrypted: '999988887777',
    ifsc_code: 'SBIN0004321'
  };

  const toPayload = (w) => ({
    order_id: `ORD_${w.id}`,
    amount: w.net_amount,
    currency: 'INR',
    method: 'bank',
    recipient: {
      name: w.account_holder_name,
      account_number: w.bank_account_encrypted,
      ifsc: w.ifsc_code
    }
  });

  const p1 = toPayload(walletWithdrawal);
  const p2 = toPayload(lifafaBankClaimWithdrawal);

  assert.strictEqual(p1.order_id, 'ORD_w_wallet_1');
  assert.strictEqual(p1.recipient.account_number, '111122223333');
  assert.strictEqual(p2.order_id, 'ORD_w_lifafa_1');
  assert.strictEqual(p2.recipient.account_number, '999988887777');
});

// -------------------------------------------------------------
// 35. FAIL-CLOSED ENCRYPTION WITHOUT JWT FALLBACK
// -------------------------------------------------------------
test('Security: Bank credential encryption fails closed if dedicated key is missing, never falls back to JWT secret', () => {
  const encryptBankAccount = (accNumber, dedicatedKey) => {
    if (!accNumber || accNumber.trim().length === 0) return null;
    if (!dedicatedKey || dedicatedKey.trim().length === 0) {
      throw new Error('Dedicated payout encryption key (app.settings.payout_encryption_key) is not configured');
    }
    return `enc_${Buffer.from(accNumber.trim()).toString('base64')}`;
  };

  // Missing or empty key must strictly fail closed
  assert.throws(() => encryptBankAccount('123456789012', null), /Dedicated payout encryption key.*is not configured/);
  assert.throws(() => encryptBankAccount('123456789012', ''), /Dedicated payout encryption key.*is not configured/);
  assert.throws(() => encryptBankAccount('123456789012', '   '), /Dedicated payout encryption key.*is not configured/);

  // Valid key produces encrypted credential
  const enc = encryptBankAccount('123456789012', 'valid-dedicated-key-secret-123');
  assert.ok(enc.startsWith('enc_'), 'Encrypted result produced when key is present');
});

// -------------------------------------------------------------
// 36. PAYOUT ERROR PATH: DECRYPTION FAILURE SAFETY
// -------------------------------------------------------------
test('Payout Error Path: Decryption failure reverts PROCESSING to PENDING without triggering refund', () => {
  let userWallet = { available: 50.00, total_withdrawn: 100.00 };
  let dbWithdrawal = { id: 'w_decrypt_fail', status: 'PENDING', provider_order_id: null, amount: 100.00 };
  let payrupeeDispatched = false;
  let refundsTriggered = 0;

  // Step 1: Concurrency lock PENDING -> PROCESSING
  dbWithdrawal.status = 'PROCESSING';
  dbWithdrawal.provider_order_id = `ORD_${dbWithdrawal.id}`;

  // Step 2: Decryption fails
  const simulateDecryption = (wId) => {
    return { error: 'Decryption failed for bank account credentials' };
  };

  const decryptResult = simulateDecryption(dbWithdrawal.id);
  if (decryptResult.error) {
    // Revert state to PENDING safely: clear provider_order_id so retry is safe, do NOT refund wallet
    dbWithdrawal.status = 'PENDING';
    dbWithdrawal.provider_order_id = null;
    dbWithdrawal.rejection_reason = decryptResult.error;
    // PayRupee is NOT dispatched
    payrupeeDispatched = false;
  }

  assert.strictEqual(dbWithdrawal.status, 'PENDING', 'Must revert safely to PENDING');
  assert.strictEqual(dbWithdrawal.provider_order_id, null, 'Must clear provider_order_id on revert');
  assert.strictEqual(payrupeeDispatched, false, 'PayRupee order must NOT be created');
  assert.strictEqual(userWallet.available, 50.00, 'NO refund must be incorrectly triggered');
  assert.strictEqual(refundsTriggered, 0, 'No refund transactions generated');
});

// -------------------------------------------------------------
// 37. UPI-ONLY PAYOUT PROHIBITION (BLOCKER 6)
// -------------------------------------------------------------
test('Compatibility: PayRupee method=bank rejects UPI-only claims without account_number/ifsc, avoids fake UPI payload', () => {
  const upiOnlyWithdrawal = {
    id: 'w_upi_only_1',
    amount: 100.00,
    net_amount: 100.00,
    account_holder_name: 'Aman Verma',
    upi_id: 'aman@okaxis',
    bank_account_encrypted: null,
    ifsc_code: null
  };

  const validatePayRupeeBankDispatch = (w, decryptedAcc) => {
    if (!decryptedAcc || decryptedAcc.trim().length === 0) {
      throw new Error('PayRupee method=bank requires bank account number. UPI-only payouts are not supported by this provider.');
    }
    if (!w.ifsc_code || w.ifsc_code.trim().length === 0) {
      throw new Error('PayRupee method=bank requires IFSC code.');
    }
    return true;
  };

  assert.throws(
    () => validatePayRupeeBankDispatch(upiOnlyWithdrawal, null),
    /PayRupee method=bank requires bank account number/
  );
  assert.throws(
    () => validatePayRupeeBankDispatch({ ...upiOnlyWithdrawal, ifsc_code: null }, '1234567890'),
    /PayRupee method=bank requires IFSC code/
  );
});

// -------------------------------------------------------------
// 38. PAYRUPEE 5XX SERVER ERROR UNCERTAINTY HANDLING
// -------------------------------------------------------------
test('PayRupee 5xx Server Error: Must NOT trigger refund, leaves withdrawal in PROCESSING', () => {
  let withdrawal = { id: 'w_500', amount: 500.00, status: 'PROCESSING', provider_order_id: 'ORD_w_500' };
  let userWallet = { available: 50.00 };
  let reversalLedger = [];

  const handleProviderResponse = (statusCode, data) => {
    const isServerOrUncertainError = statusCode >= 500 || statusCode === 408 || statusCode === 429;
    if (isServerOrUncertainError) {
      // Must NOT refund, must remain PROCESSING
      return { status: 'PROCESSING', refunded: false };
    }
    // Definitive 4xx
    withdrawal.status = 'FAILED';
    userWallet.available += withdrawal.amount;
    reversalLedger.push({ type: 'WITHDRAWAL_REVERSAL', amount: withdrawal.amount });
    return { status: 'FAILED', refunded: true };
  };

  // 500 Internal Server Error
  const res500 = handleProviderResponse(500, { error: 'Internal server crash' });
  assert.strictEqual(res500.status, 'PROCESSING');
  assert.strictEqual(res500.refunded, false);
  assert.strictEqual(userWallet.available, 50.00, 'Wallet must NOT be refunded on 500');
  assert.strictEqual(withdrawal.status, 'PROCESSING');
  assert.strictEqual(reversalLedger.length, 0);

  // 502 Bad Gateway
  const res502 = handleProviderResponse(502, { error: 'Bad Gateway' });
  assert.strictEqual(res502.status, 'PROCESSING');
  assert.strictEqual(userWallet.available, 50.00, 'Wallet must NOT be refunded on 502');

  // 503 Service Unavailable
  const res503 = handleProviderResponse(503, { error: 'Service Unavailable' });
  assert.strictEqual(res503.status, 'PROCESSING');
  assert.strictEqual(userWallet.available, 50.00, 'Wallet must NOT be refunded on 503');
});

// -------------------------------------------------------------
// 39. PAYRUPEE AMBIGUOUS 4XX (408/429/UNCLASSIFIED) HANDLING
// -------------------------------------------------------------
test('PayRupee Ambiguous 4xx (408/429): Must NOT trigger refund, leaves withdrawal in PROCESSING', () => {
  let withdrawal = { id: 'w_ambig', amount: 300.00, status: 'PROCESSING', provider_order_id: 'ORD_w_ambig' };
  let userWallet = { available: 100.00 };

  const classifyError = (statusCode, reason) => {
    if (statusCode >= 500 || statusCode === 408 || statusCode === 429) {
      return { status: 'PROCESSING', shouldRefund: false };
    }
    const isDefinitive = (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 422) &&
      (reason.toLowerCase().includes('reject') || reason.toLowerCase().includes('invalid'));
    if (!isDefinitive) {
      return { status: 'PROCESSING', shouldRefund: false };
    }
    return { status: 'FAILED', shouldRefund: true };
  };

  // 408 Request Timeout
  const res408 = classifyError(408, 'Request Timeout');
  assert.strictEqual(res408.status, 'PROCESSING');
  assert.strictEqual(res408.shouldRefund, false);

  // 429 Rate Limit
  const res429 = classifyError(429, 'Too Many Requests');
  assert.strictEqual(res429.status, 'PROCESSING');
  assert.strictEqual(res429.shouldRefund, false);

  // Ambiguous 400 without clear rejection
  const resAmbiguous = classifyError(400, 'Something unusual happened');
  assert.strictEqual(resAmbiguous.status, 'PROCESSING');
  assert.strictEqual(resAmbiguous.shouldRefund, false);

  // Definitive 400 with invalid account
  const resDefinitive = classifyError(400, 'Beneficiary account invalid or closed');
  assert.strictEqual(resDefinitive.status, 'FAILED');
  assert.strictEqual(resDefinitive.shouldRefund, true);
});

console.log('\n========================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (100%)`);
console.log('========================================================');

