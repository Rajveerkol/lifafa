// Supabase Edge Function: verify-telegram-channel
// Checks if the Telegram channel exists and verifies that the Lifafa Bot is an active Administrator.

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
    const { channelUsername } = await req.json();

    if (!channelUsername) {
      return new Response(
        JSON.stringify({ success: false, error: 'Channel username is required' }),
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

    // Clean username
    const cleanUsername = channelUsername.trim().replace(/^@/, '');
    const chatIdentifier = `@${cleanUsername}`;

    // 1. Get bot details
    const botRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botData = await botRes.json();
    if (!botData.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Telegram Bot Token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const botId = botData.result.id;
    const botUsername = botData.result.username;

    // 2. Query channel details from Telegram API
    const chatRes = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatIdentifier)}`);
    const chatData = await chatRes.json();

    if (!chatData.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          channelExists: false,
          error: `Channel ${chatIdentifier} could not be found. Ensure it is public and username is spelled correctly.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channelId = chatData.result.id;
    const channelTitle = chatData.result.title || cleanUsername;

    // 3. Verify that the bot is an Administrator in the channel
    const memberRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${botId}`
    );
    const memberData = await memberRes.json();

    const isBotAdmin = memberData.ok && ['administrator', 'creator'].includes(memberData.result?.status);

    if (!isBotAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          channelExists: true,
          needsAdmin: true,
          channelTitle,
          channelId,
          channelUsername: cleanUsername,
          botUsername,
          botStatus: memberData?.result?.status || 'none',
          error: `Please add the bot as an administrator to this channel.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verification Success: Channel exists and Bot is confirmed Administrator / Creator
    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        channelExists: true,
        needsAdmin: false,
        channelUsername: cleanUsername,
        channelId,
        channelTitle,
        botUsername,
        botStatus: memberData.result.status,
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
