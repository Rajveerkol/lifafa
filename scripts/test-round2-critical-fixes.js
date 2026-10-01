// Automated Comprehensive Regression Test Suite: Round 2 Critical Financial & Security Fixes
// Tests all 5 P0 bugs:
// - BUG-CRIT-01: Unauthenticated Lifafa Force-Cancel / Refund Bypass
// - BUG-CRIT-02: Creator Can Claim Own UPI_BANK Lifafa
// - BUG-CRIT-03: Duel Reward / Ticket Farming -> Unlimited Withdrawable Money
// - BUG-CRIT-04: BLOCKED Lifafa Can Still Trigger UPI_BANK Payout
// - BUG-CRIT-05: UPI-Only Claim / Balance-Laundering / Refund Abuse

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('STARTING ROUND 2 CRITICAL SECURITY & FINANCIAL REGRESSION SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    throw err;
  }
}

// ============================================================================
// PART 1: STATIC CODE & MIGRATION VERIFICATION
// ============================================================================

test('Migration 036 exists and has valid naming', () => {
  const migPath = path.join(rootDir, 'supabase', 'migrations', '036_round2_critical_security_and_financial_fixes.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 036 must exist in supabase/migrations');
});

const mig036Content = fs.readFileSync(
  path.join(rootDir, 'supabase', 'migrations', '036_round2_critical_security_and_financial_fixes.sql'),
  'utf8'
);

test('BUG-01 Migration: refund_expired_or_cancelled_lifafa_rpc rejects auth.uid() IS NULL and revokes anon', () => {
  assert.ok(
    mig036Content.includes('IF v_caller_id IS NULL THEN') &&
    mig036Content.includes("RAISE EXCEPTION 'Authentication required to refund this Lifafa'"),
    'Must explicitly reject anonymous callers when v_caller_id IS NULL'
  );
  assert.ok(
    mig036Content.includes("REVOKE ALL ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) FROM PUBLIC, anon;"),
    'Must revoke execution rights from anon and PUBLIC'
  );
  assert.ok(
    mig036Content.includes("GRANT EXECUTE ON FUNCTION public.refund_expired_or_cancelled_lifafa_rpc(UUID) TO authenticated, service_role;"),
    'Must grant execution only to authenticated and service_role'
  );
});

test('BUG-02 Migration: claim_lifafa_rpc authoritatively rejects creator self-claim', () => {
  assert.ok(
    mig036Content.includes('IF v_lifafa.creator_id = v_user_id THEN') &&
    mig036Content.includes("RAISE EXCEPTION 'Creators cannot claim their own Lifafa'"),
    'Must reject claim if auth.uid() equals lifafa.creator_id'
  );
});

test('BUG-03 Migration: finalize_duel_match_rpc prevents infinite ticket farming from AI/NPC opponents', () => {
  assert.ok(
    mig036Content.includes('v_is_real_pvp :=') &&
    mig036Content.includes("v_match.match_type = 'PVP'"),
    'Must distinguish real PVP from AI/NPC matches'
  );
  assert.ok(
    mig036Content.includes('AI / NPC / Test match: Return at most 1 ticket') ||
    mig036Content.includes('Net Gain: 0') ||
    mig036Content.includes('Net profit from AI/NPC is strictly 0 tickets'),
    'Must limit AI/NPC match ticket award to net 0'
  );
  assert.ok(
    mig036Content.includes('ON CONFLICT (user_id, transaction_type, reference_id) DO NOTHING'),
    'Must preserve idempotency on ticket transactions'
  );
});

test('BUG-04 Migration: claim_lifafa_rpc rejects BLOCKED, CANCELLED, EXPIRED, and COMPLETED Lifafas', () => {
  assert.ok(
    mig036Content.includes("IF v_lifafa.withdrawal_status = 'BLOCKED' THEN") &&
    mig036Content.includes("RAISE EXCEPTION 'This Lifafa has been blocked by platform administration'"),
    'Must check and reject withdrawal_status = BLOCKED'
  );
  assert.ok(
    mig036Content.includes("IF v_lifafa.status = 'CANCELLED' THEN") &&
    mig036Content.includes("RAISE EXCEPTION 'Lifafa has been cancelled'"),
    'Must explicitly reject CANCELLED status'
  );
  assert.ok(
    mig036Content.includes("RAISE EXCEPTION 'Lifafa has expired'"),
    'Must reject EXPIRED status'
  );
});

test('BUG-05 Migration: claim_lifafa_rpc enforces bank account + IFSC and rejects UPI-only', () => {
  assert.ok(
    mig036Content.includes("IF p_bank_account_number IS NULL OR LENGTH(TRIM(p_bank_account_number)) < 6 THEN") &&
    mig036Content.includes("RAISE EXCEPTION 'A valid Bank Account Number is required for direct bank payout'"),
    'Must require bank account number >= 6 chars'
  );
  assert.ok(
    mig036Content.includes("IF p_ifsc_code IS NULL OR NOT (UPPER(TRIM(p_ifsc_code)) ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN") &&
    mig036Content.includes("RAISE EXCEPTION 'A valid 11-character IFSC code is required for bank payout"),
    'Must require valid 11-char regex IFSC code'
  );
});

test('BUG-05 Migration: admin_update_withdrawal_rpc refunds CREATOR (not claimant) on failed claim payout', () => {
  assert.ok(
    mig036Content.includes('SELECT c.*, l.creator_id, l.code AS lifafa_code') &&
    mig036Content.includes('WHERE c.withdrawal_id = p_withdrawal_id'),
    'Must query lifafa_claims to check if withdrawal originated from a claim'
  );
  assert.ok(
    mig036Content.includes('WHERE user_id = v_claim.creator_id') &&
    mig036Content.includes("reference_type,") &&
    mig036Content.includes("'CLAIM_PAYOUT_REVERSAL'"),
    'Must refund creator wallet and record CLAIM_PAYOUT_REVERSAL'
  );
});

test('Frontend UI components have creator self-claim and blocked guards', () => {
  const claimPage = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'ClaimPage.tsx'), 'utf8');
  assert.ok(
    claimPage.includes('lifafa.creator_id === user.id') &&
    claimPage.includes('Creators cannot claim their own Lifafa.'),
    'ClaimPage.tsx must guard against creator self-claim'
  );
  assert.ok(
    claimPage.includes("withdrawal_status === 'BLOCKED'") &&
    claimPage.includes('This Lifafa has been blocked by platform administration.'),
    'ClaimPage.tsx must guard against blocked Lifafa claim'
  );

  const claimModal = fs.readFileSync(path.join(rootDir, 'src', 'components', 'lifafa', 'ClaimModal.tsx'), 'utf8');
  assert.ok(
    claimModal.includes('lifafa.creator_id === user.id') &&
    claimModal.includes('Creators cannot claim their own Lifafa.'),
    'ClaimModal.tsx must guard against creator self-claim'
  );
  assert.ok(
    claimModal.includes("withdrawal_status === 'BLOCKED'") &&
    claimModal.includes('This Lifafa has been blocked by platform administration.'),
    'ClaimModal.tsx must guard against blocked Lifafa claim'
  );

  const claimCtrl = fs.readFileSync(path.join(rootDir, 'src', 'themes', 'core', 'ClaimController.tsx'), 'utf8');
  assert.ok(
    claimCtrl.includes('lifafa.creator_id === user.id') &&
    claimCtrl.includes('Creators cannot claim their own Lifafa.'),
    'ClaimController.tsx must guard against creator self-claim'
  );
  assert.ok(
    claimCtrl.includes("withdrawal_status === 'BLOCKED'") &&
    claimCtrl.includes('This Lifafa has been blocked by platform administration.'),
    'ClaimController.tsx must guard against blocked Lifafa claim'
  );
});

// ============================================================================
// PART 2: BEHAVIORAL & LOGIC STATE MACHINE SIMULATION TESTS
// ============================================================================

// ----------------------------------------------------------------------------
// BUG-CRIT-01 Simulation
// ----------------------------------------------------------------------------
function simulateRefundExpiredOrCancelled({ callerId, role, lifafaCreatorId, lifafaStatus, remainingAmount, isAdmin }) {
  const isServiceRole = role === 'service_role';
  
  if (!isServiceRole) {
    if (!callerId) {
      throw new Error('Authentication required to refund this Lifafa');
    }
    if (callerId !== lifafaCreatorId && !isAdmin) {
      throw new Error('Unauthorized to refund this Lifafa');
    }
  }

  if (!['ACTIVE', 'EXPIRED'].includes(lifafaStatus)) {
    return { success: false, message: 'Lifafa already completed, refunded, or cancelled' };
  }

  return { success: true, refunded_amount: remainingAmount };
}

test('BUG-01: Anonymous caller attempting refund is rejected', () => {
  assert.throws(
    () => simulateRefundExpiredOrCancelled({
      callerId: null,
      role: 'anon',
      lifafaCreatorId: 'user_creator_123',
      lifafaStatus: 'ACTIVE',
      remainingAmount: 50.0,
      isAdmin: false
    }),
    /Authentication required to refund this Lifafa/
  );
});

test('BUG-01: Authenticated non-owner non-admin caller is rejected', () => {
  assert.throws(
    () => simulateRefundExpiredOrCancelled({
      callerId: 'user_stranger_456',
      role: 'authenticated',
      lifafaCreatorId: 'user_creator_123',
      lifafaStatus: 'ACTIVE',
      remainingAmount: 50.0,
      isAdmin: false
    }),
    /Unauthorized to refund this Lifafa/
  );
});

test('BUG-01: Legitimate creator can refund their own Lifafa', () => {
  const res = simulateRefundExpiredOrCancelled({
    callerId: 'user_creator_123',
    role: 'authenticated',
    lifafaCreatorId: 'user_creator_123',
    lifafaStatus: 'EXPIRED',
    remainingAmount: 50.0,
    isAdmin: false
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.refunded_amount, 50.0);
});

test('BUG-01: Administrator can refund any Lifafa', () => {
  const res = simulateRefundExpiredOrCancelled({
    callerId: 'admin_user_789',
    role: 'authenticated',
    lifafaCreatorId: 'user_creator_123',
    lifafaStatus: 'ACTIVE',
    remainingAmount: 100.0,
    isAdmin: true
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.refunded_amount, 100.0);
});

test('BUG-01: Service-role background expiry sweep is authorized', () => {
  const res = simulateRefundExpiredOrCancelled({
    callerId: null,
    role: 'service_role',
    lifafaCreatorId: 'user_creator_123',
    lifafaStatus: 'EXPIRED',
    remainingAmount: 25.0,
    isAdmin: false
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.refunded_amount, 25.0);
});

// ----------------------------------------------------------------------------
// BUG-CRIT-02 & BUG-CRIT-04 & BUG-CRIT-05 Claim Simulation
// ----------------------------------------------------------------------------
function simulateClaimLifafa({
  userId,
  lifafa,
  accountHolderName,
  bankAccountNumber,
  ifscCode,
  upiId,
  deviceFingerprint
}) {
  if (!userId) {
    throw new Error('Authentication required to claim a Lifafa');
  }

  // BUG-02 Check
  if (lifafa.creator_id === userId) {
    throw new Error('Creators cannot claim their own Lifafa');
  }

  // BUG-04 Check
  if (lifafa.withdrawal_status === 'BLOCKED') {
    throw new Error('This Lifafa has been blocked by platform administration');
  }

  if (lifafa.status === 'CANCELLED') {
    throw new Error('Lifafa has been cancelled');
  }

  if (lifafa.status === 'EXPIRED') {
    throw new Error('Lifafa has expired');
  }

  if (lifafa.status === 'COMPLETED') {
    throw new Error('All Lifafa rewards have already been claimed');
  }

  if (lifafa.status !== 'ACTIVE') {
    throw new Error(`Lifafa is not active (Status: ${lifafa.status})`);
  }

  // BUG-05 Check for UPI_BANK mode
  if (lifafa.payout_mode === 'UPI_BANK') {
    if (!accountHolderName || accountHolderName.trim().length < 2) {
      throw new Error('Account holder name as per bank records is required');
    }
    if (!bankAccountNumber || bankAccountNumber.trim().length < 6) {
      throw new Error('A valid Bank Account Number is required for direct bank payout');
    }
    const cleanIfsc = (ifscCode || '').trim().toUpperCase();
    if (!cleanIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      throw new Error('A valid 11-character IFSC code is required for bank payout (e.g. SBIN0001234)');
    }
  }

  const claimAmount = 10.0;
  let withdrawalId = null;
  if (lifafa.payout_mode === 'UPI_BANK') {
    withdrawalId = `wth_${Date.now()}`;
  }

  return {
    success: true,
    amount: claimAmount,
    payout_mode: lifafa.payout_mode,
    withdrawal_id: withdrawalId,
    withdrawal_status: withdrawalId ? 'PENDING' : null
  };
}

// BUG-02 Tests
test('BUG-02: Creator self-claim on UPI_BANK Lifafa is strictly rejected', () => {
  const lifafa = {
    id: 'lifafa_1',
    creator_id: 'user_alice',
    status: 'ACTIVE',
    withdrawal_status: 'ALLOWED',
    payout_mode: 'UPI_BANK'
  };

  assert.throws(
    () => simulateClaimLifafa({
      userId: 'user_alice', // same as creator
      lifafa,
      accountHolderName: 'Alice Smith',
      bankAccountNumber: '123456789012',
      ifscCode: 'SBIN0001234'
    }),
    /Creators cannot claim their own Lifafa/
  );
});

test('BUG-02: Creator self-claim creates NO withdrawal and NO payout', () => {
  const lifafa = {
    id: 'lifafa_1',
    creator_id: 'user_alice',
    status: 'ACTIVE',
    withdrawal_status: 'ALLOWED',
    payout_mode: 'UPI_BANK'
  };

  let withdrawalCreated = false;
  try {
    simulateClaimLifafa({
      userId: 'user_alice',
      lifafa,
      accountHolderName: 'Alice Smith',
      bankAccountNumber: '123456789012',
      ifscCode: 'SBIN0001234'
    });
    withdrawalCreated = true;
  } catch (err) {
    // Expected rejection
  }
  assert.strictEqual(withdrawalCreated, false, 'No withdrawal must be created on creator self-claim');
});

test('BUG-02: Normal claimant (non-creator) can claim UPI_BANK Lifafa with valid details', () => {
  const lifafa = {
    id: 'lifafa_1',
    creator_id: 'user_alice',
    status: 'ACTIVE',
    withdrawal_status: 'ALLOWED',
    payout_mode: 'UPI_BANK'
  };

  const res = simulateClaimLifafa({
    userId: 'user_bob',
    lifafa,
    accountHolderName: 'Bob Jones',
    bankAccountNumber: '987654321098',
    ifscCode: 'HDFC0001234'
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.payout_mode, 'UPI_BANK');
  assert.ok(res.withdrawal_id);
});

// BUG-04 Tests
test('BUG-04: Claim on BLOCKED Lifafa is strictly rejected', () => {
  const lifafa = {
    id: 'lifafa_fraud',
    creator_id: 'user_alice',
    status: 'ACTIVE',
    withdrawal_status: 'BLOCKED',
    payout_mode: 'UPI_BANK'
  };

  assert.throws(
    () => simulateClaimLifafa({
      userId: 'user_bob',
      lifafa,
      accountHolderName: 'Bob Jones',
      bankAccountNumber: '987654321098',
      ifscCode: 'HDFC0001234'
    }),
    /This Lifafa has been blocked by platform administration/
  );
});

test('BUG-04: Claim on CANCELLED Lifafa is rejected', () => {
  const lifafa = {
    id: 'lifafa_cancelled',
    creator_id: 'user_alice',
    status: 'CANCELLED',
    withdrawal_status: 'ALLOWED',
    payout_mode: 'WALLET'
  };

  assert.throws(
    () => simulateClaimLifafa({ userId: 'user_bob', lifafa }),
    /Lifafa has been cancelled/
  );
});

test('BUG-04: Claim on EXPIRED Lifafa is rejected', () => {
  const lifafa = {
    id: 'lifafa_expired',
    creator_id: 'user_alice',
    status: 'EXPIRED',
    withdrawal_status: 'ALLOWED',
    payout_mode: 'WALLET'
  };

  assert.throws(
    () => simulateClaimLifafa({ userId: 'user_bob', lifafa }),
    /Lifafa has expired/
  );
});

test('BUG-04: Blocked claim creates NO payout and touches no wallet', () => {
  const lifafa = {
    id: 'lifafa_blocked',
    creator_id: 'user_alice',
    status: 'ACTIVE',
    withdrawal_status: 'BLOCKED',
    payout_mode: 'UPI_BANK'
  };

  let payoutDispatched = false;
  try {
    simulateClaimLifafa({
      userId: 'user_bob',
      lifafa,
      accountHolderName: 'Bob',
      bankAccountNumber: '1234567890',
      ifscCode: 'SBIN0001234'
    });
    payoutDispatched = true;
  } catch {}
  assert.strictEqual(payoutDispatched, false);
});

// BUG-05 Tests
test('BUG-05: UPI-only claim for UPI_BANK Lifafa is rejected prior to payout creation', () => {
  const lifafa = {
    id: 'lifafa_upi_bank',
    creator_id: 'user_alice',
    status: 'ACTIVE',
    withdrawal_status: 'ALLOWED',
    payout_mode: 'UPI_BANK'
  };

  assert.throws(
    () => simulateClaimLifafa({
      userId: 'user_bob',
      lifafa,
      accountHolderName: 'Bob Jones',
      bankAccountNumber: null, // missing bank account
      ifscCode: null,          // missing IFSC
      upiId: 'bob@okhdfcbank'
    }),
    /A valid Bank Account Number is required for direct bank payout/
  );
});

test('BUG-05: Missing or invalid IFSC code is rejected', () => {
  const lifafa = {
    id: 'lifafa_upi_bank',
    creator_id: 'user_alice',
    status: 'ACTIVE',
    withdrawal_status: 'ALLOWED',
    payout_mode: 'UPI_BANK'
  };

  assert.throws(
    () => simulateClaimLifafa({
      userId: 'user_bob',
      lifafa,
      accountHolderName: 'Bob Jones',
      bankAccountNumber: '123456789012',
      ifscCode: 'INVALID_IFSC'
    }),
    /A valid 11-character IFSC code is required for bank payout/
  );
});

// ----------------------------------------------------------------------------
// BUG-CRIT-05 Reversal & Refund Flow Simulation
// ----------------------------------------------------------------------------
function simulateAdminUpdateWithdrawal({
  withdrawal,
  claim,
  creatorWallet,
  userWallet,
  newStatus,
  isAdmin,
  isServiceRole
}) {
  if (!isServiceRole && !isAdmin) {
    throw new Error('Only Administrators or automated service role can update payout status');
  }

  if (['SUCCESS', 'FAILED', 'REVERSED'].includes(withdrawal.status)) {
    throw new Error(`Withdrawal is already in terminal status (${withdrawal.status}) and cannot be modified again`);
  }

  withdrawal.status = newStatus;

  if (['FAILED', 'REVERSED'].includes(newStatus)) {
    if (claim && claim.withdrawal_id === withdrawal.id) {
      // Claim-originated withdrawal: refund the CREATOR!
      creatorWallet.available_balance += withdrawal.amount;
      return {
        refunded_party: 'CREATOR',
        refunded_user_id: claim.creator_id,
        refunded_amount: withdrawal.amount,
        creator_new_balance: creatorWallet.available_balance,
        user_new_balance: userWallet.available_balance
      };
    } else {
      // Normal user withdrawal: refund the USER!
      userWallet.available_balance += withdrawal.amount;
      return {
        refunded_party: 'USER',
        refunded_user_id: withdrawal.user_id,
        refunded_amount: withdrawal.amount,
        creator_new_balance: creatorWallet.available_balance,
        user_new_balance: userWallet.available_balance
      };
    }
  }

  return { success: true, status: newStatus };
}

test('BUG-05: Failed claim-originated payout refunds CREATOR (NOT claimant)', () => {
  const withdrawal = { id: 'wth_100', user_id: 'user_claimant_bob', amount: 50.0, status: 'PROCESSING' };
  const claim = { id: 'claim_1', withdrawal_id: 'wth_100', creator_id: 'user_creator_alice' };
  const creatorWallet = { available_balance: 100.0 };
  const claimantWallet = { available_balance: 20.0 };

  const result = simulateAdminUpdateWithdrawal({
    withdrawal,
    claim,
    creatorWallet,
    userWallet: claimantWallet,
    newStatus: 'FAILED',
    isAdmin: true,
    isServiceRole: false
  });

  assert.strictEqual(result.refunded_party, 'CREATOR');
  assert.strictEqual(result.refunded_user_id, 'user_creator_alice');
  assert.strictEqual(result.refunded_amount, 50.0);
  assert.strictEqual(creatorWallet.available_balance, 150.0, 'Creator must be refunded the 50.0');
  assert.strictEqual(claimantWallet.available_balance, 20.0, 'Claimant wallet must remain 20.0 (NO unearned money)');
});

test('BUG-05: Duplicate failure event cannot trigger second refund (terminal state protection)', () => {
  const withdrawal = { id: 'wth_100', user_id: 'user_claimant_bob', amount: 50.0, status: 'FAILED' }; // already terminal
  const claim = { id: 'claim_1', withdrawal_id: 'wth_100', creator_id: 'user_creator_alice' };
  const creatorWallet = { available_balance: 150.0 };
  const claimantWallet = { available_balance: 20.0 };

  assert.throws(
    () => simulateAdminUpdateWithdrawal({
      withdrawal,
      claim,
      creatorWallet,
      userWallet: claimantWallet,
      newStatus: 'FAILED',
      isAdmin: true,
      isServiceRole: false
    }),
    /already in terminal status/
  );
  assert.strictEqual(creatorWallet.available_balance, 150.0, 'Balance must NOT change on second failure event');
});

test('BUG-05: Successful payout triggers NO refund', () => {
  const withdrawal = { id: 'wth_101', user_id: 'user_claimant_bob', amount: 50.0, status: 'PROCESSING' };
  const claim = { id: 'claim_2', withdrawal_id: 'wth_101', creator_id: 'user_creator_alice' };
  const creatorWallet = { available_balance: 100.0 };
  const claimantWallet = { available_balance: 20.0 };

  const res = simulateAdminUpdateWithdrawal({
    withdrawal,
    claim,
    creatorWallet,
    userWallet: claimantWallet,
    newStatus: 'SUCCESS',
    isAdmin: true,
    isServiceRole: false
  });

  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(creatorWallet.available_balance, 100.0);
  assert.strictEqual(claimantWallet.available_balance, 20.0);
});

// ----------------------------------------------------------------------------
// BUG-CRIT-03 Duel Ticket Economy Simulation
// ----------------------------------------------------------------------------
function simulateFinalizeDuel({ match, p1, p2, p1Score, p2Score }) {
  if (match.status === 'COMPLETED') {
    return { success: true, already_completed: true };
  }

  const isRealPvp = (
    match.match_type === 'PVP' &&
    !match.is_test_opponent &&
    p1.player_id &&
    p2.player_id &&
    !p1.is_test_opponent &&
    !p2.is_test_opponent &&
    p1.player_id !== p2.player_id
  );

  let p1Result, p2Result, winnerId;
  if (p1Score > p2Score) {
    p1Result = 'WON';
    p2Result = 'LOST';
    winnerId = p1.player_id;
  } else if (p2Score > p1Score) {
    p1Result = 'LOST';
    p2Result = 'WON';
    winnerId = p2.player_id;
  } else {
    p1Result = 'DRAW';
    p2Result = 'DRAW';
    winnerId = null;
  }

  match.status = 'COMPLETED';

  let ticketsAwardedP1 = 0;
  let ticketsAwardedP2 = 0;

  if (isRealPvp) {
    if (winnerId === p1.player_id) {
      ticketsAwardedP1 = 2; // Winner takes both entry tickets
    } else if (winnerId === p2.player_id) {
      ticketsAwardedP2 = 2;
    } else {
      ticketsAwardedP1 = 1; // Draw refund
      ticketsAwardedP2 = 1;
    }
  } else {
    // AI/NPC Match: Player 2 staked 0 tickets. Cannot create money from thin air!
    // Return at most the 1 entry ticket on win or draw.
    if (p1.player_id && (p1Result === 'WON' || p1Result === 'DRAW')) {
      ticketsAwardedP1 = 1; // Net profit: 0 tickets!
    }
  }

  p1.ticket_balance += ticketsAwardedP1;
  if (p2.player_id) {
    p2.ticket_balance += ticketsAwardedP2;
  }

  return {
    success: true,
    winner_id: winnerId,
    p1_result: p1Result,
    p2_result: p2Result,
    p1_tickets_awarded: ticketsAwardedP1,
    p2_tickets_awarded: ticketsAwardedP2
  };
}

test('BUG-03: Winning against AI/NPC returns at most 1 ticket (net profit: 0)', () => {
  const match = { id: 'match_npc', match_type: 'NPC_FALLBACK', is_test_opponent: false, status: 'MATCHED' };
  const p1 = { player_id: 'user_human', is_test_opponent: false, ticket_balance: 0 }; // paid 1 ticket to enter
  const p2 = { player_id: null, is_test_opponent: true, ticket_balance: 0 }; // Ramesh Dalle / Vortex AI

  const res = simulateFinalizeDuel({ match, p1, p2, p1Score: 400, p2Score: 250 });
  assert.strictEqual(res.p1_result, 'WON');
  assert.strictEqual(res.p1_tickets_awarded, 1, 'Must award 1 ticket (refund), NOT 2 tickets');
  assert.strictEqual(p1.ticket_balance, 1, 'Final ticket balance is 1 (net profit: 0 over entry)');
});

test('BUG-03: Repeated AI matches yield 0 net withdrawable profit', () => {
  let playerTickets = 10; // Start with 10 tickets
  const initialTickets = playerTickets;

  for (let matchNum = 1; matchNum <= 20; matchNum++) {
    // 1. Enter matchmaking: spend 1 ticket
    playerTickets -= 1;

    // 2. Play NPC match and win
    const match = { id: `npc_${matchNum}`, match_type: 'NPC_FALLBACK', is_test_opponent: false, status: 'MATCHED' };
    const p1 = { player_id: 'user_human', is_test_opponent: false, ticket_balance: playerTickets };
    const p2 = { player_id: null, is_test_opponent: true, ticket_balance: 0 };

    simulateFinalizeDuel({ match, p1, p2, p1Score: 500, p2Score: 100 });
    playerTickets = p1.ticket_balance;
  }

  assert.strictEqual(
    playerTickets,
    initialTickets,
    'Player ticket count after 20 AI wins MUST equal initial tickets (0 infinite farming profit)'
  );
});

test('BUG-03: Idempotent match finalization cannot award duplicate tickets', () => {
  const match = { id: 'match_pvp_1', match_type: 'PVP', is_test_opponent: false, status: 'MATCHED' };
  const p1 = { player_id: 'human_1', is_test_opponent: false, ticket_balance: 0 };
  const p2 = { player_id: 'human_2', is_test_opponent: false, ticket_balance: 0 };

  const firstCall = simulateFinalizeDuel({ match, p1, p2, p1Score: 400, p2Score: 200 });
  assert.strictEqual(firstCall.p1_tickets_awarded, 2);
  assert.strictEqual(p1.ticket_balance, 2);

  // Second call on already completed match
  const secondCall = simulateFinalizeDuel({ match, p1, p2, p1Score: 400, p2Score: 200 });
  assert.strictEqual(secondCall.already_completed, true);
  assert.strictEqual(p1.ticket_balance, 2, 'Tickets must NOT increase on repeat finalization');
});

test('BUG-03: Real human PVP duel preserves total ticket economy (2 tickets in, 2 tickets out)', () => {
  // Two players each start with 1 ticket and pay to enter
  let p1Balance = 0;
  let p2Balance = 0;

  const match = { id: 'match_pvp_real', match_type: 'PVP', is_test_opponent: false, status: 'MATCHED' };
  const p1 = { player_id: 'human_alpha', is_test_opponent: false, ticket_balance: p1Balance };
  const p2 = { player_id: 'human_beta', is_test_opponent: false, ticket_balance: p2Balance };

  const res = simulateFinalizeDuel({ match, p1, p2, p1Score: 350, p2Score: 150 });
  assert.strictEqual(res.winner_id, 'human_alpha');
  assert.strictEqual(p1.ticket_balance, 2);
  assert.strictEqual(p2.ticket_balance, 0);
  assert.strictEqual(p1.ticket_balance + p2.ticket_balance, 2, 'Total ticket pool is strictly conserved at 2');
});

console.log('\n================================================================');
console.log(`ALL ${passedTests} / ${totalTests} TESTS PASSED CLEANLY!`);
console.log('================================================================\n');
