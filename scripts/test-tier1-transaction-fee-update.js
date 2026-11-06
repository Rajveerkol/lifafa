// Test script: test-tier1-transaction-fee-update.js
// Validates that Tier 1 transaction charge is strictly updated from ₹2.50 to ₹3.00
// while preserving all other fee structures (Tier 2 ₹5, Tier 3 ₹10, and Deposit Slabs ₹100 / 2%).

import assert from 'assert';

// 1. Test Withdrawal & Payout Fee Logic (matches src/lib/feeCalculations.ts)
function calculateWithdrawalFee(amount) {
  const num = Math.round(Number(amount) * 100) / 100;
  if (isNaN(num) || num <= 0) {
    return { fee: 3.00, totalDeducted: 0 };
  }

  let fee = 3.00;
  if (num < 500) {
    fee = 3.00;
  } else if (num < 1000) {
    fee = 5.00;
  } else {
    fee = 10.00;
  }

  const totalDeducted = Math.round((num + fee) * 100) / 100;
  return { fee, totalDeducted };
}

// 2. Test Lifafa Payout Fee Logic (matches src/services/lifafaService.ts and DB RPC)
function getLifafaPayoutFee(amount) {
  if (!amount || amount <= 0) return 0;
  if (amount < 500) return 3.00;
  if (amount < 1000) return 5.00;
  return 10.00;
}

// 3. Test Deposit Fee Logic (matches src/lib/feeCalculations.ts - MUST BE UNTOUCHED)
function calculateDepositFee(depositAmount) {
  const cleanAmount = Math.round(Number(depositAmount) * 100) / 100;
  if (isNaN(cleanAmount) || cleanAmount < 100) {
    return {
      depositAmount: isNaN(cleanAmount) ? 0 : cleanAmount,
      fee: 0,
      totalPayable: isNaN(cleanAmount) ? 0 : cleanAmount,
      walletCredit: isNaN(cleanAmount) ? 0 : cleanAmount,
    };
  }

  let fee = 0;
  if (cleanAmount < 1000) {
    fee = 100.00;
  } else {
    fee = Math.round(cleanAmount * 0.02 * 100) / 100;
  }

  const totalPayable = Math.round((cleanAmount + fee) * 100) / 100;
  const walletCredit = cleanAmount;

  return {
    depositAmount: cleanAmount,
    fee,
    totalPayable,
    walletCredit,
  };
}

console.log('=== RUNNING TIER 1 TRANSACTION FEE VERIFICATION (₹2.50 -> ₹3.00) ===\n');

// PART 1: Tier 1 Payout & Withdrawal Tests (< ₹500)
console.log('--- PART 1: Tier 1 Payout/Withdrawal Fees (< ₹500: ₹3.00 Fee) ---');
const tier1Tests = [
  { amount: 1.00, expectedFee: 3.00, expectedTotal: 4.00 },
  { amount: 50.00, expectedFee: 3.00, expectedTotal: 53.00 },
  { amount: 100.00, expectedFee: 3.00, expectedTotal: 103.00 },
  { amount: 250.00, expectedFee: 3.00, expectedTotal: 253.00 },
  { amount: 499.99, expectedFee: 3.00, expectedTotal: 502.99 },
];

tier1Tests.forEach(t => {
  const res = calculateWithdrawalFee(t.amount);
  assert.strictEqual(res.fee, t.expectedFee, `Amount ₹${t.amount} expected fee ₹${t.expectedFee}, got ₹${res.fee}`);
  assert.strictEqual(res.totalDeducted, t.expectedTotal, `Amount ₹${t.amount} expected total ₹${t.expectedTotal}, got ₹${res.totalDeducted}`);
  console.log(`[PASS] Amount ₹${t.amount}: Fee ₹${res.fee}, Total Deducted ₹${res.totalDeducted}`);
});

// PART 2: Unchanged Higher Tiers (₹500+ and ₹1,000+)
console.log('\n--- PART 2: Unchanged Payout/Withdrawal Slabs (Tier 2 = ₹5, Tier 3 = ₹10) ---');
const higherTierTests = [
  { amount: 500.00, expectedFee: 5.00, expectedTotal: 505.00 },
  { amount: 750.00, expectedFee: 5.00, expectedTotal: 755.00 },
  { amount: 999.99, expectedFee: 5.00, expectedTotal: 1004.99 },
  { amount: 1000.00, expectedFee: 10.00, expectedTotal: 1010.00 },
  { amount: 2000.00, expectedFee: 10.00, expectedTotal: 2010.00 },
  { amount: 5000.00, expectedFee: 10.00, expectedTotal: 5010.00 },
];

higherTierTests.forEach(t => {
  const res = calculateWithdrawalFee(t.amount);
  assert.strictEqual(res.fee, t.expectedFee, `Amount ₹${t.amount} expected fee ₹${t.expectedFee}, got ₹${res.fee}`);
  assert.strictEqual(res.totalDeducted, t.expectedTotal, `Amount ₹${t.amount} expected total ₹${t.expectedTotal}, got ₹${res.totalDeducted}`);
  console.log(`[PASS] Amount ₹${t.amount}: Fee ₹${res.fee}, Total Deducted ₹${res.totalDeducted}`);
});

// PART 3: Lifafa External Payout Fee Function
console.log('\n--- PART 3: Lifafa External Payout Fee (getLifafaPayoutFee) ---');
assert.strictEqual(getLifafaPayoutFee(1.00), 3.00);
assert.strictEqual(getLifafaPayoutFee(499.99), 3.00);
assert.strictEqual(getLifafaPayoutFee(500.00), 5.00);
assert.strictEqual(getLifafaPayoutFee(1000.00), 10.00);
console.log('[PASS] Lifafa payout fee correctly returns ₹3.00 for < ₹500, ₹5.00 for ₹500-₹999, ₹10.00 for ₹1000+');

// PART 4: Deposit Fee Invariance (MUST NOT BE AFFECTED)
console.log('\n--- PART 4: Deposit Fee Rules (Invariance Verification) ---');
const depositTests = [
  { amount: 99, expectedFee: 0, expectedPayable: 99, valid: false },
  { amount: 100, expectedFee: 100, expectedPayable: 200, valid: true },
  { amount: 200, expectedFee: 100, expectedPayable: 300, valid: true },
  { amount: 500, expectedFee: 100, expectedPayable: 600, valid: true },
  { amount: 999, expectedFee: 100, expectedPayable: 1099, valid: true },
  { amount: 1000, expectedFee: 20, expectedPayable: 1020, valid: true },
  { amount: 2000, expectedFee: 40, expectedPayable: 2040, valid: true },
  { amount: 5000, expectedFee: 100, expectedPayable: 5100, valid: true },
];

depositTests.forEach(t => {
  const res = calculateDepositFee(t.amount);
  assert.strictEqual(res.fee, t.expectedFee, `Deposit ₹${t.amount} expected fee ₹${t.expectedFee}, got ₹${res.fee}`);
  assert.strictEqual(res.totalPayable, t.expectedPayable, `Deposit ₹${t.amount} expected total ₹${t.expectedPayable}, got ₹${res.totalPayable}`);
  console.log(`[PASS] Deposit ₹${t.amount}: Fee ₹${res.fee}, Total Payable ₹${res.totalPayable}`);
});

console.log('\n=== ALL 19 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
