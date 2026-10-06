import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe AES-GCM Decrypt for bot tokens with dual-mode support
async function decryptBotToken(encryptedBase64: string, masterKeyInput?: string): Promise<string> {
  const masterKey =
    masterKeyInput ||
    Deno.env.get('TELEGRAM_ENCRYPTION_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('MASTER_BOT_SECRET_KEY');

  if (!masterKey) {
    throw new Error('Server configuration error: Telegram encryption key is not configured in environment secrets.');
  }

  // 1. If masterKey is a 64-char hex string, attempt raw key import
  if (/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    try {
      const binaryDerString = atob(encryptedBase64);
      const binaryDer = new Uint8Array(binaryDerString.length);
      for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
      }
      const iv = binaryDer.slice(0, 12);
      const ciphertext = binaryDer.slice(12);

      const rawKey = new Uint8Array(masterKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
      const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch (_e) {
      // Fall through to SHA-256 derivation
    }
  }

  // 2. Standard SHA-256 key derivation (identical to telegram-bot-connect)
  const encoder = new TextEncoder();
  const rawHash = await crypto.subtle.digest('SHA-256', encoder.encode(masterKey));
  const key = await crypto.subtle.importKey('raw', rawHash, { name: 'AES-GCM' }, false, ['decrypt']);
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

function buildInlineKeyboard(buttons: any[]): any {
  if (!Array.isArray(buttons) || buttons.length === 0) return undefined;
  const keyboardRows: any[][] = [];
  for (const row of buttons) {
    if (Array.isArray(row)) {
      const tgRow: any[] = [];
      for (const btn of row) {
        if (!btn || !btn.text) continue;
        if (btn.type === 'URL' && btn.value) {
          tgRow.push({ text: btn.text, url: btn.value });
        } else if (btn.url) {
          tgRow.push({ text: btn.text, url: btn.url });
        } else if (btn.callback_data) {
          tgRow.push({ text: btn.text, callback_data: btn.callback_data });
        } else if (btn.type === 'COMMAND' && btn.value) {
          tgRow.push({ text: btn.text, callback_data: `cb_cmd_${btn.value.replace(/^\//, '')}` });
        } else if (btn.id) {
          tgRow.push({ text: btn.text, callback_data: `cb_btn_${btn.id}` });
        } else {
          tgRow.push({ text: btn.text, callback_data: `cb_btn_${btn.text.slice(0, 16)}` });
        }
      }
      if (tgRow.length > 0) keyboardRows.push(tgRow);
    }
  }
  return keyboardRows.length > 0 ? { inline_keyboard: keyboardRows } : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server environment missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { broadcast_id, batch_size = 35 } = await req.json();

    if (!broadcast_id) {
      return new Response(JSON.stringify({ ok: false, error: 'broadcast_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch broadcast master record
    const { data: broadcast, error: broadcastError } = await serviceClient
      .from('bot_broadcasts')
      .select('*')
      .eq('id', broadcast_id)
      .single();

    if (broadcastError || !broadcast) {
      return new Response(JSON.stringify({ ok: false, error: 'Broadcast not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard: Prevent running already completed or cancelled broadcasts
    if (['COMPLETED', 'CANCELLED'].includes(broadcast.status)) {
      return new Response(JSON.stringify({ ok: false, error: `Broadcast is already ${broadcast.status}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authoritative Server-Side Plan Entitlement Check
    const { data: botRecord } = await serviceClient
      .from('telegram_bots')
      .select('bot_slot_id, bot_slot:bot_slots(plan_price, plan_name)')
      .eq('id', broadcast.bot_id)
      .single();

    const rawSlot: any = botRecord?.bot_slot;
    const planPrice = Number(rawSlot?.plan_price || 99);

    if (planPrice < 299) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Broadcasts are locked on Starter (₹99). Upgrade this bot to Basic (₹299) or higher to broadcast.`,
          required_plan: 299,
          current_plan: planPrice,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (broadcast.target_audience !== 'ALL_ACTIVE_USERS' && planPrice < 499) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Audience segmentation is a Pro feature (₹499+). Current plan is ₹${planPrice}.`,
          required_plan: 499,
          current_plan: planPrice,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Fetch and decrypt bot token
    const { data: secret, error: secretError } = await serviceClient
      .from('telegram_bot_secrets')
      .select('encrypted_bot_token')
      .eq('bot_id', broadcast.bot_id)
      .single();

    if (secretError || !secret) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot credentials not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let rawBotToken = '';
    try {
      rawBotToken = await decryptBotToken(secret.encrypted_bot_token);
    } catch (err: any) {
      return new Response(JSON.stringify({ ok: false, error: err?.message || 'Decryption failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Set broadcast status to PROCESSING & set started_at if not set
    await serviceClient
      .from('bot_broadcasts')
      .update({
        status: 'PROCESSING',
        started_at: broadcast.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcast_id);

    // 4. Fetch a batch of PENDING recipients
    const { data: recipients, error: recError } = await serviceClient
      .from('bot_broadcast_recipients')
      .select('*')
      .eq('broadcast_id', broadcast_id)
      .eq('status', 'PENDING')
      .limit(batch_size);

    if (recError) {
      return new Response(JSON.stringify({ ok: false, error: 'Failed to fetch recipients' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!recipients || recipients.length === 0) {
      // All done! Evaluate final status
      const { data: remainingCheck } = await serviceClient
        .from('bot_broadcast_recipients')
        .select('status')
        .eq('broadcast_id', broadcast_id);

      const sent = remainingCheck?.filter((r) => r.status === 'SENT').length || 0;
      const failed = remainingCheck?.filter((r) => r.status === 'FAILED').length || 0;
      const finalStatus = failed === 0 ? 'COMPLETED' : sent > 0 ? 'PARTIAL' : 'FAILED';

      await serviceClient
        .from('bot_broadcasts')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', broadcast_id);

      return new Response(JSON.stringify({ ok: true, status: finalStatus, message: 'All recipients processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Controlled Dispatch Loop
    let batchSent = 0;
    let batchFailed = 0;
    const replyMarkup = buildInlineKeyboard(broadcast.buttons);

    for (const recipient of recipients) {
      // Mark processing attempt
      await serviceClient
        .from('bot_broadcast_recipients')
        .update({
          status: 'PROCESSING',
          attempts: recipient.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipient.id);

      try {
        let tgRes: Response;

        if (broadcast.photo_url) {
          tgRes = await fetch(`https://api.telegram.org/bot${rawBotToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipient.telegram_user_id,
              photo: broadcast.photo_url,
              caption: broadcast.message_text,
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
            }),
          });
        } else {
          tgRes = await fetch(`https://api.telegram.org/bot${rawBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipient.telegram_user_id,
              text: broadcast.message_text,
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
            }),
          });
        }

        const tgJson = await tgRes.json();

        if (tgJson.ok) {
          batchSent++;
          await serviceClient
            .from('bot_broadcast_recipients')
            .update({
              status: 'SENT',
              telegram_message_id: tgJson.result?.message_id,
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
        } else {
          batchFailed++;
          const errCode = tgJson.error_code ? String(tgJson.error_code) : 'ERROR';
          const errMsg = tgJson.description || 'Failed to deliver';

          // If user blocked bot, update user status to BLOCKED
          if (tgJson.error_code === 403) {
            await serviceClient
              .from('bot_users')
              .update({ status: 'BLOCKED', updated_at: new Date().toISOString() })
              .eq('id', recipient.bot_user_id);
          }

          // Handle rate limit (429)
          if (tgJson.error_code === 429 && tgJson.parameters?.retry_after) {
            const waitSec = Math.min(Number(tgJson.parameters.retry_after), 10);
            await sleep(waitSec * 1000);
          }

          await serviceClient
            .from('bot_broadcast_recipients')
            .update({
              status: 'FAILED',
              error_code: errCode,
              error_message: errMsg,
              updated_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
        }
      } catch (err: any) {
        batchFailed++;
        await serviceClient
          .from('bot_broadcast_recipients')
          .update({
            status: 'FAILED',
            error_code: 'NETWORK_ERROR',
            error_message: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
      }

      // Safe pace delay: 50ms (up to 20 msgs/sec, well within Telegram limit)
      await sleep(50);
    }

    // 6. Update broadcast counters
    await serviceClient
      .from('bot_broadcasts')
      .update({
        sent_count: broadcast.sent_count + batchSent,
        failed_count: broadcast.failed_count + batchFailed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcast_id);

    // 7. Check if any pending remain
    const { count: pendingRemaining } = await serviceClient
      .from('bot_broadcast_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('broadcast_id', broadcast_id)
      .eq('status', 'PENDING');

    if (pendingRemaining === 0) {
      const finalSent = broadcast.sent_count + batchSent;
      const finalFailed = broadcast.failed_count + batchFailed;
      const finalStatus = finalFailed === 0 ? 'COMPLETED' : finalSent > 0 ? 'PARTIAL' : 'FAILED';

      await serviceClient
        .from('bot_broadcasts')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', broadcast_id);

      return new Response(
        JSON.stringify({
          ok: true,
          status: finalStatus,
          batch_sent: batchSent,
          batch_failed: batchFailed,
          pending_remaining: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'PROCESSING',
        batch_sent: batchSent,
        batch_failed: batchFailed,
        pending_remaining: pendingRemaining,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
