// Supabase Edge Function: verify-telegram-membership
// Authoritative server-side verification of claimant's Telegram channel membership.
// Incorporates Telegram eventual-consistency propagation retries, bidirectional channel identifier fallback,
// granular error classification, and records verified completion with service-role.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramMemberCheckResult {
  ok: boolean;
  httpStatus: number;
  status?: string; // 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked'
  isMember?: boolean;
  errorCode?: number;
  description?: string;
  retryAfterSeconds?: number;
  chatTarget: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function queryTelegramChatMember(
  chatTarget: string,
  userId: number,
  botToken: string
): Promise<TelegramMemberCheckResult> {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatTarget)}&user_id=${encodeURIComponent(userId)}`;
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      const desc = data.description || res.statusText || 'Telegram API request failed';
      const retryAfter = data.parameters?.retry_after;
      return {
        ok: false,
        httpStatus: res.status,
        errorCode: data.error_code || res.status,
        description: desc,
        retryAfterSeconds: retryAfter,
        chatTarget,
      };
    }

    const memberStatus = data.result?.status;
    let isMember = ['creator', 'administrator', 'member'].includes(memberStatus);
    if (memberStatus === 'restricted') {
      isMember = data.result?.is_member === true;
    }

    return {
      ok: true,
      httpStatus: res.status,
      status: memberStatus,
      isMember,
      chatTarget,
    };
  } catch (err: any) {
    return {
      ok: false,
      httpStatus: 500,
      errorCode: 500,
      description: err.message || 'Network error querying Telegram Bot API',
      chatTarget,
    };
  }
}

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

    const boundTelegramUserId = profile?.telegram_user_id ? Number(profile.telegram_user_id) : null;
    const boundTelegramUsername = profile?.telegram_username || null;

    // Use authoritative profile binding or validated request ID
    const authoritativeTelegramUserId = boundTelegramUserId || (telegramUserId ? Number(telegramUserId) : null);

    if (!authoritativeTelegramUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: 'Your Telegram account is not linked. Please tap START in @createlifafa_bot to link your Telegram account before verifying membership.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Impersonation Prevention: If user has a bound profile, request payload MUST match it
    if (boundTelegramUserId && telegramUserId && Number(telegramUserId) !== boundTelegramUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: 'Security violation: telegramUserId does not match your linked Telegram account.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Candidate channel identifiers (primary first, then fallback secondary)
    const candidateIdentifiers: string[] = [];

    const formattedChannelId = channelId ? String(channelId).trim() : null;
    const formattedUsername = channelUsername
      ? `@${channelUsername.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')}`
      : null;

    if (formattedChannelId) {
      candidateIdentifiers.push(formattedChannelId);
    }
    if (formattedUsername && !candidateIdentifiers.includes(formattedUsername)) {
      candidateIdentifiers.push(formattedUsername);
    }

    if (candidateIdentifiers.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Valid channel identifier is required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let activeIdentifier = candidateIdentifiers[0];
    const secondaryIdentifier = candidateIdentifiers.length > 1 ? candidateIdentifiers[1] : null;

    let lastResult: TelegramMemberCheckResult | null = null;
    let verified = false;

    // Controlled Retry Strategy:
    // Attempt 1: Query primary identifier
    //   If verified -> immediate success.
    //   If status="left" or 400 "user not found" -> wait 1200ms -> Attempt 2.
    //   If lookup failure ("chat not found") -> try secondary identifier immediately.
    // Attempt 2: Re-query
    //   If verified -> immediate success.
    //   If still not verified -> try secondary identifier -> wait 1500ms -> Attempt 3.
    // Attempt 3: Final check
    for (let attempt = 1; attempt <= 3; attempt++) {
      lastResult = await queryTelegramChatMember(activeIdentifier, authoritativeTelegramUserId, botToken);

      // 1. Immediate Success: creator, administrator, member, or valid restricted
      if (lastResult.ok && lastResult.isMember) {
        verified = true;
        break;
      }

      // 2. Immediate Rate Limit check: If 429, respect Telegram limits and stop retrying
      if (lastResult.errorCode === 429) {
        break;
      }

      // 3. Chat identifier resolution issue (chat not found / bad request):
      const isChatLookupFailure = !lastResult.ok && (
        lastResult.description?.toLowerCase().includes('chat not found') ||
        lastResult.description?.toLowerCase().includes('chat_id_invalid') ||
        lastResult.description?.toLowerCase().includes('member list is inaccessible')
      );

      if (isChatLookupFailure && secondaryIdentifier && activeIdentifier !== secondaryIdentifier) {
        activeIdentifier = secondaryIdentifier;
        // Re-check with secondary identifier without waiting
        lastResult = await queryTelegramChatMember(activeIdentifier, authoritativeTelegramUserId, botToken);
        if (lastResult.ok && lastResult.isMember) {
          verified = true;
          break;
        }
      }

      if (attempt === 3) {
        break;
      }

      // 4. Replication Latency Backoff:
      if (attempt === 1) {
        await sleep(1200);
      } else if (attempt === 2) {
        if (secondaryIdentifier && activeIdentifier !== secondaryIdentifier) {
          activeIdentifier = secondaryIdentifier;
        }
        await sleep(1500);
      }
    }

    // Process Verified Member
    if (verified && lastResult?.status) {
      if (taskId) {
        const { data: rpcData, error: rpcError } = await adminClient.rpc(
          'record_telegram_member_completion_server_rpc',
          {
            p_task_id: taskId,
            p_user_id: user.id,
            p_telegram_user_id: authoritativeTelegramUserId,
            p_telegram_username: boundTelegramUsername || telegramUsername || null,
            p_member_status: lastResult.status,
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
          verified: true,
          memberStatus: lastResult.status,
          message: 'Membership verified successfully!',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine granular, helpful error message
    let userErrorMessage = 'Please make sure you joined using the linked Telegram account.';
    let isSuccessPayload = true;
    let httpStatus = 200;

    if (lastResult) {
      if (lastResult.errorCode === 429) {
        userErrorMessage = 'Telegram API is experiencing high traffic. Please retry in a few moments.';
        isSuccessPayload = false;
        httpStatus = 429;
      } else if (lastResult.httpStatus >= 500) {
        userErrorMessage = 'Telegram service is temporarily unavailable. Please retry in a few moments.';
        isSuccessPayload = false;
        httpStatus = 502;
      } else if (lastResult.errorCode === 403) {
        userErrorMessage = 'Bot does not have administrator permissions in this channel. Please notify the channel owner.';
        isSuccessPayload = false;
      } else if (lastResult.description?.toLowerCase().includes('chat not found')) {
        userErrorMessage = 'Channel could not be located on Telegram. Please ensure the channel is public and accessible.';
        isSuccessPayload = false;
      } else if (lastResult.status === 'left' || lastResult.status === 'kicked') {
        userErrorMessage = 'Please make sure you joined using the linked Telegram account.';
        isSuccessPayload = true;
      }
    }

    return new Response(
      JSON.stringify({
        success: isSuccessPayload,
        verified: false,
        memberStatus: lastResult?.status || 'none',
        error: userErrorMessage,
        message: userErrorMessage,
      }),
      { status: httpStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
