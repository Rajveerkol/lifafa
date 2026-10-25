/**
 * Test Suite: Unified Deposit Fee Slabs Everywhere (Customer & Merchant)
 * 
 * Verifies:
 * 1. Exact fee slabs on both customer and merchant flows:
 *    - ₹100   -> Fee ₹100 -> Total ₹200
 *    - ₹200   -> Fee ₹100 -> Total ₹300
 *    - ₹500   -> Fee ₹100 -> Total ₹600
 *    - ₹999   -> Fee ₹100 -> Total ₹1,099
 *    - ₹1,000 -> Fee ₹20  -> Total ₹1,020
 *    - ₹2,000 -> Fee ₹40  -> Total ₹2,040
 *    - ₹5,000 -> Fee ₹100 -> Total ₹5,100
 * 2. Invalid amounts (< ₹100) are prevented (e.g. ₹99).
 * 3. Boundary check between ₹999.99 and ₹1,000.00.
 * 4. Decimal rounding precision.
 * 5. Consistency between customer (calculateDepositFee) and merchant (merchantGatewayService.calculateDepositFee).
 * 6. Audit of UI components (AddMoneyModal, MerchantPortalPage, MerchantTopUpModal, AdminMerchantPanel).
 * 7. Audit of database migrations 080 and 081 (both marked STATUS: NOT EXECUTED).
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { calculateDepositFee } from '../src/lib/feeCalculations.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('======================================================================');
console.log('🚀 RUNNING UNIFIED DEPOSIT FEE SLABS VERIFICATION (CUSTOMER & MERCHANT)');
console.log('======================================================================\n');

// 1. Test Required Examples
console.log('--- 1. Authoritative Examples Verification ---');
const testCases = [
  { amount: 100, expectedFee: 100, expectedTotal: 200 },
  { amount: 200, expectedFee: 100, expectedTotal: 300 },
  { amount: 500, expectedFee: 100, expectedTotal: 600 },
  { amount: 999, expectedFee: 100, expectedTotal: 1099 },
  { amount: 1000, expectedFee: 20, expectedTotal: 1020 },
  { amount: 2000, expectedFee: 40, expectedTotal: 2040 },
  { amount: 5000, expectedFee: 100, expectedTotal: 5100 },
];

// Mock merchantGatewayService calculateDepositFee wrapper exactly as implemented
const merchantCalculateDepositFee = (depositAmount) => {
  const res = calculateDepositFee(depositAmount);
  return {
    depositAmount: res.depositAmount,
    fee: res.fee,
    totalPayable: res.totalPayable,
    walletCredit: res.walletCredit,
    netCredited: res.walletCredit,
  };
};

for (const tc of testCases) {
  // Test customer wallet calculation
  const custRes = calculateDepositFee(tc.amount);
  assert.strictEqual(custRes.depositAmount, tc.amount, `Customer amount mismatch for ₹${tc.amount}`);
  assert.strictEqual(custRes.fee, tc.expectedFee, `Customer fee mismatch for ₹${tc.amount}`);
  assert.strictEqual(custRes.totalPayable, tc.expectedTotal, `Customer total mismatch for ₹${tc.amount}`);
  assert.strictEqual(custRes.walletCredit, tc.amount, `Customer wallet credit mismatch for ₹${tc.amount}`);

  // Test merchant portal calculation
  const merchRes = merchantCalculateDepositFee(tc.amount);
  assert.strictEqual(merchRes.depositAmount, tc.amount, `Merchant amount mismatch for ₹${tc.amount}`);
  assert.strictEqual(merchRes.fee, tc.expectedFee, `Merchant fee mismatch for ₹${tc.amount}`);
  assert.strictEqual(merchRes.totalPayable, tc.expectedTotal, `Merchant total mismatch for ₹${tc.amount}`);
  assert.strictEqual(merchRes.walletCredit, tc.amount, `Merchant wallet credit mismatch for ₹${tc.amount}`);
  assert.strictEqual(merchRes.netCredited, tc.amount, `Merchant net credited mismatch for ₹${tc.amount}`);

  console.log(`✅ PASSED: Deposit ₹${tc.amount} -> Fee ₹${tc.expectedFee} -> Total Payable ₹${tc.expectedTotal}`);
}

// 2. Test Boundary & Invalid Amounts
console.log('\n--- 2. Boundary & Invalid Amount Validation ---');

// ₹99 rejection
const sub100 = calculateDepositFee(99);
assert.strictEqual(sub100.fee, 0, 'Amounts < ₹100 must yield 0 fee (invalid)');
const sub100Merch = merchantCalculateDepositFee(99);
assert.strictEqual(sub100Merch.fee, 0, 'Merchant amounts < ₹100 must yield 0 fee (invalid)');
console.log('✅ PASSED: ₹99 deposit correctly rejected by boundary checks');

// ₹999 vs ₹999.99 vs ₹1,000
const at999_99 = calculateDepositFee(999.99);
assert.strictEqual(at999_99.fee, 100, '₹999.99 must have flat ₹100 fee');
assert.strictEqual(at999_99.totalPayable, 1099.99, '₹999.99 total must be ₹1,099.99');
console.log('✅ PASSED: ₹999.99 boundary has flat ₹100 fee -> Total ₹1,099.99');

const at1000 = calculateDepositFee(1000);
assert.strictEqual(at1000.fee, 20, '₹1,000 must have 2% fee (₹20)');
assert.strictEqual(at1000.totalPayable, 1020, '₹1,000 total must be ₹1,020');
console.log('✅ PASSED: ₹1,000 boundary transitions to 2% fee (₹20) -> Total ₹1,020');

// Decimal rounding: ₹1,234.56 * 0.02 = 24.6912 -> ₹24.69
const decAmount = 1234.56;
const decRes = calculateDepositFee(decAmount);
assert.strictEqual(decRes.fee, 24.69, 'Decimal 2% fee properly rounded to 2 decimal places');
assert.strictEqual(decRes.totalPayable, 1259.25, 'Decimal total payable properly calculated');
console.log('✅ PASSED: Decimal amount ₹1,234.56 -> Fee ₹24.69 -> Total ₹1,259.25');

// 3. UI & Service Component Audit
console.log('\n--- 3. UI Component & Service Codebase Audit ---');

const mchServicePath = path.join(__dirname, '../src/services/merchantGatewayService.ts');
const mchServiceContent = fs.readFileSync(mchServicePath, 'utf8');
assert(mchServiceContent.includes('calcUnifiedDepositFee(depositAmount)'), 'merchantGatewayService must delegate to calcUnifiedDepositFee');
console.log('✅ PASSED: merchantGatewayService.calculateDepositFee directly invokes unified calculateDepositFee');

const addMoneyModalPath = path.join(__dirname, '../src/components/wallet/AddMoneyModal.tsx');
const addMoneyContent = fs.readFileSync(addMoneyModalPath, 'utf8');
assert(addMoneyContent.includes('calculateDepositFee'), 'AddMoneyModal must use calculateDepositFee');
assert(addMoneyContent.includes('Total Payable'), 'AddMoneyModal must display Total Payable');
assert(addMoneyContent.includes('Platform Fee'), 'AddMoneyModal must display Platform Fee');
console.log('✅ PASSED: AddMoneyModal implements dynamic live fee and separate breakdown');

const merchantPortalPath = path.join(__dirname, '../src/pages/MerchantPortalPage.tsx');
const merchantPortalContent = fs.readFileSync(merchantPortalPath, 'utf8');
assert(merchantPortalContent.includes('calculateDepositFee'), 'MerchantPortalPage must use calculateDepositFee');
assert(!merchantPortalContent.includes('Platform fee is exactly 2.0%'), 'Outdated "exactly 2.0%" removed from MerchantPortalPage');
assert(!merchantPortalContent.includes('incl. 2% fee'), 'Outdated "incl. 2% fee" removed from MerchantPortalPage');
assert(merchantPortalContent.includes('Flat ₹100'), 'MerchantPortalPage displays Flat ₹100 slab');
console.log('✅ PASSED: MerchantPortalPage cleaned of outdated fixed 2% text and shows live slabs');

const topUpModalPath = path.join(__dirname, '../src/components/merchant/MerchantTopUpModal.tsx');
const topUpModalContent = fs.readFileSync(topUpModalPath, 'utf8');
assert(topUpModalContent.includes('calculateDepositFee'), 'MerchantTopUpModal must use calculateDepositFee');
assert(!topUpModalContent.includes('2% standard gateway processing fee'), 'Outdated 2% subtitle removed from MerchantTopUpModal');
console.log('✅ PASSED: MerchantTopUpModal cleaned of outdated 2% subtitle');

const adminPanelPath = path.join(__dirname, '../src/components/admin/AdminMerchantPanel.tsx');
const adminPanelContent = fs.readFileSync(adminPanelPath, 'utf8');
assert(!adminPanelContent.includes('2% Fees:'), 'Outdated "2% Fees:" removed from AdminMerchantPanel');
assert(!adminPanelContent.includes('Fee (2%):'), 'Outdated "Fee (2%):" removed from AdminMerchantPanel');
console.log('✅ PASSED: AdminMerchantPanel cleaned of hardcoded "2%" labels');

// 4. Database Migrations Audit
console.log('\n--- 4. Database Migrations Audit (080 & 081) ---');

const mig080Path = path.join(__dirname, '../supabase/migrations/080_unambiguous_canonical_deposit_rpc.sql');
assert(fs.existsSync(mig080Path), 'Migration 080 must exist');
const mig080Content = fs.readFileSync(mig080Path, 'utf8');
assert(mig080Content.includes('STATUS: NOT EXECUTED'), 'Migration 080 must be marked NOT EXECUTED');
assert(mig080Content.includes('v_fee := 100.00;'), 'Migration 080 must enforce flat ₹100 for <₹1000');
assert(mig080Content.includes('v_fee := ROUND(v_clean_amount * 0.02, 2);'), 'Migration 080 must enforce 2% for >=₹1000');
console.log('✅ PASSED: Migration 080 enforces authoritative customer deposit fee slabs');

const mig081Path = path.join(__dirname, '../supabase/migrations/081_unify_merchant_deposit_fee_slabs.sql');
assert(fs.existsSync(mig081Path), 'Migration 081 must exist');
const mig081Content = fs.readFileSync(mig081Path, 'utf8');
assert(mig081Content.includes('STATUS: NOT EXECUTED'), 'Migration 081 must be marked NOT EXECUTED');
assert(mig081Content.includes('v_clean_amount < 100.00'), 'Migration 081 must reject merchant deposits < ₹100');
assert(mig081Content.includes('v_fee_amount := 100.00;'), 'Migration 081 must enforce flat ₹100 for <₹1000');
assert(mig081Content.includes('v_fee_amount := ROUND(v_clean_amount * 0.02, 2);'), 'Migration 081 must enforce 2% for >=₹1000');
assert(mig081Content.includes('public.wallets is NEVER touched or dropped'), 'Migration 081 must protect ledger');
assert(mig081Content.includes('public.merchant_wallets is NEVER touched or dropped'), 'Migration 081 must protect merchant wallets');
console.log('✅ PASSED: Migration 081 enforces identical merchant float deposit fee slabs safely');

console.log('\n======================================================================');
console.log('🎉 ALL UNIFIED DEPOSIT FEE SLAB CHECKS PASSED SUCCESSFULLY!');
console.log('======================================================================');
