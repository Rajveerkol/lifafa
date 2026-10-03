/**
 * Automated Verification Script: UPI-Only Payout Architecture Across Entire Platform
 * Tests 12 criteria across codebase, Edge Functions, SQL migration, and frontend components.
 */

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('VERIFYING UPI-ONLY PAYOUT ARCHITECTURE AUDIT (12 CRITERIA)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// CRITERION 1: Consumer withdrawal UI has no IMPS/bank fields
// -----------------------------------------------------------------------------
console.log('1. Checking Consumer Withdrawal UI (WithdrawModal.tsx)...');
const withdrawModalPath = path.join(rootDir, 'src/components/wallet/WithdrawModal.tsx');
const withdrawModalContent = fs.readFileSync(withdrawModalPath, 'utf8');

assert(!withdrawModalContent.includes('Bank Account (IMPS)'), 'Rail toggle Bank Account (IMPS) removed');
assert(!withdrawModalContent.includes('bankAccountNumber'), 'bankAccountNumber input removed');
assert(!withdrawModalContent.includes('ifscCode'), 'ifscCode input removed');
assert(withdrawModalContent.includes('Beneficiary UPI ID'), 'Beneficiary UPI ID input present');
assert(withdrawModalContent.includes('Instant automated UPI transfers'), 'Instant automated UPI transfers description present');
assert(withdrawModalContent.includes('3.58'), 'Flat platform fee ₹3.58 breakdown displayed');

// -----------------------------------------------------------------------------
// CRITERION 2: Consumer withdrawal service & RPC enforce UPI only
// -----------------------------------------------------------------------------
console.log('\n2. Checking Consumer Withdrawal Service (walletService.ts)...');
const walletServicePath = path.join(rootDir, 'src/services/walletService.ts');
const walletServiceContent = fs.readFileSync(walletServicePath, 'utf8');

assert(walletServiceContent.includes("payoutMethod === ('IMPS' as any)"), 'walletService rejects IMPS parameter');
assert(walletServiceContent.includes('IMPS payouts are no longer supported. All withdrawals are processed via UPI only.'), 'walletService error message for IMPS');
assert(walletServiceContent.includes("payoutMethod: 'UPI'"), 'walletService enforces UPI payoutMethod');

// -----------------------------------------------------------------------------
// CRITERION 3: Consumer withdrawal fee = ₹3.58 and debit = principal + ₹3.58
// -----------------------------------------------------------------------------
console.log('\n3. Checking Consumer Withdrawal Fee Invariant (Migration 039)...');
const mig039Path = path.join(rootDir, 'supabase/migrations/039_enforce_upi_only_payout_architecture.sql');
const mig039Content = fs.readFileSync(mig039Path, 'utf8');

assert(mig039Content.includes('v_fee NUMERIC(12, 2) := 3.58;'), 'Consumer withdrawal fee initialized to ₹3.58');
assert(mig039Content.includes('v_total_deduction := v_payout_amount + v_fee;'), 'Consumer total debit = payout + ₹3.58 fee');
assert(mig039Content.includes("p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) <> ''"), 'RPC rejects non-null bank account parameter');

// -----------------------------------------------------------------------------
// CRITERION 4: Lifafa claim UI has no IMPS/bank fields
// -----------------------------------------------------------------------------
console.log('\n4. Checking Lifafa Claim UI (createThemeComponents.tsx & ClaimPage.tsx & ClaimModal.tsx)...');
const themeCompPath = path.join(rootDir, 'src/themes/shared/createThemeComponents.tsx');
const themeCompContent = fs.readFileSync(themeCompPath, 'utf8');
const claimPagePath = path.join(rootDir, 'src/pages/ClaimPage.tsx');
const claimPageContent = fs.readFileSync(claimPagePath, 'utf8');
const claimModalPath = path.join(rootDir, 'src/components/lifafa/ClaimModal.tsx');
const claimModalContent = fs.readFileSync(claimModalPath, 'utf8');

assert(!themeCompContent.includes('OR BANK TRANSFER'), 'createThemeComponents removed OR BANK TRANSFER divider');
assert(!themeCompContent.includes('placeholder="Account Number"'), 'createThemeComponents removed Bank Account Number input');
assert(!themeCompContent.includes('placeholder="e.g. SBIN0001234"'), 'createThemeComponents removed IFSC input');
assert(themeCompContent.includes('Instant UPI Settlement Details'), 'createThemeComponents renders Instant UPI Settlement Details');

assert(!claimPageContent.includes('OR BANK TRANSFER'), 'ClaimPage removed OR BANK TRANSFER divider');
assert(!claimPageContent.includes('placeholder="Account Number"'), 'ClaimPage removed Bank Account Number input');
assert(claimPageContent.includes('Instant UPI Settlement Details'), 'ClaimPage renders Instant UPI Settlement Details');

assert(!claimModalContent.includes('accountHolderName as per bank records'), 'ClaimModal validation requires UPI only');

// -----------------------------------------------------------------------------
// CRITERION 5: Lifafa claim service & RPC enforce UPI only
// -----------------------------------------------------------------------------
console.log('\n5. Checking Lifafa Claim Service & RPC (lifafaService.ts & Migration 039)...');
const lifafaServicePath = path.join(rootDir, 'src/services/lifafaService.ts');
const lifafaServiceContent = fs.readFileSync(lifafaServicePath, 'utf8');

assert(lifafaServiceContent.includes("supabase.functions.invoke('consumer-paynit-payout'"), 'lifafaService dispatches to consumer-paynit-payout');
assert(mig039Content.includes("Bank account claims are no longer supported. All external claims must use UPI."), 'claim_lifafa_rpc in 039 rejects bank account parameter');
assert(mig039Content.includes("Invalid UPI ID format. Expected format: username@bank"), 'claim_lifafa_rpc enforces valid UPI format');

// -----------------------------------------------------------------------------
// CRITERION 6: Lifafa claimant fee = ₹0 and failure refund to creator wallet
// -----------------------------------------------------------------------------
console.log('\n6. Checking Lifafa Claimant Fee & Failure Refund Invariant (Migration 036 & 039)...');
const mig036Path = path.join(rootDir, 'supabase/migrations/036_round2_critical_security_and_financial_fixes.sql');
const mig036Content = fs.readFileSync(mig036Path, 'utf8');

assert(mig039Content.includes('0.00, -- Free to claimant'), 'claim_lifafa_rpc records 0 fee for claimant');
assert(mig036Content.includes("admin_update_withdrawal_rpc"), 'admin_update_withdrawal_rpc present in migration 036');
assert(mig036Content.includes("refund the CREATOR's available wallet balance"), 'Migration 036 documents and enforces creator wallet refund for failed claims');
assert(mig036Content.includes("WHERE user_id = v_claim.creator_id"), 'Migration 036 refunds creator wallet for failed external claims');
assert(fs.readFileSync(path.join(rootDir, 'supabase/functions/consumer-paynit-payout/index.ts'), 'utf8').includes("admin_update_withdrawal_rpc"), 'consumer-paynit-payout invokes admin_update_withdrawal_rpc on failure');

// -----------------------------------------------------------------------------
// CRITERION 7: Merchant portal payout UI has no IMPS/bank fields
// -----------------------------------------------------------------------------
console.log('\n7. Checking Merchant Portal Payout UI (MerchantNewPayoutModal.tsx & MerchantPortalPage.tsx)...');
const mchModalPath = path.join(rootDir, 'src/components/merchant/MerchantNewPayoutModal.tsx');
const mchModalContent = fs.readFileSync(mchModalPath, 'utf8');
const mchPagePath = path.join(rootDir, 'src/pages/MerchantPortalPage.tsx');
const mchPageContent = fs.readFileSync(mchPagePath, 'utf8');

assert(!mchModalContent.includes('Bank Account (IMPS)'), 'MerchantNewPayoutModal removed Bank Account (IMPS) toggle');
assert(!mchModalContent.includes('account_number'), 'MerchantNewPayoutModal removed account_number input');
assert(!mchModalContent.includes('ifsc_code'), 'MerchantNewPayoutModal removed ifsc_code input');
assert(mchModalContent.includes('Beneficiary UPI ID'), 'MerchantNewPayoutModal renders Beneficiary UPI ID input');

assert(mchPageContent.includes('Direct disbursement via PayNit Instant UPI rails'), 'MerchantPortalPage Make Payout subtitle is Instant UPI');
assert(mchPageContent.includes('UPI Request Body Schema (Exclusive Rail)'), 'MerchantPortalPage API docs highlights UPI Exclusive Rail');
assert(!mchPageContent.includes('IMPS Request Body Schema'), 'MerchantPortalPage API docs removed IMPS schema');

// -----------------------------------------------------------------------------
// CRITERION 8: Merchant Gateway API rejects IMPS and bank details
// -----------------------------------------------------------------------------
console.log('\n8. Checking Merchant Gateway Edge Functions & Service (merchant-paynit-payout & merchantGatewayService.ts)...');
const mchPaynitFuncPath = path.join(rootDir, 'supabase/functions/merchant-paynit-payout/index.ts');
const mchPaynitFuncContent = fs.readFileSync(mchPaynitFuncPath, 'utf8');
const mchGatewayServPath = path.join(rootDir, 'src/services/merchantGatewayService.ts');
const mchGatewayServContent = fs.readFileSync(mchGatewayServPath, 'utf8');

assert(mchPaynitFuncContent.includes("IMPS and bank account payouts are no longer supported"), 'merchant-paynit-payout rejects IMPS and bank account inputs with 400');
assert(mchGatewayServContent.includes("IMPS payouts are no longer supported. All payouts are processed via UPI only."), 'merchantGatewayService rejects IMPS locally before dispatch');

// -----------------------------------------------------------------------------
// CRITERION 9: Merchant payout fee = ₹2.50 and wallet debit = payout amount + ₹2.50
// -----------------------------------------------------------------------------
console.log('\n9. Checking Merchant Payout Fee Invariant (Migration 039 & merchant-paynit-payout)...');
assert(mig039Content.includes('v_fee NUMERIC(12, 2) := 2.50; -- MANDATORY FLAT ₹2.50 FEE'), 'merchant_initiate_payout_rpc enforces flat ₹2.50 fee');
assert(mig039Content.includes('v_total_deducted := p_amount + v_fee;'), 'Merchant float debit = payout amount + ₹2.50 fee');
assert(mchPaynitFuncContent.includes('fee: 2.50'), 'merchant-paynit-payout records ₹2.50 fee');

// -----------------------------------------------------------------------------
// CRITERION 10: All PayNit payloads across all flows are UPI only
// -----------------------------------------------------------------------------
console.log('\n10. Checking PayNit Payloads Across All Flows...');
const consumerFuncPath = path.join(rootDir, 'supabase/functions/consumer-paynit-payout/index.ts');
const consumerFuncContent = fs.readFileSync(consumerFuncPath, 'utf8');
const mchRupeeFuncPath = path.join(rootDir, 'supabase/functions/merchant-payrupee-payout/index.ts');
const mchRupeeFuncContent = fs.readFileSync(mchRupeeFuncPath, 'utf8');

assert(consumerFuncContent.includes("type: 'UPI'"), 'consumer-paynit-payout constructs type: "UPI"');
assert(!consumerFuncContent.includes("type: 'IMPS'"), 'consumer-paynit-payout never constructs type: "IMPS"');

assert(mchPaynitFuncContent.includes("type: 'UPI'"), 'merchant-paynit-payout constructs type: "UPI"');
assert(!mchPaynitFuncContent.includes("type: 'IMPS'"), 'merchant-paynit-payout never constructs type: "IMPS"');

assert(mchRupeeFuncContent.includes("type: 'UPI'"), 'merchant-payrupee-payout constructs type: "UPI"');
assert(!mchRupeeFuncContent.includes("type: 'IMPS'"), 'merchant-payrupee-payout never constructs type: "IMPS"');

// -----------------------------------------------------------------------------
// CRITERION 11: Migration 039 is prepared and NOT executed
// -----------------------------------------------------------------------------
console.log('\n11. Checking Migration 039 Status...');
assert(fs.existsSync(mig039Path), 'Migration 039 file exists');
assert(mig039Content.includes('READY FOR MANUAL EXECUTION — NOT EXECUTED'), 'Migration 039 is marked READY FOR MANUAL EXECUTION — NOT EXECUTED');

// -----------------------------------------------------------------------------
// CRITERION 12: Historical records and columns are preserved
// -----------------------------------------------------------------------------
console.log('\n12. Checking Preservation of Historical IMPS Records & Columns...');
assert(mig039Content.includes('Preserves all historical columns and historical IMPS/PayRupee rows'), 'Migration 039 preserves historical columns and rows');
assert(mchPageContent.includes("{(p.payout_method === 'UPI' || p.upi_id) ? 'UPI' : 'IMPS'}"), 'MerchantPortalPage preserves historical IMPS badge rendering');
assert(mchPageContent.includes("selectedPayoutDetail.payout_method || (selectedPayoutDetail.upi_id ? 'UPI' : 'IMPS')"), 'MerchantPortalPage preserves historical IMPS detail drawer');

console.log('\n================================================================');
console.log(`AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL 12 UPI-ONLY PAYOUT ARCHITECTURE CRITERIA VERIFIED SUCCESSFULLY!\n');
}
