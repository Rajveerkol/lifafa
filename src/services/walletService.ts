import { supabase, isSupabaseConfigured, getValidAuthToken, extractFunctionError } from '../lib/supabase';
import type { WalletTransaction, Withdrawal, PlatformFee, WithdrawableBalanceResponse } from '../types/database';

export interface RequestWithdrawalParams {
  amount: number;
  upiId: string;
  payoutMethod?: 'UPI';
  accountHolderName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
}

export interface PlatformPaymentSettings {
  upiId: string;
  payeeName: string;
  qrImageUrl: string;
  qrMode: 'DYNAMIC' | 'CUSTOM_IMAGE';
}

export const DEFAULT_PAYMENT_SETTINGS: PlatformPaymentSettings = {
  upiId: 'createlifafa@upi',
  payeeName: 'Createlifafa',
  qrImageUrl: '',
  qrMode: 'DYNAMIC',
};

export const PAYMENT_SETTINGS_STORAGE_KEY = 'lifafa_platform_payment_settings';

export const walletService = {
  // Fetch user's double-entry ledger transactions
  async getTransactions(userId: string): Promise<WalletTransaction[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return (data || []) as WalletTransaction[];
  },

  // Request automatic wallet withdrawal via deployed consumer-paynit-payout Edge Function
  async requestWithdrawal(params: RequestWithdrawalParams, idempotencyKey?: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    // Strict UPI-Only Enforcement
    if (params.payoutMethod === ('IMPS' as any) || (params.bankAccountNumber && params.bankAccountNumber.trim() !== '')) {
      throw new Error('IMPS payouts are no longer supported. All withdrawals are processed via UPI only.');
    }

    const cleanUpi = params.upiId?.trim()?.toLowerCase();
    if (!cleanUpi) {
      throw new Error('UPI ID is required for withdrawal.');
    }

    // 1. Proactively obtain valid access token with auto-refresh
    let token = await getValidAuthToken();
    if (!token) {
      try {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token || null;
      } catch (authErr) {
        console.warn('Session refresh attempt failed:', authErr);
      }
    }

    if (!token) {
      throw new Error('Your session expired. Please sign in again.');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const payload = {
      action: 'request_and_dispatch',
      amount: params.amount,
      payoutMethod: 'UPI',
      upiId: cleanUpi,
      accountHolderName: params.accountHolderName?.trim() || null,
      idempotencyKey: idempotencyKey || null,
    };

    let data: any = null;
    let error: any = null;

    try {
      const invokeResult = await supabase.functions.invoke('consumer-paynit-payout', {
        headers,
        body: payload,
      });
      data = invokeResult.data;
      error = invokeResult.error;
    } catch (invokeErr: any) {
      error = invokeErr;
    }

    // If an error occurred during Edge Function dispatch:
    if (error) {
      // Safety check: verify if the withdrawal was already recorded in the database
      if (idempotencyKey) {
        const { data: createdWth } = await supabase
          .from('withdrawals')
          .select('id, status, provider_order_id, payout_reference_id, net_amount, fee_amount, amount')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (createdWth) {
          return {
            success: true,
            withdrawal_id: createdWth.id,
            status: createdWth.status || 'PROCESSING',
            order_id: createdWth.provider_order_id,
            reference_id: createdWth.payout_reference_id,
            amount: params.amount,
            net_amount: params.amount,
            upi_id: cleanUpi,
            message: 'Withdrawal created and currently queued for payout dispatch.',
          };
        }
      }

      const effectiveData = data;
      if (effectiveData?.status === 'PROCESSING') {
        return effectiveData;
      }
      const errMsg = await extractFunctionError(error, effectiveData);
      throw new Error(errMsg);
    }

    if (data?.error && data?.status !== 'PROCESSING') {
      throw new Error(data.error);
    }

    return data;
  },

  // Check withdrawal status authoritatively and trigger edge reconciliation if PROCESSING/PENDING
  async checkWithdrawalStatus(withdrawalId: string): Promise<{
    status: string;
    order_id?: string;
    reference_id?: string;
    error?: string;
    reconciled?: boolean;
    withdrawal?: Withdrawal;
  }> {
    if (!isSupabaseConfigured || !supabase || !withdrawalId) {
      return { status: 'UNKNOWN', error: 'Database not configured or missing withdrawalId' };
    }

    try {
      // 1. Authoritative check on database record
      const { data: wth, error: wthErr } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', withdrawalId)
        .maybeSingle();

      if (wthErr || !wth) {
        return { status: 'NOT_FOUND', error: wthErr?.message || 'Withdrawal record not found' };
      }

      // If already in terminal state (SUCCESS / FAILED / REVERSED / CANCELLED), return immediately
      if (['SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED'].includes(wth.status)) {
        return {
          status: wth.status,
          order_id: wth.provider_order_id,
          reference_id: wth.payout_reference_id,
          error: wth.rejection_reason,
          withdrawal: wth as Withdrawal,
        };
      }

      // 2. If status is PROCESSING or PENDING, trigger edge reconciliation check via deployed consumer-paynit-payout
      const token = await getValidAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('consumer-paynit-payout', {
          headers,
          body: {
            action: 'check_status',
            withdrawal_id: withdrawalId,
          },
        });

        if (!edgeErr && edgeData) {
          return {
            status: edgeData.status || wth.status,
            order_id: edgeData.order_id || wth.provider_order_id,
            reference_id: edgeData.reference_id || wth.payout_reference_id,
            error: edgeData.error || wth.rejection_reason,
            reconciled: Boolean(edgeData.reconciled),
            withdrawal: wth as Withdrawal,
          };
        }
      } catch (pollErr) {
        console.warn('Edge check_status invoke failed:', pollErr);
      }

      return {
        status: wth.status || 'PENDING',
        order_id: wth.provider_order_id || wth.id,
        reference_id: wth.payout_reference_id || wth.id,
        error: wth.rejection_reason || undefined,
        withdrawal: wth as Withdrawal,
      };
    } catch (err: any) {
      console.warn('Error in checkWithdrawalStatus:', err);
      return { status: 'PROCESSING', error: err.message };
    }
  },

  // Fetch server-authoritative withdrawable balance breakdown
  async getWithdrawableBalance(): Promise<WithdrawableBalanceResponse> {
    if (!isSupabaseConfigured || !supabase) {
      return { available_balance: 0, blocked_balance: 0, withdrawable_balance: 0 };
    }

    try {
      const { data, error } = await supabase.rpc('get_user_withdrawable_balance_rpc');
      if (error) {
        console.error('Error fetching withdrawable balance:', error);
        return { available_balance: 0, blocked_balance: 0, withdrawable_balance: 0 };
      }
      return {
        available_balance: Number(data?.available_balance ?? 0),
        blocked_balance: Number(data?.blocked_balance ?? 0),
        withdrawable_balance: Number(data?.withdrawable_balance ?? 0),
      };
    } catch (e) {
      console.error('Exception fetching withdrawable balance:', e);
      return { available_balance: 0, blocked_balance: 0, withdrawable_balance: 0 };
    }
  },

  // Fetch user's withdrawal requests
  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching withdrawals:', error);
      return [];
    }

    return (data || []) as Withdrawal[];
  },

  // Fetch active platform fee configurations
  async getPlatformFees(): Promise<PlatformFee[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [
        { id: '1', fee_type: 'LIFAFA_CREATION', calculation_type: 'FIXED', value: 0.0, is_active: true, updated_at: '' },
        { id: '2', fee_type: 'WITHDRAWAL', calculation_type: 'FIXED', value: 0.0, is_active: true, updated_at: '' },
      ];
    }

    const { data, error } = await supabase
      .from('platform_fees')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching platform fees:', error);
      return [];
    }
    return (data || []) as PlatformFee[];
  },

  // Fetch all payment settings with localStorage instant cache fallback
  async getPaymentSettings(): Promise<PlatformPaymentSettings> {
    let cached: PlatformPaymentSettings = { ...DEFAULT_PAYMENT_SETTINGS };
    try {
      const stored = localStorage.getItem(PAYMENT_SETTINGS_STORAGE_KEY);
      if (stored) {
        cached = { ...cached, ...JSON.parse(stored) };
      }
    } catch (e) {
      // ignore JSON parse error
    }

    if (!isSupabaseConfigured || !supabase) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['DEPOSIT_UPI_ID', 'DEPOSIT_PAYEE_NAME', 'DEPOSIT_QR_IMAGE_URL', 'DEPOSIT_QR_MODE']);

      if (!error && data && data.length > 0) {
        const fetched: Partial<PlatformPaymentSettings> = {};
        for (const row of data) {
          if (row.key === 'DEPOSIT_UPI_ID' && row.value) fetched.upiId = row.value;
          if (row.key === 'DEPOSIT_PAYEE_NAME' && row.value) fetched.payeeName = row.value;
          if (row.key === 'DEPOSIT_QR_IMAGE_URL') fetched.qrImageUrl = row.value || '';
          if (row.key === 'DEPOSIT_QR_MODE') fetched.qrMode = row.value as any;
        }
        const updated = { ...cached, ...fetched };
        try {
          localStorage.setItem(PAYMENT_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return cached;
    } catch {
      return cached;
    }
  },

  // Fetch current platform deposit UPI ID from settings
  async getDepositUpiId(): Promise<string> {
    const settings = await this.getPaymentSettings();
    return settings.upiId || DEFAULT_PAYMENT_SETTINGS.upiId;
  },

  // Submit manual UPI deposit request with authoritative server validation
  async submitDepositRequest(amount: number, utrNumber: string, paymentMethod: string = 'UPI') {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const cleanAmount = Math.round(Number(amount) * 100) / 100;
    const cleanUtr = utrNumber.trim().toUpperCase();

    const { data, error } = await supabase.rpc('submit_deposit_request_rpc', {
      p_amount: cleanAmount,
      p_utr_number: cleanUtr,
      p_payment_method: paymentMethod,
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit deposit request.');
    }

    if (data && data.success === false) {
      throw new Error(data.error || 'Failed to submit deposit request.');
    }

    return data;
  },

  // Fetch current user's deposit request history
  async getUserDeposits(userId: string) {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('deposit_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deposit requests:', error);
      return [];
    }

    return data || [];
  },

  // Update user profile display name (Issue 4)
  async updateUserProfileName(userId: string, fullName: string) {
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Full Name must be at least 2 characters long.');
    }
    if (cleanName.length > 50) {
      throw new Error('Full Name cannot exceed 50 characters.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return { success: true, full_name: cleanName };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: cleanName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update profile name.');
    }

    return data;
  },
};

