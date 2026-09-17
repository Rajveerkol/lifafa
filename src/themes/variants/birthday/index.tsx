import React, { useState, useEffect } from 'react';
import {
  Gift,
  Sparkles,
  Cake,
  PartyPopper,
  Flame,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Clock,
  Users,
  Send,
  Youtube,
  Instagram,
  Globe,
  UserPlus,
  Share2,
  ArrowRight,
  AlertCircle,
  Landmark,
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
// 1. ENVELOPE: 3D Wrapped Gift Box
// ==========================================
export const BirthdayEnvelope: React.FC<ThemeEnvelopeProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
  timeLeft,
}) => {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none my-2 transition-all">
      {/* 3D Gift Box Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-pink-500 via-rose-500 to-purple-600 p-1.5 shadow-2xl shadow-pink-500/30 border-2 border-pink-300/60">
        {/* Gift Box Lid with Cross Ribbons */}
        <div
          onClick={!isEnvelopeOpened ? onUnsealEnvelope : undefined}
          className={`relative h-28 bg-gradient-to-b from-pink-400 to-rose-500 rounded-t-3xl overflow-hidden flex items-center justify-center border-b-2 border-pink-300/40 transition-all duration-500 ${
            !isEnvelopeOpened ? 'cursor-pointer hover:brightness-105' : ''
          }`}
        >
          {/* Polka Dots Pattern */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_2px,transparent_2px)] [background-size:16px_16px]" />

          {/* Vertical & Horizontal Silk Ribbons */}
          <div className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 shadow-md" />
          <div className="absolute left-0 right-0 h-8 bg-gradient-to-b from-amber-300 via-yellow-200 to-amber-400 shadow-md" />

          {/* 3D Ribbon Rosette Bow Seal */}
          <div
            className={`relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-200 p-1 shadow-xl flex items-center justify-center transition-transform duration-300 ${
              !isEnvelopeOpened
                ? 'scale-105 animate-bounce-gentle hover:scale-115 active:scale-95'
                : 'scale-90 opacity-90'
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex flex-col items-center justify-center border-2 border-yellow-100 shadow-inner">
              <Gift className="w-6 h-6 text-amber-950 -rotate-6" />
              {!isEnvelopeOpened && (
                <span className="text-[7px] font-black text-amber-950 uppercase tracking-tight -mt-0.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  OPEN ME
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sealed Teaser Banner when not unsealed */}
        {!isEnvelopeOpened ? (
          <div
            onClick={onUnsealEnvelope}
            className="cursor-pointer bg-white/95 backdrop-blur-xs rounded-2xl mx-2 -mt-3 mb-2 p-5 text-center space-y-3 z-20 shadow-xl border border-pink-200 hover:bg-white transition-all active:scale-99"
          >
            <div className="inline-flex items-center gap-1 font-bold bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-[11px]" style={{ fontFamily: 'var(--font-theme-body)' }}>
              🎉 Birthday Special Lifafa: {lifafa.code}
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
                A delightful birthday digital cash surprise is waiting for you!
              </p>
            </div>

            <button
              type="button"
              onClick={onUnsealEnvelope}
              className="w-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white font-black py-3 px-4 rounded-2xl text-xs shadow-md shadow-pink-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <PartyPopper className="w-4 h-4" />
              <span>Tap Gift Ribbon to Open!</span>
            </button>
          </div>
        ) : (
          /* Revealed Gift Card emerging from the box */
          <div className="relative bg-white rounded-2xl mx-2 -mt-4 mb-2 p-5 shadow-xl border border-pink-100 text-center space-y-3 z-20 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold bg-pink-50 text-pink-700 px-2.5 py-0.5 rounded-md text-[10px]" style={{ fontFamily: 'var(--font-theme-body)' }}>
                🎂 {lifafa.code}
              </span>
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-pink-400" />
                {timeLeft}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.distribution_type === 'RANDOM' ? '🎲 Lucky Birthday Slice' : '🍰 Equal Cake Slice'}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1.5 line-clamp-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {lifafa.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
                {lifafa.message || 'Happy Birthday! Complete the friendly party tasks to claim your digital cash gift!'}
              </p>
            </div>

            {/* Amount Badge */}
            <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 border border-pink-100 rounded-2xl p-4">
              {claimedAmount ? (
                <div>
                  <span className="text-[10px] text-pink-600 font-bold uppercase block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Your Birthday Gift
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-pink-600 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(claimedAmount)}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block" style={{ fontFamily: 'var(--font-theme-body)' }}>
                    Total Party Prize Pool
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-pink-600 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
                    {formatCurrency(lifafa.total_amount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium mt-1.5 pt-1.5 border-t border-pink-100/60" style={{ fontFamily: 'var(--font-theme-body)' }}>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-pink-400" />
                  <span>
                    <strong>{lifafa.claimed_count}</strong> / {lifafa.winner_count} Claimed
                  </span>
                </span>
                {lifafa.pin_code && (
                  <span className="flex items-center gap-1 text-pink-700 font-bold">
                    <Lock className="w-3 h-3" />
                    PIN Protected
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Gift Box Bottom Trim */}
        <div className="h-4 bg-gradient-to-t from-purple-800 to-pink-600 rounded-b-2xl flex items-center justify-center">
          <div className="w-12 h-1 rounded-full bg-yellow-300/60" />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. PROGRESS INDICATOR: 3-Tier Birthday Cake
// ==========================================
export const BirthdayProgress: React.FC<ThemeProgressProps> = ({
  totalRequired,
  completedCount,
  allDone,
}) => {
  const percent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;

  return (
    <div className="p-3.5 bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 border border-pink-200/80 rounded-2xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-pink-900 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          <Cake className="w-4 h-4 text-pink-600" />
          <span>Party Checklist ({completedCount}/{totalRequired})</span>
        </span>
        {allDone ? (
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <PartyPopper className="w-3 h-3" /> Cake Ready to Slice!
          </span>
        ) : (
          <span className="text-[10px] font-bold text-pink-700 font-mono">
            {percent}% Completed
          </span>
        )}
      </div>

      {/* Sweet Frosting Progress Bar */}
      <div className="h-2.5 w-full bg-pink-100 rounded-full overflow-hidden p-0.5 border border-pink-200">
        <div
          className="h-full bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 rounded-full transition-all duration-500 shadow-xs"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// ==========================================
// 3. TASK CARD: Carnival Party Ticket Pass
// ==========================================
export const BirthdayTaskCard: React.FC<ThemeTaskCardProps> = ({
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
    setHasJoined,
    tgBinding,
    isConnectingTg,
    awaitingBotStart,
    botDeepLink,
    isVerifyingMembership,
    verificationError,
    handleJoinTelegram,
    handleConnectTelegram,
    handleVerifyMembership,
    checkBindingStatus,
  } = useTaskLogic(task, isCompleted, onCompleted, onOpenAuth);

  const getTaskIcon = () => {
    switch (task.task_type) {
      case 'TELEGRAM_JOIN':
      case 'TELEGRAM_BOT':
        return <Send className="w-4 h-4 text-pink-500" />;
      case 'YOUTUBE_SUB':
        return <Youtube className="w-4 h-4 text-red-500" />;
      case 'INSTAGRAM_FOLLOW':
      case 'INSTAGRAM_LIKE':
        return <Instagram className="w-4 h-4 text-fuchsia-500" />;
      case 'REFERRAL':
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      default:
        return <Globe className="w-4 h-4 text-blue-500" />;
    }
  };

  if (isTelegramTask) {
    if (isCompleted) {
      return (
        <div className="p-3.5 rounded-2xl bg-pink-50/80 border border-pink-200 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-black text-pink-950 block" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                  Telegram Channel Joined ✓
                </span>
                {channelUsername && (
                  <span className="text-[10px] font-mono text-pink-700">@{channelUsername}</span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-bold text-pink-800 bg-pink-200/80 px-2.5 py-1 rounded-full">
              Membership Verified ✓
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl border-2 border-dashed border-pink-200 bg-white/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-pink-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-pink-500 text-white flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <h5 className="text-xs font-black text-slate-900" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                Telegram Birthday Channel
              </h5>
              <p className="text-[10px] text-slate-500" style={{ fontFamily: 'var(--font-theme-body)' }}>
                Join channel &amp; verify party membership
              </p>
            </div>
          </div>
          {task.is_required && (
            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full uppercase">
              Required
            </span>
          )}
        </div>

        {/* Step 1: Open */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Step 1: Open Channel</span>
            {channelUsername && <span className="font-mono text-[10px] text-pink-600 font-bold">@{channelUsername}</span>}
          </div>
          {!hasJoined && !tgBinding?.isBound ? (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleJoinTelegram}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors no-underline text-center"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              <span>Join Channel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <div className="flex items-center justify-between px-3 py-1.5 bg-pink-50 border border-pink-100 rounded-xl text-[11px] text-pink-800 font-bold">
              <span>Channel link opened ✓</span>
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-pink-600 underline text-[10px]">Re-open</a>
            </div>
          )}
        </div>

        {/* Step 2: Connect */}
        <div className="space-y-1.5 text-xs border-t border-pink-100 pt-2">
          <span className="font-bold text-slate-700">Step 2: Connect Account</span>
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
              <span>Connect Telegram</span>
            </button>
          )}
        </div>

        {/* Step 3: Verify */}
        <div className="space-y-1.5 text-xs border-t border-pink-100 pt-2">
          <span className="font-bold text-slate-700">Step 3: Verify Membership</span>
          {verificationError && (
            <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg font-medium">{verificationError}</p>
          )}
          <button
            type="button"
            onClick={handleVerifyMembership}
            disabled={isVerifyingMembership || !tgBinding?.isBound}
            className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-pink-500/20 active:scale-98"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            {isVerifyingMembership ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Verify Channel Membership</span>
          </button>
        </div>
      </div>
    );
  }

  // Non-Telegram Tasks: Carnival Ticket Pass
  return (
    <div
      className={`p-3.5 rounded-2xl border-2 transition-all ${
        isCompleted
          ? 'bg-pink-50/70 border-pink-200'
          : 'bg-white border-dashed border-pink-200 hover:border-pink-300 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
            {getTaskIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-xs font-black text-slate-900 truncate" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                {task.title}
              </h5>
              {task.is_required && (
                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-sm uppercase">
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
            <div className="flex items-center gap-1 text-pink-700 font-bold text-xs px-3 py-1.5 bg-pink-100 rounded-xl shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />
              <span>
                {task.task_type === 'VISIT_WEBSITE'
                  ? 'Party Visit Confirmed ✓'
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
              className="flex items-center gap-1 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
              style={{ fontFamily: 'var(--font-theme-heading)' }}
            >
              {genericLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <span>
                    {task.task_type === 'VISIT_WEBSITE'
                      ? 'Visit Link'
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
// 4. CLAIM SECTION: Birthday Invitation Card & Candle PIN
// ==========================================
export const BirthdayClaimSection: React.FC<ThemeClaimSectionProps> = ({
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

      {/* Sign-in prompt if not authenticated */}
      {!user && (
        <div className="p-4 bg-pink-50 border-2 border-dashed border-pink-200 rounded-3xl space-y-2 text-center">
          <PartyPopper className="w-6 h-6 text-pink-600 mx-auto" />
          <h4 className="text-sm font-black text-pink-900" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            Sign in to Claim your Birthday Surprise!
          </h4>
          <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-theme-body)' }}>
            Login with Google so we can safely deliver your party reward.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-pink-500/20 active:scale-98 cursor-pointer"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Birthday Candles PIN Input */}
      {requiresPin && (
        <div className="p-4 bg-gradient-to-r from-pink-50 via-amber-50 to-pink-50 border border-pink-200 rounded-3xl space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-xs font-black text-pink-900" style={{ fontFamily: 'var(--font-theme-heading)' }}>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>Light the Birthday Candles (Enter PIN)</span>
          </div>

          {/* Candle Flames Indicator */}
          <div className="flex items-center justify-center gap-3 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isLit = pinCode.length > idx;
              return (
                <div key={idx} className="flex flex-col items-center">
                  <Flame
                    className={`w-5 h-5 transition-all duration-300 ${
                      isLit
                        ? 'text-amber-500 fill-amber-400 scale-125 animate-pulse'
                        : 'text-slate-300 opacity-40'
                    }`}
                  />
                  <div className={`w-3 h-7 rounded-sm mt-0.5 border ${isLit ? 'bg-pink-400 border-pink-500' : 'bg-slate-200 border-slate-300'}`} />
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
            className="w-full max-w-xs mx-auto px-4 py-2 bg-white border border-pink-200 rounded-xl text-center text-xs font-mono tracking-widest text-slate-900 focus:outline-hidden focus:border-pink-500"
          />
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <BirthdayProgress
            totalRequired={requiredTasks.length}
            completedCount={completedTaskIds.size}
            allDone={allRequiredDone}
          />
          <div className="space-y-2">
            {tasks.map((task) => (
              <BirthdayTaskCard
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

      {/* Payout Details Input if in UPI_BANK mode */}
      {lifafa.payout_mode === 'UPI_BANK' && (
        <div className="p-4 bg-pink-50/70 border border-pink-200 rounded-3xl space-y-3">
          <div className="flex items-center justify-between border-b border-pink-200 pb-2">
            <span className="text-xs font-black text-pink-900 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
              <Landmark className="w-4 h-4 text-pink-600" />
              <span>Direct Birthday Payout (Bank / UPI)</span>
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
              placeholder="Name registered with your bank"
              className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-pink-500"
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
                placeholder="e.g. 123456789012"
                className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-pink-500"
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
                className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-hidden focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1" style={{ fontFamily: 'var(--font-theme-body)' }}>
              UPI ID (Optional if Bank Account given)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yourname@okaxis"
              className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-pink-500"
            />
          </div>
        </div>
      )}

      {/* Primary Claim CTA Button */}
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming || !allRequiredDone}
        className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border-2 border-pink-300/40"
        style={{ fontFamily: 'var(--font-theme-heading)' }}
      >
        {claiming ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Unwrapping Birthday Gift...</span>
          </>
        ) : (
          <>
            <PartyPopper className="w-5 h-5" />
            <span>Claim Birthday Cash Gift! 🎂</span>
          </>
        )}
      </button>
    </div>
  );
};

// ==========================================
// 5. REWARD REVEAL: Balloons & Streamers Blast
// ==========================================
export const BirthdayRewardReveal: React.FC<ThemeRewardRevealProps> = ({
  amount,
  code,
  payoutMode,
  lifafa,
  onClose,
  onOpenShare,
}) => {
  return (
    <div className="p-6 bg-gradient-to-b from-pink-50 via-rose-50 to-white border-2 border-pink-300 rounded-3xl text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white mx-auto flex items-center justify-center shadow-lg shadow-pink-500/30 animate-bounce">
        <PartyPopper className="w-8 h-8" />
      </div>

      <div>
        <span className="text-xs font-black uppercase tracking-wider text-pink-600 bg-pink-100 px-3 py-1 rounded-full" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          🎉 HAPPY BIRTHDAY PRIZE!
        </span>
        <h3 className="text-2xl font-black text-slate-900 mt-2" style={{ fontFamily: 'var(--font-theme-heading)' }}>
          Surprise Unwrapped!
        </h3>
        <p className="text-xs text-slate-500 mt-0.5" style={{ fontFamily: 'var(--font-theme-body)' }}>
          {lifafa.title}
        </p>
      </div>

      <div className="p-4 bg-white rounded-2xl border border-pink-200 shadow-sm">
        <span className="text-[11px] font-bold text-slate-400 uppercase block" style={{ fontFamily: 'var(--font-theme-body)' }}>
          You Received
        </span>
        <span className="text-4xl sm:text-5xl font-black text-pink-600 tracking-tight" style={{ fontFamily: 'var(--font-theme-numeral)' }}>
          {formatCurrency(amount)}
        </span>
        <p className="text-xs font-bold text-pink-700 mt-1">
          {payoutMode === 'UPI_BANK' ? 'Deposited directly to your Bank / UPI!' : 'Credited to your CreatLifafa Wallet!'}
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {onOpenShare && (
          <button
            type="button"
            onClick={() => onOpenShare(lifafa)}
            className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-black rounded-2xl text-xs shadow-md shadow-pink-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            style={{ fontFamily: 'var(--font-theme-heading)' }}
          >
            <Share2 className="w-4 h-4" />
            <span>Share Birthday Joy with Friends!</span>
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
// 6. AMBIENT DECORATIONS: Balloons & Streamers
// ==========================================
export const BirthdayDecorations: React.FC<ThemeDecorationsProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Floating Soft Color Circles */}
      <div className="absolute top-10 left-6 w-32 h-32 rounded-full bg-pink-300/20 blur-2xl animate-pulse" />
      <div className="absolute bottom-20 right-6 w-40 h-40 rounded-full bg-yellow-300/20 blur-3xl animate-pulse" />
      <div className="absolute top-1/2 left-1/3 w-36 h-36 rounded-full bg-purple-300/15 blur-3xl" />
    </div>
  );
};

// ==========================================
// 7. STATUS VIEWS: Expired & Fully Claimed
// ==========================================
export const BirthdayExpiredView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-pink-50 border border-pink-200 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-pink-200 text-pink-700 mx-auto flex items-center justify-center">
      <Clock className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-pink-950">Party Has Ended</h4>
    <p className="text-xs text-slate-500">This birthday Lifafa has reached its expiration time.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-pink-600 underline cursor-pointer">
        Explore more active celebrations
      </button>
    )}
  </div>
);

export const BirthdayFullyClaimedView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
  <div className="p-6 bg-pink-50 border border-pink-200 rounded-3xl text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-pink-200 text-pink-700 mx-auto flex items-center justify-center">
      <Cake className="w-6 h-6" />
    </div>
    <h4 className="text-base font-black text-pink-950">All Cake Slices Claimed!</h4>
    <p className="text-xs text-slate-500">All birthday gifts for this Lifafa have already been received.</p>
    {onNavigateHome && (
      <button onClick={onNavigateHome} className="text-xs font-bold text-pink-600 underline cursor-pointer">
        Discover more Lifafas on CreatLifafa
      </button>
    )}
  </div>
);

// ==========================================
// THEME EXPORT
// ==========================================
export const birthdayTheme: LifafaTheme = {
  id: 'birthday',
  name: 'Birthday Party',
  tagline: 'Playful celebration with balloons, gift boxes & cake candles',
  badge: '🎂 Birthday',
  description: 'Festive gift-box unboxing with party poppers, birthday candle PIN, and sweet pastel confetti.',
  previewGradient: 'from-pink-500 via-rose-400 to-purple-500',
  typography: {
    headingFont: 'Fredoka',
    numeralFont: 'Titan One',
    bodyFont: 'Quicksand',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Quicksand:wght@500;600;700&family=Titan+One&display=swap',
    fallbackStack: `'Comic Sans MS', 'Chalkboard SE', cursive, sans-serif`,
  },
  colors: {
    pageBackground: 'bg-gradient-to-b from-pink-50 via-rose-50 to-purple-50',
    envelopePrimary: '#ec4899',
    envelopeSecondary: '#f43f5e',
    envelopeAccent: '#8b5cf6',
    cardBackground: 'bg-white',
    cardBorder: 'border-pink-200',
    textPrimary: '#831843',
    textSecondary: '#9d174d',
    textMuted: '#64748b',
    highlightGold: '#f59e0b',
  },
  components: {
    Envelope: BirthdayEnvelope,
    ClaimSection: BirthdayClaimSection,
    TaskCard: BirthdayTaskCard,
    ProgressIndicator: BirthdayProgress,
    RewardReveal: BirthdayRewardReveal,
    Decorations: BirthdayDecorations,
    ExpiredView: BirthdayExpiredView,
    FullyClaimedView: BirthdayFullyClaimedView,
  },
};
