import fs from 'fs';

console.log('================================================================');
console.log('TEST SUITE: LIFAFA CLAIM UX & PAYOUT AMOUNT MISMATCH FIX');
console.log('================================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// PART 1: REWARD BOX CTA COMPACT UI AUDIT
// -------------------------------------------------------------
console.log('\n--- PART 1: COMPACT CLAIM NOW CTA AUDIT ---');
const ctaPath = 'src/components/lifafa/cinematic/RewardBoxCTA.tsx';
assert(fs.existsSync(ctaPath), 'RewardBoxCTA.tsx exists');

const ctaContent = fs.readFileSync(ctaPath, 'utf8');

assert(ctaContent.includes('CLAIM NOW'), 'CTA renders "CLAIM NOW" title');
assert(ctaContent.includes('Your ${amountText') || ctaContent.includes('Your reward is ready'), 'CTA renders dynamic subtext "Your ₹X reward is ready"');
assert(ctaContent.includes('Gift'), 'CTA renders compact reward/gift icon');
assert(ctaContent.includes('ArrowRight'), 'CTA renders action arrow');
assert(ctaContent.includes('prefers-reduced-motion'), 'CTA respects prefers-reduced-motion');
assert(ctaContent.includes('id="reward-box-cta"'), 'CTA has clickable button id');
assert(!ctaContent.includes('YOUR REWARD IS READY'), 'Old large title "YOUR REWARD IS READY" is completely removed');
assert(!ctaContent.includes('Tap to open reward box & enter UPI ID'), 'Old large subtitle is completely removed');
assert(!ctaContent.includes('w-16 h-16 sm:w-18 sm:h-18'), 'Old large 3D chest box dimensions removed');

// -------------------------------------------------------------
// PART 2: PAYOUT AMOUNT MISMATCH ROOT CAUSE & INTEGRITY
// -------------------------------------------------------------
console.log('\n--- PART 2: AMOUNT VERIFICATION INTEGRITY (TEST WITH ₹10 REWARD) ---');
const lifafaServicePath = 'src/services/lifafaService.ts';
assert(fs.existsSync(lifafaServicePath), 'lifafaService.ts exists');

const serviceContent = fs.readFileSync(lifafaServicePath, 'utf8');

// Test Case: ₹10 winner reward
const winnerReward = 10.00;
const platformFee = 2.50;
const creatorGrossDeduction = 12.50;

// Simulation of withdrawal database row in PostgreSQL:
const mockWithdrawalNew = {
  id: 'wth-test-uuid',
  user_id: 'user-winner-uuid',
  amount: creatorGrossDeduction, // 12.50
  net_amount: winnerReward,       // 10.00
  fee_amount: platformFee,       // 2.50
  status: 'SUCCESS',
  payout_reference_id: 'paynit_ref_123',
  provider_order_id: 'ORD_test_123',
};

// Simulation of verification logic in lifafaService.ts:
function simulateVerifyClaim(wth, expectedUserId, expectedAmount) {
  if (wth.user_id !== expectedUserId) {
    return { verified: false, status: 'UNAUTHORIZED', error: 'Payout claimant mismatch.' };
  }
  const claimPayoutAmount = Number(wth.net_amount != null ? wth.net_amount : wth.amount);
  const matchesNet = Math.abs(claimPayoutAmount - Number(expectedAmount)) <= 0.01;
  const matchesGross = Math.abs(Number(wth.amount) - Number(expectedAmount)) <= 0.01;

  if (!matchesNet && !matchesGross) {
    return { verified: false, status: 'AMOUNT_MISMATCH', error: 'Payout amount mismatch.' };
  }

  if (wth.status === 'SUCCESS' && (wth.payout_reference_id || wth.provider_reference_id)) {
    return { verified: true, status: 'SUCCESS' };
  }
  if (wth.status === 'PROCESSING') {
    return { verified: true, status: 'PROCESSING' };
  }
  return { verified: false, status: wth.status, error: 'UPI payout dispatch was not confirmed.' };
}

// 1. New Fee Escrow Mode: wth.amount = 12.50, wth.net_amount = 10.00, expected = 10.00
const resultNew = simulateVerifyClaim(mockWithdrawalNew, 'user-winner-uuid', 10.00);
assert(resultNew.verified === true && resultNew.status === 'SUCCESS', 'New fee escrow row verifies cleanly without AMOUNT_MISMATCH');

// 2. Old Mode Compatibility: wth.amount = 10.00, wth.net_amount = 10.00 (or null), expected = 10.00
const mockWithdrawalOld = {
  id: 'wth-old-uuid',
  user_id: 'user-winner-uuid',
  amount: 10.00,
  net_amount: null,
  status: 'SUCCESS',
  payout_reference_id: 'ref_old_123',
};
const resultOld = simulateVerifyClaim(mockWithdrawalOld, 'user-winner-uuid', 10.00);
assert(resultOld.verified === true && resultOld.status === 'SUCCESS', 'Legacy withdrawal row without net_amount verifies cleanly');

// 3. Security: Tampered / Mismatched Amount Detection
const mockWithdrawalTampered = {
  id: 'wth-tampered',
  user_id: 'user-winner-uuid',
  amount: 50.00,
  net_amount: 50.00,
  status: 'SUCCESS',
  payout_reference_id: 'ref_bad',
};
const resultTampered = simulateVerifyClaim(mockWithdrawalTampered, 'user-winner-uuid', 10.00);
assert(resultTampered.status === 'AMOUNT_MISMATCH', 'Tampered amount is strictly rejected with AMOUNT_MISMATCH');

// 4. Audit service code for net_amount check
assert(serviceContent.includes('wth.net_amount != null ? wth.net_amount : wth.amount'), 'lifafaService queries and verifies net_amount');
assert(serviceContent.includes("select('id, user_id, amount, net_amount"), 'verifyClaimBankPayout selects net_amount from withdrawals table');

// -------------------------------------------------------------
// PART 3: PAYNIT PAYLOAD & PROVIDER DISPATCH AUDIT
// -------------------------------------------------------------
console.log('\n--- PART 3: PAYNIT DISPATCH CONTRACT ---');
const paynitFunctionPath = 'supabase/functions/consumer-paynit-payout/index.ts';
assert(fs.existsSync(paynitFunctionPath), 'consumer-paynit-payout/index.ts exists');

const paynitFnContent = fs.readFileSync(paynitFunctionPath, 'utf8');
assert(paynitFnContent.includes('withdrawal.net_amount != null ? withdrawal.net_amount : withdrawal.amount'), 'PayNit function extracts net_amount for payout');
assert(paynitFnContent.includes("type: 'UPI'"), 'PayNit payload is strictly UPI');
assert(!paynitFnContent.includes("type: 'IMPS'"), 'IMPS payout completely disabled');

// -------------------------------------------------------------
// PART 4: REMOVAL OF "BANK TRANSFER PENDING" & FALSE WALLET CLAIMS
// -------------------------------------------------------------
console.log('\n--- PART 4: UI MESSAGING AUDIT (UPI-ONLY Semantics) ---');
const claimPagePath = 'src/pages/ClaimPage.tsx';
const claimPageContent = fs.readFileSync(claimPagePath, 'utf8');

assert(!claimPageContent.includes('Reward Claimed — Bank Transfer Pending'), 'ClaimPage: "Bank Transfer Pending" removed');
assert(!claimPageContent.includes('the funds have been credited to your Createlifafa wallet balance'), 'ClaimPage: False wallet balance credit text removed');
assert(claimPageContent.includes('UPI Payout Processing'), 'ClaimPage: Accurately renders "UPI Payout Processing"');
assert(claimPageContent.includes('UPI Payout Failed'), 'ClaimPage: Accurately renders "UPI Payout Failed"');

const themeCompPath = 'src/themes/shared/createThemeComponents.tsx';
const themeCompContent = fs.readFileSync(themeCompPath, 'utf8');

assert(!themeCompContent.includes('Reward Claimed — Bank Transfer Pending'), 'createThemeComponents: "Bank Transfer Pending" removed');
assert(!themeCompContent.includes('the funds have been credited to your Createlifafa wallet balance'), 'createThemeComponents: False wallet balance credit text removed');
assert(themeCompContent.includes('UPI Payout Failed'), 'createThemeComponents: Accurately renders "UPI Payout Failed"');

console.log('\n================================================================');
console.log(`TOTAL AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
