import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Profile,
  Wallet,
  Lifafa,
  Withdrawal,
  AdminAuditLog,
  FraudFlag,
  PlatformFee,
  TransactionType,
  WithdrawalStatus,
} from '../types/database';

export interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  totalAvailableBalance: number;
  totalReservedBalance: number;
  totalLifafas: number;
  activeLifafas: number;
  totalDistributedAmount: number;
  totalWithdrawals: number;
  pendingWithdrawalsCount: number;
  totalPlatformFees: number;
}

export const adminService = {
  // Aggregate Metrics for Admin Dashboard
  async getDashboardMetrics(): Promise<AdminMetrics> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        totalUsers: 1,
        activeUsers: 1,
        totalAvailableBalance: 1500.0,
        totalReservedBalance: 500.0,
        totalLifafas: 1,
        activeLifafas: 1,
        totalDistributedAmount: 0,
        totalWithdrawals: 0,
        pendingWithdrawalsCount: 0,
        totalPlatformFees: 0,
      };
    }

    try {
      // 1. Total users
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

      // 2. Wallets totals
      const { data: walletsData } = await supabase
        .from('wallets')
        .select('available_balance, reserved_balance');

      let totalAvail = 0;
      let totalRes = 0;
      if (walletsData) {
        walletsData.forEach((w) => {
          totalAvail += Number(w.available_balance || 0);
          totalRes += Number(w.reserved_balance || 0);
        });
      }

      // 3. Lifafas count & distribution
      const { data: lifafasData, count: lifafasCount } = await supabase
        .from('lifafas')
        .select('status, total_amount, remaining_amount', { count: 'exact' });

      let activeCount = 0;
      let totalDistributed = 0;
      if (lifafasData) {
        lifafasData.forEach((l) => {
          if (l.status === 'ACTIVE') activeCount++;
          totalDistributed += Math.max(0, Number(l.total_amount || 0) - Number(l.remaining_amount || 0));
        });
      }

      // 4. Withdrawals
      const { count: pendingWCount } = await supabase
        .from('withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      const { count: totalWCount } = await supabase
        .from('withdrawals')
        .select('*', { count: 'exact', head: true });

      return {
        totalUsers: usersCount || 0,
        activeUsers: usersCount || 0,
        totalAvailableBalance: totalAvail,
        totalReservedBalance: totalRes,
        totalLifafas: lifafasCount || 0,
        activeLifafas: activeCount,
        totalDistributedAmount: totalDistributed,
        totalWithdrawals: totalWCount || 0,
        pendingWithdrawalsCount: pendingWCount || 0,
        totalPlatformFees: 0,
      };
    } catch (err) {
      console.error('Error fetching admin metrics:', err);
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalAvailableBalance: 0,
        totalReservedBalance: 0,
        totalLifafas: 0,
        activeLifafas: 0,
        totalDistributedAmount: 0,
        totalWithdrawals: 0,
        pendingWithdrawalsCount: 0,
        totalPlatformFees: 0,
      };
    }
  },

  // Users List with Wallets
  async getUsers(): Promise<(Profile & { wallet?: Wallet })[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        wallet:wallets(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return (data || []) as (Profile & { wallet?: Wallet })[];
  },

  // Administrative Wallet Adjustment via server-side RPC
  async adjustWallet(targetUserId: string, amount: number, type: 'CREDIT' | 'DEBIT', reason: string) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('admin_adjust_wallet_rpc', {
      p_target_user_id: targetUserId,
      p_amount: amount,
      p_type: type as TransactionType,
      p_reason: reason.trim(),
    });

    if (error) {
      throw new Error(error.message || 'Failed to adjust wallet');
    }

    return data;
  },

  // Suspend or Unsuspend User
  async toggleUserSuspension(userId: string, isSuspended: boolean) {
    if (!isSupabaseConfigured || !supabase) return;

    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended: isSuspended, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      throw new Error(error.message || 'Failed to update user suspension status');
    }
  },

  // All Lifafas for admin inspection
  async getAllLifafas(): Promise<Lifafa[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('lifafas')
      .select(`
        *,
        creator_profile:profiles!creator_id(full_name, email, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all lifafas:', error);
      return [];
    }

    return (data || []) as Lifafa[];
  },

  // All Withdrawals with user profile details
  async getAllWithdrawals(): Promise<Withdrawal[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('withdrawals')
      .select(`
        *,
        user_profile:profiles!user_id(full_name, email, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all withdrawals:', error);
      return [];
    }

    return (data || []) as Withdrawal[];
  },

  // Process or update withdrawal status via server-side RPC
  async updateWithdrawalStatus(
    withdrawalId: string,
    newStatus: WithdrawalStatus,
    payoutRef?: string,
    rejectionReason?: string
  ) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const { data, error } = await supabase.rpc('admin_update_withdrawal_rpc', {
      p_withdrawal_id: withdrawalId,
      p_new_status: newStatus,
      p_payout_reference_id: payoutRef || null,
      p_rejection_reason: rejectionReason || null,
    });

    if (error) {
      throw new Error(error.message || 'Failed to update withdrawal status');
    }

    return data;
  },

  // Fraud Flags List
  async getFraudFlags(): Promise<FraudFlag[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('fraud_flags')
      .select(`
        *,
        user_profile:profiles!user_id(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching fraud flags:', error);
      return [];
    }

    return (data || []) as FraudFlag[];
  },

  // Resolve Fraud Flag
  async resolveFraudFlag(flagId: string, resolutionNote: string) {
    if (!isSupabaseConfigured || !supabase) return;

    const { error } = await supabase
      .from('fraud_flags')
      .update({
        is_resolved: true,
        resolution_note: resolutionNote,
      })
      .eq('id', flagId);

    if (error) {
      throw new Error(error.message || 'Failed to resolve flag');
    }
  },

  // Immutable Audit Logs
  async getAuditLogs(): Promise<AdminAuditLog[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select(`
        *,
        admin_profile:profiles!admin_id(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return (data || []) as AdminAuditLog[];
  },

  // Update Platform Fee Setting
  async updatePlatformFee(id: string, value: number, calcType: 'FIXED' | 'PERCENTAGE') {
    if (!isSupabaseConfigured || !supabase) return;

    const { error } = await supabase
      .from('platform_fees')
      .update({
        value,
        calculation_type: calcType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(error.message || 'Failed to update platform fee');
    }
  },

  // System-wide Transactions (Double-Entry Ledger)
  async getAllTransactions(): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching admin transactions:', error);
      return [];
    }

    return (data || []);
  },

  // Dispatch System Notification or Broadcast
  async dispatchSystemNotification(params: {
    userId?: string;
    title: string;
    message: string;
    type?: string;
  }) {
    if (!isSupabaseConfigured || !supabase) return;

    if (params.userId) {
      const { error } = await supabase.from('notifications').insert({
        user_id: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || 'SYSTEM',
      });
      if (error) throw new Error(error.message || 'Failed to dispatch notification');
    } else {
      const { data: users } = await supabase.from('profiles').select('id');
      if (users && users.length > 0) {
        const rows = users.map((u) => ({
          user_id: u.id,
          title: params.title,
          message: params.message,
          type: params.type || 'SYSTEM',
        }));
        const { error } = await supabase.from('notifications').insert(rows);
        if (error) throw new Error(error.message || 'Failed to broadcast notification');
      }
    }
  },
};
