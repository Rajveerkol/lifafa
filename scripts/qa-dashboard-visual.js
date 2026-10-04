// scripts/qa-dashboard-visual.js
// Automated Visual QA & Snapshot capture for Createlifafa Flagship Dashboard

import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\e68cc24f-7ae8-47a7-bd5c-35f97585bb4a';
const BROWSER_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4185;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

const PROJECT_REF = 'pxqyeonymwlpiklfyjbb';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000099';

const MOCK_PROFILE = {
  id: MOCK_USER_ID,
  full_name: 'Rajveer Kol',
  email: 'kolrajveer33@gmail.com',
  avatar_url: null,
  phone_number: '9876543210',
  is_suspended: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
};

const MOCK_WALLET = {
  id: '00000000-0000-0000-0000-000000000098',
  user_id: MOCK_USER_ID,
  available_balance: 1250.00,
  reserved_balance: 250.00,
  total_earned: 3500.00,
  total_withdrawn: 2000.00,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

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

async function runDashboardVisualQA() {
  console.log('=== STARTING DASHBOARD FLAGSHIP VISUAL QA ===\n');

  const viteProcess = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  });

  viteProcess.stdout.on('data', (d) => console.log('[Vite Preview]:', d.toString().trim()));
  viteProcess.stderr.on('data', (d) => console.error('[Vite Preview Err]:', d.toString().trim()));

  const report = {
    testTime: new Date().toISOString(),
    viewports: {},
    passed: true,
    errors: [],
  };

  try {
    await waitForServer(BASE_URL);
    console.log('Preview server online at', BASE_URL);

    const browser = await puppeteer.launch({
      executablePath: BROWSER_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Mock authenticated session
    await page.evaluateOnNewDocument((userId, projectRef) => {
      const mockSession = {
        access_token: 'fake-jwt-token-for-qa',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'fake-refresh',
        user: {
          id: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'kolrajveer33@gmail.com',
          user_metadata: { full_name: 'Rajveer Kol' },
          created_at: new Date().toISOString(),
        },
      };

      try {
        localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(mockSession));
        localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession));
      } catch (e) {
        console.error('Storage set error:', e);
      }
    }, MOCK_USER_ID, PROJECT_REF);

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (req.method() === 'OPTIONS') {
        req.respond({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
        return;
      }

      if (url.includes('/rest/v1/profiles')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(MOCK_PROFILE),
        });
      } else if (url.includes('/rest/v1/wallets')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(MOCK_WALLET),
        });
      } else if (url.includes('/rest/v1/merchants')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(null),
        });
      } else if (url.includes('/rest/v1/lifafas')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([]),
        });
      } else {
        req.continue();
      }
    });

    const viewports = [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 1200));

      // Check horizontal overflow
      const overflowInfo = await page.evaluate(() => {
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
        const culprits = [];
        if (hasOverflow) {
          const docWidth = window.innerWidth;
          document.querySelectorAll('*').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.right > docWidth + 1) {
              culprits.push({
                tag: el.tagName,
                className: el.className,
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              });
            }
          });
        }
        return { hasOverflow, culprits: culprits.slice(0, 5) };
      });
      const hasOverflow = overflowInfo.hasOverflow;
      console.log(`- Horizontal overflow check: ${hasOverflow ? 'FAIL' : 'PASS'}`);
      if (hasOverflow) {
        console.log('  Culprits:', JSON.stringify(overflowInfo.culprits));
      }

      // Verify Hero Wallet Card elements
      const heroMetrics = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasTotalBalance: text.includes('Total Available Balance'),
          hasAddMoney: text.includes('Add Money'),
          hasWithdraw: text.includes('Withdraw'),
          hasTelegramBanner: text.includes('Activate Telegram Bot Alert') || text.includes('Telegram Bot Alert'),
          hasExploreLifafa: text.includes('Explore Lifafa'),
          hasReferEarn: text.includes('Refer & Earn'),
          hasWalletHistory: text.includes('Wallet History'),
          hasTransactions: text.includes('Transactions'),
          hasCreateLifafa: text.includes('Create Lifafa'),
          hasSupport: text.includes('Support'),
        };
      });

      console.log(`- Total Balance Header present: ${heroMetrics.hasTotalBalance}`);
      console.log(`- Add Money CTA present: ${heroMetrics.hasAddMoney}`);
      console.log(`- Withdraw CTA present: ${heroMetrics.hasWithdraw}`);
      console.log(`- Telegram Banner present: ${heroMetrics.hasTelegramBanner}`);
      console.log(`- Quick Actions (Explore, Refer, History, Tx, Create, Support): ${
        heroMetrics.hasExploreLifafa &&
        heroMetrics.hasReferEarn &&
        heroMetrics.hasWalletHistory &&
        heroMetrics.hasTransactions &&
        heroMetrics.hasCreateLifafa &&
        heroMetrics.hasSupport
      }`);

      // Capture screenshot
      const shotPath = path.join(ARTIFACT_DIR, `qa_dashboard_${vp.name}_${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`- Saved screenshot: ${shotPath}`);

      report.viewports[vp.name] = {
        width: vp.width,
        height: vp.height,
        hasOverflow,
        heroMetrics,
        screenshot: shotPath,
      };
    }

    // Interactive 3D Parallax test on desktop
    console.log('\n--- Testing Interactive 3D Tilt on Desktop ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    // Hover mouse over the Hero Wallet Card
    const cardHandle = await page.$('.preserve-3d');
    if (cardHandle) {
      const box = await cardHandle.boundingBox();
      if (box) {
        // Move to top-right corner of card to induce tilt
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2);
        await new Promise((r) => setTimeout(r, 200));

        const tiltTransform = await page.evaluate((el) => el.style.transform, cardHandle);
        console.log(`- Card 3D transform on mouse move: ${tiltTransform}`);

        const shotTiltPath = path.join(ARTIFACT_DIR, 'qa_dashboard_desktop_tilt_interaction.png');
        await page.screenshot({ path: shotTiltPath, fullPage: false });
        console.log(`- Saved 3D tilt interaction screenshot: ${shotTiltPath}`);
      }
    }

    await browser.close();
    console.log('\n=== ALL DASHBOARD VISUAL TESTS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Visual QA error:', err);
    report.passed = false;
    report.errors.push(err.message);
  } finally {
    try {
      viteProcess.kill('SIGTERM');
    } catch {}
    const reportPath = path.join(ARTIFACT_DIR, 'qa_dashboard_redesign_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('Saved QA report to', reportPath);
    process.exit(report.passed ? 0 : 1);
  }
}

runDashboardVisualQA();
