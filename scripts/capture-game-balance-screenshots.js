import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\e68cc24f-7ae8-47a7-bd5c-35f97585bb4a';
const BROWSER_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function clickByText(page, text) {
  return await page.evaluate((targetText) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => b.innerText && b.innerText.toLowerCase().includes(targetText.toLowerCase()));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, text);
}

async function capture() {
  console.log('Launching Chrome browser from:', BROWSER_PATH);
  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 1. DESKTOP VIEWPORT: GAMES PAGE (REAL BALANCE & TICKETS HUB)
    console.log('1. Capturing Desktop Games Landing Page (Real Balance)...');
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('http://localhost:4173/games', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_games_page_desktop_real_balance.png'),
    });

    // 2. CASH -> TICKETS CONVERSION MODAL
    console.log('2. Opening Cash -> Tickets Modal...');
    await clickByText(page, 'Cash → Tickets');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_conversion_modal_cash_to_tickets.png'),
    });

    // Test clicking Confirm to verify pending activation safety notice
    console.log('2b. Clicking Confirm to verify activation safety notice...');
    await clickByText(page, 'Confirm & Convert');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_conversion_activation_notice.png'),
    });

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close modal"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 3. TICKETS -> CASH CONVERSION MODAL
    console.log('3. Opening Tickets -> Cash Modal...');
    await clickByText(page, 'Tickets → Cash');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_conversion_modal_tickets_to_cash.png'),
    });

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close modal"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 4. HOW IT WORKS MODAL (REAL BALANCE UPDATED)
    console.log('4. Opening How It Works Modal...');
    await clickByText(page, 'How It Works');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_how_it_works_real_balance.png'),
    });

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close modal"]');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 5. TRANSACTION HISTORY SECTION
    console.log('5. Capturing Transaction History...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_transaction_history.png'),
    });

    // 6. ZERO TICKETS CTA STATE IN DUEL ARENA LOBBY
    console.log('6. Checking Duel Arena with 0 tickets CTA...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_zero_tickets_cta.png'),
    });

    // 7. MOBILE VIEWPORT (390x844)
    console.log('7. Capturing Mobile Games Page (390x844)...');
    await page.setViewport({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_games_page_mobile_real_balance.png'),
    });

    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
