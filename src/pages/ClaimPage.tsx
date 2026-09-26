import React, { useState, useEffect, useRef } from 'react';
import {
  Gift,
  Sparkles,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  ArrowLeft,
  Lock,
  Landmark,
  Copy,
  Check,
  Compass,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Lifafa, LifafaTask, PayoutMode } from '../types/database';
import { lifafaService } from '../services/lifafaService';
import { taskService } from '../services/taskService';
import { fraudService } from '../services/fraudService';
import { useAuth } from '../context/AuthContext';
import { DigitalEnvelope } from '../components/lifafa/DigitalEnvelope';
import { TaskCard } from '../components/lifafa/TaskCard';
import { Logo } from '../components/common/Logo';
import { formatCurrency, formatTimeRemaining } from '../lib/utils';
import { ThemeProvider } from '../themes/ThemeContext';
import { getTheme } from '../themes/registry';
import { useResolvedTheme, buildClaimUrl } from '../themes/useThemeResolver';

interface ClaimPageProps {
  code: string;
  onNavigateHome?: () => void;
  onOpenAuth: () => void;
  onOpenShare?: (lifafa: Lifafa) => void;
}

export const ClaimPage: React.FC<ClaimPageProps> = ({
  code,
  onNavigateHome,
  onOpenAuth,
  onOpenShare,
}) => {
  const { user, refreshWallet } = useAuth();

  const [lifafa, setLifafa] = useState<Lifafa | null>(null);
  const [loadingLifafa, setLoadingLifafa] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [pinCode, setPinCode] = useState('');
  const [tasks, setTasks] = useState<LifafaTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<{ amount: number; code: string; payoutMode?: PayoutMode } | null>(null);
  const [isEnvelopeOpened, setIsEnvelopeOpened] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // UPI / Bank Payout Details State
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  const resolvedThemeId = useResolvedTheme(lifafa);
  const theme = getTheme(resolvedThemeId);

  const lifafaId = lifafa?.id;
  const userId = user?.id;

  // 1. Fetch Lifafa by Code
  useEffect(() => {
    if (!code) {
      setNotFound(true);
      setLoadingLifafa(false);
      return;
    }

    let isMounted = true;
    setLoadingLifafa(true);
    setNotFound(false);

    lifafaService
      .getLifafaByCode(code.trim().toUpperCase())
      .then((found) => {
        if (!isMounted) return;
        if (found) {
          setLifafa(found);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch((e) => {
        console.error('Error fetching lifafa by code:', e);
        if (isMounted) setNotFound(true);
      })
      .finally(() => {
        if (isMounted) setLoadingLifafa(false);
      });

    return () => {
      isMounted = false;
    };
  }, [code]);

  // 2. Load tasks and check if current user already claimed
  useEffect(() => {
    if (!lifafaId) return;

    let isMounted = true;
    setLoadingTasks(true);

    lifafaService
      .getLifafaTasks(lifafaId)
      .then((fetchedTasks) => {
        if (!isMounted) return;
        setTasks(fetchedTasks || []);

        if (userId) {
          lifafaService.getUserClaimForLifafa(lifafaId, userId).then((existingClaim) => {
            if (!isMounted) return;
            if (existingClaim) {
              setAlreadyClaimed(existingClaim.amount);
              setClaimResult({
                amount: existingClaim.amount,
                code: lifafa?.code || code,
                payoutMode: existingClaim.payout_mode || lifafa?.payout_mode || 'WALLET',
              });
              setIsEnvelopeOpened(true);
            }
          });

          taskService.getUserTaskCompletions(lifafaId, userId).then((completions) => {
            if (!isMounted) return;
            const verified = new Set(
              (completions || [])
                .filter((c) => ['VERIFIED', 'CLICK_CONFIRMED', 'USER_CONFIRMED'].includes(c.status))
                .map((c) => c.task_id)
            );
            setCompletedTaskIds(verified);
          });
        }
      })
      .catch((err) => {
        console.error('Error loading tasks or claim status:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingTasks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lifafaId, userId]);

  const { isExpired, formatted: timeLeft } = lifafa
    ? formatTimeRemaining(lifafa.expires_at)
    : { isExpired: false, formatted: '' };

  const isCompleted = Boolean(
    lifafa && (lifafa.status === 'COMPLETED' || lifafa.claimed_count >= lifafa.winner_count)
  );

  const requiredTasks = tasks.filter((t) => t.is_required && t.is_enabled);
  const allRequiredDone = requiredTasks.every((t) => completedTaskIds.has(t.id));

  const handleTaskDone = (taskId: string) => {
    setCompletedTaskIds((prev) => new Set([...prev, taskId]));
  };

  const handleCopyShareUrl = () => {
    const shareUrl = buildClaimUrl(code, resolvedThemeId);
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClaim = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    if (!lifafa) return;

    if (lifafa.pin_code && !pinCode.trim()) {
      setErrorMsg('PIN code is required to claim this Lifafa.');
      return;
    }

    if (!allRequiredDone) {
      setErrorMsg('Please complete and verify all required tasks above before claiming.');
      return;
    }

    // Validate UPI / Bank details if Lifafa is in UPI_BANK mode
    if (lifafa.payout_mode === 'UPI_BANK') {
      if (!accountHolderName.trim() || accountHolderName.trim().length < 2) {
        setErrorMsg('Please enter account holder name as per bank records.');
        return;
      }
      if (
        (!bankAccountNumber.trim() || bankAccountNumber.trim().length < 6) &&
        (!upiId.trim() || upiId.trim().length < 3)
      ) {
        setErrorMsg('Please provide a valid Bank Account Number or UPI ID.');
        return;
      }
      if (ifscCode.trim() && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifscCode.trim())) {
        setErrorMsg('Invalid IFSC code format (expected 11 alphanumeric characters e.g. SBIN0001234).');
        return;
      }
      if (upiId.trim() && !/^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim())) {
        setErrorMsg('Invalid UPI ID format (e.g. yourname@okhdfcbank).');
        return;
      }
    }

    try {
      setClaiming(true);
      setErrorMsg(null);

      const deviceFp = fraudService.getDeviceFingerprint();
      const idempotencyKey = `claim_${lifafa.id}_${user.id}_${Date.now()}`;

      // Authoritative atomic server RPC claim
      const res = await lifafaService.claimLifafa(
        lifafa.code,
        pinCode.trim() || undefined,
        deviceFp,
        undefined,
        idempotencyKey,
        lifafa.payout_mode === 'UPI_BANK'
          ? {
              accountHolderName: accountHolderName.trim(),
              bankAccountNumber: bankAccountNumber.trim() || undefined,
              ifscCode: ifscCode.trim().toUpperCase() || undefined,
              upiId: upiId.trim() || undefined,
            }
          : undefined
      );

      // Confetti celebration
      confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.55 },
        colors: ['#2563eb', '#fbbf24', '#e11d48', '#10b981', '#6366f1'],
      });

      setClaimResult({
        amount: res.amount,
        code: lifafa.code,
        payoutMode: res.payout_mode || lifafa.payout_mode || 'WALLET',
      });

      await refreshWallet();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to claim Lifafa');
    } finally {
      setClaiming(false);
    }
  };

  // State A: Loading Lifafa
  if (loadingLifafa) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-4 text-blue-400 animate-pulse">
          <Gift className="w-8 h-8 animate-bounce" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Retrieving Digital Lifafa...</p>
        <span className="text-xs font-mono text-blue-400 mt-1">{code.toUpperCase()}</span>
      </div>
    );
  }

  // State B: Not Found / Invalid Code
  if (notFound || !lifafa) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-800/80 backdrop-blur-md rounded-3xl p-8 border border-slate-700/60 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Lifafa Not Found</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              We couldn't locate any active digital Lifafa with code{' '}
              <span className="font-mono text-rose-400 font-bold">{code.toUpperCase()}</span>.
              Please verify the link and try again.
            </p>
          </div>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Go to CreatLifafa Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider themeId={resolvedThemeId}>
      <div
        className={`min-h-screen relative overflow-x-hidden ${theme.colors.pageBackground} flex flex-col items-center justify-between p-3 sm:p-6 selection:bg-blue-500 selection:text-white`}
      >
        {/* Ambient Theme Background Animations & Particle Decorations */}
        <theme.components.Decorations />

        {/* 1. Subtle Standalone Header */}
        <header className="relative z-10 w-full max-w-md flex items-center justify-between py-2 pt-3">
          <div className="w-20 flex items-center justify-start">
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                <span className="font-medium">Home</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-center">
            <Logo size="sm" showTagline={false} />
          </div>

          <div className="w-20 flex items-center justify-end">
            <span className="text-[11px] font-mono text-slate-500 bg-white/70 backdrop-blur-xs px-2 py-0.5 rounded-md border border-slate-200/80 whitespace-nowrap shadow-xs">
              {lifafa.code}
            </span>
          </div>
        </header>

        {/* 2. Main Centered Lifafa Experience Card */}
        <main className="relative z-10 w-full max-w-md my-auto py-4">
          <div
            className={`${theme.colors.cardBackground} backdrop-blur-xl border ${theme.colors.cardBorder} rounded-3xl shadow-2xl overflow-hidden p-4 sm:p-6 space-y-5 transition-all`}
          >
            {/* 4-Stat Metric & 3D Gift Box Hero Card - Matching Reference Screenshot 5 */}
            <div className="bg-gradient-to-br from-[#1E40AF] via-[#1D4ED8] to-[#2563EB] rounded-3xl p-5 text-white shadow-xl space-y-4">
              <div className="text-center space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-blue-100 border border-white/20">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Join &amp; Claim Lifafa</span>
                </span>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {lifafa.title}
                </h1>
                {lifafa.message && (
                  <p className="text-xs text-blue-100/90 leading-relaxed max-w-xs mx-auto italic">
                    "{lifafa.message}"
                  </p>
                )}
              </div>

              {/* Central 3D White & Gold Gift Box Illustration */}
              <div className="relative mx-auto w-28 h-28 sm:w-32 sm:h-32 my-1">
                <img
                  src="/images/claim_hero_gift.jpg"
                  alt="Claim Gift Box"
                  className="w-full h-full object-contain rounded-2xl drop-shadow-2xl animate-in zoom-in-95 duration-300"
                />
              </div>

              {/* 4-Stat Metric Grid */}
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/15 text-center">
                <div className="bg-white/10 rounded-xl p-2">
                  <span className="text-[9px] uppercase tracking-wider text-blue-200 font-bold block">Total Users</span>
                  <span className="text-xs sm:text-sm font-black text-white">{lifafa.winner_count}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2">
                  <span className="text-[9px] uppercase tracking-wider text-blue-200 font-bold block">Per User</span>
                  <span className="text-xs sm:text-sm font-black text-amber-300">
                    ₹{(lifafa.total_amount / (lifafa.winner_count || 1)).toFixed(2)}
                  </span>
                </div>
                <div className="bg-white/10 rounded-xl p-2">
                  <span className="text-[9px] uppercase tracking-wider text-blue-200 font-bold block">Claimed</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-300">{lifafa.claimed_count}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2">
                  <span className="text-[9px] uppercase tracking-wider text-blue-200 font-bold block">Remaining</span>
                  <span className="text-xs sm:text-sm font-black text-cyan-200">
                    {Math.max(0, (lifafa.winner_count || 0) - (lifafa.claimed_count || 0))}
                  </span>
                </div>
              </div>

              {/* Cyan Claim Progress Bar */}
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between text-[10px] font-bold text-blue-200">
                  <span>Claim Progress</span>
                  <span>
                    {lifafa.claimed_count} / {lifafa.winner_count} Claimed (
                    {Math.round((lifafa.claimed_count / (lifafa.winner_count || 1)) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-sm shadow-cyan-400/50"
                    style={{
                      width: `${Math.min(100, Math.max(3, (lifafa.claimed_count / (lifafa.winner_count || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Flow Branch 1: Claimed Success State with Themed Reward Reveal */}
            {claimResult ? (
              <theme.components.RewardReveal
                amount={claimResult.amount}
                code={claimResult.code}
                payoutMode={claimResult.payoutMode || lifafa.payout_mode || 'WALLET'}
                lifafa={lifafa}
                onOpenShare={onOpenShare || (() => handleCopyShareUrl())}
                onClose={onNavigateHome}
              />
            ) : isCompleted ? (
              /* Flow Branch 2: Fully Claimed (Out of claims) */
              <theme.components.FullyClaimedView
                lifafa={lifafa}
                onNavigateHome={onNavigateHome}
              />
            ) : isExpired ? (
              /* Flow Branch 3: Expired Lifafa */
              <theme.components.ExpiredView
                lifafa={lifafa}
                onNavigateHome={onNavigateHome}
              />
            ) : (
              /* Flow Branch 4: Active Claim View with Tasks, PIN, and CTA */
              <div className="space-y-4 pt-1">
                {errorMsg && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Dedicated Theme Envelope Visual */}
                <div className="py-1">
                  <theme.components.Envelope
                    lifafa={lifafa}
                    isEnvelopeOpened={isEnvelopeOpened}
                    onUnsealEnvelope={() => setIsEnvelopeOpened(true)}
                    claimedAmount={alreadyClaimed ?? undefined}
                    timeLeft={timeLeft}
                    isExpired={isExpired}
                  />
                </div>

                {/* Numbered Pill Task Cards Section - Reference Screenshot 5 */}
                {tasks.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <span>Channel Tasks</span>
                      </h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {completedTaskIds.size} / {requiredTasks.length} Completed
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {tasks.map((t, idx) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          isCompleted={completedTaskIds.has(t.id)}
                          onCompleted={handleTaskDone}
                          onOpenAuth={onOpenAuth}
                          taskNumber={idx + 1}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* PIN Code Verification if Required */}
                {Boolean(lifafa.pin_code) && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-center">
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
                      className="w-full max-w-xs mx-auto px-4 py-2 bg-white border border-slate-200 rounded-xl text-center text-sm font-mono tracking-widest text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Direct Bank Settlement Form if lifafa is UPI_BANK */}
                {lifafa.payout_mode === 'UPI_BANK' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 border-b border-slate-200 pb-2">
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
                        placeholder="Enter Account Holder Name"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-blue-500"
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
                          placeholder="e.g. HDFC0001234"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:border-blue-500"
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
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Floating / Sticky Verify & Claim Lifafa CTA - Reference Screenshot 5 */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={claiming || (!allRequiredDone && user !== null)}
                    className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Verifying &amp; Claiming...</span>
                      </>
                    ) : !user ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Sign In with Google to Claim</span>
                      </>
                    ) : !allRequiredDone ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Complete All Required Tasks to Unlock</span>
                      </>
                    ) : (
                      <>
                        <span>🔒 Verify &amp; Claim Lifafa →</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* 3. Subtle Standalone Footer */}
        <footer className="relative z-10 w-full max-w-md text-center py-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} CreatLifafa</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>India's Modern Digital Gifting</span>
          </span>
        </footer>
      </div>
    </ThemeProvider>
  );
};
