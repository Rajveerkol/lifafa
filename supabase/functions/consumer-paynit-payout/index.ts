// Supabase Edge Function: consumer-paynit-payout
// Dedicated Outbound Dispatch via PayNit for Consumer Wallet & Lifafa External Claims (UPI ONLY).
// 1. Authenticates caller via Supabase Bearer JWT.
// 2. Enforces payout_provider === 'PAYNIT' (rejects legacy PAYRUPEE records to preserve legacy routing).
// 3. Atomically reserves balance / validates withdrawal.
// 4. Concurrently locks status from PENDING -> PROCESSING with deterministic order_id.
// 5. Formats PayNit official payload:
//    - UPI:  { type: "UPI",  amount: <net_amount>, upi_id: "<vpa>", note: "Lifafa payout" }
//    - Rejects any IMPS / bank account attempts.
// 6. Dispatches server-side HTTP POST to PayNit API with 15s timeout.
// 7. Handles Real PayNit Response:
//    a. SUCCESS / processed -> Finalized via admin_update_withdrawal_rpc('SUCCESS').
//    b. processing / pending -> Held in PROCESSING with provider_reference_id.
//    c. Network timeout / 5xx -> Retained in PROCESSING. NEVER auto-refunds on ambiguous state.
//    d. Definitive 4xx / rejection -> FAILED with authoritative refund to user or creator.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Max-Age': '86400',
};

const PAYNIT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 CreateLifafa-Engine/2.0';

function getCanonicalPaynitOrigin(): string {
  const envOrigin = Deno.env.get('PAYNIT_ORIGIN') || Deno.env.get('SITE_URL') || '';
  if (envOrigin.trim()) {
    return envOrigin.trim().replace(/\/+$/, '');
  }
  return 'https://createlifafa.xyz';
}

function getCanonicalPaynitBaseUrl(): string {
  let rawUrl = (Deno.env.get('PAYNIT_BASE_URL') || 'https://api.paynit.in').trim();
  rawUrl = rawUrl
    .replace(/\/+$/, '')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/v1\/?$/, '')
    .replace(/\/api\/?$/, '')
    .replace(/\/payout\.php\/?$/, '');

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'paynit.in' || parsed.hostname === 'portal.paynit.in') {
      parsed.hostname = 'api.paynit.in';
    }
    return parsed.origin;
  } catch {
    return 'https://api.paynit.in';
  }
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
    const paynitBaseUrl = getCanonicalPaynitBaseUrl();
    const paynitOrigin = getCanonicalPaynitOrigin();

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paynitApiKey || !paynitApiSecret) {
      return new Response(
        JSON.stringify({ error: 'PayNit provider credentials not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Parse and Validate Request Payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let withdrawal_id: string | undefined = body?.withdrawal_id;

    // 2. Authenticate Caller Session (if available)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, '').trim()
      : null;

    let user: any = null;
    let isAdmin = false;

    if (token) {
      if (token === serviceRoleKey) {
        isAdmin = true;
      } else {
        const { data: userData, error: authError } = await adminClient.auth.getUser(token);
        if (!authError && userData?.user) {
          user = userData.user;
          const { data: adminFlag } = await adminClient.rpc('is_admin', {
            check_user_id: user.id,
          });
          isAdmin = Boolean(adminFlag);
        }
      }
    }

    let dispatchedRpcRes: any = null;

    // Single-call server orchestrator: If action === 'request_and_dispatch', initiate reservation first
    if (body.action === 'request_and_dispatch') {
      const {
        amount,
        accountHolderName,
        bankAccountNumber,
        ifscCode,
        payoutMethod,
        upiId,
        idempotencyKey,
      } = body;

      // Strict UPI-Only Architecture Enforcement
      if (payoutMethod === 'IMPS' || (bankAccountNumber && String(bankAccountNumber).trim() !== '')) {
        return new Response(
          JSON.stringify({ error: 'IMPS and bank account withdrawals are no longer supported. All withdrawals are processed via UPI only.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!upiId || String(upiId).trim() === '') {
        return new Response(
          JSON.stringify({ error: 'A valid UPI ID is required for withdrawal.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!user || !token) {
        return new Response(
          JSON.stringify({ error: 'Authentication required for wallet withdrawal request' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userClient = createClient(supabaseUrl, serviceRoleKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: rpcRes, error: rpcErr } = await userClient.rpc('request_withdrawal_rpc', {
        p_amount: Number(amount),
        p_account_holder_name: accountHolderName ? String(accountHolderName).trim() : null,
        p_bank_account_number: null,
        p_ifsc_code: null,
        p_upi_id: String(upiId).trim().toLowerCase(),
        p_idempotency_key: idempotencyKey ? String(idempotencyKey).trim() : null,
      });

      if (rpcErr || !rpcRes?.success) {
        return new Response(
          JSON.stringify({ error: rpcErr?.message || 'Failed to initiate withdrawal request' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      dispatchedRpcRes = rpcRes;
      withdrawal_id = rpcRes.withdrawal_id;

      // If request was already processed idempotently and in terminal or processing state
      if (rpcRes.idempotent) {
        const { data: existingWth } = await adminClient
          .from('withdrawals')
          .select('id, status, provider_order_id, payout_reference_id, net_amount, fee_amount, amount')
          .eq('id', withdrawal_id)
          .maybeSingle();

        if (existingWth && existingWth.status !== 'PENDING') {
          return new Response(
            JSON.stringify({
              success: true,
              idempotent: true,
              withdrawal_id: existingWth.id,
              status: existingWth.status,
              order_id: existingWth.provider_order_id,
              reference_id: existingWth.payout_reference_id,
              net_amount: existingWth.net_amount,
              fee_amount: existingWth.fee_amount,
              amount: existingWth.amount,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (!withdrawal_id) {
      return new Response(
        JSON.stringify({ error: 'Missing withdrawal_id in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Retrieve and Validate Target Withdrawal Record
    let existingWth: any = null;
    let fetchErr: any = null;

    // Retry with short backoff in case of read replica lag immediately after request_withdrawal_rpc
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await adminClient
        .from('withdrawals')
        .select('id, user_id, amount, fee_amount, net_amount, account_holder_name, ifsc_code, bank_account_number_masked, upi_id, status, payout_provider, payout_method, provider_order_id, payout_reference_id, rejection_reason, guest_claim_token')
        .eq('id', withdrawal_id)
        .maybeSingle();

      existingWth = res.data;
      fetchErr = res.error;

      if (existingWth) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 150));
    }

    // Fallback: If this is request_and_dispatch, the withdrawal was JUST created by request_withdrawal_rpc!
    // Never fail an already debited/created withdrawal just because read replica lag delayed PostgREST SELECT.
    if (!existingWth && body.action === 'request_and_dispatch' && dispatchedRpcRes?.withdrawal_id) {
      existingWth = {
        id: withdrawal_id,
        user_id: user?.id || null,
        amount: Number(dispatchedRpcRes.total_deducted ?? (Number(body.amount) + 2.5)),
        fee_amount: Number(dispatchedRpcRes.fee ?? 2.5),
        net_amount: Number(dispatchedRpcRes.amount ?? body.amount),
        account_holder_name: body.accountHolderName ? String(body.accountHolderName).trim() : (user?.full_name || 'Beneficiary'),
        ifsc_code: null,
        bank_account_number_masked: null,
        upi_id: String(body.upiId).trim().toLowerCase(),
        status: 'PENDING',
        payout_provider: 'PAYNIT',
        payout_method: 'UPI',
        provider_order_id: null,
        payout_reference_id: null,
        rejection_reason: null,
        guest_claim_token: null,
      };
    }

    if (!existingWth) {
      console.error('Failed to locate withdrawal record after retries:', { withdrawal_id, fetchErr });
      return new Response(
        JSON.stringify({ error: fetchErr?.message || 'Withdrawal record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization: User must own the withdrawal, or caller must be admin, or matching guest claim token
    const isOwner = Boolean(user && existingWth.user_id && existingWth.user_id === user.id);
    const cleanGuestToken = typeof body.guest_claim_token === 'string' ? body.guest_claim_token.trim() : null;
    const isAuthorizedGuest = Boolean(
      existingWth.user_id === null &&
      cleanGuestToken &&
      cleanGuestToken.length >= 16 &&
      existingWth.guest_claim_token &&
      existingWth.guest_claim_token === cleanGuestToken
    );

    if (!isOwner && !isAdmin && !isAuthorizedGuest) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have permission to dispatch this withdrawal' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PROVIDER ROUTING SAFETY: Enforce payout_provider === 'PAYNIT'
    if (existingWth.payout_provider && existingWth.payout_provider !== 'PAYNIT') {
      return new Response(
        JSON.stringify({
          error: `Invalid provider routing: this withdrawal is assigned to ${existingWth.payout_provider}. Use the legacy payrupee-payout endpoint for PayRupee records.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotent Short-Circuits for Terminal States
    if (existingWth.status === 'SUCCESS') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'SUCCESS',
          order_id: existingWth.provider_order_id,
          reference_id: existingWth.payout_reference_id,
          message: 'Payout already completed.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingWth.status === 'FAILED') {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'FAILED',
          order_id: existingWth.provider_order_id,
          error: existingWth.rejection_reason || 'Payout previously failed.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deterministicOrderId = existingWth.provider_order_id || `ORD_${withdrawal_id}`;

    // 3b. RECONCILIATION PATH: Authoritatively check status with PayNit or reconcile stuck PROCESSING withdrawals
    if (body.action === 'check_status' || body.action === 'reconcile' || existingWth.status === 'PROCESSING') {
      const orderIdToCheck = existingWth.payout_reference_id || existingWth.provider_order_id || deterministicOrderId;

      // Check if withdrawal has NO provider reference and its previous log was a connect error
      const { data: txList } = await adminClient
        .from('payout_transactions')
        .select('*')
        .eq('withdrawal_id', withdrawal_id)
        .order('created_at', { ascending: false });

      const lastTx = txList && txList.length > 0 ? txList[0] : null;
      const isKnownConnectFailure = !existingWth.payout_reference_id && lastTx && (
        lastTx.status === 'NETWORK_TIMEOUT' ||
        lastTx.status === 'CONNECT_FAILED' ||
        JSON.stringify(lastTx.raw_payload || {}).includes('Connect') ||
        JSON.stringify(lastTx.raw_payload || {}).includes('fatal alert') ||
        JSON.stringify(lastTx.raw_payload || {}).includes('InternalError')
      );

      // If connection definitively failed before transmission, PayNit NEVER received the request.
      // Finalize as FAILED via admin_update_withdrawal_rpc to release escrow and allow clean claimant retry.
      if (isKnownConnectFailure && existingWth.status === 'PROCESSING') {
        await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: existingWth.id,
          p_new_status: 'FAILED',
          p_payout_reference_id: deterministicOrderId,
          p_rejection_reason: 'Payment provider connection failed before dispatch (TLS/Connect error). Escrow safely refunded.',
        });

        await adminClient.from('payout_transactions').insert({
          withdrawal_id: existingWth.id,
          provider: 'PAYNIT',
          provider_event_id: `reconcile_conn_fail_${Date.now()}`,
          provider_reference_id: deterministicOrderId,
          status: 'RECONCILED_FAILED',
          raw_payload: { message: 'Reconciled connect failure: provider never received request. Escrow refunded.' },
        });

        return new Response(
          JSON.stringify({
            success: false,
            status: 'FAILED',
            order_id: deterministicOrderId,
            reconciled: true,
            error: 'Payment provider connection failed before dispatch. Funds have been safely refunded according to platform policy.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Query PayNit official status endpoint: POST /v1/status.php
      let statusData: any = null;
      let statusRes: Response | null = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        statusRes = await fetch(`${paynitBaseUrl}/v1/status.php`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paynitApiKey}:${paynitApiSecret}`,
            'Content-Type': 'application/json',
            'User-Agent': PAYNIT_USER_AGENT,
            Origin: paynitOrigin,
            Referer: `${paynitOrigin}/`,
            Accept: 'application/json',
          },
          body: JSON.stringify({ order_id: orderIdToCheck }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const rawText = await statusRes.text().catch(() => '');
        try { statusData = JSON.parse(rawText); } catch { statusData = { raw: rawText }; }
      } catch (stErr: any) {
        statusData = { error: stErr.message };
      }

      const rawStatus = String(statusData?.status || statusData?.transaction?.status || '').toLowerCase();
      const isConfirmedSuccess = statusRes?.ok && statusData?.success === true && (rawStatus === 'success' || rawStatus === 'processed');
      const isConfirmedFailure = (statusRes?.ok && statusData?.success === false) || rawStatus === 'failed' || rawStatus === 'rejected';

      if (isConfirmedSuccess) {
        const confirmedRef = statusData.order_id || statusData.transaction?.order_id || orderIdToCheck;
        await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: existingWth.id,
          p_new_status: 'SUCCESS',
          p_payout_reference_id: confirmedRef,
        });
        return new Response(
          JSON.stringify({
            success: true,
            status: 'SUCCESS',
            order_id: deterministicOrderId,
            reference_id: confirmedRef,
            reconciled: true,
            message: 'Payout verified as SUCCESS via provider status check.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (isConfirmedFailure) {
        const reason = statusData.message || statusData.error || 'Payment failed or not found at provider.';
        await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: existingWth.id,
          p_new_status: 'FAILED',
          p_payout_reference_id: orderIdToCheck,
          p_rejection_reason: reason,
        });
        return new Response(
          JSON.stringify({
            success: false,
            status: 'FAILED',
            order_id: deterministicOrderId,
            reconciled: true,
            error: reason,
            message: 'Payout confirmed failed by provider. Funds safely refunded.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If status is still genuinely pending with PayNit
      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          reference_id: orderIdToCheck,
          reconciled: false,
          message: 'Payout is still processing with payment provider.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Concurrently Lock Withdrawal from PENDING -> PROCESSING with deterministic ORD_<withdrawal_id>
    const { data: lockedRows, error: lockErr } = await adminClient
      .from('withdrawals')
      .update({
        status: 'PROCESSING',
        provider_order_id: deterministicOrderId,
        payout_provider: 'PAYNIT',
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id)
      .eq('status', 'PENDING')
      .select('id, user_id, amount, fee_amount, net_amount, account_holder_name, ifsc_code, bank_account_number_masked, upi_id, status, payout_method');

    let withdrawal: any = existingWth;
    if (!lockErr && lockedRows && lockedRows.length > 0) {
      withdrawal = lockedRows[0];
    } else {
      // Re-fetch in case of concurrent lock race
      const { data: rechecked } = await adminClient
        .from('withdrawals')
        .select('*')
        .eq('id', withdrawal_id)
        .maybeSingle();

      if (rechecked?.status === 'SUCCESS') {
        return new Response(
          JSON.stringify({
            success: true,
            status: 'SUCCESS',
            order_id: rechecked.provider_order_id,
            reference_id: rechecked.payout_reference_id,
            message: 'Payout already completed.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (rechecked?.status === 'PROCESSING') {
        withdrawal = rechecked;
      }
    }

    // 5. Enforce Method: UPI Only
    if (withdrawal.payout_method === 'IMPS' || (!withdrawal.upi_id && withdrawal.bank_account_number_masked)) {
      await adminClient
        .from('withdrawals')
        .update({ status: 'PENDING', updated_at: new Date().toISOString() })
        .eq('id', withdrawal.id)
        .eq('status', 'PROCESSING');

      return new Response(
        JSON.stringify({ error: 'IMPS payouts are no longer supported. All payouts are processed via UPI only.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payoutAmount = Number(withdrawal.net_amount != null ? withdrawal.net_amount : withdrawal.amount);
    const upiId = String(withdrawal.upi_id || '').trim();
    if (!upiId || !/^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$/.test(upiId)) {
      await adminClient
        .from('withdrawals')
        .update({ status: 'PENDING', updated_at: new Date().toISOString() })
        .eq('id', withdrawal.id)
        .eq('status', 'PROCESSING');

      return new Response(
        JSON.stringify({ error: 'Invalid UPI ID format for PayNit UPI payout' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paynitPayload = {
      type: 'UPI',
      amount: payoutAmount,
      upi_id: upiId,
      note: 'Lifafa payout',
    };

    // 6. Dispatch HTTP POST to PayNit API with 15s AbortController Timeout
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
          'User-Agent': PAYNIT_USER_AGENT,
          Origin: paynitOrigin,
          Referer: `${paynitOrigin}/`,
          Accept: 'application/json',
        },
        body: JSON.stringify(paynitPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const rawText = await paynitRes.text().catch(() => '');
      try {
        paynitData = JSON.parse(rawText);
      } catch {
        const isHtml = rawText.includes('<html') || rawText.includes('<!DOCTYPE');
        if (isHtml) {
          const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
          const challengeTitle = titleMatch ? titleMatch[1].trim() : 'WAF Challenge';
          paynitData = {
            success: false,
            is_waf_challenge: true,
            error: `Hostinger CDN Challenge (${paynitRes.status}): ${challengeTitle}`,
          };
        } else {
          paynitData = {
            success: false,
            error: rawText.slice(0, 200) || `HTTP ${paynitRes.status}`,
          };
        }
      }

      // Safe immediate retry if transient Hostinger CDN edge challenge was encountered
      if (paynitData.is_waf_challenge === true) {
        await new Promise((r) => setTimeout(r, 800));
        try {
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 12000);
          const retryRes = await fetch(payoutUrl, {
            method: 'POST',
            headers: {
              Authorization: paynitAuthHeader,
              'Content-Type': 'application/json',
              'User-Agent': PAYNIT_USER_AGENT,
              Origin: paynitOrigin,
              Referer: `${paynitOrigin}/`,
              Accept: 'application/json',
            },
            body: JSON.stringify(paynitPayload),
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
          const retryRawText = await retryRes.text().catch(() => '');
          try {
            const parsed = JSON.parse(retryRawText);
            paynitRes = retryRes;
            paynitData = parsed;
          } catch {
            // Still challenged on retry, keep WAF challenge flag
          }
        } catch (_retryErr) {
          // Retry timed out or connection failed
        }
      }
    } catch (networkErr: any) {
      clearTimeout(timeoutId);

      const isConnectError =
        networkErr.message?.includes('Connect') ||
        networkErr.message?.includes('fatal alert') ||
        networkErr.message?.includes('InternalError') ||
        networkErr.message?.includes('ECONNREFUSED') ||
        networkErr.message?.includes('ENOTFOUND') ||
        networkErr.message?.includes('ConnectionRefused');

      if (isConnectError) {
        // Zero HTTP bytes were transmitted to the provider. Provider NEVER accepted the payout.
        // Rule: Set PROCESSING only when provider confirmed acceptance.
        // Therefore, safely finalize as FAILED and refund creator escrow immediately.
        await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: withdrawal.id,
          p_new_status: 'FAILED',
          p_payout_reference_id: deterministicOrderId,
          p_rejection_reason: `Connection to payment provider failed before dispatch: ${networkErr.message}`,
        });

        await adminClient.from('payout_transactions').insert({
          withdrawal_id: withdrawal.id,
          provider: 'PAYNIT',
          provider_event_id: `conn_fail_${Date.now()}`,
          provider_reference_id: deterministicOrderId,
          status: 'CONNECT_FAILED',
          raw_payload: { message: networkErr.message, order_id: deterministicOrderId, payload: paynitPayload },
        });

        return new Response(
          JSON.stringify({
            success: false,
            status: 'FAILED',
            order_id: deterministicOrderId,
            amount: payoutAmount,
            error: `Connection to payment provider failed before dispatch (${networkErr.message}). Escrow has been safely refunded.`,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // FINANCIAL SAFETY RULE: Response read timeout / ambiguous in-flight MUST retain PROCESSING!
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYNIT',
        provider_event_id: `timeout_${Date.now()}`,
        status: 'NETWORK_TIMEOUT',
        raw_payload: { message: networkErr.message, order_id: deterministicOrderId, payload: paynitPayload },
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          amount: payoutAmount,
          message: 'Dispatch timed out contacting PayNit. Withdrawal held in PROCESSING state awaiting reconciliation.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Process PayNit Provider Response
    const paynitOrderId = paynitData.order_id || paynitData.transaction?.order_id || deterministicOrderId;
    const rawPaynitStatus = String(paynitData.status || paynitData.transaction?.status || '').toLowerCase();
    const statusCode = paynitRes.status;
    const rejectionReason = paynitData.message || paynitData.error || `PayNit HTTP ${statusCode}`;

    if (paynitRes.ok && paynitData.success === true) {
      if (rawPaynitStatus === 'success' || rawPaynitStatus === 'processed') {
        // Immediate Confirmed Success: Finalize withdrawal via admin_update_withdrawal_rpc
        await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: withdrawal.id,
          p_new_status: 'SUCCESS',
          p_payout_reference_id: paynitOrderId,
        });

        await adminClient.from('payout_transactions').insert({
          withdrawal_id: withdrawal.id,
          provider: 'PAYNIT',
          provider_event_id: `pn_succ_${Date.now()}`,
          provider_reference_id: paynitOrderId,
          status: 'SUCCESS',
          raw_payload: paynitData,
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'SUCCESS',
            order_id: deterministicOrderId,
            reference_id: paynitOrderId,
            amount: payoutAmount,
            message: 'Payout accepted by PayNit and completed successfully.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Status is 'processing' or 'pending': Standard PayNit queuing
        await adminClient
          .from('withdrawals')
          .update({
            status: 'PROCESSING',
            payout_provider: 'PAYNIT',
            payout_reference_id: paynitOrderId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', withdrawal.id);

        await adminClient.from('payout_transactions').insert({
          withdrawal_id: withdrawal.id,
          provider: 'PAYNIT',
          provider_event_id: `pn_proc_${Date.now()}`,
          provider_reference_id: paynitOrderId,
          status: 'PROVIDER_PROCESSING',
          raw_payload: paynitData,
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'PROCESSING',
            order_id: deterministicOrderId,
            reference_id: paynitOrderId,
            amount: payoutAmount,
            message: 'Payout initiated and processing via PayNit.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (statusCode >= 500) {
      // Upstream Provider Server Error (5xx): State is UNCERTAIN.
      // FINANCIAL SAFETY RULE: Hold in PROCESSING. NEVER auto-refund on upstream 5xx!
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYNIT',
        provider_event_id: `pn_5xx_${Date.now()}`,
        provider_reference_id: deterministicOrderId,
        status: 'PROVIDER_5XX_UNCERTAIN',
        raw_payload: { status_code: statusCode, error: rejectionReason, raw: paynitData },
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          amount: payoutAmount,
          error: rejectionReason,
          message: 'PayNit returned HTTP 5xx. Payout held in PROCESSING state awaiting reconciliation.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (paynitData.is_waf_challenge === true) {
      // Hostinger CDN / WAF challenged the request at the edge.
      // PayNit's core payout application did not reject this payout; the request was intercepted at the CDN layer.
      // MANDATORY SAFETY INVARIANT: Do NOT classify a CDN HTML challenge as a definitive provider payout rejection
      // unless authoritative transaction status from the provider confirms failure.
      let statusData: any = null;
      let statusConfirmedFailure = false;
      let statusConfirmedSuccess = false;
      let confirmedRef = deterministicOrderId;

      try {
        const statusController = new AbortController();
        const statusTimeout = setTimeout(() => statusController.abort(), 6000);
        const stRes = await fetch(`${paynitBaseUrl}/v1/status.php`, {
          method: 'POST',
          headers: {
            Authorization: paynitAuthHeader,
            'Content-Type': 'application/json',
            'User-Agent': PAYNIT_USER_AGENT,
            Origin: paynitOrigin,
            Referer: `${paynitOrigin}/`,
            Accept: 'application/json',
          },
          body: JSON.stringify({ order_id: deterministicOrderId }),
          signal: statusController.signal,
        });
        clearTimeout(statusTimeout);
        const stRaw = await stRes.text().catch(() => '');
        try { statusData = JSON.parse(stRaw); } catch { statusData = null; }

        if (statusData && typeof statusData === 'object') {
          const stStatus = String(statusData?.status || statusData?.transaction?.status || '').toLowerCase();
          if (stRes.ok && statusData.success === true && (stStatus === 'success' || stStatus === 'processed')) {
            statusConfirmedSuccess = true;
            confirmedRef = statusData.order_id || statusData.transaction?.order_id || deterministicOrderId;
          } else if (
            statusData.success === false &&
            (String(statusData.message || statusData.error || '').toLowerCase().includes('not found') ||
             String(statusData.message || statusData.error || '').toLowerCase().includes('invalid order_id'))
          ) {
            // Authoritative confirmation from PayNit database: Order definitely NEVER reached or existed in PayNit!
            statusConfirmedFailure = true;
          }
        }
      } catch (_stErr) {
        // Status check timed out or unreachable
      }

      if (statusConfirmedSuccess) {
        // Provider actually processed it! Finalize as SUCCESS
        await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: withdrawal.id,
          p_new_status: 'SUCCESS',
          p_payout_reference_id: confirmedRef,
        });

        await adminClient.from('payout_transactions').insert({
          withdrawal_id: withdrawal.id,
          provider: 'PAYNIT',
          provider_event_id: `pn_cdn_succ_${Date.now()}`,
          provider_reference_id: confirmedRef,
          status: 'SUCCESS',
          raw_payload: statusData,
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'SUCCESS',
            order_id: deterministicOrderId,
            reference_id: confirmedRef,
            amount: payoutAmount,
            message: 'Payout accepted by provider and confirmed successful.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (statusConfirmedFailure) {
        // Provider authoritatively confirmed the order does not exist in their ledger.
        // It is 100% safe to finalize as FAILED and restore escrow.
        const cleanFailReason = 'Payment provider gateway network challenge encountered before dispatch. Order not created.';
        await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: withdrawal.id,
          p_new_status: 'FAILED',
          p_payout_reference_id: deterministicOrderId,
          p_rejection_reason: cleanFailReason,
        });

        await adminClient.from('payout_transactions').insert({
          withdrawal_id: withdrawal.id,
          provider: 'PAYNIT',
          provider_event_id: `pn_cdn_fail_${Date.now()}`,
          provider_reference_id: deterministicOrderId,
          status: 'PROVIDER_REJECTED',
          raw_payload: { status_code: statusCode, error: rejectionReason, status_data: statusData },
        });

        return new Response(
          JSON.stringify({
            success: false,
            status: 'FAILED',
            order_id: deterministicOrderId,
            amount: payoutAmount,
            error: cleanFailReason,
            message: 'Payment gateway challenge prevented dispatch. Payout was not initiated and funds have been safely restored. Please retry.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // State is UNCERTAIN: Status check could not confirm outcome.
      // FINANCIAL SAFETY RULE: Hold in PROCESSING. NEVER auto-refund!
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYNIT',
        provider_event_id: `pn_cdn_unc_${Date.now()}`,
        provider_reference_id: deterministicOrderId,
        status: 'CDN_CHALLENGE_UNCERTAIN',
        raw_payload: { status_code: statusCode, error: rejectionReason, raw: paynitData },
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          amount: payoutAmount,
          message: 'Withdrawal request submitted. Payment provider gateway verification in progress.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Definitive HTTP 4xx or { success: false } -> Upfront Provider Rejection.
      // Funds definitely did NOT move. Invoke authoritative admin_update_withdrawal_rpc to refund:
      // - User available balance (if Consumer Wallet withdrawal)
      // - Creator reserved balance (if Lifafa claim withdrawal)
      console.error('PayNit Provider Rejection:', {
        statusCode,
        rejectionReason,
        orderId: deterministicOrderId,
        paynitData,
      });

      await adminClient.rpc('admin_update_withdrawal_rpc', {
        p_withdrawal_id: withdrawal.id,
        p_new_status: 'FAILED',
        p_payout_reference_id: deterministicOrderId,
        p_rejection_reason: rejectionReason,
      });

      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYNIT',
        provider_event_id: `pn_4xx_${Date.now()}`,
        provider_reference_id: deterministicOrderId,
        status: 'PROVIDER_REJECTED',
        raw_payload: { status_code: statusCode, error: rejectionReason, raw: paynitData },
      });

      let clientFacingError = rejectionReason;
      if (
        rejectionReason.includes('Domain validation failed') ||
        rejectionReason.includes('Origin header')
      ) {
        clientFacingError =
          'Payment gateway domain security verification check failed. Please ensure the domain configuration is verified in your provider settings or try again shortly.';
      } else if (
        rejectionReason.includes('Hostinger') ||
        rejectionReason.includes('WAF Challenge') ||
        rejectionReason.includes('Checking your browser')
      ) {
        clientFacingError =
          'Payment gateway network challenge encountered. Your funds/reward remain safe. Please try again shortly.';
      }

      return new Response(
        JSON.stringify({
          success: false,
          status: 'FAILED',
          order_id: deterministicOrderId,
          amount: payoutAmount,
          error: clientFacingError,
          message: 'Payout was rejected by payment provider. Funds have been safely refunded according to platform policy.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal consumer payout dispatch error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
