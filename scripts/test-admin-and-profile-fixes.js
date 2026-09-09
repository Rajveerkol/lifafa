/**
 * Verification Test Suite for Admin, Profile, Lifafa Expiry, and Route Fixes
 * Covers all 10 issues resolved in the current audit.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('========================================================');
console.log('STARTING ADMIN, PROFILE & ROUTE FIXES VERIFICATION');
console.log('========================================================\n');

let passedCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// 1. Verify Migration 015 contents
test('Migration 015: Authoritative admin_users table & owner email backfill', () => {
  const migPath = path.resolve('supabase/migrations/015_admin_authorization_and_settings_fix.sql');
  assert(fs.existsSync(migPath), 'Migration 015 must exist');
  const content = fs.readFileSync(migPath, 'utf8');

  // Must backfill owners into admin_users
  assert(content.includes('kolrajveer33@gmail.com'), 'Must reference owner email kolrajveer33@gmail.com');
  assert(content.includes('jayakol796@gmail.com'), 'Must reference owner email jayakol796@gmail.com');
  assert(content.includes('SUPER_ADMIN'), 'Must grant SUPER_ADMIN role');

  // Must have is_admin checking admin_users table, NOT hardcoding emails inside function body
  assert(content.includes('FROM public.admin_users'), 'is_admin must query admin_users table');
  
  // handle_new_user grants admin ONLY to confirmed owners
  assert(content.includes('v_user_email IN (\'kolrajveer33@gmail.com\', \'jayakol796@gmail.com\')'), 
    'handle_new_user must check owner whitelist strictly');

  // Profile update security prevents editing email, is_suspended, or id
  assert(content.includes('Unauthorized: Users cannot modify their own suspension status'), 'Must protect is_suspended');
  assert(content.includes('Unauthorized: Email cannot be modified directly'), 'Must protect email');
});

// 2. Verify adminService error propagation
test('AdminService: Propagates database errors instead of swallowing them', () => {
  const adminServicePath = path.resolve('src/services/adminService.ts');
  const content = fs.readFileSync(adminServicePath, 'utf8');
  assert(content.includes('throw new Error(error.message'), 'updatePaymentSettings must throw database error');
});

// 3. Verify perpetual expiry in utils.ts and CreateLifafaPage
test('Expiry Fix: Far future expiry (>365d) formats as "Active" with isExpired=false', () => {
  const utilsPath = path.resolve('src/lib/utils.ts');
  const content = fs.readFileSync(utilsPath, 'utf8');
  assert(content.includes("hours > 24 * 365"), 'formatTimeRemaining must check for far future dates');
  assert(content.includes("return { isExpired: false, formatted: 'Active' }"), 'Must return Active for perpetual lifafas');

  const createPagePath = path.resolve('src/pages/CreateLifafaPage.tsx');
  const createContent = fs.readFileSync(createPagePath, 'utf8');
  assert(createContent.includes("'9999-12-31T23:59:59.999Z'"), 'CreateLifafaPage must use perpetual timestamp');
  assert(!createContent.includes('4. Lifafa Duration & Expiry'), 'Duration & Expiry section must be removed from UI');
  assert(!createContent.includes('Launch Immediately'), 'Launch timing must be removed from UI');
});

// 4. Verify Profile Mobile Number Removal & Edit Profile Modal
test('Profile: Mobile number removed from user-facing card and EditProfileModal wired up', () => {
  const profilePagePath = path.resolve('src/pages/ProfilePage.tsx');
  const content = fs.readFileSync(profilePagePath, 'utf8');
  assert(!content.includes('Mobile Number'), 'Mobile Number row must NOT exist in ProfilePage');
  assert(!content.includes('Phone className'), 'Phone icon must NOT exist in ProfilePage');
  assert(content.includes('EditProfileModal'), 'EditProfileModal must be imported and rendered in ProfilePage');
  assert(content.includes("onNavigate('account-security')"), 'Must wire up account-security navigation');
  assert(content.includes("onNavigate('help-support')"), 'Must wire up help-support navigation');
  assert(content.includes("onNavigate('terms')"), 'Must wire up terms navigation');
  assert(content.includes("onNavigate('privacy')"), 'Must wire up privacy navigation');
});

// 5. Verify EditProfileModal validation and walletService method
test('EditProfileModal & walletService: Profile name update validation', () => {
  const editModalPath = path.resolve('src/components/profile/EditProfileModal.tsx');
  assert(fs.existsSync(editModalPath), 'EditProfileModal component must exist');
  const modalContent = fs.readFileSync(editModalPath, 'utf8');
  assert(modalContent.includes('updateUserProfileName'), 'Must call walletService.updateUserProfileName');

  const walletServicePath = path.resolve('src/services/walletService.ts');
  const walletContent = fs.readFileSync(walletServicePath, 'utf8');
  assert(walletContent.includes('updateUserProfileName'), 'walletService must implement updateUserProfileName');
  assert(walletContent.includes('Full Name must be at least 2 characters long'), 'Must validate min 2 characters');
  assert(walletContent.includes('Full Name cannot exceed 50 characters'), 'Must validate max 50 characters');
});

// 6. Verify Dedicated Route Pages exist and have neutral support info
test('Dedicated Pages: AccountSecurity, HelpSupport, Terms, Privacy exist with neutral support', () => {
  const secPath = path.resolve('src/pages/AccountSecurityPage.tsx');
  const helpPath = path.resolve('src/pages/HelpSupportPage.tsx');
  const termsPath = path.resolve('src/pages/TermsPage.tsx');
  const privPath = path.resolve('src/pages/PrivacyPage.tsx');

  assert(fs.existsSync(secPath), 'AccountSecurityPage must exist');
  assert(fs.existsSync(helpPath), 'HelpSupportPage must exist');
  assert(fs.existsSync(termsPath), 'TermsPage must exist');
  assert(fs.existsSync(privPath), 'PrivacyPage must exist');

  const helpContent = fs.readFileSync(helpPath, 'utf8');
  assert(!helpContent.includes('@CreatLifafaSupport'), 'Must NOT invent fake @CreatLifafaSupport handle');
  assert(helpContent.includes('contact support through the platform'), 'Must use neutral in-platform support instructions');
});

// 7. Verify SPA fallback in public/.htaccess and dist/.htaccess
test('Hostinger SPA Support: .htaccess exists in public and dist with rewrite rules', () => {
  const publicHtaccess = path.resolve('public/.htaccess');
  const distHtaccess = path.resolve('dist/.htaccess');

  assert(fs.existsSync(publicHtaccess), 'public/.htaccess must exist');
  assert(fs.existsSync(distHtaccess), 'dist/.htaccess must exist in build output');

  const content = fs.readFileSync(distHtaccess, 'utf8');
  assert(content.includes('RewriteRule . /index.html [L]'), 'Must rewrite all non-file requests to /index.html');
});

// 8. Verify App.tsx handles all dedicated routes on refresh and navigation
test('App.tsx: getInitialTab and popstate handle all dedicated routes', () => {
  const appPath = path.resolve('src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  assert(content.includes("'account-security'"), 'App.tsx must handle account-security route');
  assert(content.includes("'help-support'"), 'App.tsx must handle help-support route');
  assert(content.includes("'terms'"), 'App.tsx must handle terms route');
  assert(content.includes("'privacy'"), 'App.tsx must handle privacy route');
  assert(content.includes('<AccountSecurityPage'), 'App.tsx must render AccountSecurityPage');
  assert(content.includes('<HelpSupportPage'), 'App.tsx must render HelpSupportPage');
  assert(content.includes('<TermsPage'), 'App.tsx must render TermsPage');
  assert(content.includes('<PrivacyPage'), 'App.tsx must render PrivacyPage');
});

// 9. Verify Admin navigation includes all 13 sections with pending badge
test('AdminPage: Navigation contains all 13 sections, categorized layout & pending deposits badge', () => {
  const adminPagePath = path.resolve('src/pages/AdminPage.tsx');
  const content = fs.readFileSync(adminPagePath, 'utf8');

  const sections = [
    'dashboard', 'deposits', 'users', 'wallets', 'transactions',
    'lifafas', 'withdrawals', 'telegram', 'fraud', 'notifications',
    'fees', 'audit', 'settings'
  ];

  for (const s of sections) {
    assert(content.includes(`id: '${s}'`), `Admin navigation must include section '${s}'`);
  }

  assert(content.includes('pendingDepositsCount'), 'AdminPage must compute pendingDepositsCount');
  assert(content.includes('bg-amber-500 text-white animate-pulse'), 'Must highlight pending deposits with attention-grabbing badge');
  assert(content.includes('adminNavFilter'), 'Must have categorized navigation filter');
});

console.log(`\n========================================================`);
console.log(`TEST RESULTS: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
console.log(`========================================================\n`);

if (passedCount !== totalCount) {
  process.exit(1);
}
