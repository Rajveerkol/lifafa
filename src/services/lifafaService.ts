import { supabase, isSupabaseConfigured, getValidAuthToken, extractFunctionError } from '../lib/supabase';
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

export interface ClaimLifafaResult {
  success: boolean;
  amount: number;
  lifafa_code: string;
  is_duplicate?: boolean;
  payout_mode?: PayoutMode;
  withdrawal_id?: string | null;
  withdrawal_status?: string;
  new_balance?: number;
  payout_dispatched?: boolean;
  payout_reference_id?: string;
  payout_order_id?: string;
  payout_error?: string;
}

// Authoritative server-aligned Lifafa external payout fee slabs:
// ₹1 - ₹500       -> ₹2.50
// >₹500 - ₹1,000  -> ₹2.70
// >₹1,000 - ₹5,000 -> ₹3.50
export function getLifafaPayoutFee(amount: number): number {
  if (!amount || amount <= 0) return 0;
  if (amount <= 500) return 2.50;
  if (amount <= 1000) return 2.70;
  return 3.50;
}

export function calculateLifafaPayoutFees(
  totalAmount: number,
  winnerCount: number,
  distributionType: DistributionType,
  payoutMode: PayoutMode,
  maxClaimAmount?: number
): number {
  if (payoutMode !== 'UPI_BANK' || !totalAmount || !winnerCount || winnerCount < 1) {
    return 0;
  }
  if (distributionType === 'EQUAL') {
    const perWinner = totalAmount / winnerCount;
    return Number((winnerCount * getLifafaPayoutFee(perWinner)).toFixed(2));
  }
  if (maxClaimAmount && maxClaimAmount > 0) {
    return Number((winnerCount * getLifafaPayoutFee(maxClaimAmount)).toFixed(2));
  }
  if (totalAmount <= 500) {
    return Number((winnerCount * 2.50).toFixed(2));
  }
  const avgAmount = totalAmount / winnerCount;
  return Number((winnerCount * getLifafaPayoutFee(avgAmount)).toFixed(2));
}

export const lifafaService = {
  // Create Lifafa via atomic server-side RPC (Zero frontend trust, wallet reservation & allocation generation inside PostgreSQL)
  async createLifafa(params: CreateLifafaParams, idempotencyKey?: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured. Please connect Supabase.');
    }

    let { data, error } = await supabase.rpc('create_lifafa_rpc', {
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

    // Resilient Fallback: If remote PostgreSQL enum task_type has not yet been extended via Migration 034,
    // retry transparently with CUSTOM task_type and [YOUTUBE_WATCH:videoId] metadata tag
    if (error && error.message?.includes('invalid input value for enum task_type') && params.tasks?.some(t => t.task_type === 'YOUTUBE_WATCH')) {
      const fallbackTasks = (params.tasks || []).map((t) => {
        if (t.task_type === 'YOUTUBE_WATCH') {
          const videoId = (t as any).youtube_video_id || (t.target_url?.match(/v=([a-zA-Z0-9_-]{11})/) || [])[1] || '';
          return {
            ...t,
            task_type: 'CUSTOM',
            description: `[YOUTUBE_WATCH:${videoId}] ${t.description || 'Watch the complete video to unlock your claim.'}`,
          };
        }
        return t;
      });

      const retryRes = await supabase.rpc('create_lifafa_rpc', {
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
        p_tasks: fallbackTasks,
        p_idempotency_key: idempotencyKey || null,
        p_min_claim_amount: params.minClaimAmount || null,
        p_max_claim_amount: params.maxClaimAmount || null,
        p_starts_at: params.startsAt || null,
        p_device_claim_limit: params.deviceClaimLimit ?? 1,
        p_payout_mode: params.payoutMode || 'WALLET',
      });

      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      throw new Error(error.message || 'Failed to create Lifafa');
    }

    return data;
  },

  // Claim Lifafa via concurrency-safe atomic PostgreSQL RPC and dispatch payout if UPI_BANK
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
  ): Promise<ClaimLifafaResult> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('claim_lifafa_rpc', {
      p_code: code.trim(),
      p_pin_code: pinCode || null,
      p_device_fingerprint: deviceFingerprint || null,
      p_ip_address: ipAddress || null,
      p_idempotency_key: idempotencyKey || null,
      p_account_holder_name: payoutDetails?.accountHolderName?.trim() || null,
      p_bank_account_number: payoutDetails?.bankAccountNumber?.trim() || null,
      p_ifsc_code: payoutDetails?.ifscCode?.trim()?.toUpperCase() || null,
      p_upi_id: payoutDetails?.upiId?.trim()?.toLowerCase() || null,
    });

    if (error) {
      let friendlyMsg = error.message || 'Failed to claim Lifafa';
      if (friendlyMsg.toLowerCase().includes('regular expression') || friendlyMsg.toLowerCase().includes('repetition count')) {
        friendlyMsg = 'Please enter a valid IFSC code or Bank Account.';
      }
      throw new Error(friendlyMsg);
    }

    // Direct external payout flow: If payout_mode is UPI_BANK, dispatch to consumer-paynit-payout and verify from database
    if (data?.payout_mode === 'UPI_BANK') {
      if (!data?.withdrawal_id) {
        return {
          ...data,
          payout_dispatched: false,
          withdrawal_status: 'FAILED',
          payout_error: 'Bank payout record was not created.',
        };
      }

      // 1. Obtain fresh access token to avoid 401 Unauthorized
      const token = await getValidAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 2. Invoke Consumer PayNit Edge Function dispatch
      let payoutRes: any = null;
      let invokeErrorMessage: string | null = null;
      try {
        const invokeResult = await supabase.functions.invoke('consumer-paynit-payout', {
          headers,
          body: {
            withdrawal_id: data.withdrawal_id,
          },
        });
        payoutRes = invokeResult.data;
        if (invokeResult.error) {
          invokeErrorMessage = await extractFunctionError(invokeResult.error, invokeResult.data);
          console.error('Consumer PayNit invoke error:', invokeErrorMessage);
        }
      } catch (invokeErr: any) {
        invokeErrorMessage = invokeErr.message || 'Network exception dispatching external payout';
        console.error('Consumer PayNit invoke exception:', invokeErr);
      }

      // 3. CRITICAL CHECK: Authoritatively verify the payout state from the database.
      // Do NOT rely only on claim_lifafa_rpc or edge function return value.
      // Must explicitly verify the actual withdrawal record in PostgreSQL.
      const currentUserId = (await supabase.auth.getUser())?.data?.user?.id;
      const verifiedCheck = await lifafaService.verifyClaimBankPayout(
        data.withdrawal_id,
        currentUserId || '',
        data.amount
      );

      if (verifiedCheck.verified && verifiedCheck.status === 'SUCCESS') {
        return {
          ...data,
          payout_dispatched: true, // ONLY true when confirmed SUCCESS in database with provider audit
          withdrawal_status: 'SUCCESS',
          payout_reference_id: verifiedCheck.payout_reference_id || payoutRes?.reference_id,
          payout_order_id: verifiedCheck.order_id || payoutRes?.order_id,
        };
      }

      if (verifiedCheck.verified && verifiedCheck.status === 'PROCESSING') {
        return {
          ...data,
          payout_dispatched: true, // Payout is dispatched and actively processing with PayNit
          withdrawal_status: 'PROCESSING',
          payout_reference_id: verifiedCheck.payout_reference_id || payoutRes?.reference_id,
          payout_order_id: verifiedCheck.order_id || payoutRes?.order_id,
        };
      }

      // If payout dispatch failed or was not confirmed:
      return {
        ...data,
        payout_dispatched: false, // EXPLICITLY FALSE
        withdrawal_status: verifiedCheck.status || payoutRes?.status || 'FAILED',
        payout_error: verifiedCheck.error || invokeErrorMessage || payoutRes?.error || 'Reward claimed, but direct UPI payout could not be initiated.',
        payout_order_id: verifiedCheck.order_id || payoutRes?.order_id,
      };
    }

    return {
      ...data,
      payout_dispatched: true, // WALLET mode is immediately credited to wallet balance
    };
  },

  // Authoritatively verify confirmed UPI payout dispatch state from the database
  async verifyClaimBankPayout(withdrawalId: string, expectedUserId: string, expectedAmount: number): Promise<{
    verified: boolean;
    status: string;
    payout_reference_id?: string;
    order_id?: string;
    error?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { verified: false, status: 'UNKNOWN', error: 'Database not configured' };
    }

    try {
      // 1. Explicitly query withdrawal record directly from database
      const { data: wth, error: wthErr } = await supabase
        .from('withdrawals')
        .select('id, user_id, amount, net_amount, fee_amount, status, payout_provider, payout_reference_id, provider_order_id, rejection_reason')
        .eq('id', withdrawalId)
        .maybeSingle();

      if (wthErr || !wth) {
        return { verified: false, status: 'NOT_FOUND', error: 'UPI payout record does not exist.' };
      }

      // 2. Validate ownership & amount integrity
      if (wth.user_id !== expectedUserId) {
        return { verified: false, status: 'UNAUTHORIZED', error: 'Payout claimant mismatch.' };
      }

      // Authoritative net amount check:
      // In UPI Lifafa fee escrow, 'amount' is gross (reward + platform fee) and 'net_amount' is the actual reward sent to claimant.
      // On older records before fee escrow, 'amount' is equal to 'net_amount'.
      const claimPayoutAmount = Number(wth.net_amount != null ? wth.net_amount : wth.amount);
      const matchesNet = Math.abs(claimPayoutAmount - Number(expectedAmount)) <= 0.01;
      const matchesGross = Math.abs(Number(wth.amount) - Number(expectedAmount)) <= 0.01;

      if (!matchesNet && !matchesGross) {
        return { verified: false, status: 'AMOUNT_MISMATCH', error: 'Payout amount mismatch.' };
      }

      // 3. Check for confirmed provider audit entry in payout_transactions
      const { data: tx } = await supabase
        .from('payout_transactions')
        .select('id, status, provider_reference_id')
        .eq('withdrawal_id', withdrawalId)
        .maybeSingle();

      // Condition: withdrawal status MUST be confirmed SUCCESS and provider transaction/reference exists
      if (wth.status === 'SUCCESS' && (wth.payout_reference_id || tx)) {
        return {
          verified: true,
          status: 'SUCCESS',
          payout_reference_id: wth.payout_reference_id || tx?.provider_reference_id,
          order_id: wth.provider_order_id,
        };
      }

      // Condition: withdrawal is PROCESSING (queued with PayNit or awaiting webhook)
      if (wth.status === 'PROCESSING') {
        return {
          verified: true,
          status: 'PROCESSING',
          payout_reference_id: wth.payout_reference_id || tx?.provider_reference_id,
          order_id: wth.provider_order_id,
        };
      }

      return {
        verified: false,
        status: wth.status,
        order_id: wth.provider_order_id,
        error: wth.rejection_reason || 'UPI payout dispatch was not confirmed.',
      };
    } catch (err: any) {
      return { verified: false, status: 'ERROR', error: err.message || 'Verification query failed' };
    }
  },

  // Authoritative server-side PIN code verification for a specific Lifafa
  async verifyLifafaPin(code: string, pinCode: string): Promise<{ valid: boolean; message?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { valid: true };
    }

    const cleanPin = pinCode.trim();
    if (!cleanPin) {
      return { valid: false, message: 'Please enter the security PIN.' };
    }

    const { data, error } = await supabase.rpc('verify_lifafa_pin_rpc', {
      p_lifafa_code: code.trim(),
      p_pin_code: cleanPin,
    });

    if (error) {
      // If RPC doesn't exist yet or raised an exception
      if (error.message?.toLowerCase().includes('incorrect pin')) {
        return { valid: false, message: 'Incorrect PIN code entered. Please try again.' };
      }
      return { valid: false, message: error.message || 'Incorrect PIN code entered.' };
    }

    if (typeof data === 'boolean') {
      return { valid: data, message: data ? undefined : 'Incorrect PIN code entered. Please try again.' };
    }
    if (data && typeof data === 'object') {
      return {
        valid: Boolean(data.valid),
        message: data.message || (data.valid ? undefined : 'Incorrect PIN code entered. Please try again.'),
      };
    }

    return { valid: Boolean(data), message: data ? undefined : 'Incorrect PIN code entered. Please try again.' };
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
      .maybeSingle();

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

  // Authoritatively check if a user has already claimed a specific Lifafa
  async getUserClaimForLifafa(lifafaId: string, userId: string): Promise<LifafaClaim | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('lifafa_claims')
      .select('*')
      .eq('lifafa_id', lifafaId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking user claim:', error);
      return null;
    }

    return (data || null) as LifafaClaim | null;
  },
};
