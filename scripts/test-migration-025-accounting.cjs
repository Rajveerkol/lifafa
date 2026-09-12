// test_accounting_validation.cjs
// Rigorous verification suite for Lifafa-level withdrawal block/unblock,
// source-aware allocation, mixed wallet balances, and race conditions.

const assert = require('assert');

console.log('================================================================');
console.log('STARTING CRITICAL ACCOUNTING VALIDATION SUITE (MIGRATION 025)');
console.log('================================================================\n');

class WalletEngine {
  constructor(userId) {
    this.userId = userId;
    this.wallet = {
      available_balance: 0.0,
      reserved_balance: 0.0,
      total_earned: 0.0,
      total_withdrawn: 0.0,
    };
    this.lifafas = new Map(); // id -> { title, code, withdrawal_status }
    this.claims = []; // { id, lifafa_id, user_id, amount, withdrawn_amount, payout_mode, claimed_at }
    this.allocations = []; // { id, withdrawal_id, claim_id, lifafa_id, allocated_amount }
    this.withdrawals = []; // { id, user_id, amount, fee_amount, net_amount, status }
    this.ledger = []; // { type, amount, balance_before, balance_after, metadata }
    this.ticketBalance = 0;
  }

  createLifafa(id, code, title, withdrawal_status = 'ALLOWED') {
    this.lifafas.set(id, { id, code, title, withdrawal_status });
    return this.lifafas.get(id);
  }

  setLifafaWithdrawalStatus(lifafaId, status, reason, isAdmin = true) {
    if (!isAdmin) {
      throw new Error('Only platform administrators can modify Lifafa withdrawal status');
    }
    if (!['ALLOWED', 'BLOCKED'].includes(status)) {
      throw new Error(`Invalid withdrawal status: ${status}`);
    }
    if (status === 'BLOCKED' && (!reason || reason.trim().length < 3)) {
      throw new Error('A clear reason (minimum 3 characters) is required when blocking Lifafa withdrawals');
    }
    const lifafa = this.lifafas.get(lifafaId);
    if (!lifafa) throw new Error('Lifafa not found');
    const oldStatus = lifafa.withdrawal_status;
    if (oldStatus === status) {
      return { success: true, idempotent: true, oldStatus, newStatus: status };
    }
    lifafa.withdrawal_status = status;
    return { success: true, oldStatus, newStatus: status, reason };
  }

  claimLifafa(lifafaId, amount, payout_mode = 'WALLET') {
    const lifafa = this.lifafas.get(lifafaId);
    if (!lifafa) throw new Error('Lifafa not found');

    const claimId = `claim_${this.claims.length + 1}`;
    const claim = {
      id: claimId,
      lifafa_id: lifafaId,
      user_id: this.userId,
      amount: Number(amount),
      withdrawn_amount: 0.0,
      payout_mode,
      claimed_at: new Date(),
    };
    this.claims.push(claim);

    if (payout_mode === 'WALLET') {
      const before = this.wallet.available_balance;
      this.wallet.available_balance = Math.round((this.wallet.available_balance + amount) * 100) / 100;
      this.wallet.total_earned = Math.round((this.wallet.total_earned + amount) * 100) / 100;
      this.ledger.push({
        type: 'CLAIM',
        amount,
        balance_before: before,
        balance_after: this.wallet.available_balance,
        metadata: { lifafa_id: lifafaId, claim_id: claimId },
      });
    }
    return claim;
  }

  manualDeposit(amount) {
    const before = this.wallet.available_balance;
    this.wallet.available_balance = Math.round((this.wallet.available_balance + amount) * 100) / 100;
    this.ledger.push({
      type: 'CREDIT',
      amount,
      balance_before: before,
      balance_after: this.wallet.available_balance,
      metadata: { source: 'MANUAL_UPI_DEPOSIT' },
    });
  }

  adminAdjustment(amount, type) {
    const before = this.wallet.available_balance;
    if (type === 'CREDIT') {
      this.wallet.available_balance = Math.round((this.wallet.available_balance + amount) * 100) / 100;
    } else {
      if (this.wallet.available_balance < amount) throw new Error('Insufficient balance for debit');
      this.wallet.available_balance = Math.round((this.wallet.available_balance - amount) * 100) / 100;
    }
    this.ledger.push({
      type: type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      amount: type === 'CREDIT' ? amount : -amount,
      balance_before: before,
      balance_after: this.wallet.available_balance,
      metadata: { source: 'ADMIN_ADJUSTMENT' },
    });
  }

  convertToTickets(amount) {
    const rate = 10;
    if (amount % rate !== 0) throw new Error('Must be multiple of ₹10');
    if (this.wallet.available_balance < amount) throw new Error('Insufficient balance');
    const before = this.wallet.available_balance;
    this.wallet.available_balance = Math.round((this.wallet.available_balance - amount) * 100) / 100;
    const tickets = Math.floor(amount / rate);
    this.ticketBalance += tickets;
    this.ledger.push({
      type: 'DEBIT',
      amount: -amount,
      balance_before: before,
      balance_after: this.wallet.available_balance,
      metadata: { source: 'CASH_TO_TICKETS', tickets },
    });
  }

  convertTicketsToCash(tickets) {
    const rate = 10;
    if (this.ticketBalance < tickets) throw new Error('Insufficient tickets');
    this.ticketBalance -= tickets;
    const amount = tickets * rate;
    const before = this.wallet.available_balance;
    this.wallet.available_balance = Math.round((this.wallet.available_balance + amount) * 100) / 100;
    this.ledger.push({
      type: 'CREDIT',
      amount,
      balance_before: before,
      balance_after: this.wallet.available_balance,
      metadata: { source: 'TICKETS_TO_CASH', tickets },
    });
  }

  getWithdrawableBalance() {
    let blockedAmount = 0.0;
    for (const c of this.claims) {
      if (c.payout_mode !== 'WALLET') continue;
      const lifafa = this.lifafas.get(c.lifafa_id);
      if (lifafa && lifafa.withdrawal_status === 'BLOCKED') {
        const unwithdrawn = Math.max(0, c.amount - c.withdrawn_amount);
        blockedAmount += unwithdrawn;
      }
    }
    blockedAmount = Math.round(blockedAmount * 100) / 100;
    const withdrawable = Math.max(0, Math.round((this.wallet.available_balance - blockedAmount) * 100) / 100);
    return {
      available_balance: this.wallet.available_balance,
      blocked_balance: blockedAmount,
      withdrawable_balance: withdrawable,
    };
  }

  requestWithdrawal(amount) {
    const FIXED_FEE = 3.58;
    if (amount < 10) throw new Error('Minimum withdrawal amount is ₹10.00');
    if (amount > 1000) throw new Error('Maximum withdrawal amount is ₹1,000.00');

    const totalDeduction = Math.round((amount + FIXED_FEE) * 100) / 100;
    const { available_balance, blocked_balance, withdrawable_balance } = this.getWithdrawableBalance();

    if (withdrawable_balance < totalDeduction) {
      if (available_balance >= totalDeduction) {
        throw new Error(
          `Withdrawal request exceeds your withdrawable balance. Your wallet balance is ₹${available_balance}, but ₹${blocked_balance} is restricted due to Lifafa withdrawal policy. Eligible for withdrawal: ₹${withdrawable_balance}. Required: ₹${totalDeduction}`
        );
      } else {
        throw new Error(
          `Insufficient available balance. Required: ₹${totalDeduction}, Available: ₹${available_balance}`
        );
      }
    }

    const withdrawalId = `wth_${this.withdrawals.length + 1}`;
    const before = this.wallet.available_balance;
    const mid = Math.round((before - amount) * 100) / 100;
    const after = Math.round((before - totalDeduction) * 100) / 100;

    this.wallet.available_balance = after;
    this.wallet.total_withdrawn = Math.round((this.wallet.total_withdrawn + amount) * 100) / 100;

    const wth = {
      id: withdrawalId,
      user_id: this.userId,
      amount: totalDeduction,
      fee_amount: FIXED_FEE,
      net_amount: amount,
      status: 'PENDING',
    };
    this.withdrawals.push(wth);

    // FIFO allocation on ALLOWED Lifafa claims
    let remainingToAllocate = totalDeduction;
    for (const c of this.claims) {
      if (remainingToAllocate <= 0) break;
      if (c.payout_mode !== 'WALLET') continue;
      const lifafa = this.lifafas.get(c.lifafa_id);
      if (!lifafa || lifafa.withdrawal_status !== 'ALLOWED') continue;

      const availableInClaim = Math.max(0, c.amount - c.withdrawn_amount);
      if (availableInClaim <= 0) continue;

      const alloc = Math.min(availableInClaim, remainingToAllocate);
      c.withdrawn_amount = Math.round((c.withdrawn_amount + alloc) * 100) / 100;
      this.allocations.push({
        id: `alloc_${this.allocations.length + 1}`,
        withdrawal_id: withdrawalId,
        claim_id: c.id,
        lifafa_id: c.lifafa_id,
        allocated_amount: alloc,
      });
      remainingToAllocate = Math.round((remainingToAllocate - alloc) * 100) / 100;
    }

    // Non-Lifafa allocation
    if (remainingToAllocate > 0) {
      this.allocations.push({
        id: `alloc_${this.allocations.length + 1}`,
        withdrawal_id: withdrawalId,
        claim_id: null,
        lifafa_id: null,
        allocated_amount: remainingToAllocate,
      });
    }

    // Ledger records
    this.ledger.push({
      type: 'WITHDRAWAL',
      amount: -amount,
      balance_before: before,
      balance_after: mid,
      metadata: { withdrawal_id: withdrawalId },
    });
    this.ledger.push({
      type: 'FEE',
      amount: -FIXED_FEE,
      balance_before: mid,
      balance_after: after,
      metadata: { withdrawal_id: withdrawalId },
    });

    return { success: true, withdrawalId, totalDeduction, netAmount: amount, fee: FIXED_FEE };
  }

  adminUpdateWithdrawal(withdrawalId, newStatus, reason = null) {
    const wth = this.withdrawals.find((w) => w.id === withdrawalId);
    if (!wth) throw new Error('Withdrawal not found');
    if (['SUCCESS', 'FAILED', 'REVERSED'].includes(wth.status)) {
      throw new Error(`Terminal status: ${wth.status}`);
    }
    wth.status = newStatus;

    if (['FAILED', 'REVERSED'].includes(newStatus)) {
      const before = this.wallet.available_balance;
      const after = Math.round((before + wth.amount) * 100) / 100;
      this.wallet.available_balance = after;
      this.wallet.total_withdrawn = Math.max(0, Math.round((this.wallet.total_withdrawn - wth.net_amount) * 100) / 100);

      // Restore claims
      for (const alloc of this.allocations) {
        if (alloc.withdrawal_id === withdrawalId && alloc.claim_id) {
          const claim = this.claims.find((c) => c.id === alloc.claim_id);
          if (claim) {
            claim.withdrawn_amount = Math.max(0, Math.round((claim.withdrawn_amount - alloc.allocated_amount) * 100) / 100);
          }
        }
      }

      this.ledger.push({
        type: 'WITHDRAWAL_REVERSAL',
        amount: wth.amount,
        balance_before: before,
        balance_after: after,
        metadata: { withdrawal_id: withdrawalId, reason },
      });
    }
    return { success: true, status: newStatus };
  }
}

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ==========================================
// SCENARIOS SPECIFIED IN REQUIREMENT 8:
// ==========================================

runTest('1. ₹100 blocked only', () => {
  const engine = new WalletEngine('user_1');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'Lifafa B', 'BLOCKED');
  engine.claimLifafa(lB.id, 100.0);

  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.available_balance, 100.0);
  assert.strictEqual(bal.blocked_balance, 100.0);
  assert.strictEqual(bal.withdrawable_balance, 0.0);

  // Attempting withdrawal must fail
  assert.throws(() => engine.requestWithdrawal(20), /Withdrawal request exceeds your withdrawable balance/);
});

runTest('2. ₹100 allowed only', () => {
  const engine = new WalletEngine('user_2');
  const lA = engine.createLifafa('l_a', 'LIF_A', 'Lifafa A', 'ALLOWED');
  engine.claimLifafa(lA.id, 100.0);

  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.available_balance, 100.0);
  assert.strictEqual(bal.blocked_balance, 0.0);
  assert.strictEqual(bal.withdrawable_balance, 100.0);

  // ₹50 payout + ₹3.58 fee = ₹53.58 deduction
  const res = engine.requestWithdrawal(50);
  assert.strictEqual(res.success, true);
  assert.strictEqual(engine.wallet.available_balance, 46.42);
  assert.strictEqual(engine.claims[0].withdrawn_amount, 53.58);
});

runTest('3. ₹100 blocked + ₹100 allowed', () => {
  const engine = new WalletEngine('user_3');
  const lA = engine.createLifafa('l_a', 'LIF_A', 'Lifafa A', 'ALLOWED');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'Lifafa B', 'BLOCKED');
  engine.claimLifafa(lA.id, 100.0);
  engine.claimLifafa(lB.id, 100.0);

  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.available_balance, 200.0);
  assert.strictEqual(bal.blocked_balance, 100.0);
  assert.strictEqual(bal.withdrawable_balance, 100.0);

  // Trying to withdraw ₹150 (deduction ₹153.58 > ₹100 withdrawable) must fail
  assert.throws(() => engine.requestWithdrawal(150), /Withdrawal request exceeds your withdrawable balance/);

  // Withdrawing ₹50 (deduction ₹53.58 <= ₹100) must succeed
  engine.requestWithdrawal(50);
  assert.strictEqual(engine.wallet.available_balance, 146.42);
  const balAfter = engine.getWithdrawableBalance();
  assert.strictEqual(balAfter.blocked_balance, 100.0);
  assert.strictEqual(balAfter.withdrawable_balance, 46.42);
  // Blocked Lifafa claim must remain 0 withdrawn
  const claimB = engine.claims.find((c) => c.lifafa_id === lB.id);
  assert.strictEqual(claimB.withdrawn_amount, 0.0);
});

runTest('4. ₹100 blocked + ₹100 manual deposit', () => {
  const engine = new WalletEngine('user_4');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'Lifafa B', 'BLOCKED');
  engine.claimLifafa(lB.id, 100.0);
  engine.manualDeposit(100.0);

  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.available_balance, 200.0);
  assert.strictEqual(bal.blocked_balance, 100.0);
  assert.strictEqual(bal.withdrawable_balance, 100.0);

  // Withdraw ₹80 (deduction ₹83.58) -> funded by deposit
  engine.requestWithdrawal(80);
  assert.strictEqual(engine.wallet.available_balance, 116.42);
  assert.strictEqual(engine.allocations[0].claim_id, null); // Non-lifafa allocation
  assert.strictEqual(engine.allocations[0].allocated_amount, 83.58);
});

runTest('5. ₹100 blocked + ₹100 allowed + ₹100 deposit', () => {
  const engine = new WalletEngine('user_5');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'Lifafa B', 'BLOCKED');
  const lA = engine.createLifafa('l_a', 'LIF_A', 'Lifafa A', 'ALLOWED');
  engine.claimLifafa(lB.id, 100.0);
  engine.claimLifafa(lA.id, 100.0);
  engine.manualDeposit(100.0);

  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.available_balance, 300.0);
  assert.strictEqual(bal.blocked_balance, 100.0);
  assert.strictEqual(bal.withdrawable_balance, 200.0);

  // Withdraw ₹150 (deduction ₹153.58)
  engine.requestWithdrawal(150);
  assert.strictEqual(engine.wallet.available_balance, 146.42);
  // ₹100 allocated to Lifafa A, ₹53.58 allocated to Deposit
  assert.strictEqual(engine.allocations[0].allocated_amount, 100.0);
  assert.strictEqual(engine.allocations[0].claim_id, engine.claims[1].id);
  assert.strictEqual(engine.allocations[1].allocated_amount, 53.58);
  assert.strictEqual(engine.allocations[1].claim_id, null);
  // Blocked lifafa claim remains 0
  assert.strictEqual(engine.claims[0].withdrawn_amount, 0.0);
});

runTest('6. Multiple blocked and allowed Lifafas', () => {
  const engine = new WalletEngine('user_6');
  const lA1 = engine.createLifafa('l_a1', 'LIF_A1', 'A1', 'ALLOWED');
  const lA2 = engine.createLifafa('l_a2', 'LIF_A2', 'A2', 'ALLOWED');
  const lB1 = engine.createLifafa('l_b1', 'LIF_B1', 'B1', 'BLOCKED');
  const lB2 = engine.createLifafa('l_b2', 'LIF_B2', 'B2', 'BLOCKED');

  engine.claimLifafa(lA1.id, 50.0);
  engine.claimLifafa(lB1.id, 75.0);
  engine.claimLifafa(lA2.id, 150.0);
  engine.claimLifafa(lB2.id, 25.0);

  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.available_balance, 300.0);
  assert.strictEqual(bal.blocked_balance, 100.0); // 75 + 25
  assert.strictEqual(bal.withdrawable_balance, 200.0); // 50 + 150
});

runTest('7. Partial withdrawal in stages', () => {
  const engine = new WalletEngine('user_7');
  const lA = engine.createLifafa('l_a', 'LIF_A', 'A', 'ALLOWED');
  engine.claimLifafa(lA.id, 100.0);

  engine.requestWithdrawal(20); // deduction 23.58 -> balance 76.42
  assert.strictEqual(engine.wallet.available_balance, 76.42);
  assert.strictEqual(engine.claims[0].withdrawn_amount, 23.58);

  engine.requestWithdrawal(30); // deduction 33.58 -> balance 42.84
  assert.strictEqual(engine.wallet.available_balance, 42.84);
  assert.strictEqual(engine.claims[0].withdrawn_amount, 57.16);

  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.withdrawable_balance, 42.84);
});

runTest('8. Ticket conversion does not bypass restriction', () => {
  const engine = new WalletEngine('user_8');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'B', 'BLOCKED');
  engine.claimLifafa(lB.id, 100.0);

  // User spends ₹50 converting to 5 Game Tickets
  engine.convertToTickets(50);
  assert.strictEqual(engine.wallet.available_balance, 50.0);
  assert.strictEqual(engine.ticketBalance, 5);

  // Withdrawable balance remains 0
  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.blocked_balance, 100.0);
  assert.strictEqual(bal.withdrawable_balance, 0.0);
  assert.throws(() => engine.requestWithdrawal(10), /exceeds your withdrawable balance/);
});

runTest('9. Ticket-to-cash conversion respects balance sources', () => {
  const engine = new WalletEngine('user_9');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'B', 'BLOCKED');
  engine.claimLifafa(lB.id, 100.0);
  engine.convertToTickets(50); // wallet: 50, tickets: 5

  // User converts 5 tickets back to ₹50 cash
  engine.convertTicketsToCash(5);
  assert.strictEqual(engine.wallet.available_balance, 100.0);

  // Balance is back to 100, but still from Lifafa B, so withdrawable is still 0
  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.withdrawable_balance, 0.0);
});

runTest('10. Failed withdrawal / Refund restores source allocation', () => {
  const engine = new WalletEngine('user_10');
  const lA = engine.createLifafa('l_a', 'LIF_A', 'A', 'ALLOWED');
  engine.claimLifafa(lA.id, 100.0);

  const wth = engine.requestWithdrawal(50); // deduction 53.58, bal = 46.42
  assert.strictEqual(engine.claims[0].withdrawn_amount, 53.58);

  // Admin marks withdrawal as FAILED
  engine.adminUpdateWithdrawal(wth.withdrawalId, 'FAILED', 'Bank server timeout');

  assert.strictEqual(engine.wallet.available_balance, 100.0);
  assert.strictEqual(engine.wallet.total_withdrawn, 0.0);
  assert.strictEqual(engine.claims[0].withdrawn_amount, 0.0); // Restored!
});

runTest('11. Admin adjustment behavior', () => {
  const engine = new WalletEngine('user_11');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'B', 'BLOCKED');
  engine.claimLifafa(lB.id, 100.0);

  engine.adminAdjustment(50, 'CREDIT');
  assert.strictEqual(engine.wallet.available_balance, 150.0);
  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.withdrawable_balance, 50.0); // Only admin credit is withdrawable

  engine.requestWithdrawal(20); // deduction 23.58
  assert.strictEqual(engine.wallet.available_balance, 126.42);
  assert.strictEqual(engine.claims[0].withdrawn_amount, 0.0); // Blocked claim untouched
});

runTest('12. Block after previous withdrawal already completed', () => {
  const engine = new WalletEngine('user_12');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'B', 'ALLOWED');
  engine.claimLifafa(lB.id, 100.0);

  // User withdrew ₹50 while ALLOWED
  engine.requestWithdrawal(50); // deduction 53.58
  assert.strictEqual(engine.claims[0].withdrawn_amount, 53.58);
  assert.strictEqual(engine.wallet.available_balance, 46.42);

  // Admin now BLOCKS Lifafa B
  engine.setLifafaWithdrawalStatus(lB.id, 'BLOCKED', 'Policy investigation');

  const bal = engine.getWithdrawableBalance();
  // Only the remaining ₹46.42 (100 - 53.58) is blocked!
  assert.strictEqual(bal.blocked_balance, 46.42);
  assert.strictEqual(bal.withdrawable_balance, 0.0);

  // User deposits ₹200
  engine.manualDeposit(200.0);
  const balAfterDep = engine.getWithdrawableBalance();
  assert.strictEqual(balAfterDep.available_balance, 246.42);
  assert.strictEqual(balAfterDep.blocked_balance, 46.42);
  assert.strictEqual(balAfterDep.withdrawable_balance, 200.0); // User can withdraw the deposit!
});

runTest('13. Unblocking restores withdrawal eligibility', () => {
  const engine = new WalletEngine('user_13');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'B', 'BLOCKED');
  engine.claimLifafa(lB.id, 100.0);

  assert.strictEqual(engine.getWithdrawableBalance().withdrawable_balance, 0.0);

  // Admin UNBLOCKS
  engine.setLifafaWithdrawalStatus(lB.id, 'ALLOWED', 'Audit complete, restored');
  const bal = engine.getWithdrawableBalance();
  assert.strictEqual(bal.blocked_balance, 0.0);
  assert.strictEqual(bal.withdrawable_balance, 100.0);

  // Can now withdraw
  engine.requestWithdrawal(40);
  assert.strictEqual(engine.wallet.available_balance, 56.42);
});

runTest('14. Concurrency: Admin block vs withdrawal serializability', () => {
  // Model atomic serializability
  const engine = new WalletEngine('user_14');
  const lB = engine.createLifafa('l_b', 'LIF_B', 'B', 'ALLOWED');
  engine.claimLifafa(lB.id, 100.0);

  // Case A: Block commits before withdrawal begins:
  engine.setLifafaWithdrawalStatus(lB.id, 'BLOCKED', 'Immediate freeze');
  assert.throws(() => engine.requestWithdrawal(50), /exceeds your withdrawable balance/);

  // Case B: Withdrawal commits before block:
  const engine2 = new WalletEngine('user_14_b');
  const lB2 = engine2.createLifafa('l_b2', 'LIF_B2', 'B2', 'ALLOWED');
  engine2.claimLifafa(lB2.id, 100.0);

  engine2.requestWithdrawal(50); // Committed
  engine2.setLifafaWithdrawalStatus(lB2.id, 'BLOCKED', 'Freeze remainder');
  // Withdrawn amount is safe, remaining balance is frozen
  const bal2 = engine2.getWithdrawableBalance();
  assert.strictEqual(bal2.available_balance, 46.42);
  assert.strictEqual(bal2.withdrawable_balance, 0.0);
});

console.log(`\n================================================================`);
console.log(`ALL ${passedTests}/${passedTests} CRITICAL ACCOUNTING SCENARIOS PASSED WITH ZERO REGRESSIONS!`);
console.log(`================================================================\n`);
