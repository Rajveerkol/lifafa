// Production Question Bank Validator for DUEL EARN
// Validates 1,000+ question bank against strict structural, semantic, and gameplay rules

import fs from 'node:fs';
import path from 'node:path';

const MASTER_BANK_PATH = path.resolve('scripts/data/duel-question-bank.json');

console.log('================================================================');
console.log('DUEL EARN QUESTION BANK: PRODUCTION SCHEMA & INTEGRITY AUDIT');
console.log('================================================================\n');

if (!fs.existsSync(MASTER_BANK_PATH)) {
  console.error(`FATAL: Master question bank not found at ${MASTER_BANK_PATH}`);
  process.exit(1);
}

const rawData = fs.readFileSync(MASTER_BANK_PATH, 'utf8');
let questions;
try {
  questions = JSON.parse(rawData);
} catch (e) {
  console.error(`FATAL: Failed to parse JSON: ${e.message}`);
  process.exit(1);
}

const VALID_ROUNDS = ['QUICK_QUIZ', 'PATTERN', 'MEMORY', 'ACCURACY', 'SPEED'];
const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const EXPECTED_TIME_LIMITS = {
  QUICK_QUIZ: 25,
  PATTERN: 25,
  MEMORY: 25,
  ACCURACY: 20,
  SPEED: 15
};

const errors = [];
const warnings = [];

// Stats collectors
const roundCounts = {
  QUICK_QUIZ: 0,
  PATTERN: 0,
  MEMORY: 0,
  ACCURACY: 0,
  SPEED: 0
};

const difficultyCounts = {
  EASY: 0,
  MEDIUM: 0,
  HARD: 0
};

const subcategoryMap = new Map();
const seenIds = new Set();
const seenPrompts = new Set();

console.log(`Auditing ${questions.length} questions in master bank...\n`);

questions.forEach((q, idx) => {
  const prefix = `[Q #${idx + 1} (${q.id || 'NO_ID'})]`;

  // 1. ID Check
  if (!q.id || typeof q.id !== 'string') {
    errors.push(`${prefix} Missing or invalid 'id' field.`);
  } else {
    if (seenIds.has(q.id)) {
      errors.push(`${prefix} Duplicate ID '${q.id}' detected.`);
    }
    seenIds.add(q.id);
  }

  // 2. Round Type Check
  if (!VALID_ROUNDS.includes(q.round_type)) {
    errors.push(`${prefix} Invalid round_type '${q.round_type}'. Expected one of: ${VALID_ROUNDS.join(', ')}`);
  } else {
    roundCounts[q.round_type]++;
  }

  // 3. Difficulty Check
  if (!VALID_DIFFICULTIES.includes(q.difficulty)) {
    errors.push(`${prefix} Invalid difficulty '${q.difficulty}'. Expected one of: ${VALID_DIFFICULTIES.join(', ')}`);
  } else {
    difficultyCounts[q.difficulty]++;
  }

  // 4. Category & Subcategory Check
  if (!q.category || typeof q.category !== 'string' || q.category.trim().length === 0) {
    errors.push(`${prefix} Missing or empty 'category'.`);
  }
  if (!q.subcategory || typeof q.subcategory !== 'string' || q.subcategory.trim().length === 0) {
    errors.push(`${prefix} Missing or empty 'subcategory'.`);
  } else {
    const key = `${q.round_type} -> ${q.subcategory}`;
    subcategoryMap.set(key, (subcategoryMap.get(key) || 0) + 1);
  }

  // 5. Prompt Check
  if (!q.prompt || typeof q.prompt !== 'string' || q.prompt.trim().length < 3) {
    errors.push(`${prefix} Missing or abnormally short prompt.`);
  } else {
    const normPrompt = q.prompt.trim().toLowerCase();
    if (seenPrompts.has(normPrompt)) {
      errors.push(`${prefix} Duplicate prompt detected: "${q.prompt}"`);
    }
    seenPrompts.add(normPrompt);
  }

  // 6. Options Check
  if (!Array.isArray(q.options)) {
    errors.push(`${prefix} 'options' must be an Array.`);
  } else {
    if (q.options.length !== 4) {
      errors.push(`${prefix} 'options' must have exactly 4 items (found ${q.options.length}).`);
    }

    const optionStrSet = new Set();
    q.options.forEach((opt, optIdx) => {
      const optStr = String(opt).trim();
      if (optStr.length === 0) {
        errors.push(`${prefix} Option #${optIdx + 1} is empty.`);
      }
      if (optionStrSet.has(optStr.toLowerCase())) {
        errors.push(`${prefix} Duplicate option "${optStr}" within same question options.`);
      }
      optionStrSet.add(optStr.toLowerCase());
    });
  }

  // 7. Correct Answer Check
  if (q.correct_answer === undefined || q.correct_answer === null) {
    errors.push(`${prefix} Missing 'correct_answer'.`);
  } else {
    const ansStr = String(q.correct_answer).trim();
    if (ansStr.length === 0) {
      errors.push(`${prefix} 'correct_answer' is empty.`);
    }

    if (Array.isArray(q.options)) {
      const match = q.options.some(opt => String(opt).trim() === ansStr);
      if (!match) {
        errors.push(`${prefix} 'correct_answer' ("${ansStr}") not found in options: ${JSON.stringify(q.options)}`);
      }
    }
  }

  // 8. Time Limit Check
  const expectedTime = EXPECTED_TIME_LIMITS[q.round_type];
  const timeLimit = q.time_limit_sec !== undefined ? q.time_limit_sec : q.time_limit_seconds;
  if (expectedTime !== undefined && timeLimit !== expectedTime) {
    errors.push(`${prefix} Invalid time limit (${timeLimit}) for round '${q.round_type}'. Expected ${expectedTime}s.`);
  }

  // 9. Explanation Check
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length === 0) {
    warnings.push(`${prefix} Missing or empty 'explanation'.`);
  }
});

// Aggregate Validations
console.log('--- AGGREGATE SUMMARY ---');
console.log(`Total Questions: ${questions.length} (Requirement: >= 1,000)`);
if (questions.length < 1000) {
  errors.push(`Total questions (${questions.length}) is below required minimum of 1,000.`);
}

console.log('\nRound Distribution:');
VALID_ROUNDS.forEach(r => {
  const count = roundCounts[r];
  console.log(`  - ${r.padEnd(12)}: ${count} questions (Requirement: >= 200)`);
  if (count < 200) {
    errors.push(`Round ${r} has only ${count} questions (minimum required: 200).`);
  }
});

console.log('\nDifficulty Distribution:');
const totalQ = questions.length;
VALID_DIFFICULTIES.forEach(d => {
  const count = difficultyCounts[d];
  const pct = ((count / totalQ) * 100).toFixed(1);
  console.log(`  - ${d.padEnd(8)}: ${count} (${pct}%) [Target: Easy ~25%, Med ~50%, Hard ~25%]`);
});

const easyPct = (difficultyCounts.EASY / totalQ) * 100;
const medPct = (difficultyCounts.MEDIUM / totalQ) * 100;
const hardPct = (difficultyCounts.HARD / totalQ) * 100;

if (easyPct < 20 || easyPct > 30) {
  warnings.push(`EASY difficulty percentage (${easyPct.toFixed(1)}%) outside expected 20-30% range.`);
}
if (medPct < 45 || medPct > 55) {
  warnings.push(`MEDIUM difficulty percentage (${medPct.toFixed(1)}%) outside expected 45-55% range.`);
}
if (hardPct < 20 || hardPct > 30) {
  warnings.push(`HARD difficulty percentage (${hardPct.toFixed(1)}%) outside expected 20-30% range.`);
}

console.log(`\nDistinct Subcategories: ${subcategoryMap.size}`);

console.log('\n----------------------------------------------------------------');
console.log(`AUDIT RESULTS: ${errors.length} Errors, ${warnings.length} Warnings`);
console.log('----------------------------------------------------------------');

if (errors.length > 0) {
  console.error('\nCRITICAL ERRORS:');
  errors.slice(0, 20).forEach(e => console.error(`  - ${e}`));
  if (errors.length > 20) {
    console.error(`  ... and ${errors.length - 20} more errors.`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('\nWARNINGS:');
  warnings.slice(0, 10).forEach(w => console.warn(`  - ${w}`));
}

console.log('\n[PASS] ALL PRODUCTION QUESTION BANK VALIDATION CHECKS PASSED SUCCESSFULLY!\n');
process.exit(0);
