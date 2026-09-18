import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Merchant,
  MerchantWallet,
  MerchantPayout,
  MerchantDeposit,
  MerchantLedgerEntry,
  MerchantApiKey,
  MerchantIpWhitelist,
} from '../types/merchant';

export const merchantGatewayService = {
  // Payout Fee Calculation: exact server-aligned rules
  calculatePayoutFee(amount: number): { fee: number; totalDeducted: number } {
    const fee = amount <= 100 ? 3.70 : 3.80;
    return {
      fee,
      totalDeducted: Math.round((amount + fee) * 100) / 100,
    };
  },

  // Deposit Fee Calculation: 2% platform fee
  calculateDepositFee(grossAmount: number): { fee: number; netCredited: number } {
    const fee = Math.round(grossAmount * 0.02 * 100) / 100;
    const netCredited = Math.round((grossAmount - fee) * 100) / 100;
    return { fee, netCredited };
  },

  // Fetch Merchant profile for current authenticated user
  async getMerchantProfile(userId: string): Promise<Merchant | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching merchant profile:', error);
      return null;
    }
    return data as Merchant | null;
  },

  // Fetch Merchant float wallet
  async getMerchantWallet(merchantId: string): Promise<MerchantWallet | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase
      .from('merchant_wallets')
      .select('*')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching merchant wallet:', error);
      return null;
    }
    return data as MerchantWallet | null;
  },

  // Fetch Merchant payouts history
  async getMerchantPayouts(merchantId: string): Promise<MerchantPayout[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_payouts')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching merchant payouts:', error);
      return [];
    }
    return (data || []) as MerchantPayout[];
  },

  // Fetch Merchant deposit requests
  async getMerchantDeposits(merchantId: string): Promise<MerchantDeposit[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_deposits')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching merchant deposits:', error);
      return [];
    }
    return (data || []) as MerchantDeposit[];
  },

  // Fetch Merchant float audit ledger entries
  async getMerchantLedger(merchantId: string): Promise<MerchantLedgerEntry[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_ledger_entries')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching merchant ledger:', error);
      return [];
    }
    return (data || []) as MerchantLedgerEntry[];
  },

  // Fetch Merchant API keys via secure RPC (never exposes client_secret_hash)
  async getMerchantApiKeys(merchantId: string): Promise<MerchantApiKey[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase.rpc('merchant_list_api_keys_rpc', {
      p_merchant_id: merchantId,
    });

    if (error) {
      console.error('Error fetching merchant API keys:', error);
      return [];
    }
    return (data || []) as MerchantApiKey[];
  },

  // Fetch Merchant IP whitelist
  async getMerchantIpWhitelist(merchantId: string): Promise<MerchantIpWhitelist[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_ip_whitelist')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching merchant IP whitelist:', error);
      return [];
    }
    return (data || []) as MerchantIpWhitelist[];
  },

  // Submit new float top-up via secure RPC (server calculates fee & net credit, strict PENDING)
  async submitDeposit(params: {
    merchantId: string;
    grossAmount: number;
    utrNumber: string;
  }): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.rpc('merchant_submit_deposit_rpc', {
      p_merchant_id: params.merchantId,
      p_gross_amount: params.grossAmount,
      p_utr_number: params.utrNumber.trim().toUpperCase(),
    });

    if (error || !data?.success) {
      throw new Error(error?.message || 'Failed to submit deposit request');
    }

    return { success: true };
  },

  // Request payout via dedicated merchant-payrupee-payout Edge Function
  async createPayout(params: {
    orderId: string;
    amount: number;
    recipient: {
      name: string;
      account_number: string;
      ifsc: string;
    };
    idempotencyKey?: string;
  }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.functions.invoke('merchant-payrupee-payout', {
      body: {
        order_id: params.orderId,
        amount: params.amount,
        recipient: {
          name: params.recipient.name.trim(),
          account_number: params.recipient.account_number.trim(),
          ifsc: params.recipient.ifsc.trim().toUpperCase(),
        },
        idempotency_key: params.idempotencyKey || null,
      },
    });

    if (error) {
      const errMsg = data?.error || data?.message || error.message || 'Payout request failed';
      throw new Error(errMsg);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  },

  // Generate new API Key pair server-side (secret returned ONCE)
  async generateApiKey(params: {
    merchantId: string;
    keyName: string;
  }): Promise<{ clientId: string; clientSecret: string }> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.rpc('merchant_generate_api_key_rpc', {
      p_merchant_id: params.merchantId,
      p_key_name: params.keyName.trim() || 'Primary API Key',
    });

    if (error || !data?.success) {
      throw new Error(error?.message || 'Failed to generate API Key');
    }

    // Return the plaintext secret ONCE to the user
    return {
      clientId: data.client_id,
      clientSecret: data.client_secret,
    };
  },

  // Revoke API Key
  async revokeApiKey(keyId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.rpc('merchant_revoke_api_key_rpc', {
      p_key_id: keyId,
    });

    if (error) {
      throw new Error(error.message || 'Failed to revoke API Key');
    }
  },

  // Add IP address to whitelist
  // Add IP address to whitelist via secure RPC
  async addIpWhitelist(params: {
    merchantId: string;
    ipAddress: string;
    description?: string;
  }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');

    const { data, error } = await supabase.rpc('merchant_add_ip_whitelist_rpc', {
      p_merchant_id: params.merchantId,
      p_ip_address: params.ipAddress.trim(),
      p_description: params.description?.trim() || null,
    });

    if (error || !data?.success) throw new Error(error?.message || 'Failed to add IP whitelist entry');
  },

  // Delete IP from whitelist via secure RPC
  async deleteIpWhitelist(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');
    const { data, error } = await supabase.rpc('merchant_remove_ip_whitelist_rpc', {
      p_whitelist_id: id,
    });
    if (error || !data?.success) throw new Error(error?.message || 'Failed to remove IP whitelist entry');
  },

  // ================= ADMIN GATEWAY METHODS =================

  // Fetch all merchants for Admin Panel
  async getAllMerchants(): Promise<Merchant[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching all merchants:', error);
      return [];
    }
    return (data || []) as Merchant[];
  },

  // Fetch all merchant deposits for Admin Panel
  async getAllMerchantDeposits(): Promise<MerchantDeposit[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_deposits')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching all merchant deposits:', error);
      return [];
    }
    return (data || []) as MerchantDeposit[];
  },

  // Fetch all merchant payouts for Admin Panel
  async getAllMerchantPayouts(): Promise<MerchantPayout[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_payouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);
    if (error) {
      console.error('Error fetching all merchant payouts:', error);
      return [];
    }
    return (data || []) as MerchantPayout[];
  },

  // Fetch all merchant wallets for Admin Panel
  async getAllMerchantWallets(): Promise<MerchantWallet[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_wallets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching all merchant wallets:', error);
      return [];
    }
    return (data || []) as MerchantWallet[];
  },

  // Fetch all merchant ledger entries for Admin Panel
  async getAllMerchantLedger(): Promise<MerchantLedgerEntry[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_ledger_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('Error fetching all merchant ledger entries:', error);
      return [];
    }
    return (data || []) as MerchantLedgerEntry[];
  },

  // Fetch all merchant payout webhook events for Admin Panel
  async getAllMerchantEvents(): Promise<any[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    const { data, error } = await supabase
      .from('merchant_payout_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Error fetching all merchant payout events:', error);
      return [];
    }
    return data || [];
  },

  // Admin Approve Merchant Deposit via secure RPC
  async approveMerchantDeposit(depositId: string, adminNotes?: string): Promise<{ success: boolean; netCredited?: number }> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');
    const { data, error } = await supabase.rpc('admin_approve_merchant_deposit_rpc', {
      p_deposit_id: depositId,
      p_admin_notes: adminNotes || null,
    });
    if (error || !data?.success) {
      throw new Error(error?.message || 'Failed to approve deposit');
    }
    return data;
  },

  // Admin Reject Merchant Deposit via secure RPC
  async rejectMerchantDeposit(depositId: string, adminNotes?: string): Promise<{ success: boolean }> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');
    const { data, error } = await supabase.rpc('admin_reject_merchant_deposit_rpc', {
      p_deposit_id: depositId,
      p_admin_notes: adminNotes || 'Rejected by platform administrator',
    });
    if (error || !data?.success) {
      throw new Error(error?.message || 'Failed to reject deposit');
    }
    return data;
  },

  // Submit ₹999 Setup Fee Payment Reference for Verification (Provider-Agnostic)
  // Strictly transitions status to PAYMENT_PENDING awaiting administrative/provider verification
  async submitSetupFeePayment(
    merchantId: string,
    reference?: string,
    method?: string
  ): Promise<{ success: boolean; setup_fee_status: string; status: string; message: string }> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');

    const cleanRef = reference?.trim();
    if (!cleanRef) {
      throw new Error('A valid payment reference or transaction UTR is required');
    }
    const paymentMethod = method || 'DIRECT_CLAIM';

    const { data, error } = await supabase.rpc('merchant_submit_setup_fee_payment_rpc', {
      p_merchant_id: merchantId,
      p_payment_reference: cleanRef,
      p_payment_method: paymentMethod,
    });

    if (error || !data?.success) {
      throw new Error(error?.message || data?.message || 'Failed to submit payment reference for verification');
    }

    return data;
  },

  // Admin Approve Merchant Gateway (Strictly checks setup_fee_status = PAID)
  async adminApproveMerchant(
    merchantId: string,
    adminNotes?: string
  ): Promise<{ success: boolean; message: string; status: string }> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');

    const { data, error } = await supabase.rpc('admin_approve_merchant_rpc', {
      p_merchant_id: merchantId,
      p_admin_notes: adminNotes || null,
    });

    if (error) {
      console.warn('RPC admin_approve_merchant_rpc failed, attempting admin update fallback:', error);
      // Query setup fee status first to strictly enforce PAID check
      const { data: mch, error: mchErr } = await supabase
        .from('merchants')
        .select('setup_fee_status')
        .eq('id', merchantId)
        .single();

      if (mchErr || !mch) {
        throw new Error('Merchant record not found');
      }

      if (mch.setup_fee_status !== 'PAID') {
        throw new Error(`Cannot approve merchant: ₹999 setup fee is not PAID (current status: ${mch.setup_fee_status})`);
      }

      const { error: updateErr } = await supabase
        .from('merchants')
        .update({ status: 'ACTIVE' })
        .eq('id', merchantId);

      if (updateErr) {
        throw new Error(updateErr.message || 'Failed to approve merchant');
      }

      return { success: true, message: 'Merchant gateway activated successfully', status: 'ACTIVE' };
    }

    return data;
  },

  // Admin Override / Record Setup Fee Status
  async adminRecordSetupFee(
    merchantId: string,
    status: 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAID' | 'FAILED',
    reference?: string,
    method?: string
  ): Promise<{ success: boolean; setup_fee_status: string }> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');

    const { data, error } = await supabase.rpc('admin_record_merchant_setup_fee_rpc', {
      p_merchant_id: merchantId,
      p_setup_fee_status: status,
      p_payment_reference: reference || null,
      p_payment_method: method || 'ADMIN_OVERRIDE',
    });

    if (error) {
      console.warn('RPC admin_record_merchant_setup_fee_rpc failed, attempting direct update fallback:', error);
      const updatePayload: any = {
        setup_fee_status: status,
        setup_fee_payment_method: method || 'ADMIN_OVERRIDE',
      };
      if (status === 'PAID') {
        updatePayload.setup_fee_reference = reference || `ADMIN-REF-${Date.now().toString().slice(-6)}`;
        updatePayload.setup_fee_paid_at = new Date().toISOString();
      }
      const { error: updateErr } = await supabase
        .from('merchants')
        .update(updatePayload)
        .eq('id', merchantId);

      if (updateErr) throw new Error(updateErr.message);
      return { success: true, setup_fee_status: status };
    }

    return data;
  },
};
