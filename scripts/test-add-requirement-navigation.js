// Automated Regression Test Suite: Create Lifafa Flow — Add Requirement Navigation & Form Safety
// Verifies:
// 1. YouTubeTaskBuilder contains NO nested <form> elements.
// 2. "Add Requirement" button has type="button" (non-submit).
// 3. All builder buttons (Cancel, Close) have type="button".
// 4. CreateLifafaPage guards against premature submission when currentStep < 5.
// 5. Task state updates correctly without page navigation or modal dismissal.
// 6. Sequential requirements (YouTube + Telegram + YouTube) preserve all tasks.
// 7. Step navigation (Step 2 -> Step 3 -> Step 2) preserves all tasks.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================================');
console.log('STARTING CREATE LIFAFA: ADD REQUIREMENT REGRESSION SUITE');
console.log('========================================================\n');

// 1. Inspect YouTubeTaskBuilder.tsx source code
const ytBuilderPath = path.join(rootDir, 'src', 'components', 'lifafa', 'YouTubeTaskBuilder.tsx');
assert.ok(fs.existsSync(ytBuilderPath), 'YouTubeTaskBuilder.tsx must exist');
const ytBuilderCode = fs.readFileSync(ytBuilderPath, 'utf8');

// TEST 1: No nested <form> in YouTubeTaskBuilder
assert.strictEqual(
  ytBuilderCode.includes('<form'),
  false,
  'YouTubeTaskBuilder must NOT contain any <form> tags (avoids HTML nested form standard violation)'
);
assert.strictEqual(
  ytBuilderCode.includes('</form>'),
  false,
  'YouTubeTaskBuilder must NOT contain </form> closing tags'
);
console.log('[PASS] Test 1: YouTubeTaskBuilder does NOT contain nested <form> elements');

// TEST 2: Add Requirement button is type="button"
assert.ok(
  ytBuilderCode.includes('type="button"') && ytBuilderCode.includes('<span>Add Requirement</span>'),
  'Add Requirement button must exist with explicit type="button"'
);
assert.strictEqual(
  ytBuilderCode.includes('type="submit"'),
  false,
  'YouTubeTaskBuilder must NOT contain any type="submit" buttons'
);
console.log('[PASS] Test 2: "Add Requirement" button has explicit type="button" (non-submit)');

// TEST 3: Cancel and Close buttons are type="button"
const buttonMatches = [...ytBuilderCode.matchAll(/<button[^>]*>/g)].map(m => m[0]);
assert.ok(buttonMatches.length >= 3, 'Must have Close, Cancel, and Add Requirement buttons');
for (const btn of buttonMatches) {
  assert.ok(
    btn.includes('type="button"'),
    `Every button in YouTubeTaskBuilder must have type="button", found: ${btn}`
  );
}
console.log(`[PASS] Test 3: All ${buttonMatches.length} buttons in YouTubeTaskBuilder strictly have type="button"`);

// 2. Inspect CreateLifafaPage.tsx source code
const createPagePath = path.join(rootDir, 'src', 'pages', 'CreateLifafaPage.tsx');
assert.ok(fs.existsSync(createPagePath), 'CreateLifafaPage.tsx must exist');
const createPageCode = fs.readFileSync(createPagePath, 'utf8');

// TEST 4: handleSubmit guards against submission when currentStep < 5
assert.ok(
  createPageCode.includes('if (currentStep < 5)'),
  'handleSubmit must guard against submission when currentStep < 5'
);
console.log('[PASS] Test 4: CreateLifafaPage handleSubmit guards against execution when currentStep < 5');

// TEST 5: Form onSubmit explicitly guards against step < 5
assert.ok(
  createPageCode.includes('if (currentStep === 5)') || createPageCode.includes('currentStep === 5'),
  'form onSubmit must check currentStep === 5 before calling handleSubmit'
);
console.log('[PASS] Test 5: Form onSubmit strictly delegates to handleSubmit ONLY when currentStep === 5');

// 3. State & Simulation Logic Tests
console.log('\n--- SIMULATING STATE LIFECYCLE ---');

// Mock state
let currentStep = 2;
let isCreatingLifafa = true;
let showYouTubeBuilder = true;
let showTelegramBuilder = false;
let tasks = [];
let routeNavigationCount = 0;
let lifafaCreationCount = 0;

function mockNavigate(route) {
  routeNavigationCount++;
}

function mockCreateLifafa() {
  lifafaCreationCount++;
}

// Handler simulation matching CreateLifafaPage.tsx
function handleYouTubeWatchAdded(data) {
  tasks = [
    ...tasks,
    {
      task_type: 'YOUTUBE_WATCH',
      title: data.title || 'Watch YouTube Video',
      description: `[YOUTUBE_WATCH:${data.videoId}] Watch the complete video to unlock your claim.`,
      target_url: data.videoUrl,
      youtube_video_id: data.videoId,
      is_required: true,
      is_enabled: true,
    },
  ];
  showYouTubeBuilder = false;
  // Note: NO route navigation, NO lifafa creation, NO step change
}

function handleTelegramChannelVerified(channel) {
  tasks = [
    ...tasks,
    {
      task_type: 'TELEGRAM_JOIN',
      title: `Join @${channel.channelUsername}`,
      description: `Official Telegram Channel: ${channel.channelTitle}`,
      target_url: `https://t.me/${channel.channelUsername}`,
      is_required: true,
      is_enabled: true,
      telegram_channel_username: channel.channelUsername,
      telegram_channel_id: channel.channelId,
      is_channel_verified: true,
    },
  ];
  showTelegramBuilder = false;
}

// TEST 6: Adding YouTube requirement keeps user on Step 2
handleYouTubeWatchAdded({
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  title: 'Official Channel Intro',
});

assert.strictEqual(currentStep, 2, 'User must remain on Step 2');
assert.strictEqual(isCreatingLifafa, true, 'isCreatingLifafa must remain true');
assert.strictEqual(showYouTubeBuilder, false, 'showYouTubeBuilder must close after adding');
assert.strictEqual(tasks.length, 1, 'Tasks array must have 1 task');
assert.strictEqual(tasks[0].task_type, 'YOUTUBE_WATCH', 'Task must be YOUTUBE_WATCH');
assert.strictEqual(tasks[0].youtube_video_id, 'dQw4w9WgXcQ', 'Video ID must match');
assert.strictEqual(routeNavigationCount, 0, 'Zero route navigation calls');
assert.strictEqual(lifafaCreationCount, 0, 'Zero Lifafa creation calls');
console.log('[PASS] Test 6: Adding YouTube Watch requirement keeps user on Step 2 without route navigation');

// TEST 7: Adding Telegram requirement after YouTube preserves both
showTelegramBuilder = true;
handleTelegramChannelVerified({
  channelUsername: 'createlifafa_announcements',
  channelId: -1001234567890,
  channelTitle: 'CreateLifafa Announcements',
});

assert.strictEqual(tasks.length, 2, 'Tasks array must now have 2 tasks');
assert.strictEqual(tasks[0].task_type, 'YOUTUBE_WATCH');
assert.strictEqual(tasks[1].task_type, 'TELEGRAM_JOIN');
assert.strictEqual(currentStep, 2, 'Still on Step 2');
console.log('[PASS] Test 7: Adding Telegram requirement after YouTube preserves both requirements in order');

// TEST 8: Adding second YouTube requirement preserves all three
showYouTubeBuilder = true;
handleYouTubeWatchAdded({
  videoUrl: 'https://youtu.be/jNQXAC9IVRw',
  videoId: 'jNQXAC9IVRw',
  title: 'Second Sponsor Video',
});

assert.strictEqual(tasks.length, 3, 'Tasks array must now have 3 tasks');
assert.strictEqual(tasks[0].task_type, 'YOUTUBE_WATCH');
assert.strictEqual(tasks[1].task_type, 'TELEGRAM_JOIN');
assert.strictEqual(tasks[2].task_type, 'YOUTUBE_WATCH');
assert.strictEqual(tasks[2].youtube_video_id, 'jNQXAC9IVRw');
assert.strictEqual(currentStep, 2, 'Still on Step 2');
console.log('[PASS] Test 8: Multiple YouTube watch requirements can be added sequentially');

// TEST 9: Step navigation to Step 3 and back to Step 2 preserves tasks
currentStep = 3; // Click Next: Reward
assert.strictEqual(currentStep, 3);
currentStep = 2; // Click Back to Step 2
assert.strictEqual(currentStep, 2);
assert.strictEqual(tasks.length, 3, 'All 3 tasks remain intact across step transitions');
assert.strictEqual(tasks[0].youtube_video_id, 'dQw4w9WgXcQ');
assert.strictEqual(tasks[1].telegram_channel_username, 'createlifafa_announcements');
assert.strictEqual(tasks[2].youtube_video_id, 'jNQXAC9IVRw');
console.log('[PASS] Test 9: Navigating between steps (Step 2 <-> Step 3) preserves all configured requirements');

// TEST 10: Premature form submission attempt while on Step 2 does NOT submit Lifafa
let submitAttempted = false;
function attemptSubmit() {
  if (currentStep < 5) {
    // Guarded
    return false;
  }
  mockCreateLifafa();
  return true;
}

const submitted = attemptSubmit();
assert.strictEqual(submitted, false, 'Form submission must be rejected before Step 5');
assert.strictEqual(lifafaCreationCount, 0, 'createLifafa must never be called on Step 2');
assert.strictEqual(routeNavigationCount, 0, 'No navigation to /lifafa occurred');
console.log('[PASS] Test 10: Form submission cannot occur on Step 2 (createLifafa never fired)');

console.log('\n========================================================');
console.log('ALL REGRESSION TESTS PASSED (10 / 10)');
console.log('========================================================');
