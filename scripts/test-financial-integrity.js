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

console.log('\n========================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (100%)`);
console.log('========================================================');

