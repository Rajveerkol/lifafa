import puppeteer from 'puppeteer-core';
import path from 'node:path';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\e68cc24f-7ae8-47a7-bd5c-35f97585bb4a';
const BROWSER_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function captureResult() {
  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });
    await page.goto('http://localhost:4173/games', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    // Play duel
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('PLAY DUEL NOW')
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Find opponent
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('FIND OPPONENT')
      );
      if (btn) btn.click();
    });

    console.log('Started duel. Playing continuously until Result Screen appears...');
    const maxWaitMs = 45000;
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      await new Promise((res) => setTimeout(res, 600));

      const status = await page.evaluate(() => {
        const text = document.body.innerText;
        const isResult =
          text.includes('VICTORY') ||
          text.includes('DEFEAT') ||
          text.includes('DRAW GAME') ||
          text.includes('Round Breakdown');

        if (isResult) return { isResult: true };

        // Check if there is an unselected, clickable option
        const opt = document.querySelector('button.p-4.rounded-2xl.border:not([disabled])');
        if (opt) {
          opt.click();
          return { clicked: true, text: opt.textContent?.slice(0, 20) };
        }

        return { waiting: true };
      });

      if (status.isResult) {
        console.log('Final Result Screen reached!');
        await new Promise((res) => setTimeout(res, 800));
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, 'duel_match_result_screen.png'),
        });
        console.log('duel_match_result_screen.png successfully captured!');
        break;
      }
    }
  } catch (err) {
    console.error('Error during duel playthrough:', err);
  } finally {
    await browser.close();
  }
}

captureResult();
