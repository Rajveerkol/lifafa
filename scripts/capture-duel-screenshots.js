import puppeteer from 'puppeteer-core';
import path from 'node:path';

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
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 1. DESKTOP VIEWPORT: GAMES LANDING PAGE
    console.log('1. Capturing Desktop Games Landing...');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:4173/games', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_games_page_desktop_1280x800.png'),
    });

    // 2. HOW IT WORKS MODAL
    console.log('2. Capturing How It Works Modal...');
    const clickedHow = await clickByText(page, 'How It Works');
    if (clickedHow) {
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'duel_how_it_works_modal.png'),
      });
      // Close modal
      await clickByText(page, "Got it, Let's Play!");
      await new Promise((r) => setTimeout(r, 400));
    }

    // 3. ENTER DUEL ARENA LOBBY (DESKTOP)
    console.log('3. Entering Duel Arena Lobby...');
    await clickByText(page, 'PLAY DUEL NOW');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_arena_lobby_desktop.png'),
    });

    // 4. MATCH HISTORY TAB
    console.log('4. Capturing Match History Tab...');
    await clickByText(page, 'Match History');
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_match_history_tab.png'),
    });

    // 5. LEADERBOARD TAB
    console.log('5. Capturing Leaderboard Tab...');
    await clickByText(page, 'Leaderboard');
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_leaderboard_tab.png'),
    });

    // Return to Arena Overview tab
    await clickByText(page, 'Arena Overview');
    await new Promise((r) => setTimeout(r, 400));

    // 6. START MATCHMAKING (RADAR)
    console.log('6. Starting Matchmaking...');
    await clickByText(page, 'FIND OPPONENT');
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_matchmaking_radar.png'),
    });

    // 7. WAIT FOR VS COUNTDOWN SCREEN
    console.log('7. Capturing VS Countdown Screen...');
    await new Promise((r) => setTimeout(r, 1600));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_vs_countdown_screen.png'),
    });

    // 8. WAIT FOR ROUND 1 GAMEPLAY SCREEN
    console.log('8. Waiting for Round 1 Gameplay...');
    await new Promise((r) => setTimeout(r, 3400));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_round1_gameplay_screen.png'),
    });

    // 9. ANSWER ROUND 1 & CAPTURE TRANSITION
    console.log('9. Answering Round 1...');
    await page.evaluate(() => {
      const opt = document.querySelector('button.p-4.rounded-2xl.border');
      if (opt) opt.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_round_transition_feedback.png'),
    });

    // 10. PLAY THROUGH TO RESULT SCREEN
    console.log('10. Simulating remaining rounds to Result Screen...');
    for (let i = 2; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, 2200));
      await page.evaluate(() => {
        const opt = document.querySelector('button.p-4.rounded-2xl.border');
        if (opt) opt.click();
      });
    }

    // Wait for match conclusion & result screen
    await new Promise((r) => setTimeout(r, 2800));
    console.log('11. Capturing Final Result Screen...');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_match_result_screen.png'),
    });

    // 12. MOBILE VIEWPORT: GAMES LANDING & DUEL LOBBY
    console.log('12. Capturing Mobile Views...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:4173/games', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_games_page_mobile_390x844.png'),
    });

    await clickByText(page, 'PLAY DUEL NOW');
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'duel_arena_lobby_mobile_390x844.png'),
    });

    console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('Screenshot capture failed:', err);
  } finally {
    await browser.close();
  }
}

capture();
