import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\e68cc24f-7ae8-47a7-bd5c-35f97585bb4a';
const BROWSER_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4178;
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

const PROJECT_REF = 'pxqyeonymwlpiklfyjbb';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000099';

const THEMES = [
  { id: 'rewards', name: 'Digital Reward', expectedArtwork: 'rewards_gift.jpg' },
  { id: 'birthday', name: 'Birthday Bash', expectedArtwork: 'birthday_gift.jpg' },
  { id: 'new_year', name: 'New Year Gala', expectedArtwork: 'newyear_gift.jpg' },
  { id: 'diwali', name: 'Diwali Dhamaka', expectedArtwork: 'diwali_gift.jpg' },
  { id: 'holi', name: 'Holi Fiesta', expectedArtwork: 'holi_gift.jpg' },
  { id: 'ganesh_chaturthi', name: 'Ganesh Utsav', expectedArtwork: 'ganesh_gift.jpg' },
  { id: 'durga_navami', name: 'Durga Navami', expectedArtwork: 'navami_gift.jpg' },
];

const MOCK_LIFAFA = {
  id: '00000000-0000-0000-0000-000000000001',
  code: 'VINOD91',
  title: 'Digital Vinod 91',
  message: 'Kuch khas logon ke liye ek chota sa gift ❤️',
  creator_id: '00000000-0000-0000-0000-000000000002',
  total_amount: 50.0,
  remaining_amount: 32.0,
  winner_count: 50,
  claimed_count: 18,
  distribution_type: 'EQUAL',
  payout_mode: 'WALLET',
  status: 'ACTIVE',
  expires_at: '9999-12-31T23:59:59.999Z',
  created_at: new Date().toISOString(),
  theme_id: 'rewards',
};

const MOCK_TASKS = [
  {
    id: 'task-1',
    lifafa_id: '00000000-0000-0000-0000-000000000001',
    task_type: 'TELEGRAM_JOIN',
    title: 'Digital Vinod 91',
    description: 'Join our main Telegram channel for latest updates',
    target_url: 'https://t.me/digitalvinod91',
    telegram_channel_username: 'digitalvinod91',
    is_required: true,
    is_enabled: true,
    sort_order: 1,
  },
  {
    id: 'task-2',
    lifafa_id: '00000000-0000-0000-0000-000000000001',
    task_type: 'TELEGRAM_JOIN',
    title: 'Tech Updates',
    description: 'Best earning tricks & offers',
    target_url: 'https://t.me/techupdates',
    telegram_channel_username: 'techupdates',
    is_required: true,
    is_enabled: true,
    sort_order: 2,
  },
  {
    id: 'task-3',
    lifafa_id: '00000000-0000-0000-0000-000000000001',
    task_type: 'YOUTUBE_SUB',
    title: 'Digital Vinod 91',
    description: 'Subscribe on YouTube for more rewards',
    target_url: 'https://youtube.com/@digitalvinod91',
    is_required: true,
    is_enabled: true,
    sort_order: 3,
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

async function runAllThemesQA() {
  console.log('=== STARTING ALL-THEMES VISUAL & FUNCTIONAL QA ===');

  const viteProcess = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    shell: true,
    stdio: 'pipe',
  });

  viteProcess.stdout.on('data', (d) => console.log('[Vite Preview]:', d.toString().trim()));
  viteProcess.stderr.on('data', (d) => console.error('[Vite Preview Err]:', d.toString().trim()));

  const report = {
    testTime: new Date().toISOString(),
    viewports: ['390x844 (Mobile)', '1440x900 (Desktop)'],
    themesTested: [],
    overallSuccess: true,
    consoleErrors: [],
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

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') && !text.includes('net::ERR_')) {
          report.consoleErrors.push(text);
          console.warn('[Browser Console Error]:', text);
        }
      }
    });

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
          email: 'qauser@createlifafa.in',
          user_metadata: { full_name: 'Vinod QA User' },
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

      if (url.includes('/rest/v1/profiles') && req.method() === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([
            { id: MOCK_USER_ID, full_name: 'Vinod QA User', email: 'qauser@createlifafa.in', avatar_url: null },
          ]),
        });
        return;
      }

      if (url.includes('/rest/v1/wallets') && req.method() === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([{ id: 'wallet-001', user_id: MOCK_USER_ID, available_balance: 50.0, reserved_balance: 0.0 }]),
        });
        return;
      }

      if (url.includes('/rest/v1/lifafas') && req.method() === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([MOCK_LIFAFA]),
        });
        return;
      }

      if (url.includes('/rest/v1/lifafa_tasks') && req.method() === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(MOCK_TASKS),
        });
        return;
      }

      if (url.includes('/rest/v1/lifafa_claims') && req.method() === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([]),
        });
        return;
      }

      if (url.includes('/rest/v1/task_completions') && req.method() === 'GET') {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([
            {
              id: 'completion-1',
              task_id: 'task-1',
              lifafa_id: '00000000-0000-0000-0000-000000000001',
              status: 'VERIFIED',
              user_id: MOCK_USER_ID,
            },
          ]),
        });
        return;
      }

      req.continue();
    });

    for (const theme of THEMES) {
      console.log(`\n========================================`);
      console.log(`Testing Theme: ${theme.name} (${theme.id})`);
      console.log(`========================================`);

      const themeResult = {
        themeId: theme.id,
        themeName: theme.name,
        expectedArtwork: theme.expectedArtwork,
        mobile: null,
        desktop: null,
      };

      for (const vp of [
        { name: 'mobile', width: 390, height: 844 },
        { name: 'desktop', width: 1440, height: 900 },
      ]) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}/claim/VINOD91?t=${theme.id}`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 1200));

        // 1. Verify 3D gift image
        const artworkStatus = await page.evaluate((expectedFilename) => {
          const imgs = Array.from(document.querySelectorAll('img'));
          const themeImg = imgs.find((i) => i.src.includes(expectedFilename));
          if (!themeImg) {
            return {
              found: false,
              allSrcs: imgs.map((i) => i.src),
            };
          }
          return {
            found: true,
            naturalWidth: themeImg.naturalWidth,
            naturalHeight: themeImg.naturalHeight,
            visible: themeImg.offsetWidth > 0 && themeImg.offsetHeight > 0,
            src: themeImg.src,
          };
        }, theme.expectedArtwork);

        // 2. Check for horizontal overflow
        const hasHorizontalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        // 3. Vault terminology audit
        const vaultForbiddenWords = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          const matches = [];
          for (const word of ['vault deposit', 'security vault', 'unlock security vault', 'atomic digital reward safe', 'vault disbursed']) {
            if (bodyText.includes(word)) matches.push(word);
          }
          return matches;
        });

        // 4. UI Elements Check
        const elementsCheck = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          return {
            hasTitle: bodyText.includes('Digital Vinod 91'),
            hasJoinAndClaimHeader: bodyText.includes('Join &') && bodyText.includes('Claim'),
            hasTotalUsers: bodyText.includes('Total Users'),
            hasPerUser: bodyText.includes('Per User'),
            hasClaimed: bodyText.includes('Claimed'),
            hasRemaining: bodyText.includes('Remaining'),
            hasRequiredChannels: bodyText.includes('Join Required Channels'),
            hasJoinedStatus: bodyText.includes('Joined'),
            hasJoinNowButtons: bodyText.includes('Join Now'),
            hasMainCTA: bodyText.includes('Verify & Claim Lifafa') || bodyText.includes('Complete Required Tasks'),
            hasSafetyBadge: bodyText.includes('100% safe'),
          };
        });

        // 5. Screenshot
        const screenshotFilename = `qa_theme_${theme.id}_${vp.name}_${vp.width}x${vp.height}.png`;
        const screenshotPath = path.join(ARTIFACT_DIR, screenshotFilename);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        const vpResult = {
          screenshotFilename,
          artworkStatus,
          hasHorizontalOverflow,
          vaultForbiddenWords,
          elementsCheck,
        };

        themeResult[vp.name] = vpResult;

        console.log(`[${theme.id} - ${vp.name}] Artwork loaded:`, artworkStatus.found && artworkStatus.naturalWidth > 0);
        console.log(`[${theme.id} - ${vp.name}] No overflow:`, !hasHorizontalOverflow);
        console.log(`[${theme.id} - ${vp.name}] Zero vault terms:`, vaultForbiddenWords.length === 0);
        console.log(`[${theme.id} - ${vp.name}] Screenshot: ${screenshotFilename}`);

        if (!artworkStatus.found || artworkStatus.naturalWidth === 0 || hasHorizontalOverflow || vaultForbiddenWords.length > 0) {
          report.overallSuccess = false;
        }
      }

      report.themesTested.push(themeResult);
    }

    await browser.close();

    const reportPath = path.join(ARTIFACT_DIR, 'qa_all_themes_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('\n========================================');
    console.log('ALL-THEMES QA COMPLETED!');
    console.log('Overall Success:', report.overallSuccess);
    console.log('Report saved to:', reportPath);
    console.log('========================================');
  } catch (err) {
    console.error('All-Themes QA Error:', err);
    report.overallSuccess = false;
  } finally {
    viteProcess.kill();
  }
}

runAllThemesQA();
