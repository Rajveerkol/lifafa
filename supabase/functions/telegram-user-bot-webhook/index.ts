// Supabase Edge Function: telegram-user-bot-webhook
// Secure Inbound Webhook Handler & Realtime Engine (Phase 1, 2, & 3)
// Features:
// - Validates X-Telegram-Bot-Api-Secret-Token
// - Update Idempotency (Telegram update_id)
// - Phase 2 Real Telegram User Registration & Tracking
// - Phase 3 Command Processor (/start, /help, /menu, /profile, /status, and Custom Owner Commands)
// - Phase 3 Visual Menu Handler (Inline & Reply Keyboards)
// - Phase 3 Auto-Reply Keyword Engine
// - Phase 3 Secure Callback Query Action Resolver
// - Execution Audit Logging

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
};

// Cryptographic helper to decrypt bot token securely in memory
async function decryptToken(encryptedBase64: string): Promise<string> {
  const masterKey =
    Deno.env.get('TELEGRAM_ENCRYPTION_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!masterKey) {
    throw new Error('Server configuration error: Telegram encryption key is not configured in environment secrets.');
  }

  const encoder = new TextEncoder();
  const rawHash = await crypto.subtle.digest('SHA-256', encoder.encode(masterKey));
  const key = await crypto.subtle.importKey('raw', rawHash, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);

  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// Telegram API Helper: sendMessage
async function sendTelegramMessage(
  rawToken: string,
  chatId: number,
  text: string,
  replyMarkup?: any
): Promise<any> {
  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  const res = await fetch(`https://api.telegram.org/bot${rawToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// Telegram API Helper: answerCallbackQuery
async function answerTelegramCallbackQuery(
  rawToken: string,
  callbackQueryId: string,
  text?: string
): Promise<any> {
  const body: any = { callback_query_id: callbackQueryId };
  if (text) body.text = text;
  const res = await fetch(`https://api.telegram.org/bot${rawToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// Format stored button JSONB into Telegram InlineKeyboardMarkup
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
          tgRow.push({ text: btn.text, callback_data: `cb_text_${btn.text.slice(0, 16)}` });
        }
      }
      if (tgRow.length > 0) keyboardRows.push(tgRow);
    } else if (typeof row === 'object' && row.text) {
      // Single button fallback
      if (row.url) {
        keyboardRows.push([{ text: row.text, url: row.url }]);
      } else {
        keyboardRows.push([{ text: row.text, callback_data: row.callback_data || `cb_btn_${row.id || 'default'}` }]);
      }
    }
  }

  return keyboardRows.length > 0 ? { inline_keyboard: keyboardRows } : undefined;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const botId = url.searchParams.get('bot_id');

    if (!botId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing bot_id parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch secret token & encrypted bot token for this bot
    const { data: secret, error: secretError } = await serviceClient
      .from('telegram_bot_secrets')
      .select('webhook_secret, encrypted_bot_token')
      .eq('bot_id', botId)
      .single();

    if (secretError || !secret) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot secret not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate X-Telegram-Bot-Api-Secret-Token
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (!incomingSecret || incomingSecret !== secret.webhook_secret) {
      console.warn(`[telegram-user-bot-webhook] Unauthorized webhook attempt for bot: ${botId}`);
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized: Invalid secret token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch bot public metadata
    const { data: botRecord } = await serviceClient
      .from('telegram_bots')
      .select('*')
      .eq('id', botId)
      .single();

    if (!botRecord) {
      return new Response(JSON.stringify({ ok: false, error: 'Bot not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Parse incoming Telegram Update
    const update = await req.json();
    const updateId = update.update_id ? Number(update.update_id) : null;

    if (!updateId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt bot token in memory for Telegram operations
    const rawBotToken = await decryptToken(secret.encrypted_bot_token);

    // 5. Determine update type and extract user/chat structures
    let updateType = 'unknown';
    let fromUser: any = null;
    let chat: any = null;
    let textContent = '';
    let isStart = false;
    let startParam: string | null = null;
    let callbackQuery: any = null;

    if (update.message) {
      updateType = 'message';
      fromUser = update.message.from;
      chat = update.message.chat;
      textContent = update.message.text || '';

      const startMatch = textContent.match(/^\/start(?:\s+(.+))?$/i);
      if (startMatch) {
        isStart = true;
        startParam = startMatch[1] ? startMatch[1].trim() : null;
      }
    } else if (update.edited_message) {
      updateType = 'edited_message';
      fromUser = update.edited_message.from;
      chat = update.edited_message.chat;
      textContent = update.edited_message.text || '';
    } else if (update.callback_query) {
      updateType = 'callback_query';
      callbackQuery = update.callback_query;
      fromUser = callbackQuery.from;
      chat = callbackQuery.message?.chat;
      textContent = callbackQuery.data || '';
    } else if (update.my_chat_member) {
      updateType = 'my_chat_member';
      fromUser = update.my_chat_member.from;
      chat = update.my_chat_member.chat;
    }

    // 6. Execute atomic user registration & activity tracking (Phase 2 core)
    const sanitizedMetadata: Record<string, any> = {
      update_type: updateType,
      chat_type: chat?.type || null,
      has_text: Boolean(textContent),
      is_start: isStart,
      start_param: startParam,
    };

    const { data: rpcResult } = await serviceClient.rpc(
      'process_telegram_bot_update_rpc',
      {
        p_bot_id: botId,
        p_update_id: updateId,
        p_update_type: updateType,
        p_telegram_user_id: fromUser?.id ? Number(fromUser.id) : null,
        p_telegram_chat_id: chat?.id ? Number(chat.id) : null,
        p_username: fromUser?.username || null,
        p_first_name: fromUser?.first_name || null,
        p_last_name: fromUser?.last_name || null,
        p_language_code: fromUser?.language_code || null,
        p_is_bot: Boolean(fromUser?.is_bot),
        p_is_premium: Boolean(fromUser?.is_premium),
        p_is_start: isStart,
        p_start_param: startParam,
        p_event_metadata: sanitizedMetadata,
      }
    );

    // If update was already processed, exit idempotently to avoid duplicate responses
    if (rpcResult?.idempotent) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // PHASE 3: CALLBACK QUERY ACTIONS
    // =========================================================================
    if (updateType === 'callback_query' && callbackQuery && chat?.id) {
      const cbData = callbackQuery.data || '';
      await answerTelegramCallbackQuery(rawBotToken, callbackQuery.id);

      if (cbData === 'cb_menu_main' || cbData === 'cb_home') {
        // Render configured main menu
        const { data: mainMenu } = await serviceClient
          .from('bot_menus')
          .select('*')
          .eq('bot_id', botId)
          .eq('is_main_menu', true)
          .maybeSingle();

        const menuText = mainMenu?.message_text || '📋 <b>Main Menu</b>\nPlease choose an option:';
        const replyMarkup = buildInlineKeyboard(mainMenu?.buttons || []);

        await sendTelegramMessage(rawBotToken, chat.id, menuText, replyMarkup);

        await serviceClient.from('bot_automation_executions').insert({
          bot_id: botId,
          telegram_bot_id: botRecord.telegram_bot_id,
          update_id: updateId,
          telegram_user_id: fromUser.id,
          telegram_chat_id: chat.id,
          trigger_type: 'BUTTON_CLICK',
          trigger_value: cbData,
          action_type: 'SHOW_MENU',
          execution_status: 'SUCCESS',
        });
      } else if (cbData.startsWith('cb_cmd_')) {
        const cmdName = cbData.replace(/^cb_cmd_/, '').toLowerCase();
        const { data: cmdRow } = await serviceClient
          .from('bot_commands')
          .select('*')
          .eq('bot_id', botId)
          .eq('command', cmdName)
          .eq('enabled', true)
          .maybeSingle();

        if (cmdRow) {
          const replyMarkup = buildInlineKeyboard(cmdRow.buttons || []);
          await sendTelegramMessage(rawBotToken, chat.id, cmdRow.response_text, replyMarkup);

          await serviceClient.from('bot_automation_executions').insert({
            bot_id: botId,
            telegram_bot_id: botRecord.telegram_bot_id,
            update_id: updateId,
            telegram_user_id: fromUser.id,
            telegram_chat_id: chat.id,
            trigger_type: 'BUTTON_CLICK',
            trigger_value: cbData,
            action_type: 'RUN_COMMAND',
            execution_status: 'SUCCESS',
          });
        }
      } else if (cbData === 'cb_help') {
        const { data: helpCommands } = await serviceClient
          .from('bot_commands')
          .select('command, description')
          .eq('bot_id', botId)
          .eq('enabled', true)
          .order('sort_order', { ascending: true });

        let helpText = `🤖 <b>Available Commands</b>\n\n/start — Start the bot\n/menu — Open interactive menu\n/profile — View your profile\n/help — Show commands`;
        if (helpCommands && helpCommands.length > 0) {
          helpText += '\n\n<b>Custom Commands:</b>';
          for (const c of helpCommands) {
            helpText += `\n/${c.command} — ${c.description}`;
          }
        }
        await sendTelegramMessage(rawBotToken, chat.id, helpText);
      } else if (cbData === 'cb_profile') {
        const profileText = `👤 <b>Your Telegram Profile</b>\n\n• Name: <b>${fromUser.first_name || 'User'}</b>\n• Username: @${fromUser.username || 'None'}\n• Telegram ID: <code>${fromUser.id}</code>\n• Status: Active`;
        await sendTelegramMessage(rawBotToken, chat.id, profileText);
      }

      return new Response(JSON.stringify({ ok: true, callback_handled: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // PHASE 3: COMMAND PROCESSOR (When text starts with "/")
    // =========================================================================
    if (updateType === 'message' && textContent.startsWith('/') && chat?.id) {
      const match = textContent.match(/^\/([a-zA-Z0-9_]+)(?:@[\w_]+)?(?:\s+(.*))?$/);
      const commandName = match ? match[1].toLowerCase() : '';

      // Command: /start
      if (commandName === 'start') {
        let referralMessageAppend = '';

        // PHASE 4: Referral Attribution Processing
        if (startParam && startParam.toUpperCase().startsWith('REF_')) {
          try {
            const { data: currentUserRow } = await serviceClient
              .from('bot_users')
              .select('id')
              .eq('bot_id', botId)
              .eq('telegram_user_id', fromUser.id)
              .maybeSingle();

            if (currentUserRow) {
              const { data: refResult } = await serviceClient.rpc(
                'process_bot_referral_attribution_rpc',
                {
                  p_bot_id: botId,
                  p_referred_bot_user_id: currentUserRow.id,
                  p_referral_code: startParam.trim(),
                }
              );

              if (refResult?.ok) {
                referralMessageAppend = `\n\n🎁 <b>Referral Registered!</b> You joined through an official community invite.`;
              }
            }
          } catch (refErr: any) {
            console.warn('Referral attribution warning:', refErr.message);
          }
        }

        // PHASE 4: Campaign Auto-Join via /start CAMP_...
        if (startParam && startParam.toUpperCase().startsWith('CAMP_')) {
          try {
            const campId = startParam.slice(5).trim();
            const { data: currentUserRow } = await serviceClient
              .from('bot_users')
              .select('id')
              .eq('bot_id', botId)
              .eq('telegram_user_id', fromUser.id)
              .maybeSingle();

            if (currentUserRow) {
              await serviceClient
                .from('bot_campaign_participants')
                .insert({
                  campaign_id: campId,
                  bot_id: botId,
                  bot_user_id: currentUserRow.id,
                  telegram_user_id: fromUser.id,
                  status: 'JOINED',
                });
            }
          } catch (campErr: any) {
            console.warn('Campaign auto-join warning:', campErr.message);
          }
        }

        const { data: customStart } = await serviceClient
          .from('bot_commands')
          .select('*')
          .eq('bot_id', botId)
          .eq('command', 'start')
          .eq('enabled', true)
          .maybeSingle();

        const welcomeText = (customStart
          ? customStart.response_text
          : `👋 Hello <b>${fromUser?.first_name || fromUser?.username || 'there'}</b>!\n\nWelcome to <b>${botRecord.telegram_display_name}</b>. Your account has been registered successfully.\n\nUse /menu to open interactive options or /help for assistance.`) + referralMessageAppend;

        const replyMarkup = customStart ? buildInlineKeyboard(customStart.buttons || []) : undefined;
        await sendTelegramMessage(rawBotToken, chat.id, welcomeText, replyMarkup);

        await serviceClient.from('bot_automation_executions').insert({
          bot_id: botId,
          telegram_bot_id: botRecord.telegram_bot_id,
          update_id: updateId,
          telegram_user_id: fromUser.id,
          telegram_chat_id: chat.id,
          trigger_type: 'COMMAND',
          trigger_value: 'start',
          action_type: 'SEND_MESSAGE',
          execution_status: 'SUCCESS',
        });
        return new Response(JSON.stringify({ ok: true, handled: 'start' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Command: /ref or /referral (Phase 4 User Referral Deep-Link Generator)
      if (commandName === 'ref' || commandName === 'referral') {
        const { data: currentUserRow } = await serviceClient
          .from('bot_users')
          .select('id')
          .eq('bot_id', botId)
          .eq('telegram_user_id', fromUser.id)
          .maybeSingle();

        if (currentUserRow) {
          const { data: codeData } = await serviceClient.rpc(
            'get_or_create_bot_user_referral_code_rpc',
            {
              p_bot_id: botId,
              p_bot_user_id: currentUserRow.id,
            }
          );

          if (codeData?.code) {
            const deepLink = `https://t.me/${botRecord.telegram_username}?start=${codeData.code}`;
            const refReply = `🔗 <b>Your Exclusive Referral Link</b>\n\nInvite friends and community members with this link:\n<code>${deepLink}</code>\n\nShare this link to earn referral status and community rewards!`;
            await sendTelegramMessage(rawBotToken, chat.id, refReply);

            return new Response(JSON.stringify({ ok: true, handled: 'referral' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }

      // Command: /help (Dynamic listing of built-in + all enabled custom commands)
      if (commandName === 'help') {
        const { data: customCmds } = await serviceClient
          .from('bot_commands')
          .select('command, description')
          .eq('bot_id', botId)
          .eq('enabled', true)
          .order('sort_order', { ascending: true });

        let helpMessage = `🤖 <b>Available Commands</b>\n\n/start — Start the bot\n/menu — Open interactive menu\n/profile — View your profile\n/help — Show commands\n/status — Bot service health`;

        if (customCmds && customCmds.length > 0) {
          helpMessage += `\n\n<b>Custom Commands:</b>`;
          for (const cmd of customCmds) {
            if (cmd.command !== 'start' && cmd.command !== 'help' && cmd.command !== 'menu') {
              helpMessage += `\n/${cmd.command} — ${cmd.description}`;
            }
          }
        }

        await sendTelegramMessage(rawBotToken, chat.id, helpMessage);
        return new Response(JSON.stringify({ ok: true, handled: 'help' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Command: /menu
      if (commandName === 'menu') {
        const { data: mainMenu } = await serviceClient
          .from('bot_menus')
          .select('*')
          .eq('bot_id', botId)
          .eq('is_main_menu', true)
          .maybeSingle();

        if (mainMenu && mainMenu.buttons && mainMenu.buttons.length > 0) {
          const replyMarkup = buildInlineKeyboard(mainMenu.buttons);
          await sendTelegramMessage(rawBotToken, chat.id, mainMenu.message_text, replyMarkup);
        } else {
          // Clean real fallback message when no menu configured
          const fallbackText = `📋 <b>Main Menu</b>\n\nNo interactive menu buttons configured yet.\nType /help to see all available commands.`;
          await sendTelegramMessage(rawBotToken, chat.id, fallbackText);
        }
        return new Response(JSON.stringify({ ok: true, handled: 'menu' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Command: /profile
      if (commandName === 'profile') {
        const { data: botUser } = await serviceClient
          .from('bot_users')
          .select('*')
          .eq('bot_id', botId)
          .eq('telegram_user_id', fromUser.id)
          .maybeSingle();

        const profileText = `👤 <b>Your Telegram Profile</b>\n\n• Name: <b>${fromUser.first_name || 'User'}</b>\n• Username: @${fromUser.username || 'None'}\n• Telegram ID: <code>${fromUser.id}</code>\n• Status: ${botUser?.status || 'ACTIVE'}\n• Interactions: ${botUser?.start_count || 1}`;
        await sendTelegramMessage(rawBotToken, chat.id, profileText);
        return new Response(JSON.stringify({ ok: true, handled: 'profile' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Command: /status
      if (commandName === 'status') {
        const statusText = `🟢 <b>Bot System Status</b>\n\n• Name: <b>${botRecord.telegram_display_name}</b>\n• Health: Online & Active\n• Webhook: Connected`;
        await sendTelegramMessage(rawBotToken, chat.id, statusText);
        return new Response(JSON.stringify({ ok: true, handled: 'status' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Custom Bot Command
      const { data: customCmd } = await serviceClient
        .from('bot_commands')
        .select('*')
        .eq('bot_id', botId)
        .eq('command', commandName)
        .eq('enabled', true)
        .maybeSingle();

      if (customCmd) {
        const replyMarkup = buildInlineKeyboard(customCmd.buttons || []);
        await sendTelegramMessage(rawBotToken, chat.id, customCmd.response_text, replyMarkup);

        await serviceClient.from('bot_automation_executions').insert({
          bot_id: botId,
          telegram_bot_id: botRecord.telegram_bot_id,
          update_id: updateId,
          telegram_user_id: fromUser.id,
          telegram_chat_id: chat.id,
          trigger_type: 'COMMAND',
          trigger_value: commandName,
          action_type: 'SEND_MESSAGE',
          execution_status: 'SUCCESS',
        });
        return new Response(JSON.stringify({ ok: true, handled: commandName }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // =========================================================================
    // PHASE 3: AUTO-REPLY ENGINE (Keyword & trigger matching)
    // =========================================================================
    if (updateType === 'message' && textContent.trim() && !textContent.startsWith('/') && chat?.id) {
      const trimmed = textContent.trim();
      const lower = trimmed.toLowerCase();

      // Query enabled auto replies ordered by priority
      const { data: autoReplies } = await serviceClient
        .from('bot_auto_replies')
        .select('*')
        .eq('bot_id', botId)
        .eq('enabled', true)
        .order('priority', { ascending: false });

      if (autoReplies && autoReplies.length > 0) {
        for (const rule of autoReplies) {
          const ruleVal = (rule.trigger_value || '').trim().toLowerCase();
          let matched = false;

          if (rule.trigger_type === 'EXACT_TEXT') {
            matched = lower === ruleVal;
          } else if (rule.trigger_type === 'CONTAINS_TEXT') {
            matched = lower.includes(ruleVal);
          } else if (rule.trigger_type === 'STARTS_WITH') {
            matched = lower.startsWith(ruleVal);
          }

          if (matched) {
            const replyMarkup = buildInlineKeyboard(rule.buttons || []);
            await sendTelegramMessage(rawBotToken, chat.id, rule.response_text, replyMarkup);

            await serviceClient.from('bot_automation_executions').insert({
              bot_id: botId,
              telegram_bot_id: botRecord.telegram_bot_id,
              update_id: updateId,
              telegram_user_id: fromUser?.id || null,
              telegram_chat_id: chat.id,
              trigger_type: rule.trigger_type,
              trigger_value: rule.trigger_value,
              action_type: 'SEND_MESSAGE',
              execution_status: 'SUCCESS',
            });

            return new Response(JSON.stringify({ ok: true, auto_reply_matched: rule.name }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[telegram-user-bot-webhook] Uncaught Error: ${err.message}`);
    return new Response(JSON.stringify({ ok: true, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
