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
console.log('TEST SUITE: MIGRATION 048 MERCHANT PAYOUT SCHEMA VERIFICATION');
console.log('================================================================\n');

// 1. Check Migration 048 File Exists
const mig048Path = path.join(rootDir, 'supabase/migrations/048_fix_merchant_initiate_payout_rpc_schema.sql');
assert(fs.existsSync(mig048Path), 'Migration 048 file exists');
const mig048Content = fs.readFileSync(mig048Path, 'utf8');

// 2. Strict Check: bank_account_encrypted MUST NOT BE IN INSERT
console.log('\n1. Checking bank_account_encrypted Absence...');
assert(!mig048Content.match(/INSERT INTO public\.merchant_payouts[\s\S]*?bank_account_encrypted/), 'bank_account_encrypted is NOT in INSERT column list of Migration 048');
assert(!mig048Content.includes('bank_account_encrypted'), 'bank_account_encrypted is completely absent from Migration 048');

// 3. Schema Verification against public.merchant_payouts
console.log('\n2. Verifying merchant_payouts INSERT columns against actual schema...');
const insertMatch = mig048Content.match(/INSERT INTO public\.merchant_payouts\s*\(([\s\S]*?)\)\s*VALUES/);
assert(Boolean(insertMatch), 'Found INSERT INTO public.merchant_payouts statement');

const columnsInInsert = insertMatch[1]
  .split(',')
  .map(c => c.trim())
  .filter(c => c.length > 0 && !c.startsWith('--'));

console.log('  Columns in INSERT statement:', columnsInInsert);

// Live verified columns on public.merchant_payouts
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
    console.error(`    Unknown column found in merchant_payouts: ${col}`);
  }
}
assert(allPayoutsColsValid, 'Every column in merchant_payouts INSERT exists in actual production schema');

// 4. Schema Verification against public.merchant_ledger_entries
console.log('\n3. Verifying merchant_ledger_entries INSERT columns against actual schema...');
const ledgerMatch = mig048Content.match(/INSERT INTO public\.merchant_ledger_entries\s*\(([\s\S]*?)\)\s*VALUES/);
assert(Boolean(ledgerMatch), 'Found INSERT INTO public.merchant_ledger_entries statement');

const columnsInLedger = ledgerMatch[1]
  .split(',')
  .map(c => c.trim())
  .filter(c => c.length > 0 && !c.startsWith('--'));

console.log('  Columns in ledger INSERT statement:', columnsInLedger);

// Live verified columns on public.merchant_ledger_entries
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

// 5. Schema Verification against public.wallet_transactions
console.log('\n4. Verifying wallet_transactions INSERT columns against actual schema...');
const txMatch = mig048Content.match(/INSERT INTO public\.wallet_transactions\s*\(([\s\S]*?)\)\s*VALUES/);
assert(Boolean(txMatch), 'Found INSERT INTO public.wallet_transactions statement');

const columnsInTx = txMatch[1]
  .split(',')
  .map(c => c.trim())
  .filter(c => c.length > 0 && !c.startsWith('--'));

console.log('  Columns in wallet_transactions INSERT statement:', columnsInTx);

const validTxColumns = [
  'id',
  'user_id',
  'wallet_id',
  'amount',
  'type',
  'status',
  'reference_type',
  'reference_id',
  'idempotency_key',
  'balance_before',
  'balance_after',
  'metadata',
  'created_at',
];

let allTxColsValid = true;
for (const col of columnsInTx) {
  if (!validTxColumns.includes(col)) {
    allTxColsValid = false;
    console.error(`    Unknown wallet_transactions column found: ${col}`);
  }
}
assert(allTxColsValid, 'Every column in wallet_transactions INSERT exists in actual production schema');

// 6. Strict UPI-Only Enforcement
console.log('\n5. Checking Strict UPI-Only Enforcement...');
assert(mig048Content.includes("IMPS and bank account payouts are no longer supported"), 'Rejects IMPS and bank accounts');
assert(mig048Content.includes("p_payout_method TEXT DEFAULT 'UPI'"), 'Defaults to UPI payout method');
assert(mig048Content.includes("'payout_method', 'UPI'"), 'Returns payout_method = UPI');
assert(mig048Content.includes("'payout_provider', 'PAYNIT'"), 'Returns payout_provider = PAYNIT');

// 7. Authoritative Unified Tiered Fee Slabs
console.log('\n6. Checking Unified Tiered Fee Slabs...');
assert(mig048Content.includes("p_amount <= 500.00 THEN\n        v_fee := 2.50;"), 'Slab 1: <= 500.00 fee is ₹2.50');
assert(mig048Content.includes("p_amount <= 1000.00 THEN\n        v_fee := 2.70;"), 'Slab 2: > 500.00 and <= 1000.00 fee is ₹2.70');
assert(mig048Content.includes("v_fee := 3.50;"), 'Slab 3: > 1000.00 fee is ₹3.50');
assert(mig048Content.includes("v_total_deducted := p_amount + v_fee;"), 'Total deducted = amount + fee');

// 8. Shared Wallet Balance & Locking Architecture
console.log('\n7. Checking Shared Wallet Balance & Locking Architecture...');
assert(mig048Content.includes("FROM public.wallets"), 'Locks user wallet in public.wallets');
assert(mig048Content.includes("WHERE user_id = v_merchant.user_id\n    FOR UPDATE;"), 'Locks user wallet FOR UPDATE');
assert(mig048Content.includes("UPDATE public.wallets"), 'Debits authoritative available_balance in public.wallets');
assert(mig048Content.includes("UPDATE public.merchant_wallets"), 'Synchronizes available_balance in public.merchant_wallets');
assert(mig048Content.includes("locked_payout_balance = locked_payout_balance + v_total_deducted"), 'Locks total deducted in float');

// 9. Spencer Regex DUPMAX=255
console.log('\n8. Checking Spencer Regex DUPMAX Safety...');
assert(mig048Content.includes("^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$"), 'Uses DUPMAX=255 safe regex');
assert(!mig048Content.includes('{2,256}'), 'Does not use repetition exceeding 255');

// 10. Ledger and Transaction Reference Types
console.log('\n9. Checking Ledger Entry & Transaction Reference Types...');
assert(mig048Content.includes("'PAYOUT_LOCK'"), "Uses valid entry_type 'PAYOUT_LOCK'");
assert(mig048Content.includes("'PAYOUT_FEE_LOCK'"), "Uses valid entry_type 'PAYOUT_FEE_LOCK'");
assert(mig048Content.includes("'WITHDRAWAL'"), "Uses valid wallet_transactions type 'WITHDRAWAL'");
assert(mig048Content.includes("'FEE'"), "Uses valid wallet_transactions type 'FEE'");
assert(mig048Content.includes("'MERCHANT_PAYOUT'"), "Uses valid reference_type 'MERCHANT_PAYOUT'");
assert(mig048Content.includes("'MERCHANT_PAYOUT_FEE'"), "Uses valid reference_type 'MERCHANT_PAYOUT_FEE'");

// 11. RPC Signature and Permissions
console.log('\n10. Checking RPC Signature and Permissions...');
assert(mig048Content.includes("CREATE OR REPLACE FUNCTION public.merchant_initiate_payout_rpc("), 'Function name is merchant_initiate_payout_rpc');
assert(mig048Content.includes("REVOKE ALL ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;"), 'Revoked from PUBLIC, anon');
assert(mig048Content.includes("GRANT EXECUTE ON FUNCTION public.merchant_initiate_payout_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;"), 'Granted to authenticated, service_role');

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
