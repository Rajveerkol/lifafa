import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { calculateWithdrawalFee, calculateDepositFee as calcUnifiedDepositFee } from '../lib/feeCalculations';
import type {
  Merchant,
  MerchantWallet,
  MerchantPayout,
  MerchantDeposit,
  MerchantLedgerEntry,
  MerchantApiKey,
  MerchantIpWhitelist,
  MerchantUnifiedTransaction,
  MerchantFinancialAnalytics,
  MerchantTransactionsQueryParams,
  MerchantTransactionsResponse,
  MerchantDailyVolumePoint,
} from '../types/merchant';

// ==============================================================================
// TIMEZONE CALCULATION UTILITIES (INDIA STANDARD TIME: UTC+05:30)
// ==============================================================================

/**
 * Returns exact start and end UTC timestamps corresponding to a specific day in IST (UTC+05:30).
 * daysAgo = 0: Today in IST
 * daysAgo = 1: Yesterday in IST
 */
export function getIstDayBoundaries(daysAgo: number = 0, timezoneOffsetMinutes: number = 330): {
  startUtc: Date;
  endUtc: Date;
  dateStr: string;
} {
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const nowUtc = Date.now();
  const nowIst = new Date(nowUtc + offsetMs);

  const targetIst = new Date(nowIst);
  targetIst.setUTCDate(targetIst.getUTCDate() - daysAgo);

  const year = targetIst.getUTCFullYear();
  const month = targetIst.getUTCMonth();
  const date = targetIst.getUTCDate();

  const startUtc = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - offsetMs);
  const endUtc = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - offsetMs);

  const monthStr = String(month + 1).padStart(2, '0');
  const dateStr = String(date).padStart(2, '0');
  const isoDateStr = `${year}-${monthStr}-${dateStr}`;

  return { startUtc, endUtc, dateStr: isoDateStr };
}

/**
 * Deterministically generates mock transactions for demo merchant mode (>250 records).
 * Enables offline and review testing across Page 1 (100), Page 2 (100), Page 3 (65+).
 */
function generateDemoTransactions(merchantId: string, targetCount?: number): MerchantUnifiedTransaction[] {
  const transactions: MerchantUnifiedTransaction[] = [];
  const baseTime = Date.now();

  let count = targetCount;
  if (count === undefined) {
    if (merchantId === 'demo-merchant-0') count = 0;
    else if (merchantId === 'demo-merchant-75') count = 75;
    else if (merchantId === 'demo-merchant-350') count = 350;
    else if (merchantId === 'demo-merchant-2106') count = 2106;
    else if (merchantId === 'demo-merchant-10500') count = 10500;
    else if (merchantId === 'dev-demo-merchant-001') count = 2106;
    else count = 265;
  }

  if (count === 0) return [];

  // Generate deposits and payouts with realistic distribution
  const numDeposits = Math.max(0, Math.min(106, Math.floor(count * 0.1)));
  const numPayouts = count - numDeposits;

  // Deposits
  for (let i = 1; i <= numDeposits; i++) {
    const hoursAgo = (i * 3.5) + (i % 5) * 0.5;
    const createdAt = new Date(baseTime - hoursAgo * 3600 * 1000).toISOString();
    const grossAmount = 500 + ((i * 350) % 15000);
    const depositFee = grossAmount < 1000 ? 100 : Math.round(grossAmount * 0.02 * 100) / 100;
    const netCredited = grossAmount;

    let status: 'SUCCESS' | 'PENDING' | 'REJECTED' = 'SUCCESS';
    if (i <= 8) status = 'PENDING';
    else if (i === 12 || i === 25 || i === 48) status = 'REJECTED';

    const utr = `UTR${String(982000000000 + i * 137).padStart(12, '0')}`;
    const id = `demo-dep-${String(i).padStart(6, '0')}`;

    transactions.push({
      id,
      merchant_id: merchantId,
      type: 'DEPOSIT',
      reference_id: utr,
      provider_order_id: `DEP-REF-${1000 + i}`,
      provider_reference_id: utr,
      amount: grossAmount,
      fee: depositFee,
      net_amount: netCredited,
      status,
      payment_method: 'UPI',
      recipient_or_sender: 'Float Top-Up (PayNit / UPI)',
      created_at: createdAt,
      reviewed_or_processed_at: status !== 'PENDING' ? createdAt : null,
      notes_or_reason: status === 'REJECTED' ? 'UTR verification failed with bank' : (status === 'SUCCESS' ? 'Admin approved float credit' : 'Pending bank verification'),
      raw_data: {
        gross_amount: grossAmount,
        deposit_fee: depositFee,
        net_credited: netCredited,
        utr_number: utr,
      },
    });
  }

  // Withdrawals / Payouts
  for (let i = 1; i <= numPayouts; i++) {
    const hoursAgo = (i * 0.8) + (i % 7) * 0.1;
    const createdAt = new Date(baseTime - hoursAgo * 3600 * 1000).toISOString();
    const amount = 50 + ((i * 125) % 4500);
    const fee = amount < 500 ? 3.00 : (amount < 1000 ? 5.00 : 10.00);
    const totalDeducted = Math.round((amount + fee) * 100) / 100;

    let status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REJECTED' = 'SUCCESS';
    if (i <= 6) status = 'PENDING';
    else if (i % 47 === 0) status = 'FAILED';
    else if (i % 53 === 0) status = 'REJECTED';

    const orderId = `ORD-2026-${String(20000 + i)}`;
    const providerOrderId = `PO-${String(88000000 + i)}`;
    const providerRef = status === 'SUCCESS' ? `RRN${900000000000 + (i % 100000) * 29}` : null;
    const id = `demo-wth-${String(i).padStart(6, '0')}`;

    transactions.push({
      id,
      merchant_id: merchantId,
      type: 'WITHDRAWAL',
      reference_id: orderId,
      provider_order_id: providerOrderId,
      provider_reference_id: providerRef,
      amount,
      fee,
      net_amount: totalDeducted,
      status,
      payment_method: 'UPI',
      recipient_or_sender: `vendor${i}@okhdfcbank`,
      created_at: createdAt,
      reviewed_or_processed_at: status !== 'PENDING' ? createdAt : null,
      notes_or_reason: status === 'FAILED' ? 'Bank server timeout (Safe refunded)' : (status === 'REJECTED' ? 'Beneficiary VPA invalid' : 'Dispatched via PayNit UPI'),
      raw_data: {
        order_id: orderId,
        provider_order_id: providerOrderId,
        amount,
        fee_amount: fee,
        total_deducted: totalDeducted,
      },
    });
  }

  // Stable sorting by creation time descending, tie-break by ID
  transactions.sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });

  return transactions;
}

export interface MerchantUpiSettings {
  payeeName: string;
  upiId: string;
  qrImageUrl: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface MerchantOrderStatusCheckResult {
  success: boolean;
  status?: 'SUCCESS' | 'PROCESSING' | 'FAILED' | 'UNKNOWN';
  order_id?: string;
  amount?: number;
  fee?: number;
  total_deducted?: number;
  utr?: string;
  provider_reference_id?: string;
  refunded?: boolean;
  already_refunded?: boolean;
  is_historical?: boolean;
  no_deduction?: boolean;
  refund_status?: 'REFUNDED' | 'NOT_APPLICABLE';
  refund_amount?: number;
  rejection_reason?: string;
  message?: string;
  error?: string;
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
  // Payout Fee Calculation: Authoritative fee slabs unified with website wallet
  calculatePayoutFee(amount: number): { fee: number; totalDeducted: number } {
    return calculateWithdrawalFee(amount);
  },

  // Deposit Fee Calculation: Authoritative fee slabs (Flat ₹100 for <₹1000, 2% for >=₹1000)
  calculateDepositFee(depositAmount: number): {
    depositAmount: number;
    fee: number;
    totalPayable: number;
    walletCredit: number;
    netCredited: number;
  } {
    const res = calcUnifiedDepositFee(depositAmount);
    return {
      depositAmount: res.depositAmount,
      fee: res.fee,
      totalPayable: res.totalPayable,
      walletCredit: res.walletCredit,
      netCredited: res.walletCredit, // Backwards-compatibility alias
    };
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

  // Fetch Merchant float wallet (Reads ONE shared wallet balance from public.wallets)
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

    // 1. Resolve the merchant to find user_id
    const { data: merchant, error: mchErr } = await supabase
      .from('merchants')
      .select('id, user_id')
      .eq('id', merchantId)
      .maybeSingle();

    if (mchErr || !merchant) {
      console.error('Error fetching merchant for shared wallet:', mchErr);
      return null;
    }

    // 2. Fetch the authoritative single user wallet from public.wallets
    const { data: userWallet, error: userWalletErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', merchant.user_id)
      .maybeSingle();

    if (userWalletErr) {
      console.error('Error fetching authoritative shared wallet:', userWalletErr);
    }

    // 3. Also fetch merchant_wallets record for isolated stats (locked_payout_balance, totals)
    const { data: mchWallet } = await supabase
      .from('merchant_wallets')
      .select('*')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (!userWallet && !mchWallet) return null;

    // Return the authoritative user wallet available_balance as the shared balance
    const sharedAvailable = userWallet ? Number(userWallet.available_balance) : (mchWallet ? Number(mchWallet.available_balance) : 0);

    return {
      id: mchWallet?.id || userWallet?.id || merchantId,
      merchant_id: merchantId,
      available_balance: sharedAvailable,
      locked_payout_balance: mchWallet ? Number(mchWallet.locked_payout_balance) : 0,
      total_deposited: mchWallet ? Number(mchWallet.total_deposited ?? 0) : 0,
      total_paid_out: userWallet ? Number(userWallet.total_withdrawn ?? mchWallet?.total_paid_out ?? 0) : (mchWallet ? Number(mchWallet.total_paid_out) : 0),
      total_fees_paid: mchWallet ? Number(mchWallet.total_fees_paid) : 0,
      created_at: mchWallet?.created_at || userWallet?.created_at || new Date().toISOString(),
      updated_at: userWallet?.updated_at || mchWallet?.updated_at || new Date().toISOString(),
    };
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

  // Fetch Merchant API keys via multi-strategy redundancy (Edge Function, RPC, Direct Select)
  async getMerchantApiKeys(merchantId: string): Promise<MerchantApiKey[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    // Strategy 1: Edge Function using authenticated user session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const edgeRes = await fetch('https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/merchant-paynit-payout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'list_api_keys', merchant_id: merchantId }),
        });
        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (edgeData?.success && Array.isArray(edgeData.keys)) {
            return edgeData.keys as MerchantApiKey[];
          }
        }
      }
    } catch (edgeErr) {
      console.warn('Edge Function list_api_keys fallback:', edgeErr);
    }

    // Strategy 2: RPC merchant_list_api_keys_rpc
    try {
      const { data, error } = await supabase.rpc('merchant_list_api_keys_rpc', {
        p_merchant_id: merchantId,
      });

      if (!error && Array.isArray(data)) {
        return data as MerchantApiKey[];
      }
      if (error) {
        console.warn('merchant_list_api_keys_rpc fallback:', error);
      }
    } catch (rpcErr) {
      console.warn('RPC merchant_list_api_keys_rpc exception:', rpcErr);
    }

    // Strategy 3: Direct RLS select on safe columns (excludes client_secret_hash)
    try {
      const { data: directData, error: directErr } = await supabase
        .from('merchant_api_keys')
        .select('id, merchant_id, key_name, client_id, is_active, last_used_at, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      if (!directErr && Array.isArray(directData)) {
        return directData as MerchantApiKey[];
      }
      if (directErr) {
        console.warn('Direct query on merchant_api_keys error:', directErr);
      }
    } catch (directCatchErr) {
      console.warn('Direct query exception:', directCatchErr);
    }

    return [];
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
  }): Promise<{
    success: boolean;
    deposit_id?: string;
    status?: string;
    amount?: number;
    total_payable?: number;
    utr_number?: string;
    message?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const cleanUtr = params.utrNumber.trim().toUpperCase();

    const { data, error } = await supabase.rpc('merchant_submit_deposit_rpc', {
      p_merchant_id: params.merchantId,
      p_gross_amount: params.grossAmount,
      p_utr_number: cleanUtr,
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit deposit request');
    }

    if (data && data.success === false) {
      throw new Error(data.error || data.message || 'Failed to submit deposit request');
    }

    return {
      success: true,
      deposit_id: data?.deposit_id,
      status: data?.status || 'PENDING',
      amount: data?.deposit_amount ?? params.grossAmount,
      total_payable: data?.total_payable,
      utr_number: data?.utr_number || cleanUtr,
      message: data?.message,
    };
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

  // Request payout via PayNit Edge Function (UPI ONLY)
  async createPayout(params: {
    orderId: string;
    amount: number;
    method?: 'UPI' | 'IMPS';
    upiId?: string;
    recipient?: {
      name: string;
      account_number: string;
      ifsc: string;
    };
    note?: string;
    idempotencyKey?: string;
  }): Promise<any> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    // Strict UPI-Only Architecture Enforcement
    if (params.method === 'IMPS' || params.recipient) {
      throw new Error('IMPS payouts are no longer supported. All payouts are processed via UPI only.');
    }

    const cleanUpi = params.upiId?.trim()?.toLowerCase();
    if (!cleanUpi) {
      throw new Error('A valid UPI ID is required for payout.');
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

    const payload: any = {
      order_id: params.orderId.trim(),
      amount: params.amount,
      payout_method: 'UPI',
      method: 'UPI',
      upi_id: cleanUpi,
      note: params.note || 'Merchant Payout',
      idempotency_key: params.idempotencyKey || null,
    };

    // 3. Invoke Edge Function with explicit fresh Bearer token
    // Try merchant-paynit-payout first, falling back to merchant-payrupee-payout if needed
    let functionName = 'merchant-paynit-payout';
    let { data, error, response } = await supabase.functions.invoke(functionName, {
      headers,
      body: payload,
    });

    if (error && (error.name === 'FunctionsNotFoundError' || (error as any).status === 404)) {
      functionName = 'merchant-payrupee-payout';
      const fallbackResult = await supabase.functions.invoke(functionName, {
        headers,
        body: payload,
      });
      data = fallbackResult.data;
      error = fallbackResult.error;
      response = fallbackResult.response;
    }

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

          let directResp = await window.fetch(
            `${supabaseUrl}/functions/v1/${functionName}`,
            {
              method: 'POST',
              headers: directHeaders,
              body: JSON.stringify(payload),
            }
          );

          if (!directResp.ok && directResp.status === 404 && functionName === 'merchant-paynit-payout') {
            functionName = 'merchant-payrupee-payout';
            directResp = await window.fetch(
              `${supabaseUrl}/functions/v1/${functionName}`,
              {
                method: 'POST',
                headers: directHeaders,
                body: JSON.stringify(payload),
              }
            );
          }

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

  // Generate / Rotate new API Key pair server-side (Atomic single-active-key rotation)
  async generateApiKey(params: {
    merchantId: string;
    keyName: string;
  }): Promise<{ clientId: string; clientSecret: string; keyId?: string; createdAt?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    // Strategy 1: Edge Function atomic rotation (authenticated session)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const edgeRes = await fetch('https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/merchant-paynit-payout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'rotate_api_key',
            merchant_id: params.merchantId,
            key_name: params.keyName.trim() || 'Primary API Key',
          }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (edgeData?.success && edgeData.client_id && edgeData.client_secret) {
            return {
              clientId: edgeData.client_id,
              clientSecret: edgeData.client_secret,
              keyId: edgeData.key_id,
              createdAt: edgeData.created_at,
            };
          }
        }
      }
    } catch (edgeErr) {
      console.warn('Edge Function rotate_api_key fallback:', edgeErr);
    }

    // Strategy 2: RPC merchant_rotate_api_key_rpc
    try {
      const { data: rotData, error: rotError } = await supabase.rpc('merchant_rotate_api_key_rpc', {
        p_merchant_id: params.merchantId,
        p_key_name: params.keyName.trim() || 'Primary API Key',
      });

      if (!rotError && rotData?.success && rotData.client_id && rotData.client_secret) {
        return {
          clientId: rotData.client_id,
          clientSecret: rotData.client_secret,
          keyId: rotData.key_id,
          createdAt: rotData.created_at,
        };
      }
    } catch (rotErr) {
      console.warn('RPC merchant_rotate_api_key_rpc fallback:', rotErr);
    }

    // Strategy 3: RPC merchant_generate_api_key_rpc
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
      keyId: data.key_id,
      createdAt: data.created_at || new Date().toISOString(),
    };
  },

  // Revoke API Key (Multi-strategy)
  async revokeApiKey(keyId: string, merchantId?: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    // Strategy 1: Edge Function
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const edgeRes = await fetch('https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/merchant-paynit-payout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'revoke_api_key',
            key_id: keyId,
            merchant_id: merchantId,
          }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (edgeData?.success) return;
        }
      }
    } catch (edgeErr) {
      console.warn('Edge Function revoke_api_key fallback:', edgeErr);
    }

    // Strategy 2: RPC merchant_revoke_api_key_rpc
    const { error } = await supabase.rpc('merchant_revoke_api_key_rpc', {
      p_key_id: keyId,
    });

    if (error) {
      // Strategy 3: Direct update
      const { error: directErr } = await supabase
        .from('merchant_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (directErr) {
        throw new Error(error.message || directErr.message || 'Failed to revoke API Key');
      }
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

  // Check real-time provider status for a merchant's own Gateway payout Order ID
  async checkPayoutStatus(orderId: string): Promise<MerchantOrderStatusCheckResult> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase database is not configured.');
    }

    const cleanOrderId = orderId.trim();
    if (!cleanOrderId) {
      throw new Error('Please enter an Order ID.');
    }

    const token = await this.getValidSessionToken();
    if (!token) {
      throw new Error('Please sign in to your Merchant account to check payout status.');
    }

    try {
      let response = await supabase.functions.invoke('check-order-status', {
        headers: { Authorization: `Bearer ${token}` },
        body: { order_id: cleanOrderId },
      });

      if (response.error || !response.data) {
        // Fallback to merchant-paynit-payout endpoint
        response = await supabase.functions.invoke('merchant-paynit-payout', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            order_id: cleanOrderId,
            action: 'check_order_status',
          },
        });
      }

      if (!response.error && response.data) {
        return response.data as MerchantOrderStatusCheckResult;
      }

      if (response.error) {
        const errorMsg = await this.parseEdgeFunctionError(
          response.error,
          response.response,
          response.data
        );

        // Resilient fallback: If deployed Edge Function returns payout amount validation error
        // (due to older cloud deployment version before status-check handler was merged),
        // resolve authoritative status from the authenticated merchant's payout database record
        if (errorMsg.includes('payout amount') || errorMsg.includes('greater than zero')) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: merchant } = await supabase
              .from('merchants')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (merchant) {
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderId);
              let mQuery = supabase
                .from('merchant_payouts')
                .select('*')
                .eq('merchant_id', merchant.id);

              if (isUuid) {
                mQuery = mQuery.or(`order_id.eq.${cleanOrderId},provider_order_id.eq.${cleanOrderId},provider_reference_id.eq.${cleanOrderId},id.eq.${cleanOrderId},order_id.ilike.${cleanOrderId},provider_reference_id.ilike.${cleanOrderId}`);
              } else {
                mQuery = mQuery.or(`order_id.eq.${cleanOrderId},provider_order_id.eq.${cleanOrderId},provider_reference_id.eq.${cleanOrderId},order_id.ilike.${cleanOrderId},provider_reference_id.ilike.${cleanOrderId}`);
              }

              const { data: payouts } = await mQuery.order('created_at', { ascending: false }).limit(1);
              const payout = payouts?.[0];

              if (payout) {
                const dbStatus = String(payout.status || '').toUpperCase();
                const amt = Number(payout.amount);
                const fee = Number(payout.fee_amount != null ? payout.fee_amount : calculateWithdrawalFee(amt).fee);
                const total = Number(payout.total_deducted != null ? payout.total_deducted : amt + fee);
                const utr = payout.provider_reference_id || payout.provider_order_id || '';

                if (dbStatus === 'SUCCESS') {
                  return {
                    success: true,
                    status: 'SUCCESS',
                    order_id: payout.order_id,
                    amount: amt,
                    fee,
                    total_deducted: total,
                    utr,
                    provider_reference_id: utr,
                    message: 'Payment Completed',
                  };
                }

                if (dbStatus === 'FAILED' || dbStatus === 'REVERSED') {
                  return {
                    success: false,
                    status: 'FAILED',
                    already_refunded: true,
                    refunded: false,
                    refund_status: 'REFUNDED',
                    refund_amount: total,
                    order_id: payout.order_id,
                    rejection_reason: payout.rejection_reason,
                    message: `Payment Failed — ₹${total.toFixed(2)} refunded to your wallet.`,
                  };
                }

                return {
                  success: true,
                  status: 'PROCESSING',
                  order_id: payout.order_id,
                  amount: amt,
                  fee,
                  total_deducted: total,
                  utr,
                  provider_reference_id: utr,
                  message: 'Payment is still processing. No refund has been issued.',
                };
              }
            }
          }
        }

        throw new Error(errorMsg);
      }

      return response.data as MerchantOrderStatusCheckResult;
    } catch (err: any) {
      throw new Error(err.message || 'Unable to check payout status. Please try again.');
    }
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

  // ============================================================================
  // AUTHORITATIVE FINANCIAL ANALYTICS (IST TIMEZONE RESPECTED)
  // ============================================================================
  async getMerchantFinancialAnalytics(
    merchantId: string,
    timezoneOffsetMinutes: number = 330
  ): Promise<MerchantFinancialAnalytics> {
    // 1. Demo Mode Redundancy (> 250 records)
    if (merchantId === 'dev-demo-merchant-001') {
      const allTxs = generateDemoTransactions(merchantId);
      const todayBounds = getIstDayBoundaries(0, timezoneOffsetMinutes);
      const yesterdayBounds = getIstDayBoundaries(1, timezoneOffsetMinutes);
      const weekAgoMs = Date.now() - 7 * 24 * 3600 * 1000;
      const monthAgoMs = Date.now() - 30 * 24 * 3600 * 1000;

      let totalDepAmt = 0;
      let totalDepGross = 0;
      let totalDepCount = 0;
      let totalWthAmt = 0;
      let totalWthGross = 0;
      let totalWthCount = 0;

      let todayDepAmt = 0;
      let todayDepCount = 0;
      let todayWthAmt = 0;
      let todayWthCount = 0;
      let todayTxCount = 0;

      let yestDepAmt = 0;
      let yestDepCount = 0;
      let yestWthAmt = 0;
      let yestWthCount = 0;
      let yestTxCount = 0;

      let weekDepAmt = 0;
      let weekWthAmt = 0;
      let weekTxCount = 0;

      let monthDepAmt = 0;
      let monthWthAmt = 0;
      let monthTxCount = 0;

      let pendingDepCount = 0;
      let pendingDepAmt = 0;
      let pendingWthCount = 0;
      let pendingWthAmt = 0;

      let successCount = 0;
      let pendingCount = 0;
      let failedCount = 0;
      let rejectedCount = 0;

      allTxs.forEach((tx) => {
        const txTime = new Date(tx.created_at).getTime();

        if (tx.status === 'SUCCESS') successCount++;
        else if (tx.status === 'PENDING' || tx.status === 'PROCESSING') pendingCount++;
        else if (tx.status === 'FAILED') failedCount++;
        else if (tx.status === 'REJECTED') rejectedCount++;

        if (tx.type === 'DEPOSIT') {
          if (tx.status === 'SUCCESS') {
            totalDepAmt += tx.net_amount;
            totalDepGross += tx.amount;
            totalDepCount++;
          } else if (tx.status === 'PENDING') {
            pendingDepCount++;
            pendingDepAmt += tx.amount;
          }
        } else {
          if (tx.status === 'SUCCESS') {
            totalWthAmt += tx.amount;
            totalWthGross += tx.net_amount;
            totalWthCount++;
          } else if (tx.status === 'PENDING' || tx.status === 'PROCESSING') {
            pendingWthCount++;
            pendingWthAmt += tx.amount;
          }
        }

        // Today Check (IST)
        if (txTime >= todayBounds.startUtc.getTime() && txTime <= todayBounds.endUtc.getTime()) {
          todayTxCount++;
          if (tx.type === 'DEPOSIT' && tx.status === 'SUCCESS') {
            todayDepAmt += tx.net_amount;
            todayDepCount++;
          } else if (tx.type === 'WITHDRAWAL' && tx.status === 'SUCCESS') {
            todayWthAmt += tx.amount;
            todayWthCount++;
          }
        }

        // Yesterday Check (IST)
        if (txTime >= yesterdayBounds.startUtc.getTime() && txTime <= yesterdayBounds.endUtc.getTime()) {
          yestTxCount++;
          if (tx.type === 'DEPOSIT' && tx.status === 'SUCCESS') {
            yestDepAmt += tx.net_amount;
            yestDepCount++;
          } else if (tx.type === 'WITHDRAWAL' && tx.status === 'SUCCESS') {
            yestWthAmt += tx.amount;
            yestWthCount++;
          }
        }

        // Last 7 Days
        if (txTime >= weekAgoMs) {
          weekTxCount++;
          if (tx.type === 'DEPOSIT' && tx.status === 'SUCCESS') weekDepAmt += tx.net_amount;
          else if (tx.type === 'WITHDRAWAL' && tx.status === 'SUCCESS') weekWthAmt += tx.amount;
        }

        // Last 30 Days
        if (txTime >= monthAgoMs) {
          monthTxCount++;
          if (tx.type === 'DEPOSIT' && tx.status === 'SUCCESS') monthDepAmt += tx.net_amount;
          else if (tx.type === 'WITHDRAWAL' && tx.status === 'SUCCESS') monthWthAmt += tx.amount;
        }
      });

      // Generate 14-day daily chart series
      const dailyChart: MerchantDailyVolumePoint[] = [];
      for (let d = 13; d >= 0; d--) {
        const dayBound = getIstDayBoundaries(d, timezoneOffsetMinutes);
        const dayTxs = allTxs.filter((t) => {
          const tTime = new Date(t.created_at).getTime();
          return tTime >= dayBound.startUtc.getTime() && tTime <= dayBound.endUtc.getTime();
        });

        const depVol = dayTxs
          .filter((t) => t.type === 'DEPOSIT' && t.status === 'SUCCESS')
          .reduce((sum, t) => sum + t.net_amount, 0);

        const wthVol = dayTxs
          .filter((t) => t.type === 'WITHDRAWAL' && t.status === 'SUCCESS')
          .reduce((sum, t) => sum + t.amount, 0);

        const succ = dayTxs.filter((t) => t.status === 'SUCCESS').length;
        const fail = dayTxs.filter((t) => t.status === 'FAILED' || t.status === 'REJECTED').length;

        // Label: "06 Nov"
        const dateParts = dayBound.dateStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${dateParts[2]} ${monthNames[parseInt(dateParts[1], 10) - 1]}`;

        dailyChart.push({
          date: dayBound.dateStr,
          label,
          deposit_volume: depVol,
          withdrawal_volume: wthVol,
          successful_count: succ,
          failed_count: fail,
          total_count: dayTxs.length,
        });
      }

      return {
        total_deposited_amount: totalDepAmt,
        total_deposited_gross: totalDepGross,
        total_deposited_count: totalDepCount,
        total_withdrawn_amount: totalWthAmt,
        total_withdrawn_gross: totalWthGross,
        total_withdrawn_count: totalWthCount,

        today_deposits_amount: todayDepAmt,
        today_deposits_count: todayDepCount,
        today_withdrawals_amount: todayWthAmt,
        today_withdrawals_count: todayWthCount,
        today_transactions_count: todayTxCount,

        yesterday_deposits_amount: yestDepAmt,
        yesterday_deposits_count: yestDepCount,
        yesterday_withdrawals_amount: yestWthAmt,
        yesterday_withdrawals_count: yestWthCount,
        yesterday_transactions_count: yestTxCount,

        last_7_days_deposits_amount: weekDepAmt,
        last_7_days_withdrawals_amount: weekWthAmt,
        last_7_days_transactions_count: weekTxCount,

        last_30_days_deposits_amount: monthDepAmt,
        last_30_days_withdrawals_amount: monthWthAmt,
        last_30_days_transactions_count: monthTxCount,

        total_transactions_count: allTxs.length,
        available_float_balance: 48500.0,
        locked_payout_balance: 1500.0,

        pending_deposits_count: pendingDepCount,
        pending_deposits_amount: pendingDepAmt,
        pending_withdrawals_count: pendingWthCount,
        pending_withdrawals_amount: pendingWthAmt,

        successful_count: successCount,
        pending_count: pendingCount,
        failed_count: failedCount,
        rejected_count: rejectedCount,

        daily_chart: dailyChart,
      };
    }

    // 2. Production RPC Attempt
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'get_merchant_financial_analytics_rpc',
          {
            p_merchant_id: merchantId,
            p_timezone_offset_minutes: timezoneOffsetMinutes,
          }
        );

        if (!rpcErr && rpcData && typeof rpcData === 'object' && rpcData.total_transactions_count !== undefined) {
          return rpcData as MerchantFinancialAnalytics;
        }
      } catch (rpcEx) {
        console.warn('RPC get_merchant_financial_analytics_rpc fallback to direct query:', rpcEx);
      }
    }

    // 3. Authoritative Direct Database Fallback Aggregation
    const wallet = await this.getMerchantWallet(merchantId);
    const availableBalance = wallet?.available_balance ?? 0;
    const lockedBalance = wallet?.locked_payout_balance ?? 0;

    let deposits: MerchantDeposit[] = [];
    let payouts: MerchantPayout[] = [];

    if (isSupabaseConfigured && supabase) {
      const [depRes, payRes] = await Promise.all([
        supabase
          .from('merchant_deposits')
          .select('id, gross_amount, deposit_fee, net_credited, status, created_at')
          .eq('merchant_id', merchantId),
        supabase
          .from('merchant_payouts')
          .select('id, amount, fee_amount, total_deducted, status, created_at')
          .eq('merchant_id', merchantId),
      ]);

      if (depRes.data) deposits = depRes.data as MerchantDeposit[];
      if (payRes.data) payouts = payRes.data as MerchantPayout[];
    }

    const todayBounds = getIstDayBoundaries(0, timezoneOffsetMinutes);
    const yesterdayBounds = getIstDayBoundaries(1, timezoneOffsetMinutes);
    const weekAgoMs = Date.now() - 7 * 24 * 3600 * 1000;
    const monthAgoMs = Date.now() - 30 * 24 * 3600 * 1000;

    let totalDepAmt = 0;
    let totalDepGross = 0;
    let totalDepCount = 0;
    let totalWthAmt = 0;
    let totalWthGross = 0;
    let totalWthCount = 0;

    let todayDepAmt = 0;
    let todayDepCount = 0;
    let todayWthAmt = 0;
    let todayWthCount = 0;
    let todayTxCount = 0;

    let yestDepAmt = 0;
    let yestDepCount = 0;
    let yestWthAmt = 0;
    let yestWthCount = 0;
    let yestTxCount = 0;

    let weekDepAmt = 0;
    let weekWthAmt = 0;
    let weekTxCount = 0;

    let monthDepAmt = 0;
    let monthWthAmt = 0;
    let monthTxCount = 0;

    let pendingDepCount = 0;
    let pendingDepAmt = 0;
    let pendingWthCount = 0;
    let pendingWthAmt = 0;

    let successCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let rejectedCount = 0;

    // Process Deposits
    deposits.forEach((d) => {
      const tTime = new Date(d.created_at).getTime();
      const gross = Number(d.gross_amount || 0);
      const net = Number(d.net_credited || 0);

      if (d.status === 'APPROVED') {
        successCount++;
        totalDepAmt += net;
        totalDepGross += gross;
        totalDepCount++;
      } else if (d.status === 'PENDING') {
        pendingCount++;
        pendingDepCount++;
        pendingDepAmt += gross;
      } else if (d.status === 'REJECTED') {
        rejectedCount++;
      }

      if (tTime >= todayBounds.startUtc.getTime() && tTime <= todayBounds.endUtc.getTime()) {
        todayTxCount++;
        if (d.status === 'APPROVED') {
          todayDepAmt += net;
          todayDepCount++;
        }
      }

      if (tTime >= yesterdayBounds.startUtc.getTime() && tTime <= yesterdayBounds.endUtc.getTime()) {
        yestTxCount++;
        if (d.status === 'APPROVED') {
          yestDepAmt += net;
          yestDepCount++;
        }
      }

      if (tTime >= weekAgoMs) {
        weekTxCount++;
        if (d.status === 'APPROVED') weekDepAmt += net;
      }

      if (tTime >= monthAgoMs) {
        monthTxCount++;
        if (d.status === 'APPROVED') monthDepAmt += net;
      }
    });

    // Process Payouts
    payouts.forEach((p) => {
      const tTime = new Date(p.created_at).getTime();
      const amt = Number(p.amount || 0);
      const totalDed = Number(p.total_deducted || amt);

      if (p.status === 'SUCCESS') {
        successCount++;
        totalWthAmt += amt;
        totalWthGross += totalDed;
        totalWthCount++;
      } else if (p.status === 'PENDING' || p.status === 'PROCESSING') {
        pendingCount++;
        pendingWthCount++;
        pendingWthAmt += amt;
      } else if (p.status === 'FAILED') {
        failedCount++;
      } else if (p.status === 'REVERSED') {
        rejectedCount++;
      }

      if (tTime >= todayBounds.startUtc.getTime() && tTime <= todayBounds.endUtc.getTime()) {
        todayTxCount++;
        if (p.status === 'SUCCESS') {
          todayWthAmt += amt;
          todayWthCount++;
        }
      }

      if (tTime >= yesterdayBounds.startUtc.getTime() && tTime <= yesterdayBounds.endUtc.getTime()) {
        yestTxCount++;
        if (p.status === 'SUCCESS') {
          yestWthAmt += amt;
          yestWthCount++;
        }
      }

      if (tTime >= weekAgoMs) {
        weekTxCount++;
        if (p.status === 'SUCCESS') weekWthAmt += amt;
      }

      if (tTime >= monthAgoMs) {
        monthTxCount++;
        if (p.status === 'SUCCESS') monthWthAmt += amt;
      }
    });

    // Generate 14-day daily chart series
    const dailyChart: MerchantDailyVolumePoint[] = [];
    for (let d = 13; d >= 0; d--) {
      const dayBound = getIstDayBoundaries(d, timezoneOffsetMinutes);

      const dayDeps = deposits.filter((dep) => {
        const tTime = new Date(dep.created_at).getTime();
        return tTime >= dayBound.startUtc.getTime() && tTime <= dayBound.endUtc.getTime();
      });

      const dayPays = payouts.filter((pay) => {
        const tTime = new Date(pay.created_at).getTime();
        return tTime >= dayBound.startUtc.getTime() && tTime <= dayBound.endUtc.getTime();
      });

      const depVol = dayDeps
        .filter((dep) => dep.status === 'APPROVED')
        .reduce((sum, dep) => sum + Number(dep.net_credited || 0), 0);

      const wthVol = dayPays
        .filter((pay) => pay.status === 'SUCCESS')
        .reduce((sum, pay) => sum + Number(pay.amount || 0), 0);

      const succ =
        dayDeps.filter((dep) => dep.status === 'APPROVED').length +
        dayPays.filter((pay) => pay.status === 'SUCCESS').length;

      const fail =
        dayDeps.filter((dep) => dep.status === 'REJECTED').length +
        dayPays.filter((pay) => pay.status === 'FAILED' || pay.status === 'REVERSED').length;

      const dateParts = dayBound.dateStr.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${dateParts[2]} ${monthNames[parseInt(dateParts[1], 10) - 1]}`;

      dailyChart.push({
        date: dayBound.dateStr,
        label,
        deposit_volume: depVol,
        withdrawal_volume: wthVol,
        successful_count: succ,
        failed_count: fail,
        total_count: dayDeps.length + dayPays.length,
      });
    }

    return {
      total_deposited_amount: totalDepAmt,
      total_deposited_gross: totalDepGross,
      total_deposited_count: totalDepCount,
      total_withdrawn_amount: totalWthAmt,
      total_withdrawn_gross: totalWthGross,
      total_withdrawn_count: totalWthCount,

      today_deposits_amount: todayDepAmt,
      today_deposits_count: todayDepCount,
      today_withdrawals_amount: todayWthAmt,
      today_withdrawals_count: todayWthCount,
      today_transactions_count: todayTxCount,

      yesterday_deposits_amount: yestDepAmt,
      yesterday_deposits_count: yestDepCount,
      yesterday_withdrawals_amount: yestWthAmt,
      yesterday_withdrawals_count: yestWthCount,
      yesterday_transactions_count: yestTxCount,

      last_7_days_deposits_amount: weekDepAmt,
      last_7_days_withdrawals_amount: weekWthAmt,
      last_7_days_transactions_count: weekTxCount,

      last_30_days_deposits_amount: monthDepAmt,
      last_30_days_withdrawals_amount: monthWthAmt,
      last_30_days_transactions_count: monthTxCount,

      total_transactions_count: deposits.length + payouts.length,
      available_float_balance: availableBalance,
      locked_payout_balance: lockedBalance,

      pending_deposits_count: pendingDepCount,
      pending_deposits_amount: pendingDepAmt,
      pending_withdrawals_count: pendingWthCount,
      pending_withdrawals_amount: pendingWthAmt,

      successful_count: successCount,
      pending_count: pendingCount,
      failed_count: failedCount,
      rejected_count: rejectedCount,

      daily_chart: dailyChart,
    };
  },

  // ============================================================================
  // COMPLETE UNIFIED TRANSACTION HISTORY — 100 RECORDS PER PAGE
  // ============================================================================
  async getMerchantUnifiedTransactions(
    params: MerchantTransactionsQueryParams
  ): Promise<MerchantTransactionsResponse> {
    const page = Math.max(1, params.page || 1);
    const pageSize = 100; // Strict authoritative 100 records per page requirement
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1; // e.g. 0-99 (page 1), 100-199 (page 2), 2100-2199 (page 22)

    // 1. Deterministic Multi-Count Demo Generator for Testing & Verification
    if (params.merchantId.startsWith('dev-demo-') || params.merchantId.startsWith('demo-merchant-')) {
      let targetCount = 2106;
      if (params.merchantId === 'demo-merchant-0') targetCount = 0;
      else if (params.merchantId === 'demo-merchant-75') targetCount = 75;
      else if (params.merchantId === 'demo-merchant-350') targetCount = 350;
      else if (params.merchantId === 'demo-merchant-2106' || params.merchantId === 'dev-demo-merchant-001') targetCount = 2106;
      else if (params.merchantId === 'demo-merchant-10500') targetCount = 10500;

      let txs = generateDemoTransactions(params.merchantId, targetCount);

      // Type filter
      if (params.type && params.type !== 'ALL') {
        txs = txs.filter((t) => t.type === params.type);
      }

      // Status filter
      if (params.status && params.status !== 'ALL') {
        if (params.status === 'SUCCESS') {
          txs = txs.filter((t) => t.status === 'SUCCESS');
        } else if (params.status === 'PENDING') {
          txs = txs.filter((t) => t.status === 'PENDING' || t.status === 'PROCESSING');
        } else if (params.status === 'FAILED') {
          txs = txs.filter((t) => t.status === 'FAILED');
        } else if (params.status === 'REJECTED') {
          txs = txs.filter((t) => t.status === 'REJECTED');
        }
      }

      // Search filter (ID, UTR, Order ID, Beneficiary)
      if (params.search && params.search.trim()) {
        const q = params.search.trim().toLowerCase();
        txs = txs.filter(
          (t) =>
            t.reference_id.toLowerCase().includes(q) ||
            (t.provider_order_id && t.provider_order_id.toLowerCase().includes(q)) ||
            (t.provider_reference_id && t.provider_reference_id.toLowerCase().includes(q)) ||
            (t.recipient_or_sender && t.recipient_or_sender.toLowerCase().includes(q)) ||
            t.id.toLowerCase().includes(q)
        );
      }

      // Date range filter
      if (params.startDate) {
        const startMs = new Date(params.startDate).getTime();
        txs = txs.filter((t) => new Date(t.created_at).getTime() >= startMs);
      }
      if (params.endDate) {
        const endMs = new Date(params.endDate).getTime();
        txs = txs.filter((t) => new Date(t.created_at).getTime() <= endMs);
      }

      // Amount range filter
      if (params.minAmount != null && !isNaN(params.minAmount)) {
        txs = txs.filter((t) => t.amount >= params.minAmount!);
      }
      if (params.maxAmount != null && !isNaN(params.maxAmount)) {
        txs = txs.filter((t) => t.amount <= params.maxAmount!);
      }

      const totalCount = txs.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const paginated = txs.slice(from, from + pageSize);

      return {
        transactions: paginated,
        total_count: totalCount,
        page,
        pageSize,
        total_pages: totalPages,
      };
    }

    // 2. Production RPC Attempt (Server-side PL/pgSQL Function with Composite Indexes)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'get_merchant_unified_transactions_rpc',
          {
            p_merchant_id: params.merchantId,
            p_page: page,
            p_page_size: pageSize,
            p_type: params.type || 'ALL',
            p_status: params.status || 'ALL',
            p_search: params.search?.trim() || null,
            p_start_date: params.startDate || null,
            p_end_date: params.endDate || null,
            p_min_amount: params.minAmount ?? null,
            p_max_amount: params.maxAmount ?? null,
          }
        );

        if (!rpcErr && rpcData && typeof rpcData === 'object' && Array.isArray(rpcData.transactions)) {
          return {
            transactions: rpcData.transactions as MerchantUnifiedTransaction[],
            total_count: Number(rpcData.total_count || 0),
            page: Number(rpcData.page || page),
            pageSize: Number(rpcData.page_size || pageSize),
            total_pages: Number(rpcData.total_pages || 1),
          };
        }
      } catch (rpcEx) {
        console.warn('RPC get_merchant_unified_transactions_rpc fallback to direct PostgREST query:', rpcEx);
      }
    }

    // 3. Authoritative Direct PostgREST Fallback (Exact Server-Side Count & Strictly 100 Rows/Page)
    if (isSupabaseConfigured && supabase) {
      try {
        // CASE A: User requested ONLY WITHDRAWALS (Payouts)
        if (params.type === 'WITHDRAWAL') {
          let q = supabase
            .from('merchant_payouts')
            .select('*', { count: 'exact' })
            .eq('merchant_id', params.merchantId);

          if (params.status && params.status !== 'ALL') {
            if (params.status === 'SUCCESS') q = q.eq('status', 'SUCCESS');
            else if (params.status === 'PENDING') q = q.in('status', ['PENDING', 'PROCESSING']);
            else if (params.status === 'FAILED') q = q.eq('status', 'FAILED');
            else if (params.status === 'REJECTED') q = q.eq('status', 'REVERSED');
          }
          if (params.startDate) q = q.gte('created_at', params.startDate);
          if (params.endDate) q = q.lte('created_at', params.endDate);
          if (params.minAmount != null) q = q.gte('amount', params.minAmount);
          if (params.maxAmount != null) q = q.lte('amount', params.maxAmount);
          if (params.search && params.search.trim()) {
            const s = params.search.trim();
            q = q.or(`order_id.ilike.%${s}%,provider_order_id.ilike.%${s}%,provider_reference_id.ilike.%${s}%,account_holder_name.ilike.%${s}%,upi_id.ilike.%${s}%`);
          }

          q = q
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);

          const { data, count, error } = await q;
          if (!error && data) {
            const mapped: MerchantUnifiedTransaction[] = data.map((p: any) => {
              let s: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REJECTED' = 'SUCCESS';
              if (p.status === 'PENDING' || p.status === 'PROCESSING') s = 'PENDING';
              else if (p.status === 'FAILED') s = 'FAILED';
              else if (p.status === 'REVERSED') s = 'REJECTED';

              return {
                id: p.id,
                merchant_id: p.merchant_id,
                type: 'WITHDRAWAL',
                reference_id: p.order_id,
                provider_order_id: p.provider_order_id,
                provider_reference_id: p.provider_reference_id || p.provider_order_id,
                amount: Number(p.amount),
                fee: Number(p.fee_amount),
                net_amount: Number(p.total_deducted),
                status: s,
                payment_method: p.payout_method || 'UPI',
                recipient_or_sender: p.account_holder_name || p.upi_id || 'Beneficiary',
                created_at: p.created_at,
                reviewed_or_processed_at: p.processed_at,
                notes_or_reason: p.rejection_reason,
                raw_data: p,
              };
            });

            const totalCount = count ?? mapped.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

            return {
              transactions: mapped,
              total_count: totalCount,
              page,
              pageSize,
              total_pages: totalPages,
            };
          }
        }

        // CASE B: User requested ONLY DEPOSITS
        if (params.type === 'DEPOSIT') {
          let q = supabase
            .from('merchant_deposits')
            .select('*', { count: 'exact' })
            .eq('merchant_id', params.merchantId);

          if (params.status && params.status !== 'ALL') {
            if (params.status === 'SUCCESS') q = q.eq('status', 'APPROVED');
            else if (params.status === 'PENDING') q = q.eq('status', 'PENDING');
            else if (params.status === 'REJECTED') q = q.eq('status', 'REJECTED');
          }
          if (params.startDate) q = q.gte('created_at', params.startDate);
          if (params.endDate) q = q.lte('created_at', params.endDate);
          if (params.minAmount != null) q = q.gte('gross_amount', params.minAmount);
          if (params.maxAmount != null) q = q.lte('gross_amount', params.maxAmount);
          if (params.search && params.search.trim()) {
            const s = params.search.trim();
            q = q.or(`utr_number.ilike.%${s}%,admin_notes.ilike.%${s}%`);
          }

          q = q
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);

          const { data, count, error } = await q;
          if (!error && data) {
            const mapped: MerchantUnifiedTransaction[] = data.map((d: any) => ({
              id: d.id,
              merchant_id: d.merchant_id,
              type: 'DEPOSIT',
              reference_id: d.utr_number,
              provider_order_id: d.id.substring(0, 8).toUpperCase(),
              provider_reference_id: d.utr_number,
              amount: Number(d.gross_amount),
              fee: Number(d.deposit_fee),
              net_amount: Number(d.net_credited),
              status: d.status === 'APPROVED' ? 'SUCCESS' : (d.status === 'PENDING' ? 'PENDING' : 'REJECTED'),
              payment_method: 'UPI',
              recipient_or_sender: 'Float Top-Up (PayNit / UPI)',
              created_at: d.created_at,
              reviewed_or_processed_at: d.reviewed_at,
              notes_or_reason: d.admin_notes,
              raw_data: d,
            }));

            const totalCount = count ?? mapped.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

            return {
              transactions: mapped,
              total_count: totalCount,
              page,
              pageSize,
              total_pages: totalPages,
            };
          }
        }

        // CASE C: User requested 'ALL' (Unified Deposits + Withdrawals)
        // Step 1: Accurate server-side count using lightweight HEAD queries
        let depQ = supabase.from('merchant_deposits').select('id', { count: 'exact', head: true }).eq('merchant_id', params.merchantId);
        let payQ = supabase.from('merchant_payouts').select('id', { count: 'exact', head: true }).eq('merchant_id', params.merchantId);

        if (params.startDate) {
          depQ = depQ.gte('created_at', params.startDate);
          payQ = payQ.gte('created_at', params.startDate);
        }
        if (params.endDate) {
          depQ = depQ.lte('created_at', params.endDate);
          payQ = payQ.lte('created_at', params.endDate);
        }
        if (params.minAmount != null) {
          depQ = depQ.gte('gross_amount', params.minAmount);
          payQ = payQ.gte('amount', params.minAmount);
        }
        if (params.maxAmount != null) {
          depQ = depQ.lte('gross_amount', params.maxAmount);
          payQ = payQ.lte('amount', params.maxAmount);
        }
        if (params.status && params.status !== 'ALL') {
          if (params.status === 'SUCCESS') {
            depQ = depQ.eq('status', 'APPROVED');
            payQ = payQ.eq('status', 'SUCCESS');
          } else if (params.status === 'PENDING') {
            depQ = depQ.eq('status', 'PENDING');
            payQ = payQ.in('status', ['PENDING', 'PROCESSING']);
          } else if (params.status === 'FAILED') {
            depQ = depQ.eq('id', '00000000-0000-0000-0000-000000000000');
            payQ = payQ.eq('status', 'FAILED');
          } else if (params.status === 'REJECTED') {
            depQ = depQ.eq('status', 'REJECTED');
            payQ = payQ.eq('status', 'REVERSED');
          }
        }
        if (params.search && params.search.trim()) {
          const s = params.search.trim();
          depQ = depQ.or(`utr_number.ilike.%${s}%,admin_notes.ilike.%${s}%`);
          payQ = payQ.or(`order_id.ilike.%${s}%,provider_order_id.ilike.%${s}%,provider_reference_id.ilike.%${s}%,account_holder_name.ilike.%${s}%,upi_id.ilike.%${s}%`);
        }

        const [depCountRes, payCountRes] = await Promise.all([depQ, payQ]);
        const depCount = depCountRes.count ?? 0;
        const payCount = payCountRes.count ?? 0;
        const totalCount = depCount + payCount;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

        // Step 2: Fetch the exact 100 rows for the requested page window
        if (depCount === 0) {
          return this.getMerchantUnifiedTransactions({ ...params, type: 'WITHDRAWAL' });
        }
        if (payCount === 0) {
          return this.getMerchantUnifiedTransactions({ ...params, type: 'DEPOSIT' });
        }

        // Both deposits and payouts exist: fetch windowed slices, merge, and strictly sort
        const fetchDepWindow = depCount > 0 ? from < depCount : false;
        const depFetchLimit = Math.min(pageSize, Math.max(0, depCount - from));
        const payFetchLimit = pageSize;
        const payOffset = Math.max(0, from - depCount);

        const [depSlice, paySlice] = await Promise.all([
          fetchDepWindow
            ? supabase.from('merchant_deposits').select('*').eq('merchant_id', params.merchantId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + depFetchLimit - 1)
            : Promise.resolve({ data: [] }),
          supabase.from('merchant_payouts').select('*').eq('merchant_id', params.merchantId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(payOffset, payOffset + payFetchLimit - 1),
        ]);

        const combined: MerchantUnifiedTransaction[] = [];
        if (depSlice.data) {
          combined.push(
            ...depSlice.data.map((d: any) => ({
              id: d.id,
              merchant_id: d.merchant_id,
              type: 'DEPOSIT' as const,
              reference_id: d.utr_number,
              provider_order_id: d.id.substring(0, 8).toUpperCase(),
              provider_reference_id: d.utr_number,
              amount: Number(d.gross_amount),
              fee: Number(d.deposit_fee),
              net_amount: Number(d.net_credited),
              status: d.status === 'APPROVED' ? ('SUCCESS' as const) : (d.status === 'PENDING' ? ('PENDING' as const) : ('REJECTED' as const)),
              payment_method: 'UPI',
              recipient_or_sender: 'Float Top-Up (PayNit / UPI)',
              created_at: d.created_at,
              reviewed_or_processed_at: d.reviewed_at,
              notes_or_reason: d.admin_notes,
              raw_data: d,
            }))
          );
        }
        if (paySlice.data) {
          combined.push(
            ...paySlice.data.map((p: any) => {
              let s: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REJECTED' = 'SUCCESS';
              if (p.status === 'PENDING' || p.status === 'PROCESSING') s = 'PENDING';
              else if (p.status === 'FAILED') s = 'FAILED';
              else if (p.status === 'REVERSED') s = 'REJECTED';

              return {
                id: p.id,
                merchant_id: p.merchant_id,
                type: 'WITHDRAWAL' as const,
                reference_id: p.order_id,
                provider_order_id: p.provider_order_id,
                provider_reference_id: p.provider_reference_id || p.provider_order_id,
                amount: Number(p.amount),
                fee: Number(p.fee_amount),
                net_amount: Number(p.total_deducted),
                status: s,
                payment_method: p.payout_method || 'UPI',
                recipient_or_sender: p.account_holder_name || p.upi_id || 'Beneficiary',
                created_at: p.created_at,
                reviewed_or_processed_at: p.processed_at,
                notes_or_reason: p.rejection_reason,
                raw_data: p,
              };
            })
          );
        }

        // Deterministic sort: created_at DESC, id DESC
        combined.sort((a, b) => {
          const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          if (diff !== 0) return diff;
          return b.id.localeCompare(a.id);
        });

        const paginated = combined.slice(0, pageSize);

        return {
          transactions: paginated,
          total_count: totalCount,
          page,
          pageSize,
          total_pages: totalPages,
        };
      } catch (directErr) {
        console.error('Direct PostgREST paginated query failed:', directErr);
      }
    }

    return {
      transactions: [],
      total_count: 0,
      page: 1,
      pageSize: 100,
      total_pages: 1,
    };
  },
};
