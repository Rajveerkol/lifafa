import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TaskCompletion, TaskType } from '../types/database';

export interface TaskVerificationResult {
  verified: boolean;
  status: 'VERIFIED' | 'PENDING' | 'FAILED' | 'CLICK_CONFIRMED' | 'USER_CONFIRMED';
  verificationMethod: string;
  message: string;
  isApiConfigured: boolean;
}

export const taskService = {
  // Fetch completed tasks for a user and lifafa
  async getUserTaskCompletions(lifafaId: string, userId: string): Promise<TaskCompletion[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('task_completions')
      .select('*')
      .eq('lifafa_id', lifafaId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching completions:', error);
      return [];
    }

    return (data || []) as TaskCompletion[];
  },

  // Verification abstraction for engagement tasks
  async verifyAndRecordTask(
    taskId: string,
    lifafaId: string,
    userId: string,
    taskType: TaskType,
    targetUrl?: string | null
  ): Promise<TaskVerificationResult> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        verified: true,
        status: 'VERIFIED',
        verificationMethod: 'DEV_SIMULATOR',
        message: 'Verified in development preview',
        isApiConfigured: true,
      };
    }
    // Telegram tasks must NEVER be handled by client engagement RPC
    if (taskType === 'TELEGRAM_JOIN' || taskType === 'TELEGRAM_BOT') {
      throw new Error('Telegram tasks must be verified through the Telegram Bot verification flow.');
    }

    let verificationMethod = 'CLICK_CONFIRMED';
    let friendlyMessage = 'Action confirmed.';

    if (taskType === 'VISIT_WEBSITE' || taskType === 'CUSTOM') {
      verificationMethod = 'CLICK_CONFIRMED';
      friendlyMessage = 'Website visit confirmed.';
    } else if (taskType === 'INSTAGRAM_FOLLOW' || taskType === 'INSTAGRAM_LIKE') {
      verificationMethod = 'USER_CONFIRMED';
      friendlyMessage = 'Instagram follow confirmed.';
    } else if (taskType === 'YOUTUBE_SUB') {
      verificationMethod = 'USER_CONFIRMED';
      friendlyMessage = 'YouTube subscription confirmed.';
    } else if (taskType === 'REFERRAL') {
      verificationMethod = 'USER_CONFIRMED';
      friendlyMessage = 'Referral task confirmed.';
    }

    try {
      const { data, error } = await supabase.rpc('record_engagement_task_completion_rpc', {
        p_task_id: taskId,
      });

      if (error) {
        console.error('Error saving engagement task completion:', error);
        throw new Error(error.message || 'Failed to record task completion');
      }

      const method = (data && data.method) || (taskType === 'VISIT_WEBSITE' ? 'CLICK_CONFIRMED' : 'USER_CONFIRMED');
      let friendlyMessage = 'Action confirmed.';
      if (taskType === 'VISIT_WEBSITE') friendlyMessage = 'Website visit confirmed.';
      else if (taskType === 'INSTAGRAM_FOLLOW') friendlyMessage = 'Follow confirmed.';
      else if (taskType === 'YOUTUBE_SUB') friendlyMessage = 'Subscription confirmed.';

      return {
        verified: true,
        status: (method === 'CLICK_CONFIRMED' ? 'CLICK_CONFIRMED' : 'USER_CONFIRMED'),
        verificationMethod: method,
        message: friendlyMessage,
        isApiConfigured: false,
      };
    } catch (e: any) {
      console.error('Error in verifyAndRecordTask:', e);
      throw new Error(e.message || 'Failed to record task completion');
    }
  },
};
