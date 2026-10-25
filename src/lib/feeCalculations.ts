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
 * Authoritative Payout & Withdrawal Fee Slabs:
 * - ₹1 to ₹499.99          -> Fixed Charge = ₹2.50
 * - ₹500 to ₹999.99        -> Fixed Charge = ₹5.00
 * - ₹1,000 to ₹2,000       -> Fixed Charge = ₹10.00
 *
 * Exact boundaries:
 * ₹1        -> ₹2.50  (Total: ₹3.50)
 * ₹499.99   -> ₹2.50  (Total: ₹502.49)
 * ₹500      -> ₹5.00  (Total: ₹505.00)
 * ₹999.99   -> ₹5.00  (Total: ₹1,004.99)
 * ₹1,000    -> ₹10.00 (Total: ₹1,010.00)
 * ₹2,000    -> ₹10.00 (Total: ₹2,010.00)
 * Above ₹2,000 up to max platform limit (₹5,000) -> ₹10.00
 */
export function calculateWithdrawalFee(amount: number): FeeSlabResult {
  const num = Math.round(Number(amount) * 100) / 100;
  if (isNaN(num) || num <= 0) {
    return { fee: 2.50, totalDeducted: 0 };
  }

  let fee = 2.50;
  if (num < 500) {
    fee = 2.50;
  } else if (num < 1000) {
    fee = 5.00;
  } else {
    fee = 10.00;
  }

  const totalDeducted = Math.round((num + fee) * 100) / 100;
  return { fee, totalDeducted };
}

/**
 * Authoritative Deposit Fee Slabs:
 * - Deposit amount ₹100 to ₹999.99: Flat ₹100 fee.
 * - Deposit amount ₹1,000 and above: 2% of deposit amount.
 * - Minimum deposit amount: ₹100.
 *
 * Exact examples:
 * ₹100    -> Fee ₹100 -> User pays ₹200 (Wallet gets ₹100)
 * ₹200    -> Fee ₹100 -> User pays ₹300 (Wallet gets ₹200)
 * ₹500    -> Fee ₹100 -> User pays ₹600 (Wallet gets ₹500)
 * ₹999    -> Fee ₹100 -> User pays ₹1,099 (Wallet gets ₹999)
 * ₹1,000  -> Fee ₹20  -> User pays ₹1,020 (Wallet gets ₹1,000)
 * ₹2,000  -> Fee ₹40  -> User pays ₹2,040 (Wallet gets ₹2,000)
 * ₹5,000  -> Fee ₹100 -> User pays ₹5,100 (Wallet gets ₹5,000)
 */
export function calculateDepositFee(depositAmount: number): DepositFeeResult {
  const cleanAmount = Math.round(Number(depositAmount) * 100) / 100;
  if (isNaN(cleanAmount) || cleanAmount < 100) {
    return {
      depositAmount: isNaN(cleanAmount) ? 0 : cleanAmount,
      fee: 0,
      totalPayable: isNaN(cleanAmount) ? 0 : cleanAmount,
      walletCredit: isNaN(cleanAmount) ? 0 : cleanAmount,
    };
  }

  let fee = 0;
  if (cleanAmount < 1000) {
    fee = 100.00;
  } else {
    fee = Math.round(cleanAmount * 0.02 * 100) / 100;
  }

  const totalPayable = Math.round((cleanAmount + fee) * 100) / 100;
  const walletCredit = cleanAmount;

  return {
    depositAmount: cleanAmount,
    fee,
    totalPayable,
    walletCredit,
  };
}
