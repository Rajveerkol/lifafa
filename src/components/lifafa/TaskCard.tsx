import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Youtube,
  Instagram,
  Globe,
  Users,
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

interface TaskCardProps {
  task: LifafaTask & {
    telegram_channel_username?: string;
    telegram_channel_id?: number;
    is_channel_verified?: boolean;
  };
  isCompleted: boolean;
  onCompleted: (taskId: string) => void;
  onOpenAuth?: () => void;
  taskNumber?: number;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isCompleted,
  onCompleted,
  onOpenAuth,
  taskNumber,
}) => {
  const { user } = useAuth();
  const [genericLoading, setGenericLoading] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  // Telegram Task Specific State
  const isTelegramTask =
    task.task_type === 'TELEGRAM_JOIN' || task.task_type === 'TELEGRAM_BOT';

  const [hasJoined, setHasJoined] = useState(false);
  const [showTgHelper, setShowTgHelper] = useState(false);
  const [tgBinding, setTgBinding] = useState<{
    isBound: boolean;
    telegramUsername: string | null;
    telegramUserId: number | null;
  } | null>(null);
  const [isConnectingTg, setIsConnectingTg] = useState(false);
  const [awaitingBotStart, setAwaitingBotStart] = useState(false);
  const [botDeepLink, setBotDeepLink] = useState<string | null>(null);
  const [isVerifyingMembership, setIsVerifyingMembership] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  // Channel username & URL normalization
  const rawTarget = (task.target_url || '').trim();
  const cleanTarget = rawTarget.replace(/\/+$/, '');
  const extractedUsername = (
    task.telegram_channel_username ||
    cleanTarget.split('/').pop() ||
    cleanTarget
  )
    .replace(/^@/, '')
    .trim();

  const channelUsername = extractedUsername.startsWith('http') ? '' : extractedUsername;

  const channelUrl = cleanTarget.startsWith('http')
    ? cleanTarget
    : cleanTarget.startsWith('t.me/')
    ? `https://${cleanTarget}`
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
      pollIntervalRef.current = setInterval(() => {
        checkBindingStatus(true);
      }, 2500);

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
  const handleJoinTelegram = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHasJoined(true);
    setShowTgHelper(true);
    try {
      window.open(channelUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Fallback handled by direct link
    }
  };

  // Step 2: Connect Telegram via Bot deep link
  const handleConnectTelegram = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) {
      setVerificationError('Please sign in with Google to connect your Telegram account.');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    try {
      setIsConnectingTg(true);
      setVerificationError(null);
      const nonce = await telegramService.generateBindingNonce();
      const deepLink = telegramService.getBindingDeepLink(nonce);
      setBotDeepLink(deepLink);
      setAwaitingBotStart(true);

      try {
        const a = document.createElement('a');
        a.href = deepLink;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        try {
          window.open(deepLink, '_blank', 'noopener,noreferrer');
        } catch (openErr) {
          console.warn('Direct link open suppressed, fallback available in UI:', openErr);
        }
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to initiate Telegram connection');
    } finally {
      setIsConnectingTg(false);
    }
  };

  // Step 3: Verify Membership
  const handleVerifyMembership = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isCompleted || !user) {
      if (!user && onOpenAuth) onOpenAuth();
      return;
    }

    if (!tgBinding?.isBound || !tgBinding.telegramUserId) {
      setVerificationError('Please connect your Telegram account first.');
      setShowTgHelper(true);
      return;
    }

    try {
      setIsVerifyingMembership(true);
      setVerificationError(null);

      const targetIdentifier = channelUsername || task.telegram_channel_username || '';

      const result = await telegramService.verifyMembership(
        targetIdentifier,
        task.telegram_channel_id,
        tgBinding.telegramUserId,
        task.id,
        tgBinding.telegramUsername
      );

      if (result.verified) {
        onCompleted(task.id);
        setShowTgHelper(false);
      } else {
        setVerificationError(
          result.error ||
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

  // Helpers for platform visuals
  const isYoutube = task.task_type === 'YOUTUBE_SUB';
  const isInstagram = task.task_type === 'INSTAGRAM_FOLLOW' || task.task_type === 'INSTAGRAM_LIKE';
  const isCommunity = task.task_type === 'REFERRAL' || task.task_type === 'CUSTOM';

  const getPlatformAvatar = () => {
    if (isTelegramTask) {
      return (
        <div className="w-10 h-10 rounded-full bg-[#0088cc] text-white flex items-center justify-center shrink-0 shadow-xs shadow-[#0088cc]/30">
          <Send className="w-5 h-5 -rotate-12" />
        </div>
      );
    }
    if (isYoutube) {
      return (
        <div className="w-10 h-10 rounded-full bg-[#FF0000] text-white flex items-center justify-center shrink-0 shadow-xs shadow-red-500/30">
          <Youtube className="w-5 h-5" />
        </div>
      );
    }
    if (isInstagram) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-rose-500/30">
          <Instagram className="w-5 h-5" />
        </div>
      );
    }
    if (isCommunity) {
      return (
        <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-purple-600/30">
          <Users className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-blue-600/30">
        <Globe className="w-5 h-5" />
      </div>
    );
  };

  const getTargetLink = () => {
    if (isTelegramTask) return channelUrl;
    return task.target_url || '#';
  };

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-white border-slate-100 shadow-xs'
          : 'bg-white border-slate-100/90 hover:border-slate-200 shadow-xs'
      } p-3 sm:p-3.5 space-y-3`}
    >
      {/* Main Single-Row Task Header matching Client Reference Screenshot */}
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Number Pill + Avatar + Info */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {taskNumber !== undefined && (
            <div className="w-7 h-7 rounded-full bg-blue-100/70 text-blue-700 font-extrabold text-xs flex items-center justify-center shrink-0">
              {taskNumber}
            </div>
          )}

          {getPlatformAvatar()}

          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate tracking-tight">
              {task.title || (isTelegramTask ? 'Telegram Channel' : 'Required Task')}
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
              {task.description ||
                (isTelegramTask
                  ? channelUsername
                    ? `Join @${channelUsername}`
                    : 'Join channel for latest updates'
                  : 'Complete this step to unlock reward')}
            </p>
          </div>
        </div>

        {/* Right Side: Action Button or Joined Status + External Link Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCompleted ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Joined</span>
            </div>
          ) : isTelegramTask ? (
            <button
              type="button"
              onClick={handleJoinTelegram}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 -rotate-12" />
              <span>Join Now</span>
            </button>
          ) : isYoutube ? (
            <button
              type="button"
              onClick={handleGenericAction}
              disabled={genericLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#FF0000] hover:bg-[#e60000] disabled:opacity-50 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              {genericLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Youtube className="w-3.5 h-3.5" />
              )}
              <span>Join Now</span>
            </button>
          ) : isCommunity ? (
            <button
              type="button"
              onClick={handleGenericAction}
              disabled={genericLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              {genericLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Users className="w-3.5 h-3.5" />
              )}
              <span>Join Now</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenericAction}
              disabled={genericLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              {genericLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span>Join Now</span>
            </button>
          )}

          {/* External Open Link Button ↗ */}
          <a
            href={getTargetLink()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            title="Open channel link"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Telegram Verification Inline Drawer - shown only when user taps Join Now or interacts */}
      {isTelegramTask && !isCompleted && (showTgHelper || hasJoined) && (
        <div className="mt-2 pt-2.5 border-t border-slate-100 space-y-2.5 text-xs animate-in fade-in">
          {/* User not logged in */}
          {!user && (
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between gap-2 text-blue-900">
              <span className="text-[11px] font-medium">
                Sign in with Google to verify channel membership
              </span>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          )}

          {/* User logged in but Telegram not connected */}
          {user && !tgBinding?.isBound && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#0088cc]" />
                  <span>Connect Telegram account to verify</span>
                </span>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                  Required Once
                </span>
              </div>

              {awaitingBotStart ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-600">
                    Open our bot and tap <strong>START</strong>:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {botDeepLink && (
                      <a
                        href={botDeepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all text-center"
                      >
                        <Send className="w-3.5 h-3.5 -rotate-12" />
                        <span>Open @{telegramService.BOT_USERNAME}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => checkBindingStatus(false)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Check Status</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectTelegram}
                  disabled={isConnectingTg}
                  className="w-full bg-[#0088cc] hover:bg-[#0077b5] disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  {isConnectingTg ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Opening Bot...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 -rotate-12" />
                      <span>Connect @{telegramService.BOT_USERNAME}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* User logged in and Telegram bound -> 1-Click Verify */}
          {user && tgBinding?.isBound && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleVerifyMembership}
                disabled={isVerifyingMembership}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                {isVerifyingMembership ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Channel Membership...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Verify Membership</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Verification Error Feedback */}
          {verificationError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-900">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>{verificationError}</span>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleVerifyMembership}
                    className="font-bold underline text-amber-900 cursor-pointer"
                  >
                    Retry Verification
                  </button>
                  <a
                    href={channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline text-blue-600 cursor-pointer"
                  >
                    Re-open Channel
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generic Error Feedback */}
      {genericError && (
        <div className="p-2 bg-red-50 border border-red-100 rounded-xl flex items-start gap-1.5 text-[11px] text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{genericError}</span>
        </div>
      )}
    </div>
  );
};
