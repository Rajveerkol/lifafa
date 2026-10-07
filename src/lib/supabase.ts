import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase connection with production fallbacks
const DEFAULT_SUPABASE_URL = 'https://pxqyeonymwlpiklfyjbb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cXllb255bXdscGlrbGZ5amJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTc2NzAsImV4cCI6MjEwNDQ5MzY3MH0.Oo5y8zsMbS4uq3HuZmWUbkk_VGkvRW0_J-jCGQkhTlg';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured && supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = client as SupabaseClient;

// Google Authentication Flow via Supabase
export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !client) {
    throw new Error(
      'Supabase credentials are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://createlifafa.xyz'}/`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

// Sign Out Flow
export async function signOut() {
  if (!isSupabaseConfigured || !client) return;
  const { error } = await client.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
  }
}

// Retrieve fresh valid access token with proactive refresh to prevent Edge Function 401 Unauthorized errors
export async function getValidAuthToken(): Promise<string | null> {
  if (!isSupabaseConfigured || !client) return null;

  try {
    let { data: { session }, error: sessionErr } = await client.auth.getSession();
    const nowSec = Math.floor(Date.now() / 1000);

    if (sessionErr || !session || !session.expires_at || session.expires_at <= nowSec + 60) {
      const { data: refreshData, error: refreshErr } = await client.auth.refreshSession();
      if (!refreshErr && refreshData?.session) {
        session = refreshData.session;
      }
    }

    return session?.access_token || null;
  } catch (err) {
    console.warn('Error obtaining valid auth token:', err);
    return null;
  }
}

// Extract clean, descriptive error message from Supabase Edge Function invocation
export async function extractFunctionError(error: any, data?: any): Promise<string> {
  if (data?.error) {
    return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
  }
  if (data?.message && !data?.success) {
    return String(data.message);
  }

  const resp: Response | undefined = error?.context instanceof Response ? error.context : undefined;
  if (resp) {
    try {
      const cloned = typeof resp.clone === 'function' ? resp.clone() : resp;
      const text = await cloned.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          if (json?.error) return typeof json.error === 'string' ? json.error : JSON.stringify(json.error);
          if (json?.message) return String(json.message);
        } catch {
          const safeText = text.slice(0, 200).trim();
          if (!safeText.includes('at ') && !safeText.includes('Error:') && !safeText.includes('sql') && !safeText.includes('<html')) {
            return safeText;
          }
        }
      }
    } catch {}
  }

  const rawMsg = String(error?.message || '');
  if (
    error?.name === 'FunctionsFetchError' ||
    rawMsg.includes('Failed to send a request') ||
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('NetworkError') ||
    rawMsg.includes('fetch failed')
  ) {
    return 'Unable to connect to the withdrawal service. Please check your internet connection and try again.';
  }

  if (
    rawMsg.includes('JWT') ||
    rawMsg.includes('token') ||
    rawMsg.includes('Unauthorized') ||
    rawMsg.includes('session')
  ) {
    return 'Your session expired. Please sign in again.';
  }

  return rawMsg && !rawMsg.includes('stack') && !rawMsg.includes('at ')
    ? rawMsg
    : 'Unable to complete withdrawal. Please try again.';
}

