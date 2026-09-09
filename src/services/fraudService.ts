import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const fraudService = {
  // Generate a non-invasive device fingerprint for fraud risk evaluation
  getDeviceFingerprint(): string {
    const screenRes = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nav = window.navigator;
    const raw = `${nav.userAgent}|${nav.language}|${screenRes}|${timezone}`;
    
    // Simple fast hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `dev_${Math.abs(hash).toString(16)}`;
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
