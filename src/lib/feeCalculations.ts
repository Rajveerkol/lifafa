/**
 * Authoritative Fee Calculation Utilities
 * Unified across Website Wallet and Merchant Gateway
 */

export interface FeeSlabResult {
  fee: number;
  totalDeducted: number;
}

export interface DepositFeeResult {
  depositAmount: number;
  fee: number;
  totalPayable: number;
  walletCredit: number;
}

/**
 * Payout & Withdrawal Fee Slabs:
 * - ₹1 to ₹500           -> Fee = ₹2.50
 * - Above ₹500 to ₹1,000 -> Fee = ₹2.70
 * - Above ₹1,000 to ₹5,000 -> Fee = ₹3.50
 *
 * Exact boundaries:
 * ₹500     -> ₹2.50  (Total: ₹502.50)
 * ₹500.01  -> ₹2.70  (Total: ₹502.71)
 * ₹1,000   -> ₹2.70  (Total: ₹1,002.70)
 * ₹1,000.01 -> ₹3.50 (Total: ₹1,003.51)
 * ₹5,000   -> ₹3.50  (Total: ₹5,003.50)
 */
export function calculateWithdrawalFee(amount: number): FeeSlabResult {
  const num = Math.round(Number(amount) * 100) / 100;
  if (isNaN(num) || num <= 0) {
    return { fee: 2.50, totalDeducted: 0 };
  }

  let fee = 2.50;
  if (num <= 500) {
    fee = 2.50;
  } else if (num <= 1000) {
    fee = 2.70;
  } else {
    fee = 3.50;
  }

  const totalDeducted = Math.round((num + fee) * 100) / 100;
  return { fee, totalDeducted };
}

/**
 * 2% Deposit Fee Calculation:
 * - Formula:
 *   Deposit Fee = Deposit Amount × 2%
 *   Total Payable = Deposit Amount + 2% Fee
 *   Wallet Credit = Deposit Amount
 *
 * Examples:
 * ₹1,000 deposit:
 *   Fee = ₹20
 *   User pays = ₹1,020
 *   Wallet receives = ₹1,000
 *
 * ₹5,000 deposit:
 *   Fee = ₹100
 *   User pays = ₹5,100
 *   Wallet receives = ₹5,000
 */
export function calculateDepositFee(depositAmount: number): DepositFeeResult {
  const cleanAmount = Math.round(Number(depositAmount) * 100) / 100;
  if (isNaN(cleanAmount) || cleanAmount <= 0) {
    return { depositAmount: 0, fee: 0, totalPayable: 0, walletCredit: 0 };
  }

  const fee = Math.round(cleanAmount * 0.02 * 100) / 100;
  const totalPayable = Math.round((cleanAmount + fee) * 100) / 100;
  const walletCredit = cleanAmount;

  return {
    depositAmount: cleanAmount,
    fee,
    totalPayable,
    walletCredit,
  };
}
