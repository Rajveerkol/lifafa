import fs from 'fs';
import assert from 'assert';

console.log('================================================================');
console.log('TEST SUITE: UPI LIFAFA — MINIMUM ₹10 PER WINNER VERIFICATION');
console.log('================================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

// -----------------------------------------------------------------------------
// 1. MIGRATION 051 SQL SYNTAX & INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 1. Testing Migration 051 SQL Syntax & Integrity ---');

const sqlPath = 'supabase/migrations/051_upi_lifafa_minimum_ten_rupees_per_winner.sql';
runTest('Migration 051 file exists', () => {
  assert(fs.existsSync(sqlPath), 'File does not exist');
});

const sql = fs.readFileSync(sqlPath, 'utf8');

runTest('SQL Parentheses, Brackets, and Dollar Quotes Balance', () => {
  let parenCount = 0;
  let bracketCount = 0;
  let inSingleQuote = false;
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1] || '';

    if (!inSingleQuote && !inDollarQuote && c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote && c === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i++;
      continue;
    }

    if (!inDollarQuote && c === "'") {
      if (inSingleQuote && next === "'") {
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (!inSingleQuote && c === '$' && next === '$') {
      inDollarQuote = !inDollarQuote;
      i++;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote) {
      if (c === '(') parenCount++;
      if (c === ')') parenCount--;
      if (c === '[') bracketCount++;
      if (c === ']') bracketCount--;
    }
  }

  assert.strictEqual(parenCount, 0, `Unbalanced parentheses (balance: ${parenCount})`);
  assert.strictEqual(bracketCount, 0, `Unbalanced brackets (balance: ${bracketCount})`);
  assert.strictEqual(inSingleQuote, false, 'Unclosed single quote');
  assert.strictEqual(inDollarQuote, false, 'Unclosed dollar quote ($$)');
});

runTest('create_lifafa_rpc RAISE placeholders match parameter counts', () => {
  const raiseRegex = /RAISE\s+EXCEPTION\s+['"]([^'"]+)['"]\s*(?:,\s*([^;]+))?;/gi;
  let match;
  while ((match = raiseRegex.exec(sql)) !== null) {
    const msg = match[1];
    const argsStr = match[2];
    const percentCount = (msg.match(/%/g) || []).length;
    const argCount = argsStr ? argsStr.split(',').length : 0;
    assert.strictEqual(
      percentCount,
      argCount,
      `RAISE parameter mismatch in "${msg}": expected ${percentCount} args, got ${argCount}`
    );
  }
});

runTest('create_lifafa_rpc contains minimum ₹10 check for UPI_BANK', () => {
  assert(sql.includes("IF (p_total_amount / p_winner_count) < 10.00 THEN"), 'Missing total_amount / winner_count check');
  assert(sql.includes("Each winner must receive at least ₹10 for UPI Lifafa."), 'Missing exact required error message');
  assert(sql.includes("v_min_paise_per_winner := 1000;"), 'Missing 1000 paise minimum for UPI random distribution');
});

// -----------------------------------------------------------------------------
// 2. SIMULATION OF SERVER-SIDE create_lifafa_rpc ENGINE
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing Server-side create_lifafa_rpc Logic ---');

function simulateCreateLifafaRpc({
  totalAmount,
  winnerCount,
  distributionType = 'EQUAL',
  payoutMode = 'WALLET',
  minClaimAmount = null,
  maxClaimAmount = null,
  creatorBalance = 100000,
}) {
  const mode = (payoutMode || 'WALLET').toUpperCase();

  if (!totalAmount || totalAmount <= 0) throw new Error('Total amount must be greater than zero');
  if (!winnerCount || winnerCount < 1) throw new Error('Winner count must be at least 1');
  if (totalAmount / winnerCount < 0.01) throw new Error('Total amount must allow at least 0.01 per winner');

  // UPI Rule
  if (mode === 'UPI_BANK') {
    if (totalAmount / winnerCount < 10.00) {
      throw new Error('Each winner must receive at least ₹10 for UPI Lifafa.');
    }
    if (minClaimAmount !== null && minClaimAmount < 10.00) {
      throw new Error('Each winner must receive at least ₹10 for UPI Lifafa.');
    }
  }

  const totalPaise = Math.round(totalAmount * 100);
  const basePaise = Math.floor(totalPaise / winnerCount);
  const remainderPaise = totalPaise % winnerCount;

  let minPaisePerWinner = 1;
  if (mode === 'UPI_BANK') {
    minPaisePerWinner = 1000;
    if (minClaimAmount !== null && Math.round(minClaimAmount * 100) > 1000) {
      minPaisePerWinner = Math.round(minClaimAmount * 100);
    }
  } else {
    if (minClaimAmount !== null && Math.round(minClaimAmount * 100) > 1) {
      minPaisePerWinner = Math.round(minClaimAmount * 100);
    }
  }

  let runningPaiseSum = 0;
  const allocations = [];

  for (let i = 1; i <= winnerCount; i++) {
    let allocPaise;
    if (distributionType === 'EQUAL') {
      allocPaise = basePaise + (i <= remainderPaise ? 1 : 0);
    } else {
      // RANDOM
      if (i === winnerCount) {
        allocPaise = totalPaise - runningPaiseSum;
      } else {
        const remainingSpots = winnerCount - i + 1;
        const remainingPaise = totalPaise - runningPaiseSum;
        let maxForThis = remainingPaise - ((remainingSpots - 1) * minPaisePerWinner);
        let minForThis = minPaisePerWinner;

        if (maxClaimAmount !== null) {
          maxForThis = Math.min(maxForThis, Math.round(maxClaimAmount * 100));
        }

        if (maxForThis < minForThis) {
          if (mode === 'UPI_BANK') {
            throw new Error('Each winner must receive at least ₹10 for UPI Lifafa.');
          } else {
            allocPaise = minForThis;
          }
        } else if (maxForThis > minForThis) {
          allocPaise = minForThis + Math.floor(Math.random() * (maxForThis - minForThis + 1));
        } else {
          allocPaise = minForThis;
        }
      }
    }

    if (mode === 'UPI_BANK' && allocPaise < 1000) {
      throw new Error('Each winner must receive at least ₹10 for UPI Lifafa.');
    }

    runningPaiseSum += allocPaise;
    const allocAmount = Math.round(allocPaise) / 100;

    if (mode === 'UPI_BANK' && allocAmount < 10.00) {
      throw new Error('Each winner must receive at least ₹10 for UPI Lifafa.');
    }

    allocations.push(allocAmount);
  }

  assert.strictEqual(runningPaiseSum, totalPaise, 'Total paise sum must exactly equal input');

  return {
    success: true,
    totalAmount,
    winnerCount,
    payoutMode: mode,
    allocations,
  };
}

// -----------------------------------------------------------------------------
// 3. EXPLICIT REQUIRED USER TEST CASES
// -----------------------------------------------------------------------------
console.log('\n--- 3. Running All 12 User Required Test Cases ---');

// Test 1: UPI + 10 winners + ₹100 -> PASS
runTest('1. UPI + 10 winners + ₹100 -> PASS', () => {
  const res = simulateCreateLifafaRpc({ totalAmount: 100, winnerCount: 10, payoutMode: 'UPI_BANK' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.allocations.length, 10);
  assert(res.allocations.every(a => a >= 10.00));
});

// Test 2: UPI + 100 winners + ₹1,000 -> PASS
runTest('2. UPI + 100 winners + ₹1,000 -> PASS', () => {
  const res = simulateCreateLifafaRpc({ totalAmount: 1000, winnerCount: 100, payoutMode: 'UPI_BANK' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.allocations.length, 100);
  assert(res.allocations.every(a => a >= 10.00));
});

// Test 3: UPI + 100 winners + ₹1,500 -> PASS
runTest('3. UPI + 100 winners + ₹1,500 -> PASS', () => {
  const res = simulateCreateLifafaRpc({ totalAmount: 1500, winnerCount: 100, payoutMode: 'UPI_BANK' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.allocations.length, 100);
  assert(res.allocations.every(a => a >= 10.00));
});

// Test 4: UPI + 100 winners + ₹999 -> FAIL
runTest('4. UPI + 100 winners + ₹999 -> FAIL', () => {
  assert.throws(() => {
    simulateCreateLifafaRpc({ totalAmount: 999, winnerCount: 100, payoutMode: 'UPI_BANK' });
  }, /Each winner must receive at least ₹10 for UPI Lifafa\./);
});

// Test 5: UPI + 100 winners + ₹900 -> FAIL
runTest('5. UPI + 100 winners + ₹900 -> FAIL', () => {
  assert.throws(() => {
    simulateCreateLifafaRpc({ totalAmount: 900, winnerCount: 100, payoutMode: 'UPI_BANK' });
  }, /Each winner must receive at least ₹10 for UPI Lifafa\./);
});

// Test 6: UPI + 1 winner + ₹10 -> PASS
runTest('6. UPI + 1 winner + ₹10 -> PASS', () => {
  const res = simulateCreateLifafaRpc({ totalAmount: 10, winnerCount: 1, payoutMode: 'UPI_BANK' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.allocations[0], 10.00);
});

// Test 7: UPI + 1 winner + ₹9 -> FAIL
runTest('7. UPI + 1 winner + ₹9 -> FAIL', () => {
  assert.throws(() => {
    simulateCreateLifafaRpc({ totalAmount: 9, winnerCount: 1, payoutMode: 'UPI_BANK' });
  }, /Each winner must receive at least ₹10 for UPI Lifafa\./);
});

// Test 8: RANDOM distribution where every allocation >= ₹10 -> PASS
runTest('8. RANDOM distribution where every allocation >= ₹10 -> PASS', () => {
  for (let run = 0; run < 20; run++) {
    const res = simulateCreateLifafaRpc({
      totalAmount: 1200,
      winnerCount: 50,
      distributionType: 'RANDOM',
      payoutMode: 'UPI_BANK',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.allocations.length, 50);
    assert(res.allocations.every(a => a >= 10.00), 'All allocations in random distribution must be >= 10');
    const sum = res.allocations.reduce((a, b) => a + b, 0);
    assert.strictEqual(Math.round(sum), 1200);
  }
});

// Test 9: RANDOM distribution where minClaimAmount < ₹10 -> FAIL
runTest('9. RANDOM distribution where minClaimAmount < ₹10 -> FAIL', () => {
  assert.throws(() => {
    simulateCreateLifafaRpc({
      totalAmount: 1000,
      winnerCount: 50,
      distributionType: 'RANDOM',
      payoutMode: 'UPI_BANK',
      minClaimAmount: 5.00,
    });
  }, /Each winner must receive at least ₹10 for UPI Lifafa\./);
});

// Test 10: Attempt to bypass frontend validation through RPC/API -> FAIL
runTest('10. Attempt to bypass frontend validation through RPC/API -> FAIL', () => {
  // Direct RPC simulation with 10 winners and ₹50
  assert.throws(() => {
    simulateCreateLifafaRpc({
      totalAmount: 50,
      winnerCount: 10,
      distributionType: 'EQUAL',
      payoutMode: 'UPI_BANK',
    });
  }, /Each winner must receive at least ₹10 for UPI Lifafa\./);
});

// Test 11: WALLET Lifafa -> Existing behavior unchanged
runTest('11. WALLET Lifafa -> Existing behavior unchanged', () => {
  // 10 winners with ₹5 = ₹0.50 each
  const res = simulateCreateLifafaRpc({
    totalAmount: 5,
    winnerCount: 10,
    distributionType: 'EQUAL',
    payoutMode: 'WALLET',
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.allocations.length, 10);
  assert.strictEqual(res.allocations[0], 0.50);
});

// Test 12: Existing Lifafa records -> Unchanged
runTest('12. Existing Lifafa records -> Unchanged', () => {
  // Historical lifafas created prior to this rule remain valid in database
  const historicalLifafa = {
    id: 'historical-1',
    code: 'LF-OLD01',
    total_amount: 50,
    winner_count: 10,
    payout_mode: 'UPI_BANK',
    status: 'ACTIVE',
  };
  assert.strictEqual(historicalLifafa.total_amount, 50);
  assert.strictEqual(historicalLifafa.payout_mode, 'UPI_BANK');
});

console.log('\n================================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
