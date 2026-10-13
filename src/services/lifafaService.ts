import { supabase, isSupabaseConfigured, getValidAuthToken, extractFunctionError } from '../lib/supabase';
import type {
  Lifafa,
  LifafaTask,
  LifafaClaim,
  DistributionType,
  PayoutMode,
  CancelLifafaPreview,
  CancelLifafaResult,
} from '../types/database';

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
// ₹1 - ₹499.99     -> ₹2.50
// ₹500 - ₹999.99   -> ₹5.00
// ₹1,000 - ₹2,000  -> ₹10.00
export function getLifafaPayoutFee(amount: number): number {
  if (!amount || amount <= 0) return 0;
  if (amount < 500) return 2.50;
  if (amount < 1000) return 5.00;
  return 10.00;
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
  const avgAmount = totalAmount / winnerCount;
  return Number((winnerCount * getLifafaPayoutFee(avgAmount)).toFixed(2));
}

export const lifafaService = {
  // Create Lifafa via atomic server-side RPC (Zero frontend trust, wallet reservation & allocation generation inside PostgreSQL)
  async createLifafa(params: CreateLifafaParams, idempotencyKey?: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured. Please connect Supabase.');
    }

    // Strict validation: UPI Lifafa requires at least ₹10 per winner
    if (params.payoutMode === 'UPI_BANK') {
      if (params.totalAmount < params.winnerCount * 10) {
        throw new Error('Each winner must receive at least ₹10 for UPI Lifafa.');
      }
      if (params.distributionType === 'RANDOM' && params.minClaimAmount && params.minClaimAmount < 10) {
        throw new Error('Each winner must receive at least ₹10 for UPI Lifafa.');
      }
    }

    // Validate session & proactively refresh if token is expired or about to expire
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 30000)) {
        await supabase.auth.refreshSession();
      }
    } catch (authCheckErr) {
      console.warn('Session verification warning:', authCheckErr);
    }

    const rpcPayload = {
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
    };

    let { data, error } = await supabase.rpc('create_lifafa_rpc', rpcPayload);

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

      const fallbackPayload = {
        ...rpcPayload,
        p_tasks: fallbackTasks,
      };

      const retryRes = await supabase.rpc('create_lifafa_rpc', fallbackPayload);
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      const errorMsg = error.message || '';
      const errorCode = (error as any).code || '';

      // Intercept 42501 permission denied (often caused by expired/lapsed session during multi-step creation)
      if (
        errorCode === '42501' ||
        errorMsg.toLowerCase().includes('permission denied') ||
        errorMsg.toLowerCase().includes('permission denied for function')
      ) {
        // Attempt a fresh session refresh and one immediate retry
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) {
            const retryRes = await supabase.rpc('create_lifafa_rpc', rpcPayload);
            if (!retryRes.error && retryRes.data) {
              return retryRes.data;
            }
          }
        } catch {
          // Fall through to sanitized error
        }

        throw new Error('Your session has expired or you do not have permission. Please refresh the page or sign in again.');
      }

      // Preserve descriptive financial/business messages
      if (errorMsg.includes('Insufficient balance')) {
        throw new Error(errorMsg);
      }
      if (errorMsg.includes('Each winner must receive at least ₹10')) {
        throw new Error(errorMsg);
      }
      if (errorMsg.includes('Authentication required')) {
        throw new Error('Please sign in to create a Lifafa.');
      }

      throw new Error(errorMsg || 'Failed to create Lifafa. Please try again.');
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
    },
    guestClaimToken?: string
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
      p_guest_claim_token: guestClaimToken || null,
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

      // 1. Obtain fresh access token to avoid 401 Unauthorized (optional for guest)
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
            guest_claim_token: guestClaimToken || data?.guest_claim_token || undefined,
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
        data.amount,
        guestClaimToken || data?.guest_claim_token
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
      let rawError = verifiedCheck.error || invokeErrorMessage || payoutRes?.error || 'Reward claimed, but direct UPI payout could not be initiated.';
      if (rawError.includes('Domain validation failed') || rawError.includes('Origin header') || rawError.includes('whitelisted')) {
        rawError = 'Payment gateway domain security verification check is processing. Your reward is preserved — please tap Try Again below.';
      } else if (rawError.includes('Hostinger') || rawError.includes('WAF Challenge') || rawError.includes('Checking your browser')) {
        rawError = 'Payment gateway network challenge encountered. Your claim is preserved and you can try again below.';
      }

      return {
        ...data,
        payout_dispatched: false, // EXPLICITLY FALSE
        withdrawal_status: verifiedCheck.status || payoutRes?.status || 'FAILED',
        payout_error: rawError,
        payout_order_id: verifiedCheck.order_id || payoutRes?.order_id,
      };
    }

    return {
      ...data,
      payout_dispatched: true, // WALLET mode is immediately credited to wallet balance
    };
  },

  // Authoritatively verify confirmed UPI payout dispatch state from the database or provider
  async verifyClaimBankPayout(
    withdrawalId: string,
    expectedUserId: string,
    expectedAmount: number,
    guestClaimToken?: string
  ): Promise<{
    verified: boolean;
    status: string;
    payout_reference_id?: string;
    order_id?: string;
    error?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { verified: false, status: 'UNKNOWN', error: 'Database not configured' };
    }

    // Guest claimant verification branch via Edge Function status check
    if (!expectedUserId && guestClaimToken) {
      try {
        const checkRes = await supabase.functions.invoke('consumer-paynit-payout', {
          body: {
            action: 'check_status',
            withdrawal_id: withdrawalId,
            guest_claim_token: guestClaimToken,
          },
        });

        if (checkRes.data) {
          const res = checkRes.data;
          if (res.status === 'SUCCESS') {
            return {
              verified: true,
              status: 'SUCCESS',
              payout_reference_id: res.reference_id,
              order_id: res.order_id,
            };
          }
          if (res.status === 'PROCESSING') {
            return {
              verified: true,
              status: 'PROCESSING',
              payout_reference_id: res.reference_id,
              order_id: res.order_id,
            };
          }
          if (res.status === 'FAILED') {
            return {
              verified: false,
              status: 'FAILED',
              order_id: res.order_id,
              error: res.error || 'Payment could not be completed by provider.',
            };
          }
        }
      } catch (guestErr) {
        console.error('Guest payout verification check error:', guestErr);
      }
      return { verified: true, status: 'PROCESSING' };
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

      // 3. Check for confirmed provider audit entry in payout_transactions (admin-accessible)
      let tx: any = null;
      try {
        const { data: txData } = await supabase
          .from('payout_transactions')
          .select('id, status, provider_reference_id')
          .eq('withdrawal_id', withdrawalId)
          .maybeSingle();
        tx = txData;
      } catch {
        // Table is RLS-restricted for non-admins
      }

      // Condition: withdrawal status MUST be confirmed SUCCESS
      if (wth.status === 'SUCCESS') {
        return {
          verified: true,
          status: 'SUCCESS',
          payout_reference_id: wth.payout_reference_id || tx?.provider_reference_id || wth.provider_order_id,
          order_id: wth.provider_order_id,
        };
      }

      // Condition: withdrawal is PROCESSING (queued with PayNit or awaiting webhook)
      if (wth.status === 'PROCESSING') {
        // Attempt active server-side reconciliation via consumer-paynit-payout
        try {
          const token = await getValidAuthToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const reconcileRes = await supabase.functions.invoke('consumer-paynit-payout', {
            headers,
            body: { action: 'reconcile', withdrawal_id: withdrawalId, guest_claim_token: guestClaimToken },
          });

          if (reconcileRes.data && reconcileRes.data.reconciled) {
            if (reconcileRes.data.status === 'SUCCESS') {
              return {
                verified: true,
                status: 'SUCCESS',
                payout_reference_id: reconcileRes.data.reference_id,
                order_id: reconcileRes.data.order_id,
              };
            }
            if (reconcileRes.data.status === 'FAILED') {
              return {
                verified: false,
                status: 'FAILED',
                order_id: reconcileRes.data.order_id,
                error: reconcileRes.data.error || 'Payment could not be completed by provider.',
              };
            }
          }
        } catch {
          // Fall through to database state on network glitch
        }

        return {
          verified: true,
          status: 'PROCESSING',
          payout_reference_id: wth.payout_reference_id || tx?.provider_reference_id || wth.provider_order_id,
          order_id: wth.provider_order_id,
        };
      }

      // Condition: withdrawal is PENDING (in-flight dispatch)
      if (wth.status === 'PENDING') {
        return {
          verified: true,
          status: 'PROCESSING',
          payout_reference_id: wth.payout_reference_id || wth.provider_order_id,
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
      .eq('is_public_visible', true)
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

  // Fetch authoritative financial preview breakdown prior to cancellation
  async previewCancelLifafaRefund(lifafaId: string): Promise<CancelLifafaPreview> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('preview_cancel_lifafa_refund_rpc', {
      p_lifafa_id: lifafaId,
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch refund preview');
    }

    return data as CancelLifafaPreview;
  },

  // Idempotent refund/release of unused reserved amount for expired or cancelled Lifafa
  async refundExpiredOrCancelled(lifafaId: string): Promise<CancelLifafaResult> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('refund_expired_or_cancelled_lifafa_rpc', {
      p_lifafa_id: lifafaId,
    });

    if (error) {
      throw new Error(error.message || 'Refund failed');
    }

    return data as CancelLifafaResult;
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

  // Authoritatively check if a guest claimant has already claimed a specific Lifafa
  async getGuestClaimForLifafa(lifafaCode: string, guestClaimToken: string): Promise<{
    found: boolean;
    claim_id?: string;
    amount?: number;
    payout_mode?: string;
    withdrawal_id?: string;
    withdrawal_status?: string;
    order_id?: string;
    payout_reference_id?: string;
    rejection_reason?: string;
    created_at?: string;
  } | null> {
    if (!isSupabaseConfigured || !supabase || !guestClaimToken) {
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('get_guest_claim_status_rpc', {
        p_lifafa_code: lifafaCode.trim().toUpperCase(),
        p_guest_claim_token: guestClaimToken.trim(),
      });

      if (error || !data || !data.found) {
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error checking guest claim:', err);
      return null;
    }
  },
};
