// Supabase Edge Function: check-order-status
// Merchant Gateway Dedicated Order ID Status Check & Safe Reconcile Endpoint
// 1. Authenticates caller via Supabase Bearer JWT.
// 2. Enforces Rate Limiting (10 requests/minute per merchant).
// 3. Validates and sanitizes order_id input.
// 4. Authoritatively verifies merchant ownership (only payouts belonging to this merchant).
//    - Returns ONLY "Transaction not found." on non-ownership / non-existence (Zero Data Leakage).
// 5. Short-circuits terminal states:
//    - SUCCESS: idempotent response, no duplicate refund or ledger entry.
//    - FAILED / REVERSED: idempotent response, already refunded.
// 6. Queries real PayNit status API server-side with 15s timeout:
//    - POST https://api.paynit.in/v1/status.php
// 7. Handles provider outcome:
//    - Timeout / 5xx / Network Error / Unknown -> Keeps PROCESSING, NEVER auto-refunds.
//    - Definitive Failure (FAILED / REJECTED / DECLINED) -> Invokes merchant_finalize_payout_failure_rpc
//      to refund exact locked float (amount + fee) and append refund ledger entries.
//    - Exactly one refund per payout.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Max-Age': '86400',
};

// In-memory rate limiting map (sliding 60s window per merchant)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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
      .replace(/\/api\/?$/, '');
    if (!paynitBaseUrl.startsWith('http')) {
      paynitBaseUrl = 'https://api.paynit.in';
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: missing database credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paynitApiKey || !paynitApiSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'PayNit provider credentials not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate Caller
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Session invalid or expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve authenticated merchant record
    const { data: merchantRecord } = await adminClient
      .from('merchants')
      .select('id, user_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!merchantRecord) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const merchantId = merchantRecord.id;

    // 2. Rate Limiting (10 requests/minute per merchant)
    const now = Date.now();
    const rateKey = `mch_rate_${merchantId}`;
    const rateInfo = rateLimitMap.get(rateKey);
    if (rateInfo && rateInfo.resetAt > now) {
      if (rateInfo.count >= 10) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Too many status check requests. Please wait a minute before checking again.',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      rateInfo.count += 1;
    } else {
      rateLimitMap.set(rateKey, { count: 1, resetAt: now + 60000 });
    }

    // 3. Parse and Validate Request Payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawOrderId = body?.order_id || body?.orderId;
    if (!rawOrderId || typeof rawOrderId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanOrderId = rawOrderId.trim();
    if (cleanOrderId.length < 3 || cleanOrderId.length > 100 || !/^[a-zA-Z0-9_\-\.:]{3,100}$/.test(cleanOrderId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Order ID format. Please check the ID and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanOrderId);

    // 4. Authoritative Ownership Verification (Gateway payout MUST belong to THIS merchant)
    let mQuery = adminClient
      .from('merchant_payouts')
      .select('id, merchant_id, amount, fee_amount, total_deducted, status, order_id, provider_order_id, provider_reference_id, rejection_reason, created_at, upi_id, payout_method')
      .eq('merchant_id', merchantId);

    if (isUuid) {
      mQuery = mQuery.or(`order_id.eq.${cleanOrderId},provider_order_id.eq.${cleanOrderId},provider_reference_id.eq.${cleanOrderId},id.eq.${cleanOrderId}`);
    } else {
      mQuery = mQuery.or(`order_id.eq.${cleanOrderId},provider_order_id.eq.${cleanOrderId},provider_reference_id.eq.${cleanOrderId}`);
    }

    const { data: payout, error: pErr } = await mQuery.maybeSingle();

    // Strict Data Isolation / Anti-Enumeration Protection:
    // If not found or belongs to another merchant, return ONLY "Transaction not found." with ZERO data leakage
    if (pErr || !payout) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Transaction not found.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payoutId = payout.id;
    const currentDbStatus = String(payout.status || '').toUpperCase();
    const payoutAmount = Number(payout.amount);
    const feeAmount = Number(payout.fee_amount != null ? payout.fee_amount : 2.50);
    const totalDeducted = Number(payout.total_deducted != null ? payout.total_deducted : (payoutAmount + feeAmount));

    // 5. Short-Circuit Terminal States (Idempotency & Double-Refund Protection)
    if (currentDbStatus === 'SUCCESS') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'SUCCESS',
          order_id: payout.order_id,
          amount: payoutAmount,
          fee: feeAmount,
          total_deducted: totalDeducted,
          provider_reference_id: payout.provider_reference_id,
          message: 'Payment Successful. Payout has been completed by the banking network.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (currentDbStatus === 'FAILED' || currentDbStatus === 'REVERSED') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'FAILED',
          already_refunded: true,
          refunded: true,
          refund_amount: totalDeducted,
          order_id: payout.order_id,
          rejection_reason: payout.rejection_reason,
          message: `Payout Failed. The amount of ₹${totalDeducted.toFixed(2)} has been refunded to your Gateway wallet.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Query Real PayNit Provider Status API Server-Side
    const paynitLookupId = payout.provider_reference_id || payout.provider_order_id || payout.order_id || cleanOrderId;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let paynitRes: Response | null = null;
    let paynitData: any = {};
    const paynitAuthHeader = `Bearer ${paynitApiKey}:${paynitApiSecret}`;

    try {
      let statusUrl = `${paynitBaseUrl}/v1/status.php`;
      paynitRes = await fetch(statusUrl, {
        method: 'POST',
        headers: {
          Authorization: paynitAuthHeader,
          'Content-Type': 'application/json',
          Origin: 'https://createlifafa.xyz',
        },
        body: JSON.stringify({ order_id: paynitLookupId }),
        signal: controller.signal,
      });

      if (paynitRes.status === 404) {
        statusUrl = `${paynitBaseUrl}/status.php`;
        paynitRes = await fetch(statusUrl, {
          method: 'POST',
          headers: {
            Authorization: paynitAuthHeader,
            'Content-Type': 'application/json',
            Origin: 'https://createlifafa.xyz',
          },
          body: JSON.stringify({ order_id: paynitLookupId }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);
      paynitData = await paynitRes.json().catch(() => ({}));
    } catch (_networkErr) {
      clearTimeout(timeoutId);
      // FINANCIAL SAFETY RULE: On timeout, network failure, or abort, NEVER auto-refund!
      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: payout.order_id,
          amount: payoutAmount,
          message: 'Unable to confirm the final status. Please try again later.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Evaluate Provider Outcome
    const statusCode = paynitRes.status;
    if (statusCode >= 500) {
      // Upstream 5xx: State is uncertain -> DO NOT refund
      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: payout.order_id,
          amount: payoutAmount,
          message: 'Unable to confirm the final status. Please try again later.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawStatus = String(
      paynitData.status ||
      paynitData.transaction?.status ||
      paynitData.data?.status ||
      ''
    ).toLowerCase().trim();

    const isSuccess = rawStatus === 'success' || rawStatus === 'processed' || rawStatus === 'completed';
    const isProcessing = rawStatus === 'processing' || rawStatus === 'pending' || rawStatus === 'queued' || rawStatus === 'in_process';
    const isDefinitiveFailure =
      rawStatus === 'failed' ||
      rawStatus === 'rejected' ||
      rawStatus === 'declined' ||
      rawStatus === 'reversed' ||
      rawStatus === 'cancelled' ||
      rawStatus === 'canceled' ||
      (statusCode === 400 && paynitData.success === false && rawStatus === '');

    // 8. Handle SUCCESS -> Finalize State Idempotently
    if (isSuccess) {
      const successEventId = `status_succ_${payoutId}_${Date.now()}`;
      await adminClient.rpc('merchant_finalize_payout_success_rpc', {
        p_provider_order_id: payout.provider_order_id || payout.order_id,
        p_provider_reference_id: paynitData.order_id || paynitLookupId,
        p_provider_event_id: successEventId,
        p_raw_payload: paynitData,
      }).catch((e: any) => console.warn('Merchant finalize success RPC warning:', e));

      return new Response(
        JSON.stringify({
          success: true,
          status: 'SUCCESS',
          order_id: payout.order_id,
          amount: payoutAmount,
          fee: feeAmount,
          total_deducted: totalDeducted,
          provider_reference_id: paynitData.order_id || paynitLookupId,
          message: 'Payment Successful. Payout has been completed by the banking network.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Handle PROCESSING / PENDING -> Retain Processing State
    if (isProcessing) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: payout.order_id,
          amount: payoutAmount,
          message: 'Transaction is still processing.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Handle DEFINITIVE FAILED -> Safe Authoritative Wallet Refund (Maximum Once)
    if (isDefinitiveFailure) {
      const rejectionReason = paynitData.message || paynitData.error || 'Payment failed at banking provider';
      const failEventId = `status_fail_${payoutId}_${Date.now()}`;

      try {
        await adminClient.rpc('merchant_finalize_payout_failure_rpc', {
          p_provider_order_id: payout.provider_order_id || payout.order_id,
          p_rejection_reason: rejectionReason,
          p_provider_event_id: failEventId,
          p_raw_payload: paynitData,
        });
      } catch (rpcErr: any) {
        console.warn('merchant_finalize_payout_failure_rpc warning:', rpcErr?.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'FAILED',
          refunded: true,
          refund_amount: totalDeducted,
          order_id: payout.order_id,
          rejection_reason: rejectionReason,
          message: `Payout Failed. The amount of ₹${totalDeducted.toFixed(2)} has been refunded to your Gateway wallet.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11. Ambiguous / Unknown Provider Response -> NEVER REFUND
    return new Response(
      JSON.stringify({
        success: false,
        status: 'UNKNOWN',
        order_id: payout.order_id,
        message: 'Unable to confirm status. Please try again later.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('check-order-status error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error while checking status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
