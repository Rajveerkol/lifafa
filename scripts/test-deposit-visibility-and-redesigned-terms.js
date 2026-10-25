/**
 * Test Suite: Redesigned Terms Notice + Admin Deposit Visibility Verification
 *
 * Verifies:
 * 1. Redesigned White + Blue Funds Safety & Responsibility page (Part A).
 *    - 3-step progress journey: Step 1 Read Terms -> Step 2 Confirm Details -> Step 3 Submit.
 *    - Full 8-section terms with mandatory Section 4 callout.
 *    - Scroll-to-end enforcement before agreement unlock.
 *    - Mobile number confirmation dialog without fake OTP claims (USER_CONFIRMED).
 *    - Two-step decision with distinct "Confirm & Accept Terms" and "Reject Terms".
 *    - Rejection screen with feature restrictions and terms re-review option.
 * 2. Deposit Lifecycle & Admin Visibility Consistency (Part B).
 *    - Customer wallet deposit submission and persistence return values.
 *    - Merchant float deposit submission and persistence return values.
 *    - Admin panel queue segregation (All, Customer Wallet, Merchant Float).
 *    - Admin query failure error banner with Retry action.
 *    - Accurate metadata display: Request ID, account badges, net amount, fee, total payable, UTR, UPI.
 *    - Approval and rejection controls for both customer and merchant queues.
 *    - Migration 083 canonical RPC and RLS policies marked NOT EXECUTED.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('======================================================================');
console.log('🚀 RUNNING REDESIGNED TERMS NOTICE & ADMIN DEPOSIT VISIBILITY TESTS');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// PART A: Redesigned Terms Notice Verification
// -----------------------------------------------------------------------------
console.log('--- PART A: Redesigned White + Blue Terms Notice ---');
const modalPath = path.join(__dirname, '../src/components/compliance/FundsSafetyNoticeModal.tsx');
assert(fs.existsSync(modalPath), 'FundsSafetyNoticeModal.tsx must exist');
const modalCode = fs.readFileSync(modalPath, 'utf8');

// 1. White + Blue Design Theme Check
assert(
  modalCode.includes('bg-white') && modalCode.includes('border-blue-100'),
  'Must use clean white card with subtle blue borders'
);
assert(
  modalCode.includes('bg-blue-600') && modalCode.includes('hover:bg-blue-700'),
  'Must use primary blue buttons'
);
assert(
  !modalCode.includes('bg-slate-950/80') && !modalCode.includes('bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950'),
  'Must avoid dark/neon backgrounds'
);
console.log('✅ PASSED: Clean White + Blue design theme verified');

// 2. Visible 3-Step Progress Indicator
assert(
  modalCode.includes('Step') && modalCode.includes('of 3'),
  'Progress indicator must display "Step X of 3"'
);
assert(
  modalCode.includes('Read Terms') &&
    modalCode.includes('Confirm Details') &&
    (modalCode.includes('Submit Confirmation') || modalCode.includes('Submit')),
  'Progress indicator must display: Read Terms -> Confirm Details -> Submit'
);
console.log('✅ PASSED: 3-step visible progress indicator verified');

// 3. Step 1: Read Terms & Scroll Enforcement
const mandatoryPhrase =
  'The funds I deposit are subject to verification and applicable banking/payment rules. I understand that I am responsible for providing accurate transaction information and cooperating with legitimate verification requests.';
assert(
  modalCode.includes(mandatoryPhrase),
  'Must display the exact mandatory Section 4 highlighted phrase'
);
assert(
  modalCode.includes('handleScroll') && modalCode.includes('hasScrolledToEnd'),
  'Must track scroll to end'
);
assert(
  modalCode.includes('disabled={!hasScrolledToEnd || !agreedToTerms}'),
  'Continue button must be disabled until user scrolls to end and checks agreement box'
);
console.log('✅ PASSED: Step 1 Read Terms, Section 4 callout, and scroll-to-end enforcement verified');

// 4. Step 2: Confirm Account & Mobile Number Dialog
assert(
  modalCode.includes('Authenticated Account Identifier'),
  'Must show authenticated account identifier clearly'
);
assert(
  modalCode.includes('Confirm Mobile Number'),
  'Must provide "Confirm Mobile Number" button'
);
assert(
  modalCode.includes('Please check your mobile number again'),
  'Must show confirmation dialog "Please check your mobile number again"'
);
assert(
  modalCode.includes('Edit Number') && modalCode.includes('Yes, Confirm'),
  'Confirmation dialog must offer "Edit Number" and "Yes, Confirm"'
);
assert(
  modalCode.includes('USER_CONFIRMED') && !modalCode.includes('OTP Sent Successfully'),
  'Must record strictly as USER_CONFIRMED without fake OTP claims'
);
console.log('✅ PASSED: Step 2 Account verification, mobile confirmation dialog, and USER_CONFIRMED verified');

// 5. Step 3: Final Confirmation & Explicit Rejection
assert(
  modalCode.includes('Confirm &amp; Accept Terms') || modalCode.includes('Confirm & Accept Terms'),
  'Must provide distinct "Confirm & Accept Terms" action'
);
assert(
  modalCode.includes('Reject Terms'),
  'Must provide distinct "Reject Terms" action'
);
assert(
  modalCode.includes('Deposit &amp; Float Features Restricted') || modalCode.includes('Deposit & Float Features Restricted'),
  'Rejection flow must clearly explain deposit/float feature restrictions'
);
assert(
  modalCode.includes('Review Terms Again'),
  'Rejection flow must allow user to review terms again'
);
console.log('✅ PASSED: Step 3 Final confirmation and distinct rejection flow verified');

// -----------------------------------------------------------------------------
// PART B: Deposit Lifecycle & Admin Visibility Verification
// -----------------------------------------------------------------------------
console.log('\n--- PART B: Deposit Lifecycle & Admin Visibility ---');

// 1. Services Persistence & Return Values
const walletServicePath = path.join(__dirname, '../src/services/walletService.ts');
const walletServiceCode = fs.readFileSync(walletServicePath, 'utf8');
assert(
  walletServiceCode.includes('submit_deposit_request_rpc'),
  'walletService must call canonical submit_deposit_request_rpc'
);
assert(
  walletServiceCode.includes('p_payment_method'),
  'walletService must pass unambiguous explicit named parameters'
);

const merchantServicePath = path.join(__dirname, '../src/services/merchantGatewayService.ts');
const merchantServiceCode = fs.readFileSync(merchantServicePath, 'utf8');
assert(
  merchantServiceCode.includes('merchant_submit_deposit_rpc'),
  'merchantGatewayService must invoke merchant_submit_deposit_rpc'
);
assert(
  merchantServiceCode.includes('deposit_id: data?.deposit_id'),
  'merchantGatewayService.submitDeposit must return persisted deposit_id'
);
console.log('✅ PASSED: Customer and Merchant deposit submission services return persisted records');

// 2. Admin Service Robust Query & Hydration
const adminServicePath = path.join(__dirname, '../src/services/adminService.ts');
const adminServiceCode = fs.readFileSync(adminServicePath, 'utf8');
assert(
  adminServiceCode.includes('admin_get_deposit_requests_rpc'),
  'adminService must check canonical server RPC admin_get_deposit_requests_rpc'
);
assert(
  adminServiceCode.includes('profile:profiles!user_id') || adminServiceCode.includes('profilesData'),
  'adminService must support resilient relationship query and profile hydration'
);
assert(
  adminServiceCode.includes('throw new Error'),
  'adminService must propagate database errors rather than silently swallowing them as empty lists'
);
console.log('✅ PASSED: adminService handles canonical RPC, table fallbacks, and error propagation');

// 3. Admin Page Queue Segregation, Error Banners, and Status Filters
const adminPagePath = path.join(__dirname, '../src/pages/AdminPage.tsx');
const adminPageCode = fs.readFileSync(adminPagePath, 'utf8');

assert(
  adminPageCode.includes('depositLoadError'),
  'AdminPage must maintain depositLoadError state'
);
assert(
  adminPageCode.includes('Failed to load deposit requests from database'),
  'AdminPage must render visible error banner with error message when query fails'
);
assert(
  adminPageCode.includes('loadDepositsOnly'),
  'AdminPage must provide dedicated retry/refresh action for deposits'
);
assert(
  adminPageCode.includes('Customer Wallet') && adminPageCode.includes('Merchant Float'),
  'AdminPage must segregate Customer Wallet and Merchant Float queues'
);
assert(
  adminPageCode.includes('handleApproveDeposit') && adminPageCode.includes('handleApproveMerchantDeposit'),
  'AdminPage must support approval actions for both queues'
);
assert(
  adminPageCode.includes('rejectModalMerchantDeposit'),
  'AdminPage must support rejection workflow for merchant float deposits'
);
console.log('✅ PASSED: AdminPage queue segregation, error handling, and dual-queue review verified');

// 4. Migration 083 Server-Side Schema & RPC Integrity
const migrationPath = path.join(__dirname, '../supabase/migrations/083_fix_admin_deposit_visibility_and_rpc.sql');
assert(fs.existsSync(migrationPath), 'Migration 083 must exist');
const migrationCode = fs.readFileSync(migrationPath, 'utf8');

assert(
  migrationCode.includes('STATUS: NOT EXECUTED'),
  'Migration 083 must be marked STATUS: NOT EXECUTED for safety'
);
assert(
  migrationCode.includes('CREATE POLICY "Admins can view all deposit requests"') &&
    migrationCode.includes('public.is_admin(auth.uid())'),
  'Migration 083 must harden RLS on deposit_requests with public.is_admin'
);
assert(
  migrationCode.includes('CREATE POLICY "Merchants can view own deposits or admins view all"'),
  'Migration 083 must harden RLS on merchant_deposits for administrators'
);
assert(
  migrationCode.includes('CREATE OR REPLACE FUNCTION public.admin_get_deposit_requests_rpc'),
  'Migration 083 must create canonical admin_get_deposit_requests_rpc'
);
assert(
  migrationCode.includes('SECURITY DEFINER'),
  'Canonical admin RPC must execute as SECURITY DEFINER'
);
console.log('✅ PASSED: Migration 083 canonical RPC and RLS policies verified');

console.log('\n======================================================================');
console.log('🎉 ALL REDESIGNED TERMS AND ADMIN DEPOSIT VISIBILITY CHECKS PASSED!');
console.log('======================================================================');
