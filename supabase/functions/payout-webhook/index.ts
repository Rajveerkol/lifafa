// Supabase Edge Function: payout-webhook
// Idempotent webhook receiver for automated payout provider callbacks.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('Configuration error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();

    const provider = body.provider || 'RAZORPAYX';
    const eventId = body.event_id || body.id || `evt_${Date.now()}`;
    const withdrawalId = body.withdrawal_id || body.payload?.payout?.entity?.reference_id;
    const status = body.status || body.event; // e.g. 'payout.processed' -> SUCCESS, 'payout.failed' -> FAILED

    if (!withdrawalId) {
      return new Response(JSON.stringify({ error: 'Missing withdrawal_id' }), { status: 400 });
    }

    // Idempotency check: Ensure same event has not already been processed
    const { data: existingEvent } = await supabase
      .from('payout_transactions')
      .select('id')
      .eq('provider_event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ success: true, message: 'Event already processed' }), { status: 200 });
    }

    // Map status
    let mappedStatus = 'PROCESSING';
    if (status.includes('processed') || status.includes('success')) {
      mappedStatus = 'SUCCESS';
    } else if (status.includes('failed') || status.includes('rejected')) {
      mappedStatus = 'FAILED';
    } else if (status.includes('reversed')) {
      mappedStatus = 'REVERSED';
    }

    // Call admin_update_withdrawal_rpc to handle status and auto-refund atomically
    const { data, error } = await supabase.rpc('admin_update_withdrawal_rpc', {
      p_withdrawal_id: withdrawalId,
      p_new_status: mappedStatus,
      p_payout_reference_id: body.payout_id || eventId,
      p_rejection_reason: body.reason || null,
    });

    // Record webhook log
    await supabase.from('payout_transactions').insert({
      withdrawal_id: withdrawalId,
      provider,
      provider_event_id: eventId,
      provider_reference_id: body.payout_id || null,
      status: mappedStatus,
      raw_payload: body,
    });

    return new Response(JSON.stringify({ success: true, mappedStatus }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
