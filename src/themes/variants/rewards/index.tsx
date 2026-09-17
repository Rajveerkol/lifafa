import React from 'react';
import {
  Shield,
  ShieldCheck,
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
  Coins,
  Cpu,
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
// 1. ENVELOPE: Armored Steel Safe Vault
// ==========================================
export const RewardsEnvelope: React.FC<ThemeEnvelopeProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
  timeLeft,
}) => {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none my-2 transition-all">
      {/* Industrial Armored Safe Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-800 via-slate-900 to-zinc-950 p-2 shadow-2xl shadow-cyan-500/10 border-2 border-slate-600">
        {/* Safe Door with Hex Screws at Corners */}
        <div
          onClick={!isEnvelopeOpened ? onUnsealEnvelope : undefined}
          className={`relative h-28 bg-gradient-to-b from-slate-700 to-slate-900 rounded-t-3xl overflow-hidden flex items-center justify-center border-b-2 border-cyan-500/40 transition-all duration-500 ${
            !isEnvelopeOpened ? 'cursor-pointer hover:border-cyan-400' : ''
          }`}
        >
          {/* Hex Screws at 4 corners */}
          <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-slate-500 border border-slate-400 flex items-center justify-center"><div className="w-1.5 h-0.5 bg-slate-700" /></div>
          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-slate-500 border border-slate-400 flex items-center justify-center"><div className="w-1.5 h-0.5 bg-slate-700" /></div>
          <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-slate-500 border border-slate-400 flex items-center justify-center"><div className="w-1.5 h-0.5 bg-slate-700" /></div>
          <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-slate-500 border border-slate-400 flex items-center justify-center"><div className="w-1.5 h-0.5 bg-slate-700" /></div>

          {/* Carbon Fiber Grid */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px]" />

          {/* Rotary Combination Dial Seal with Cyan LED Ring */}
          <div
            className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-slate-600 via-slate-400 to-slate-700 p-1 shadow-2xl flex items-center justify-center transition-transform duration-500 ${
              !isEnvelopeOpened
                ? 'scale-105 hover:scale-115 active:scale-95 animate-pulse'
                : 'scale-90 opacity-90'
            }`}
          >
            <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center border-2 border-cyan-400 shadow-inner">
              <Lock className="w-5 h-5 text-cyan-400" />
              {!isEnvelopeOpened && (
                <span className="text-[7px] font-black text-cyan-300 uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  DIAL
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sealed Teaser Banner */}
        {!isEnvelopeOpened ? (
          <div
            onClick={onUnsealEnvelope}
            className="cursor-pointer bg-slate-900/95 backdrop-blur-md rounded-2xl mx-2 -mt-3 mb-2 p-5 text-center space-y-3 z-20 shadow-xl border border-cyan-500/30 hover:border-cyan-400 transition-all active:scale-99"
          >
            <div className="inline-flex items-center gap-1 font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase">
              🔒 VAULT DEPOSIT: {lifafa.code}
            </div>

            <div>
              <h3 className="text-lg font-black text-white tracking-wide line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Secure decentralized atomic digital reward safe.
              </p>
            </div>

            <button
              type="button"
              onClick={onUnsealEnvelope}
              className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:brightness-110 text-white font-black py-3 px-4 rounded-xl text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider active:scale-95"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <Cpu className="w-4 h-4 text-white" />
              <span>Unlock Security Vault</span>
            </button>
          </div>
        ) : (
          /* Revealed Titanium Cash Card emerging */
          <div className="relative bg-slate-950/95 rounded-2xl mx-2 -mt-4 mb-2 p-5 shadow-2xl border border-cyan-500/40 text-center space-y-3 z-20 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-md text-[10px]">
                ⚡ {lifafa.code}
              </span>
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-cyan-400" />
                {timeLeft}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.distribution_type === 'RANDOM' ? '🎲 Stochastic Random Pool' : '⚖️ Equal Allocation Pool'}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white mt-1.5 line-clamp-1 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {lifafa.message || 'Complete the verified security requirements below to claim your digital cash gift!'}
              </p>
            </div>

            {/* Amount Badge */}
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-4">
              {claimedAmount ? (
                <div>
                  <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-mono block">
                    Vault Disbursed
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-cyan-300 font-mono tracking-tight">
                    {formatCurrency(claimedAmount)}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono block">
                    Total Pool Allocation
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-cyan-300 font-mono tracking-tight">
                    {formatCurrency(lifafa.total_amount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium mt-1.5 pt-1.5 border-t border-slate-800 font-mono">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    <strong>{lifafa.claimed_count}</strong> / {lifafa.winner_count} Claimed
                  </span>
                </span>
                {lifafa.pin_code && (
                  <span className="flex items-center gap-1 text-cyan-400 font-bold">
                    <Lock className="w-3 h-3" />
                    PIN Encrypted
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Safe Bottom Reinforcement */}
        <div className="h-4 bg-gradient-to-t from-black to-slate-900 rounded-b-2xl flex items-center justify-center">
          <div className="w-16 h-1 rounded-full bg-cyan-500/40" />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. PROGRESS INDICATOR: Segmented Power Cell
// ==========================================
export const RewardsProgress: React.FC<ThemeProgressProps> = ({
  totalRequired,
  completedCount,
  allDone,
}) => {
  const percent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;

  return (
    <div className="p-3.5 bg-slate-900/90 border border-slate-700 rounded-2xl space-y-2">
      <div className="flex items-center justify-between font-mono">
        <span className="text-xs font-black text-cyan-400 flex items-center gap-1.5 uppercase" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Security Protocol ({completedCount}/{totalRequired})</span>
        </span>
        {allDone ? (
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" /> All Cleared
          </span>
        ) : (
          <span className="text-[10px] font-bold text-cyan-300">
            {percent}% READY
          </span>
        )}
      </div>

      <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-700">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500 shadow-sm shadow-cyan-500/50"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// ==========================================
// 3. TASK CARD: Heavy Titanium Armor Card
// ==========================================
export const RewardsTaskCard: React.FC<ThemeTaskCardProps> = ({
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
        return <Send className="w-4 h-4 text-cyan-400" />;
      case 'YOUTUBE_SUB':
        return <Youtube className="w-4 h-4 text-red-400" />;
      case 'INSTAGRAM_FOLLOW':
      case 'INSTAGRAM_LIKE':
        return <Instagram className="w-4 h-4 text-pink-400" />;
      case 'REFERRAL':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default:
        return <Globe className="w-4 h-4 text-cyan-400" />;
    }
  };

  if (isTelegramTask) {
    if (isCompleted) {
      return (
        <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500 text-black flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-black text-cyan-200 block font-mono" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  Telegram Channel Verified ✓
                </span>
                {channelUsername && (
                  <span className="text-[10px] font-mono text-cyan-400">@{channelUsername}</span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950 border border-cyan-500/40 px-2.5 py-1 rounded-full">
              Membership Verified ✓
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl border border-slate-700 bg-slate-900/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 font-mono">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <h5 className="text-xs font-black text-white uppercase tracking-wider" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                Channel Authorization
              </h5>
              <p className="text-[10px] text-slate-400">
                Join official channel &amp; verify credentials
              </p>
            </div>
          </div>
          {task.is_required && (
            <span className="text-[9px] font-bold text-cyan-400 bg-cyan-950 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase">
              Required
            </span>
          )}
        </div>

        {/* Step 1 */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300">Step 1: Open Target Channel</span>
            {channelUsername && <span className="font-mono text-[10px] text-cyan-400">@{channelUsername}</span>}
          </div>
          {!hasJoined && !tgBinding?.isBound ? (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleJoinTelegram}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors no-underline text-center cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <span>Join Channel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-950/60 border border-cyan-500/20 rounded-xl text-[11px] text-cyan-300 font-bold">
              <span>Channel link opened ✓</span>
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline text-[10px]">Re-open</a>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="space-y-1.5 text-xs border-t border-slate-800 pt-2 font-mono">
          <span className="font-bold text-slate-300">Step 2: Connect Telegram Bot</span>
          {tgBinding?.isBound ? (
            <div className="px-3 py-1.5 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Linked (@{tgBinding.telegramUsername})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectTelegram}
              disabled={isConnectingTg}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              {isConnectingTg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Authorize Bot Connection</span>
            </button>
          )}
        </div>

        {/* Step 3 */}
        <div className="space-y-1.5 text-xs border-t border-slate-800 pt-2 font-mono">
          <span className="font-bold text-slate-300">Step 3: Authenticate Membership</span>
          {verificationError && (
            <p className="text-[11px] text-rose-400 bg-rose-950/50 border border-rose-500/30 p-2 rounded-lg">{verificationError}</p>
          )}
          <button
            type="button"
            onClick={handleVerifyMembership}
            disabled={isVerifyingMembership || !tgBinding?.isBound}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 disabled:opacity-50 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-500/20 uppercase tracking-wider active:scale-98"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            {isVerifyingMembership ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Verify Security Credentials</span>
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
          ? 'bg-cyan-950/40 border-cyan-500/30'
          : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            {getTaskIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-black text-white truncate tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {task.title}
              </h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-950 border border-cyan-500/20 px-1.5 py-0.5 rounded-sm uppercase">
                  Required
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div>
          {isCompleted ? (
            <div className="flex items-center gap-1 text-cyan-300 font-bold text-xs px-3 py-1.5 bg-cyan-950/80 border border-cyan-500/30 rounded-xl shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {task.task_type === 'VISIT_WEBSITE'
                  ? 'Visit Confirmed ✓'
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
              className="flex items-center gap-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer uppercase tracking-wider"
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
        <div className="mt-2 p-2 bg-rose-950/50 border border-rose-500/30 rounded-xl flex items-start gap-1.5 text-[11px] text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{genericError}</span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. CLAIM SECTION: Security Console & Monospace Keypad PIN
// ==========================================
export const RewardsClaimSection: React.FC<ThemeClaimSectionProps> = ({
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
        <div className="p-4 bg-slate-900 border border-cyan-500/30 rounded-3xl space-y-2 text-center">
          <Shield className="w-6 h-6 text-cyan-400 mx-auto" />
          <h4 className="text-sm font-black text-cyan-300 tracking-wide font-mono" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            Security Clearance Required
          </h4>
          <p className="text-xs text-slate-400 font-mono">
            Authenticate session to disburse verified allocation.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-cyan-500/20 active:scale-98 cursor-pointer uppercase tracking-widest font-mono"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Monospace Keypad PIN Input */}
      {requiresPin && (
        <div className="p-4 bg-slate-950 border border-cyan-500/30 rounded-3xl space-y-2.5 text-center font-mono">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-cyan-400 tracking-wider uppercase" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cryptographic PIN Entry</span>
          </div>

          <div className="flex items-center justify-center gap-2.5 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pinCode.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-10 h-12 rounded-xl border flex items-center justify-center font-mono text-lg font-black transition-all ${
                    isFilled
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-xs shadow-cyan-500/40'
                      : 'bg-slate-900 border-slate-800 text-slate-700'
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
            placeholder="[ ENTER PIN CODE ]"
            className="w-full max-w-xs mx-auto px-4 py-2 bg-slate-900 border border-cyan-500/30 rounded-xl text-center text-xs font-mono tracking-widest text-cyan-200 focus:outline-hidden focus:border-cyan-400"
          />
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <RewardsProgress
            totalRequired={requiredTasks.length}
            completedCount={completedTaskIds.size}
            allDone={allRequiredDone}
          />
          <div className="space-y-2">
            {tasks.map((task) => (
              <RewardsTaskCard
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
        <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-3xl space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5 tracking-wide" style={{ fontFamily: 'var(--font-theme-heading)' }}>
              <Landmark className="w-4 h-4 text-cyan-400" />
              <span>Direct Bank Settlement</span>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Account Holder Name *
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Bank Account Name"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Bank Account Number
              </label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 1234567890"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                IFSC Code
              </label>
              <input
                type="text"
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono uppercase text-white focus:outline-hidden focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              UPI ID (Optional if Bank given)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="username@bank"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-cyan-400"
            />
          </div>
        </div>
      )}

      {/* Primary Vault CTA */}
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming || !allRequiredDone}
        className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-widest border border-cyan-400/40 font-mono"
        style={{ fontFamily: 'var(--font-theme-heading)' }}
      >
        {claiming ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Disbursing Allocation...</span>
          </>
        ) : (
          <>
            <Coins className="w-5 h-5" />
            <span>Authorize &amp; Claim Reward ⚡</span>
          </>
        )}
      </button>
    </div>
  );
};

// ==========================================
// 5. REWARD REVEAL: Hydraulic Safe Door & Coin Shower
// ==========================================
export const RewardsRewardReveal: React.FC<ThemeRewardRevealProps> = ({
  amount,
  code,
  payoutMode,
  lifafa,
  onClose,
  onOpenShare,
}) => {
  return (
    <div className="p-6 bg-slate-950 border-2 border-cyan-400/60 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300 font-mono">
      <div className="w-16 h-16 rounded-full bg-cyan-500 text-black mx-auto flex items-center justify-center shadow-xl shadow-cyan-500/40 animate-bounce">
        <Coins className="w-8 h-8" />
      </div>

      <div>
        <span className="text-xs font-black uppercase tracking-widest text-cyan-400 bg-cyan-950 border border-cyan-500/40 px-3 py-1 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          ⚡ VAULT DISBURSEMENT CONFIRMED
        </span>
        <h3 className="text-2xl font-black text-white tracking-wide mt-2" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          Allocation Cleared!
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {lifafa.title}
        </p>
      </div>

      <div className="p-4 bg-slate-900 rounded-2xl border border-cyan-500/30">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
          Net Disbursed
        </span>
        <span className="text-4xl sm:text-5xl font-black text-cyan-300 tracking-tight">
          {formatCurrency(amount)}
        </span>
        <p className="text-xs font-bold text-cyan-400 mt-1">
          {payoutMode === 'UPI_BANK' ? 'Transferred directly to Bank Account!' : 'Credited to your CreatLifafa Wallet!'}
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {onOpenShare && (
          <button
            type="button"
            onClick={() => onOpenShare(lifafa)}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black rounded-2xl text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            <Share2 className="w-4 h-4" />
            <span>Share Vault Access</span>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 6. AMBIENT DECORATIONS: Cyber Grid Lines
// ==========================================
export const RewardsDecorations: React.FC<ThemeDecorationsProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute top-12 left-10 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
      <div className="absolute bottom-16 right-10 w-56 h-56 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
    </div>
  );
};

// ==========================================
// 7. STATUS VIEWS: Expired & Fully Claimed
// ==========================================
export const RewardsExpiredView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl text-center space-y-3 font-mono">
    <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-400 mx-auto flex items-center justify-center border border-slate-800">
      <Clock className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-white">Vault Time-Window Expired</h4>
    <p className="text-xs text-slate-400">This digital reward allocation window has closed.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-cyan-400 underline cursor-pointer">
        Explore active vaults
      </button>
    )}
  </div>
);

export const RewardsFullyClaimedView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl text-center space-y-3 font-mono">
    <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-400 mx-auto flex items-center justify-center border border-slate-800">
      <Coins className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-white">All Allocations Claimed</h4>
    <p className="text-xs text-slate-400">All reward allocations for this safe have been exhausted.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-cyan-400 underline cursor-pointer">
        Discover more Lifafas on CreatLifafa
      </button>
    )}
  </div>
);

// ==========================================
// THEME EXPORT
// ==========================================
export const rewardsTheme: LifafaTheme = {
  id: 'rewards',
  name: 'Rewards Safe',
  tagline: 'High-tech industrial steel safe with cyber-cyan status & gold coin jackpot',
  badge: '🔒 Vault',
  description: 'Industrial armored safe with rotary dial, monospace terminal keypad, and golden coin cascade.',
  previewGradient: 'from-slate-900 via-slate-800 to-cyan-900',
  typography: {
    headingFont: 'Chakra Petch',
    numeralFont: 'Space Grotesk',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Inter:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap',
    fallbackStack: `'Trebuchet MS', 'Impact', monospace, sans-serif`,
  },
  colors: {
    pageBackground: 'bg-gradient-to-b from-slate-900 via-slate-950 to-zinc-950',
    envelopePrimary: '#1e293b',
    envelopeSecondary: '#0f172a',
    envelopeAccent: '#06b6d4',
    cardBackground: 'bg-slate-900/90',
    cardBorder: 'border-slate-700',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    highlightGold: '#f59e0b',
  },
  components: {
    Envelope: RewardsEnvelope,
    ClaimSection: RewardsClaimSection,
    TaskCard: RewardsTaskCard,
    ProgressIndicator: RewardsProgress,
    RewardReveal: RewardsRewardReveal,
    Decorations: RewardsDecorations,
    ExpiredView: RewardsExpiredView,
    FullyClaimedView: RewardsFullyClaimedView,
  },
};
