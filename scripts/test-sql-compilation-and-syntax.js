import fs from 'fs';

console.log('================================================================');
console.log('SQL PARSING & SYNTAX VERIFICATION: MIGRATION 049');
console.log('================================================================');

const sqlPath = 'supabase/migrations/049_lifafa_payout_fee_escrow.sql';
if (!fs.existsSync(sqlPath)) {
  console.error('FAIL: Migration file not found!');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

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

// 1. Balance of Parentheses, Brackets, and Dollar Quotes
let parenCount = 0;
let bracketCount = 0;
let inSingleQuote = false;
let inDollarQuote = false;
let dollarTag = '';

for (let i = 0; i < sql.length; i++) {
  const c = sql[i];
  const next = sql[i + 1] || '';

  if (!inSingleQuote && !inDollarQuote && c === '-' && next === '-') {
    // Single line comment, skip to end of line
    while (i < sql.length && sql[i] !== '\n') i++;
    continue;
  }

  if (!inSingleQuote && !inDollarQuote && c === '/' && next === '*') {
    // Multi line comment, skip to */
    i += 2;
    while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
    i++;
    continue;
  }

  if (!inDollarQuote && c === "'") {
    if (inSingleQuote && next === "'") {
      i++; // escaped quote ''
    } else {
      inSingleQuote = !inSingleQuote;
    }
    continue;
  }

  if (!inSingleQuote && c === '$') {
    // Check dollar quote
    const rest = sql.substring(i);
    const match = rest.match(/^\$([a-zA-Z0-9_]*)\$/);
    if (match) {
      const tag = match[0];
      if (inDollarQuote && tag === dollarTag) {
        inDollarQuote = false;
        dollarTag = '';
      } else if (!inDollarQuote) {
        inDollarQuote = true;
        dollarTag = tag;
      }
      i += tag.length - 1;
      continue;
    }
  }

  if (!inSingleQuote && !inDollarQuote) {
    if (c === '(') parenCount++;
    else if (c === ')') parenCount--;
    else if (c === '[') bracketCount++;
    else if (c === ']') bracketCount--;
  }
}

assert(parenCount === 0, `Parentheses are perfectly balanced (diff: ${parenCount})`);
assert(bracketCount === 0, `Square brackets are perfectly balanced (diff: ${bracketCount})`);
assert(!inSingleQuote, 'All single quotes are closed');
assert(!inDollarQuote, 'All dollar quotes are closed');

// 2. Function Definitions
const expectedFunctions = [
  'public.get_lifafa_payout_fee',
  'public.create_lifafa_rpc',
  'public.claim_lifafa_rpc',
  'public.refund_expired_or_cancelled_lifafa_rpc'
];

expectedFunctions.forEach(fn => {
  assert(sql.includes(`CREATE OR REPLACE FUNCTION ${fn}`), `Defines ${fn}`);
});

// 3. Search Paths and Security Definer
const secDefinerCount = (sql.match(/SECURITY DEFINER/g) || []).length;
assert(secDefinerCount >= 3, `Functions marked SECURITY DEFINER (${secDefinerCount})`);

const searchPathCount = (sql.match(/SET search_path/gi) || []).length;
assert(searchPathCount >= 3, `Functions set safe search_path (${searchPathCount})`);

// 4. Exact Parameter Signatures
// create_lifafa_rpc
const createLifafaRegex = /CREATE OR REPLACE FUNCTION public\.create_lifafa_rpc\s*\(([\s\S]*?)\)\s*RETURNS\s+jsonb/i;
const createMatch = sql.match(createLifafaRegex);
assert(createMatch !== null, 'create_lifafa_rpc signature parsed');
if (createMatch) {
  const params = createMatch[1].split(',\n').map(p => p.trim());
  assert(params.length === 18, `create_lifafa_rpc has 18 parameters (found ${params.length})`);
  assert(params[0].startsWith('p_title'), 'Param 1: p_title');
  assert(params[17].startsWith('p_payout_mode'), 'Param 18: p_payout_mode');
}

// claim_lifafa_rpc
const claimLifafaRegex = /CREATE OR REPLACE FUNCTION public\.claim_lifafa_rpc\s*\(([\s\S]*?)\)\s*RETURNS\s+jsonb/i;
const claimMatch = sql.match(claimLifafaRegex);
assert(claimMatch !== null, 'claim_lifafa_rpc signature parsed');
if (claimMatch) {
  const params = claimMatch[1].split(',\n').map(p => p.trim());
  assert(params.length === 9, `claim_lifafa_rpc has 9 parameters (found ${params.length})`);
  assert(params[0].startsWith('p_code'), 'Param 1: p_code');
  assert(params[8].startsWith('p_upi_id'), 'Param 9: p_upi_id');
}

// refund_expired_or_cancelled_lifafa_rpc
const refundLifafaRegex = /CREATE OR REPLACE FUNCTION public\.refund_expired_or_cancelled_lifafa_rpc\s*\(([\s\S]*?)\)\s*RETURNS\s+jsonb/i;
const refundMatch = sql.match(refundLifafaRegex);
assert(refundMatch !== null, 'refund_expired_or_cancelled_lifafa_rpc signature parsed');
if (refundMatch) {
  const params = refundMatch[1].split(',\n').map(p => p.trim());
  assert(params.length === 1, `refund_expired_or_cancelled_lifafa_rpc has 1 parameter (found ${params.length})`);
  assert(params[0].startsWith('p_lifafa_id'), 'Param 1: p_lifafa_id');
}

// 5. Verify format(...) in create_lifafa_rpc balance check
assert(
  sql.includes("RAISE EXCEPTION USING MESSAGE = format(") &&
  sql.includes("'Insufficient balance. Available: ₹%s, Required: ₹%s (Prize: ₹%s, Fee: ₹%s)'"),
  'create_lifafa_rpc uses format() for safe parameter interpolation in balance error'
);

// 6. Verify table alterations
assert(sql.includes("ADD COLUMN IF NOT EXISTS total_fee_amount"), 'Adds total_fee_amount column');
assert(sql.includes("ADD COLUMN IF NOT EXISTS remaining_fee_amount"), 'Adds remaining_fee_amount column');

console.log('\n================================================================');
console.log(`PARSING & SYNTAX VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
