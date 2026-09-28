import React, { useState, useEffect } from 'react';
import {
  Gift,
  Sparkles,
  Clock,
  Users,
  AlertCircle,
  Loader2,
  Share2,
  ArrowLeft,
  Lock,
  Landmark,
  Copy,
  Check,
  Send,
  HelpCircle,
  X,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Lifafa, LifafaTask, PayoutMode } from '../types/database';
import { lifafaService } from '../services/lifafaService';
import { taskService } from '../services/taskService';
import { fraudService } from '../services/fraudService';
import { useAuth } from '../context/AuthContext';
import { TaskCard } from '../components/lifafa/TaskCard';
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
  const [claimResult, setClaimResult] = useState<{
    amount: number;
    code: string;
    payoutMode?: PayoutMode;
  } | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // UPI / Bank Payout Details State
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  const resolvedThemeId = useResolvedTheme(lifafa);
  const theme = getTheme(resolvedThemeId);
  const v = theme.visualConfig;
  const isDark = Boolean(v?.isDark);

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
  const allRequiredDone = requiredTasks.length === 0 || requiredTasks.every((t) => completedTaskIds.has(t.id));

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
      setErrorMsg('Please complete and verify all required channels above before claiming.');
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
      <div className={`min-h-screen ${v?.pageBackground || 'bg-gradient-to-b from-[#F0F6FF] via-[#E8F1FD] to-[#F3F8FF]'} ${isDark ? 'text-white' : 'text-slate-800'} flex flex-col items-center justify-center p-4`}>
        <div className="w-16 h-16 rounded-3xl bg-white/80 border border-slate-200/80 flex items-center justify-center mb-4 animate-pulse shadow-sm">
          <Gift className="w-8 h-8 animate-bounce" style={{ color: v?.accentColor || '#2563eb' }} />
        </div>
        <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Opening Digital Lifafa...</p>
        <span className="text-xs font-mono mt-1 font-bold" style={{ color: v?.accentColor || '#2563eb' }}>{code.toUpperCase()}</span>
      </div>
    );
  }

  // State B: Not Found / Invalid Code
  if (notFound || !lifafa) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#E8F1FD] to-[#F3F8FF] text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Lifafa Not Found</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              We couldn't locate any active digital Lifafa with code{' '}
              <span className="font-mono text-rose-600 font-bold">{code.toUpperCase()}</span>.
              Please check the link and try again.
            </p>
          </div>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
            >
              Go to Createlifafa.xyz Home
            </button>
          )}
        </div>
      </div>
    );
  }

  // Calculate dynamic stats
  const perUserAmount = (lifafa.total_amount / (lifafa.winner_count || 1)).toFixed(
    lifafa.total_amount % (lifafa.winner_count || 1) === 0 ? 0 : 2
  );
  const remainingWinners = Math.max(0, (lifafa.winner_count || 0) - (lifafa.claimed_count || 0));
  const progressPct = Math.min(
    100,
    Math.max(4, Math.round((lifafa.claimed_count / (lifafa.winner_count || 1)) * 100))
  );

  return (
    <ThemeProvider themeId={resolvedThemeId}>
      <div className={`min-h-screen relative overflow-x-hidden ${v.pageBackground} flex flex-col items-center justify-between p-3 sm:p-5 selection:bg-blue-500 selection:text-white`}>
        {/* Subtle Ambient Decorative Watermark Texts - Matching Reference Style */}
        <div className="pointer-events-none select-none fixed inset-0 overflow-hidden z-0">
          <span className={`absolute bottom-6 left-4 ${v.ambientTextColor || 'text-slate-400/40'} text-xs font-bold tracking-wider`}>
            {v.ambientTextLeft}
          </span>
          <span className={`absolute bottom-6 right-4 ${v.ambientTextColor || 'text-slate-400/40'} text-xs font-bold tracking-wider`}>
            {v.ambientTextRight}
          </span>
          {v.ambientTextRotated && (
            <span className={`absolute top-1/2 right-3 -translate-y-1/2 rotate-90 ${v.ambientTextColor || 'text-slate-400/30'} text-[11px] font-semibold tracking-widest hidden md:inline-block`}>
              {v.ambientTextRotated}
            </span>
          )}
        </div>

        {/* 1. Header matching Reference: Back Button (<) | Join & Claim 🎁 | How it works? */}
        <header className="relative z-10 w-full max-w-md flex items-center justify-between py-2 pt-1">
          {/* Circular Back Button */}
          <div className="w-12 flex items-center justify-start">
            {onNavigateHome ? (
              <button
                type="button"
                onClick={onNavigateHome}
                className={`w-10 h-10 rounded-full ${isDark ? 'bg-slate-800/90 text-white border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'} shadow-xs border flex items-center justify-center transition-all cursor-pointer`}
                title="Back to home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10 h-10" />
            )}
          </div>

          {/* Centered Title & Subtitle */}
          <div className="text-center px-1">
            <h1 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight flex items-center justify-center gap-1.5`}>
              <span>Join &amp;</span>
              <span style={{ color: v.accentColor }}>Claim</span>
              <span>{v.emoji}</span>
            </h1>
            <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-500'} font-medium`}>
              Complete all steps to unlock your Lifafa
            </p>
          </div>

          {/* Right: How It Works Pill Button */}
          <div className="w-auto flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowHowItWorks(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${isDark ? 'bg-slate-800/90 text-white border-slate-700 hover:bg-slate-700' : 'bg-white/90 text-slate-700 border-slate-200/90 hover:bg-white'} border text-xs font-semibold shadow-2xs transition-all cursor-pointer`}
            >
              <HelpCircle className="w-3.5 h-3.5" style={{ color: v.accentColor }} />
              <span className="hidden sm:inline">How it works?</span>
              <span className="sm:hidden">Help</span>
            </button>
          </div>
        </header>

        {/* 2. Main Centered Lifafa Experience Card */}
        <main className="relative z-10 w-full max-w-md my-auto py-2 space-y-4">
          {/* Flow Branch 1: Claimed Success State with Themed Reward Reveal */}
          {claimResult ? (
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center space-y-5 animate-in zoom-in-95 duration-300">
              <div className="relative mx-auto w-28 h-28">
                <img
                  src={v.heroArtwork}
                  alt="Reward Unlocked"
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

              {/* Amount Display */}
              <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/70 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">
                  Reward Amount
                </span>
                <span className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: v.accentColor }}>
                  {formatCurrency(claimResult.amount)}
                </span>
                <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {claimResult.payoutMode === 'UPI_BANK'
                      ? 'Dispatched directly to Bank Account!'
                      : 'Credited instantly to your CreatLifafa Wallet!'}
                  </span>
                </p>
              </div>

              {/* Share & Home Actions */}
              <div className="space-y-2 pt-1">
                {onOpenShare ? (
                  <button
                    type="button"
                    onClick={() => onOpenShare(lifafa)}
                    className={`w-full py-3.5 ${v.ctaGradient} text-white font-bold rounded-2xl text-xs shadow-md ${v.ctaShadow} flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer`}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share This Lifafa With Friends</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    className={`w-full py-3.5 ${v.ctaGradient} text-white font-bold rounded-2xl text-xs shadow-md ${v.ctaShadow} flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer`}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Lifafa Share Link'}</span>
                  </button>
                )}

                {onNavigateHome && (
                  <button
                    type="button"
                    onClick={onNavigateHome}
                    className="w-full py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Back to Home
                  </button>
                )}
              </div>
            </div>
          ) : isCompleted ? (
            /* Flow Branch 2: Fully Claimed */
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
                  className={`w-full py-3 ${v.ctaGradient} text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm`}
                >
                  Explore More Lifafas
                </button>
              )}
            </div>
          ) : isExpired ? (
            /* Flow Branch 3: Expired Lifafa */
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
                  className={`w-full py-3 ${v.ctaGradient} text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm`}
                >
                  Explore Active Lifafas
                </button>
              )}
            </div>
          ) : (
            /* Flow Branch 4: Primary Claim Page - Matching Reference Screenshot 5 */
            <div className="space-y-4">
              {/* PRIMARY THEMED HERO CARD */}
              <div className={`${v.heroGradient} rounded-3xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden space-y-4`}>
                {/* Top Half: Left Title/Message + Right 3D Theme Gift Artwork */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/80 block">
                      {v.heroTagLabel}
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

                  {/* 3D Theme Gift Artwork */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
                    <img
                      src={v.heroArtwork}
                      alt={lifafa.title}
                      className="w-full h-full object-contain rounded-2xl drop-shadow-2xl"
                    />
                  </div>
                </div>

                {/* Bottom Half: 4-Stat Metric Box + Dual Progress Bar */}
                <div className="bg-white text-slate-800 rounded-2xl p-3 shadow-md">
                  <div className="grid grid-cols-4 gap-2 text-center divide-x divide-slate-100">
                    {/* Stat 1: Total Users */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Users className="w-3 h-3" style={{ color: v.accentColor }} />
                        <span>Total Users</span>
                      </div>
                      <span className="text-sm sm:text-base font-black text-slate-900 block">
                        {lifafa.winner_count}
                      </span>
                    </div>

                    {/* Stat 2: Per User */}
                    <div className="space-y-0.5 pl-1">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span className="text-xs font-bold text-emerald-600">₹</span>
                        <span>Per User</span>
                      </div>
                      <span className="text-sm sm:text-base font-black text-emerald-600 block">
                        ₹{perUserAmount}
                      </span>
                    </div>

                    {/* Stat 3: Claimed */}
                    <div className="space-y-0.5 pl-1">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Gift className="w-3 h-3 text-purple-500" />
                        <span>Claimed</span>
                      </div>
                      <span className="text-sm sm:text-base font-black text-purple-600 block">
                        {lifafa.claimed_count}
                      </span>
                    </div>

                    {/* Stat 4: Remaining */}
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

                  {/* Dual Progress Bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${v.progressBarFill} rounded-full transition-all duration-500 shadow-xs`}
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

              {/* Error Message Banner */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* SECTION: Join Required Channels Header matching Reference */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-xl ${v.channelHeaderIconBg} flex items-center justify-center shrink-0 shadow-xs`}>
                      <Send className="w-4 h-4 -rotate-12" />
                    </div>
                    <div>
                      <h3 className={`text-sm sm:text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-900'} leading-tight`}>
                        Join Required Channels
                      </h3>
                      <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                        Join all channels below to unlock the claim button
                      </p>
                    </div>
                  </div>

                  {/* Theme Badge: Complete All Steps */}
                  <div className="shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${v.channelHeaderBadgeBg} text-[11px] font-bold shadow-2xs`}>
                      <span>{v.emoji}</span>
                      <span>Complete All Steps</span>
                    </span>
                  </div>
                </div>

                {/* Numbered Task Cards */}
                <div className="space-y-2.5">
                  {tasks.length > 0 ? (
                    tasks.map((t, idx) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        isCompleted={completedTaskIds.has(t.id)}
                        onCompleted={handleTaskDone}
                        onOpenAuth={onOpenAuth}
                        taskNumber={idx + 1}
                      />
                    ))
                  ) : (
                    <div className="p-4 bg-white border border-slate-100 rounded-2xl text-center text-xs text-slate-500">
                      No mandatory tasks required for this Lifafa. You can claim directly below!
                    </div>
                  )}
                </div>
              </div>

              {/* Security PIN Code Input if required */}
              {Boolean(lifafa.pin_code) && (
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

              {/* Direct Bank Settlement Form if lifafa payout_mode is UPI_BANK */}
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

              {/* STICKY / FLOATING CTA SECTION MATCHING REFERENCE */}
              <div className="pt-2 sticky bottom-3 z-30 pb-1">
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className={`w-full py-4 px-6 ${v.ctaGradient} active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-2xl shadow-xl ${v.ctaShadow} transition-all flex items-center justify-center gap-2 cursor-pointer`}
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

                {/* Trust and Safety Notice below button matching Reference */}
                <div className={`flex items-center justify-center gap-1.5 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-500'} text-center mt-2.5`}>
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: v.accentColor }} />
                  <span>We check if you have joined all channels. Don't worry, it's 100% safe!</span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* 3. Subtle Standalone Footer */}
        <footer className={`relative z-10 w-full max-w-md text-center py-3 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center justify-between`}>
          <span>© {new Date().getFullYear()} Createlifafa.xyz</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>India's Modern Digital Gifting</span>
          </span>
        </footer>

        {/* How It Works Modal Dialog */}
        {showHowItWorks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{v.emoji}</span>
                  <h3 className="text-base font-black text-slate-900">How to Claim Lifafa</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHowItWorks(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">Join Required Channels</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tap "Join Now" for each channel listed in the tasks.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">Verify Your Membership</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Connect your Telegram account once to automatically verify channel membership.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">Verify &amp; Claim Lifafa</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tap the "Verify &amp; Claim Lifafa" button at the bottom.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">Instant Cash Reward</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Your reward is credited immediately to your CreatLifafa wallet or bank account!
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className={`w-full py-3 ${v.ctaGradient} text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm`}
              >
                Got It, Let's Claim!
              </button>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
};
