// Supabase Edge Function: merchant-paynit-payout
// Dedicated Multi-Merchant Payout Gateway Outbound Dispatch via PayNit (UPI ONLY).
// 1. Authenticates via API Key (X-Client-Id + X-Client-Secret) OR Supabase Bearer JWT.
// 2. Checks client IP against merchant_ip_whitelist.
// 3. Enforces Payout Method: UPI ONLY (rejects IMPS / bank account attempts).
// 4. Invokes merchant_initiate_payout_rpc for atomic float deduction & authoritative ₹2.50 fee.
// 5. Dispatches server-side HTTP POST to PayNit API (https://api.paynit.in/v1/payout.php).
// 6. PayNit Authentication: Bearer PAYNIT_API_KEY:PAYNIT_API_SECRET (Server-side ONLY).
// 7. Handles Real PayNit Response:
//    a. SUCCESS / processed -> Finalized via merchant_finalize_payout_success_rpc.
//    b. processing / pending -> Held in PROCESSING with provider_reference_id.
//    c. Network timeout / 5xx -> Retained in PROCESSING. NEVER auto-refunds on ambiguous state.
//    d. Definitive 4xx / rejection -> FAILED with atomic float & fee refund.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id, x-client-secret, x-idempotency-key',
  'Access-Control-Max-Age': '86400',
};

const PAYNIT_PAYOUT_FEE = 2.50;

async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const paynitApiKey = Deno.env.get('PAYNIT_API_KEY') || '';
    const paynitApiSecret = Deno.env.get('PAYNIT_API_SECRET') || '';
    let paynitBaseUrl = (Deno.env.get('PAYNIT_BASE_URL') || 'https://api.paynit.in')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/payout\.php\/?$/, '');
    if (!paynitBaseUrl.startsWith('http')) {
      paynitBaseUrl = 'https://api.paynit.in';
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paynitApiKey || !paynitApiSecret) {
      const missingVars: string[] = [];
      if (!paynitApiKey) missingVars.push('PAYNIT_API_KEY');
      if (!paynitApiSecret) missingVars.push('PAYNIT_API_SECRET');
      console.error(`PayNit provider credentials missing on server: ${missingVars.join(', ')}`);
      return new Response(
        JSON.stringify({ error: 'PayNit provider credentials not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Resolve Caller Identity (API Key or Bearer Session)
    let merchantId: string | null = null;
    const clientIdHeader = req.headers.get('X-Client-Id') || req.headers.get('x-client-id');
    const clientSecretHeader = req.headers.get('X-Client-Secret') || req.headers.get('x-client-secret');
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

    const clientIp = (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('cf-connecting-ip') ||
      '127.0.0.1'
    ).trim();

    if (clientIdHeader && clientSecretHeader) {
      // API Key Authentication Path
      const secretHash = await hashSecret(clientSecretHeader.trim());

      const { data: keyRecord, error: keyErr } = await adminClient
        .from('merchant_api_keys')
        .select('merchant_id, client_secret_hash, is_active')
        .eq('client_id', clientIdHeader.trim())
        .maybeSingle();

      if (keyErr || !keyRecord || !keyRecord.is_active || keyRecord.client_secret_hash !== secretHash) {
        return new Response(
          JSON.stringify({ error: 'Invalid or inactive merchant API credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      merchantId = keyRecord.merchant_id;

      // Verify merchant is ACTIVE and has PAID setup fee
      const { data: mchAuthRecord } = await adminClient
        .from('merchants')
        .select('id, status, setup_fee_status')
        .eq('id', merchantId)
        .maybeSingle();

      if (!mchAuthRecord || mchAuthRecord.status !== 'ACTIVE' || mchAuthRecord.setup_fee_status !== 'PAID') {
        return new Response(
          JSON.stringify({
            error: 'Merchant Gateway is not active. Account must be approved with PAID setup fee prior to API dispatch.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // IP Whitelist Check
      const { data: whitelist } = await adminClient
        .from('merchant_ip_whitelist')
        .select('ip_address')
        .eq('merchant_id', merchantId);

      if (whitelist && whitelist.length > 0) {
        const allowed = whitelist.some((entry: any) => String(entry.ip_address).trim() === clientIp);
        if (!allowed) {
          return new Response(
            JSON.stringify({ error: `Forbidden: Client IP ${clientIp} is not authorized for this merchant` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update last_used_at on API key
      await adminClient
        .from('merchant_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('client_id', clientIdHeader.trim());

    } else if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      // Browser Bearer JWT Authentication Path
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);

      if (userErr || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: merchantRecord } = await adminClient
        .from('merchants')
        .select('id, status, setup_fee_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchantRecord || merchantRecord.status !== 'ACTIVE' || merchantRecord.setup_fee_status !== 'PAID') {
        return new Response(
          JSON.stringify({
            error: 'No active approved merchant account associated with this session. Setup fee must be PAID and account approved by admin.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      merchantId = merchantRecord.id;
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing authentication: provide X-Client-Id/Secret or Authorization Bearer' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve merchant identity' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse and Validate Request Payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderId = String(body.order_id || body.orderId || `m_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`).trim();
    const amount = Number(body.amount);
    const note = String(body.note || body.description || 'Merchant payout').trim().slice(0, 100);
    const idempotencyKey = req.headers.get('X-Idempotency-Key') || req.headers.get('x-idempotency-key') || body.idempotency_key || null;

    if (!amount || isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid payout amount greater than zero is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine Payout Method: UPI ONLY (IMPS no longer supported)
    const recipient = body.recipient || {};
    const rawMethod = String(body.type || body.method || body.payout_method || '').toUpperCase().trim();
    const hasBankField = Boolean(body.account_number || recipient.account_number || body.bank_account_number || recipient.ifsc || body.ifsc_code);

    if (rawMethod === 'IMPS' || hasBankField) {
      return new Response(
        JSON.stringify({ error: 'IMPS and bank account payouts are no longer supported. All merchant payouts are processed via UPI only.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upiId = String(body.upi_id || recipient.upi_id || '').trim();
    if (!upiId || !/^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$/.test(upiId)) {
      return new Response(
        JSON.stringify({ error: 'A valid UPI ID is required for payout. Expected format: username@bank' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const method: 'UPI' = 'UPI';
    const accountHolderName = String(body.account_holder_name || recipient.name || 'UPI Beneficiary').trim();

    // 3. Execute Atomic Payout Initiation RPC (Pessimistic float deduction + authoritative ₹2.50 fee)
    let initRes: any = null;
    let initErr: any = null;

    // Try upgraded 9-arg RPC signature (Migration 037/039)
    const rpc9Attempt = await adminClient.rpc('merchant_initiate_payout_rpc', {
      p_merchant_id: merchantId,
      p_order_id: orderId,
      p_amount: amount,
      p_payout_method: method,
      p_upi_id: upiId,
      p_account_holder_name: accountHolderName,
      p_bank_account_number: null,
      p_ifsc_code: null,
      p_idempotency_key: idempotencyKey,
    });

    if (rpc9Attempt.error && rpc9Attempt.error.message?.includes('function public.merchant_initiate_payout_rpc')) {
      // Fallback to legacy 7-arg signature if migration is pending manual execution
      const rpc7Attempt = await adminClient.rpc('merchant_initiate_payout_rpc', {
        p_merchant_id: merchantId,
        p_order_id: orderId,
        p_amount: amount,
        p_account_holder_name: accountHolderName,
        p_bank_account_number: 'UPI_RAIL',
        p_ifsc_code: 'UPI0000000',
        p_idempotency_key: idempotencyKey,
      });
      initRes = rpc7Attempt.data;
      initErr = rpc7Attempt.error;
    } else {
      initRes = rpc9Attempt.data;
      initErr = rpc9Attempt.error;
    }

    if (initErr || !initRes?.success) {
      return new Response(
        JSON.stringify({ error: initErr?.message || 'Failed to initiate merchant payout' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If request was already processed idempotently
    if (initRes.idempotent) {
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          payout_id: initRes.payout_id,
          provider_order_id: initRes.provider_order_id,
          status: initRes.status,
          amount: amount,
          fee: 2.50,
          total_debited: amount + 2.50,
          method: method,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payoutId = initRes.payout_id;
    const providerOrderId = initRes.provider_order_id;
    const authoritativeFee = 2.50; // MANDATORY FLAT ₹2.50 FEE
    const totalDebited = amount + authoritativeFee;

    // 4. Build PayNit Official Documented UPI Payout Payload
    const paynitPayload = {
      type: 'UPI',
      amount: amount,
      upi_id: upiId,
      note: note,
    };

    // 6. Dispatch HTTP POST to PayNit API (Server-Side Isolated)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let paynitRes: Response | null = null;
    let paynitData: any = {};
    const paynitAuthHeader = `Bearer ${paynitApiKey}:${paynitApiSecret}`;

    try {
      // Official PayNit documented payout endpoint: /v1/payout.php
      const payoutUrl = `${paynitBaseUrl}/v1/payout.php`;
      paynitRes = await fetch(payoutUrl, {
        method: 'POST',
        headers: {
          Authorization: paynitAuthHeader,
          'Content-Type': 'application/json',
          Origin: 'https://createlifafa.xyz',
        },
        body: JSON.stringify(paynitPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      paynitData = await paynitRes.json().catch(() => ({}));
    } catch (netErr: any) {
      clearTimeout(timeoutId);

      // Network / Request timeout -> State is UNCERTAIN.
      // CRITICAL: Do NOT mark FAILED or auto-refund float! Upstream PayNit may have processed disbursement.
      // Retain locked float and update status to PROCESSING awaiting status check / reconciliation.
      const timeoutReason = `Network dispatch timeout: ${netErr.message || 'Timeout contacting PayNit'}`;

      await adminClient
        .from('merchant_payouts')
        .update({
          status: 'PROCESSING',
          payout_provider: 'PAYNIT',
          rejection_reason: timeoutReason,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_order_id', providerOrderId)
        .eq('status', 'PENDING');

      await adminClient.from('merchant_payout_events').insert({
        provider_event_id: `pn_net_err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        payout_id: payoutId,
        event_type: 'paynit.dispatch_timeout',
        raw_payload: { error: netErr.message, provider_order_id: providerOrderId, method },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: orderId,
          provider_order_id: providerOrderId,
          amount: amount,
          fee: authoritativeFee,
          total_debited: totalDebited,
          method: method,
          error: timeoutReason,
          message: 'Dispatch timed out contacting PayNit. Payout held in PROCESSING state awaiting reconciliation. Float is preserved.',
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Process Real PayNit Provider Response
    const paynitOrderId = paynitData.order_id || paynitData.transaction?.order_id || null;
    const rawPaynitStatus = String(paynitData.status || paynitData.transaction?.status || '').toLowerCase();

    if (paynitRes.ok && paynitData.success === true) {
      // PayNit accepted the payout request
      if (rawPaynitStatus === 'success' || rawPaynitStatus === 'processed') {
        // Immediate confirmed success
        const eventId = `pn_succ_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await adminClient.rpc('merchant_finalize_payout_success_rpc', {
          p_provider_order_id: providerOrderId,
          p_provider_reference_id: paynitOrderId,
          p_provider_event_id: eventId,
          p_raw_payload: paynitData,
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'SUCCESS',
            order_id: orderId,
            provider_order_id: providerOrderId,
            provider_reference_id: paynitOrderId,
            amount: amount,
            fee: authoritativeFee,
            total_debited: totalDebited,
            method: method,
            message: 'Payment Completed via PayNit',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Status is 'processing' or 'pending' -> Standard PayNit real-time queuing
        await adminClient
          .from('merchant_payouts')
          .update({
            status: 'PROCESSING',
            payout_provider: 'PAYNIT',
            provider_reference_id: paynitOrderId,
            updated_at: new Date().toISOString(),
          })
          .eq('provider_order_id', providerOrderId);

        await adminClient.from('merchant_payout_events').insert({
          provider_event_id: `pn_proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          payout_id: payoutId,
          event_type: 'paynit.processing',
          raw_payload: paynitData,
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'PROCESSING',
            order_id: orderId,
            provider_order_id: providerOrderId,
            provider_reference_id: paynitOrderId,
            amount: amount,
            fee: authoritativeFee,
            total_debited: totalDebited,
            method: method,
            message: 'Payout initiated and processing via PayNit',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (paynitRes.status >= 500) {
      // PayNit Upstream Server Error (HTTP 5xx) -> UNCERTAIN STATE.
      // CRITICAL: Hold in PROCESSING. NEVER auto-refund on upstream 5xx.
      const rejectionReason = paynitData.message || paynitData.error || `PayNit upstream error (HTTP ${paynitRes.status})`;

      await adminClient
        .from('merchant_payouts')
        .update({
          status: 'PROCESSING',
          payout_provider: 'PAYNIT',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_order_id', providerOrderId)
        .eq('status', 'PENDING');

      await adminClient.from('merchant_payout_events').insert({
        provider_event_id: `pn_5xx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        payout_id: payoutId,
        event_type: 'paynit.dispatch_upstream_5xx',
        raw_payload: { status: paynitRes.status, body: paynitData, provider_order_id: providerOrderId },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: orderId,
          provider_order_id: providerOrderId,
          amount: amount,
          fee: authoritativeFee,
          total_debited: totalDebited,
          method: method,
          error: rejectionReason,
          message: 'PayNit returned HTTP 5xx. Payout held in PROCESSING state awaiting reconciliation. Locked float is preserved.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Definitive HTTP 4xx or { success: false } -> Upfront Provider Rejection.
      // E.g. invalid IFSC, invalid UPI, insufficient PayNit wallet.
      // Safely transition PENDING -> FAILED and refund float + fee.
      const rejectionReason = paynitData.message || paynitData.error || `PayNit rejected (HTTP ${paynitRes.status})`;

      await adminClient.rpc('merchant_finalize_payout_failure_rpc', {
        p_provider_order_id: providerOrderId,
        p_rejection_reason: rejectionReason,
        p_provider_event_id: `pn_4xx_${Date.now()}`,
        p_raw_payload: paynitData,
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'FAILED',
          order_id: orderId,
          provider_order_id: providerOrderId,
          amount: amount,
          fee: authoritativeFee,
          total_debited: totalDebited,
          method: method,
          error: rejectionReason,
          message: 'Payout definitively rejected by PayNit. Float balance and fee have been refunded.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal gateway dispatch error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
