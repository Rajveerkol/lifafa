import React from 'react';
import {
  Flame,
  Sparkles,
  Lock,
  Clock,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Users,
  Send,
  Youtube,
  Instagram,
  Globe,
  UserPlus,
  Share2,
  AlertCircle,
  Landmark,
  Sun,
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
// 1. ENVELOPE: Royal Crimson Silk & Diya Lifafa
// ==========================================
export const DiwaliEnvelope: React.FC<ThemeEnvelopeProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
  timeLeft,
}) => {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none my-2 transition-all">
      {/* Traditional Ornate Lifafa Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-red-900 via-rose-950 to-amber-950 p-2 shadow-2xl shadow-amber-600/20 border-2 border-amber-500/50">
        {/* Mughal Arched Flap with Gold Zari Brocade */}
        <div
          onClick={!isEnvelopeOpened ? onUnsealEnvelope : undefined}
          className={`relative h-28 bg-gradient-to-b from-red-800 to-rose-900 rounded-t-3xl overflow-hidden flex items-center justify-center border-b-2 border-amber-400/40 transition-all duration-500 ${
            !isEnvelopeOpened ? 'cursor-pointer hover:border-amber-300' : ''
          }`}
        >
          {/* Traditional Paisley Brocade Texture */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fbbf24_1.5px,transparent_1.5px)] [background-size:18px_18px]" />

          {/* Mughal Arched Window Cutout */}
          <svg className="absolute bottom-0 w-full h-14 text-amber-500/20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,20 Q50,90 0,20 Z" fill="currentColor" />
          </svg>

          {/* Glowing Clay Diya Medallion Seal */}
          <div
            className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 p-1 shadow-2xl flex items-center justify-center transition-transform duration-500 ${
              !isEnvelopeOpened
                ? 'scale-105 hover:scale-115 active:scale-95 animate-pulse'
                : 'scale-90 opacity-90'
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-700 to-red-950 flex flex-col items-center justify-center border-2 border-amber-200 shadow-inner">
              <Flame className="w-6 h-6 text-amber-300 fill-amber-400 animate-pulse" />
              {!isEnvelopeOpened && (
                <span className="text-[7px] font-black text-amber-200 uppercase tracking-wider -mt-0.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  शुभ लाभ
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sealed Teaser Banner */}
        {!isEnvelopeOpened ? (
          <div
            onClick={onUnsealEnvelope}
            className="cursor-pointer bg-red-950/90 backdrop-blur-md rounded-2xl mx-2 -mt-3 mb-2 p-5 text-center space-y-3 z-20 shadow-xl border border-amber-500/40 hover:border-amber-300 transition-all active:scale-99"
          >
            <div className="inline-flex items-center gap-1 font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase" style={{ fontFamily: 'var(--font-theme-body)' }}>
              🪔 Shubh Deepavali • {lifafa.code}
            </div>

            <div>
              <h3 className="text-lg font-black text-amber-100 tracking-wide line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-amber-200/70 mt-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Auspicious digital cash gift bestowed with blessings of light.
              </p>
            </div>

            <button
              type="button"
              onClick={onUnsealEnvelope}
              className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-red-950 font-black py-3 px-4 rounded-xl text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider active:scale-95"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <Sparkles className="w-4 h-4 text-red-950" />
              <span>Unseal Royal Diwali Lifafa</span>
            </button>
          </div>
        ) : (
          /* Revealed Royal Decree Card */
          <div className="relative bg-red-950/95 rounded-2xl mx-2 -mt-4 mb-2 p-5 shadow-2xl border border-amber-500/40 text-center space-y-3 z-20 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-md text-[10px]">
                ✨ {lifafa.code}
              </span>
              <span className="text-[10px] font-bold text-amber-300/80 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                {timeLeft}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.distribution_type === 'RANDOM' ? '🎲 Lucky Lakshmi Grace' : '⚖️ Equal Divine Share'}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-amber-100 mt-1.5 line-clamp-1 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-amber-200/70 line-clamp-2 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {lifafa.message || 'May this festival of lights bring prosperity! Complete tasks to claim your reward!'}
              </p>
            </div>

            {/* Amount Badge */}
            <div className="bg-red-900/60 border border-amber-500/30 rounded-2xl p-4">
              {claimedAmount ? (
                <div>
                  <span className="text-[10px] text-amber-300 uppercase tracking-widest font-bold block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Your Diwali Blessing
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(claimedAmount)}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-amber-300/70 uppercase tracking-widest font-bold block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Total Shubh Reward Pool
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(lifafa.total_amount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-amber-200/70 font-medium mt-1.5 pt-1.5 border-t border-amber-500/20" style={{ fontFamily: 'var(--font-theme-body)' }}>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    <strong>{lifafa.claimed_count}</strong> / {lifafa.winner_count} Claimed
                  </span>
                </span>
                {lifafa.pin_code && (
                  <span className="flex items-center gap-1 text-amber-300 font-bold">
                    <Lock className="w-3 h-3" />
                    PIN Protected
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lifafa Bottom Zari Trim */}
        <div className="h-4 bg-gradient-to-t from-red-950 to-amber-950 rounded-b-2xl flex items-center justify-center">
          <div className="w-20 h-1 rounded-full bg-amber-400/60" />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. PROGRESS INDICATOR: Row of Earthen Diyas
// ==========================================
export const DiwaliProgress: React.FC<ThemeProgressProps> = ({
  totalRequired,
  completedCount,
  allDone,
}) => {
  const percent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;

  return (
    <div className="p-3.5 bg-red-950/80 border border-amber-500/30 rounded-2xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>Diyas Lighted ({completedCount}/{totalRequired})</span>
        </span>
        {allDone ? (
          <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Sparkles className="w-3 h-3 text-amber-300" /> All Diyas Illuminated!
          </span>
        ) : (
          <span className="text-[10px] font-bold text-amber-400/80 font-mono">
            {percent}% COMPLETE
          </span>
        )}
      </div>

      <div className="h-2.5 w-full bg-red-950 rounded-full overflow-hidden p-0.5 border border-amber-500/30">
        <div
          className="h-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-300 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// ==========================================
// 3. TASK CARD: Deep Maroon Raw-Silk Card
// ==========================================
export const DiwaliTaskCard: React.FC<ThemeTaskCardProps> = ({
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
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-red-950 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-200 block" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  Auspicious Channel Verified ✓
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
      <div className="p-4 rounded-2xl border border-amber-500/30 bg-red-950/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <h5 className="text-xs font-black text-amber-100" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                Official Diwali Channel
              </h5>
              <p className="text-[10px] text-amber-200/70" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Join channel &amp; confirm celebratory membership
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
            <span className="font-bold text-amber-200">Step 1: Open Official Channel</span>
            {channelUsername && <span className="font-mono text-[10px] text-amber-400">@{channelUsername}</span>}
          </div>
          {!hasJoined && !tgBinding?.isBound ? (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleJoinTelegram}
              className="w-full bg-red-900 hover:bg-red-800 border border-amber-500/40 text-amber-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors no-underline text-center cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <span>Join Channel</span>
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
          <span className="font-bold text-amber-200">Step 2: Connect Telegram Account</span>
          {tgBinding?.isBound ? (
            <div className="px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
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
              <span>Link Telegram Account</span>
            </button>
          )}
        </div>

        {/* Step 3 */}
        <div className="space-y-1.5 text-xs border-t border-amber-500/20 pt-2">
          <span className="font-bold text-amber-200">Step 3: Verify Channel Membership</span>
          {verificationError && (
            <p className="text-[11px] text-rose-400 bg-rose-950/60 border border-rose-500/30 p-2 rounded-lg">{verificationError}</p>
          )}
          <button
            type="button"
            onClick={handleVerifyMembership}
            disabled={isVerifyingMembership || !tgBinding?.isBound}
            className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 disabled:opacity-50 text-red-950 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20 uppercase tracking-wider active:scale-98"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            {isVerifyingMembership ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Verify Diwali Membership</span>
          </button>
        </div>
      </div>
    );
  }

  // Non-Telegram Diwali Task Card
  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-red-950/80 border-amber-500/20 hover:border-amber-500/40 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-red-900 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            {getTaskIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-black text-amber-100 truncate" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {task.title}
              </h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-sm uppercase">
                  Required
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-amber-200/70 truncate mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
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
                  ? 'Auspicious Visit Confirmed ✓'
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
              className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-red-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
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
        <div className="mt-2 p-2 bg-rose-950/60 border border-rose-500/30 rounded-xl flex items-start gap-1.5 text-[11px] text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{genericError}</span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. CLAIM SECTION: Brass Thali & Diya PIN
// ==========================================
export const DiwaliClaimSection: React.FC<ThemeClaimSectionProps> = ({
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
        <div className="p-3.5 bg-rose-950/60 border border-rose-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-rose-400 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Login Prompt */}
      {!user && (
        <div className="p-4 bg-red-950/90 border border-amber-500/30 rounded-3xl space-y-2 text-center">
          <Sun className="w-6 h-6 text-amber-400 mx-auto" />
          <h4 className="text-sm font-black text-amber-200 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            Lakshmi Puja Authentication
          </h4>
          <p className="text-xs text-amber-200/70" style={{ fontFamily: 'var(--font-theme-body)' }}>
            Sign in with Google to receive your Diwali blessing directly.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-red-950 font-black py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 active:scale-98 cursor-pointer uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Earthen Diya PIN Input */}
      {requiresPin && (
        <div className="p-4 bg-red-950/80 border border-amber-500/30 rounded-3xl space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-300 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Light the Sacred Diyas (Enter Secret PIN)</span>
          </div>

          <div className="flex items-center justify-center gap-3 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isLit = pinCode.length > idx;
              return (
                <div key={idx} className="flex flex-col items-center">
                  <Flame
                    className={`w-5 h-5 transition-all duration-300 ${
                      isLit
                        ? 'text-amber-400 fill-amber-300 scale-125 animate-pulse'
                        : 'text-amber-900/40 opacity-40'
                    }`}
                  />
                  <div className={`w-6 h-3 rounded-b-full mt-0.5 border ${isLit ? 'bg-amber-600 border-amber-400' : 'bg-red-950 border-amber-900/60'}`} />
                </div>
              );
            })}
          </div>

          <input
            type="password"
            maxLength={6}
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value)}
            placeholder="Enter secret PIN"
            className="w-full max-w-xs mx-auto px-4 py-2 bg-red-950 border border-amber-500/30 rounded-xl text-center text-xs font-mono tracking-widest text-amber-200 focus:outline-hidden focus:border-amber-400"
          />
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <DiwaliProgress
            totalRequired={requiredTasks.length}
            completedCount={completedTaskIds.size}
            allDone={allRequiredDone}
          />
          <div className="space-y-2">
            {tasks.map((task) => (
              <DiwaliTaskCard
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
        <div className="p-4 bg-red-950/80 border border-amber-500/30 rounded-3xl space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
              <Landmark className="w-4 h-4 text-amber-400" />
              <span>Direct Bank Blessing</span>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-amber-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              Account Holder Name *
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Registered bank name"
              className="w-full px-3 py-2 bg-red-950 border border-amber-500/30 rounded-xl text-xs text-amber-100 focus:outline-hidden focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-amber-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Bank Account Number
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 1234567890"
                className="w-full px-3 py-2 bg-red-950 border border-amber-500/30 rounded-xl text-xs font-mono text-amber-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                IFSC Code
              </label>
              <input
                type="text"
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full px-3 py-2 bg-red-950 border border-amber-500/30 rounded-xl text-xs font-mono uppercase text-amber-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-amber-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              UPI ID (Optional if Bank given)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. username@okhdfcbank"
              className="w-full px-3 py-2 bg-red-950 border border-amber-500/30 rounded-xl text-xs text-amber-100 focus:outline-hidden focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {/* Primary Gold Zari CTA */}
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming || !allRequiredDone}
        className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 disabled:opacity-50 text-red-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-wider border-2 border-amber-300"
        style={{ fontFamily: 'var(--font-theme-heading)' }}
      >
        {claiming ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Disbursing Diwali Blessing...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 text-red-950" />
            <span>शुभ लाभ • Claim Blessings ✨</span>
          </>
        )}
      </button>
    </div>
  );
};

// ==========================================
// 5. REWARD REVEAL: Anaar Sparklers & Rangoli Bloom
// ==========================================
export const DiwaliRewardReveal: React.FC<ThemeRewardRevealProps> = ({
  amount,
  code,
  payoutMode,
  lifafa,
  onClose,
  onOpenShare,
}) => {
  return (
    <div className="p-6 bg-gradient-to-b from-red-950 via-rose-950 to-amber-950 border-2 border-amber-400 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-red-950 mx-auto flex items-center justify-center shadow-xl shadow-amber-500/30 animate-bounce">
        <Sparkles className="w-8 h-8" />
      </div>

      <div>
        <span className="text-xs font-black uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          🪔 SHUBH DEEPAVALI PRASAD
        </span>
        <h3 className="text-2xl font-black text-amber-100 tracking-wide mt-2" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          Lakshmi Grace Received!
        </h3>
        <p className="text-xs text-amber-200/70 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
          {lifafa.title}
        </p>
      </div>

      <div className="p-4 bg-red-900/60 rounded-2xl border border-amber-500/30">
        <span className="text-[11px] font-bold text-amber-300/70 uppercase tracking-widest block" style={{ fontFamily: 'var(--font-theme-body)' }}>
          Blessed Reward
        </span>
        <span className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
          {formatCurrency(amount)}
        </span>
        <p className="text-xs font-bold text-amber-300 mt-1">
          {payoutMode === 'UPI_BANK' ? 'Transferred directly to Bank Account!' : 'Credited to your CreatLifafa Wallet!'}
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {onOpenShare && (
          <button
            type="button"
            onClick={() => onOpenShare(lifafa)}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-red-950 font-black rounded-2xl text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            <Share2 className="w-4 h-4" />
            <span>Share Diwali Joy with Family</span>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-amber-200/60 hover:text-amber-100 text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 6. AMBIENT DECORATIONS: Floating Diyas & Rangoli
// ==========================================
export const DiwaliDecorations: React.FC<ThemeDecorationsProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute top-10 left-10 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl animate-pulse" />
      <div className="absolute bottom-16 right-10 w-56 h-56 rounded-full bg-red-500/15 blur-3xl animate-pulse" />
    </div>
  );
};

// ==========================================
// 7. STATUS VIEWS: Expired & Fully Claimed
// ==========================================
export const DiwaliExpiredView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-red-950 border border-amber-500/30 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-red-900 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
      <Clock className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-amber-100">Diwali Muhurat Ended</h4>
    <p className="text-xs text-amber-200/70">The auspicious claiming window has concluded.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-amber-400 underline cursor-pointer">
        Explore active Diwali celebrations
      </button>
    )}
  </div>
);

export const DiwaliFullyClaimedView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-red-950 border border-amber-500/30 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-red-900 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
      <Sparkles className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-amber-100">All Divine Shares Claimed</h4>
    <p className="text-xs text-amber-200/70">All auspicious blessings for this Lifafa have been distributed.</p>
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
export const diwaliTheme: LifafaTheme = {
  id: 'diwali',
  name: 'Diwali Celebration',
  tagline: 'Ornate royal crimson raw silk with clay diyas & golden zari brocade',
  badge: '🪔 Diwali',
  description: 'Traditional Indian Lifafa with arched Mughal window, clay diya PIN, and fountain sparklers.',
  previewGradient: 'from-red-900 via-rose-900 to-amber-900',
  typography: {
    headingFont: 'Rozha One',
    numeralFont: 'Cinzel Decorative',
    bodyFont: 'Outfit',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Outfit:wght@400;600;700&family=Rozha+One&display=swap',
    fallbackStack: `'Georgia', 'Palatino', serif`,
  },
  colors: {
    pageBackground: 'bg-gradient-to-b from-red-950 via-rose-950 to-amber-950',
    envelopePrimary: '#881337',
    envelopeSecondary: '#4c0519',
    envelopeAccent: '#f59e0b',
    cardBackground: 'bg-red-950/80',
    cardBorder: 'border-amber-500/40',
    textPrimary: '#fef3c7',
    textSecondary: '#fde68a',
    textMuted: '#d97706',
    highlightGold: '#f59e0b',
  },
  components: {
    Envelope: DiwaliEnvelope,
    ClaimSection: DiwaliClaimSection,
    TaskCard: DiwaliTaskCard,
    ProgressIndicator: DiwaliProgress,
    RewardReveal: DiwaliRewardReveal,
    Decorations: DiwaliDecorations,
    ExpiredView: DiwaliExpiredView,
    FullyClaimedView: DiwaliFullyClaimedView,
  },
};
