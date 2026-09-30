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

export interface MerchantUpiSettings {
  payeeName: string;
  upiId: string;
  qrImageUrl: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export const DEFAULT_MERCHANT_UPI_SETTINGS: MerchantUpiSettings = {
  payeeName: 'Createlifafa Payout Gateway',
  upiId: 'createlifafa@upi',
  qrImageUrl: '',
  status: 'ACTIVE',
};

export const MERCHANT_UPI_SETTINGS_STORAGE_KEY = 'lifafa_merchant_upi_settings';
export const MERCHANT_UPI_SETTINGS_EVENT = 'lifafa_merchant_upi_settings_updated';

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
    if (userId === 'dev-demo-user-001') {
      return {
        id: 'dev-demo-merchant-001',
        user_id: 'dev-demo-user-001',
        merchant_code: 'MCH-DEMO88',
        business_name: 'Alpha Apex Technologies',
        mobile_number: '9876543210',
        status: 'ACTIVE',
        setup_fee_status: 'PAID',
        setup_fee_amount: 0,
        setup_fee_payment_method: 'FREE_ACTIVATION',
        setup_fee_paid_at: new Date().toISOString(),
        setup_fee_reference: 'FREE_ACTIVATION_MCH-DEMO88',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

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
    if (merchantId === 'dev-demo-merchant-001') {
      return {
        id: 'dev-demo-wallet-001',
        merchant_id: 'dev-demo-merchant-001',
        available_balance: 48500.00,
        locked_payout_balance: 1500.00,
        total_deposited: 125000.00,
        total_paid_out: 75000.00,
        total_fees_paid: 3070.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

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

  // Proactively validate and obtain fresh access token for authenticated merchant session
  async getValidSessionToken(): Promise<string> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    // 1. Get current session
    let { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    // 2. If no session or error, attempt refresh
    if (sessionErr || !session) {
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshData?.session) {
        throw new Error('Your session has expired. Please sign in again to initiate payouts.');
      }
      session = refreshData.session;
    }

    // 3. Proactively refresh if token is expired or expiring within 60 seconds
    const nowSec = Math.floor(Date.now() / 1000);
    if (!session.expires_at || session.expires_at <= nowSec + 60) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshed?.session) {
        throw new Error('Your session has expired. Please sign in again to initiate payouts.');
      }
      session = refreshed.session;
    }

    if (!session?.access_token) {
      throw new Error('No active authenticated session found. Please sign in again.');
    }

    return session.access_token;
  },

  // Helper to extract sanitized, detailed error from Supabase Edge Function invocation
  async parseEdgeFunctionError(
    error: any,
    response?: Response,
    data?: any
  ): Promise<string> {
    // 1. Data-level error returned by function
    if (data?.error) {
      return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }
    if (data?.message && !data?.success) {
      return String(data.message);
    }

    // 2. HTTP response extraction (from response or error.context)
    const resp: Response | undefined =
      response || (error?.context instanceof Response ? error.context : undefined);
    const status = resp?.status;

    let serverBodyMsg: string | undefined;
    if (resp) {
      try {
        const cloned = typeof resp.clone === 'function' ? resp.clone() : resp;
        const text = await cloned.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            serverBodyMsg = json?.error || json?.message || json?.details;
          } catch {
            serverBodyMsg = text.length > 250 ? text.slice(0, 250) + '...' : text;
          }
        }
      } catch {
        // Stream read fallback
      }
    }

    if (serverBodyMsg) {
      return status ? `[HTTP ${status}] ${serverBodyMsg}` : serverBodyMsg;
    }

    // 3. Client network/CORS error (FunctionsFetchError)
    if (error?.name === 'FunctionsFetchError' || error?.message?.includes('Failed to send a request')) {
      const innerContext = error?.context;
      const innerMsg =
        innerContext?.message ||
        innerContext?.name ||
        (typeof innerContext === 'string' ? innerContext : '');
      const detailStr = innerMsg ? ` (${innerMsg})` : '';
      return `Failed to reach Edge Function: Network or CORS connection issue${detailStr}. Please verify connection and retry.`;
    }

    // 4. Relay Error (FunctionsRelayError)
    if (error?.name === 'FunctionsRelayError') {
      return `Edge Gateway Relay error: ${error.message || 'Unable to route request'}`;
    }

    // 5. Http error fallback (FunctionsHttpError)
    if (status) {
      return `Edge Function error [HTTP ${status}]: ${error?.message || 'Request failed'}`;
    }

    return error?.message || 'Payout request failed';
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

    // 1. Validate session and obtain fresh access token
    const token = await this.getValidSessionToken();

    // 2. Construct explicit headers
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (params.idempotencyKey) {
      headers['x-idempotency-key'] = params.idempotencyKey;
    }

    const payload = {
      order_id: params.orderId,
      amount: params.amount,
      recipient: {
        name: params.recipient.name.trim(),
        account_number: params.recipient.account_number.trim(),
        ifsc: params.recipient.ifsc.trim().toUpperCase(),
      },
      idempotency_key: params.idempotencyKey || null,
    };

    // 3. Invoke Edge Function with explicit fresh Bearer token
    let { data, error, response } = await supabase.functions.invoke('merchant-payrupee-payout', {
      headers,
      body: payload,
    });

    // 4. If FunctionsFetchError occurred, attempt direct fetch fallback
    if (error && (error.name === 'FunctionsFetchError' || error.message?.includes('Failed to send a request'))) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (supabaseUrl && typeof window !== 'undefined' && typeof window.fetch === 'function') {
        try {
          const directHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey || '',
            Authorization: `Bearer ${token}`,
          };
          if (params.idempotencyKey) {
            directHeaders['x-idempotency-key'] = params.idempotencyKey;
          }

          const directResp = await window.fetch(
            `${supabaseUrl}/functions/v1/merchant-payrupee-payout`,
            {
              method: 'POST',
              headers: directHeaders,
              body: JSON.stringify(payload),
            }
          );

          response = directResp;
          const directText = await directResp.text();
          let directJson: any = null;
          try {
            directJson = JSON.parse(directText);
          } catch {
            directJson = null;
          }

          if (directResp.ok && directJson) {
            data = directJson;
            error = null;
          } else {
            const directErrMsg =
              directJson?.error ||
              directJson?.message ||
              `[HTTP ${directResp.status}] ${directText.slice(0, 250) || 'Direct request failed'}`;
            throw new Error(directErrMsg);
          }
        } catch (fetchFallbackErr: any) {
          const msg = await this.parseEdgeFunctionError(error, response, data);
          throw new Error(
            fetchFallbackErr.message && !fetchFallbackErr.message.includes('Failed to fetch')
              ? fetchFallbackErr.message
              : msg
          );
        }
      }
    }

    if (error) {
      const errMsg = await this.parseEdgeFunctionError(error, response, data);
      throw new Error(errMsg);
    }

    if (data?.error) {
      throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
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

  // Server-side Onboard Merchant via SECURITY DEFINER RPC (Zero Setup Fee, Instant Active)
  async onboardMerchant(
    businessName: string,
    mobileNumber: string
  ): Promise<{ success: boolean; is_existing: boolean; merchant: Merchant; wallet: MerchantWallet }> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured');

    const cleanName = (businessName || '').trim();
    const cleanMobile = (mobileNumber || '').replace(/\D/g, '');

    if (cleanName.length < 2) {
      throw new Error('Business name must be at least 2 characters');
    }
    if (cleanMobile.length !== 10) {
      throw new Error('Please enter a valid 10-digit Indian mobile number');
    }

    const { data, error } = await supabase.rpc('merchant_onboard_user_rpc', {
      p_business_name: cleanName,
      p_mobile_number: cleanMobile,
    });

    if (error) {
      throw new Error(error.message || 'Failed to onboard merchant');
    }

    if (!data?.success || !data?.merchant) {
      throw new Error(data?.message || 'Merchant onboarding failed');
    }

    return data;
  },

  // Submit Setup Fee Payment (Legacy no-op / backward compatibility)
  async submitSetupFeePayment(
    merchantId: string,
    reference?: string,
    method?: string
  ): Promise<{ success: boolean; setup_fee_status: string; status: string; message: string }> {
    return {
      success: true,
      setup_fee_status: 'PAID',
      status: 'ACTIVE',
      message: 'Setup fee is ₹0 under updated platform policy',
    };
  },

  // Admin Approve Merchant Gateway (Zero fee required)
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
      console.warn('RPC admin_approve_merchant_rpc notice, attempting direct admin update:', error);
      const { error: updateErr } = await supabase
        .from('merchants')
        .update({ status: 'ACTIVE', setup_fee_status: 'PAID', setup_fee_amount: 0.00 })
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

  // Get active Merchant Gateway UPI Collection settings with local cache & fallback
  async getMerchantUpiSettings(): Promise<MerchantUpiSettings> {
    let cached: MerchantUpiSettings = { ...DEFAULT_MERCHANT_UPI_SETTINGS };
    try {
      const item = localStorage.getItem(MERCHANT_UPI_SETTINGS_STORAGE_KEY);
      if (item) {
        cached = { ...DEFAULT_MERCHANT_UPI_SETTINGS, ...JSON.parse(item) };
      }
    } catch (e) {
      // Ignore localStorage read errors
    }

    if (!isSupabaseConfigured || !supabase) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', [
          'MERCHANT_UPI_PAYEE_NAME',
          'MERCHANT_UPI_ID',
          'MERCHANT_UPI_QR_IMAGE_URL',
          'MERCHANT_UPI_STATUS',
        ]);

      if (error || !data || data.length === 0) {
        return cached;
      }

      const map = new Map<string, string>();
      for (const row of data) {
        if (row.key && row.value !== null && row.value !== undefined) {
          map.set(row.key, row.value);
        }
      }

      const settings: MerchantUpiSettings = {
        payeeName: map.get('MERCHANT_UPI_PAYEE_NAME') || cached.payeeName || DEFAULT_MERCHANT_UPI_SETTINGS.payeeName,
        upiId: map.get('MERCHANT_UPI_ID') || cached.upiId || DEFAULT_MERCHANT_UPI_SETTINGS.upiId,
        qrImageUrl: map.has('MERCHANT_UPI_QR_IMAGE_URL') ? (map.get('MERCHANT_UPI_QR_IMAGE_URL') || '') : (cached.qrImageUrl || ''),
        status: map.has('MERCHANT_UPI_STATUS')
          ? (map.get('MERCHANT_UPI_STATUS') === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')
          : (cached.status || DEFAULT_MERCHANT_UPI_SETTINGS.status),
      };

      try {
        localStorage.setItem(MERCHANT_UPI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {}

      return settings;
    } catch (err) {
      console.warn('Non-blocking error reading merchant UPI settings from database:', err);
      return cached;
    }
  },

  // Save Merchant Gateway UPI Collection settings with multi-key persistence, local cache, and audit log
  async updateMerchantUpiSettings(newSettings: MerchantUpiSettings): Promise<MerchantUpiSettings> {
    const cleanSettings: MerchantUpiSettings = {
      payeeName: newSettings.payeeName.trim() || DEFAULT_MERCHANT_UPI_SETTINGS.payeeName,
      upiId: newSettings.upiId.trim() || DEFAULT_MERCHANT_UPI_SETTINGS.upiId,
      qrImageUrl: newSettings.qrImageUrl?.trim() || '',
      status: newSettings.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    };

    // 1. Update localStorage cache immediately
    try {
      localStorage.setItem(MERCHANT_UPI_SETTINGS_STORAGE_KEY, JSON.stringify(cleanSettings));
    } catch (e) {
      console.warn('Failed to cache merchant upi settings in localStorage:', e);
    }

    // 2. Broadcast event to open components and tabs
    try {
      window.dispatchEvent(
        new CustomEvent(MERCHANT_UPI_SETTINGS_EVENT, { detail: cleanSettings })
      );
    } catch {}

    // 3. Persist to Supabase platform_settings if configured
    if (isSupabaseConfigured && supabase) {
      const updates = [
        { key: 'MERCHANT_UPI_PAYEE_NAME', value: cleanSettings.payeeName, desc: 'Merchant Gateway UPI Payee Display Name' },
        { key: 'MERCHANT_UPI_ID', value: cleanSettings.upiId, desc: 'Merchant Gateway UPI Virtual Payment Address (VPA)' },
        { key: 'MERCHANT_UPI_QR_IMAGE_URL', value: cleanSettings.qrImageUrl, desc: 'Merchant Gateway Custom QR Code Image URL or Data URI' },
        { key: 'MERCHANT_UPI_STATUS', value: cleanSettings.status, desc: 'Merchant Gateway UPI Collection Status (ACTIVE/INACTIVE)' },
      ];

      await Promise.all(
        updates.map(async (item) => {
          // Attempt via RPC first
          const { error: rpcErr } = await supabase.rpc('admin_update_platform_setting_rpc', {
            p_key: item.key,
            p_value: item.value,
            p_description: item.desc,
          });

          if (rpcErr) {
            // Fallback to direct upsert
            const { error: upsertErr } = await supabase
              .from('platform_settings')
              .upsert(
                { key: item.key, value: item.value, description: item.desc, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
              );
            if (upsertErr) {
              console.warn(`Upsert fallback error for ${item.key}:`, upsertErr);
            }
          }
        })
      );

      // 4. Record audit log in admin_audit_logs if supported
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('admin_audit_logs').insert({
            admin_id: user.id,
            action: 'UPDATE_MERCHANT_UPI_SETTINGS',
            target_type: 'PLATFORM_SETTINGS',
            target_id: 'MERCHANT_UPI_COLLECTION',
            details: {
              payee_name: cleanSettings.payeeName,
              upi_id: cleanSettings.upiId,
              status: cleanSettings.status,
              has_custom_qr: Boolean(cleanSettings.qrImageUrl),
            },
            created_at: new Date().toISOString(),
          });
        }
      } catch (auditErr) {
        console.warn('Non-blocking audit log record failed:', auditErr);
      }
    }

    return cleanSettings;
  },
};
