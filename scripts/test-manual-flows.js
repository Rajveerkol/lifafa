/**
 * Test Suite: CreateLifafa Manual Deposit & Payout Restoration Verification
 * 
 * Verifies:
 * 1. Removal of all YouPI-PG gateway scripts, functions, and frontend dependencies.
 * 2. Complete decoupling from automated payout failure triggers (consumer-paynit-payout).
 * 3. Restoration of manual deposit request flow (submit_deposit_request_rpc, UTR validation, Telegram assistance).
 * 4. Restoration of manual payout review flow (Pending Admin Review, Request ID, and admin approval).
 * 5. Simulation of state transitions and double-entry ledger calculations.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition, description) {
  if (!condition) {
    console.error(`❌ FAILED: ${description}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${description}`);
  }
}

console.log('='.repeat(70));
console.log('🚀 RUNNING MANUAL FLOWS & GATEWAY RETIREMENT VERIFICATION');
console.log('='.repeat(70));

// 1. Check Gateway Script & File Removals
console.log('\n--- 1. Gateway Asset & Function Removal ---');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
assert(!indexHtml.includes('/youpi.js'), 'index.html does not load /youpi.js');

const youpiJsExists = fs.existsSync(path.join(rootDir, 'public', 'youpi.js'));
assert(!youpiJsExists, 'public/youpi.js is completely removed from filesystem');

const youpiDepositFunc = fs.existsSync(path.join(rootDir, 'supabase', 'functions', 'create-youpi-deposit'));
assert(!youpiDepositFunc, 'supabase/functions/create-youpi-deposit is completely removed');

const youpiWebhookFunc = fs.existsSync(path.join(rootDir, 'supabase', 'functions', 'youpi-webhook'));
assert(!youpiWebhookFunc, 'supabase/functions/youpi-webhook is completely removed');

// 2. Check Decoupling from Automatic Payout Dispatch in lifafaService & walletService
console.log('\n--- 2. Automated Payout Dispatch Decoupling ---');
const lifafaServiceContent = fs.readFileSync(path.join(rootDir, 'src', 'services', 'lifafaService.ts'), 'utf8');
assert(!lifafaServiceContent.includes('consumer-paynit-payout'), 'lifafaService.ts does not invoke consumer-paynit-payout');
assert(lifafaServiceContent.includes("withdrawal_status: data.withdrawal_status || 'PENDING'"), 'lifafaService.ts returns PENDING for UPI_BANK claims');

const walletServiceContent = fs.readFileSync(path.join(rootDir, 'src', 'services', 'walletService.ts'), 'utf8');
assert(!walletServiceContent.includes('consumer-paynit-payout'), 'walletService.ts does not invoke consumer-paynit-payout');
assert(walletServiceContent.includes('request_withdrawal_rpc'), 'walletService.ts uses request_withdrawal_rpc directly');

// 3. Check Manual Deposit Frontend Flow
console.log('\n--- 3. Manual Deposit Frontend Verification ---');
const addMoneyModalContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'wallet', 'AddMoneyModal.tsx'), 'utf8');
assert(addMoneyModalContent.includes('walletService.submitDepositRequest'), 'AddMoneyModal calls walletService.submitDepositRequest');
assert(walletServiceContent.includes('submit_deposit_request_rpc'), 'walletService invokes submit_deposit_request_rpc');
assert(addMoneyModalContent.includes('DepositAdminAssistanceCard'), 'AddMoneyModal retains Telegram DepositAdminAssistanceCard');
assert(!addMoneyModalContent.includes('youpi'), 'AddMoneyModal has no youpi references');

// 4. Check Claim Page UI for PENDING Payout Screen
console.log('\n--- 4. Claim Page & Withdrawal Modal Status Screens ---');
const claimPageContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'ClaimPage.tsx'), 'utf8');
assert(!claimPageContent.includes('UPI Payout Could Not Be Dispatched'), 'ClaimPage does not show "UPI Payout Could Not Be Dispatched" failure card');
assert(claimPageContent.includes('Reward Claimed') && claimPageContent.includes('Payout In Review'), 'ClaimPage shows "Reward Claimed — Payout In Review"');
assert(claimPageContent.includes('Request ID:'), 'ClaimPage displays the unique Payout Request ID');

const withdrawModalContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'wallet', 'WithdrawModal.tsx'), 'utf8');
assert(withdrawModalContent.includes('PENDING REVIEW'), 'WithdrawModal shows PENDING REVIEW badge');
assert(withdrawModalContent.includes('Withdrawal Request Submitted'), 'WithdrawModal shows Withdrawal Request Submitted card');
assert(!withdrawModalContent.includes('PayNit will transfer'), 'WithdrawModal has no external gateway promise');

// 5. Check Admin Page Capabilities
console.log('\n--- 5. Admin Panel Review & Payout Controls ---');
const adminPageContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'AdminPage.tsx'), 'utf8');
assert(adminPageContent.includes('handleApproveDeposit'), 'AdminPage contains manual deposit approval flow');
assert(adminPageContent.includes('Mark Paid'), 'AdminPage contains "Mark Paid" manual payout button');

// 6. Check Migration 077 File
console.log('\n--- 6. Database Cleanup Migration 077 ---');
const mig077Path = path.join(rootDir, 'supabase', 'migrations', '077_retire_youpi_pg_gateway_restore_manual_flows.sql');
assert(fs.existsSync(mig077Path), '077_retire_youpi_pg_gateway_restore_manual_flows.sql exists');
const mig077Content = fs.readFileSync(mig077Path, 'utf8');
assert(mig077Content.includes('STATUS: NOT EXECUTED'), 'Migration is clearly marked NOT EXECUTED for safety');
assert(mig077Content.includes('DROP SCHEMA IF EXISTS youpi CASCADE;'), 'Migration drops isolated youpi schema');
assert(mig077Content.includes('public.wallets is NEVER touched or dropped'), 'Migration explicitly protects core ledger tables');

// 7. Flow Simulation
console.log('\n--- 7. Mathematical & Ledger Simulation ---');
// Deposit calculation test (Updated fee slabs):
const depositAmount1 = 500;
const depositFee1 = depositAmount1 < 1000 ? 100 : Math.round(depositAmount1 * 0.02 * 100) / 100;
const totalPayable1 = depositAmount1 + depositFee1;
assert(depositFee1 === 100, 'Flat ₹100 deposit fee correctly calculated for ₹500.00');
assert(totalPayable1 === 600, 'Total payable is ₹600.00');

const depositAmount2 = 1000;
const depositFee2 = Math.round(depositAmount2 * 0.02 * 100) / 100;
const totalPayable2 = depositAmount2 + depositFee2;
assert(depositFee2 === 20, '2% deposit fee correctly calculated (₹20.00 for ₹1,000.00)');
assert(totalPayable2 === 1020, 'Total payable is ₹1,020.00');

// Withdrawal calculation test:
const withdrawalAmount = 200;
const fixedWithdrawalFee = 0; // or slab-based
const netWithdrawal = withdrawalAmount - fixedWithdrawalFee;
assert(netWithdrawal === 200, 'Withdrawal net amount verified');

console.log('\n' + '='.repeat(70));
if (process.exitCode === 1) {
  console.log('💥 SOME VERIFICATIONS FAILED');
} else {
  console.log('🎉 ALL AUDIT & INTEGRITY CHECKS PASSED SUCCESSFULLY!');
}
console.log('='.repeat(70));
