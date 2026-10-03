import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Wallet,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Landmark,
  User,
  CreditCard,
  Eye,
  EyeOff,
  Clock,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { walletService } from '../../services/walletService';
import { formatCurrency } from '../../lib/utils';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose }) => {
  const { user, wallet, refreshWallet } = useAuth();
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const activeIdempotencyKeyRef = useRef<string | null>(null);

  const [withdrawableData, setWithdrawableData] = useState<{
    available_balance: number;
    blocked_balance: number;
    withdrawable_balance: number;
  }>({
    available_balance: wallet?.available_balance ?? 0,
    blocked_balance: 0,
    withdrawable_balance: wallet?.available_balance ?? 0,
  });

  const handleClose = () => {
    activeIdempotencyKeyRef.current = null;
    setErrorMsg(null);
    setLoading(false);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      activeIdempotencyKeyRef.current = null;
      let isMounted = true;
      walletService
        .getWithdrawableBalance()
        .then((res) => {
          if (isMounted) {
            setWithdrawableData(res);
          }
        })
        .catch((e) => {
          console.error('Failed to fetch withdrawable balance', e);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, wallet?.available_balance]);

  if (!isOpen) return null;

  const availableBalance = wallet?.available_balance ?? 0;
  const effectiveWithdrawable = withdrawableData.withdrawable_balance;
  const numAmount = parseFloat(amount) || 0;
  const FIXED_FEE = 3.58;
  const totalDeduction = numAmount > 0 ? Math.round((numAmount + FIXED_FEE) * 100) / 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Strict double-click guard
    setErrorMsg(null);

    if (numAmount < 10) {
      setErrorMsg('Minimum withdrawal amount is ₹10.00.');
      return;
    }

    if (numAmount > 1000) {
      setErrorMsg('Maximum withdrawal amount is ₹1,000.00.');
      return;
    }

    if (totalDeduction > effectiveWithdrawable) {
      if (withdrawableData.blocked_balance > 0) {
        setErrorMsg(
          `Withdrawal exceeds your eligible balance. You need ${formatCurrency(totalDeduction)} (${formatCurrency(numAmount)} payout + ₹${FIXED_FEE} platform fee), but only have ${formatCurrency(effectiveWithdrawable)} eligible for withdrawal (${formatCurrency(withdrawableData.blocked_balance)} is currently restricted under Lifafa withdrawal policy).`
        );
      } else {
        setErrorMsg(
          `Insufficient available balance. You need ${formatCurrency(totalDeduction)} (${formatCurrency(numAmount)} payout + ₹${FIXED_FEE} platform fee), but only have ${formatCurrency(availableBalance)}.`
        );
      }
      return;
    }

    const cleanUpi = upiId.trim().toLowerCase();
    if (!cleanUpi) {
      setErrorMsg('UPI ID is required.');
      return;
    }
    if (!/^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      setErrorMsg('Please enter a valid UPI ID (e.g. username@bank).');
      return;
    }

    try {
      setLoading(true);
      // Preserve idempotency key across retries of this exact withdrawal attempt
      if (!activeIdempotencyKeyRef.current) {
        activeIdempotencyKeyRef.current = `wth_${user?.id || 'usr'}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
      const idempotencyKey = activeIdempotencyKeyRef.current;

      const result = await walletService.requestWithdrawal(
        {
          amount: numAmount,
          payoutMethod: 'UPI',
          upiId: cleanUpi,
          accountHolderName: user?.full_name || 'Beneficiary',
        },
        idempotencyKey
      );

      // On definitive outcome or success, clear active idempotency key
      activeIdempotencyKeyRef.current = null;
      await refreshWallet();
      setSuccessData(result);
    } catch (err: any) {
      // Keep activeIdempotencyKeyRef intact for retry so server deduplicates if it reached backend
      setErrorMsg(err.message || 'Failed to process withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Secure Hero Header */}
        <div className="relative bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white p-6 overflow-hidden">
          {/* Subtle Decorative Backdrop Elements */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />

          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative z-10 flex items-start gap-4">
            <img
              src="/images/withdrawal_bank_hero.jpg"
              alt="Bank Security"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl shadow-lg border border-white/20 shrink-0 bg-white/10 p-1"
            />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Secure &amp; Safe Direct Payout</span>
              </div>

              <h3 className="text-xl font-black">Withdraw Funds</h3>
              <p className="text-xs text-blue-100/90 leading-relaxed">
                Instant automated UPI transfers. Flat platform fee ₹3.58.
              </p>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-white/15">
                <span className="text-blue-200">Withdrawable Balance:</span>
                <strong className="text-white font-mono text-sm font-black">
                  {formatCurrency(effectiveWithdrawable)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Restricted Funds Notice Banner */}
        {withdrawableData.blocked_balance > 0 && !successData && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Lifafa Withdrawal Restriction</span>
              <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                {formatCurrency(withdrawableData.blocked_balance)} of your balance is currently restricted from withdrawal under Lifafa policy. You can withdraw up to <strong>{formatCurrency(withdrawableData.withdrawable_balance)}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* TRUTHFUL BACKEND STATUS VIEW */}
        {successData ? (
          <div className="p-6 text-center space-y-4">
            {/* 3D Success Podium Visual */}
            <div className="relative mx-auto w-28 h-28 sm:w-32 sm:h-32 mb-1">
              <img
                src="/images/withdrawal_success_podium.jpg"
                alt="Withdrawal Success Podium"
                className="w-full h-full object-contain rounded-2xl drop-shadow-lg"
              />
            </div>

            <div>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase mb-1.5 ${
                  successData.status === 'SUCCESS'
                    ? 'bg-emerald-100 text-emerald-800'
                    : successData.status === 'FAILED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                <span>Status: {successData.status || 'PROCESSING'}</span>
              </div>

              <h4 className="text-lg font-black text-slate-900">
                {successData.status === 'SUCCESS'
                  ? 'Withdrawal Dispatched Successfully!'
                  : successData.status === 'FAILED'
                  ? 'Withdrawal Failed'
                  : 'Payout In Progress (UPI)'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {successData.status === 'SUCCESS'
                  ? `Your transfer of ${formatCurrency(numAmount)} has been credited.`
                  : successData.status === 'FAILED'
                  ? (successData.error_message || 'The payout could not be processed. Your wallet funds were not deducted.')
                  : `Your transfer of ${formatCurrency(numAmount)} has been submitted to the banking network via PayNit UPI. Amount will be credited to your account within minutes.`}
              </p>
            </div>

            {/* Breakdown summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Payout Method:</span>
                <span className="font-bold text-slate-900">UPI Transfer</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Beneficiary UPI ID:</span>
                <span className="font-mono font-bold text-slate-900">{upiId.trim().toLowerCase()}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1.5 border-t border-slate-200">
                <span>Net Transfer Amount:</span>
                <span className="font-bold text-emerald-700 text-sm">{formatCurrency(numAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Platform Fee:</span>
                <span>₹{FIXED_FEE.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-xs pt-1 border-t border-slate-200">
                <span>Total Deducted:</span>
                <span className="text-blue-600">{formatCurrency(totalDeduction)}</span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-md text-xs cursor-pointer transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* WITHDRAWAL FORM (UPI ONLY) */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Withdrawal Amount */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Withdrawal Amount (₹) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  Min ₹10 • Max ₹1,000
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
                  required
                />
              </div>
            </div>

            {/* Beneficiary UPI ID */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Beneficiary UPI ID <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  Instant Payout
                </span>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3 w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center pointer-events-none text-xs font-black">
                  @
                </div>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.trim())}
                  placeholder="e.g. mobile@upi or name@okaxis"
                  className="w-full pl-11 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all [color-scheme:light]"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Funds will be deposited directly to your UPI linked bank account via PayNit.
              </p>
            </div>

            {/* Dynamic Fee & Payout Breakdown */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
              <div className="flex justify-between items-center text-slate-600">
                <span>Beneficiary Payout:</span>
                <span className="font-bold text-slate-900">{formatCurrency(numAmount || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Fixed Platform Fee:</span>
                <span className="font-bold text-slate-900">₹{FIXED_FEE.toFixed(2)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                <span>Total Wallet Deduction:</span>
                <span className="text-blue-600">{formatCurrency(totalDeduction)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || availableBalance < totalDeduction || numAmount < 10}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                'Processing Payout Request...'
              ) : numAmount >= 10 ? (
                `⚡ Withdraw ${formatCurrency(numAmount)} via UPI`
              ) : (
                'Enter Amount (Min ₹10)'
              )}
            </button>

            {/* Security Footnote */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 justify-center pt-1">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Your payment details are safe with us. We do not share your information with anyone.</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
