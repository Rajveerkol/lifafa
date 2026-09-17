import React from 'react';
import {
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
  Shield,
  Flower2,
  Flame,
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
// 1. ENVELOPE: Imperial Crimson Warrior Pavilion
// ==========================================
export const DurgaEnvelope: React.FC<ThemeEnvelopeProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
  timeLeft,
}) => {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none my-2 transition-all">
      {/* Imperial Warrior Pavilion Envelope Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-red-950 via-rose-950 to-stone-950 p-2 shadow-2xl shadow-red-600/30 border-2 border-red-500/60">
        {/* Pointed Chevron Flap with Gold Trishul Brocade */}
        <div
          onClick={!isEnvelopeOpened ? onUnsealEnvelope : undefined}
          className={`relative h-28 bg-gradient-to-b from-red-900 to-rose-950 rounded-t-3xl overflow-hidden flex items-center justify-center border-b-2 border-amber-400/50 transition-all duration-500 ${
            !isEnvelopeOpened ? 'cursor-pointer hover:border-amber-300' : ''
          }`}
        >
          {/* Royal Velvet Texture */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#f43f5e_1.5px,transparent_1.5px)] [background-size:18px_18px]" />

          {/* Symmetrical Pointed Chevron Cutout */}
          <svg className="absolute bottom-0 w-full h-14 text-amber-500/20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,0 100,0 50,85" fill="currentColor" />
          </svg>

          {/* Sacred Trishul & Lotus Gold Medallion Seal */}
          <div
            className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-red-600 p-1 shadow-2xl flex items-center justify-center transition-transform duration-500 ${
              !isEnvelopeOpened
                ? 'scale-105 hover:scale-115 active:scale-95 animate-pulse'
                : 'scale-90 opacity-90'
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-red-900 to-black flex flex-col items-center justify-center border-2 border-amber-300 shadow-inner">
              <Shield className="w-6 h-6 text-amber-300" />
              {!isEnvelopeOpened && (
                <span className="text-[7px] font-black text-amber-200 uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  जय माता दी
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sealed Teaser Banner */}
        {!isEnvelopeOpened ? (
          <div
            onClick={onUnsealEnvelope}
            className="cursor-pointer bg-red-950/90 backdrop-blur-md rounded-2xl mx-2 -mt-3 mb-2 p-5 text-center space-y-3 z-20 shadow-xl border border-red-500/40 hover:border-amber-400 transition-all active:scale-99"
          >
            <div className="inline-flex items-center gap-1 font-bold bg-red-500/20 text-amber-300 border border-red-500/30 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase" style={{ fontFamily: 'var(--font-theme-body)' }}>
              🔱 Durga Navami • {lifafa.code}
            </div>

            <div>
              <h3 className="text-lg font-black text-amber-100 tracking-wide line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-rose-200/70 mt-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Imperial Shakti blessings and victory celebration cash gift.
              </p>
            </div>

            <button
              type="button"
              onClick={onUnsealEnvelope}
              className="w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:brightness-110 text-white font-black py-3 px-4 rounded-xl text-xs shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider active:scale-95"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Unseal Warrior Lotus Lifafa 🔱</span>
            </button>
          </div>
        ) : (
          /* Revealed Royal Scroll Card */
          <div className="relative bg-red-950/95 rounded-2xl mx-2 -mt-4 mb-2 p-5 shadow-2xl border border-red-500/50 text-center space-y-3 z-20 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold bg-red-500/20 text-amber-300 border border-red-500/30 px-2.5 py-0.5 rounded-md text-[10px]">
                🔱 {lifafa.code}
              </span>
              <span className="text-[10px] font-bold text-amber-300/80 flex items-center gap-1">
                <Clock className="w-3 h-3 text-red-400" />
                {timeLeft}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-red-900/60 border border-amber-500/30 px-2.5 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.distribution_type === 'RANDOM' ? '🎲 Devi Durga Lucky Share' : '⚖️ Equal Vijayadashami Share'}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-amber-100 mt-1.5 line-clamp-1 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-rose-200/70 line-clamp-2 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {lifafa.message || 'Jai Mata Di! Complete the victory actions to claim your sacred reward!'}
              </p>
            </div>

            {/* Amount Badge */}
            <div className="bg-red-900/60 border border-red-500/30 rounded-2xl p-4">
              {claimedAmount ? (
                <div>
                  <span className="text-[10px] text-amber-300 uppercase tracking-widest font-bold block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Your Victory Reward
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(claimedAmount)}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-amber-300/70 uppercase tracking-widest font-bold block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Total Shakti Pool
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(lifafa.total_amount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-rose-200/70 font-medium mt-1.5 pt-1.5 border-t border-red-500/20" style={{ fontFamily: 'var(--font-theme-body)' }}>
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

        {/* Pavilion Bottom Hem */}
        <div className="h-4 bg-gradient-to-t from-black to-red-950 rounded-b-2xl flex items-center justify-center">
          <div className="w-20 h-1 rounded-full bg-amber-400/60" />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. PROGRESS INDICATOR: Sacred Trishul Meter
// ==========================================
export const DurgaProgress: React.FC<ThemeProgressProps> = ({
  totalRequired,
  completedCount,
  allDone,
}) => {
  const percent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;

  return (
    <div className="p-3.5 bg-red-950/80 border border-red-500/40 rounded-2xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          <Shield className="w-4 h-4 text-red-500" />
          <span>Shakti Quests ({completedCount}/{totalRequired})</span>
        </span>
        {allDone ? (
          <span className="text-[10px] font-black text-amber-300 bg-red-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Flame className="w-3 h-3 text-amber-300" /> Trishul Illuminated!
          </span>
        ) : (
          <span className="text-[10px] font-bold text-rose-300 font-mono">
            {percent}% EMPOWERED
          </span>
        )}
      </div>

      <div className="h-2.5 w-full bg-red-950 rounded-full overflow-hidden p-0.5 border border-red-500/40">
        <div
          className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 rounded-full transition-all duration-500 shadow-sm shadow-red-500/50"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// ==========================================
// 3. TASK CARD: Crimson Velvet Warrior Card
// ==========================================
export const DurgaTaskCard: React.FC<ThemeTaskCardProps> = ({
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
        <div className="p-3.5 rounded-2xl bg-red-950/60 border border-amber-500/30 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-200 block" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  Devi Darshan Channel Verified ✓
                </span>
                {channelUsername && (
                  <span className="text-[10px] font-mono text-amber-400">@{channelUsername}</span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-bold text-amber-300 bg-red-900/60 border border-amber-500/40 px-2.5 py-1 rounded-full">
              Membership Verified ✓
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl border border-red-500/40 bg-red-950/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-red-500/30 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-red-900 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <h5 className="text-xs font-black text-amber-100" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                Official Navami Channel
              </h5>
              <p className="text-[10px] text-rose-200/70" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Join channel &amp; confirm shakti membership
              </p>
            </div>
          </div>
          {task.is_required && (
            <span className="text-[9px] font-bold text-amber-400 bg-red-900/80 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
              Required
            </span>
          )}
        </div>

        {/* Step 1 */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-200">Step 1: Enter Channel</span>
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
            <div className="flex items-center justify-between px-3 py-1.5 bg-red-900/50 border border-red-500/30 rounded-xl text-[11px] text-amber-300 font-bold">
              <span>Channel opened ✓</span>
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 underline text-[10px]">Re-open</a>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="space-y-1.5 text-xs border-t border-red-500/30 pt-2">
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
              className="w-full bg-red-900/60 hover:bg-red-900 border border-amber-500/40 text-amber-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              {isConnectingTg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Link Account</span>
            </button>
          )}
        </div>

        {/* Step 3 */}
        <div className="space-y-1.5 text-xs border-t border-red-500/30 pt-2">
          <span className="font-bold text-amber-200">Step 3: Verify Channel Membership</span>
          {verificationError && (
            <p className="text-[11px] text-rose-400 bg-rose-950/60 border border-rose-500/30 p-2 rounded-lg">{verificationError}</p>
          )}
          <button
            type="button"
            onClick={handleVerifyMembership}
            disabled={isVerifyingMembership || !tgBinding?.isBound}
            className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-red-600/30 uppercase tracking-wider active:scale-98"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            {isVerifyingMembership ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Verify Navami Membership</span>
          </button>
        </div>
      </div>
    );
  }

  // Non-Telegram Task Card
  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-red-950/60 border-amber-500/30'
          : 'bg-red-950/80 border-red-500/30 hover:border-amber-500/40 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-red-900 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            {getTaskIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-black text-amber-100 truncate" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {task.title}
              </h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-amber-400 bg-red-900/80 border border-amber-500/30 px-1.5 py-0.5 rounded-sm uppercase">
                  Required
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-rose-200/70 truncate mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div>
          {isCompleted ? (
            <div className="flex items-center gap-1 text-amber-300 font-bold text-xs px-3 py-1.5 bg-red-900/60 border border-amber-500/40 rounded-xl shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {task.task_type === 'VISIT_WEBSITE'
                  ? 'Darshan Visit Confirmed ✓'
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
              className="flex items-center gap-1 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
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
// 4. CLAIM SECTION: Imperial Pavilion & Blooming Lotus PIN
// ==========================================
export const DurgaClaimSection: React.FC<ThemeClaimSectionProps> = ({
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
        <div className="p-4 bg-red-950/90 border border-red-500/40 rounded-3xl space-y-2 text-center">
          <Shield className="w-6 h-6 text-amber-400 mx-auto" />
          <h4 className="text-sm font-black text-amber-200 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            Shakti Authorization Required
          </h4>
          <p className="text-xs text-rose-200/70" style={{ fontFamily: 'var(--font-theme-body)' }}>
            Sign in with Google to receive your victorious blessing.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-red-600/30 active:scale-98 cursor-pointer uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Blooming Lotus PIN Input */}
      {requiresPin && (
        <div className="p-4 bg-red-950/80 border border-red-500/40 rounded-3xl space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-300 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Flower2 className="w-4 h-4 text-amber-400" />
            <span>Bloom the Sacred Lotuses (Enter PIN)</span>
          </div>

          <div className="flex items-center justify-center gap-3 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pinCode.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-9 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
                    isFilled
                      ? 'bg-rose-600 border-amber-300 text-amber-200 font-black scale-110 shadow-md shadow-red-500/40'
                      : 'bg-red-950 border-red-800 text-red-900'
                  }`}
                >
                  {isFilled ? '🌸' : '•'}
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
            className="w-full max-w-xs mx-auto px-4 py-2 bg-red-950 border border-red-500/40 rounded-xl text-center text-xs font-mono tracking-widest text-amber-200 focus:outline-hidden focus:border-amber-400"
          />
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <DurgaProgress
            totalRequired={requiredTasks.length}
            completedCount={completedTaskIds.size}
            allDone={allRequiredDone}
          />
          <div className="space-y-2">
            {tasks.map((task) => (
              <DurgaTaskCard
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

      {/* Direct Bank Settlement Form */}
      {lifafa.payout_mode === 'UPI_BANK' && (
        <div className="p-4 bg-red-950/80 border border-red-500/40 rounded-3xl space-y-3">
          <div className="flex items-center justify-between border-b border-red-500/30 pb-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
              <Landmark className="w-4 h-4 text-amber-400" />
              <span>Direct Bank Settlement</span>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-rose-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              Account Holder Name *
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Full registered bank name"
              className="w-full px-3 py-2 bg-red-950 border border-red-500/40 rounded-xl text-xs text-amber-100 focus:outline-hidden focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-rose-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Bank Account Number
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 1234567890"
                className="w-full px-3 py-2 bg-red-950 border border-red-500/40 rounded-xl text-xs font-mono text-amber-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-rose-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                IFSC Code
              </label>
              <input
                type="text"
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full px-3 py-2 bg-red-950 border border-red-500/40 rounded-xl text-xs font-mono uppercase text-amber-100 focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-rose-200/80 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              UPI ID (Optional if Bank given)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. name@bank"
              className="w-full px-3 py-2 bg-red-950 border border-red-500/40 rounded-xl text-xs text-amber-100 focus:outline-hidden focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {/* Primary Ruby Shield CTA */}
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming || !allRequiredDone}
        className="w-full py-4 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-wider border-2 border-amber-300"
        style={{ fontFamily: 'var(--font-theme-heading)' }}
      >
        {claiming ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Bestowing Victory Blessing...</span>
          </>
        ) : (
          <>
            <Shield className="w-5 h-5 text-amber-200" />
            <span>Victory Blessing • Claim Reward 🔱</span>
          </>
        )}
      </button>
    </div>
  );
};

// ==========================================
// 5. REWARD REVEAL: Vermilion Sindoor & Lotus Petals
// ==========================================
export const DurgaRewardReveal: React.FC<ThemeRewardRevealProps> = ({
  amount,
  code,
  payoutMode,
  lifafa,
  onClose,
  onOpenShare,
}) => {
  return (
    <div className="p-6 bg-gradient-to-b from-red-950 via-rose-950 to-stone-950 border-2 border-amber-400 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-600 to-amber-400 text-white mx-auto flex items-center justify-center shadow-xl shadow-red-600/40 animate-bounce">
        <Shield className="w-8 h-8" />
      </div>

      <div>
        <span className="text-xs font-black uppercase tracking-widest text-amber-300 bg-red-900/80 border border-amber-500/40 px-3 py-1 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          🔱 VIJAYADASHAMI BLESSING
        </span>
        <h3 className="text-2xl font-black text-amber-100 tracking-wide mt-2" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          Devi Shakti Granted!
        </h3>
        <p className="text-xs text-rose-200/70 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
          {lifafa.title}
        </p>
      </div>

      <div className="p-4 bg-red-900/60 rounded-2xl border border-amber-500/40">
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
            className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black rounded-2xl text-xs shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            <Share2 className="w-4 h-4" />
            <span>Share Navami Victory</span>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-rose-200/60 hover:text-amber-100 text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 6. AMBIENT DECORATIONS: Vermilion & Red Lotus
// ==========================================
export const DurgaDecorations: React.FC<ThemeDecorationsProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute top-10 left-10 w-48 h-48 rounded-full bg-red-600/15 blur-3xl animate-pulse" />
      <div className="absolute bottom-16 right-10 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl animate-pulse" />
    </div>
  );
};

// ==========================================
// 7. STATUS VIEWS: Expired & Fully Claimed
// ==========================================
export const DurgaExpiredView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-red-950 border border-red-500/40 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-red-900 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
      <Clock className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-amber-100">Navami Muhurat Ended</h4>
    <p className="text-xs text-rose-200/70">The auspicious victory claiming window has concluded.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-amber-400 underline cursor-pointer">
        Explore more active celebrations
      </button>
    )}
  </div>
);

export const DurgaFullyClaimedView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-red-950 border border-red-500/40 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-red-900 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
      <Shield className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-amber-100">All Victory Shares Claimed</h4>
    <p className="text-xs text-rose-200/70">All auspicious blessings for this Lifafa have been distributed.</p>
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
export const durgaTheme: LifafaTheme = {
  id: 'durga_navami',
  name: 'Durga Navami',
  tagline: 'Imperial crimson & warrior lotus with Trishul crest and vermilion blessings',
  badge: '🔱 Durga Navami',
  description: 'Royal warrior pavilion with Trishul & lotus seal, blooming lotus PIN, and vermilion shower.',
  previewGradient: 'from-red-950 via-rose-900 to-amber-700',
  typography: {
    headingFont: 'Berkshire Swash',
    numeralFont: 'Bodoni Moda',
    bodyFont: 'Cinzel',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Berkshire+Swash&family=Bodoni+Moda:wght@700;800&family=Cinzel:wght@600;700&display=swap',
    fallbackStack: `'Didot', 'Bodoni MT', 'Georgia', serif`,
  },
  colors: {
    pageBackground: 'bg-gradient-to-b from-red-950 via-rose-950 to-stone-950',
    envelopePrimary: '#991b1b',
    envelopeSecondary: '#450a0a',
    envelopeAccent: '#f59e0b',
    cardBackground: 'bg-red-950/85',
    cardBorder: 'border-red-500/40',
    textPrimary: '#fef3c7',
    textSecondary: '#fde68a',
    textMuted: '#f87171',
    highlightGold: '#f59e0b',
  },
  components: {
    Envelope: DurgaEnvelope,
    ClaimSection: DurgaClaimSection,
    TaskCard: DurgaTaskCard,
    ProgressIndicator: DurgaProgress,
    RewardReveal: DurgaRewardReveal,
    Decorations: DurgaDecorations,
    ExpiredView: DurgaExpiredView,
    FullyClaimedView: DurgaFullyClaimedView,
  },
};
