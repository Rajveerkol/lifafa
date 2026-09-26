import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\e68cc24f-7ae8-47a7-bd5c-35f97585bb4a';
const BROWSER_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4188;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

const PROJECT_REF = 'pxqyeonymwlpiklfyjbb';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000099';
const MOCK_MERCHANT_ID = 'mch_00000000-0000-0000-0000-000000000001';

const MOCK_PROFILE = {
  id: MOCK_USER_ID,
  email: 'merchant@apexdigital.in',
  full_name: 'Apex Merchant Admin',
  role: 'authenticated',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-26T12:00:00Z',
};

const MOCK_MERCHANT = {
  id: MOCK_MERCHANT_ID,
  user_id: MOCK_USER_ID,
  merchant_code: 'MCH-LIF-9821',
  business_name: 'Apex Digital Pay Technologies',
  mobile_number: '+91 98765 43210',
  status: 'ACTIVE',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-26T12:00:00Z',
};

const MOCK_WALLET = {
  id: 'wlt_00000000-0000-0000-0000-000000000001',
  merchant_id: MOCK_MERCHANT_ID,
  available_balance: 45250.0,
  locked_payout_balance: 1500.0,
  total_deposited: 100000.0,
  total_paid_out: 52400.0,
  total_fees_paid: 850.0,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-26T12:00:00Z',
};

const MOCK_PAYOUTS = [
  {
    id: 'pay_001',
    merchant_id: MOCK_MERCHANT_ID,
    order_id: 'ord_892101',
    amount: 500.0,
    fee_amount: 3.8,
    total_deducted: 503.8,
    status: 'SUCCESS',
    account_holder_name: 'Sunita Sharma',
    bank_account_number_masked: '••••••••4821',
    ifsc_code: 'HDFC0001234',
    provider_reference_id: '423589123456',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: 'pay_002',
    merchant_id: MOCK_MERCHANT_ID,
    order_id: 'ord_892102',
    amount: 100.0,
    fee_amount: 3.7,
    total_deducted: 103.7,
    status: 'SUCCESS',
    account_holder_name: 'Rajesh Patel',
    bank_account_number_masked: '••••••••9102',
    ifsc_code: 'SBIN0004567',
    provider_reference_id: '423589123457',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    completed_at: new Date(Date.now() - 7100000).toISOString(),
  },
  {
    id: 'pay_003',
    merchant_id: MOCK_MERCHANT_ID,
    order_id: 'ord_892103',
    amount: 750.0,
    fee_amount: 3.8,
    total_deducted: 753.8,
    status: 'PROCESSING',
    account_holder_name: 'Amit Verma',
    bank_account_number_masked: '••••••••3319',
    ifsc_code: 'ICIC0000002',
    provider_reference_id: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'pay_004',
    merchant_id: MOCK_MERCHANT_ID,
    order_id: 'ord_892104',
    amount: 250.0,
    fee_amount: 3.8,
    total_deducted: 253.8,
    status: 'SUCCESS',
    account_holder_name: 'Pooja Gupta',
    bank_account_number_masked: '••••••••1105',
    ifsc_code: 'PUNB0024500',
    provider_reference_id: '423589123458',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'pay_005',
    merchant_id: MOCK_MERCHANT_ID,
    order_id: 'ord_892105',
    amount: 300.0,
    fee_amount: 3.8,
    total_deducted: 303.8,
    status: 'FAILED',
    account_holder_name: 'Vikas Mehra',
    bank_account_number_masked: '••••••••7741',
    ifsc_code: 'KKBK0000123',
    provider_reference_id: null,
    rejection_reason: 'Beneficiary account closed or invalid IFSC',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

const MOCK_DEPOSITS = [
  {
    id: 'dep_001',
    merchant_id: MOCK_MERCHANT_ID,
    gross_amount: 50000.0,
    deposit_fee: 1000.0,
    net_credited: 49000.0,
    utr_number: '423500112233',
    status: 'APPROVED',
    created_at: new Date(Date.now() - 604800000).toISOString(),
    reviewed_at: new Date(Date.now() - 604200000).toISOString(),
    admin_notes: 'Verified against bank credits batch #89',
  },
  {
    id: 'dep_002',
    merchant_id: MOCK_MERCHANT_ID,
    gross_amount: 50000.0,
    deposit_fee: 1000.0,
    net_credited: 49000.0,
    utr_number: '423500445566',
    status: 'APPROVED',
    created_at: new Date(Date.now() - 259200000).toISOString(),
    reviewed_at: new Date(Date.now() - 258600000).toISOString(),
    admin_notes: 'Verified via HDFC corporate gateway',
  },
  {
    id: 'dep_003',
    merchant_id: MOCK_MERCHANT_ID,
    gross_amount: 10000.0,
    deposit_fee: 200.0,
    net_credited: 9800.0,
    utr_number: '423599887766',
    status: 'PENDING',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    reviewed_at: null,
    admin_notes: null,
  },
];

const MOCK_LEDGER = [
  {
    id: 'led_001',
    merchant_id: MOCK_MERCHANT_ID,
    wallet_id: 'wlt_00000000-0000-0000-0000-000000000001',
    amount: 49000.0,
    fee_amount: 1000.0,
    entry_type: 'DEPOSIT_CREDIT',
    reference_type: 'DEPOSIT',
    reference_id: 'dep_001',
    idempotency_key: 'dep_idem_423500112233',
    balance_before: 0.0,
    balance_after: 49000.0,
    metadata: {},
    created_at: new Date(Date.now() - 604200000).toISOString(),
  },
  {
    id: 'led_002',
    merchant_id: MOCK_MERCHANT_ID,
    wallet_id: 'wlt_00000000-0000-0000-0000-000000000001',
    amount: -503.8,
    fee_amount: 3.8,
    entry_type: 'PAYOUT_CONFIRM',
    reference_type: 'PAYOUT',
    reference_id: 'pay_001',
    idempotency_key: 'pay_idem_ord_892101',
    balance_before: 49000.0,
    balance_after: 48496.2,
    metadata: {},
    created_at: new Date(Date.now() - 3500000).toISOString(),
  },
];

const MOCK_API_KEYS = [
  {
    id: 'key_001',
    merchant_id: MOCK_MERCHANT_ID,
    key_name: 'Production ERP Node',
    client_id: 'live_client_apex_9821_a7b2',
    is_active: true,
    created_at: new Date(Date.now() - 864000000).toISOString(),
    last_used_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

const MOCK_WHITELIST = [
  {
    id: 'ip_001',
    merchant_id: MOCK_MERCHANT_ID,
    ip_address: '13.235.12.98',
    description: 'AWS Mumbai API Gateway',
    created_at: new Date(Date.now() - 864000000).toISOString(),
  },
  {
    id: 'ip_002',
    merchant_id: MOCK_MERCHANT_ID,
    ip_address: '35.154.89.201',
    description: 'Worker Node Pool',
    created_at: new Date(Date.now() - 500000000).toISOString(),
  },
];

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, () => {
        resolve(true);
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`));
        } else {
          setTimeout(check, 300);
        }
      });
    };
    check();
  });
}

async function runMerchantQA() {
  console.log('=== STARTING MERCHANT GATEWAY VISUAL & FUNCTIONAL QA ===');

  const viteProcess = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  });

  viteProcess.stdout.on('data', (d) => console.log('[Vite Preview]:', d.toString().trim()));
  viteProcess.stderr.on('data', (d) => console.error('[Vite Preview Err]:', d.toString().trim()));

  const report = {
    testTime: new Date().toISOString(),
    viewports: ['1440x900 (Desktop)', '768x1024 (Tablet)', '390x844 (Mobile)'],
    sectionsTested: [],
    screenshots: [],
    overflowCheck: {},
    consoleErrors: [],
    passedAllChecks: true,
  };

  try {
    await waitForServer(BASE_URL);
    console.log('Vite preview is live at', BASE_URL);

    const browser = await puppeteer.launch({
      executablePath: BROWSER_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('Failed to load resource') &&
          !text.includes('net::ERR_') &&
          !text.includes('CORS') &&
          !text.includes('Access to fetch')
        ) {
          report.consoleErrors.push(text);
          console.warn('[Browser Console Error]:', text);
        }
      }
    });

    // Mock authenticated Supabase session
    await page.evaluateOnNewDocument((userId, projectRef) => {
      const mockSession = {
        access_token: 'qa-mock-jwt-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'qa-mock-refresh',
        user: {
          id: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'merchant@apexdigital.in',
          user_metadata: { full_name: 'Apex Merchant Admin' },
          created_at: new Date().toISOString(),
        },
      };

      try {
        localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(mockSession));
        localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession));
      } catch (err) {
        console.error('LocalStorage write error:', err);
      }
    }, MOCK_USER_ID, PROJECT_REF);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Content-Type': 'application/json',
    };

    // Enable request interception to mock Supabase REST responses with CORS headers
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const method = req.method();

      if (method === 'OPTIONS') {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: '',
        });
      }

      if (url.includes('/auth/v1/user')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            id: MOCK_USER_ID,
            email: 'merchant@apexdigital.in',
            user_metadata: { full_name: 'Apex Merchant Admin' },
          }),
        });
      }

      if (url.includes('/rest/v1/profiles')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_PROFILE),
        });
      }

      if (url.includes('/rest/v1/wallets')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify({ id: 'w1', user_id: MOCK_USER_ID, balance: 100 }),
        });
      }

      if (url.includes('/rest/v1/merchants')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_MERCHANT),
        });
      }

      if (url.includes('/rest/v1/merchant_wallets')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_WALLET),
        });
      }

      if (url.includes('/rest/v1/merchant_payouts')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_PAYOUTS),
        });
      }

      if (url.includes('/rest/v1/merchant_deposits')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_DEPOSITS),
        });
      }

      if (url.includes('/rest/v1/merchant_ledger')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_LEDGER),
        });
      }

      if (url.includes('merchant_list_api_keys_rpc') || url.includes('/rest/v1/merchant_api_keys')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_API_KEYS),
        });
      }

      if (url.includes('/rest/v1/merchant_ip_whitelist')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify(MOCK_WHITELIST),
        });
      }

      if (url.includes('/rest/v1/admin_users') || url.includes('/rest/v1/notifications')) {
        return req.respond({
          status: 200,
          headers: corsHeaders,
          body: JSON.stringify([]),
        });
      }

      req.continue();
    });

    // ========================================================
    // TEST 1: DESKTOP (1440x900) - Full Fintech Walkthrough
    // ========================================================
    console.log('\n--- 1. Testing Desktop 1440x900 ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/merchant`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    // Verify Horizontal Overflow on Desktop
    const desktopOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    report.overflowCheck['desktop_1440x900'] = desktopOverflow ? 'PASSED (No Overflow)' : 'FAILED (Overflow detected)';
    console.log('Desktop 1440x900 overflow status:', report.overflowCheck['desktop_1440x900']);

    // Capture View 1: Dashboard
    const pDashboard = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_dashboard_1440x900.png');
    await page.screenshot({ path: pDashboard, fullPage: false });
    report.screenshots.push({ name: 'Desktop Dashboard', file: 'qa_merchant_desktop_dashboard_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_dashboard_1440x900.png');

    // Test Navigation: Click "Add Money"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Add Money'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const pAddMoney = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_addmoney_1440x900.png');
    await page.screenshot({ path: pAddMoney, fullPage: false });
    report.screenshots.push({ name: 'Desktop Add Money', file: 'qa_merchant_desktop_addmoney_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_addmoney_1440x900.png');

    // Test Navigation: Click "Make Payout"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Make Payout'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const pMakePayout = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_makepayout_1440x900.png');
    await page.screenshot({ path: pMakePayout, fullPage: false });
    report.screenshots.push({ name: 'Desktop Make Payout', file: 'qa_merchant_desktop_makepayout_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_makepayout_1440x900.png');

    // Test Navigation: Click "Payout History"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Payout History'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const pPayoutHistory = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_payouts_1440x900.png');
    await page.screenshot({ path: pPayoutHistory, fullPage: false });
    report.screenshots.push({ name: 'Desktop Payout History', file: 'qa_merchant_desktop_payouts_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_payouts_1440x900.png');

    // Open Payout Detail slide-over drawer
    await page.evaluate(() => {
      const viewBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'View');
      if (viewBtn) viewBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const pPayoutDrawer = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_payout_drawer_1440x900.png');
    await page.screenshot({ path: pPayoutDrawer, fullPage: false });
    report.screenshots.push({ name: 'Desktop Payout Detail Drawer', file: 'qa_merchant_desktop_payout_drawer_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_payout_drawer_1440x900.png');

    // Close detail drawer
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Close Details'));
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Test Navigation: Click "Wallet"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Wallet');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const pWallet = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_wallet_1440x900.png');
    await page.screenshot({ path: pWallet, fullPage: false });
    report.screenshots.push({ name: 'Desktop Wallet & Ledger', file: 'qa_merchant_desktop_wallet_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_wallet_1440x900.png');

    // Test Navigation: Click "Deposit History"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Deposit History'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const pDeposits = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_deposits_1440x900.png');
    await page.screenshot({ path: pDeposits, fullPage: false });
    report.screenshots.push({ name: 'Desktop Deposit History', file: 'qa_merchant_desktop_deposits_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_deposits_1440x900.png');

    // Test Navigation: Click "Reports"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Reports');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const pReports = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_reports_1440x900.png');
    await page.screenshot({ path: pReports, fullPage: false });
    report.screenshots.push({ name: 'Desktop Reports', file: 'qa_merchant_desktop_reports_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_reports_1440x900.png');

    // Test Navigation: Click "API Settings"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('API Settings'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const pApiSettings = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_apisettings_1440x900.png');
    await page.screenshot({ path: pApiSettings, fullPage: false });
    report.screenshots.push({ name: 'Desktop API Settings', file: 'qa_merchant_desktop_apisettings_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_apisettings_1440x900.png');

    // Test Navigation: Click "API Documentation"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('API Documentation'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const pApiDocs = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_apidocs_1440x900.png');
    await page.screenshot({ path: pApiDocs, fullPage: false });
    report.screenshots.push({ name: 'Desktop API Documentation', file: 'qa_merchant_desktop_apidocs_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_apidocs_1440x900.png');

    // Test Navigation: Click "Profile & Settings"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Profile & Settings'));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const pProfile = path.join(ARTIFACT_DIR, 'qa_merchant_desktop_profile_1440x900.png');
    await page.screenshot({ path: pProfile, fullPage: false });
    report.screenshots.push({ name: 'Desktop Profile', file: 'qa_merchant_desktop_profile_1440x900.png' });
    console.log('Captured: qa_merchant_desktop_profile_1440x900.png');

    // ========================================================
    // TEST 2: TABLET (768x1024)
    // ========================================================
    console.log('\n--- 2. Testing Tablet 768x1024 ---');
    await page.setViewport({ width: 768, height: 1024 });
    // Go to dashboard
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Dashboard');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const tabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    report.overflowCheck['tablet_768x1024'] = tabletOverflow ? 'PASSED (No Overflow)' : 'FAILED (Overflow detected)';
    console.log('Tablet 768x1024 overflow status:', report.overflowCheck['tablet_768x1024']);

    const pTabletDashboard = path.join(ARTIFACT_DIR, 'qa_merchant_tablet_dashboard_768x1024.png');
    await page.screenshot({ path: pTabletDashboard, fullPage: false });
    report.screenshots.push({ name: 'Tablet Dashboard', file: 'qa_merchant_tablet_dashboard_768x1024.png' });
    console.log('Captured: qa_merchant_tablet_dashboard_768x1024.png');

    // ========================================================
    // TEST 3: MOBILE (390x844) - Mobile Responsiveness & Drawer
    // ========================================================
    console.log('\n--- 3. Testing Mobile 390x844 ---');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 800));

    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    report.overflowCheck['mobile_390x844'] = mobileOverflow ? 'PASSED (No Overflow)' : 'FAILED (Overflow detected)';
    console.log('Mobile 390x844 overflow status:', report.overflowCheck['mobile_390x844']);

    // Capture Mobile Dashboard
    const pMobileDashboard = path.join(ARTIFACT_DIR, 'qa_merchant_mobile_dashboard_390x844.png');
    await page.screenshot({ path: pMobileDashboard, fullPage: false });
    report.screenshots.push({ name: 'Mobile Dashboard', file: 'qa_merchant_mobile_dashboard_390x844.png' });
    console.log('Captured: qa_merchant_mobile_dashboard_390x844.png');

    // Open Mobile Drawer via hamburger menu
    await page.evaluate(() => {
      const hamburger = document.querySelector('header button[title="Open Navigation Menu"]');
      if (hamburger) hamburger.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const pMobileDrawer = path.join(ARTIFACT_DIR, 'qa_merchant_mobile_drawer_390x844.png');
    await page.screenshot({ path: pMobileDrawer, fullPage: false });
    report.screenshots.push({ name: 'Mobile Navigation Drawer', file: 'qa_merchant_mobile_drawer_390x844.png' });
    console.log('Captured: qa_merchant_mobile_drawer_390x844.png');

    // Click "Make Payout" from mobile drawer
    await page.evaluate(() => {
      const drawer = document.querySelector('.fixed.inset-0.z-50');
      if (drawer) {
        const btn = Array.from(drawer.querySelectorAll('button')).find((b) => b.textContent?.includes('Make Payout'));
        if (btn) btn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    const pMobileMakePayout = path.join(ARTIFACT_DIR, 'qa_merchant_mobile_makepayout_390x844.png');
    await page.screenshot({ path: pMobileMakePayout, fullPage: false });
    report.screenshots.push({ name: 'Mobile Make Payout Form', file: 'qa_merchant_mobile_makepayout_390x844.png' });
    console.log('Captured: qa_merchant_mobile_makepayout_390x844.png');

    // ========================================================
    // TEST 4: UNAUTHENTICATED LANDING (1440x900)
    // ========================================================
    console.log('\n--- 4. Testing Unauthenticated Portal Landing ---');
    const anonContext = await browser.createBrowserContext();
    const anonPage = await anonContext.newPage();
    await anonPage.setViewport({ width: 1440, height: 900 });
    await anonPage.goto(`${BASE_URL}/merchant`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 800));

    const pLanding = path.join(ARTIFACT_DIR, 'qa_merchant_landing_1440x900.png');
    await anonPage.screenshot({ path: pLanding, fullPage: false });
    report.screenshots.push({ name: 'Unauthenticated Merchant Gateway Landing', file: 'qa_merchant_landing_1440x900.png' });
    console.log('Captured: qa_merchant_landing_1440x900.png');

    await anonContext.close();
    await browser.close();

    // Check pass criteria
    const allOverflowPassed = Object.values(report.overflowCheck).every((v) => v.includes('PASSED'));
    report.passedAllChecks = allOverflowPassed && report.consoleErrors.length === 0;

    // Save report
    const reportPath = path.join(ARTIFACT_DIR, 'qa_merchant_redesign_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log('\n=== QA COMPLETE: ALL AUDIT CHECKS FINISHED ===');
    console.log('Report saved to:', reportPath);
    console.log('Status: Passed all checks =', report.passedAllChecks);
  } catch (err) {
    console.error('QA Test execution failed:', err);
    report.passedAllChecks = false;
    report.error = err.message;
  } finally {
    viteProcess.kill();
    process.exit(report.passedAllChecks ? 0 : 1);
  }
}

runMerchantQA();
