export type MerchantStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';

export type SetupFeeStatus = 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAID' | 'FAILED';

export type MerchantPayoutStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED';

export type MerchantDepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type MerchantLedgerEntryType =
  | 'DEPOSIT_CREDIT'
  | 'DEPOSIT_FEE'
  | 'PAYOUT_LOCK'
  | 'PAYOUT_FEE_LOCK'
  | 'PAYOUT_CONFIRM'
  | 'PAYOUT_FEE_CONFIRM'
  | 'PAYOUT_REFUND'
  | 'PAYOUT_FEE_REFUND'
  | 'ADJUSTMENT';

export interface Merchant {
  id: string;
  user_id: string;
  merchant_code: string;
  business_name: string;
  mobile_number: string;
  status: MerchantStatus;
  setup_fee_status?: SetupFeeStatus;
  setup_fee_amount?: number;
  setup_fee_reference?: string | null;
  setup_fee_paid_at?: string | null;
  setup_fee_payment_method?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerchantWallet {
  id: string;
  merchant_id: string;
  available_balance: number;
  locked_payout_balance: number;
  total_deposited: number;
  total_paid_out: number;
  total_fees_paid: number;
  created_at: string;
  updated_at: string;
}

export interface MerchantLedgerEntry {
  id: string;
  merchant_id: string;
  wallet_id: string;
  amount: number;
  fee_amount: number;
  entry_type: MerchantLedgerEntryType;
  reference_type: string;
  reference_id: string | null;
  idempotency_key: string;
  balance_before: number;
  balance_after: number;
  metadata: Record<string, any>;
  created_at: string;
}

export type MerchantPayoutMethod = 'UPI' | 'IMPS';

export interface MerchantPayout {
  id: string;
  merchant_id: string;
  order_id: string;
  provider_order_id: string;
  payout_method?: MerchantPayoutMethod;
  upi_id?: string | null;
  amount: number;
  fee_amount: number;
  total_deducted: number;
  account_holder_name?: string | null;
  bank_account_number_masked?: string | null;
  ifsc_code?: string | null;
  status: MerchantPayoutStatus;
  payout_provider: string;
  provider_reference_id: string | null;
  rejection_reason: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export interface MerchantDeposit {
  id: string;
  merchant_id: string;
  gross_amount: number;
  deposit_fee: number;
  net_credited: number;
  utr_number: string;
  status: MerchantDepositStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerchantApiKey {
  id: string;
  merchant_id: string;
  key_name: string;
  client_id: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface MerchantIpWhitelist {
  id: string;
  merchant_id: string;
  ip_address: string;
  description: string | null;
  created_at: string;
}

export interface MerchantPayoutEvent {
  id: string;
  payout_id: string | null;
  provider_event_id: string;
  event_type: string;
  raw_payload: Record<string, any>;
  created_at: string;
}

// ==============================================================================
// UNIFIED TRANSACTION & ANALYTICS TYPES
// ==============================================================================

export type UnifiedTransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export type UnifiedTransactionStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'PROCESSING'
  | 'FAILED'
  | 'REJECTED';

export interface MerchantUnifiedTransaction {
  id: string;
  merchant_id: string;
  type: UnifiedTransactionType;
  reference_id: string; // order_id for payouts, utr_number for deposits
  provider_order_id?: string | null;
  provider_reference_id?: string | null; // UTR / RRN from bank
  amount: number; // gross deposit amount or payout requested amount
  fee: number; // deposit fee or payout fee
  net_amount: number; // net float credited (deposit) or total float deducted (payout)
  status: UnifiedTransactionStatus;
  payment_method: string;
  recipient_or_sender?: string | null;
  created_at: string;
  reviewed_or_processed_at?: string | null;
  notes_or_reason?: string | null;
  raw_data?: Record<string, any>;
}

export interface MerchantDailyVolumePoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "06 Nov"
  deposit_volume: number;
  withdrawal_volume: number;
  successful_count: number;
  failed_count: number;
  total_count: number;
}

export interface MerchantFinancialAnalytics {
  // Financial Overview Cards
  total_deposited_amount: number; // lifetime successful deposits net credited to float
  total_deposited_gross: number; // lifetime gross deposit amount paid
  total_deposited_count: number;
  total_withdrawn_amount: number; // lifetime successful payouts net principal
  total_withdrawn_gross: number; // lifetime total deducted (principal + fee)
  total_withdrawn_count: number;

  today_deposits_amount: number;
  today_deposits_count: number;
  today_withdrawals_amount: number;
  today_withdrawals_count: number;
  today_transactions_count: number;

  yesterday_deposits_amount: number;
  yesterday_deposits_count: number;
  yesterday_withdrawals_amount: number;
  yesterday_withdrawals_count: number;
  yesterday_transactions_count: number;

  last_7_days_deposits_amount: number;
  last_7_days_withdrawals_amount: number;
  last_7_days_transactions_count: number;

  last_30_days_deposits_amount: number;
  last_30_days_withdrawals_amount: number;
  last_30_days_transactions_count: number;

  total_transactions_count: number;
  available_float_balance: number;
  locked_payout_balance: number;

  // Pending Transactions (Displayed Separately)
  pending_deposits_count: number;
  pending_deposits_amount: number;
  pending_withdrawals_count: number;
  pending_withdrawals_amount: number;

  // Status breakdown
  successful_count: number;
  pending_count: number;
  failed_count: number;
  rejected_count: number;

  // Daily volume trends for visual charts
  daily_chart: MerchantDailyVolumePoint[];
}

export interface MerchantTransactionsQueryParams {
  merchantId: string;
  page: number; // 1-indexed
  pageSize?: number; // Exactly 100
  type?: 'ALL' | 'DEPOSIT' | 'WITHDRAWAL';
  status?: 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED' | 'REJECTED';
  search?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface MerchantTransactionsResponse {
  transactions: MerchantUnifiedTransaction[];
  total_count: number;
  page: number;
  pageSize: number;
  total_pages: number;
}


