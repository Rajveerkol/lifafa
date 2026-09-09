import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface TelegramChannelVerificationResult {
  verified: boolean;
  channelUsername: string;
  channelId?: number;
  channelTitle?: string;
  botUsername?: string;
  error?: string;
  needsAdmin?: boolean;
  channelExists?: boolean;
  botStatus?: string;
}

export interface TelegramMembershipResult {
  verified: boolean;
  memberStatus?: string;
  message?: string;
  error?: string;
}

export const telegramService = {
  // Official Lifafa Bot handle for the user to add as admin
  BOT_USERNAME: 'createlifafa_bot',

  // Verify that a Telegram channel exists and the Lifafa bot is an administrator
  async verifyChannelAdmin(channelUsername: string): Promise<TelegramChannelVerificationResult> {
    const cleanUsername = channelUsername.trim().replace(/^@/, '');

    if (!cleanUsername) {
      return {
        verified: false,
        channelUsername: '',
        error: 'Please enter a valid channel username (e.g. @mychannel)',
      };
    }

    if (!isSupabaseConfigured || !supabase) {
      // In development preview mode
      if (cleanUsername.toLowerCase().includes('fail') || cleanUsername.toLowerCase().includes('noadmin')) {
        return {
          verified: false,
          channelUsername: cleanUsername,
          botUsername: this.BOT_USERNAME,
          channelExists: true,
          error: `Please add the bot as an administrator to this channel.`,
          needsAdmin: true,
        };
      }

      return {
        verified: true,
        channelUsername: cleanUsername,
        channelId: -100192837465,
        channelTitle: `${cleanUsername} (Verified Channel)`,
        botUsername: this.BOT_USERNAME,
        channelExists: true,
        needsAdmin: false,
      };
    }

    try {
      // Invoke Supabase Edge Function: verify-telegram-channel
      const { data, error } = await supabase.functions.invoke('verify-telegram-channel', {
        body: { channelUsername: cleanUsername },
      });

      let payload: any = data;

      // Extract error response body from error.context if Edge Function returned non-2xx
      if (error && typeof error === 'object' && 'context' in error && (error as any).context) {
        try {
          const errorBody = await ((error as any).context as Response).json();
          if (errorBody && typeof errorBody === 'object') {
            payload = errorBody;
          }
        } catch {}
      }

      if (payload) {
        if (payload.verified && payload.success) {
          return {
            verified: true,
            channelUsername: payload.channelUsername || cleanUsername,
            channelId: payload.channelId,
            channelTitle: payload.channelTitle || cleanUsername,
            botUsername: payload.botUsername || this.BOT_USERNAME,
            channelExists: true,
            needsAdmin: false,
            botStatus: payload.botStatus || 'administrator',
          };
        }

        // Business failure: channel found but bot not admin, or channel not found
        return {
          verified: false,
          channelUsername: payload.channelUsername || cleanUsername,
          channelId: payload.channelId,
          channelTitle: payload.channelTitle,
          botUsername: payload.botUsername || this.BOT_USERNAME,
          needsAdmin: Boolean(payload.needsAdmin),
          channelExists: Boolean(payload.channelExists),
          botStatus: payload.botStatus,
          error:
            payload.error ||
            (payload.needsAdmin
              ? `Please add the bot as an administrator to this channel.`
              : 'Channel verification failed.'),
        };
      }

      if (error) {
        return {
          verified: false,
          channelUsername: cleanUsername,
          error: error.message || 'Channel verification failed. Please check network connection.',
        };
      }

      return {
        verified: false,
        channelUsername: cleanUsername,
        error: 'Unable to verify channel. Please try again.',
      };
    } catch (err: any) {
      return {
        verified: false,
        channelUsername: cleanUsername,
        error: err.message || 'Network error during Telegram channel verification.',
      };
    }
  },

  // Verify whether claimant is a member of the Telegram channel
  async verifyMembership(
    channelUsername: string,
    channelId?: number | string,
    telegramUserId?: number | string
  ): Promise<TelegramMembershipResult> {
    if (!telegramUserId) {
      return {
        verified: false,
        error: 'Please enter your Telegram User ID or Username to verify membership.',
      };
    }

    if (!isSupabaseConfigured || !supabase) {
      // Development mode simulation
      return {
        verified: true,
        memberStatus: 'member',
        message: 'Telegram channel membership verified!',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-telegram-membership', {
        body: {
          channelUsername,
          channelId,
          telegramUserId,
        },
      });

      let payload: any = data;
      if (error && typeof error === 'object' && 'context' in error && (error as any).context) {
        try {
          const errBody = await ((error as any).context as Response).json();
          if (errBody) payload = errBody;
        } catch {}
      }

      if (payload) {
        return {
          verified: Boolean(payload.verified),
          memberStatus: payload.memberStatus,
          message: payload.message,
          error: payload.error,
        };
      }

      if (error) {
        return {
          verified: false,
          error: error.message || 'Membership verification request failed.',
        };
      }

      return {
        verified: false,
        error: 'Failed to verify membership with Telegram Bot API.',
      };
    } catch (err: any) {
      return {
        verified: false,
        error: err.message || 'Failed to verify membership with Telegram Bot API.',
      };
    }
  },

  // 1. Generate single-use cryptographic binding nonce via database RPC
  async generateBindingNonce(): Promise<string> {
    if (!isSupabaseConfigured || !supabase) {
      return `bind_mock_${Date.now()}`;
    }

    const { data, error } = await supabase.rpc('generate_telegram_binding_nonce_rpc');
    if (error) {
      // In development with demo sessions (without real Supabase JWT):
      if (import.meta.env.DEV && error.message?.includes('Authentication required')) {
        return `bind_dev_${Date.now()}`;
      }
      throw new Error(error.message || 'Failed to generate Telegram binding token');
    }
    return data;
  },

  // 2. Generate Telegram deep link for claimant binding
  getBindingDeepLink(nonce: string): string {
    return `https://t.me/${this.BOT_USERNAME}?start=${nonce}`;
  },

  // 3. Check claimant's bound Telegram account from profile
  async getUserTelegramBinding(userId: string): Promise<{
    isBound: boolean;
    telegramUsername: string | null;
    telegramUserId: number | null;
  }> {
    if (!isSupabaseConfigured || !supabase || userId.startsWith('dev-demo')) {
      const demoBound = typeof window !== 'undefined' && localStorage.getItem('lifafa_demo_tg_bound') === 'true';
      return {
        isBound: demoBound,
        telegramUsername: demoBound ? 'lifafa_demo_user' : null,
        telegramUserId: demoBound ? 987654321 : null,
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_user_id, telegram_username')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { isBound: false, telegramUsername: null, telegramUserId: null };
    }

    return {
      isBound: Boolean(data.telegram_user_id),
      telegramUsername: data.telegram_username,
      telegramUserId: data.telegram_user_id,
    };
  },

  // 4. Development/testing simulator for binding when running without live Telegram webhook
  async simulateBinding(userId: string, tgUsername: string, tgUserId: number = 888999111) {
    if (!isSupabaseConfigured || !supabase || userId.startsWith('dev-demo')) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lifafa_demo_tg_bound', 'true');
      }
      return { success: true };
    }

    const cleanUsername = tgUsername.replace(/^@/, '').trim();
    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_user_id: tgUserId,
        telegram_username: cleanUsername,
      })
      .eq('id', userId);

    if (error) {
      throw new Error(error.message || 'Failed to bind simulated Telegram account');
    }
    return { success: true };
  },
};
