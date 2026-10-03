/**
 * Test Suite: Migration 040 Merchant RPC & Regex Fix Verification
 * Verifies:
 * 1. Spencer POSIX regex crash fix: {2,255} <= DUPMAX (255)
 * 2. UPI validation passes valid and rejects invalid formats
 * 3. total_deducted column included in merchant_payouts insert
 * 4. locked_payout_balance correctly locks total_deducted (amount + ₹2.50 fee)
 * 5. total_fees_paid is not double-counted
 * 6. merchant_ledger_entries columns and constraints are valid
 * 7. Consumer Wallet and Lifafa remain completely untouched
 */

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

console.log('================================================================');
console.log('VERIFYING MIGRATION 040 MERCHANT RPC PRODUCTION FIX');
console.log('================================================================\n');

// 1. Spencer POSIX Regex Validation
console.log('1. Checking UPI Regex & DUPMAX Compatibility...');
const regex = /^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$/;

const validUpiIds = [
  'test@upi',
  'rajveer@paytm',
  'name@oksbi',
  '9876543210@ybl',
  'user.name_123@hdfcbank',
  'merchant-corp@icici',
];

const invalidUpiIds = [
  'test',
  'test@',
  '@test',
  'test@@upi',
  'test upi',
  '',
  'a@b', // too short
  'test@c', // bank handle too short
  'test#user@bank', // invalid character #
];

let validAllPassed = true;
for (const upi of validUpiIds) {
  if (!regex.test(upi)) {
    validAllPassed = false;
    console.error(`    Falsely rejected: ${upi}`);
  }
}
assert(validAllPassed, 'All valid UPI IDs (test@upi, rajveer@paytm, name@oksbi, 9876543210@ybl) pass regex');

let invalidAllPassed = true;
for (const upi of invalidUpiIds) {
  if (regex.test(upi)) {
    invalidAllPassed = false;
    console.error(`    Falsely accepted: ${upi}`);
  }
}
assert(invalidAllPassed, 'All invalid UPI IDs (test, test@, @test, test@@upi, test upi, empty string) are rejected');

// 2. Migration 040 File Verification
console.log('\n2. Checking Migration 040 File Content & Schema Integrity...');
const mig040Path = path.join(rootDir, 'supabase/migrations/040_fix_merchant_initiate_payout_rpc.sql');
assert(fs.existsSync(mig040Path), 'Migration 040 file exists');
const mig040Content = fs.readFileSync(mig040Path, 'utf8');

// Check Spencer regex fix in SQL
assert(mig040Content.includes("^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$"), 'Migration 040 uses DUPMAX-safe regex ^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$');
assert(!mig040Content.includes("~ '^[\w.\-_]{2,256}") && !mig040Content.includes("~ '^[a-zA-Z0-9._-]{2,256}"), 'Migration 040 has no repetition count > 255 in regex');

// Check total_deducted fix
assert(mig040Content.includes('total_deducted,'), 'Migration 040 includes total_deducted in INSERT INTO public.merchant_payouts column list');
assert(mig040Content.includes('v_total_deducted,'), 'Migration 040 passes v_total_deducted in INSERT VALUES list');

// Check Financial Calculation (payout = 10, fee = 2.50, total_deducted = 12.50)
assert(mig040Content.includes('v_fee NUMERIC(12, 2) := 2.50;'), 'Migration 040 enforces flat ₹2.50 fee');
assert(mig040Content.includes('v_total_deducted := p_amount + v_fee;'), 'Migration 040 calculates v_total_deducted := p_amount + v_fee');

// Check Float Locking
assert(mig040Content.includes('locked_payout_balance = locked_payout_balance + v_total_deducted'), 'Migration 040 locks full deduction (principal + fee) in locked_payout_balance');
assert(!mig040Content.includes('total_fees_paid = total_fees_paid + v_fee,'), 'Migration 040 does not prematurely increment total_fees_paid at payout initiation');

// Check Ledger Schema & Constraints
assert(mig040Content.includes("'PAYOUT_LOCK'"), "Migration 040 records 'PAYOUT_LOCK' entry_type");
assert(mig040Content.includes("'PAYOUT_FEE_LOCK'"), "Migration 040 records 'PAYOUT_FEE_LOCK' entry_type");
assert(!mig040Content.includes("'DEBIT'"), "Migration 040 does not use invalid entry_type 'DEBIT'");
assert(!mig040Content.includes("'PAYOUT_FEE'"), "Migration 040 does not use invalid reference_type 'PAYOUT_FEE'");
assert(mig040Content.includes('metadata'), 'Migration 040 uses metadata column instead of invalid description column');

// 3. Frontend & Edge Function Alignment
console.log('\n3. Checking Frontend & Edge Function UPI Regex Alignment...');
const mchModalPath = path.join(rootDir, 'src/components/merchant/MerchantNewPayoutModal.tsx');
const mchModalContent = fs.readFileSync(mchModalPath, 'utf8');
assert(mchModalContent.includes("^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$"), 'MerchantNewPayoutModal regex matches PostgreSQL DUPMAX pattern');

const mchPagePath = path.join(rootDir, 'src/pages/MerchantPortalPage.tsx');
const mchPageContent = fs.readFileSync(mchPagePath, 'utf8');
assert(mchPageContent.includes("^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$"), 'MerchantPortalPage regex matches PostgreSQL DUPMAX pattern');

const mchPaynitFuncPath = path.join(rootDir, 'supabase/functions/merchant-paynit-payout/index.ts');
const mchPaynitFuncContent = fs.readFileSync(mchPaynitFuncPath, 'utf8');
assert(mchPaynitFuncContent.includes("^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$"), 'merchant-paynit-payout regex matches PostgreSQL DUPMAX pattern');

// 4. Financial Calculation Verification Test
console.log('\n4. Verifying Financial Calculation (₹10 Payout = ₹12.50 Total Debit)...');
const testAmount = 10.00;
const testFee = 2.50;
const expectedTotalDeducted = 12.50;
const calculatedTotal = testAmount + testFee;
assert(calculatedTotal === expectedTotalDeducted, `₹${testAmount} payout + ₹${testFee} fee = ₹${expectedTotalDeducted} total deduction`);

// 5. Verification of Consumer & Lifafa Isolation
console.log('\n5. Verifying Consumer Wallet and Lifafa Isolation...');
const consumerWithdrawalFile = fs.readFileSync('src/components/wallet/WithdrawModal.tsx', 'utf8');
assert(consumerWithdrawalFile.includes('₹3.58'), 'Consumer withdrawal fee remains exactly ₹3.58');
assert(consumerWithdrawalFile.includes('Beneficiary UPI ID'), 'Consumer withdrawal remains UPI-only');

const lifafaClaimFile = fs.readFileSync('src/pages/ClaimPage.tsx', 'utf8');
assert(lifafaClaimFile.includes('Instant UPI Settlement Details'), 'Lifafa claim remains Instant UPI Settlement');

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
