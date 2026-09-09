import React, { useState } from 'react';
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
  ShieldCheck,
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
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, isCompleted, onCompleted }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Telegram Claimant Membership State
  const [showTgFlow, setShowTgFlow] = useState(false);
  const [tgBinding, setTgBinding] = useState<{
    isBound: boolean;
    telegramUsername: string | null;
    telegramUserId: number | null;
  } | null>(null);
  const [bindingNonce, setBindingNonce] = useState<string | null>(null);
  const [awaitingLink, setAwaitingLink] = useState(false);
  const [simulatingUsername, setSimulatingUsername] = useState('');

  const isTelegramTask = task.task_type === 'TELEGRAM_JOIN' || task.task_type === 'TELEGRAM_BOT';

  // Check binding status on load
  React.useEffect(() => {
    if (isTelegramTask && user) {
      telegramService.getUserTelegramBinding(user.id).then(setTgBinding);
    }
  }, [isTelegramTask, user]);

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

  // Regular Non-Telegram Task Action
  const handleGenericAction = async () => {
    if (isCompleted || !user) return;

    if (task.target_url) {
      window.open(task.target_url, '_blank', 'noopener,noreferrer');
    }

    try {
      setLoading(true);
      setError(null);
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
        setError(res.message);
      }
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Start Cryptographic Telegram Account Binding
  const handleStartBinding = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const nonce = await telegramService.generateBindingNonce();
      setBindingNonce(nonce);
      setAwaitingLink(true);

      const deepLink = telegramService.getBindingDeepLink(nonce);
      window.open(deepLink, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Telegram binding');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Check if Telegram Account is now bound
  const handleCheckBindingStatus = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const status = await telegramService.getUserTelegramBinding(user.id);
      setTgBinding(status);
      if (status.isBound) {
        setAwaitingLink(false);
      } else {
        setError('Telegram account not linked yet. Please tap START in @createlifafa_bot and retry.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not verify link status');
    } finally {
      setLoading(false);
    }
  };

  // Quick Developer / Testing Simulator Link
  const handleSimulateLink = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const usernameToUse = simulatingUsername.trim() || user.email?.split('@')[0] || 'test_claimant';
      await telegramService.simulateBinding(user.id, usernameToUse);
      const status = await telegramService.getUserTelegramBinding(user.id);
      setTgBinding(status);
      setAwaitingLink(false);
    } catch (err: any) {
      setError(err.message || 'Failed to simulate link');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify Channel Membership with Bound Telegram Account
  const handleVerifyTelegramMembership = async () => {
    if (isCompleted || !user) return;

    if (!tgBinding?.isBound || !tgBinding.telegramUserId) {
      setError('Please link your Telegram account first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const channelTarget = task.telegram_channel_username || task.target_url?.split('/').pop() || '';

      // Authoritative Server-side Telegram Bot API Membership Check
      const result = await telegramService.verifyMembership(
        channelTarget,
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
        setShowTgFlow(false);
      } else {
        setError(result.error || 'You are not yet a member of this channel. Please join the channel and click verify again.');
      }
    } catch (err: any) {
      setError(err.message || 'Telegram verification failed. Ensure you have joined the channel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-emerald-50/50 border-emerald-200'
          : 'bg-white border-slate-200/80 hover:border-blue-200 shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
            {getTaskIcon()}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-bold text-slate-900">{task.title}</h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded-sm uppercase">
                  Required
                </span>
              )}
              {task.telegram_channel_username && (
                <span className="text-[9px] font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded-sm">
                  @{task.telegram_channel_username}
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>
            )}
          </div>
        </div>

        <div>
          {isCompleted ? (
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs px-3 py-1.5 bg-emerald-100/60 rounded-xl shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified</span>
            </div>
          ) : isTelegramTask ? (
            <div className="flex items-center gap-1.5 shrink-0">
              {task.target_url && (
                <a
                  href={task.target_url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] px-2.5 py-1.5 rounded-xl border border-sky-200 flex items-center gap-1 transition-colors"
                >
                  <span>Join</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <button
                onClick={() => setShowTgFlow(!showTgFlow)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95"
              >
                {tgBinding?.isBound ? 'Verify' : 'Connect'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenericAction}
              disabled={loading}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all shrink-0"
            >
              {loading ? (
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

      {/* Telegram Cryptographic Verification Flow */}
      {showTgFlow && !isCompleted && (
        <div className="mt-3 pt-3 border-t border-slate-100 bg-sky-50/60 p-3.5 rounded-2xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Telegram Membership Verification</span>
            </span>
            <button
              type="button"
              onClick={() => setShowTgFlow(false)}
              className="text-[10px] text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          {!tgBinding?.isBound ? (
            /* Sub-flow A: Unlinked Telegram Account -> Cryptographic Nonce Binding */
            <div className="bg-white p-3 rounded-xl border border-sky-100 space-y-2.5 text-xs text-slate-600">
              <p className="text-[11px] leading-relaxed">
                To prevent fraud and verify your channel membership, link your Telegram account via our official bot <strong>@{telegramService.BOT_USERNAME}</strong>.
              </p>

              {awaitingLink ? (
                <div className="space-y-2 pt-1">
                  <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-[11px] text-sky-800 space-y-1">
                    <p className="font-bold">Next Steps in Telegram:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                      <li>Open Telegram and tap <strong>START</strong> in the bot</li>
                      <li>Wait for the bot confirmation message</li>
                      <li>Click the button below to confirm</li>
                    </ol>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCheckBindingStatus}
                      disabled={loading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>I Have Tapped Start (Confirm)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleStartBinding}
                    disabled={loading}
                    className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 -rotate-12" />}
                    <span>Open @{telegramService.BOT_USERNAME} to Link</span>
                  </button>

                  {/* Testing simulator option */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Simulated @username (for testing)"
                      value={simulatingUsername}
                      onChange={(e) => setSimulatingUsername(e.target.value)}
                      className="text-[11px] px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex-1"
                    />
                    <button
                      onClick={handleSimulateLink}
                      disabled={loading}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg shrink-0"
                    >
                      Quick Test Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Sub-flow B: Bound Telegram Account -> Check Channel Membership */
            <div className="space-y-2.5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">
                      Account Linked: @{tgBinding.telegramUsername || 'Telegram User'}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono">
                      ID: {tgBinding.telegramUserId}
                    </span>
                  </div>
                </div>

                {task.target_url && (
                  <a
                    href={task.target_url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-emerald-700"
                  >
                    <span>Join Channel</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <button
                onClick={handleVerifyTelegramMembership}
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Membership with Bot...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Verify My Membership Now</span>
                  </>
                )}
              </button>
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            Membership is authoritatively verified via Telegram's Bot API with @{telegramService.BOT_USERNAME}.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-xl flex items-start gap-1.5 text-[11px] text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
