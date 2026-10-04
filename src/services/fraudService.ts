import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DEVICE_STORAGE_KEY = 'cl_device_id_v2';
const DEVICE_COOKIE_KEY = 'cl_did';
let _cachedDeviceId: string | null = null;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {
    // Ignore in restricted environments
  }
}

function getHardwareHash(): string {
  try {
    const screenRes = typeof window !== 'undefined' && window.screen 
      ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth || 24}`
      : 'res';
    const timezone = Intl?.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'utc';
    const nav = typeof window !== 'undefined' ? window.navigator : ({} as any);
    const cores = nav?.hardwareConcurrency || 4;
    const raw = `${timezone}|${screenRes}|${cores}`;
    
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  } catch {
    return 'hw';
  }
}

function generateSecureId(): string {
  let rand = '';
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      rand = crypto.randomUUID().replace(/-/g, '');
    } else if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  if (!rand || rand.length < 16) {
    rand = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  }
  const hw = getHardwareHash();
  return `did_${rand.slice(0, 24)}_${hw}`;
}

function isValidDeviceId(id: any): boolean {
  return typeof id === 'string' && id.startsWith('did_') && id.length >= 20 && !id.includes('null') && !id.includes('undefined');
}

export const fraudService = {
  // Generate a collision-resistant, persistent device identity for anti-abuse and fraud evaluation
  getDeviceFingerprint(): string {
    if (_cachedDeviceId && isValidDeviceId(_cachedDeviceId)) {
      return _cachedDeviceId;
    }

    let deviceId: string | null = null;

    // 1. Try LocalStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(DEVICE_STORAGE_KEY);
        if (isValidDeviceId(stored)) {
          deviceId = stored;
        }
      }
    } catch {
      // LocalStorage access may be restricted
    }

    // 2. Try Cookie if not found in LocalStorage
    if (!deviceId) {
      const cookieVal = getCookie(DEVICE_COOKIE_KEY);
      if (isValidDeviceId(cookieVal)) {
        deviceId = cookieVal;
      }
    }

    // 3. If still not found or invalid, generate new secure high-entropy ID
    if (!deviceId) {
      deviceId = generateSecureId();
    }

    // 4. Multi-tier synchronization
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
      }
    } catch {
      // Ignore storage write errors
    }
    setCookie(DEVICE_COOKIE_KEY, deviceId);

    _cachedDeviceId = deviceId;
    return deviceId;
  },

  // Record active device session
  async recordDeviceSession(userId: string) {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const deviceId = this.getDeviceFingerprint();
      await supabase.from('device_sessions').insert({
        user_id: userId,
        device_id: deviceId,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      });
    } catch (e) {
      // Non-blocking fraud signal recording
      console.warn('Could not record device session', e);
    }
  },

  // Flag suspicious activity
  async flagRisk(userId: string, flagType: string, severity: 'LOW' | 'MEDIUM' | 'HIGH', details: Record<string, any>) {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      await supabase.from('fraud_flags').insert({
        user_id: userId,
        flag_type: flagType,
        severity,
        details,
      });
    } catch (e) {
      console.error('Error logging risk flag', e);
    }
  },
};

