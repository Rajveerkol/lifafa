import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { NotificationItem, NotificationPreferences } from '../types/database';

export const notificationService = {
  // Fetch user's in-app notifications
  async getNotifications(userId: string): Promise<NotificationItem[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [
        {
          id: 'dev-notif-1',
          user_id: userId,
          title: 'Welcome to Lifafa!',
          message: 'Start gifting and claiming digital Lifafas today.',
          type: 'SYSTEM',
          reference_id: null,
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: 'dev-notif-2',
          user_id: userId,
          title: 'Telegram Alerts',
          message: 'Connect Telegram bot for instant claim and withdrawal alerts.',
          type: 'BOT_ALERT',
          reference_id: null,
          is_read: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ];
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data || []) as NotificationItem[];
  },

  // Mark single notification as read
  async markAsRead(notificationId: string) {
    if (!isSupabaseConfigured || !supabase) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    if (!isSupabaseConfigured || !supabase) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  },

  // Fetch notification preferences
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return data as NotificationPreferences | null;
  },

  // Save or update preferences (e.g. Bots Coming Soon Notify Me or Telegram alerts)
  async savePreferences(
    userId: string,
    prefs: Partial<Omit<NotificationPreferences, 'user_id' | 'updated_at'>>
  ) {
    if (!isSupabaseConfigured || !supabase) return;

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...prefs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving notification preferences:', error);
      throw new Error('Failed to update notification settings');
    }
  },
};
