import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Lifafa, LifafaTask, LifafaClaim, DistributionType, PayoutMode } from '../types/database';

export interface CreateLifafaParams {
  title: string;
  message: string;
  totalAmount: number;
  winnerCount: number;
  distributionType: DistributionType;
  expiresAt: string;
  payoutMode?: PayoutMode;
  isPublic?: boolean;
  pinCode?: string;
  allowCancel?: boolean;
  showRemaining?: boolean;
  creatorNote?: string;
  minClaimAmount?: number;
  maxClaimAmount?: number;
  startsAt?: string;
  deviceClaimLimit?: number;
  tasks?: Array<{
    task_type: string;
    title: string;
    description?: string;
    target_url?: string;
    is_required: boolean;
    is_enabled: boolean;
    telegram_channel_username?: string;
    telegram_channel_id?: number;
    telegram_channel_title?: string;
    is_channel_verified?: boolean;
  }>;
}

export const lifafaService = {
  // Create Lifafa via atomic server-side RPC (Zero frontend trust, wallet reservation & allocation generation inside PostgreSQL)
  async createLifafa(params: CreateLifafaParams, idempotencyKey?: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured. Please connect Supabase.');
    }

    const { data, error } = await supabase.rpc('create_lifafa_rpc', {
      p_title: params.title,
      p_message: params.message || null,
      p_total_amount: params.totalAmount,
      p_winner_count: params.winnerCount,
      p_distribution_type: params.distributionType,
      p_expires_at: params.expiresAt,
      p_is_public: params.isPublic ?? true,
      p_pin_code: params.pinCode || null,
      p_allow_cancel: params.allowCancel ?? true,
      p_show_remaining: params.showRemaining ?? true,
      p_creator_note: params.creatorNote || null,
      p_tasks: params.tasks || [],
      p_idempotency_key: idempotencyKey || null,
      p_min_claim_amount: params.minClaimAmount || null,
      p_max_claim_amount: params.maxClaimAmount || null,
      p_starts_at: params.startsAt || null,
      p_device_claim_limit: params.deviceClaimLimit ?? 1,
      p_payout_mode: params.payoutMode || 'WALLET',
    });

    if (error) {
      throw new Error(error.message || 'Failed to create Lifafa');
    }

    return data;
  },

  // Claim Lifafa via concurrency-safe atomic PostgreSQL RPC
  async claimLifafa(
    code: string,
    pinCode?: string,
    deviceFingerprint?: string,
    ipAddress?: string,
    idempotencyKey?: string,
    payoutDetails?: {
      accountHolderName?: string;
      bankAccountNumber?: string;
      ifscCode?: string;
      upiId?: string;
    }
  ) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('claim_lifafa_rpc', {
      p_code: code.trim(),
      p_pin_code: pinCode || null,
      p_device_fingerprint: deviceFingerprint || null,
      p_ip_address: ipAddress || null,
      p_idempotency_key: idempotencyKey || null,
      p_account_holder_name: payoutDetails?.accountHolderName || null,
      p_bank_account_number: payoutDetails?.bankAccountNumber || null,
      p_ifsc_code: payoutDetails?.ifscCode || null,
      p_upi_id: payoutDetails?.upiId || null,
    });

    if (error) {
      throw new Error(error.message || 'Failed to claim Lifafa');
    }

    return data;
  },

  // Fetch public active Lifafas for the explore feed
  async getPublicLifafas(): Promise<Lifafa[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('lifafas')
      .select(`
        *,
        creator_profile:profiles!creator_id(id, full_name, avatar_url)
      `)
      .eq('is_public', true)
      .in('status', ['ACTIVE', 'COMPLETED', 'EXPIRED'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching public lifafas:', error);
      return [];
    }

    return (data || []) as Lifafa[];
  },

  // Fetch single Lifafa by unique short code
  async getLifafaByCode(code: string): Promise<Lifafa | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('lifafas')
      .select(`
        *,
        creator_profile:profiles!creator_id(id, full_name, avatar_url)
      `)
      .ilike('code', code.trim())
      .single();

    if (error || !data) {
      return null;
    }

    return data as Lifafa;
  },

  // Fetch tasks associated with a Lifafa
  async getLifafaTasks(lifafaId: string): Promise<LifafaTask[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('lifafa_tasks')
      .select('*')
      .eq('lifafa_id', lifafaId)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }

    return (data || []) as LifafaTask[];
  },

  // Fetch Lifafas created by specific user
  async getMyCreatedLifafas(userId: string): Promise<Lifafa[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('lifafas')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user lifafas:', error);
      return [];
    }

    return (data || []) as Lifafa[];
  },

  // Fetch claims made by specific user
  async getMyClaimedLifafas(userId: string): Promise<(LifafaClaim & { lifafa: Lifafa })[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('lifafa_claims')
      .select(`
        *,
        lifafa:lifafas(*)
      `)
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false });

    if (error) {
      console.error('Error fetching user claims:', error);
      return [];
    }

    return (data || []) as (LifafaClaim & { lifafa: Lifafa })[];
  },

  // Idempotent refund/release of unused reserved amount for expired or cancelled Lifafa
  async refundExpiredOrCancelled(lifafaId: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('refund_expired_or_cancelled_lifafa_rpc', {
      p_lifafa_id: lifafaId,
    });

    if (error) {
      throw new Error(error.message || 'Refund failed');
    }

    return data;
  },
};
