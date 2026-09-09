// Supabase Edge Function: expiry-sweep
// Scheduled cron job / sweep that queries expired active Lifafas and idempotently
// releases unspent reserved funds back to the creator's wallet.

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

    // Query active lifafas whose expiry has elapsed
    const nowIso = new Date().toISOString();
    const { data: expiredLifafas, error } = await supabase
      .from('lifafas')
      .select('id, code, creator_id, remaining_amount')
      .eq('status', 'ACTIVE')
      .lte('expires_at', nowIso);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const results = [];

    for (const lifafa of expiredLifafas || []) {
      // Call idempotent refund RPC
      const { data, error: refundErr } = await supabase.rpc(
        'refund_expired_or_cancelled_lifafa_rpc',
        {
          p_lifafa_id: lifafa.id,
        }
      );

      results.push({
        lifafa_id: lifafa.id,
        code: lifafa.code,
        refunded: !refundErr,
        data,
        error: refundErr?.message,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sweptCount: expiredLifafas?.length || 0,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
