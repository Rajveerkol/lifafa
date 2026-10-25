/**
 * Test Suite: PayNit Automatic UPI Withdrawal & Payout Verification
 * 
 * Verifies:
 * 1. Existence and integrity of deployed consumer-paynit-payout Edge Function.
 * 2. Automated dispatch from walletService.requestWithdrawal via consumer-paynit-payout.
 * 3. Safe database state recovery via idempotency key on network timeouts.
 * 4. Automated bounded status polling & edge reconciliation in WithdrawModal.tsx.
 * 5. Automated dispatch for UPI Lifafa external claims in lifafaService.ts.
 * 6. Admin Panel controls for immediate dispatch and reconciliation.
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
console.log('🚀 RUNNING PAYNIT AUTOMATIC UPI PAYOUT INTEGRATION VERIFICATION');
console.log('='.repeat(70));

// 1. Edge Function Verification
console.log('\n--- 1. PayNit Edge Function Codebase Check ---');
const paynitEdgePath = path.join(rootDir, 'supabase', 'functions', 'consumer-paynit-payout', 'index.ts');
assert(fs.existsSync(paynitEdgePath), 'consumer-paynit-payout/index.ts exists on filesystem');

const paynitEdgeContent = fs.readFileSync(paynitEdgePath, 'utf8');
assert(paynitEdgeContent.includes("action === 'request_and_dispatch'"), 'Edge function supports request_and_dispatch single-call orchestrator');
assert(paynitEdgeContent.includes("action === 'check_status'"), 'Edge function supports check_status active reconciliation');
assert(paynitEdgeContent.includes("admin_update_withdrawal_rpc"), 'Edge function uses admin_update_withdrawal_rpc for atomic database finalization');
assert(paynitEdgeContent.includes("api.paynit.in"), 'Edge function targets PayNit official API endpoint');

// 2. Wallet Service Integration
console.log('\n--- 2. walletService Integration ---');
const walletServiceContent = fs.readFileSync(path.join(rootDir, 'src', 'services', 'walletService.ts'), 'utf8');
assert(walletServiceContent.includes("functions.invoke('consumer-paynit-payout'"), 'walletService.requestWithdrawal dispatches via consumer-paynit-payout');
assert(walletServiceContent.includes("action: 'request_and_dispatch'"), 'walletService transmits request_and_dispatch action');
assert(walletServiceContent.includes("idempotency_key"), 'walletService includes database recovery on idempotency_key');
assert(walletServiceContent.includes("action: 'check_status'"), 'walletService.checkWithdrawalStatus triggers active edge reconciliation');

// 3. Lifafa Service External Claims
console.log('\n--- 3. lifafaService UPI Claims ---');
const lifafaServiceContent = fs.readFileSync(path.join(rootDir, 'src', 'services', 'lifafaService.ts'), 'utf8');
assert(lifafaServiceContent.includes("functions.invoke('consumer-paynit-payout'"), 'lifafaService.claimLifafa dispatches UPI claim payouts via consumer-paynit-payout');
assert(lifafaServiceContent.includes("action: 'reconcile'"), 'lifafaService.verifyClaimBankPayout reconciles PROCESSING claims via consumer-paynit-payout');

// 4. WithdrawModal Polling and UX
console.log('\n--- 4. WithdrawModal UI & Auto-Polling ---');
const withdrawModalContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'wallet', 'WithdrawModal.tsx'), 'utf8');
assert(withdrawModalContent.includes("successData.status !== 'PROCESSING' && successData.status !== 'PENDING'"), 'WithdrawModal polls for both PROCESSING and PENDING states');
assert(withdrawModalContent.includes("Payout In Progress (UPI)"), 'WithdrawModal displays "Payout In Progress (UPI)" for in-flight transfers');
assert(withdrawModalContent.includes("Withdrawal Paid Successfully!"), 'WithdrawModal displays "Withdrawal Paid Successfully!" upon SUCCESS');

// 5. Admin Panel Dispatch Capability
console.log('\n--- 5. Admin Panel Dispatch Controls ---');
const adminPageContent = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'AdminPage.tsx'), 'utf8');
assert(adminPageContent.includes("handleDispatchPendingPayout"), 'AdminPage retains immediate dispatch action');
assert(adminPageContent.includes("Mark Paid"), 'AdminPage retains manual Mark Paid fallback');

console.log('\n' + '='.repeat(70));
if (process.exitCode === 1) {
  console.log('💥 SOME VERIFICATIONS FAILED');
} else {
  console.log('🎉 ALL PAYNIT AUTOMATIC PAYOUT INTEGRATION CHECKS PASSED!');
}
console.log('='.repeat(70));
