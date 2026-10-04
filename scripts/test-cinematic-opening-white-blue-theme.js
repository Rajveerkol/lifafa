import fs from 'fs';

console.log('================================================================');
console.log('TEST SUITE: LIFAFA CINEMATIC OPENING WHITE + BLUE THEME AUDIT');
console.log('================================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

const envelopePath = 'src/components/lifafa/cinematic/CinematicEnvelope.tsx';
assert(fs.existsSync(envelopePath), 'CinematicEnvelope.tsx exists');

const content = fs.readFileSync(envelopePath, 'utf8');

// 1. Background Verification
console.log('\n--- 1. BACKGROUND AUDIT ---');
assert(content.includes('bg-[#F8FBFF]'), 'Root container uses clean white/light-blue background #F8FBFF');
assert(content.includes('from-[#F0F7FF] via-[#F8FBFF] to-[#EEF5FF]'), 'Uses subtle light blue radial/linear gradient');
assert(!content.includes('#070b14'), 'Old black container background #070b14 completely removed');
assert(!content.includes('#0a0f1d'), 'Old dark navy background #0a0f1d completely removed');
assert(!content.includes('#02040a'), 'Old pitch black background #02040a completely removed');
assert(content.includes('bg-blue-500/12 rounded-full blur-3xl'), 'Features soft blue ambient spotlight');
assert(content.includes('bg-blue-400/40') || content.includes('bg-blue-300/35'), 'Features subtle floating blue light particles');

// 2. 3D Envelope Presentation & Materials
console.log('\n--- 2. 3D ENVELOPE AUDIT ---');
assert(content.includes('perspective-1000'), 'Preserves 3D perspective-1000');
assert(content.includes('preserve-3d'), 'Preserves preserve-3d transform style');
assert(content.includes('animate-envelope-float'), 'Preserves floating envelope animation');
assert(content.includes('bg-gradient-to-b from-[#1d4ed8] via-[#1e40af] to-[#172554]'), 'Back envelope has royal blue / navy inner lining');
assert(content.includes('from-white via-blue-50/90 to-blue-100/70') || content.includes('from-[#f0f7ff] via-white to-[#e2effe]'), 'Front envelope body uses white with subtle blue gradient panels');
assert(content.includes('stroke="#3b82f6"'), 'Folds feature crisp metallic royal blue hairline borders');

// 3. Central Tap Button (₹ Seal)
console.log('\n--- 3. CENTRAL TAP BUTTON AUDIT ---');
assert(content.includes('from-blue-700 via-blue-500 to-indigo-500') || content.includes('from-blue-500 via-blue-600 to-indigo-700'), 'Central ₹ seal uses primary website BLUE gradient');
assert(content.includes('text-white font-serif drop-shadow-md'), '₹ icon is crisp white');
assert(content.includes('TAP'), 'Preserves TAP text');
assert(content.includes('animate-ping'), 'Preserves pulse/ping ripple animation');
assert(!content.includes('from-amber-600 via-yellow-400 to-amber-300'), 'Old gold TAP seal gradient completely removed');

// 4. Main CTA Button
console.log('\n--- 4. MAIN CTA BUTTON AUDIT ---');
assert(content.includes('from-blue-600 via-blue-500 to-indigo-600'), 'CTA uses brand blue gradient');
assert(content.includes('text-white font-black'), 'CTA text is white font-black');
assert(content.includes('shadow-blue-500/35'), 'CTA uses soft blue shadow');
assert(content.includes('id="open-lifafa-btn"'), 'CTA has accessible button ID');
assert(!content.includes('from-amber-400 via-yellow-400 to-amber-500'), 'Old gold CTA gradient completely removed');

// 5. Top Header Badge
console.log('\n--- 5. TOP BADGE AUDIT ---');
assert(content.includes('bg-white/90 backdrop-blur-md border border-blue-200'), 'Top badge uses white glass background with blue border');
assert(content.includes('text-blue-700'), 'Top badge text is brand blue');
assert(content.includes('Exclusive Digital Lifafa Gift'), 'Top badge preserves title content');

// 6. Typography & Contrast
console.log('\n--- 6. TYPOGRAPHY & WCAG CONTRAST AUDIT ---');
assert(content.includes('text-slate-900'), 'Primary title uses dark slate-900 for strong contrast');
assert(content.includes('text-slate-600'), 'Subtitle uses readable slate-600');
assert(content.includes('text-blue-700'), 'Reward pool amount highlighted in primary blue');

// 7. Confetti & Light Burst
console.log('\n--- 7. CELEBRATION EFFECTS AUDIT ---');
assert(content.includes('#2563eb') && content.includes('#3b82f6') && content.includes('#ffffff'), 'Confetti burst uses royal blue, sky blue, and white brand colors');
assert(content.includes('bg-radial from-white via-cyan-300/80 to-transparent'), 'Light burst uses clean cyan/white illumination');

// 8. Accessibility & Interactions
console.log('\n--- 8. ACCESSIBILITY & CONTROLS ---');
assert(content.includes('id="skip-animation-btn"'), 'Skip animation button is present');
assert(content.includes('prefers-reduced-motion'), 'prefers-reduced-motion is respected');
assert(content.includes('handleOpen'), 'handleOpen opening interaction logic preserved');

console.log('\n================================================================');
console.log(`TOTAL AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
