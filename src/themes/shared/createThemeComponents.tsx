import React from 'react';
import {
  Gift,
  Clock,
  Users,
  CheckCircle2,
  Share2,
  Lock,
  Landmark,
  Coins,
  Send,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
} from 'lucide-react';
import { lifafaService } from '../../services/lifafaService';
import type {
  ThemeVisualConfig,
  ThemeEnvelopeProps,
  ThemeClaimSectionProps,
  ThemeTaskCardProps,
  ThemeProgressProps,
  ThemeRewardRevealProps,
  ThemeStatusProps,
  ThemeDecorationsProps,
} from '../types';
import { formatCurrency } from '../../lib/utils';
import { TaskCard as ModernTaskCard } from '../../components/lifafa/TaskCard';

export function createThemeComponents(config: ThemeVisualConfig) {
  // 1. Envelope: Approved 3D Hero Card
  const Envelope: React.FC<ThemeEnvelopeProps> = ({
    lifafa,
    isEnvelopeOpened,
    onUnsealEnvelope,
    claimedAmount,
    timeLeft,
  }) => {
    const perUserAmount = (lifafa.total_amount / (lifafa.winner_count || 1)).toFixed(
      lifafa.total_amount % (lifafa.winner_count || 1) === 0 ? 0 : 2
    );
    const remainingWinners = Math.max(0, (lifafa.winner_count || 0) - (lifafa.claimed_count || 0));
    const progressPct = Math.min(
      100,
      Math.max(4, Math.round((lifafa.claimed_count / (lifafa.winner_count || 1)) * 100))
    );

    return (
      <div
        className={`${config.heroGradient} rounded-3xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden space-y-4`}
      >
        {/* Top Half: Left Title/Message + Right 3D Theme Gift Artwork */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="space-y-1 min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/80 block">
              {config.heroTagLabel}
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug truncate">
              {lifafa.title}
            </h2>
            {lifafa.message && (
              <p className="text-xs text-white/90 italic font-medium leading-relaxed line-clamp-2 mt-0.5">
                "{lifafa.message}"
              </p>
            )}
          </div>

          <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
            <img
              src={config.heroArtwork}
              alt={config.name}
              className="w-full h-full object-contain rounded-2xl drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Bottom Half: 4-Stat Metric Box + Dual Progress Bar */}
        <div className="bg-white text-slate-800 rounded-2xl p-3 shadow-md">
          <div className="grid grid-cols-4 gap-2 text-center divide-x divide-slate-100">
            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                <Users className="w-3 h-3 text-blue-500" />
                <span>Total Users</span>
              </div>
              <span className="text-sm sm:text-base font-black text-slate-900 block">
                {lifafa.winner_count}
              </span>
            </div>

            <div className="space-y-0.5 pl-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                <span className="text-xs font-bold text-emerald-600">₹</span>
                <span>Per User</span>
              </div>
              <span className="text-sm sm:text-base font-black text-emerald-600 block">
                ₹{perUserAmount}
              </span>
            </div>

            <div className="space-y-0.5 pl-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                <Gift className="w-3 h-3 text-purple-500" />
                <span>Claimed</span>
              </div>
              <span className="text-sm sm:text-base font-black text-purple-600 block">
                {lifafa.claimed_count}
              </span>
            </div>

            <div className="space-y-0.5 pl-1">
              <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Remaining</span>
              </div>
              <span className="text-sm sm:text-base font-black text-amber-600 block">
                {remainingWinners}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${config.progressBarFill} rounded-full transition-all duration-500 shadow-xs`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-1.5">
              <span>
                {lifafa.claimed_count}/{lifafa.winner_count} Claimed
              </span>
              <span>{remainingWinners} Left</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2. ClaimSection: Channels, PIN, Payout form, and Theme-colored CTA
  const ClaimSection: React.FC<ThemeClaimSectionProps> = ({
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
    const [showClaimantPin, setShowClaimantPin] = React.useState(false);
    const [isPinUnlocked, setIsPinUnlocked] = React.useState(!requiresPin);
    const [verifyingPin, setVerifyingPin] = React.useState(false);
    const [pinError, setPinError] = React.useState<string | null>(null);

    React.useEffect(() => {
      setIsPinUnlocked(!requiresPin);
      setShowClaimantPin(false);
      setPinError(null);
    }, [lifafa.id, requiresPin]);

    const handleUnlockLifafa = async () => {
      if (!user) {
        onOpenAuth();
        return;
      }

      const cleanPin = pinCode.trim();
      if (!cleanPin) {
        setPinError('Please enter the security PIN.');
        return;
      }

      try {
        setVerifyingPin(true);
        setPinError(null);
        const res = await lifafaService.verifyLifafaPin(lifafa.code, cleanPin);
        if (res.valid) {
          setIsPinUnlocked(true);
          setPinError(null);
        } else {
          setPinError(res.message || 'Incorrect PIN code entered. Please try again.');
        }
      } catch (err: any) {
        setPinError(err.message || 'Verification failed. Please try again.');
      } finally {
        setVerifyingPin(false);
      }
    };

    return (
      <div className="space-y-4 pt-1">
        {/* Required Channels Section */}
        {tasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl ${config.channelHeaderIconBg} flex items-center justify-center shrink-0 shadow-xs`}
                >
                  <Send className="w-4 h-4 -rotate-12" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                    Join Required Channels
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Join all channels below to unlock the claim button
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${config.channelHeaderBadgeBg} text-[11px] font-bold shadow-2xs`}
                >
                  <span>👑</span>
                  <span>Complete All Steps</span>
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {tasks.map((t, idx) => (
                <ModernTaskCard
                  key={t.id}
                  task={t}
                  isCompleted={completedTaskIds.has(t.id)}
                  onCompleted={onTaskDone}
                  onOpenAuth={onOpenAuth}
                  taskNumber={idx + 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Security PIN Code Section if Required */}
        {requiresPin && (
          <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    This Lifafa is PIN protected
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Enter the 4-6 digit passcode provided by the creator
                  </p>
                </div>
              </div>
              {isPinUnlocked ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Unlocked</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/60 shrink-0">
                  PIN Required
                </span>
              )}
            </div>

            {isPinUnlocked ? (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Lifafa Unlocked Successfully</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 font-bold">READY TO CLAIM</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="text-left">
                  <label htmlFor="modal-claimant-pin" className="block text-xs font-bold text-slate-700 mb-1">
                    PIN
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="modal-claimant-pin"
                      type={showClaimantPin ? 'text' : 'password'}
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => {
                        setPinCode(e.target.value.replace(/\D/g, ''));
                        if (pinError) setPinError(null);
                      }}
                      placeholder="Enter PIN"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-mono font-bold tracking-widest text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal caret-slate-900 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all [color-scheme:light]"
                    />
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => setShowClaimantPin(!showClaimantPin)}
                      aria-label={showClaimantPin ? 'Hide PIN' : 'Reveal PIN'}
                      className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
                    >
                      {showClaimantPin ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {pinError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-[11px] text-red-700 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{pinError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleUnlockLifafa}
                  disabled={verifyingPin || !pinCode.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifyingPin ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying PIN...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Unlock Lifafa</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Direct Bank Settlement Form if lifafa is UPI_BANK */}
        {lifafa.payout_mode === 'UPI_BANK' && (
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 border-b border-slate-100 pb-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              <span>Direct Bank Settlement Details</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Account Holder Name *
              </label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Account holder name as per bank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all [color-scheme:light]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Account Number"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all [color-scheme:light]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all [color-scheme:light]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                UPI ID (Optional fallback)
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="username@bank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all [color-scheme:light]"
              />
            </div>
          </div>
        )}

        {/* Primary CTA Button */}
        <div className="pt-2 sticky bottom-3 z-30 pb-1">
          <button
            type="button"
            onClick={onClaim}
            disabled={claiming}
            className={`w-full py-4 px-6 ${config.ctaGradient} active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-2xl shadow-xl ${config.ctaShadow} transition-all flex items-center justify-center gap-2 cursor-pointer`}
          >
            {claiming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verifying &amp; Claiming...</span>
              </>
            ) : requiresPin && !isPinUnlocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Enter &amp; Unlock PIN First</span>
              </>
            ) : !allRequiredDone ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Complete Required Tasks</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Verify &amp; Claim Lifafa →</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // 3. TaskCard: Adapter to ModernTaskCard
  const TaskCardComponent: React.FC<ThemeTaskCardProps> = ({
    task,
    isCompleted,
    onCompleted,
    onOpenAuth,
  }) => {
    return (
      <ModernTaskCard
        task={task}
        isCompleted={isCompleted}
        onCompleted={onCompleted}
        onOpenAuth={onOpenAuth}
      />
    );
  };

  // 4. ProgressIndicator
  const ProgressIndicator: React.FC<ThemeProgressProps> = ({
    totalRequired,
    completedCount,
    allDone,
  }) => {
    const pct = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 100;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-bold text-slate-500">
          <span>Required Tasks</span>
          <span>
            {completedCount}/{totalRequired} ({pct}%)
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${config.progressBarFill} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  // 5. RewardReveal: Celebratory Reward Unlocked with Theme Artwork
  const RewardReveal: React.FC<ThemeRewardRevealProps> = ({
    amount,
    code,
    payoutMode,
    lifafa,
    onClose,
    onOpenShare,
    payoutDispatched,
    withdrawalStatus,
    payoutError,
    payoutReferenceId,
  }) => {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center space-y-5 animate-in zoom-in-95 duration-300">
        <div className="relative mx-auto w-28 h-28">
          <img
            src={config.heroArtwork}
            alt={config.name}
            className="w-full h-full object-contain drop-shadow-xl"
          />
        </div>

        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reward Claimed Successfully!</span>
          </span>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
            Congratulations!
          </h3>
          <p className="text-xs text-slate-500">{lifafa.title}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">
            Reward Amount
          </span>
          <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            {formatCurrency(amount)}
          </span>
          <p className={`text-xs font-semibold mt-1 ${
            payoutMode === 'UPI_BANK' && payoutDispatched === false
              ? 'text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200 text-center'
              : 'text-emerald-600'
          }`}>
            {payoutMode === 'UPI_BANK'
              ? withdrawalStatus === 'PROCESSING'
                ? 'Payout initiated! Processing with bank...'
                : payoutDispatched && (withdrawalStatus === 'SUCCESS' || !withdrawalStatus)
                  ? 'Dispatched directly to Bank Account!'
                  : `Reward credited to wallet (Bank dispatch failed: ${payoutError || 'Transfer rejected'})`
              : 'Credited instantly to your CreatLifafa Wallet!'}
          </p>
          {payoutReferenceId && (
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Ref: {payoutReferenceId}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-1">
          {onOpenShare && (
            <button
              type="button"
              onClick={() => onOpenShare(lifafa)}
              className={`w-full py-3.5 ${config.ctaGradient} text-white font-bold rounded-2xl text-xs shadow-md ${config.ctaShadow} flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer`}
            >
              <Share2 className="w-4 h-4" />
              <span>Share This Lifafa With Friends</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  };

  // 6. Ambient Decorations: Watermarks & glow
  const Decorations: React.FC<ThemeDecorationsProps> = ({ className = '' }) => {
    return (
      <div className={`pointer-events-none select-none fixed inset-0 overflow-hidden z-0 ${className}`}>
        <span
          className={`absolute bottom-6 left-4 ${config.ambientTextColor || 'text-slate-400/30'} text-xs font-bold tracking-wider`}
        >
          {config.ambientTextLeft}
        </span>
        <span
          className={`absolute bottom-6 right-4 ${config.ambientTextColor || 'text-slate-400/30'} text-xs font-bold tracking-wider`}
        >
          {config.ambientTextRight}
        </span>
        {config.ambientTextRotated && (
          <span
            className={`absolute top-1/2 right-3 -translate-y-1/2 rotate-90 ${config.ambientTextColor || 'text-slate-400/30'} text-[11px] font-semibold tracking-widest hidden md:inline-block`}
          >
            {config.ambientTextRotated}
          </span>
        )}
      </div>
    );
  };

  // 7. Expired View
  const ExpiredView: React.FC<ThemeStatusProps> = ({ onNavigateHome }) => (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 mx-auto flex items-center justify-center">
        <Clock className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-black text-slate-900">Lifafa Expired</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        The time window to claim this digital gift has ended.
      </p>
      {onNavigateHome && (
        <button
          type="button"
          onClick={onNavigateHome}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
        >
          Explore Active Lifafas
        </button>
      )}
    </div>
  );

  // 8. Fully Claimed View
  const FullyClaimedView: React.FC<ThemeStatusProps> = ({ lifafa, onNavigateHome }) => (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto flex items-center justify-center">
        <Gift className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-black text-slate-900">All Rewards Claimed</h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        All {lifafa.winner_count} spots for this Lifafa have already been claimed. Explore more
        gifts on Createlifafa.xyz!
      </p>
      {onNavigateHome && (
        <button
          type="button"
          onClick={onNavigateHome}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
        >
          Explore More Lifafas
        </button>
      )}
    </div>
  );

  return {
    Envelope,
    ClaimSection,
    TaskCard: TaskCardComponent,
    ProgressIndicator,
    RewardReveal,
    Decorations,
    ExpiredView,
    FullyClaimedView,
  };
}
