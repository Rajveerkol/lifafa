// Supabase Edge Function: verify-telegram-membership
// Verifies whether a specific claimant is an active member of the required Telegram channel.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { channelUsername, channelId, telegramUserId } = await req.json();

    if ((!channelUsername && !channelId) || !telegramUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'channelUsername or channelId, and telegramUserId are required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: TELEGRAM_BOT_TOKEN secret is not set.',
          isConfigured: false,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chatTarget = channelId || `@${channelUsername.trim().replace(/^@/, '')}`;

    // Call Telegram API getChatMember
    const memberRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatTarget)}&user_id=${encodeURIComponent(telegramUserId)}`
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
    const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(status);

    return new Response(
      JSON.stringify({
        success: true,
        verified: isMember,
        memberStatus: status,
        message: isMember ? 'Membership verified successfully!' : 'User is not currently a member of this channel.',
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
