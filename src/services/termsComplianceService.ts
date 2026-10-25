/**
 * Terms Acceptance & Funds Safety Compliance Service
 * 
 * Manages:
 * 1. Fetching active funds safety notice campaign & version.
 * 2. Checking user acceptance status (customer or merchant).
 * 3. Tracking notice presentation and scroll events.
 * 4. Submitting user acceptance / rejection decisions with mobile number verification status.
 * 5. Admin compliance reporting, metrics, and CSV export.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';

export interface TermsCampaign {
  id: string;
  campaign_code: string;
  version: string;
  title: string;
  content_text: string;
  content_hash: string;
  is_active: boolean;
  applicable_roles: string[];
  created_at: string;
  updated_at: string;
}

export interface UserTermsStatus {
  has_accepted: boolean;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'SUPERSEDED';
  campaign_id?: string;
  version?: string;
  title?: string;
  content_text?: string;
  content_hash?: string;
  accepted_at?: string;
  mobile_number?: string;
  mobile_verification_status?: 'USER_CONFIRMED' | 'OTP_VERIFIED' | 'NOT_VERIFIED';
  is_applicable: boolean;
}

export interface ComplianceRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  account_type: 'MERCHANT' | 'CUSTOMER';
  merchant_id?: string;
  merchant_code?: string;
  business_name?: string;
  mobile_number?: string;
  mobile_verification_status: 'USER_CONFIRMED' | 'OTP_VERIFIED' | 'NOT_VERIFIED';
  terms_version: string;
  campaign_id: string;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'SUPERSEDED';
  terms_snapshot_hash: string;
  accepted_at: string;
  created_at: string;
  needs_reacceptance: boolean;
}

export interface ComplianceMetrics {
  total_applicable: number;
  total_accepted: number;
  total_rejected: number;
  total_pending: number;
  total_user_confirmed_mobile: number;
  total_otp_verified_mobile: number;
  active_version: string;
  active_campaign_code: string;
}

// Fallback constant for active campaign when database migration 082 is pending execution
export const DEFAULT_TERMS_CAMPAIGN: TermsCampaign = {
  id: '00000000-0000-0000-0000-000000000082',
  campaign_code: 'funds_safety_2026',
  version: 'v1.0.0',
  title: 'Important: Funds Safety & Responsibility Notice',
  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  content_text: `1. Accurate Payment Information
I confirm that funds I deposit or transfer through CreateLifafa are submitted using payment details and instructions displayed by the platform. I am responsible for checking the recipient details, amount, applicable charges, and transaction reference before completing a payment.

2. Fund Status and Verification
A submitted deposit request does not automatically mean the payment has been received, verified, cleared, or credited. Funds remain subject to applicable banking/payment-provider processes, reconciliation, fraud checks, and the platform's published procedures.

3. Responsibility for My Transactions
I am responsible for ensuring that transfers I initiate are authorized, lawful, and made from accounts or payment methods I am permitted to use. I must retain transaction receipts and provide accurate reference details when requested.

4. Important Funds Declaration
I understand that the funds I deposit are subject to payment verification, banking rules, applicable law, and the platform's published terms. I must not assume that every transfer is immediately available or guaranteed to be recoverable.

5. Suspicious or Unverified Transactions
If a transaction is flagged, disputed, reversed, held, or suspected to involve fraud or unlawful activity, the platform may temporarily restrict the affected transaction or balance to the extent permitted by applicable law and the platform's valid policies. The platform must follow applicable legal obligations and its dispute-resolution process.

6. My Responsibility and Cooperation
I agree to provide accurate information, cooperate with lawful verification requests, and report suspicious activity promptly. Responsibility for a transaction will be assessed based on the actual facts, applicable law, and relevant platform policies.

7. No False Guarantee
The platform does not promise that every transfer is risk-free, instantly settled, or immune from banking disputes. Nothing in these terms removes statutory rights or makes the user automatically liable for circumstances outside their control.

8. Acceptance Record
My acceptance records the version of the terms I reviewed, my authenticated account, the confirmation time, and the mobile number I provide or confirm. The platform will use this information only for legitimate compliance, security, support, and audit purposes under its applicable privacy policy.`,
  is_active: true,
  applicable_roles: ['MERCHANT', 'CUSTOMER'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Local storage key prefix for client caching of terms status
const LOCAL_TERMS_KEY = 'createlifafa_terms_status_v1';

export const termsComplianceService = {
  // Get active terms campaign definition
  async getActiveCampaign(): Promise<TermsCampaign> {
    if (!isSupabaseConfigured || !supabase) {
      return DEFAULT_TERMS_CAMPAIGN;
    }

    try {
      const { data, error } = await supabase
        .from('terms_campaigns')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return DEFAULT_TERMS_CAMPAIGN;
      }

      return data as TermsCampaign;
    } catch {
      return DEFAULT_TERMS_CAMPAIGN;
    }
  },

  // Check if current user has accepted the active terms version
  async getUserTermsStatus(userId: string): Promise<UserTermsStatus> {
    if (!userId) {
      return { has_accepted: false, status: 'PENDING', is_applicable: false };
    }

    // Check client session cache
    try {
      const cached = localStorage.getItem(`${LOCAL_TERMS_KEY}_${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.version === DEFAULT_TERMS_CAMPAIGN.version && parsed.has_accepted) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        has_accepted: false,
        status: 'PENDING',
        is_applicable: true,
        campaign_id: DEFAULT_TERMS_CAMPAIGN.id,
        version: DEFAULT_TERMS_CAMPAIGN.version,
        title: DEFAULT_TERMS_CAMPAIGN.title,
        content_text: DEFAULT_TERMS_CAMPAIGN.content_text,
        content_hash: DEFAULT_TERMS_CAMPAIGN.content_hash,
      };
    }

    try {
      // 1. Try invoking get_user_terms_status_rpc
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_terms_status_rpc');
      if (!rpcError && rpcData) {
        if (rpcData.has_accepted) {
          try {
            localStorage.setItem(`${LOCAL_TERMS_KEY}_${userId}`, JSON.stringify(rpcData));
          } catch {}
        }
        return rpcData as UserTermsStatus;
      }

      // 2. Direct query fallback against user_terms_acceptances table
      const { data: accData, error: accError } = await supabase
        .from('user_terms_acceptances')
        .select('*')
        .eq('user_id', userId)
        .eq('terms_version', DEFAULT_TERMS_CAMPAIGN.version)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!accError && accData) {
        const result: UserTermsStatus = {
          has_accepted: accData.status === 'ACCEPTED',
          status: accData.status,
          campaign_id: accData.campaign_id,
          version: accData.terms_version,
          title: DEFAULT_TERMS_CAMPAIGN.title,
          content_text: DEFAULT_TERMS_CAMPAIGN.content_text,
          content_hash: accData.terms_snapshot_hash,
          accepted_at: accData.accepted_at,
          mobile_number: accData.mobile_number,
          mobile_verification_status: accData.mobile_verification_status,
          is_applicable: true,
        };

        if (result.has_accepted) {
          try {
            localStorage.setItem(`${LOCAL_TERMS_KEY}_${userId}`, JSON.stringify(result));
          } catch {}
        }

        return result;
      }

      // 3. Fallback: User has not yet accepted
      return {
        has_accepted: false,
        status: 'PENDING',
        is_applicable: true,
        campaign_id: DEFAULT_TERMS_CAMPAIGN.id,
        version: DEFAULT_TERMS_CAMPAIGN.version,
        title: DEFAULT_TERMS_CAMPAIGN.title,
        content_text: DEFAULT_TERMS_CAMPAIGN.content_text,
        content_hash: DEFAULT_TERMS_CAMPAIGN.content_hash,
      };
    } catch {
      return {
        has_accepted: false,
        status: 'PENDING',
        is_applicable: true,
        campaign_id: DEFAULT_TERMS_CAMPAIGN.id,
        version: DEFAULT_TERMS_CAMPAIGN.version,
        title: DEFAULT_TERMS_CAMPAIGN.title,
        content_text: DEFAULT_TERMS_CAMPAIGN.content_text,
        content_hash: DEFAULT_TERMS_CAMPAIGN.content_hash,
      };
    }
  },

  // Record an audit display event (e.g. NOTICE_DISPLAYED, SCROLLED_END)
  async recordNoticeEvent(params: {
    campaignId: string;
    version: string;
    eventType: 'DISPLAYED' | 'SCROLLED_END' | 'ACCEPTED' | 'REJECTED' | 'REMINDER_SENT';
  }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('terms_notice_events').insert({
        user_id: user.id,
        campaign_id: params.campaignId || DEFAULT_TERMS_CAMPAIGN.id,
        terms_version: params.version || DEFAULT_TERMS_CAMPAIGN.version,
        event_type: params.eventType,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical audit log error
    }
  },

  // Submit user decision (ACCEPTED or REJECTED)
  async submitTermsDecision(params: {
    campaignId: string;
    version: string;
    decision: 'ACCEPTED' | 'REJECTED';
    mobileNumber?: string;
    termsHash: string;
  }): Promise<{ success: boolean; status: string; message?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database connection is not configured.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required to submit terms acceptance.');
    }

    // Clean and validate mobile number if accepting
    let cleanMobile = '';
    if (params.decision === 'ACCEPTED') {
      const rawMobile = (params.mobileNumber || '').trim().replace(/[^0-9+]/g, '');
      if (!rawMobile || rawMobile.length < 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      cleanMobile = rawMobile.startsWith('+') ? rawMobile : `+91${rawMobile}`;
    }

    try {
      // 1. Try invoking submit_user_terms_decision_rpc
      const { data, error } = await supabase.rpc('submit_user_terms_decision_rpc', {
        p_campaign_id: params.campaignId || DEFAULT_TERMS_CAMPAIGN.id,
        p_version: params.version || DEFAULT_TERMS_CAMPAIGN.version,
        p_decision: params.decision,
        p_mobile_number: cleanMobile,
        p_terms_hash: params.termsHash || DEFAULT_TERMS_CAMPAIGN.content_hash,
      });

      if (!error && data?.success) {
        // Update local cache
        const statusObj: UserTermsStatus = {
          has_accepted: params.decision === 'ACCEPTED',
          status: params.decision,
          campaign_id: params.campaignId,
          version: params.version,
          accepted_at: new Date().toISOString(),
          mobile_number: cleanMobile,
          mobile_verification_status: params.decision === 'ACCEPTED' ? 'USER_CONFIRMED' : 'NOT_VERIFIED',
          is_applicable: true,
        };
        try {
          localStorage.setItem(`${LOCAL_TERMS_KEY}_${user.id}`, JSON.stringify(statusObj));
        } catch {}

        return { success: true, status: params.decision };
      }

      // 2. Direct table upsert fallback
      const { error: insertError } = await supabase
        .from('user_terms_acceptances')
        .upsert(
          {
            user_id: user.id,
            campaign_id: params.campaignId || DEFAULT_TERMS_CAMPAIGN.id,
            terms_version: params.version || DEFAULT_TERMS_CAMPAIGN.version,
            status: params.decision,
            mobile_number: cleanMobile || null,
            mobile_verification_status: params.decision === 'ACCEPTED' ? 'USER_CONFIRMED' : 'NOT_VERIFIED',
            terms_snapshot_hash: params.termsHash || DEFAULT_TERMS_CAMPAIGN.content_hash,
            accepted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,campaign_id,terms_version' }
        );

      if (insertError) {
        throw new Error(insertError.message || 'Failed to record terms acceptance.');
      }

      // Update local cache
      const statusObj: UserTermsStatus = {
        has_accepted: params.decision === 'ACCEPTED',
        status: params.decision,
        campaign_id: params.campaignId,
        version: params.version,
        accepted_at: new Date().toISOString(),
        mobile_number: cleanMobile,
        mobile_verification_status: params.decision === 'ACCEPTED' ? 'USER_CONFIRMED' : 'NOT_VERIFIED',
        is_applicable: true,
      };
      try {
        localStorage.setItem(`${LOCAL_TERMS_KEY}_${user.id}`, JSON.stringify(statusObj));
      } catch {}

      return { success: true, status: params.decision };
    } catch (err: any) {
      throw new Error(err.message || 'Failed to submit terms decision.');
    }
  },

  // Admin: Fetch compliance records with filtering and search
  async getComplianceRecords(filters: {
    status?: string;
    accountType?: string;
    search?: string;
    version?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ComplianceRecord[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      // 1. Try invoking admin_list_terms_compliance_rpc
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_list_terms_compliance_rpc', {
        p_status: filters.status && filters.status !== 'ALL' ? filters.status : null,
        p_account_type: filters.accountType && filters.accountType !== 'ALL' ? filters.accountType : null,
        p_search: filters.search ? filters.search.trim() : null,
        p_version: filters.version && filters.version !== 'ALL' ? filters.version : null,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData as ComplianceRecord[];
      }

      // 2. Direct table fallback query with profiles and merchants join
      let query = supabase
        .from('user_terms_acceptances')
        .select(`
          id,
          user_id,
          campaign_id,
          terms_version,
          status,
          mobile_number,
          mobile_verification_status,
          terms_snapshot_hash,
          accepted_at,
          created_at,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters.version && filters.version !== 'ALL') {
        query = query.eq('terms_version', filters.version);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        user_email: d.profiles?.email || 'N/A',
        user_name: d.profiles?.full_name || 'N/A',
        account_type: 'CUSTOMER',
        mobile_number: d.mobile_number || 'N/A',
        mobile_verification_status: d.mobile_verification_status || 'USER_CONFIRMED',
        terms_version: d.terms_version,
        campaign_id: d.campaign_id,
        status: d.status,
        terms_snapshot_hash: d.terms_snapshot_hash,
        accepted_at: d.accepted_at,
        created_at: d.created_at,
        needs_reacceptance: d.terms_version !== DEFAULT_TERMS_CAMPAIGN.version,
      }));
    } catch {
      return [];
    }
  },

  // Admin: Fetch high-level compliance metrics
  async getComplianceMetrics(): Promise<ComplianceMetrics> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        total_applicable: 0,
        total_accepted: 0,
        total_rejected: 0,
        total_pending: 0,
        total_user_confirmed_mobile: 0,
        total_otp_verified_mobile: 0,
        active_version: DEFAULT_TERMS_CAMPAIGN.version,
        active_campaign_code: DEFAULT_TERMS_CAMPAIGN.campaign_code,
      };
    }

    try {
      const { data: rpcMetrics, error } = await supabase.rpc('admin_get_terms_compliance_metrics_rpc');
      if (!error && rpcMetrics) {
        return rpcMetrics as ComplianceMetrics;
      }

      // Direct count fallback
      const { count: acceptedCount } = await supabase
        .from('user_terms_acceptances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACCEPTED');

      const { count: rejectedCount } = await supabase
        .from('user_terms_acceptances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'REJECTED');

      const { count: totalMerchants } = await supabase
        .from('merchants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE');

      const { count: totalDepositors } = await supabase
        .from('deposit_requests')
        .select('user_id', { count: 'exact', head: true });

      const totalApplicable = Math.max((totalMerchants || 0) + (totalDepositors || 0), (acceptedCount || 0) + (rejectedCount || 0));

      return {
        total_applicable: totalApplicable,
        total_accepted: acceptedCount || 0,
        total_rejected: rejectedCount || 0,
        total_pending: Math.max(0, totalApplicable - ((acceptedCount || 0) + (rejectedCount || 0))),
        total_user_confirmed_mobile: acceptedCount || 0,
        total_otp_verified_mobile: 0,
        active_version: DEFAULT_TERMS_CAMPAIGN.version,
        active_campaign_code: DEFAULT_TERMS_CAMPAIGN.campaign_code,
      };
    } catch {
      return {
        total_applicable: 0,
        total_accepted: 0,
        total_rejected: 0,
        total_pending: 0,
        total_user_confirmed_mobile: 0,
        total_otp_verified_mobile: 0,
        active_version: DEFAULT_TERMS_CAMPAIGN.version,
        active_campaign_code: DEFAULT_TERMS_CAMPAIGN.campaign_code,
      };
    }
  },

  // Export records as compliant CSV
  exportComplianceCsv(records: ComplianceRecord[]): void {
    if (!records || records.length === 0) return;

    const headers = [
      'Record ID',
      'User ID',
      'User Email',
      'User Name',
      'Account Type',
      'Merchant Code',
      'Business Name',
      'Mobile Number',
      'Mobile Verification Status',
      'Terms Version',
      'Campaign ID',
      'Status',
      'Terms Snapshot Hash',
      'Accepted At',
      'Created At',
    ];

    const rows = records.map((r) => [
      r.id,
      r.user_id,
      r.user_email,
      `"${(r.user_name || '').replace(/"/g, '""')}"`,
      r.account_type,
      r.merchant_code || '',
      `"${(r.business_name || '').replace(/"/g, '""')}"`,
      r.mobile_number || '',
      r.mobile_verification_status,
      r.terms_version,
      r.campaign_id,
      r.status,
      r.terms_snapshot_hash,
      r.accepted_at,
      r.created_at,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `terms_compliance_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
