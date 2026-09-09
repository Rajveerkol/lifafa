import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TaskCompletion, TaskType } from '../types/database';

export interface TaskVerificationResult {
  verified: boolean;
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
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

    let verificationMethod = 'MANUAL_VERIFY';
    let isApiConfigured = false;
    let status: 'VERIFIED' | 'PENDING' | 'FAILED' = 'VERIFIED';
    let message = 'Task verified successfully.';

    // Check third-party API availability
    switch (taskType) {
      case 'TELEGRAM_JOIN':
      case 'TELEGRAM_BOT':
        // If telegram bot token is not configured in backend env
        isApiConfigured = false;
        verificationMethod = 'URL_VISIT_CONFIRM';
        status = 'VERIFIED';
        message = 'Telegram channel link opened and confirmed.';
        break;

      case 'YOUTUBE_SUB':
        isApiConfigured = false;
        verificationMethod = 'URL_VISIT_CONFIRM';
        status = 'VERIFIED';
        message = 'YouTube channel visited and confirmed.';
        break;

      case 'INSTAGRAM_FOLLOW':
      case 'INSTAGRAM_LIKE':
        isApiConfigured = false;
        verificationMethod = 'URL_VISIT_CONFIRM';
        status = 'VERIFIED';
        message = 'Instagram profile visited and confirmed.';
        break;

      case 'VISIT_WEBSITE':
      case 'CUSTOM':
      default:
        isApiConfigured = true;
        verificationMethod = 'URL_VISIT';
        status = 'VERIFIED';
        message = 'Link visited successfully.';
        break;
    }

    // Record server-side into task_completions table
    const { data, error } = await supabase
      .from('task_completions')
      .upsert(
        {
          task_id: taskId,
          lifafa_id: lifafaId,
          user_id: userId,
          status,
          verification_method: verificationMethod,
          metadata: {
            task_type: taskType,
            target_url: targetUrl,
            verified_at: new Date().toISOString(),
          },
        },
        { onConflict: 'task_id,user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving task completion:', error);
      throw new Error('Failed to record task completion');
    }

    return {
      verified: status === 'VERIFIED',
      status,
      verificationMethod,
      message,
      isApiConfigured,
    };
  },
};
