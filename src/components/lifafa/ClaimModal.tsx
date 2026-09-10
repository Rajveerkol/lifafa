import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Gift,
  Lock,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Share2,
  Loader2,
  ShieldCheck,
  Landmark,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Lifafa, LifafaTask, PayoutMode } from '../../types/database';
import { lifafaService } from '../../services/lifafaService';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { fraudService } from '../../services/fraudService';
import { TaskCard } from './TaskCard';
import { DigitalEnvelope } from './DigitalEnvelope';
import { formatCurrency, formatTimeRemaining } from '../../lib/utils';

interface ClaimModalProps {
  lifafa: Lifafa | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccessClaim?: () => void;
  onOpenShare?: (lifafa: Lifafa) => void;
  onOpenAuth?: () => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  lifafa,
  isOpen,
  onClose,
  onSuccessClaim,
  onOpenShare,
  onOpenAuth,
}) => {
  const { user, refreshWallet } = useAuth();
  const [pinCode, setPinCode] = useState('');
  const [tasks, setTasks] = useState<LifafaTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<{ amount: number; code: string; payoutMode?: PayoutMode } | null>(null);
  const [isEnvelopeOpened, setIsEnvelopeOpened] = useState(false);

  // UPI / Bank Payout Details State
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  const lifafaId = lifafa?.id;
  const userId = user?.id;

  // Track the lifafa being viewed so returning from external apps/Telegram
  // or window focus/auth token refreshes never reset an unsealed envelope.
  const prevLifafaIdRef = useRef<string | null>(null);
  const prevIsOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen && lifafaId) {
      if (!prevIsOpenRef.current || prevLifafaIdRef.current !== lifafaId) {
        setPinCode('');
        setErrorMsg(null);
        setClaimResult(null);
        setIsEnvelopeOpened(false);
        setAccountHolderName('');
        setBankAccountNumber('');
        setIfscCode('');
        setUpiId('');
      }
      prevIsOpenRef.current = true;
      prevLifafaIdRef.current = lifafaId;
    } else if (!isOpen) {
      prevIsOpenRef.current = false;
      prevLifafaIdRef.current = null;
    }
  }, [isOpen, lifafaId]);

  // Load tasks and user task completions without resetting envelope unsealed state
  useEffect(() => {
    if (isOpen && lifafaId) {
      setLoadingTasks(true);
      lifafaService
        .getLifafaTasks(lifafaId)
        .then((fetchedTasks) => {
          setTasks(fetchedTasks);
          if (userId) {
            lifafaService.getUserClaimForLifafa(lifafaId, userId).then((existingClaim) => {
              if (existingClaim) {
                setClaimResult({
                  amount: existingClaim.amount,
                  code: lifafa.code,
                  payoutMode: existingClaim.payout_mode || lifafa.payout_mode || 'WALLET',
                });
                setIsEnvelopeOpened(true);
              }
            });

            taskService.getUserTaskCompletions(lifafaId, userId).then((completions) => {
              const verified = new Set(
                completions.filter((c) => c.status === 'VERIFIED').map((c) => c.task_id)
              );
              setCompletedTaskIds(verified);
            });
          }
        })
        .finally(() => setLoadingTasks(false));
    }
  }, [isOpen, lifafaId, userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !lifafa) return null;

  const { isExpired } = formatTimeRemaining(lifafa.expires_at);
  const requiredTasks = tasks.filter((t) => t.is_required && t.is_enabled);
  const allRequiredDone = requiredTasks.every((t) => completedTaskIds.has(t.id));

  const handleTaskDone = (taskId: string) => {
    setCompletedTaskIds((prev) => new Set([...prev, taskId]));
  };

  const handleClaim = async () => {
    if (!user) {
      setErrorMsg('Please login to claim this Lifafa.');
      return;
    }

    if (lifafa.pin_code && !pinCode.trim()) {
      setErrorMsg('PIN code is required to claim this Lifafa.');
      return;
    }

    if (!allRequiredDone) {
      setErrorMsg('Please complete and verify all required tasks above.');
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
        particleCount: 140,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#2563eb', '#fbbf24', '#e11d48', '#10b981', '#6366f1'],
      });

      setClaimResult({
        amount: res.amount,
        code: lifafa.code,
        payoutMode: res.payout_mode || lifafa.payout_mode || 'WALLET',
      });

      await refreshWallet();
      if (onSuccessClaim) onSuccessClaim();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to claim Lifafa');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Top Header Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-800">
              {claimResult ? 'Reward Claimed!' : 'Open Digital Lifafa'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Digital Envelope Visual Experience */}
          <DigitalEnvelope
            lifafa={lifafa}
            isEnvelopeOpened={isEnvelopeOpened || Boolean(claimResult)}
            onUnsealEnvelope={() => setIsEnvelopeOpened(true)}
            claimedAmount={claimResult?.amount}
          />

          {claimResult ? (
            /* Celebration Action State */
            <div className="text-center space-y-3 pt-2">
              {claimResult.payoutMode === 'UPI_BANK' ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-1.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-black">Payout Initiated!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-semibold">
                    {formatCurrency(claimResult.amount)} payout request submitted. Status:{' '}
                    <span className="font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200">
                      Pending Processing
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-normal">
                    Your reward will be transferred directly to your bank/UPI account. You can track progress in your Wallet under Withdrawals.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Credited {formatCurrency(claimResult.amount)} directly to your CreatLifafa Wallet!</span>
                </div>
              )}

              <div className="space-y-2">
                {onOpenShare && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenShare(lifafa);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-blue-500/25 active:scale-98 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share This Lifafa with Friends</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-slate-600 hover:text-slate-900 text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          ) : isEnvelopeOpened ? (
            /* Pre-claim Tasks & Verification */
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Login required prompt if not authenticated */}
              {!user && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {lifafa.payout_mode === 'UPI_BANK'
                        ? 'Login required to claim reward and receive payout'
                        : 'Login required to receive reward in your CreatLifafa Wallet'}
                    </span>
                  </div>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Sign In with Google
                    </button>
                  )}
                </div>
              )}

              {/* PIN Code Input if configured */}
              {lifafa.pin_code && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Enter Secret PIN Code *</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="Enter 4-6 digit PIN"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-center tracking-widest focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              )}

              {/* Tasks Checklist */}
              {tasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Required Tasks ({completedTaskIds.size}/{requiredTasks.length})
                    </span>
                    {allRequiredDone && (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> All Verified
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
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

              {/* UPI / Bank Details Input for UPI_BANK Payout Mode */}
              {lifafa.payout_mode === 'UPI_BANK' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Payout Details (Bank / UPI)</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Direct Payout
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      placeholder="Name as per bank account"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder="e.g. 123456789012"
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
                        placeholder="e.g. SBIN0001234"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    * Provide either Bank Account Number + IFSC, or your active UPI ID.
                  </p>
                </div>
              )}

              {/* Main Action: Claim Lifafa Button */}
              <button
                onClick={handleClaim}
                disabled={claiming || isExpired || !allRequiredDone}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Claiming Lifafa...</span>
                  </>
                ) : isExpired ? (
                  <span>Lifafa Has Expired</span>
                ) : !allRequiredDone ? (
                  <span>Complete Required Tasks to Claim</span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Claim Lifafa</span>
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
