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
} from 'lucide-react';
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

        {/* Security PIN Code if Required */}
        {requiresPin && (
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-800">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>Security PIN Required</span>
            </div>
            <input
              type="password"
              maxLength={6}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              placeholder="Enter 4-6 digit PIN"
              className="w-full max-w-xs mx-auto px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-mono tracking-widest text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
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
          <p className="text-xs font-semibold text-emerald-600 mt-1">
            {payoutMode === 'UPI_BANK'
              ? 'Dispatched directly to Bank Account!'
              : 'Credited instantly to your CreatLifafa Wallet!'}
          </p>
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
        gifts on CreatLifafa!
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
