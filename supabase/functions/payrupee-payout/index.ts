// Supabase Edge Function: payrupee-payout
// Outbound payout dispatch for PayRupee (POST https://payrupee.tech/v1/payouts).
// Strict caller authentication, { check_user_id } admin authorization, deterministic ORD_<id> idempotency,
// safe PENDING -> PROCESSING atomic locking, service-role-only credential retrieval,
// strict method=bank requirement (rejecting UPI-only payloads), and safe rollback without auto-refund.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const payrupeeSecret = Deno.env.get('PAYRUPEE_CLIENT_SECRET') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: missing Supabase environment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payrupeeSecret) {
      return new Response(JSON.stringify({ error: 'PayRupee credentials not configured (PAYRUPEE_CLIENT_SECRET missing)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Extract the Bearer token safely
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase service-role client for authoritative caller verification & operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Initialize userClient with caller token for PostgREST RPC operations requiring auth.uid()
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    // Authoritative caller verification using service-role client
    const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized caller' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Authorize admin caller (matches Migration 015 parameter check_user_id)
    const { data: isAdmin, error: adminErr } = await adminClient.rpc('is_admin', {
      check_user_id: user.id,
    });

    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required for payout dispatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Parse input
    let withdrawal_id: string | undefined;
    try {
      const body = await req.json();
      withdrawal_id = body?.withdrawal_id;
    } catch {
      return new Response(JSON.stringify({ error: 'Missing withdrawal_id parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!withdrawal_id) {
      return new Response(JSON.stringify({ error: 'Missing withdrawal_id parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Concurrently lock withdrawal from PENDING -> PROCESSING with deterministic ORD_<withdrawal_id>
    const deterministicOrderId = `ORD_${withdrawal_id}`;

    const { data: lockedRows, error: lockErr } = await adminClient
      .from('withdrawals')
      .update({
        status: 'PROCESSING',
        provider_order_id: deterministicOrderId,
        payout_provider: 'PAYRUPEE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id)
      .eq('status', 'PENDING')
      .select('id, amount, net_amount, account_holder_name, ifsc_code, bank_account_number_masked, upi_id, status');

    if (lockErr || !lockedRows || lockedRows.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Withdrawal is not eligible for dispatch. Must be in PENDING status.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const withdrawal = lockedRows[0];

    // 5. Retrieve decrypted bank account number via service-role-only RPC
    const { data: decryptedAccountNumber, error: decryptErr } = await adminClient.rpc(
      'get_decrypted_bank_account_rpc',
      { p_withdrawal_id: withdrawal.id }
    );

    // BLOCKER 5 ERROR PATH: If decryption fails, safely rollback to PENDING without triggering auto-refund
    // Preserves the same deterministic order_id (ORD_<id>) so retry remains idempotent
    if (decryptErr || !decryptedAccountNumber) {
      await adminClient
        .from('withdrawals')
        .update({
          status: 'PENDING',
          provider_order_id: deterministicOrderId,
          rejection_reason: 'Decryption failed for bank account credentials',
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.id)
        .eq('status', 'PROCESSING');

      return new Response(
        JSON.stringify({ error: 'Unable to decrypt bank account credentials for dispatch' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BLOCKER 6: Require valid bank account number + IFSC code for PayRupee method='bank'
    // Strictly do not invent a UPI payout API or send invalid payloads.
    if (!withdrawal.ifsc_code || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(withdrawal.ifsc_code.trim().toUpperCase())) {
      await adminClient
        .from('withdrawals')
        .update({
          status: 'PENDING',
          provider_order_id: deterministicOrderId,
          rejection_reason: 'PayRupee method=bank requires a valid IFSC code. UPI-only payouts cannot be dispatched via PayRupee bank method.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.id)
        .eq('status', 'PROCESSING');

      return new Response(
        JSON.stringify({
          error: 'PayRupee method=bank requires bank account number and valid IFSC code. UPI-only payouts are not supported by this provider.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Formulate exact documented PayRupee API payload
    const payoutPayload = {
      order_id: deterministicOrderId,
      amount: Number(withdrawal.net_amount || withdrawal.amount),
      currency: 'INR',
      method: 'bank',
      recipient: {
        name: withdrawal.account_holder_name.trim(),
        account_number: decryptedAccountNumber.trim(),
        ifsc: withdrawal.ifsc_code.trim().toUpperCase(),
      },
    };

    // 7. Dispatch HTTP POST to PayRupee API with 15s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let payrupeeResponse: Response;
    let payrupeeData: any = {};

    try {
      payrupeeResponse = await fetch('https://payrupee.tech/v1/payouts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payrupeeSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payoutPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      payrupeeData = await payrupeeResponse.json().catch(() => ({}));
    } catch (networkErr: any) {
      clearTimeout(timeoutId);
      // Network timeout: LEAVE withdrawal in PROCESSING to prevent duplicate payout or auto-refund
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYRUPEE',
        provider_event_id: `timeout_${Date.now()}`,
        status: 'NETWORK_TIMEOUT',
        raw_payload: { message: networkErr.message, order_id: deterministicOrderId },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          message: 'Dispatch timed out. Withdrawal held in PROCESSING state awaiting confirmation.',
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Record audit trail in payout_transactions
    const statusCode = payrupeeResponse.status;
    const rejectionReason = payrupeeData.message || payrupeeData.error || `PayRupee HTTP ${statusCode}`;

    // 9. Handle HTTP response status
    if (payrupeeResponse.ok) {
      // Business Rule: PayRupee HTTP 2xx Accepted = Immediate Local Withdrawal SUCCESS
      const providerReferenceId = payrupeeData.reference_id || payrupeeData.payout_id || deterministicOrderId;

      // Update withdrawal to SUCCESS via admin_update_withdrawal_rpc
      // Important: admin_update_withdrawal_rpc finalizes withdrawal state to SUCCESS without crediting wallet (funds were debited at request time)
      const { error: successErr } = await userClient.rpc('admin_update_withdrawal_rpc', {
        p_withdrawal_id: withdrawal.id,
        p_new_status: 'SUCCESS',
        p_payout_reference_id: providerReferenceId,
      });

      if (successErr) {
        // Fallback to adminClient
        const { error: adminErr } = await adminClient.rpc('admin_update_withdrawal_rpc', {
          p_withdrawal_id: withdrawal.id,
          p_new_status: 'SUCCESS',
          p_payout_reference_id: providerReferenceId,
        });

        if (adminErr) {
          // Direct atomic update if RPC fails
          await adminClient
            .from('withdrawals')
            .update({
              status: 'SUCCESS',
              payout_reference_id: providerReferenceId,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', withdrawal.id)
            .eq('status', 'PROCESSING');
        }
      }

      // Record successful payout audit entry in payout_transactions
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYRUPEE',
        provider_event_id: payrupeeData.id || payrupeeData.payout_id || `dispatch_${Date.now()}`,
        provider_reference_id: providerReferenceId,
        status: 'SUCCESS',
        raw_payload: payrupeeData,
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'SUCCESS',
          order_id: deterministicOrderId,
          reference_id: providerReferenceId,
          recipient_masked: withdrawal.bank_account_number_masked,
          message: 'Payout accepted by PayRupee and marked SUCCESS.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Provider Non-2xx Error Classification:
    // CRITICAL FINANCIAL SAFETY RULE: HTTP 5xx or connection uncertainty MUST NOT trigger auto-refund.
    // In-flight banking transactions could succeed on provider end despite server-side 5xx.

    // A. HTTP 5xx: Provider Server Error / Gateway Crash (UNCERTAIN OUTCOME)
    if (statusCode >= 500) {
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYRUPEE',
        provider_event_id: `err_5xx_${Date.now()}`,
        provider_reference_id: deterministicOrderId,
        status: 'PROVIDER_5XX_UNCERTAIN',
        raw_payload: { status_code: statusCode, error: rejectionReason, raw: payrupeeData },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          error: `Provider server error (HTTP ${statusCode}). Outcome is uncertain; withdrawal held in PROCESSING state awaiting reconciliation. No refund issued.`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // B. Ambiguous 4xx (408 Request Timeout, 429 Rate Limit)
    if (statusCode === 408 || statusCode === 429) {
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYRUPEE',
        provider_event_id: `ambiguous_4xx_${Date.now()}`,
        provider_reference_id: deterministicOrderId,
        status: 'PROVIDER_4XX_AMBIGUOUS',
        raw_payload: { status_code: statusCode, error: rejectionReason, raw: payrupeeData },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          error: `Provider returned HTTP ${statusCode} (${rejectionReason}). Outcome is uncertain; withdrawal held in PROCESSING state. No refund issued.`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // C. Check whether 4xx response definitively confirms payout was rejected and NOT accepted/queued
    // Only explicit validation/auth rejections are treated as definitive; generic errors default to PROCESSING
    const isDefinitive4xx = (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 422);
    const hasDefinitiveRejectionIndication = typeof rejectionReason === 'string' && (
      rejectionReason.toLowerCase().includes('reject') ||
      rejectionReason.toLowerCase().includes('invalid') ||
      rejectionReason.toLowerCase().includes('unauthorized') ||
      rejectionReason.toLowerCase().includes('forbidden') ||
      rejectionReason.toLowerCase().includes('not supported') ||
      rejectionReason.toLowerCase().includes('insufficient balance') ||
      rejectionReason.toLowerCase().includes('bad request')
    );

    if (!isDefinitive4xx || !hasDefinitiveRejectionIndication) {
      // Ambiguous 4xx: Keep in PROCESSING, do NOT refund
      await adminClient.from('payout_transactions').insert({
        withdrawal_id: withdrawal.id,
        provider: 'PAYRUPEE',
        provider_event_id: `ambiguous_${Date.now()}`,
        provider_reference_id: deterministicOrderId,
        status: 'PROVIDER_AMBIGUOUS_RESPONSE',
        raw_payload: { status_code: statusCode, error: rejectionReason, raw: payrupeeData },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: 'PROCESSING',
          order_id: deterministicOrderId,
          error: `Provider returned unclassified HTTP ${statusCode}. Held in PROCESSING state awaiting manual audit. No refund issued.`,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // D. DEFINITIVE PROVIDER REJECTION (HTTP 400/401/403/422 with clear rejection):
    // Payout was definitively rejected by provider before dispatch to banking network.
    // Record audit log
    await adminClient.from('payout_transactions').insert({
      withdrawal_id: withdrawal.id,
      provider: 'PAYRUPEE',
      provider_event_id: payrupeeData.id || payrupeeData.payout_id || `rejected_${Date.now()}`,
      provider_reference_id: deterministicOrderId,
      status: 'DEFINITIVE_REJECTION',
      raw_payload: payrupeeData,
    });

    // Execute single reversal refund via admin_update_withdrawal_rpc
    // userClient provides auth.uid() for has_admin_role check and admin_audit_logs
    const { error: refundErr } = await userClient.rpc('admin_update_withdrawal_rpc', {
      p_withdrawal_id: withdrawal.id,
      p_new_status: 'FAILED',
      p_payout_reference_id: deterministicOrderId,
      p_rejection_reason: rejectionReason,
    });

    if (refundErr) {
      await adminClient.rpc('admin_update_withdrawal_rpc', {
        p_withdrawal_id: withdrawal.id,
        p_new_status: 'FAILED',
        p_payout_reference_id: deterministicOrderId,
        p_rejection_reason: rejectionReason,
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        status: 'FAILED',
        error: rejectionReason,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
