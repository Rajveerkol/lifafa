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
    const shareUrl = `${window.location.origin}/claim/${code.toUpperCase()}`;
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 selection:bg-blue-500 selection:text-white">
      {/* 1. Subtle Standalone Header */}
      <header className="w-full max-w-md flex items-center justify-between py-2 pt-3">
        <div className="w-20 flex items-center justify-start">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer group"
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
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 whitespace-nowrap">
            {lifafa.code}
          </span>
        </div>
      </header>

      {/* 2. Main Centered Lifafa Experience Card */}
      <main className="w-full max-w-md my-auto py-4">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden p-4 sm:p-6 space-y-5">
          {/* Lifafa Meta Banner */}
          <div className="text-center space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wide">
              {lifafa.distribution_type === 'RANDOM' ? '🎲 Random Lucky Drop' : '⚡ Equal Split Gift'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {lifafa.title}
            </h1>
            {lifafa.message && (
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto italic">
                "{lifafa.message}"
              </p>
            )}
          </div>

          {/* Digital Envelope Visual */}
          <div className="py-1">
            <DigitalEnvelope
              lifafa={lifafa}
              isEnvelopeOpened={isEnvelopeOpened || Boolean(claimResult)}
              onUnsealEnvelope={() => setIsEnvelopeOpened(true)}
              claimedAmount={claimResult?.amount}
            />
          </div>

          {/* Key Stats Pill */}
          <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-center">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Pool</span>
              <span className="text-xs font-black text-white">{formatCurrency(lifafa.total_amount)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Winners</span>
              <span className="text-xs font-bold text-slate-300">
                {lifafa.claimed_count}/{lifafa.winner_count}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Status</span>
              <span className={`text-xs font-bold ${
                isCompleted
                  ? 'text-amber-400'
                  : isExpired
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}>
                {isCompleted ? 'Full' : isExpired ? 'Expired' : 'Active'}
              </span>
            </div>
          </div>

          {/* Flow Branch 1: Claimed Success State */}
          {claimResult ? (
            <div className="text-center space-y-4 pt-1 animate-in fade-in zoom-in-95 duration-300">
              {claimResult.payoutMode === 'UPI_BANK' ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 space-y-1.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Payout Initiated!</span>
                  </div>
                  <p className="text-xs font-bold text-white">
                    {formatCurrency(claimResult.amount)} submitted for direct payout.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Funds will be disbursed to your specified bank account or UPI ID shortly.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Credited {formatCurrency(claimResult.amount)} directly to your CreatLifafa Wallet!</span>
                </div>
              )}

              {alreadyClaimed && !claiming && (
                <div className="text-[11px] text-slate-400 font-medium">
                  You already claimed your reward from this Lifafa.
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-lg shadow-blue-500/25 active:scale-98 transition-all cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Claim Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Share This Lifafa with Friends</span>
                    </>
                  )}
                </button>

                {onNavigateHome && (
                  <button
                    type="button"
                    onClick={onNavigateHome}
                    className="w-full py-2.5 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Explore More Digital Lifafas
                  </button>
                )}
              </div>
            </div>
          ) : isCompleted ? (
            /* Flow Branch 2: Fully Claimed (Out of claims) */
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">All Gifts Claimed</h4>
              <p className="text-xs text-slate-400">
                All {lifafa.winner_count} lucky rewards for this Lifafa have already been distributed.
              </p>
              {onNavigateHome && (
                <button
                  onClick={onNavigateHome}
                  className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  Explore active Lifafas on CreatLifafa
                </button>
              )}
            </div>
          ) : isExpired ? (
            /* Flow Branch 3: Expired Lifafa */
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Lifafa Has Expired</h4>
              <p className="text-xs text-slate-400">
                This digital gift expired on {new Date(lifafa.expires_at).toLocaleDateString()}.
              </p>
              {onNavigateHome && (
                <button
                  onClick={onNavigateHome}
                  className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  Explore active Lifafas on CreatLifafa
                </button>
              )}
            </div>
          ) : isEnvelopeOpened ? (
            /* Flow Branch 4: Pre-Claim Action Steps (Tasks, PIN, Payout Details) */
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2 text-xs text-rose-400 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Unauthenticated Claimant Prompt */}
              {!user && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-2.5 text-xs text-blue-200">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Sign in with Google to claim your reward</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Authenticate securely to verify channel tasks and deposit your earnings safely.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-blue-500/25"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}

              {/* PIN Code Input if configured */}
              {lifafa.pin_code && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Secret PIN Required</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="Enter 4-6 digit PIN"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-center tracking-widest text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              )}

              {/* Tasks List */}
              {tasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Required Tasks ({completedTaskIds.size}/{requiredTasks.length})
                    </span>
                    {allRequiredDone && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> All Required Tasks Complete
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isCompleted={completedTaskIds.has(task.id)}
                        onCompleted={handleTaskDone}
                        onOpenAuth={onOpenAuth}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* UPI / Bank Details Input if in UPI_BANK mode */}
              {lifafa.payout_mode === 'UPI_BANK' && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Direct Payout Information</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Instant Bank / UPI
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
                      placeholder="Name registered with your bank"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-hidden focus:border-blue-500"
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
                        placeholder="e.g. 123456789012"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-blue-500"
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
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono uppercase text-white focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. name@okhdfcbank"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    * Provide Bank Account + IFSC, or your active UPI ID.
                  </p>
                </div>
              )}

              {/* Main Claim Button */}
              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming || isExpired || !allRequiredDone}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Unwrapping Digital Lifafa...</span>
                  </>
                ) : isExpired ? (
                  <span>Lifafa Has Expired</span>
                ) : !allRequiredDone ? (
                  <span>Complete Required Tasks to Claim</span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Claim Digital Lifafa</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Flow Branch 5: Initial Unsealed Callout */
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsEnvelopeOpened(true)}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-blue-500/25 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Gift className="w-4 h-4" />
                <span>Tap Envelope or Click Here to Open</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 3. Subtle Standalone Footer */}
      <footer className="w-full max-w-md text-center py-3 text-[11px] text-slate-500 flex items-center justify-between">
        <span>© {new Date().getFullYear()} CreatLifafa</span>
        <span className="flex items-center gap-1 text-slate-400">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>India's Modern Digital Gifting</span>
        </span>
      </footer>
    </div>
  );
};
