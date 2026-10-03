/**
 * Comprehensive Verification Suite: Migration 041 Schema Verification
 * Verifies that all columns in public.merchant_initiate_payout_rpc INSERTs
 * 100% match the actual production tables:
 * 1. public.merchant_payouts
 * 2. public.merchant_ledger_entries
 * 3. public.merchant_wallets
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
console.log('TEST SUITE: MIGRATION 041 PRODUCTION SCHEMA VERIFICATION');
console.log('================================================================\n');

// 1. Check Migration 041 File Exists
const mig041Path = path.join(rootDir, 'supabase/migrations/041_fix_merchant_payout_schema_columns.sql');
assert(fs.existsSync(mig041Path), 'Migration 041 file exists');
const mig041Content = fs.readFileSync(mig041Path, 'utf8');

// 2. Strict Check: bank_account_encrypted MUST NOT BE IN INSERT
console.log('\n1. Checking bank_account_encrypted Absence in INSERT columns...');
assert(!mig041Content.match(/INSERT INTO public\.merchant_payouts[\s\S]*?bank_account_encrypted/), 'bank_account_encrypted is NOT in INSERT column list of Migration 041');

// 3. Schema Verification against public.merchant_payouts
console.log('\n2. Verifying merchant_payouts INSERT columns against actual schema...');
// Extract columns from INSERT INTO public.merchant_payouts
const insertMatch = mig041Content.match(/INSERT INTO public\.merchant_payouts\s*\(([\s\S]*?)\)\s*VALUES/);
assert(Boolean(insertMatch), 'Found INSERT INTO public.merchant_payouts statement');

const columnsInInsert = insertMatch[1]
  .split(',')
  .map(c => c.trim())
  .filter(c => c.length > 0 && !c.startsWith('--'));

console.log('  Columns in INSERT statement:', columnsInInsert);

// Production schema defined in 028 + 037
const validMerchantPayoutsColumns = [
  'id',
  'merchant_id',
  'order_id',
  'provider_order_id',
  'amount',
  'fee_amount',
  'total_deducted',
  'account_holder_name',
  'bank_account_number_masked',
  'ifsc_code',
  'status',
  'payout_provider',
  'provider_reference_id',
  'rejection_reason',
  'idempotency_key',
  'created_at',
  'updated_at',
  'processed_at',
  'payout_method',
  'upi_id',
];

let allPayoutsColsValid = true;
for (const col of columnsInInsert) {
  if (!validMerchantPayoutsColumns.includes(col)) {
    allPayoutsColsValid = false;
    console.error(`    Unknown column found: ${col}`);
  }
}
assert(allPayoutsColsValid, 'Every column in merchant_payouts INSERT exists in actual production schema');

// 4. Schema Verification against public.merchant_ledger_entries
console.log('\n3. Verifying merchant_ledger_entries INSERT columns against actual schema...');
const ledgerMatch = mig041Content.match(/INSERT INTO public\.merchant_ledger_entries\s*\(([\s\S]*?)\)\s*VALUES/);
assert(Boolean(ledgerMatch), 'Found INSERT INTO public.merchant_ledger_entries statement');

const columnsInLedger = ledgerMatch[1]
  .split(',')
  .map(c => c.trim())
  .filter(c => c.length > 0 && !c.startsWith('--'));

console.log('  Columns in ledger INSERT statement:', columnsInLedger);

const validLedgerColumns = [
  'id',
  'merchant_id',
  'wallet_id',
  'amount',
  'fee_amount',
  'entry_type',
  'reference_type',
  'reference_id',
  'idempotency_key',
  'balance_before',
  'balance_after',
  'metadata',
  'created_at',
];

let allLedgerColsValid = true;
for (const col of columnsInLedger) {
  if (!validLedgerColumns.includes(col)) {
    allLedgerColsValid = false;
    console.error(`    Unknown ledger column found: ${col}`);
  }
}
assert(allLedgerColsValid, 'Every column in merchant_ledger_entries INSERT exists in actual production schema');

// 5. Check Entry Types in Ledger
assert(mig041Content.includes("'PAYOUT_LOCK'"), "Ledger uses valid entry_type 'PAYOUT_LOCK'");
assert(mig041Content.includes("'PAYOUT_FEE_LOCK'"), "Ledger uses valid entry_type 'PAYOUT_FEE_LOCK'");
assert(!mig041Content.includes("'DEBIT'"), "Ledger does not use invalid entry_type 'DEBIT'");
assert(!mig041Content.includes("'PAYOUT_FEE'"), "Ledger does not use invalid reference_type 'PAYOUT_FEE'");

// 6. Check Spencer Regex
console.log('\n4. Checking Spencer Regex DUPMAX=255 Compatibility...');
assert(mig041Content.includes("^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$"), 'Uses DUPMAX-safe regex ^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$');
assert(!mig041Content.includes('{2,256}'), 'Has no repetition count > 255');

// 7. Check Financial Logic
console.log('\n5. Checking Financial Logic (₹10 Payout = ₹12.50 Debit)...');
assert(mig041Content.includes('v_fee NUMERIC(12, 2) := 2.50;'), 'Fee is flat ₹2.50');
assert(mig041Content.includes('v_total_deducted := p_amount + v_fee;'), 'Total deduction = amount + ₹2.50 fee');
assert(mig041Content.includes('locked_payout_balance = locked_payout_balance + v_total_deducted'), 'Locked float = amount + fee');

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
