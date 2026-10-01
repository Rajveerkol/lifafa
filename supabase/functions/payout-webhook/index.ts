// Supabase Edge Function: payout-webhook
// Inbound Webhook Receiver for Consumer Payout Provider (PayRupee / RazorpayX).
// 1. Validates X-PAYRUPEE-SIGNATURE (or X-RAZORPAY-SIGNATURE) HMAC SHA-256 against raw request body using timingSafeEqual.
// 2. Enforces idempotent event handling via payout_transactions.
// 3. Atomically updates withdrawal to SUCCESS or FAILED/REVERSED via service-role admin_update_withdrawal_rpc.
// 4. Safely auto-refunds user's wallet balance on failed payouts via database RPC.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const webhookSecret =
      Deno.env.get('PAYRUPEE_WEBHOOK_SECRET') ||
      Deno.env.get('PAYOUT_WEBHOOK_SECRET') ||
      '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('Server configuration error: missing Supabase credentials', { status: 500 });
    }

    if (!webhookSecret) {
      return new Response('Server configuration error: Webhook secret not configured', { status: 500 });
    }

    // 1. Retrieve Raw Request Body as Text
    const rawBody = await req.text();
    const signatureHeader =
      req.headers.get('X-PAYRUPEE-SIGNATURE') ||
      req.headers.get('x-payrupee-signature') ||
      req.headers.get('X-RAZORPAY-SIGNATURE') ||
      req.headers.get('x-razorpay-signature') ||
      req.headers.get('X-PAYOUT-SIGNATURE') ||
      req.headers.get('x-payout-signature');

    if (!signatureHeader) {
      return new Response(JSON.stringify({ error: 'Missing webhook signature header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Compute HMAC SHA-256 on Raw Body
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const computedSignature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 3. Timing-Safe Comparison to Prevent Timing Attacks
    const computedBytes = encoder.encode(computedSignature.toLowerCase());
    const providedBytes = encoder.encode(signatureHeader.trim().toLowerCase());

    const isValid =
      computedBytes.length === providedBytes.length &&
      crypto.subtle.timingSafeEqual(computedBytes, providedBytes);

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Parse JSON Payload
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const provider = payload.provider || (signatureHeader.startsWith('rzp') ? 'RAZORPAYX' : 'PAYRUPEE');
    const eventId = String(payload.event_id || payload.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);

    // Resolve withdrawal ID from body:
    // Can be withdrawal_id, or order_id / provider_order_id in format ORD_<uuid>, or reference_id
    let rawWithdrawalId =
      payload.withdrawal_id ||
      payload.order_id ||
      payload.provider_order_id ||
      payload.payload?.payout?.entity?.reference_id ||
      payload.reference_id ||
      '';

    if (typeof rawWithdrawalId === 'string' && rawWithdrawalId.startsWith('ORD_')) {
      rawWithdrawalId = rawWithdrawalId.substring(4);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let withdrawalId: string | null = null;
    if (typeof rawWithdrawalId === 'string' && uuidRegex.test(rawWithdrawalId.trim())) {
      withdrawalId = rawWithdrawalId.trim();
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // If withdrawalId is not directly in UUID format, attempt lookup by provider_order_id in withdrawals table
    if (!withdrawalId && payload.order_id) {
      const { data: wthRow } = await supabase
        .from('withdrawals')
        .select('id')
        .eq('provider_order_id', String(payload.order_id).trim())
        .maybeSingle();

      if (wthRow?.id) {
        withdrawalId = wthRow.id;
      }
    }

    if (!withdrawalId) {
      return new Response(JSON.stringify({ error: 'Missing or unresolvable withdrawal identifier' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Idempotency Check: Check if event already processed
    const { data: existingEvent } = await supabase
      .from('payout_transactions')
      .select('id')
      .eq('provider_event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ success: true, idempotent: true, message: 'Event already processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Map Status Authoritatively
    const rawStatus = String(payload.status || payload.event || '').toLowerCase();
    let mappedStatus = 'PROCESSING';
    if (rawStatus.includes('processed') || rawStatus.includes('success') || rawStatus.includes('completed')) {
      mappedStatus = 'SUCCESS';
    } else if (rawStatus.includes('failed') || rawStatus.includes('rejected')) {
      mappedStatus = 'FAILED';
    } else if (rawStatus.includes('reversed')) {
      mappedStatus = 'REVERSED';
    }

    const providerRefId = String(payload.payout_id || payload.reference_id || payload.utr || eventId).trim();
    const rejectionReason = payload.reason || payload.failure_reason || payload.message || null;

    // 7. Atomic Database Update via admin_update_withdrawal_rpc
    const { error: rpcErr } = await supabase.rpc('admin_update_withdrawal_rpc', {
      p_withdrawal_id: withdrawalId,
      p_new_status: mappedStatus,
      p_payout_reference_id: providerRefId,
      p_rejection_reason: rejectionReason,
    });

    if (rpcErr) {
      // Check if withdrawal was already in terminal state (idempotent / conflict safe)
      if (rpcErr.message?.includes('already in terminal status')) {
        return new Response(
          JSON.stringify({ success: true, conflict: true, message: rpcErr.message }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 8. Record webhook audit trail
    await supabase.from('payout_transactions').insert({
      withdrawal_id: withdrawalId,
      provider,
      provider_event_id: eventId,
      provider_reference_id: providerRefId,
      status: mappedStatus,
      raw_payload: payload,
    });

    return new Response(
      JSON.stringify({ success: true, withdrawal_id: withdrawalId, mappedStatus }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
