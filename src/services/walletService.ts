import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { WalletTransaction, Withdrawal, PlatformFee } from '../types/database';

export interface RequestWithdrawalParams {
  amount: number;
  accountHolderName: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

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

  // Request withdrawal via atomic server RPC
  async requestWithdrawal(params: RequestWithdrawalParams, idempotencyKey?: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('request_withdrawal_rpc', {
      p_amount: params.amount,
      p_account_holder_name: params.accountHolderName.trim(),
      p_bank_account_number: params.bankAccountNumber?.trim() || null,
      p_ifsc_code: params.ifscCode?.trim() || null,
      p_upi_id: params.upiId?.trim() || null,
      p_idempotency_key: idempotencyKey || null,
    });

    if (error) {
      throw new Error(error.message || 'Withdrawal request failed');
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

  // Fetch current platform deposit UPI ID from settings
  async getDepositUpiId(): Promise<string> {
    const defaultUpiId = 'createlifafa@upi';
    if (!isSupabaseConfigured || !supabase) {
      return defaultUpiId;
    }

    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'DEPOSIT_UPI_ID')
        .maybeSingle();

      if (error || !data?.value) {
        return defaultUpiId;
      }

      return data.value;
    } catch {
      return defaultUpiId;
    }
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
};

