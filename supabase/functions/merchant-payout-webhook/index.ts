// Supabase Edge Function: merchant-payout-webhook
// Inbound Webhook Receiver for PayRupee Payout Provider.
// 1. Validates X-PAYRUPEE-SIGNATURE HMAC SHA-256 against raw request body using timing-safe comparison.
// 2. Enforces idempotent event handling via merchant_payout_events.
// 3. Finalizes merchant payout SUCCESS or FAILED state atomically via service-role RPC.
// 4. Executes auto-refund of principal + fee on failed payouts.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const webhookSecret = Deno.env.get('PAYRUPEE_WEBHOOK_SECRET') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('Server configuration error: missing Supabase credentials', { status: 500 });
    }

    if (!webhookSecret) {
      return new Response('Server configuration error: PAYRUPEE_WEBHOOK_SECRET not configured', { status: 500 });
    }

    // 1. Retrieve Raw Request Body as Text
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('X-PAYRUPEE-SIGNATURE') || req.headers.get('x-payrupee-signature');

    if (!signatureHeader) {
      return new Response(JSON.stringify({ error: 'Missing X-PAYRUPEE-SIGNATURE header' }), {
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
    const computedBytes = encoder.encode(computedSignature);
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const eventId = String(payload.event_id || payload.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    const providerOrderId = String(payload.order_id || payload.provider_order_id || payload.reference_id || '').trim();
    const rawStatus = String(payload.status || payload.event || '').toLowerCase();
    const providerRefId = String(payload.payout_id || payload.reference_id || payload.utr || '').trim();
    const failureReason = payload.reason || payload.failure_reason || payload.message || 'Payout failed at provider';

    if (!providerOrderId) {
      return new Response(JSON.stringify({ error: 'Missing order_id in webhook payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Idempotency Check: Check if event already processed
    const { data: existingEvent } = await adminClient
      .from('merchant_payout_events')
      .select('id')
      .eq('provider_event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ success: true, idempotent: true, message: 'Event already processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Authoritative State Resolution
    if (rawStatus.includes('success') || rawStatus.includes('processed')) {
      // Payout SUCCESS -> Deduct locked float and increment totals
      const { data, error } = await adminClient.rpc('merchant_finalize_payout_success_rpc', {
        p_provider_order_id: providerOrderId,
        p_provider_reference_id: providerRefId || null,
        p_provider_event_id: eventId,
        p_raw_payload: payload,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      if (data && data.success === false) {
        return new Response(JSON.stringify({ success: false, conflict: true, error: data.error, data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, status: 'SUCCESS', data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } else if (rawStatus.includes('failed') || rawStatus.includes('rejected') || rawStatus.includes('reversed')) {
      // Payout FAILED -> Release locked float back to available_balance (Auto-refund)
      const { data, error } = await adminClient.rpc('merchant_finalize_payout_failure_rpc', {
        p_provider_order_id: providerOrderId,
        p_rejection_reason: failureReason,
        p_provider_event_id: eventId,
        p_raw_payload: payload,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      if (data && data.success === false) {
        return new Response(JSON.stringify({ success: false, conflict: true, refunded: false, error: data.error, data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, status: 'FAILED', refunded: Boolean(data?.refunded), data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Non-terminal event (e.g. payout.processing): Log event and acknowledge
    await adminClient.from('merchant_payout_events').insert({
      provider_event_id: eventId,
      event_type: rawStatus || 'payout.pending',
      raw_payload: payload,
    });

    return new Response(JSON.stringify({ success: true, status: 'RECEIVED' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Webhook processing error' }), { status: 500 });
  }
});
