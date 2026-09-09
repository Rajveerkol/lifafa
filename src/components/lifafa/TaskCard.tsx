import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Youtube,
  Instagram,
  Globe,
  UserPlus,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { LifafaTask } from '../../types/database';
import { taskService } from '../../services/taskService';
import { telegramService } from '../../services/telegramService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface TaskCardProps {
  task: LifafaTask & {
    telegram_channel_username?: string;
    telegram_channel_id?: number;
    is_channel_verified?: boolean;
  };
  isCompleted: boolean;
  onCompleted: (taskId: string) => void;
  onOpenAuth?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isCompleted,
  onCompleted,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const [genericLoading, setGenericLoading] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  // Telegram Task Specific State
  const isTelegramTask =
    task.task_type === 'TELEGRAM_JOIN' || task.task_type === 'TELEGRAM_BOT';

  const [hasJoined, setHasJoined] = useState(false);
  const [tgBinding, setTgBinding] = useState<{
    isBound: boolean;
    telegramUsername: string | null;
    telegramUserId: number | null;
  } | null>(null);
  const [isConnectingTg, setIsConnectingTg] = useState(false);
  const [awaitingBotStart, setAwaitingBotStart] = useState(false);
  const [isVerifyingMembership, setIsVerifyingMembership] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  // Channel username & URL normalization
  const channelUsername = (
    task.telegram_channel_username ||
    task.target_url?.split('/').pop() ||
    ''
  )
    .replace(/^@/, '')
    .trim();

  const channelUrl = task.target_url?.startsWith('http')
    ? task.target_url
    : channelUsername
    ? `https://t.me/${channelUsername}`
    : 'https://t.me';

  // 1. Initial check of user's Telegram binding status
  const checkBindingStatus = async (silent = false) => {
    if (!user) return;
    try {
      const status = await telegramService.getUserTelegramBinding(user.id);
      setTgBinding(status);
      if (status.isBound) {
        setAwaitingBotStart(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (!silent) {
        setVerificationError(
          'Telegram account not linked yet. Please tap START in @createlifafa_bot and retry.'
        );
      }
    } catch {
      // ignore silent errors
    }
  };

  useEffect(() => {
    if (isTelegramTask && user) {
      checkBindingStatus(true);
    }
  }, [isTelegramTask, user]);

  // 2. Auto-polling and window focus listener when awaiting Telegram bot binding
  useEffect(() => {
    if (awaitingBotStart && user) {
      // Poll every 2.5 seconds
      pollIntervalRef.current = setInterval(() => {
        checkBindingStatus(true);
      }, 2500);

      // Check immediately when user switches back to this browser window
      const handleWindowFocus = () => {
        checkBindingStatus(true);
      };
      window.addEventListener('focus', handleWindowFocus);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, [awaitingBotStart, user]);

  // Step 1: Open Telegram Channel
  const handleJoinTelegram = () => {
    setHasJoined(true);
    window.open(channelUrl, '_blank', 'noopener,noreferrer');
  };

  // Step 2: Connect Telegram via Bot deep link
  const handleConnectTelegram = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    try {
      setIsConnectingTg(true);
      setVerificationError(null);
      const nonce = await telegramService.generateBindingNonce();
      const deepLink = telegramService.getBindingDeepLink(nonce);
      window.open(deepLink, '_blank', 'noopener,noreferrer');
      setAwaitingBotStart(true);
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to initiate Telegram connection');
    } finally {
      setIsConnectingTg(false);
    }
  };

  // Step 3: Verify Membership
  const handleVerifyMembership = async () => {
    if (isCompleted || !user) {
      if (!user && onOpenAuth) onOpenAuth();
      return;
    }

    if (!tgBinding?.isBound || !tgBinding.telegramUserId) {
      setVerificationError('Please connect your Telegram account first.');
      return;
    }

    try {
      setIsVerifyingMembership(true);
      setVerificationError(null);

      const targetIdentifier = channelUsername || task.telegram_channel_username || '';

      const result = await telegramService.verifyMembership(
        targetIdentifier,
        task.telegram_channel_id,
        tgBinding.telegramUserId
      );

      if (result.verified) {
        if (supabase) {
          await supabase.rpc('record_telegram_member_completion_rpc', {
            p_task_id: task.id,
            p_telegram_user_id: tgBinding.telegramUserId,
            p_telegram_username: tgBinding.telegramUsername || 'telegram_user',
            p_member_status: result.memberStatus || 'member',
          });
        }
        onCompleted(task.id);
      } else {
        setVerificationError(
          "We couldn't verify your membership yet. Please make sure you joined the channel, then try again."
        );
      }
    } catch {
      setVerificationError(
        "We couldn't verify your membership yet. Please make sure you joined the channel, then try again."
      );
    } finally {
      setIsVerifyingMembership(false);
    }
  };

  // Non-Telegram Tasks Handler
  const handleGenericAction = async () => {
    if (isCompleted || !user) {
      if (!user && onOpenAuth) onOpenAuth();
      return;
    }

    if (task.target_url) {
      window.open(task.target_url, '_blank', 'noopener,noreferrer');
    }

    try {
      setGenericLoading(true);
      setGenericError(null);
      const res = await taskService.verifyAndRecordTask(
        task.id,
        task.lifafa_id,
        user.id,
        task.task_type,
        task.target_url
      );

      if (res.verified) {
        onCompleted(task.id);
      } else {
        setGenericError(res.message);
      }
    } catch (e: any) {
      setGenericError(e.message || 'Verification failed');
    } finally {
      setGenericLoading(false);
    }
  };

  const getTaskIcon = () => {
    switch (task.task_type) {
      case 'TELEGRAM_JOIN':
      case 'TELEGRAM_BOT':
        return <Send className="w-4 h-4 text-sky-500" />;
      case 'YOUTUBE_SUB':
        return <Youtube className="w-4 h-4 text-red-500" />;
      case 'INSTAGRAM_FOLLOW':
      case 'INSTAGRAM_LIKE':
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'REFERRAL':
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case 'VISIT_WEBSITE':
      case 'CUSTOM':
      default:
        return <Globe className="w-4 h-4 text-blue-500" />;
    }
  };

  // ==========================================
  // RENDER: TELEGRAM TASK (Simple 3-Step Flow)
  // ==========================================
  if (isTelegramTask) {
    // State 4: Membership Verified (Success)
    if (isCompleted) {
      return (
        <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 shadow-2xs transition-all animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-emerald-900">
                  ✓ Telegram membership verified
                </span>
                {channelUsername && (
                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded-md">
                    @{channelUsername}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                Task completed
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2.5 py-1 rounded-full shrink-0">
              Verified
            </span>
          </div>
        </div>
      );
    }

    // State 1-3: Claimant Step-by-Step Telegram Card
    return (
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4 transition-all">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs shadow-sky-500/20">
              <Send className="w-4 h-4 -rotate-12" />
            </div>
            <div>
              <h5 className="text-xs font-black text-slate-900">Telegram Task</h5>
              <p className="text-[11px] text-slate-500">
                Join channel &amp; verify membership
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {task.is_required && (
              <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Required
              </span>
            )}
            {channelUsername && (
              <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                @{channelUsername}
              </span>
            )}
          </div>
        </div>

        {/* Not Logged In Banner */}
        {!user && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2 text-xs text-blue-800">
            <span>Please sign in with Google to complete tasks.</span>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shrink-0 cursor-pointer transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* Step 1: Join the Telegram channel                   */}
        {/* ---------------------------------------------------- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  hasJoined || tgBinding?.isBound
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-sky-100 text-sky-700'
                }`}
              >
                {hasJoined || tgBinding?.isBound ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  '1'
                )}
              </div>
              <span className="text-xs font-bold text-slate-800">
                Step 1: Join the Telegram channel
              </span>
            </div>
            {channelUsername && (
              <span className="text-[11px] font-mono font-bold text-sky-700">
                @{channelUsername}
              </span>
            )}
          </div>

          {!hasJoined && !tgBinding?.isBound ? (
            <button
              type="button"
              onClick={handleJoinTelegram}
              className="w-full bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <span>Join Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs">
              <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Channel opened</span>
              </span>
              <button
                type="button"
                onClick={handleJoinTelegram}
                className="text-[11px] text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 underline cursor-pointer"
              >
                <span>Re-open</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------- */}
        {/* Step 2: Connect your Telegram account               */}
        {/* ---------------------------------------------------- */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                tgBinding?.isBound
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {tgBinding?.isBound ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : (
                '2'
              )}
            </div>
            <span className="text-xs font-bold text-slate-800">
              Step 2: Connect your Telegram account
            </span>
          </div>

          <p className="text-[11px] text-slate-500 pl-7 leading-relaxed">
            Connect Telegram so we can securely verify that you joined this channel.
          </p>

          {tgBinding?.isBound ? (
            <div className="ml-7 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Telegram account connected
                {tgBinding.telegramUsername ? ` (@${tgBinding.telegramUsername})` : ''}
              </span>
            </div>
          ) : (
            <div className="ml-7 space-y-2">
              {awaitingBotStart ? (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-900">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
                    <span>Waiting for bot connection... Tap START in Telegram</span>
                  </div>
                  <p className="text-[10px] text-sky-700">
                    We will automatically detect your connection, or tap below to check right away:
                  </p>
                  <button
                    type="button"
                    onClick={() => checkBindingStatus(false)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Check Connection Status</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectTelegram}
                  disabled={isConnectingTg}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 active:scale-98 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {isConnectingTg ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting Telegram...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 -rotate-12" />
                      <span>Connect Telegram</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ---------------------------------------------------- */}
        {/* Step 3: Verify membership                           */}
        {/* ---------------------------------------------------- */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                tgBinding?.isBound
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              3
            </div>
            <span
              className={`text-xs font-bold ${
                tgBinding?.isBound ? 'text-slate-800' : 'text-slate-400'
              }`}
            >
              Step 3: Verify membership
            </span>
          </div>

          {tgBinding?.isBound ? (
            <div className="ml-7 space-y-2.5">
              {verificationError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{verificationError}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleVerifyMembership}
                      disabled={isVerifyingMembership}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all cursor-pointer"
                    >
                      {isVerifyingMembership ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Try Again</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleJoinTelegram}
                      className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-3 rounded-xl border border-slate-200 text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Open Channel</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {!verificationError && (
                <button
                  type="button"
                  onClick={handleVerifyMembership}
                  disabled={isVerifyingMembership}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 active:scale-98 text-white font-black py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {isVerifyingMembership ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Membership...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Membership</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 pl-7">
              Complete Step 2 above to verify your channel membership.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: GENERIC (NON-TELEGRAM) TASKS
  // ==========================================
  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-emerald-50/70 border-emerald-200'
          : 'bg-white border-slate-200/80 hover:border-blue-200 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
            {getTaskIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-bold text-slate-900 truncate">{task.title}</h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-sm uppercase">
                  Required
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{task.description}</p>
            )}
          </div>
        </div>

        <div>
          {isCompleted ? (
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs px-3 py-1.5 bg-emerald-100/60 rounded-xl shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified</span>
            </div>
          ) : (
            <button
              onClick={handleGenericAction}
              disabled={genericLoading}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              {genericLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <span>Complete</span>
                  <ExternalLink className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {genericError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-xl flex items-start gap-1.5 text-[11px] text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{genericError}</span>
        </div>
      )}
    </div>
  );
};
