import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { WalletTransaction, Withdrawal, PlatformFee } from '../types/database';

export interface RequestWithdrawalParams {
  amount: number;
  accountHolderName: string;
  bankAccountNumber: string;
  ifscCode: string;
  upiId?: string; // If provided, server-side RPC strictly rejects with error
}

export interface PlatformPaymentSettings {
  upiId: string;
  payeeName: string;
  qrImageUrl: string;
  qrMode: 'DYNAMIC' | 'CUSTOM_IMAGE';
}

export const DEFAULT_PAYMENT_SETTINGS: PlatformPaymentSettings = {
  upiId: 'createlifafa@upi',
  payeeName: 'CreatLifafa',
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

  // Request withdrawal via server-side orchestrator Edge Function (Bank Account Only)
  async requestWithdrawal(params: RequestWithdrawalParams, idempotencyKey?: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.functions.invoke('payrupee-payout', {
      body: {
        action: 'request_and_dispatch',
        amount: params.amount,
        accountHolderName: params.accountHolderName.trim(),
        bankAccountNumber: params.bankAccountNumber.trim(),
        ifscCode: params.ifscCode.trim().toUpperCase(),
        idempotencyKey: idempotencyKey || null,
      },
    });

    if (error) {
      // If error returned with response data, extract the specific error message
      const errMsg = data?.error || data?.message || error.message || 'Withdrawal request failed';
      if (data?.status === 'PROCESSING') {
        return data;
      }
      throw new Error(errMsg);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
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
  async submitDepositRequest(amount: number, utrNumber: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('submit_deposit_request_rpc', {
      p_amount: amount,
      p_utr_number: utrNumber.trim(),
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit deposit request.');
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

