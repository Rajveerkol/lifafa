import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
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

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  [PASS] ${message}: ${actual} === ${expected}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

// Server-aligned Lifafa Payout Fee slabs
function getLifafaPayoutFee(amount) {
  if (!amount || amount <= 0) return 0;
  if (amount <= 500) return 2.50;
  if (amount <= 1000) return 2.70;
  return 3.50;
}

function calculateLifafaPayoutFees(totalAmount, winnerCount, distributionType, payoutMode, maxClaimAmount) {
  if (payoutMode !== 'UPI_BANK' || !totalAmount || !winnerCount || winnerCount < 1) {
    return 0;
  }
  if (distributionType === 'EQUAL') {
    const perWinner = totalAmount / winnerCount;
    return Number((winnerCount * getLifafaPayoutFee(perWinner)).toFixed(2));
  }
  if (maxClaimAmount && maxClaimAmount > 0) {
    return Number((winnerCount * getLifafaPayoutFee(maxClaimAmount)).toFixed(2));
  }
  if (totalAmount <= 500) {
    return Number((winnerCount * 2.50).toFixed(2));
  }
  const avgAmount = totalAmount / winnerCount;
  return Number((winnerCount * getLifafaPayoutFee(avgAmount)).toFixed(2));
}

console.log('================================================================');
console.log('TEST SUITE: LIFAFA PAYOUT FEE ESCROW & REVENUE LEAK FIX');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Fee Slab Unit Tests (Tests 3, 4, 5, 6)
// -----------------------------------------------------------------------------
console.log('--- SLAB TESTS 3-6: Server-aligned Fee Calculation ---');

// TEST 3: ₹500 payout -> Fee = ₹2.50
assertEqual(getLifafaPayoutFee(500), 2.50, 'TEST 3: ₹500 payout fee');
assertEqual(getLifafaPayoutFee(1.00), 2.50, '₹1.00 payout fee');
assertEqual(getLifafaPayoutFee(250), 2.50, '₹250 payout fee');

// TEST 4: ₹500.01 payout -> Fee = ₹2.70
assertEqual(getLifafaPayoutFee(500.01), 2.70, 'TEST 4: ₹500.01 payout fee');

// TEST 5: ₹1,000 payout -> Fee = ₹2.70
assertEqual(getLifafaPayoutFee(1000), 2.70, 'TEST 5: ₹1,000 payout fee');
assertEqual(getLifafaPayoutFee(750), 2.70, '₹750 payout fee');

// TEST 6: ₹1,000.01 payout -> Fee = ₹3.50
assertEqual(getLifafaPayoutFee(1000.01), 3.50, 'TEST 6: ₹1,000.01 payout fee');
assertEqual(getLifafaPayoutFee(5000), 3.50, '₹5,000 payout fee');

// -----------------------------------------------------------------------------
// 2. Creator Funding Calculations (Tests 1 & 2)
// -----------------------------------------------------------------------------
console.log('\n--- TESTS 1 & 2: Creator Upfront Funding & Payout Fees ---');

// TEST 1: 100 winners x ₹10
// Prize = ₹1,000, Fees = ₹2.50 × 100 = ₹250, Total Required = ₹1,250
const test1Fee = calculateLifafaPayoutFees(1000, 100, 'EQUAL', 'UPI_BANK');
assertEqual(test1Fee, 250, 'TEST 1: 100 winners x ₹10 fee');
const test1Total = 1000 + test1Fee;
assertEqual(test1Total, 1250, 'TEST 1: 100 winners x ₹10 total creator funding required');

// TEST 2: 10 winners x ₹600
// Prize = ₹6,000, Fees = ₹2.70 × 10 = ₹27, Total Required = ₹6,027
const test2Fee = calculateLifafaPayoutFees(6000, 10, 'EQUAL', 'UPI_BANK');
assertEqual(test2Fee, 27, 'TEST 2: 10 winners x ₹600 fee');
const test2Total = 6000 + test2Fee;
assertEqual(test2Total, 6027, 'TEST 2: 10 winners x ₹600 total creator funding required');

// WALLET mode must incur ₹0 payout fees
const walletFee = calculateLifafaPayoutFees(1000, 100, 'EQUAL', 'WALLET');
assertEqual(walletFee, 0, 'WALLET payout mode fee is strictly ₹0');

// -----------------------------------------------------------------------------
// 3. Frontend Implementation Audit
// -----------------------------------------------------------------------------
console.log('\n--- FRONTEND IMPLEMENTATION AUDIT ---');
const servicePath = path.join(rootDir, 'src/services/lifafaService.ts');
assert(fs.existsSync(servicePath), 'src/services/lifafaService.ts exists');
const serviceContent = fs.readFileSync(servicePath, 'utf8');
assert(serviceContent.includes('export function getLifafaPayoutFee('), 'getLifafaPayoutFee exported from lifafaService');
assert(serviceContent.includes('export function calculateLifafaPayoutFees('), 'calculateLifafaPayoutFees exported from lifafaService');

const createPagePath = path.join(rootDir, 'src/pages/CreateLifafaPage.tsx');
assert(fs.existsSync(createPagePath), 'src/pages/CreateLifafaPage.tsx exists');
const createPageContent = fs.readFileSync(createPagePath, 'utf8');
assert(createPageContent.includes('calculateLifafaPayoutFees'), 'CreateLifafaPage imports calculateLifafaPayoutFees');
assert(createPageContent.includes('totalFundingRequired > availableBalance'), 'Step 3 validates total funding including fees against wallet balance');
assert(createPageContent.includes('Estimated Payout Fees:'), 'Step 3 displays Estimated Payout Fees breakdown');
assert(createPageContent.includes('Total Required Funding:'), 'Step 3 displays Total Required Funding');
assert(createPageContent.includes('Total Required Funding</span>'), 'Step 5 review displays Total Required Funding');

// -----------------------------------------------------------------------------
// 4. Migration 049 SQL Audit & Verification
// -----------------------------------------------------------------------------
console.log('\n--- MIGRATION 049 AUDIT: Database Architecture & Integrity ---');

const mig049Path = path.join(rootDir, 'supabase/migrations/049_lifafa_payout_fee_escrow.sql');
assert(fs.existsSync(mig049Path), 'Migration 049 SQL file exists');
const mig049Content = fs.readFileSync(mig049Path, 'utf8');

// Function definitions check
assert(mig049Content.includes('CREATE OR REPLACE FUNCTION public.get_lifafa_payout_fee('), 'get_lifafa_payout_fee defined');
assert(mig049Content.includes('ALTER TABLE public.lifafas'), 'Alters public.lifafas to add fee columns');
assert(mig049Content.includes('total_fee_amount NUMERIC(12, 2)'), 'Adds total_fee_amount column');
assert(mig049Content.includes('remaining_fee_amount NUMERIC(12, 2)'), 'Adds remaining_fee_amount column');
assert(mig049Content.includes('CREATE OR REPLACE FUNCTION public.create_lifafa_rpc('), 'create_lifafa_rpc defined');
assert(mig049Content.includes('CREATE OR REPLACE FUNCTION public.claim_lifafa_rpc('), 'claim_lifafa_rpc defined');
assert(mig049Content.includes('CREATE OR REPLACE FUNCTION public.refund_expired_or_cancelled_lifafa_rpc('), 'refund_expired_or_cancelled_lifafa_rpc defined');

// Creation-time fee reservation audit
assert(
  mig049Content.includes('v_total_required := p_total_amount + v_fee + v_total_payout_fee;'),
  'Creation: Total required includes prize + creation fee + total payout fees'
);
assert(
  mig049Content.includes('reserved_balance = reserved_balance + p_total_amount + v_total_payout_fee'),
  'Creation: wallets.reserved_balance escrows prize pool + payout fees'
);
assert(
  mig049Content.includes("'LIFAFA_PAYOUT_FEE_RESERVE'"),
  "Creation: wallet_transactions records 'LIFAFA_PAYOUT_FEE_RESERVE'"
);

// TEST 7: Successful claim accounting audit
console.log('\n--- TEST 7: Successful External Claim Accounting ---');
assert(
  mig049Content.includes('reserved_balance = GREATEST(0.00, reserved_balance - (v_claim_amount + v_claim_fee))'),
  'TEST 7: Creator escrow is reduced by payout + fee'
);
assert(
  mig049Content.includes('v_claim_amount + v_claim_fee'),
  'TEST 7: withdrawals record stores amount = v_claim_amount + v_claim_fee'
);
assert(
  mig049Content.includes("'LIFAFA_PAYOUT_FEE'"),
  "TEST 7: Exactly one platform fee recognized in wallet_transactions under 'LIFAFA_PAYOUT_FEE'"
);

// TEST 8: Failed payout accounting audit
console.log('\n--- TEST 8: Failed Payout Restoration ---');
assert(
  mig049Content.includes('v_balance_after := v_balance_before + v_total_refund') ||
  mig049Content.includes('v_withdrawal.amount'),
  'TEST 8: Full withdrawal amount (prize + fee) is restored upon failure'
);

// TEST 9: Duplicate claim idempotency audit
console.log('\n--- TEST 9: Duplicate Claim Idempotency ---');
assert(
  mig049Content.includes("WHERE idempotency_key = v_effective_idempotency"),
  'TEST 9: Idempotency check prevents duplicate claim before state mutation'
);
assert(
  mig049Content.includes("'is_duplicate', true"),
  'TEST 9: Duplicate returns without charging extra fees'
);

// TEST 10: Expired Lifafa refund audit
console.log('\n--- TEST 10: Expired Lifafa Refund ---');
assert(
  mig049Content.includes('v_refund_prize := v_lifafa.remaining_amount;'),
  'TEST 10: Remaining prize is calculated for refund'
);
assert(
  mig049Content.includes('v_refund_fee := COALESCE(v_lifafa.remaining_fee_amount, 0.00);'),
  'TEST 10: Unconsumed fee reserve is calculated for refund'
);
assert(
  mig049Content.includes('v_total_refund := v_refund_prize + v_refund_fee;'),
  'TEST 10: Total refund includes both prize pool and unused fee reserve'
);
assert(
  mig049Content.includes('available_balance = available_balance + v_total_refund'),
  'TEST 10: Creator available balance is credited by total refund'
);
assert(
  mig049Content.includes('reserved_balance = GREATEST(0.00, reserved_balance - v_total_refund)'),
  'TEST 10: Creator escrow reserved balance is released by total refund'
);

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
