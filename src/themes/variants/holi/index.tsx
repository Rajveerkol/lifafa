import React from 'react';
import {
  Sparkles,
  Clock,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Users,
  Send,
  Youtube,
  Instagram,
  Globe,
  UserPlus,
  Share2,
  AlertCircle,
  Landmark,
  Droplets,
  Palette,
} from 'lucide-react';
import type {
  LifafaTheme,
  ThemeEnvelopeProps,
  ThemeClaimSectionProps,
  ThemeTaskCardProps,
  ThemeProgressProps,
  ThemeRewardRevealProps,
  ThemeStatusProps,
  ThemeDecorationsProps,
} from '../../types';
import { formatCurrency } from '../../../lib/utils';
import { useTaskLogic } from '../../core/TaskController';

// ==========================================
// 1. ENVELOPE: Asymmetrical Khadi Packet with Gulal Pigment
// ==========================================
export const HoliEnvelope: React.FC<ThemeEnvelopeProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
  timeLeft,
}) => {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none my-2 transition-all">
      {/* Dynamic Khadi Color Packet Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-amber-400 p-2 shadow-2xl shadow-fuchsia-500/25 border-2 border-yellow-200">
        {/* Splattered Flap with Organic Drips */}
        <div
          onClick={!isEnvelopeOpened ? onUnsealEnvelope : undefined}
          className={`relative h-28 bg-gradient-to-b from-fuchsia-500 to-pink-600 rounded-t-3xl overflow-hidden flex items-center justify-center border-b-2 border-yellow-300 transition-all duration-500 ${
            !isEnvelopeOpened ? 'cursor-pointer hover:brightness-105' : ''
          }`}
        >
          {/* Gulal Pigment Splashes */}
          <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-yellow-300/40 blur-lg" />
          <div className="absolute top-2 right-2 w-24 h-24 rounded-full bg-cyan-400/30 blur-xl" />
          <div className="absolute bottom-1 left-8 w-16 h-16 rounded-full bg-emerald-400/30 blur-md" />

          {/* Wet Paint Splash Seal */}
          <div
            className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-rose-400 p-1 shadow-xl flex items-center justify-center transition-transform duration-300 ${
              !isEnvelopeOpened
                ? 'scale-105 hover:scale-115 active:scale-95 animate-bounce-gentle'
                : 'scale-90 opacity-90'
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-700 flex flex-col items-center justify-center border-2 border-white shadow-inner">
              <Palette className="w-6 h-6 text-white" />
              {!isEnvelopeOpened && (
                <span className="text-[7px] font-black text-yellow-200 uppercase tracking-tighter -mt-0.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  SPLASH
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sealed Teaser Banner */}
        {!isEnvelopeOpened ? (
          <div
            onClick={onUnsealEnvelope}
            className="cursor-pointer bg-white/95 backdrop-blur-xs rounded-2xl mx-2 -mt-3 mb-2 p-5 text-center space-y-3 z-20 shadow-xl border border-fuchsia-200 hover:bg-white transition-all active:scale-99"
          >
            <div className="inline-flex items-center gap-1 font-bold bg-fuchsia-100 text-fuchsia-800 px-3 py-1 rounded-full text-[11px]" style={{ fontFamily: 'var(--font-theme-body)' }}>
              🎨 Rangotsav • {lifafa.code}
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-slate-600 mt-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Bura na mano, digital cash lifafa hai! Tap to open the color splash!
              </p>
            </div>

            <button
              type="button"
              onClick={onUnsealEnvelope}
              className="w-full bg-gradient-to-r from-pink-500 via-yellow-400 to-cyan-500 hover:brightness-110 text-slate-950 font-black py-3 px-4 rounded-xl text-xs shadow-md shadow-pink-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <Droplets className="w-4 h-4 text-slate-950" />
              <span>Splash to Open Packet! 💦</span>
            </button>
          </div>
        ) : (
          /* Revealed Artboard Card */
          <div className="relative bg-white rounded-2xl mx-2 -mt-4 mb-2 p-5 shadow-xl border border-fuchsia-200 text-center space-y-3 z-20 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold bg-fuchsia-50 text-fuchsia-700 px-2.5 py-0.5 rounded-md text-[10px]" style={{ fontFamily: 'var(--font-theme-body)' }}>
                🌈 {lifafa.code}
              </span>
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-fuchsia-500" />
                {timeLeft}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-fuchsia-700 bg-fuchsia-100 px-2.5 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.distribution_type === 'RANDOM' ? '🎲 Colorful Gulal Lucky Pool' : '🎨 Equal Rainbow Share'}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1.5 line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-slate-600 line-clamp-2 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {lifafa.message || 'Happy Holi! Complete the festive tasks to claim your colorful reward!'}
              </p>
            </div>

            {/* Amount Badge */}
            <div className="bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-fuchsia-200 rounded-2xl p-4">
              {claimedAmount ? (
                <div>
                  <span className="text-[10px] text-fuchsia-600 font-bold uppercase block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Your Holi Splash
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-fuchsia-600 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(claimedAmount)}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Total Gulal Pool
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-fuchsia-600 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(lifafa.total_amount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium mt-1.5 pt-1.5 border-t border-fuchsia-100" style={{ fontFamily: 'var(--font-theme-body)' }}>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-fuchsia-500" />
                  <span>
                    <strong>{lifafa.claimed_count}</strong> / {lifafa.winner_count} Claimed
                  </span>
                </span>
                {lifafa.pin_code && (
                  <span className="flex items-center gap-1 text-fuchsia-700 font-bold">
                    <Lock className="w-3 h-3" />
                    PIN Protected
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Packet Bottom Trim */}
        <div className="h-4 bg-gradient-to-t from-purple-800 to-pink-600 rounded-b-2xl flex items-center justify-center">
          <div className="w-16 h-1 rounded-full bg-yellow-300/80" />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. PROGRESS INDICATOR: Liquid Color Cylinder
// ==========================================
export const HoliProgress: React.FC<ThemeProgressProps> = ({
  totalRequired,
  completedCount,
  allDone,
}) => {
  const percent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;

  return (
    <div className="p-3.5 bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-fuchsia-200 rounded-2xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-fuchsia-950 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          <Palette className="w-4 h-4 text-fuchsia-600" />
          <span>Pichkari Colors ({completedCount}/{totalRequired})</span>
        </span>
        {allDone ? (
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Droplets className="w-3 h-3 text-emerald-600" /> Ready to Splash!
          </span>
        ) : (
          <span className="text-[10px] font-bold text-fuchsia-700 font-mono">
            {percent}% FILLED
          </span>
        )}
      </div>

      <div className="h-2.5 w-full bg-fuchsia-100 rounded-full overflow-hidden p-0.5 border border-fuchsia-200">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 via-pink-400 to-amber-400 rounded-full transition-all duration-500 shadow-xs"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// ==========================================
// 3. TASK CARD: Color-Dabbled Card
// ==========================================
export const HoliTaskCard: React.FC<ThemeTaskCardProps> = ({
  task,
  isCompleted,
  onCompleted,
  onOpenAuth,
}) => {
  const {
    user,
    isTelegramTask,
    channelUsername,
    channelUrl,
    genericLoading,
    genericError,
    handleGenericAction,
    hasJoined,
    tgBinding,
    isConnectingTg,
    awaitingBotStart,
    isVerifyingMembership,
    verificationError,
    handleJoinTelegram,
    handleConnectTelegram,
    handleVerifyMembership,
  } = useTaskLogic(task, isCompleted, onCompleted, onOpenAuth);

  const getTaskIcon = () => {
    switch (task.task_type) {
      case 'TELEGRAM_JOIN':
      case 'TELEGRAM_BOT':
        return <Send className="w-4 h-4 text-fuchsia-500" />;
      case 'YOUTUBE_SUB':
        return <Youtube className="w-4 h-4 text-red-500" />;
      case 'INSTAGRAM_FOLLOW':
      case 'INSTAGRAM_LIKE':
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'REFERRAL':
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      default:
        return <Globe className="w-4 h-4 text-blue-500" />;
    }
  };

  if (isTelegramTask) {
    if (isCompleted) {
      return (
        <div className="p-3.5 rounded-2xl bg-fuchsia-50 border border-fuchsia-200 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-fuchsia-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-black text-fuchsia-950 block" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  Holi Channel Joined ✓
                </span>
                {channelUsername && (
                  <span className="text-[10px] font-mono text-fuchsia-700">@{channelUsername}</span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-bold text-fuchsia-800 bg-fuchsia-200/80 px-2.5 py-1 rounded-full">
              Membership Verified ✓
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl border-2 border-dashed border-fuchsia-300 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-fuchsia-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-fuchsia-500 text-white flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <h5 className="text-xs font-black text-slate-900" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                Official Holi Channel
              </h5>
              <p className="text-[10px] text-slate-500" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Join channel &amp; confirm party membership
              </p>
            </div>
          </div>
          {task.is_required && (
            <span className="text-[9px] font-bold text-fuchsia-600 bg-fuchsia-50 px-2 py-0.5 rounded-full uppercase">
              Required
            </span>
          )}
        </div>

        {/* Step 1 */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Step 1: Open Channel</span>
            {channelUsername && <span className="font-mono text-[10px] text-fuchsia-600 font-bold">@{channelUsername}</span>}
          </div>
          {!hasJoined && !tgBinding?.isBound ? (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleJoinTelegram}
              className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors no-underline text-center"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <span>Join Channel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <div className="flex items-center justify-between px-3 py-1.5 bg-fuchsia-50 border border-fuchsia-100 rounded-xl text-[11px] text-fuchsia-800 font-bold">
              <span>Channel opened ✓</span>
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-fuchsia-600 underline text-[10px]">Re-open</a>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="space-y-1.5 text-xs border-t border-fuchsia-100 pt-2">
          <span className="font-bold text-slate-700">Step 2: Connect Telegram Account</span>
          {tgBinding?.isBound ? (
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Connected (@{tgBinding.telegramUsername})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectTelegram}
              disabled={isConnectingTg}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              {isConnectingTg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Link Account</span>
            </button>
          )}
        </div>

        {/* Step 3 */}
        <div className="space-y-1.5 text-xs border-t border-fuchsia-100 pt-2">
          <span className="font-bold text-slate-700">Step 3: Verify Channel Membership</span>
          {verificationError && (
            <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg font-medium">{verificationError}</p>
          )}
          <button
            type="button"
            onClick={handleVerifyMembership}
            disabled={isVerifyingMembership || !tgBinding?.isBound}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 disabled:opacity-50 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-fuchsia-500/20 active:scale-98"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            {isVerifyingMembership ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Verify Holi Membership</span>
          </button>
        </div>
      </div>
    );
  }

  // Non-Telegram Task Card
  return (
    <div
      className={`p-3.5 rounded-2xl border-2 transition-all ${
        isCompleted
          ? 'bg-fuchsia-50/70 border-fuchsia-200'
          : 'bg-white border-dashed border-fuchsia-200 hover:border-fuchsia-300 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center shrink-0">
            {getTaskIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-black text-slate-900 truncate" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {task.title}
              </h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-fuchsia-600 bg-fuchsia-50 px-1.5 py-0.5 rounded-sm uppercase">
                  Required
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-slate-500 truncate mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div>
          {isCompleted ? (
            <div className="flex items-center gap-1 text-fuchsia-700 font-bold text-xs px-3 py-1.5 bg-fuchsia-100 rounded-xl shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-fuchsia-600" />
              <span>
                {task.task_type === 'VISIT_WEBSITE'
                  ? 'Color Visit Confirmed ✓'
                  : task.task_type === 'INSTAGRAM_FOLLOW' || task.task_type === 'INSTAGRAM_LIKE'
                  ? 'Follow Confirmed ✓'
                  : task.task_type === 'YOUTUBE_SUB'
                  ? 'Subscription Confirmed ✓'
                  : 'Action Confirmed ✓'}
              </span>
            </div>
          ) : (
            <button
              onClick={handleGenericAction}
              disabled={genericLoading}
              className="flex items-center gap-1 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              {genericLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <span>
                    {task.task_type === 'VISIT_WEBSITE'
                      ? 'Visit'
                      : task.task_type === 'INSTAGRAM_FOLLOW'
                      ? 'Follow'
                      : task.task_type === 'YOUTUBE_SUB'
                      ? 'Subscribe'
                      : 'Complete'}
                  </span>
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

// ==========================================
// 4. CLAIM SECTION: Tilted Artboard & Color-Bubble PIN
// ==========================================
export const HoliClaimSection: React.FC<ThemeClaimSectionProps> = ({
  lifafa,
  user,
  pinCode,
  setPinCode,
  requiresPin,
  accountHolderName,
  setAccountHolderName,
  bankAccountNumber,
  setBankAccountNumber,
  ifscCode,
  setIfscCode,
  upiId,
  setUpiId,
  tasks,
  completedTaskIds,
  allRequiredDone,
  onTaskDone,
  onOpenAuth,
  onClaim,
  claiming,
  errorMsg,
}) => {
  const requiredTasks = tasks.filter((t) => t.is_required && t.is_enabled);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Login Prompt */}
      {!user && (
        <div className="p-4 bg-fuchsia-50 border-2 border-dashed border-fuchsia-200 rounded-3xl space-y-2 text-center">
          <Palette className="w-6 h-6 text-fuchsia-600 mx-auto" />
          <h4 className="text-sm font-black text-fuchsia-950" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            Sign in to Splash &amp; Claim!
          </h4>
          <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-theme-body)' }}>
            Login with Google to verify tasks and receive your festive prize.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-fuchsia-500/20 active:scale-98 cursor-pointer"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Color-Bubble PIN Input */}
      {requiresPin && (
        <div className="p-4 bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-fuchsia-200 rounded-3xl space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-fuchsia-950" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Droplets className="w-4 h-4 text-fuchsia-500" />
            <span>Fill Color Droplets (Enter Secret PIN)</span>
          </div>

          <div className="flex items-center justify-center gap-3 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pinCode.length > idx;
              const bubbleColors = ['bg-fuchsia-500', 'bg-cyan-500', 'bg-amber-400', 'bg-emerald-500'];
              return (
                <div
                  key={idx}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                    isFilled
                      ? `${bubbleColors[idx % 4]} border-white scale-110 shadow-md`
                      : 'bg-white border-fuchsia-200'
                  }`}
                >
                  {isFilled && <div className="w-2.5 h-2.5 rounded-full bg-white/70" />}
                </div>
              );
            })}
          </div>

          <input
            type="password"
            maxLength={6}
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value)}
            placeholder="Enter PIN code"
            className="w-full max-w-xs mx-auto px-4 py-2 bg-white border border-fuchsia-200 rounded-xl text-center text-xs font-mono tracking-widest text-slate-900 focus:outline-hidden focus:border-fuchsia-500"
          />
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <HoliProgress
            totalRequired={requiredTasks.length}
            completedCount={completedTaskIds.size}
            allDone={allRequiredDone}
          />
          <div className="space-y-2">
            {tasks.map((task) => (
              <HoliTaskCard
                key={task.id}
                task={task}
                isCompleted={completedTaskIds.has(task.id)}
                onCompleted={onTaskDone}
                onOpenAuth={onOpenAuth}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bank / UPI Direct Payout Form */}
      {lifafa.payout_mode === 'UPI_BANK' && (
        <div className="p-4 bg-fuchsia-50/70 border border-fuchsia-200 rounded-3xl space-y-3">
          <div className="flex items-center justify-between border-b border-fuchsia-200 pb-2">
            <span className="text-xs font-black text-fuchsia-950 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
              <Landmark className="w-4 h-4 text-fuchsia-600" />
              <span>Direct Bank Splash</span>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              Account Holder Name *
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Registered bank name"
              className="w-full px-3 py-2 bg-white border border-fuchsia-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-fuchsia-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Bank Account Number
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 1234567890"
                className="w-full px-3 py-2 bg-white border border-fuchsia-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-fuchsia-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                IFSC Code
              </label>
              <input
                type="text"
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full px-3 py-2 bg-white border border-fuchsia-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-hidden focus:border-fuchsia-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              UPI ID (Optional if Bank given)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yourname@okhdfcbank"
              className="w-full px-3 py-2 bg-white border border-fuchsia-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-fuchsia-500"
            />
          </div>
        </div>
      )}

      {/* Primary Splash CTA */}
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming || !allRequiredDone}
        className="w-full py-4 px-6 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-fuchsia-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-wider border-2 border-yellow-200"
        style={{ fontFamily: 'var(--font-theme-heading)' }}
      >
        {claiming ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Splashing Reward...</span>
          </>
        ) : (
          <>
            <Droplets className="w-5 h-5 text-slate-950" />
            <span>Splash &amp; Claim Cash! 💦</span>
          </>
        )}
      </button>
    </div>
  );
};

// ==========================================
// 5. REWARD REVEAL: Gulal Powder Blast
// ==========================================
export const HoliRewardReveal: React.FC<ThemeRewardRevealProps> = ({
  amount,
  code,
  payoutMode,
  lifafa,
  onClose,
  onOpenShare,
}) => {
  return (
    <div className="p-6 bg-gradient-to-b from-fuchsia-50 via-pink-50 to-white border-2 border-fuchsia-300 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-fuchsia-500 to-amber-400 text-white mx-auto flex items-center justify-center shadow-xl shadow-fuchsia-500/30 animate-bounce">
        <Palette className="w-8 h-8" />
      </div>

      <div>
        <span className="text-xs font-black uppercase tracking-widest text-fuchsia-700 bg-fuchsia-100 px-3 py-1 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          🎨 RANG LAG GAYA! ✓
        </span>
        <h3 className="text-2xl font-black text-slate-900 tracking-wide mt-2" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          Holi Cash Splash!
        </h3>
        <p className="text-xs text-slate-500 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
          {lifafa.title}
        </p>
      </div>

      <div className="p-4 bg-white rounded-2xl border border-fuchsia-200 shadow-sm">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block" style={{ fontFamily: 'var(--font-theme-body)' }}>
          You Won
        </span>
        <span className="text-4xl sm:text-5xl font-black text-fuchsia-600 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
          {formatCurrency(amount)}
        </span>
        <p className="text-xs font-bold text-fuchsia-700 mt-1">
          {payoutMode === 'UPI_BANK' ? 'Transferred directly to Bank Account!' : 'Credited to your CreatLifafa Balance!'}
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {onOpenShare && (
          <button
            type="button"
            onClick={() => onOpenShare(lifafa)}
            className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-black rounded-2xl text-xs shadow-md shadow-fuchsia-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            <Share2 className="w-4 h-4" />
            <span>Splash Friends with Lifafa</span>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 6. AMBIENT DECORATIONS: Gulal Pigment Clouds
// ==========================================
export const HoliDecorations: React.FC<ThemeDecorationsProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute top-10 left-10 w-48 h-48 rounded-full bg-fuchsia-400/20 blur-3xl animate-pulse" />
      <div className="absolute bottom-16 right-10 w-56 h-56 rounded-full bg-yellow-300/20 blur-3xl animate-pulse" />
      <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-cyan-400/15 blur-3xl" />
    </div>
  );
};

// ==========================================
// 7. STATUS VIEWS: Expired & Fully Claimed
// ==========================================
export const HoliExpiredView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-fuchsia-50 border border-fuchsia-200 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-fuchsia-200 text-fuchsia-700 mx-auto flex items-center justify-center">
      <Clock className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-fuchsia-950">Colors Have Settled</h4>
    <p className="text-xs text-slate-500">This Holi Lifafa has reached its expiration time.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-fuchsia-600 underline cursor-pointer">
        Explore more active celebrations
      </button>
    )}
  </div>
);

export const HoliFullyClaimedView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-fuchsia-50 border border-fuchsia-200 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-fuchsia-200 text-fuchsia-700 mx-auto flex items-center justify-center">
      <Palette className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-fuchsia-950">All Gulal Shares Splashed!</h4>
    <p className="text-xs text-slate-500">All festive rewards for this Lifafa have already been claimed.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-fuchsia-600 underline cursor-pointer">
        Discover more Lifafas on CreatLifafa
      </button>
    )}
  </div>
);

// ==========================================
// THEME EXPORT
// ==========================================
export const holiTheme: LifafaTheme = {
  id: 'holi',
  name: 'Holi Dhamaka',
  tagline: 'Energetic organic color-splash & gulal pigments with playful paint drips',
  badge: '🎨 Holi',
  description: 'Handmade khadi packet with wet-paint seal, color-bubble PIN, and vibrant gulal explosion.',
  previewGradient: 'from-fuchsia-600 via-pink-500 to-amber-400',
  typography: {
    headingFont: 'DynaPuff',
    numeralFont: 'Bungee',
    bodyFont: 'Plus Jakarta Sans',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Bungee&family=DynaPuff:wght@600;700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap',
    fallbackStack: `'Arial Black', 'Impact', cursive, sans-serif`,
  },
  colors: {
    pageBackground: 'bg-gradient-to-b from-fuchsia-50 via-pink-50 to-amber-50',
    envelopePrimary: '#c026d3',
    envelopeSecondary: '#db2777',
    envelopeAccent: '#f59e0b',
    cardBackground: 'bg-white',
    cardBorder: 'border-fuchsia-300',
    textPrimary: '#701a75',
    textSecondary: '#831843',
    textMuted: '#64748b',
    highlightGold: '#eab308',
  },
  components: {
    Envelope: HoliEnvelope,
    ClaimSection: HoliClaimSection,
    TaskCard: HoliTaskCard,
    ProgressIndicator: HoliProgress,
    RewardReveal: HoliRewardReveal,
    Decorations: HoliDecorations,
    ExpiredView: HoliExpiredView,
    FullyClaimedView: HoliFullyClaimedView,
  },
};
