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

export interface MerchantPayout {
  id: string;
  merchant_id: string;
  order_id: string;
  provider_order_id: string;
  amount: number;
  fee_amount: number;
  total_deducted: number;
  account_holder_name: string;
  bank_account_number_masked: string;
  ifsc_code: string;
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

