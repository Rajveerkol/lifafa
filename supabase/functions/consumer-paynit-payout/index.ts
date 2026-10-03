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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const paynitApiKey = Deno.env.get('PAYNIT_API_KEY') || '';
    const paynitApiSecret = Deno.env.get('PAYNIT_API_SECRET') || '';
    const paynitBaseUrl = (Deno.env.get('PAYNIT_BASE_URL') || 'https://api.paynit.in').replace(/\/$/, '');

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

    // 1. Authenticate Caller Session
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization Bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin } = await adminClient.rpc('is_admin', {
      check_user_id: user.id,
    });

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

    let withdrawal_id: string | undefined = body?.withdrawal_id;

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
    const { data: existingWth, error: fetchErr } = await adminClient
      .from('withdrawals')
      .select('id, user_id, amount, fee_amount, net_amount, account_holder_name, ifsc_code, bank_account_number_masked, upi_id, status, payout_provider, payout_method, provider_order_id, payout_reference_id, rejection_reason')
      .eq('id', withdrawal_id)
      .maybeSingle();

    if (fetchErr || !existingWth) {
      return new Response(
        JSON.stringify({ error: 'Withdrawal record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization: User must own the withdrawal, or caller must be admin
    if (existingWth.user_id !== user.id && !isAdmin) {
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

    // 4. Concurrently Lock Withdrawal from PENDING -> PROCESSING with deterministic ORD_<withdrawal_id>
    const deterministicOrderId = `ORD_${withdrawal_id}`;

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
    } else if (existingWth.status === 'PROCESSING') {
      withdrawal = existingWth;
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
          Origin: 'https://createlifafa.xyz',
        },
        body: JSON.stringify(paynitPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      paynitData = await paynitRes.json().catch(() => ({}));
    } catch (networkErr: any) {
      clearTimeout(timeoutId);

      // FINANCIAL SAFETY RULE: Network / Timeout MUST retain PROCESSING. NEVER auto-refund!
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYNIT',
        provider_event_id: `timeout_${Date.now()}`,
        status: 'NETWORK_TIMEOUT',
        raw_payload: { message: networkErr.message, order_id: deterministicOrderId, payload: paynitPayload },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          amount: payoutAmount,
          message: 'Dispatch timed out contacting PayNit. Withdrawal held in PROCESSING state awaiting reconciliation.',
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          success: false,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          amount: payoutAmount,
          error: rejectionReason,
          message: 'PayNit returned HTTP 5xx. Payout held in PROCESSING state awaiting reconciliation.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Definitive HTTP 4xx or { success: false } -> Upfront Provider Rejection.
      // Funds definitely did NOT move. Invoke authoritative admin_update_withdrawal_rpc to refund:
      // - User available balance (if Consumer Wallet withdrawal)
      // - Creator reserved balance (if Lifafa claim withdrawal)
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

      return new Response(
        JSON.stringify({
          success: false,
          status: 'FAILED',
          order_id: deterministicOrderId,
          amount: payoutAmount,
          error: rejectionReason,
          message: 'Payout definitively rejected by PayNit. Funds have been safely refunded according to platform policy.',
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
