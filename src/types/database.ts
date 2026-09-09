export type TransactionType =
  | 'CREDIT'
  | 'DEBIT'
  | 'RESERVE'
  | 'RELEASE'
  | 'CLAIM'
  | 'REFUND'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_REVERSAL'
  | 'FEE';

export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED';

export type LifafaStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export type DistributionType = 'EQUAL' | 'RANDOM';

export type TaskType =
  | 'TELEGRAM_JOIN'
  | 'YOUTUBE_SUB'
  | 'REFERRAL'
  | 'INSTAGRAM_FOLLOW'
  | 'INSTAGRAM_LIKE'
  | 'TELEGRAM_BOT'
  | 'VISIT_WEBSITE'
  | 'CUSTOM';

export type WithdrawalStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REVERSED';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';

export type FeeCalculationType = 'PERCENTAGE' | 'FIXED';

export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  reserved_balance: number;
  total_earned: number;
  total_withdrawn: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  reference_type: string;
  reference_id: string | null;
  idempotency_key: string | null;
  balance_before: number;
  balance_after: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Lifafa {
  id: string;
  code: string;
  creator_id: string;
  title: string;
  message: string | null;
  total_amount: number;
  winner_count: number;
  distribution_type: DistributionType;
  claimed_count: number;
  remaining_amount: number;
  status: LifafaStatus;
  expires_at: string;
  is_public: boolean;
  pin_code: string | null;
  starts_at?: string;
  device_claim_limit?: number;
  max_claims_per_user: number;
  min_claim_amount: number | null;
  max_claim_amount: number | null;
  allow_cancel: boolean;
  show_remaining: boolean;
  creator_note: string | null;
  created_at: string;
  updated_at: string;
  creator_profile?: Profile;
}

export interface LifafaAllocation {
  id: string;
  lifafa_id: string;
  allocation_index: number;
  amount: number;
  is_claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
}

export interface LifafaClaim {
  id: string;
  lifafa_id: string;
  user_id: string;
  allocation_id: string;
  amount: number;
  idempotency_key: string | null;
  device_fingerprint: string | null;
  ip_address: string | null;
  claimed_at: string;
  claimer_profile?: Profile;
}

export interface LifafaTask {
  id: string;
  lifafa_id: string;
  task_type: TaskType;
  title: string;
  description: string | null;
  target_url: string | null;
  is_required: boolean;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  lifafa_id: string;
  user_id: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  verification_method: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  account_holder_name: string;
  bank_account_number_masked: string;
  bank_account_encrypted?: string;
  ifsc_code: string | null;
  upi_id: string | null;
  status: WithdrawalStatus;
  payout_provider: string;
  payout_reference_id: string | null;
  idempotency_key: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  user_profile?: Profile;
}

export interface PlatformFee {
  id: string;
  fee_type: 'LIFAFA_CREATION' | 'WITHDRAWAL';
  calculation_type: FeeCalculationType;
  value: number;
  is_active: boolean;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  telegram_alerts: boolean;
  bot_coming_soon_alerts: boolean;
  telegram_chat_id: string | null;
  email_alerts: boolean;
  updated_at: string;
}

export interface AdminUser {
  user_id: string;
  role: AdminRole;
  created_at: string;
  profile?: Profile;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
  admin_profile?: Profile;
}

export interface FraudFlag {
  id: string;
  user_id: string | null;
  flag_type: string;
  severity: FraudSeverity;
  details: Record<string, any>;
  is_resolved: boolean;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  user_profile?: Profile;
}
