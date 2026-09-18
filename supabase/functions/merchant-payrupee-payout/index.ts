// Supabase Edge Function: merchant-payrupee-payout
// Multi-Merchant Payout Gateway Outbound Dispatch.
// 1. Authenticates via either API Key (X-Client-Id + X-Client-Secret) OR Supabase Bearer JWT.
// 2. Checks client IP against merchant_ip_whitelist.
// 3. Invokes merchant_initiate_payout_rpc for atomic float deduction & tiered fee calculation.
// 4. Retrieves Vault-decrypted bank account via service-role-only RPC.
// 5. Dispatches HTTP POST to PayRupee API (https://payrupee.tech/v1/payouts/).
// 6. STRICT ERROR CLASSIFICATION RULES:
//    a. HTTP 2xx/202: PENDING -> PROCESSING. Stores provider reference. NEVER marked SUCCESS. NEVER refund.
//    b. Network timeout: PENDING -> PROCESSING. Ambiguous. DO NOT refund. DO NOT auto-retry. Awaits webhook.
//    c. HTTP 5xx: Treat as AMBIGUOUS. PENDING -> PROCESSING. Upstream error != rejection. DO NOT refund.
//    d. Definitive HTTP 4xx: Request definitively rejected client-side. Calls failure RPC (FAILED + auto-refund).
//    e. Final SUCCESS can ONLY be produced by verified inbound PayRupee webhook.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id, x-client-secret, x-idempotency-key',
};

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
    const payrupeeSecret = Deno.env.get('PAYRUPEE_CLIENT_SECRET') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payrupeeSecret) {
      return new Response(
        JSON.stringify({ error: 'PayRupee provider credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Resolve Caller Identity (API Key or Bearer Session)
    let merchantId: string | null = null;
    const clientIdHeader = req.headers.get('X-Client-Id') || req.headers.get('x-client-id');
    const clientSecretHeader = req.headers.get('X-Client-Secret') || req.headers.get('x-client-secret');
    const authHeader = req.headers.get('Authorization');

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

      // IP Whitelist Check (if merchant has configured whitelist entries)
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

      // Update last_used_at timestamp on API key
      await adminClient
        .from('merchant_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('client_id', clientIdHeader.trim());

    } else if (authHeader?.startsWith('Bearer ')) {
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

    const orderId = body.order_id || body.orderId || `m_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const amount = Number(body.amount);
    const recipient = body.recipient || {};
    const accountHolderName = String(recipient.name || body.account_holder_name || '').trim();
    const bankAccountNumber = String(recipient.account_number || body.bank_account_number || '').trim();
    const ifscCode = String(recipient.ifsc || body.ifsc_code || '').trim().toUpperCase();
    const idempotencyKey = req.headers.get('X-Idempotency-Key') || req.headers.get('x-idempotency-key') || body.idempotency_key || null;

    if (!amount || amount <= 0 || !accountHolderName || !bankAccountNumber || !ifscCode) {
      return new Response(
        JSON.stringify({
          error: 'Missing required payout fields: amount, recipient.name, recipient.account_number, recipient.ifsc',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Execute Atomic Payout Initiation RPC (Pessimistic float deduction + tiered fee)
    const { data: initRes, error: initErr } = await adminClient.rpc('merchant_initiate_payout_rpc', {
      p_merchant_id: merchantId,
      p_order_id: String(orderId).trim(),
      p_amount: amount,
      p_account_holder_name: accountHolderName,
      p_bank_account_number: bankAccountNumber,
      p_ifsc_code: ifscCode,
      p_idempotency_key: idempotencyKey,
    });

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
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payoutId = initRes.payout_id;
    const providerOrderId = initRes.provider_order_id;
    const feeAmount = initRes.fee_amount;

    // 4. Retrieve Decrypted Bank Account via service-role Vault RPC
    const { data: decryptedAccount, error: decryptErr } = await adminClient.rpc(
      'get_decrypted_merchant_bank_account_rpc',
      { p_payout_id: payoutId }
    );

    if (decryptErr || !decryptedAccount) {
      // Rollback payout if decryption fails
      await adminClient.rpc('merchant_finalize_payout_failure_rpc', {
        p_provider_order_id: providerOrderId,
        p_rejection_reason: 'Decryption failed for bank credentials prior to dispatch',
        p_provider_event_id: `decrypt_err_${Date.now()}`,
      });

      return new Response(
        JSON.stringify({ error: 'Internal security error: unable to decrypt payout credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Build PayRupee Documented Payout Payload
    const payrupeePayload = {
      order_id: providerOrderId,
      amount: amount,
      currency: 'INR',
      method: 'bank',
      recipient: {
        name: accountHolderName,
        account_number: decryptedAccount.trim(),
        ifsc: ifscCode,
      },
    };

    // 6. Dispatch HTTP POST to PayRupee API (15s Timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let payrupeeRes: Response;
    let payrupeeData: any = {};

    try {
      payrupeeRes = await fetch('https://payrupee.tech/v1/payouts/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payrupeeSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payrupeePayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      payrupeeData = await payrupeeRes.json().catch(() => ({}));
    } catch (netErr: any) {
      clearTimeout(timeoutId);

      // Network Timeout: Payout was dispatched over the wire. Transition status PENDING -> PROCESSING.
      // Do NOT auto-refund. Awaits provider webhook or reconciliation.
      await adminClient
        .from('merchant_payouts')
        .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
        .eq('id', payoutId);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: orderId,
          provider_order_id: providerOrderId,
          amount: amount,
          fee: feeAmount,
          message: 'Dispatch timed out. Payout transitioned to PROCESSING awaiting provider webhook confirmation.',
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Process Provider Response with Strict Error Classification
    if (payrupeeRes.ok) {
      // Case 1: HTTP 2xx / 202 -> Accepted by provider.
      // Transition: PENDING -> PROCESSING.
      // Provider 2xx DOES NOT mean SUCCESS. Never refund.
      const providerRefId = payrupeeData.reference_id || payrupeeData.payout_id || null;

      await adminClient
        .from('merchant_payouts')
        .update({
          status: 'PROCESSING',
          provider_reference_id: providerRefId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: orderId,
          provider_order_id: providerOrderId,
          provider_reference_id: providerRefId,
          amount: amount,
          fee: feeAmount,
          message: 'Payout accepted by provider and is currently PROCESSING.',
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (payrupeeRes.status >= 500) {
      // Case 2: HTTP 5xx Server Error -> AMBIGUOUS RESPONSE.
      // Upstream server error is NOT proof that the request was rejected. The provider may have
      // partially or fully processed the transaction.
      // Transition: PENDING -> PROCESSING.
      // DO NOT refund automatically. DO NOT mark FAILED.
      // Awaits verified inbound webhook or manual reconciliation.
      const providerRefId = payrupeeData.reference_id || payrupeeData.payout_id || null;

      await adminClient
        .from('merchant_payouts')
        .update({
          status: 'PROCESSING',
          provider_reference_id: providerRefId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: orderId,
          provider_order_id: providerOrderId,
          provider_reference_id: providerRefId,
          amount: amount,
          fee: feeAmount,
          message: `Provider returned HTTP ${payrupeeRes.status} (Server Error). Payout transitioned to PROCESSING awaiting webhook confirmation. Float is retained.`,
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Case 3: Definitive HTTP 4xx Client Error -> Provider definitively rejected the request upfront.
      // E.g., 400 Bad Request, 401 Unauthorized, 422 Invalid IFSC/Account.
      // Funds were definitely NOT moved upstream.
      // Transition: PENDING -> FAILED.
      // Safely unlock float amount + refund payout fee back to merchant available_balance.
      const rejectionReason = payrupeeData.message || payrupeeData.error || `PayRupee HTTP ${payrupeeRes.status}`;

      await adminClient.rpc('merchant_finalize_payout_failure_rpc', {
        p_provider_order_id: providerOrderId,
        p_rejection_reason: rejectionReason,
        p_provider_event_id: `disp_4xx_${Date.now()}`,
        p_raw_payload: payrupeeData,
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'FAILED',
          order_id: orderId,
          provider_order_id: providerOrderId,
          error: rejectionReason,
          message: 'Payout definitively rejected by provider (HTTP 4xx). Float balance and fee have been refunded.',
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
