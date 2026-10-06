// Supabase Edge Function: telegram-bot-connect
// Handles authenticated Telegram bot connection, verification, webhook configuration,
// health checking, and disconnection.
// STRICT SECURITY: Tokens are encrypted at rest and NEVER exposed to clients.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cryptographic helpers for AES-GCM token encryption & hashing
async function getCryptoKey(): Promise<CryptoKey> {
  const masterKey =
    Deno.env.get('TELEGRAM_ENCRYPTION_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!masterKey) {
    throw new Error('Server configuration error: Telegram encryption key is not configured. Ensure TELEGRAM_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY is set in environment secrets.');
  }

  const encoder = new TextEncoder();
  const rawHash = await crypto.subtle.digest('SHA-256', encoder.encode(masterKey));
  return await crypto.subtle.importKey('raw', rawHash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function encryptToken(token: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token)
  );
  const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedBase64: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes, (byte) => chars[byte % chars.length]).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server environment configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid authentication session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const action = body.action || 'connect';

    // =========================================================================
    // ACTION: CONNECT (Verify with Telegram API -> Configure Webhook -> Persist)
    // =========================================================================
    if (action === 'connect') {
      const { slot_id, bot_token } = body;

      if (!slot_id || typeof slot_id !== 'string') {
        return new Response(
          JSON.stringify({ success: false, error: 'Valid bot slot ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!bot_token || typeof bot_token !== 'string') {
        return new Response(
          JSON.stringify({ success: false, error: 'BotFather bot token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const trimmedToken = bot_token.trim();
      const tokenFormatRegex = /^[0-9]{8,12}:[a-zA-Z0-9_-]{35,50}$/;
      if (!tokenFormatRegex.test(trimmedToken)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid Telegram bot token format. Please check your token from @BotFather.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step A: Server-side slot verification (must belong to authenticated user and be AVAILABLE)
      const { data: slot, error: slotError } = await serviceClient
        .from('bot_slots')
        .select('*')
        .eq('id', slot_id)
        .eq('user_id', user.id)
        .single();

      if (slotError || !slot) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Bot slot not found or does not belong to your account',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (slot.status !== 'AVAILABLE') {
        return new Response(
          JSON.stringify({
            success: false,
            error: `This bot slot is already ${slot.status.toLowerCase()}. Please choose an available slot or purchase a new one.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step B: Call REAL Telegram Bot API: getMe
      let telegramMeRes;
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${trimmedToken}/getMe`);
        telegramMeRes = await tgRes.json();
      } catch (tgErr: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to connect to Telegram servers: ${tgErr.message || 'Network error'}`,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!telegramMeRes.ok || !telegramMeRes.result) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              telegramMeRes.description ||
              'Telegram rejected this bot token. Please check that the token is active in @BotFather.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tgBot = telegramMeRes.result;
      if (!tgBot.is_bot) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provided token is not a Telegram Bot' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step C: Duplicate Bot Protection
      const { data: existingBot } = await serviceClient
        .from('telegram_bots')
        .select('id, user_id, status')
        .eq('telegram_bot_id', tgBot.id)
        .eq('status', 'CONNECTED')
        .maybeSingle();

      if (existingBot) {
        if (existingBot.user_id === user.id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'This Telegram bot is already connected to your account.',
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'This Telegram bot is already connected to another account.',
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Generate a preliminary bot ID to construct the exact webhook URL
      const botId = crypto.randomUUID();
      const webhookSecret = generateWebhookSecret();
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-user-bot-webhook?bot_id=${botId}`;

      // Step D: Call REAL Telegram Bot API: setWebhook
      let webhookRes;
      try {
        const setWhRes = await fetch(`https://api.telegram.org/bot${trimmedToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: webhookSecret,
            drop_pending_updates: false,
          }),
        });
        webhookRes = await setWhRes.json();
      } catch (whErr: any) {
        return new Response(
          JSON.stringify({
            success: false,
            step: 'WEBHOOK_FAILED',
            error: `Bot verification succeeded, but webhook setup connection failed: ${whErr.message}`,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!webhookRes.ok || !webhookRes.result) {
        return new Response(
          JSON.stringify({
            success: false,
            step: 'WEBHOOK_FAILED',
            error: `Bot verification succeeded, but webhook setup failed: ${webhookRes.description || 'Unknown Telegram error'}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step E: Encrypt bot token & calculate hash for secure server-side storage
      const encryptedToken = await encryptToken(trimmedToken);
      const tokenHash = await hashToken(trimmedToken);

      // Step F: Insert into telegram_bots
      const { data: newBot, error: insertBotError } = await serviceClient
        .from('telegram_bots')
        .insert({
          id: botId,
          user_id: user.id,
          bot_slot_id: slot.id,
          telegram_bot_id: tgBot.id,
          telegram_username: tgBot.username || '',
          telegram_display_name: tgBot.first_name || tgBot.username || 'Telegram Bot',
          telegram_first_name: tgBot.first_name || '',
          telegram_can_join_groups: tgBot.can_join_groups ?? true,
          telegram_can_read_all_group_messages: tgBot.can_read_all_group_messages ?? false,
          status: 'CONNECTED',
          connection_status: 'CONNECTED',
          webhook_status: 'ACTIVE',
          webhook_url: webhookUrl,
          last_verified_at: new Date().toISOString(),
          connected_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertBotError || !newBot) {
        // Attempt webhook cleanup if DB insertion fails
        try {
          await fetch(`https://api.telegram.org/bot${trimmedToken}/deleteWebhook`);
        } catch (_) {}

        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to save bot connection: ${insertBotError?.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step G: Insert into isolated telegram_bot_secrets (zero client access)
      const { error: secretError } = await serviceClient.from('telegram_bot_secrets').insert({
        bot_id: newBot.id,
        encrypted_bot_token: encryptedToken,
        bot_token_hash: tokenHash,
        webhook_secret: webhookSecret,
      });

      if (secretError) {
        // Rollback bot entry
        await serviceClient.from('telegram_bots').delete().eq('id', newBot.id);
        try {
          await fetch(`https://api.telegram.org/bot${trimmedToken}/deleteWebhook`);
        } catch (_) {}

        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to secure bot credentials: ${secretError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step H: Update bot slot to ACTIVE
      await serviceClient
        .from('bot_slots')
        .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
        .eq('id', slot.id);

      // Step I: Audit events
      await serviceClient.from('telegram_bot_events').insert([
        {
          bot_id: newBot.id,
          event_type: 'BOT_CONNECT_ATTEMPT',
          raw_payload: { initiated_by: user.id },
        },
        {
          bot_id: newBot.id,
          event_type: 'BOT_VERIFIED',
          raw_payload: {
            telegram_bot_id: tgBot.id,
            username: tgBot.username,
            first_name: tgBot.first_name,
          },
        },
        {
          bot_id: newBot.id,
          event_type: 'BOT_WEBHOOK_SET',
          raw_payload: { webhook_url: webhookUrl },
        },
      ]);

      // Return clean public response with NO raw token or secrets
      return new Response(
        JSON.stringify({
          success: true,
          bot: newBot,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACTION: DISCONNECT (Remove Webhook with Telegram -> Mark Disconnected)
    // =========================================================================
    if (action === 'disconnect') {
      const { bot_id } = body;

      if (!bot_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'bot_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Verify ownership server-side
      const { data: bot, error: botError } = await serviceClient
        .from('telegram_bots')
        .select('*')
        .eq('id', bot_id)
        .eq('user_id', user.id)
        .single();

      if (botError || !bot) {
        return new Response(
          JSON.stringify({ success: false, error: 'Bot not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Fetch encrypted secret
      const { data: secret, error: secretError } = await serviceClient
        .from('telegram_bot_secrets')
        .select('encrypted_bot_token')
        .eq('bot_id', bot.id)
        .single();

      if (!secretError && secret?.encrypted_bot_token) {
        try {
          const rawToken = await decryptToken(secret.encrypted_bot_token);
          // Call Telegram deleteWebhook
          const delRes = await fetch(
            `https://api.telegram.org/bot${rawToken}/deleteWebhook?drop_pending_updates=false`
          );
          const delData = await delRes.json();
          if (!delData.ok) {
            console.warn(`[telegram-bot-connect] deleteWebhook notice: ${delData.description}`);
          }
        } catch (tgErr: any) {
          console.error(`[telegram-bot-connect] Failed calling deleteWebhook: ${tgErr.message}`);
        }
      }

      // 3. Mark bot disconnected & preserve history
      const now = new Date().toISOString();
      const { data: updatedBot, error: updateError } = await serviceClient
        .from('telegram_bots')
        .update({
          status: 'DISCONNECTED',
          connection_status: 'DISCONNECTED',
          webhook_status: 'REMOVED',
          disconnected_at: now,
          updated_at: now,
        })
        .eq('id', bot.id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to disconnect bot: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Release slot back to AVAILABLE so user can reuse their purchased entitlement
      if (bot.bot_slot_id) {
        await serviceClient
          .from('bot_slots')
          .update({ status: 'AVAILABLE', updated_at: now })
          .eq('id', bot.bot_slot_id);
      }

      // 5. Audit log
      await serviceClient.from('telegram_bot_events').insert([
        {
          bot_id: bot.id,
          event_type: 'BOT_DISCONNECT_ATTEMPT',
          raw_payload: { initiated_by: user.id },
        },
        {
          bot_id: bot.id,
          event_type: 'BOT_DISCONNECTED',
          raw_payload: { disconnected_at: now },
        },
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          bot: updatedBot,
          message: 'Telegram bot successfully disconnected and webhook removed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACTION: SYNC / HEALTH_CHECK
    // =========================================================================
    if (action === 'sync') {
      const { bot_id } = body;

      if (!bot_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'bot_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: bot, error: botError } = await serviceClient
        .from('telegram_bots')
        .select('*')
        .eq('id', bot_id)
        .eq('user_id', user.id)
        .single();

      if (botError || !bot) {
        return new Response(
          JSON.stringify({ success: false, error: 'Bot not found or unauthorized' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: secret } = await serviceClient
        .from('telegram_bot_secrets')
        .select('encrypted_bot_token')
        .eq('bot_id', bot.id)
        .single();

      if (!secret?.encrypted_bot_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Bot credentials missing' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rawToken = await decryptToken(secret.encrypted_bot_token);
      const [getMeRes, getWebhookRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${rawToken}/getMe`).then((r) => r.json()),
        fetch(`https://api.telegram.org/bot${rawToken}/getWebhookInfo`).then((r) => r.json()),
      ]);

      const now = new Date().toISOString();
      let connectionStatus = 'CONNECTED';
      let webhookStatus = bot.webhook_status;

      if (!getMeRes.ok) {
        connectionStatus = 'ERROR';
      }

      if (getWebhookRes.ok && getWebhookRes.result) {
        const whInfo = getWebhookRes.result;
        if (whInfo.url === bot.webhook_url && !whInfo.last_error_date) {
          webhookStatus = 'ACTIVE';
        } else if (whInfo.last_error_date) {
          webhookStatus = 'FAILED';
        }
      }

      const { data: refreshedBot } = await serviceClient
        .from('telegram_bots')
        .update({
          connection_status: connectionStatus,
          webhook_status: webhookStatus,
          last_verified_at: now,
          updated_at: now,
        })
        .eq('id', bot.id)
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          bot: refreshedBot || bot,
          webhook_info: getWebhookRes.ok ? getWebhookRes.result : null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unsupported action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
