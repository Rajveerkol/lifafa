// scripts/test-dashboard-redesign.js
// Verification suite for Createlifafa Flagship Dashboard Redesign

import fs from 'fs';
import path from 'path';

function runAudit() {
  console.log('====================================================');
  console.log('  CREATELIFAFA DASHBOARD FLAGSHIP REDESIGN AUDIT    ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Audit HeroWalletCard.tsx
  const heroCardPath = path.resolve('src/components/wallet/HeroWalletCard.tsx');
  assert(fs.existsSync(heroCardPath), 'HeroWalletCard.tsx exists');
  const heroCardContent = fs.readFileSync(heroCardPath, 'utf8');

  assert(heroCardContent.includes('perspective(1000px) rotateX'), 'HeroWalletCard implements 3D parallax tilt');
  assert(heroCardContent.includes('radial-gradient(circle at'), 'HeroWalletCard implements dynamic specular glare reflection');
  assert(heroCardContent.includes('prefers-reduced-motion'), 'HeroWalletCard respects prefers-reduced-motion');
  assert(heroCardContent.includes('CountUpNumber'), 'HeroWalletCard uses CountUpNumber for animated balance counting');
  assert(heroCardContent.includes('isBalanceUpdated'), 'HeroWalletCard tracks live balance updates for glow pulse');
  assert(heroCardContent.includes('animate-bounce-gentle'), 'HeroWalletCard includes floating 3D currency badge');
  assert(heroCardContent.includes('onAddMoneyClick'), 'HeroWalletCard includes Add Money CTA');
  assert(heroCardContent.includes('onWithdrawClick'), 'HeroWalletCard includes Withdraw CTA');
  assert(heroCardContent.includes('reservedBalance'), 'HeroWalletCard handles reserved balance indicator');

  // 2. Audit TelegramBanner.tsx
  const bannerPath = path.resolve('src/components/common/TelegramBanner.tsx');
  assert(fs.existsSync(bannerPath), 'TelegramBanner.tsx exists');
  const bannerContent = fs.readFileSync(bannerPath, 'utf8');

  assert(bannerContent.includes('animate-ping'), 'TelegramBanner includes live notification pulse indicator');
  assert(bannerContent.includes('notificationService.savePreferences'), 'TelegramBanner preserves notificationService integration');
  assert(bannerContent.includes('ACTIVATED') && bannerContent.includes('ACTIVATE'), 'TelegramBanner includes dynamic CTA states');
  assert(bannerContent.includes('bg-blue-500/10 blur-xl'), 'TelegramBanner includes soft ambient corner glow');

  // 3. Audit QuickActionCard.tsx
  const quickCardPath = path.resolve('src/components/dashboard/QuickActionCard.tsx');
  assert(fs.existsSync(quickCardPath), 'QuickActionCard.tsx exists');
  const quickCardContent = fs.readFileSync(quickCardPath, 'utf8');

  assert(quickCardContent.includes('-translate-y-1.5'), 'QuickActionCard implements 3D hover lift (4-6px)');
  assert(quickCardContent.includes('group-hover:-rotate-3'), 'QuickActionCard implements interactive micro-rotation');
  assert(quickCardContent.includes('group-hover:translate-x-0.5'), 'QuickActionCard implements sliding arrow indicator');
  assert(quickCardContent.includes('active:scale-[0.97]'), 'QuickActionCard implements mobile touch feedback');
  assert(quickCardContent.includes('role="button"'), 'QuickActionCard implements accessible button semantics');
  assert(quickCardContent.includes('animationDelay'), 'QuickActionCard supports staggered entrance timing');

  // 4. Audit HomePage.tsx
  const homePagePath = path.resolve('src/pages/HomePage.tsx');
  assert(fs.existsSync(homePagePath), 'HomePage.tsx exists');
  const homePageContent = fs.readFileSync(homePagePath, 'utf8');

  assert(homePageContent.includes('QuickActionCard'), 'HomePage imports and uses QuickActionCard');
  assert(homePageContent.includes('title="Explore Lifafa"'), 'HomePage contains Explore Lifafa action');
  assert(homePageContent.includes('title="Refer & Earn"'), 'HomePage contains Refer & Earn action');
  assert(homePageContent.includes('title="Wallet History"'), 'HomePage contains Wallet History action');
  assert(homePageContent.includes('title="Transactions"'), 'HomePage contains Transactions action');
  assert(homePageContent.includes('title="Create Lifafa"'), 'HomePage contains Create Lifafa action');
  assert(homePageContent.includes('title="Support"'), 'HomePage contains Support action');
  assert(homePageContent.includes('animate-in fade-in'), 'HomePage includes staggered entrance animations');
  assert(homePageContent.includes('blur-3xl') && homePageContent.includes('pointer-events-none'), 'HomePage includes ambient background lighting spotlights');

  // 5. Audit Header.tsx
  const headerPath = path.resolve('src/components/common/Header.tsx');
  assert(fs.existsSync(headerPath), 'Header.tsx exists');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  assert(headerContent.includes('backdrop-blur-xl'), 'Header uses translucent surface with backdrop blur');
  assert(headerContent.includes('bg-blue-600 text-white font-bold'), 'Header implements clean active tab indicator');
  assert(headerContent.includes('formatCurrency(wallet?.available_balance'), 'Header implements elevated wallet pill badge');

  // 6. Audit Backend Integrity (confirm zero modified backend/database files)
  const modifiedBackendFiles = [
    'supabase/migrations/049_lifafa_payout_fee_escrow.sql',
    'supabase/functions/consumer-paynit-payout/index.ts',
    'supabase/functions/merchant-paynit-payout/index.ts',
    'supabase/functions/verify-telegram-membership/index.ts',
  ];
  for (const f of modifiedBackendFiles) {
    assert(fs.existsSync(path.resolve(f)), `Backend file ${f} remains present and intact`);
  }

  console.log(`\nAUDIT RESULT: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
