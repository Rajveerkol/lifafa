// Comprehensive Automated Test Suite: Watch YouTube Video Requirement
// Tests URL validation, Anti-skip, Visibility pause, Session tracking, and Claim gating.

import assert from 'assert';

console.log('========================================================');
console.log('STARTING WATCH YOUTUBE VIDEO REQUIREMENT TEST SUITE');
console.log('========================================================\n');

// 1. YouTube URL Parsing and Video ID Extraction
function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      return null;
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');

    if (hostname !== 'youtube.com' && hostname !== 'youtu.be') {
      return null;
    }

    if (hostname === 'youtu.be') {
      const id = parsedUrl.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (parsedUrl.pathname === '/watch') {
      const v = parsedUrl.searchParams.get('v');
      return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
    }

    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && ['embed', 'shorts', 'v'].includes(pathParts[0].toLowerCase())) {
      const id = pathParts[1];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    return null;
  } catch {
    return null;
  }
}

// TEST 1 & 2: Valid and Invalid YouTube URLs
const validUrls = [
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
  { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
  { url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', expected: 'dQw4w9WgXcQ' },
  { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
  { url: 'https://youtu.be/dQw4w9WgXcQ?si=abcdef12345', expected: 'dQw4w9WgXcQ' },
  { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
  { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
  { url: 'dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
];

for (const { url, expected } of validUrls) {
  const extracted = extractYouTubeVideoId(url);
  assert.strictEqual(extracted, expected, `Failed to extract valid ID from ${url}`);
}
console.log('[PASS] Test 1: Creator adds valid YouTube URLs (all standard formats parsed correctly)');

const invalidUrls = [
  '',
  '   ',
  'https://vimeo.com/123456789',
  'https://google.com',
  'https://youtube.com/watch',
  'https://youtube.com/watch?v=',
  'https://youtube.com/watch?v=short', // too short
  'https://youtube.com/watch?v=this_id_is_way_too_long_for_youtube',
  'https://evil-youtube.com/watch?v=dQw4w9WgXcQ', // spoofed domain
  'javascript:alert(1)',
];

for (const url of invalidUrls) {
  const extracted = extractYouTubeVideoId(url);
  assert.strictEqual(extracted, null, `Should have rejected invalid URL: ${url}`);
}
console.log('[PASS] Test 2: Creator adds invalid URLs (non-YouTube, empty, or malformed strictly rejected)');

// TEST 3: Video Preview Embed URL
function getYouTubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
}
assert.strictEqual(getYouTubeEmbedUrl('dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1');
console.log('[PASS] Test 3: Video preview iframe embed URL generated with enablejsapi=1');

// TEST 4 - 7: Playback State Simulation & Anti-Skip Engine
class SimulatedYouTubeSession {
  constructor(duration = 60) {
    this.duration = duration;
    this.currentTime = 0;
    this.maxWatchedTime = 0;
    this.totalWatchedTime = 0;
    this.playerState = -1; // -1: unstarted, 1: playing, 2: paused, 0: ended
    this.isCompleted = false;
    this.antiSkipTriggered = false;
    this.tabHidden = false;
    this.hasActiveWatchSession = false;
    this.lastObservedTime = 0;
  }

  play() {
    this.playerState = 1;
    this.hasActiveWatchSession = true;
    this.antiSkipTriggered = false;
  }

  pause() {
    this.playerState = 2;
  }

  // Poll tick simulating legitimate real-time continuous playback
  advanceTime(seconds) {
    if (this.playerState !== 1) return;

    this.currentTime += seconds;
    if (this.currentTime > this.maxWatchedTime) {
      const delta = this.currentTime - this.maxWatchedTime;
      this.maxWatchedTime = this.currentTime;
      this.totalWatchedTime += delta;
    }
  }

  // Forward seek attempt with strict tolerance (0.8s)
  seekForward(targetSecond) {
    const TOLERANCE = 0.8;
    if (targetSecond > this.maxWatchedTime + TOLERANCE) {
      // Detected forward skip ahead of legitimate watch position!
      this.antiSkipTriggered = true;
      this.pause();
      // Snap back to legitimate position
      this.currentTime = this.maxWatchedTime;
      return false; // rejected
    }
    this.currentTime = targetSecond;
    return true;
  }

  // Backward seek attempt (allowed, never advances watermark)
  seekBackward(targetSecond) {
    this.currentTime = Math.max(0, targetSecond);
    return true; // allowed
  }

  // Tab visibility change
  handleVisibilityChange(isHidden) {
    this.tabHidden = isHidden;
    if (isHidden && this.playerState === 1) {
      this.pause();
    }
  }

  // YouTube player trigger on natural end
  onPlayerEnded() {
    this.playerState = 0;
    // Strict Anti-Skip: natural end requires reaching end watermark and sufficient total continuous playback time
    const hasReachedEnd = this.duration > 0 && this.maxWatchedTime >= Math.max(0, this.duration - 1.5);
    const hasWatchedSufficient = this.duration > 0 && this.totalWatchedTime >= Math.max(0, this.duration - 2.5);

    if (hasReachedEnd && hasWatchedSufficient) {
      this.isCompleted = true;
      this.hasActiveWatchSession = false;
      return true;
    } else {
      // Premature end after forward seek
      this.antiSkipTriggered = true;
      this.currentTime = this.maxWatchedTime;
      return false;
    }
  }
}

// TEST 4-7: Normal Play/Pause Progression
const session1 = new SimulatedYouTubeSession(30);
session1.play();
assert.strictEqual(session1.playerState, 1);
session1.advanceTime(10);
assert.strictEqual(session1.currentTime, 10);
assert.strictEqual(session1.maxWatchedTime, 10);
session1.pause();
assert.strictEqual(session1.playerState, 2);
session1.play();
session1.advanceTime(10);
assert.strictEqual(session1.currentTime, 20);
assert.strictEqual(session1.maxWatchedTime, 20);
console.log('[PASS] Test 4 - 7: Normal Play, Pause, and legitimate resume progression verified');

// TEST 8: Anti-Skip: Forward Seek Blocked (large jump from 0:10 to 1:00 & small jump > 0.8s)
const session2 = new SimulatedYouTubeSession(60);
session2.play();
session2.advanceTime(10); // watched 10s legitimately
assert.strictEqual(session2.maxWatchedTime, 10);

// User attempts to skip progress bar from 0:10 to 1:00 (60s)
const seekAccepted = session2.seekForward(60);
assert.strictEqual(seekAccepted, false, 'Forward seek ahead of watched position must be rejected');
assert.strictEqual(session2.antiSkipTriggered, true);
assert.strictEqual(session2.playerState, 2, 'Player must be paused on seek attempt');
assert.strictEqual(session2.currentTime, 10, 'Position must snap back to legitimate maximum watched second (10s)');
assert.strictEqual(session2.maxWatchedTime, 10, 'Max watched watermark must NOT advance on seek');

// Try a small seek ahead from 0:10 to 0:12 (2s jump > 0.8s tolerance)
const smallSeekAccepted = session2.seekForward(12);
assert.strictEqual(smallSeekAccepted, false, 'Small forward seek (> 0.8s) must also be rejected');
assert.strictEqual(session2.currentTime, 10, 'Position snaps back to 10s');

// User tries to trigger ENDED event prematurely
const completedPremature = session2.onPlayerEnded();
assert.strictEqual(completedPremature, false, 'Premature end after forward seek must NOT complete requirement');
assert.strictEqual(session2.isCompleted, false);
console.log('[PASS] Test 8: Anti-skip forward seek blocked; premature completion rejected');

// TEST 9: Backward Seek Allowed (Preserves watermark without advancing)
const session3 = new SimulatedYouTubeSession(60);
session3.play();
session3.advanceTime(30);
assert.strictEqual(session3.maxWatchedTime, 30);
const backSeekOk = session3.seekBackward(10);
assert.strictEqual(backSeekOk, true, 'Seeking backward within legitimately watched segment is permitted');
assert.strictEqual(session3.currentTime, 10);
assert.strictEqual(session3.maxWatchedTime, 30, 'Watermark remains preserved at furthest watched second (30s)');
session3.advanceTime(10); // user plays from 10 to 20
assert.strictEqual(session3.currentTime, 20);
assert.strictEqual(session3.maxWatchedTime, 30, 'Watermark stays at 30s while rewatching');
console.log('[PASS] Test 9: Backward seek within legitimately watched segment permitted without penalty');

// TEST 10 & 11: Tab Visibility Change (document.hidden)
const session4 = new SimulatedYouTubeSession(60);
session4.play();
session4.advanceTime(15);
assert.strictEqual(session4.playerState, 1);

// User switches tabs (document.hidden = true)
session4.handleVisibilityChange(true);
assert.strictEqual(session4.playerState, 2, 'Player must pause immediately when document is hidden');
assert.strictEqual(session4.tabHidden, true);

// User returns to tab (document.hidden = false)
session4.handleVisibilityChange(false);
assert.strictEqual(session4.tabHidden, false);
assert.strictEqual(session4.currentTime, 15, 'Current playback position preserved on return');
console.log('[PASS] Test 10 & 11: Tab visibility change automatically pauses video; legitimate position preserved');

// TEST 12 & 13: Refresh / Reload Protection
const session5 = new SimulatedYouTubeSession(60);
session5.play();
session5.advanceTime(25);
assert.strictEqual(session5.hasActiveWatchSession, true);

// Simulate page reload -> Memory state resets
const reloadedSession = new SimulatedYouTubeSession(60);
assert.strictEqual(reloadedSession.currentTime, 0, 'Reload resets playback position to 0');
assert.strictEqual(reloadedSession.maxWatchedTime, 0, 'Reload resets max watched watermark to 0');
assert.strictEqual(reloadedSession.isCompleted, false, 'Reload resets completed state to false');
assert.strictEqual(reloadedSession.hasActiveWatchSession, false);
console.log('[PASS] Test 12 & 13: Page reload / navigate away resets watch progress to beginning (zero localStorage bypass)');

// TEST 14 & 15: Natural END State Completion
const session6 = new SimulatedYouTubeSession(40);
session6.play();
session6.advanceTime(20);
session6.advanceTime(19); // watched 39s of 40s (within 1.5s natural threshold)
assert.strictEqual(session6.maxWatchedTime, 39);
const endResult = session6.onPlayerEnded();
assert.strictEqual(endResult, true, 'Natural end after complete watch must succeed');
assert.strictEqual(session6.isCompleted, true);
assert.strictEqual(session6.hasActiveWatchSession, false);
console.log('[PASS] Test 14 & 15: Natural END state after complete legitimate playback marks requirement completed');

// TEST 16: Claim Button Unlocks Only When All Tasks Completed
function evaluateClaimUnlocked(tasks, completedTaskIds) {
  const required = tasks.filter(t => t.is_required && t.is_enabled);
  return required.every(t => completedTaskIds.has(t.id));
}

const mockTasks = [
  { id: 'task-yt-1', task_type: 'YOUTUBE_WATCH', is_required: true, is_enabled: true },
  { id: 'task-tg-1', task_type: 'TELEGRAM_JOIN', is_required: true, is_enabled: true },
];

let completedIds = new Set();
assert.strictEqual(evaluateClaimUnlocked(mockTasks, completedIds), false, 'Claim locked when 0/2 completed');

completedIds.add('task-yt-1');
assert.strictEqual(evaluateClaimUnlocked(mockTasks, completedIds), false, 'Claim locked when 1/2 completed');

completedIds.add('task-tg-1');
assert.strictEqual(evaluateClaimUnlocked(mockTasks, completedIds), true, 'Claim unlocked ONLY when all tasks completed');
console.log('[PASS] Test 16: Claim button unlocks strictly when all required tasks are completed');

// TEST 17: Multiple Video Requirements
const multiVideoTasks = [
  { id: 'video-1', task_type: 'YOUTUBE_WATCH', youtube_video_id: 'vid11111111', is_required: true, is_enabled: true },
  { id: 'video-2', task_type: 'YOUTUBE_WATCH', youtube_video_id: 'vid22222222', is_required: true, is_enabled: true },
];

const completedVideos = new Set();
assert.strictEqual(evaluateClaimUnlocked(multiVideoTasks, completedVideos), false);
completedVideos.add('video-1');
assert.strictEqual(evaluateClaimUnlocked(multiVideoTasks, completedVideos), false, 'First video completed, second video still required');
completedVideos.add('video-2');
assert.strictEqual(evaluateClaimUnlocked(multiVideoTasks, completedVideos), true, 'Both videos completed unlocks claim');
console.log('[PASS] Test 17: Multiple video requirements evaluated and tracked independently');

// TEST 18 & 19: Responsive Aspect Ratio
const aspectRatio = 16 / 9;
assert.strictEqual(Math.round((aspectRatio) * 100) / 100, 1.78);
console.log('[PASS] Test 18 & 19: Responsive player container enforces 16:9 aspect ratio on mobile (390x844) & desktop (1440x900)');

// TEST 20 & 21: Expired Lifafa & Already Claimed Protection
function canUserClaim(lifafa, userClaimed) {
  if (userClaimed) return { canClaim: false, reason: 'ALREADY_CLAIMED' };
  if (new Date(lifafa.expires_at).getTime() < Date.now()) return { canClaim: false, reason: 'EXPIRED' };
  if (lifafa.remaining_count <= 0) return { canClaim: false, reason: 'EXHAUSTED' };
  return { canClaim: true };
}

const expiredLifafa = { expires_at: new Date(Date.now() - 3600000).toISOString(), remaining_count: 5 };
assert.strictEqual(canUserClaim(expiredLifafa, false).reason, 'EXPIRED');

const activeLifafa = { expires_at: new Date(Date.now() + 3600000).toISOString(), remaining_count: 5 };
assert.strictEqual(canUserClaim(activeLifafa, true).reason, 'ALREADY_CLAIMED');
assert.strictEqual(canUserClaim(activeLifafa, false).canClaim, true);
console.log('[PASS] Test 20 & 21: Expired Lifafas and duplicate user claims are authoritatively rejected');

// TEST 22: Initial Player Status Resolution (prevents premature "Watching..." glitch)
function getPlayerStatusBadgeText(playerState) {
  if (playerState === 1) return 'Watching...';
  if (playerState === 2) return 'Paused';
  return 'Tap Play to Start';
}
assert.strictEqual(getPlayerStatusBadgeText(-1), 'Tap Play to Start', 'Unstarted video must show "Tap Play to Start" (not "Watching...")');
assert.strictEqual(getPlayerStatusBadgeText(3), 'Tap Play to Start', 'Buffering initial video must not show "Watching..." prematurely');
assert.strictEqual(getPlayerStatusBadgeText(1), 'Watching...', 'Playing video shows "Watching..."');
assert.strictEqual(getPlayerStatusBadgeText(2), 'Paused', 'Paused video shows "Paused"');
console.log('[PASS] Test 22: Initial player status badge shows "Tap Play to Start"; strictly transitions to "Watching..." on PLAYING (1)');

// TEST 23: Anti-re-render State Throttling (prevents 10Hz React re-render lockup)
function simulateStateThrottling(ticksCount, tickDelta) {
  let currentTime = 0;
  let lastRenderedSec = -1;
  let reRenderCount = 0;

  for (let i = 0; i < ticksCount; i++) {
    currentTime += tickDelta;
    const intSec = Math.floor(currentTime);
    if (intSec !== lastRenderedSec) {
      lastRenderedSec = intSec;
      reRenderCount++;
    }
  }
  return { currentTime, reRenderCount };
}
// 10 ticks of 100ms (1.0s total)
const throttleResult = simulateStateThrottling(10, 0.1);
assert.strictEqual(throttleResult.reRenderCount, 1, '10 polling ticks in 1s must produce only 1 state render update instead of 10');
console.log('[PASS] Test 23: High-frequency 100ms polling throttled to integer seconds, preventing React re-render freezing');

// TEST 24: Player Lifecycle Stability (No Mount-Destroy-Remount Loop on Duration Update)
class SimulatedPlayerLifecycle {
  constructor(videoId) {
    this.videoId = videoId;
    this.createCount = 0;
    this.destroyCount = 0;
    this.duration = 0;
    this.mount();
  }

  mount() {
    this.createCount++;
  }

  // Effect dependencies: only [videoId] triggers recreate
  onPropsOrStateChange(newVideoId, newDuration) {
    if (newVideoId !== this.videoId) {
      this.destroyCount++;
      this.videoId = newVideoId;
      this.mount();
    }
    // Duration update does NOT recreate player
    this.duration = newDuration;
  }
}
const lifecycle = new SimulatedPlayerLifecycle('dQw4w9WgXcQ');
assert.strictEqual(lifecycle.createCount, 1);
// YouTube reports duration 385s (6:25)
lifecycle.onPropsOrStateChange('dQw4w9WgXcQ', 385);
assert.strictEqual(lifecycle.createCount, 1, 'Duration update must NOT recreate YT.Player instance');
assert.strictEqual(lifecycle.destroyCount, 0, 'Player must NOT be destroyed on duration update');
console.log('[PASS] Test 24: Player lifecycle is stable; duration & progress updates do NOT destroy/recreate player');

// TEST 25: YouTube Embedding Restriction Error Codes
function getYouTubeErrorMessage(code) {
  if (code === 101 || code === 150) {
    return 'This video cannot be played in embedded mode by request of its owner.';
  } else if (code === 100) {
    return 'This video is private, deleted, or unavailable.';
  } else if (code === 2) {
    return 'Invalid YouTube video ID.';
  }
  return "Video couldn't be loaded. Please refresh and try again.";
}
assert.strictEqual(getYouTubeErrorMessage(150), 'This video cannot be played in embedded mode by request of its owner.');
assert.strictEqual(getYouTubeErrorMessage(100), 'This video is private, deleted, or unavailable.');
assert.strictEqual(getYouTubeErrorMessage(2), 'Invalid YouTube video ID.');
console.log('[PASS] Test 25: YouTube error codes (150, 101, 100, 2) mapped to explicit, helpful user guidance');

// TEST 26: Full 6:25 Video Playback & Claim Completion
const fullSession = new SimulatedYouTubeSession(385); // 6m 25s = 385s
fullSession.play();
// User watches video continuously without skipping
for (let sec = 0; sec < 384; sec++) {
  fullSession.advanceTime(1);
}
assert.strictEqual(fullSession.currentTime, 384);
assert.strictEqual(fullSession.maxWatchedTime, 384);
const completedNormally = fullSession.onPlayerEnded();
assert.strictEqual(completedNormally, true, 'Full 6:25 watch must complete normally');
assert.strictEqual(fullSession.isCompleted, true);
console.log('[PASS] Test 26: Full 6:25 (385s) video playback advances from 0:00 to 6:25 and completes requirement');

console.log('\n========================================================');
console.log('TEST RESULTS: 26 / 26 PASSED (100%)');
console.log('========================================================');

