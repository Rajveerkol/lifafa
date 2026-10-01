// Supabase Edge Function: verify-telegram-membership
// Authoritative server-side verification of claimant's Telegram channel membership.
// Calls Telegram Bot API getChatMember and records verified completion with service-role.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!botToken || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: missing required credentials.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate the claimant via JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { channelUsername, channelId, telegramUserId, taskId, telegramUsername } = await req.json();

    if (!channelUsername && !channelId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'channelUsername or channelId is required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authoritative Profile Check: Ensure the claimant has bound their Telegram account
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('telegram_user_id, telegram_username')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !profile || !profile.telegram_user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: 'Your Telegram account is not linked. Please tap START in @createlifafa_bot to link your Telegram account before verifying membership.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const boundTelegramUserId = Number(profile.telegram_user_id);
    const boundTelegramUsername = profile.telegram_username;

    // Impersonation Prevention: If request payload specified a telegramUserId, it MUST match bound profile
    if (telegramUserId && Number(telegramUserId) !== boundTelegramUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: 'Security violation: telegramUserId does not match your linked Telegram account.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Always use the server-verified bound Telegram user ID
    const authoritativeTelegramUserId = boundTelegramUserId;
    const chatTarget = channelId || `@${channelUsername.trim().replace(/^@/, '')}`;

    // Call Telegram API getChatMember
    const memberRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatTarget)}&user_id=${encodeURIComponent(authoritativeTelegramUserId)}`
    );
    const memberData = await memberRes.json();

    if (!memberData.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: `Could not verify membership in ${chatTarget}. Ensure you have joined the channel.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = memberData.result.status;
    let isMember = ['creator', 'administrator', 'member'].includes(status);
    if (status === 'restricted') {
      isMember = memberData.result.is_member === true;
    }

    // If verified and taskId provided, record authoritative server-side completion
    if (isMember && taskId) {
      const { data: rpcData, error: rpcError } = await adminClient.rpc(
        'record_telegram_member_completion_server_rpc',
        {
          p_task_id: taskId,
          p_user_id: user.id,
          p_telegram_user_id: authoritativeTelegramUserId,
          p_telegram_username: boundTelegramUsername || telegramUsername || null,
          p_member_status: status,
        }
      );

      if (rpcError) {
        console.error('Error recording telegram completion via service role:', rpcError);
        return new Response(
          JSON.stringify({
            success: false,
            verified: false,
            error: rpcError.message || 'Failed to record verified Telegram task completion.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: isMember,
        memberStatus: status,
        message: isMember
          ? 'Membership verified successfully!'
          : 'User is not currently a member of this channel.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
