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
import { ThemeProvider } from '../../themes/ThemeContext';
import { getTheme } from '../../themes/registry';
import { resolveThemeId } from '../../themes/useThemeResolver';

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
                (completions || [])
                  .filter((c) => ['VERIFIED', 'CLICK_CONFIRMED', 'USER_CONFIRMED'].includes(c.status))
                  .map((c) => c.task_id)
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

  const resolvedThemeId = resolveThemeId(typeof window !== 'undefined' ? window.location.search : '', lifafa);
  const theme = getTheme(resolvedThemeId);
  const { isExpired, formatted: timeLeft } = formatTimeRemaining(lifafa.expires_at);
  const isCompleted = Boolean(
    lifafa.status === 'COMPLETED' || lifafa.claimed_count >= lifafa.winner_count
  );
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
      <ThemeProvider themeId={resolvedThemeId}>
        <div className={`relative w-full max-w-md ${theme.colors.cardBackground} rounded-3xl shadow-2xl border ${theme.colors.cardBorder} overflow-hidden my-4 max-h-[92vh] flex flex-col`}>
          {/* Top Header Bar */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-theme-heading)' }}>
                <span>{theme.badge}</span>
                <span>•</span>
                <span>{claimResult ? 'Reward Claimed!' : 'Open Digital Lifafa'}</span>
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable Modal Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
            {/* Themed Envelope Visual Experience */}
            <theme.components.Envelope
              lifafa={lifafa}
              isEnvelopeOpened={isEnvelopeOpened || Boolean(claimResult)}
              onUnsealEnvelope={() => setIsEnvelopeOpened(true)}
              claimedAmount={claimResult?.amount}
              timeLeft={timeLeft}
              isExpired={isExpired}
            />

            {claimResult ? (
              <theme.components.RewardReveal
                amount={claimResult.amount}
                code={claimResult.code}
                payoutMode={claimResult.payoutMode || lifafa.payout_mode || 'WALLET'}
                lifafa={lifafa}
                onOpenShare={onOpenShare}
                onClose={onClose}
              />
            ) : isCompleted ? (
              <theme.components.FullyClaimedView
                lifafa={lifafa}
                onNavigateHome={onClose}
              />
            ) : isExpired ? (
              <theme.components.ExpiredView
                lifafa={lifafa}
                onNavigateHome={onClose}
              />
            ) : isEnvelopeOpened ? (
              <theme.components.ClaimSection
                lifafa={lifafa}
                user={user}
                isEnvelopeOpened={isEnvelopeOpened}
                pinCode={pinCode}
                setPinCode={setPinCode}
                requiresPin={Boolean(lifafa.pin_code)}
                accountHolderName={accountHolderName}
                setAccountHolderName={setAccountHolderName}
                bankAccountNumber={bankAccountNumber}
                setBankAccountNumber={setBankAccountNumber}
                ifscCode={ifscCode}
                setIfscCode={setIfscCode}
                upiId={upiId}
                setUpiId={setUpiId}
                tasks={tasks}
                completedTaskIds={completedTaskIds}
                allRequiredDone={allRequiredDone}
                onTaskDone={handleTaskDone}
                onOpenAuth={onOpenAuth || (() => {})}
                onClaim={handleClaim}
                claiming={claiming}
                errorMsg={errorMsg}
              />
            ) : (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsEnvelopeOpened(true)}
                  className="w-full py-3.5 px-4 text-white font-bold rounded-2xl text-xs shadow-lg active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: theme.colors.envelopePrimary,
                    fontFamily: 'var(--font-theme-heading)',
                  }}
                >
                  <Gift className="w-4 h-4" />
                  <span>Tap Envelope or Click Here to Open</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
};
