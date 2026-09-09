import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Lifafa, LifafaTask } from '../../types/database';
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
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  lifafa,
  isOpen,
  onClose,
  onSuccessClaim,
  onOpenShare,
}) => {
  const { user, refreshWallet } = useAuth();
  const [pinCode, setPinCode] = useState('');
  const [tasks, setTasks] = useState<LifafaTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<{ amount: number; code: string } | null>(null);
  const [isEnvelopeOpened, setIsEnvelopeOpened] = useState(false);

  useEffect(() => {
    if (isOpen && lifafa) {
      setPinCode('');
      setErrorMsg(null);
      setClaimResult(null);
      setIsEnvelopeOpened(false);

      // Load tasks
      setLoadingTasks(true);
      lifafaService
        .getLifafaTasks(lifafa.id)
        .then((fetchedTasks) => {
          setTasks(fetchedTasks);
          if (user) {
            taskService.getUserTaskCompletions(lifafa.id, user.id).then((completions) => {
              const verified = new Set(
                completions.filter((c) => c.status === 'VERIFIED').map((c) => c.task_id)
              );
              setCompletedTaskIds(verified);
            });
          }
        })
        .finally(() => setLoadingTasks(false));
    }
  }, [isOpen, lifafa, user]);

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
        idempotencyKey
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
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
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Credited {formatCurrency(claimResult.amount)} directly to your Lifafa Wallet!</span>
              </div>

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

                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isCompleted={completedTaskIds.has(task.id)}
                        onCompleted={handleTaskDone}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Break Seal & Claim Cash Action Button */}
              <button
                onClick={handleClaim}
                disabled={claiming || isExpired || !allRequiredDone}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Validating &amp; Crediting Wallet...</span>
                  </>
                ) : isExpired ? (
                  <span>Lifafa Has Expired</span>
                ) : !allRequiredDone ? (
                  <span>Complete Verified Tasks to Claim</span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Break Seal &amp; Claim Cash</span>
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
