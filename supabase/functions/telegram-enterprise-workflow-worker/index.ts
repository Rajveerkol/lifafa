import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe AES-GCM Decrypt for bot tokens
async function decryptBotToken(encryptedBase64: string, keyHex: string): Promise<string> {
  try {
    const binaryDerString = atob(encryptedBase64);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    const iv = binaryDer.slice(0, 12);
    const ciphertext = binaryDer.slice(12);

    const rawKey = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
    const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (_e) {
    // Master key derivation: fail closed if environment secret is not configured
    const masterKey = Deno.env.get('TELEGRAM_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!masterKey) {
      throw new Error('Server configuration error: Telegram encryption key is not configured in environment secrets.');
    }
    const encoder = new TextEncoder();
    const rawHash = await crypto.subtle.digest('SHA-256', encoder.encode(masterKey));
    const key = await crypto.subtle.importKey('raw', rawHash, { name: 'AES-GCM' }, false, ['decrypt']);
    const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  }
}

// Pure safe string token substitution without dynamic code execution
function substituteVariables(template: string, vars: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key in vars && vars[key] !== undefined && vars[key] !== null) {
      return String(vars[key]);
    }
    return match;
  });
}

// Helper: Check IPv4 octets against private, loopback, link-local and reserved blocks
function isSafeIpv4(a: number, b: number, c: number, d: number): boolean {
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 10) return false; // 10.0.0.0/8
  if (a === 127) return false; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return false; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
  if (a === 192 && b === 168) return false; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 Carrier-grade NAT
  if (a === 192 && b === 0 && c === 0) return false; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return false; // 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return false; // 198.51.100.0/24
  if (a === 203 && b === 0 && c === 113) return false; // 203.0.113.0/24
  if (a >= 224) return false; // Multicast & Reserved
  return true;
}

// Comprehensive Outbound Webhook SSRF Guard (HTTPS only, IPv4/IPv6 private/metadata blocking)
function isSafeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    // 1. Strict HTTPS protocol requirement
    if (url.protocol !== 'https:') return false;

    // 2. Host normalization
    let host = url.hostname.toLowerCase().trim();
    if (host.startsWith('[') && host.endsWith(']')) {
      host = host.slice(1, -1);
    }

    // 3. Sensitive internal hostnames & cloud metadata endpoints
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.corp') ||
      host.endsWith('.lan') ||
      host.endsWith('.home') ||
      host.endsWith('.arpa') ||
      host === 'metadata' ||
      host === 'instance-data' ||
      host === '0.0.0.0'
    ) {
      return false;
    }

    // 4. IPv6 Validation
    if (host.includes(':')) {
      if (host === '::1' || host === '0:0:0:0:0:0:0:1' || host === '::' || host === '0:0:0:0:0:0:0:0') {
        return false;
      }
      // Unique Local Addresses (fc00::/7)
      if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^f[cd]::/i.test(host)) {
        return false;
      }
      // Link-Local (fe80::/10)
      if (/^fe[89ab][0-9a-f]:/i.test(host) || /^fe[89ab]::/i.test(host)) {
        return false;
      }
      // Multicast (ff00::/8)
      if (/^ff[0-9a-f]{2}:/i.test(host) || /^ff::/i.test(host)) {
        return false;
      }
      // IPv4-mapped IPv6
      if (host.toLowerCase().includes('ffff:')) {
        const parts = host.split('ffff:');
        if (parts[1]) {
          const mappedIpv4 = parts[1];
          if (/^\d+\.\d+\.\d+\.\d+$/.test(mappedIpv4)) {
            const octets = mappedIpv4.split('.').map((p) => parseInt(p, 10));
            if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;
            if (!isSafeIpv4(octets[0], octets[1], octets[2], octets[3])) return false;
          } else {
            return false;
          }
        }
        return false;
      }
      // IPv4-compatible IPv6
      if (/^::\d+\.\d+\.\d+\.\d+$/.test(host)) {
        return false;
      }
      // Discard & Documentation prefixes
      if (/^100::/i.test(host) || /^2001:db8:/i.test(host)) {
        return false;
      }
      return true;
    }

    // 5. Numeric or Dotted-Quad IPv4 Validation
    if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
      const num = host.startsWith('0x') ? parseInt(host, 16) : parseInt(host, 10);
      if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
        const a = (num >>> 24) & 255;
        const b = (num >>> 16) & 255;
        const c = (num >>> 8) & 255;
        const d = num & 255;
        return isSafeIpv4(a, b, c, d);
      }
      return false;
    }

    const ipv4Parts = host.split('.');
    if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^(0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(p))) {
      const octets = ipv4Parts.map((p) => {
        if (/^0x/i.test(p)) return parseInt(p, 16);
        if (/^0\d+/i.test(p)) return parseInt(p, 8);
        return parseInt(p, 10);
      });
      if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;
      return isSafeIpv4(octets[0], octets[1], octets[2], octets[3]);
    }

    // 6. Block internal/sensitive ports if explicitly specified
    if (url.port) {
      const p = parseInt(url.port, 10);
      const blockedPorts = [21, 22, 23, 25, 53, 110, 143, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 9200, 11211, 27017];
      if (blockedPorts.includes(p)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { action, bot_id } = body;

    // Fast Health Ping
    if (action === 'HEALTH_CHECK' || !action) {
      return new Response(
        JSON.stringify({
          status: 'ONLINE',
          service: 'telegram-enterprise-workflow-worker',
          version: '1.0.0-phase6',
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!bot_id) {
      return new Response(
        JSON.stringify({ error: 'bot_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // =========================================================================
    // AUTHORITATIVE BOT-LEVEL PLAN RESOLUTION (CRITICAL REQUIREMENT)
    // bot.id -> bot_slots.plan_price -> Must be >= 1999 (Enterprise)
    // =========================================================================
    const { data: bot, error: botErr } = await supabase
      .from('telegram_bots')
      .select('id, user_id, telegram_bot_id, telegram_username, telegram_display_name, bot_slot:bot_slots(id, plan_price, plan_name)')
      .eq('id', bot_id)
      .single();

    if (botErr || !bot) {
      return new Response(
        JSON.stringify({ error: 'Bot not found', details: botErr?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const slotData = Array.isArray(bot.bot_slot) ? bot.bot_slot[0] : bot.bot_slot;
    const planPrice = Number(slotData?.plan_price || 99);

    if (planPrice < 1999) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden: Bot slot plan does not entitle Enterprise Automation (₹1,999 required)',
          current_plan_price: planPrice,
          required_plan_price: 1999,
          tier: 'NON_ENTERPRISE',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // =========================================================================
    // ACTION 1: PROCESS_QUEUE (Process ready delayed & scheduled jobs)
    // =========================================================================
    if (action === 'PROCESS_QUEUE') {
      const nowIso = new Date().toISOString();

      // Fetch pending jobs ready to run
      const { data: jobs, error: jobsErr } = await supabase
        .from('bot_workflow_jobs')
        .select(`
          id,
          workflow_id,
          node_id,
          bot_user_id,
          telegram_chat_id,
          execution_id,
          step_index,
          status,
          attempt_count,
          max_retries,
          context_data,
          workflow:bot_workflows(id, name, is_journey, journey_data, loop_depth_limit)
        `)
        .eq('bot_id', bot_id)
        .in('status', ['QUEUED', 'WAITING'])
        .lte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (jobsErr) {
        throw new Error(`Failed to query workflow jobs: ${jobsErr.message}`);
      }

      if (!jobs || jobs.length === 0) {
        return new Response(
          JSON.stringify({ success: true, processed: 0, message: 'No pending workflow jobs' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Load Decrypted Bot Token for Telegram API calls
      const { data: secret } = await supabase
        .from('telegram_bot_secrets')
        .select('encrypted_bot_token, encryption_key_hash')
        .eq('bot_id', bot_id)
        .single();

      let botToken: string | null = null;
      if (secret?.encrypted_bot_token) {
        botToken = await decryptBotToken(
          secret.encrypted_bot_token,
          secret.encryption_key_hash || ''
        );
      }

      let processedCount = 0;
      const jobResults = [];

      for (const job of jobs) {
        processedCount++;
        const wf = Array.isArray(job.workflow) ? job.workflow[0] : job.workflow;
        const maxDepth = Number(wf?.loop_depth_limit || 5);

        // 1. Anti-Loop Protection
        if (job.step_index >= maxDepth) {
          await supabase
            .from('bot_workflow_jobs')
            .update({
              status: 'FAILED',
              last_error: `Loop protection triggered: Step index reached maximum depth limit (${maxDepth})`,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          await supabase.from('bot_audit_logs').insert({
            bot_id,
            action: 'loop_protection_blocked',
            target_type: 'workflow_job',
            target_id: job.id,
            details: { execution_id: job.execution_id, step_index: job.step_index },
          });

          jobResults.push({ id: job.id, status: 'FAILED_LOOP_PROTECTION' });
          continue;
        }

        // 2. Mark Running
        await supabase
          .from('bot_workflow_jobs')
          .update({ status: 'RUNNING', started_at: new Date().toISOString() })
          .eq('id', job.id);

        try {
          // Resolve User Telemetry for safe personalization
          const { data: botUser } = await supabase
            .from('bot_users')
            .select('id, telegram_user_id, first_name, username')
            .eq('id', job.bot_user_id)
            .single();

          const { count: refCount } = await supabase
            .from('bot_referral_events')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_user_id', job.bot_user_id);

          const vars = {
            first_name: botUser?.first_name || 'Subscriber',
            username: botUser?.username || '',
            telegram_id: botUser?.telegram_user_id || job.telegram_chat_id,
            bot_name: bot.telegram_display_name,
            referral_count: refCount || 0,
            ...(job.context_data || {}),
          };

          // Find current node in journey_data
          const nodes = wf?.journey_data?.nodes || [];
          const currentNode = nodes[job.step_index] || nodes[0] || {
            node_type: 'ACTION',
            config: { action: 'SEND_MESSAGE', text: 'Hello from Enterprise Automation!' },
          };

          // Execute Node
          if (currentNode.node_type === 'ACTION' && botToken) {
            const config = currentNode.config || {};
            const messageText = substituteVariables(config.text || 'Notification from Bot', vars);

            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: job.telegram_chat_id,
                text: messageText,
                parse_mode: 'HTML',
              }),
            });

            const tgJson = await tgRes.json();

            // Handle Telegram 429 Rate Limiting Gracefully
            if (tgRes.status === 429 || tgJson.error_code === 429) {
              const retryAfter = Number(tgJson.parameters?.retry_after || 30);
              const retryAt = new Date(Date.now() + retryAfter * 1000).toISOString();

              await supabase
                .from('bot_workflow_jobs')
                .update({
                  status: 'WAITING',
                  scheduled_at: retryAt,
                  next_attempt_at: retryAt,
                  attempt_count: job.attempt_count + 1,
                  last_error: `Telegram rate limit: retry_after ${retryAfter}s`,
                })
                .eq('id', job.id);

              jobResults.push({ id: job.id, status: 'RATE_LIMITED', retry_after: retryAfter });
              continue;
            }

            if (!tgJson.ok) {
              throw new Error(tgJson.description || 'Telegram API error');
            }
          }

          // Mark Completed
          await supabase
            .from('bot_workflow_jobs')
            .update({
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', job.id);

          // Record in Audit Log
          await supabase.from('bot_automation_executions').insert({
            bot_id,
            telegram_bot_id: bot.telegram_bot_id,
            telegram_user_id: botUser?.telegram_user_id,
            telegram_chat_id: job.telegram_chat_id,
            trigger_type: 'ENTERPRISE_WORKFLOW',
            action_type: currentNode.config?.action || 'SEND_MESSAGE',
            execution_status: 'SUCCESS',
            metadata: { execution_id: job.execution_id, step: job.step_index },
          });

          jobResults.push({ id: job.id, status: 'COMPLETED' });
        } catch (err: any) {
          const isMaxRetries = job.attempt_count + 1 >= job.max_retries;
          await supabase
            .from('bot_workflow_jobs')
            .update({
              status: isMaxRetries ? 'FAILED' : 'WAITING',
              scheduled_at: new Date(Date.now() + 60000).toISOString(),
              attempt_count: job.attempt_count + 1,
              last_error: err.message,
              completed_at: isMaxRetries ? new Date().toISOString() : null,
            })
            .eq('id', job.id);

          jobResults.push({ id: job.id, status: isMaxRetries ? 'FAILED' : 'RETRY_QUEUED', error: err.message });
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed: processedCount, results: jobResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // =========================================================================
    // ACTION 2: TEST_INTEGRATION (Safe outbound webhook dispatch)
    // =========================================================================
    if (action === 'TEST_INTEGRATION') {
      const { integration_id } = body;
      const { data: integration, error: intErr } = await supabase
        .from('bot_integrations')
        .select('*')
        .eq('id', integration_id)
        .eq('bot_id', bot_id)
        .single();

      if (intErr || !integration) {
        return new Response(
          JSON.stringify({ error: 'Integration not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Enforce SSRF & HTTPS Protection
      if (!isSafeUrl(integration.url)) {
        return new Response(
          JSON.stringify({ error: 'Security validation failed: Integration destination must be public HTTPS URL' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const payload = {
        event: 'TEST_PING',
        bot_id: bot.id,
        bot_username: bot.telegram_username,
        timestamp: new Date().toISOString(),
      };

      const start = Date.now();
      let resStatus = 0;
      let resText = '';
      let deliveryStatus = 'DELIVERED';

      try {
        const destRes = await fetch(integration.url, {
          method: integration.http_method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Lifafa-Bot-Integration/1.0',
            'X-Bot-Event': 'TEST_PING',
            ...(integration.secret_token ? { 'X-Bot-Signature': integration.secret_token } : {}),
            ...(integration.headers || {}),
          },
          body: JSON.stringify(payload),
        });
        resStatus = destRes.status;
        resText = await destRes.text();
        if (!destRes.ok) deliveryStatus = 'FAILED';
      } catch (e: any) {
        deliveryStatus = 'FAILED';
        resText = e.message;
      }

      // Record Delivery Log
      await supabase.from('bot_integration_events').insert({
        bot_id,
        integration_id: integration.id,
        event_type: 'TEST_PING',
        payload,
        status_code: resStatus,
        response_body: resText.slice(0, 1000),
        status: deliveryStatus,
      });

      return new Response(
        JSON.stringify({
          success: deliveryStatus === 'DELIVERED',
          status_code: resStatus,
          duration_ms: Date.now() - start,
          response: resText.slice(0, 500),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Worker Internal Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
