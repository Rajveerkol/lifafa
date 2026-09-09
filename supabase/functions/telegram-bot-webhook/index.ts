// Supabase Edge Function: telegram-bot-webhook
// Handles incoming Telegram Bot webhook updates, specifically:
// /start bind_<nonce> deep links to cryptographically bind Telegram account to user profile.

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
    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const text = message.text.trim();
    const chatId = message.chat.id;
    const fromUser = message.from;

    // Check if message is a deep link start command: /start bind_<nonce>
    const bindMatch = text.match(/^\/start\s+(bind_[a-f0-9]+)$/i);

    if (bindMatch && supabaseUrl && supabaseServiceKey) {
      const nonce = bindMatch[1];
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Call database RPC to complete the binding securely
      const { data, error } = await supabase.rpc('complete_telegram_binding_rpc', {
        p_nonce: nonce,
        p_telegram_user_id: fromUser.id,
        p_telegram_username: fromUser.username || fromUser.first_name || 'telegram_user',
      });

      let replyText = '';
      if (error || !data?.success) {
        replyText = `⚠️ <b>Verification Failed</b>: ${error?.message || data?.error || 'Unknown error'}`;
      } else {
        const usernameDisplay = fromUser.username ? `@${fromUser.username}` : fromUser.first_name;
        replyText = `🎉 <b>Success!</b> Your Telegram account (<b>${usernameDisplay}</b>) has been cryptographically linked to your Lifafa profile.\n\nYou can now return to the Lifafa app and claim your rewards instantly! 🎁`;
      }

      // Send confirmation message back to the user via Telegram Bot API
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText,
            parse_mode: 'HTML',
          }),
        });
      }

      return new Response(JSON.stringify({ ok: true, bound: !error && data?.success }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default response for standard /start or help
    if (text === '/start' && botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `👋 Welcome to <b>Lifafa Bot</b>!\n\nThis bot verifies channel administration and membership for digital cash Lifafa rewards.\n\nTo link your account, click the <b>Verify with Telegram</b> button inside the Lifafa app.`,
          parse_mode: 'HTML',
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
