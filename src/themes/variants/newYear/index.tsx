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
  Crown,
  Compass,
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
// 1. ENVELOPE: Obsidian Tuxedo Envelope with Gold Trim
// ==========================================
export const NewYearEnvelope: React.FC<ThemeEnvelopeProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
  timeLeft,
}) => {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none my-2 transition-all">
      {/* Tuxedo Envelope Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-neutral-950 to-black p-1.5 shadow-2xl shadow-amber-500/10 border-2 border-amber-500/40">
        {/* Geometric Hex Flap with Gold Border */}
        <div
          onClick={!isEnvelopeOpened ? onUnsealEnvelope : undefined}
          className={`relative h-28 bg-gradient-to-b from-zinc-900 to-black rounded-t-3xl overflow-hidden flex items-center justify-center border-b border-amber-500/30 transition-all duration-500 ${
            !isEnvelopeOpened ? 'cursor-pointer hover:border-amber-400' : ''
          }`}
        >
          {/* Subtle Champagne Gold Pinstripes */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#f59e0b_1px,transparent_1px)] [background-size:24px_24px]" />

          {/* Hexagonal Gold Crease */}
          <svg className="absolute bottom-0 w-full h-12 text-amber-500/20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,0 100,0 50,75" fill="currentColor" />
          </svg>

          {/* 12-Facet Clockwork Gold Medallion */}
          <div
            className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 p-0.5 shadow-2xl flex items-center justify-center transition-transform duration-500 ${
              !isEnvelopeOpened
                ? 'scale-105 hover:scale-115 active:scale-95 animate-pulse-subtle'
                : 'scale-90 opacity-90'
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-950 to-neutral-900 flex flex-col items-center justify-center border border-amber-400/80 shadow-inner">
              <Crown className="w-5 h-5 text-amber-400" />
              {!isEnvelopeOpened && (
                <span className="text-[7px] font-black text-amber-300 uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  UNSEAL
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sealed Teaser Banner */}
        {!isEnvelopeOpened ? (
          <div
            onClick={onUnsealEnvelope}
            className="cursor-pointer bg-black/80 backdrop-blur-md rounded-2xl mx-2 -mt-3 mb-2 p-5 text-center space-y-3 z-20 shadow-xl border border-amber-500/30 hover:border-amber-400/60 transition-all active:scale-99"
          >
            <div className="inline-flex items-center gap-1 font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] tracking-widest uppercase" style={{ fontFamily: 'var(--font-theme-body)' }}>
              🥂 Midnight Gala • {lifafa.code}
            </div>

            <div>
              <h3 className="text-lg font-black text-amber-100 tracking-wide line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-neutral-400 mt-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Exclusive luxury champagne digital reward invitation.
              </p>
            </div>

            <button
              type="button"
              onClick={onUnsealEnvelope}
              className="w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-black font-black py-3 px-4 rounded-xl text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest active:scale-95"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Unlock Luxury Envelope</span>
            </button>
          </div>
        ) : (
          /* Revealed VIP Gold Card emerging */
          <div className="relative bg-zinc-950/90 backdrop-blur-md rounded-2xl mx-2 -mt-4 mb-2 p-5 shadow-2xl border border-amber-500/40 text-center space-y-3 z-20 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-md text-[10px]" style={{ fontFamily: 'var(--font-theme-body)' }}>
                ✨ {lifafa.code}
              </span>
              <span className="text-[10px] font-bold text-amber-400/80 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                {timeLeft}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.distribution_type === 'RANDOM' ? '💎 Lucky Fortune Slice' : '👑 Equal Royal Share'}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-amber-100 mt-1.5 line-clamp-1 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {lifafa.message || 'Happy New Year! Verify the VIP guest list actions to claim your celebration reward!'}
              </p>
            </div>

            {/* Amount Badge */}
            <div className="bg-gradient-to-r from-zinc-900 via-neutral-900 to-zinc-900 border border-amber-500/30 rounded-2xl p-4">
              {claimedAmount ? (
                <div>
                  <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Your New Year Reward
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(claimedAmount)}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Total VIP Pool
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(lifafa.total_amount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-400 font-medium mt-1.5 pt-1.5 border-t border-amber-500/20" style={{ fontFamily: 'var(--font-theme-body)' }}>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    <strong>{lifafa.claimed_count}</strong> / {lifafa.winner_count} Claimed
                  </span>
                </span>
                {lifafa.pin_code && (
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <Lock className="w-3 h-3" />
                    PIN Protected
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tuxedo Bottom Gold Hem */}
        <div className="h-4 bg-gradient-to-t from-black to-zinc-900 rounded-b-2xl flex items-center justify-center">
          <div className="w-16 h-0.5 rounded-full bg-amber-400/60" />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. PROGRESS INDICATOR: Midnight Clock Ring
// ==========================================
export const NewYearProgress: React.FC<ThemeProgressProps> = ({
  totalRequired,
  completedCount,
  allDone,
}) => {
  const percent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;

  return (
    <div className="p-3.5 bg-black/80 border border-amber-500/30 rounded-2xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wider" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Midnight Countdown ({completedCount}/{totalRequired})</span>
        </span>
        {allDone ? (
          <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Sparkles className="w-3 h-3 text-amber-300" /> Midnight Unlocked!
          </span>
        ) : (
          <span className="text-[10px] font-bold text-amber-400/80 font-mono">
            {percent}% READY
          </span>
        )}
      </div>

      <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-amber-500/30">
        <div
          className="h-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-300 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// ==========================================
// 3. TASK CARD: Frosted Glass VIP Card
// ==========================================
export const NewYearTaskCard: React.FC<ThemeTaskCardProps> = ({
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
        return <Send className="w-4 h-4 text-amber-400" />;
      case 'YOUTUBE_SUB':
        return <Youtube className="w-4 h-4 text-red-400" />;
      case 'INSTAGRAM_FOLLOW':
      case 'INSTAGRAM_LIKE':
        return <Instagram className="w-4 h-4 text-pink-400" />;
      case 'REFERRAL':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default:
        return <Globe className="w-4 h-4 text-amber-400" />;
    }
  };

  if (isTelegramTask) {
    if (isCompleted) {
      return (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-200 block tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  VIP Channel Access Confirmed ✓
                </span>
                {channelUsername && (
                  <span className="text-[10px] font-mono text-amber-400">@{channelUsername}</span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-full">
              Membership Verified ✓
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl border border-amber-500/30 bg-zinc-950/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <h5 className="text-xs font-black text-amber-100 uppercase tracking-wider" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                VIP Channel Verification
              </h5>
              <p className="text-[10px] text-neutral-400" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Join channel &amp; verify VIP access
              </p>
            </div>
          </div>
          {task.is_required && (
            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
              Required
            </span>
          )}
        </div>

        {/* Step 1 */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-neutral-300">Step 1: Open VIP Channel</span>
            {channelUsername && <span className="font-mono text-[10px] text-amber-400">@{channelUsername}</span>}
          </div>
          {!hasJoined && !tgBinding?.isBound ? (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleJoinTelegram}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors no-underline text-center cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <span>Enter Channel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 font-bold">
              <span>Channel opened ✓</span>
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 underline text-[10px]">Re-open</a>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="space-y-1.5 text-xs border-t border-amber-500/20 pt-2">
          <span className="font-bold text-neutral-300">Step 2: Connect Telegram</span>
          {tgBinding?.isBound ? (
            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connected (@{tgBinding.telegramUsername})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectTelegram}
              disabled={isConnectingTg}
              className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              {isConnectingTg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Link Account</span>
            </button>
          )}
        </div>

        {/* Step 3 */}
        <div className="space-y-1.5 text-xs border-t border-amber-500/20 pt-2">
          <span className="font-bold text-neutral-300">Step 3: Authenticate</span>
          {verificationError && (
            <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">{verificationError}</p>
          )}
          <button
            type="button"
            onClick={handleVerifyMembership}
            disabled={isVerifyingMembership || !tgBinding?.isBound}
            className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 disabled:opacity-50 text-black font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20 uppercase tracking-wider active:scale-98"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            {isVerifyingMembership ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Verify Access</span>
          </button>
        </div>
      </div>
    );
  }

  // Non-Telegram VIP Task Card
  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-zinc-950/80 border-neutral-800 hover:border-amber-500/40 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            {getTaskIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-black text-amber-100 truncate tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {task.title}
              </h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-sm uppercase">
                  Required
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-neutral-400 truncate mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div>
          {isCompleted ? (
            <div className="flex items-center gap-1 text-amber-300 font-bold text-xs px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-xl shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {task.task_type === 'VISIT_WEBSITE'
                  ? 'VIP Visit Confirmed ✓'
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
              className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer uppercase tracking-wider"
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
        <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-1.5 text-[11px] text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{genericError}</span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. CLAIM SECTION: Obsidian Glass Panel & Precision PIN
// ==========================================
export const NewYearClaimSection: React.FC<ThemeClaimSectionProps> = ({
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
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-rose-400 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Login Prompt */}
      {!user && (
        <div className="p-4 bg-zinc-950/90 border border-amber-500/30 rounded-3xl space-y-2 text-center">
          <Crown className="w-6 h-6 text-amber-400 mx-auto" />
          <h4 className="text-sm font-black text-amber-200 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            VIP Authentication Required
          </h4>
          <p className="text-xs text-neutral-400" style={{ fontFamily: 'var(--font-theme-body)' }}>
            Sign in with Google to authenticate and deposit your reward.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full bg-gradient-to-r from-amber-400 to-yellow-300 text-black font-black py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 active:scale-98 cursor-pointer uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Precision Brass Letterbox PIN */}
      {requiresPin && (
        <div className="p-4 bg-black/80 border border-amber-500/30 rounded-3xl space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-300 tracking-wider uppercase" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Vault Security Code Required</span>
          </div>

          <div className="flex items-center justify-center gap-2.5 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pinCode.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-10 h-12 rounded-xl border flex items-center justify-center font-mono text-lg font-black transition-all ${
                    isFilled
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-xs shadow-amber-500/40'
                      : 'bg-zinc-900 border-neutral-800 text-neutral-600'
                  }`}
                >
                  {isFilled ? '•' : ''}
                </div>
              );
            })}
          </div>

          <input
            type="password"
            maxLength={6}
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value)}
            placeholder="Enter 4-6 digit PIN"
            className="w-full max-w-xs mx-auto px-4 py-2 bg-zinc-900 border border-amber-500/30 rounded-xl text-center text-xs font-mono tracking-widest text-amber-200 focus:outline-hidden focus:border-amber-400"
          />
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <NewYearProgress
            totalRequired={requiredTasks.length}
            completedCount={completedTaskIds.size}
            allDone={allRequiredDone}
          />
          <div className="space-y-2">
            {tasks.map((task) => (
              <NewYearTaskCard
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
        <div className="p-4 bg-zinc-950/80 border border-amber-500/30 rounded-3xl space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
              <Landmark className="w-4 h-4 text-amber-400" />
              <span>Direct Bank Settlement</span>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-300 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              Account Holder Name *
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Full registered bank name"
              className="w-full px-3 py-2 bg-zinc-900 border border-neutral-800 rounded-xl text-xs text-amber-100 focus:outline-hidden focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Bank Account Number
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 1234567890"
                className="w-full px-3 py-2 bg-zinc-900 border border-neutral-800 rounded-xl text-xs font-mono text-amber-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-300 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                IFSC Code
              </label>
              <input
                type="text"
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                className="w-full px-3 py-2 bg-zinc-900 border border-neutral-800 rounded-xl text-xs font-mono uppercase text-amber-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-300 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              UPI ID (Optional if Bank Account provided)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. username@okhdfcbank"
              className="w-full px-3 py-2 bg-zinc-900 border border-neutral-800 rounded-xl text-xs text-amber-100 focus:outline-hidden focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {/* Primary Gold CTA */}
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming || !allRequiredDone}
        className="w-full py-4 px-6 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:brightness-110 disabled:opacity-50 text-black font-black text-sm rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-widest border border-amber-300/50"
        style={{ fontFamily: 'var(--font-theme-heading)' }}
      >
        {claiming ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Disbursing Luxury Prize...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Claim Midnight Reward 🥂</span>
          </>
        )}
      </button>
    </div>
  );
};

// ==========================================
// 5. REWARD REVEAL: Champagne Stars & Gold Cascade
// ==========================================
export const NewYearRewardReveal: React.FC<ThemeRewardRevealProps> = ({
  amount,
  code,
  payoutMode,
  lifafa,
  onClose,
  onOpenShare,
}) => {
  return (
    <div className="p-6 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 border-2 border-amber-400/60 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-black mx-auto flex items-center justify-center shadow-xl shadow-amber-500/30 animate-bounce">
        <Crown className="w-8 h-8" />
      </div>

      <div>
        <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          🥂 2026 CELEBRATION REWARD!
        </span>
        <h3 className="text-2xl font-black text-amber-100 tracking-wide mt-2" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          Fortune Unlocked!
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
          {lifafa.title}
        </p>
      </div>

      <div className="p-4 bg-zinc-900/80 rounded-2xl border border-amber-500/30">
        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block" style={{ fontFamily: 'var(--font-theme-body)' }}>
          Net Disbursed
        </span>
        <span className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
          {formatCurrency(amount)}
        </span>
        <p className="text-xs font-bold text-amber-400/90 mt-1">
          {payoutMode === 'UPI_BANK' ? 'Transferred directly to Bank Account!' : 'Credited to your CreatLifafa Balance!'}
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {onOpenShare && (
          <button
            type="button"
            onClick={() => onOpenShare(lifafa)}
            className="w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-300 text-black font-black rounded-2xl text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            <Share2 className="w-4 h-4" />
            <span>Invite Friends to Gala</span>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-neutral-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 6. AMBIENT DECORATIONS: Golden Starfield
// ==========================================
export const NewYearDecorations: React.FC<ThemeDecorationsProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute top-12 left-10 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl animate-pulse" />
      <div className="absolute bottom-16 right-10 w-56 h-56 rounded-full bg-yellow-500/10 blur-3xl animate-pulse" />
    </div>
  );
};

// ==========================================
// 7. STATUS VIEWS: Expired & Fully Claimed
// ==========================================
export const NewYearExpiredView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-zinc-950 border border-amber-500/30 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-zinc-900 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
      <Clock className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-amber-100">Midnight Gala Has Concluded</h4>
    <p className="text-xs text-neutral-400">This New Year Lifafa has reached its expiration time.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-amber-400 underline cursor-pointer">
        Explore more active galas
      </button>
    )}
  </div>
);

export const NewYearFullyClaimedView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-zinc-950 border border-amber-500/30 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-zinc-900 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
      <Crown className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-amber-100">All VIP Shares Claimed</h4>
    <p className="text-xs text-neutral-400">All luxury reward spots for this gala have already been redeemed.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-amber-400 underline cursor-pointer">
        Discover more Lifafas on CreatLifafa
      </button>
    )}
  </div>
);

// ==========================================
// THEME EXPORT
// ==========================================
export const newYearTheme: LifafaTheme = {
  id: 'new_year',
  name: 'New Year Gala',
  tagline: 'Cinematic luxury midnight reveal with champagne gold & obsidian velvet',
  badge: '🥂 New Year',
  description: 'Ultra-slim obsidian tuxedo envelope with rotating clockwork seal, precision gold PIN, and champagne sparks.',
  previewGradient: 'from-zinc-900 via-neutral-950 to-amber-900',
  typography: {
    headingFont: 'Cinzel',
    numeralFont: 'Syne',
    bodyFont: 'Montserrat',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Montserrat:wght@400;600;700&family=Syne:wght@700;800&display=swap',
    fallbackStack: `'Times New Roman', 'Playfair Display', serif`,
  },
  colors: {
    pageBackground: 'bg-gradient-to-b from-slate-950 via-zinc-950 to-neutral-900',
    envelopePrimary: '#18181b',
    envelopeSecondary: '#09090b',
    envelopeAccent: '#d97706',
    cardBackground: 'bg-zinc-950/80',
    cardBorder: 'border-amber-500/30',
    textPrimary: '#fef3c7',
    textSecondary: '#fde68a',
    textMuted: '#a3a3a3',
    highlightGold: '#f59e0b',
  },
  components: {
    Envelope: NewYearEnvelope,
    ClaimSection: NewYearClaimSection,
    TaskCard: NewYearTaskCard,
    ProgressIndicator: NewYearProgress,
    RewardReveal: NewYearRewardReveal,
    Decorations: NewYearDecorations,
    ExpiredView: NewYearExpiredView,
    FullyClaimedView: NewYearFullyClaimedView,
  },
};
