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
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { walletService } from '../../services/walletService';
import { calculateWithdrawalFee } from '../../lib/feeCalculations';
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
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [activeProcessingWth, setActiveProcessingWth] = useState<any | null>(null);
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
    setCheckingStatus(false);
    setActiveProcessingWth(null);
    onClose();
  };

  const handleCheckStatus = async (targetId?: string) => {
    const idToCheck = targetId || successData?.withdrawal_id || successData?.id || activeProcessingWth?.id;
    if (!idToCheck) return;

    try {
      setCheckingStatus(true);
      const res = await walletService.checkWithdrawalStatus(idToCheck);
      if (res && res.status) {
        if (res.status === 'SUCCESS') {
          setSuccessData((prev: any) => ({
            ...(prev || {}),
            status: 'SUCCESS',
            amount: prev?.amount || res.withdrawal?.amount,
            net_amount: prev?.net_amount || res.withdrawal?.net_amount,
            fee_amount: prev?.fee_amount || res.withdrawal?.fee_amount,
            upi_id: prev?.upi_id || res.withdrawal?.upi_id,
            reference_id: res.reference_id || prev?.reference_id,
            order_id: res.order_id || prev?.order_id,
          }));
          setActiveProcessingWth(null);
          await refreshWallet();
        } else if (res.status === 'FAILED' || res.status === 'REJECTED') {
          setSuccessData((prev: any) => ({
            ...(prev || {}),
            status: 'FAILED',
            amount: prev?.amount || res.withdrawal?.amount,
            net_amount: prev?.net_amount || res.withdrawal?.net_amount,
            fee_amount: prev?.fee_amount || res.withdrawal?.fee_amount,
            upi_id: prev?.upi_id || res.withdrawal?.upi_id,
            error_message: res.error || 'Payment gateway could not complete transfer. Funds have been safely refunded to your wallet.',
          }));
          setActiveProcessingWth(null);
          await refreshWallet();
        }
      }
    } catch (e) {
      console.warn('Status check failed:', e);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Automated bounded polling while a withdrawal is in PROCESSING or PENDING state
  useEffect(() => {
    if (!isOpen || !successData || (successData.status !== 'PROCESSING' && successData.status !== 'PENDING')) {
      return;
    }

    const idToCheck = successData.withdrawal_id || successData.id;
    if (!idToCheck) return;

    let attempts = 0;
    const maxAttempts = 8;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await walletService.checkWithdrawalStatus(idToCheck);
        if (res.status === 'SUCCESS') {
          setSuccessData((prev: any) => ({
            ...(prev || {}),
            status: 'SUCCESS',
            reference_id: res.reference_id || prev?.reference_id,
            order_id: res.order_id || prev?.order_id,
          }));
          await refreshWallet();
          clearInterval(interval);
        } else if (res.status === 'FAILED' || res.status === 'REJECTED') {
          setSuccessData((prev: any) => ({
            ...(prev || {}),
            status: 'FAILED',
            error_message: res.error || 'Payment gateway could not complete transfer. Funds have been safely refunded to your wallet.',
          }));
          await refreshWallet();
          clearInterval(interval);
        }
      } catch (e) {
        console.warn('Auto status poll error:', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, successData?.status, successData?.withdrawal_id, successData?.id]);

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

      // Check if user has an active in-flight processing withdrawal from the last 15 minutes
      if (user?.id) {
        walletService.getWithdrawals(user.id).then((wths) => {
          if (!isMounted || !wths || wths.length === 0) return;
          const recentProcessing = wths.find((w) => {
            if (w.status !== 'PROCESSING') return false;
            const ageMs = Date.now() - new Date(w.created_at).getTime();
            return ageMs < 15 * 60 * 1000;
          });
          if (recentProcessing && !successData) {
            setActiveProcessingWth(recentProcessing);
          }
        }).catch(() => {});
      }

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, wallet?.available_balance, user?.id]);

  if (!isOpen) return null;

  const availableBalance = wallet?.available_balance ?? 0;
  const effectiveWithdrawable = withdrawableData.withdrawable_balance;
  const numAmount = parseFloat(amount) || 0;
  const feeInfo = calculateWithdrawalFee(numAmount);
  const currentFee = feeInfo.fee;
  const totalDeduction = numAmount > 0 ? feeInfo.totalDeducted : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Strict double-click guard
    setErrorMsg(null);

    if (numAmount < 1) {
      setErrorMsg('Minimum withdrawal amount is ₹1.00.');
      return;
    }

    if (numAmount > 5000) {
      setErrorMsg('Maximum withdrawal amount is ₹5,000.00.');
      return;
    }

    if (totalDeduction > effectiveWithdrawable) {
      if (withdrawableData.blocked_balance > 0) {
        setErrorMsg(
          `Withdrawal exceeds your eligible balance. You need ${formatCurrency(totalDeduction)} (${formatCurrency(numAmount)} payout + ${formatCurrency(currentFee)} platform fee), but only have ${formatCurrency(effectiveWithdrawable)} eligible for withdrawal (${formatCurrency(withdrawableData.blocked_balance)} is currently restricted under Lifafa withdrawal policy).`
        );
      } else {
        setErrorMsg(
          `Insufficient available balance. You need ${formatCurrency(totalDeduction)} (${formatCurrency(numAmount)} payout + ${formatCurrency(currentFee)} platform fee), but only have ${formatCurrency(availableBalance)}.`
        );
      }
      return;
    }

    const cleanUpi = upiId.trim().toLowerCase();
    if (!cleanUpi) {
      setErrorMsg('UPI ID is required.');
      return;
    }
    if (!/^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
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
      let msg = err.message || 'Failed to process withdrawal request.';
      if (
        msg.includes('Payment provider gateway verification in progress') ||
        msg.includes('verification in progress') ||
        msg.includes('held in PROCESSING')
      ) {
        activeIdempotencyKeyRef.current = null;
        setSuccessData({
          status: 'PROCESSING',
          amount: numAmount,
          net_amount: numAmount,
          fee_amount: currentFee,
          upi_id: cleanUpi,
          message: 'Withdrawal request submitted. Payment provider gateway verification in progress.',
        });
        await refreshWallet();
        return;
      }

      if (msg.includes('Withdrawal record not found')) {
        msg = 'Your withdrawal request was submitted and is processing. Please check your transaction history shortly.';
      }
      setErrorMsg(msg);
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
                Instant automated UPI transfers. Tiered platform fee from ₹2.50.
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

        {/* Active In-Flight Withdrawal Banner */}
        {activeProcessingWth && !successData && (
          <div className="mx-6 mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-blue-900 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Clock className="w-5 h-5 text-blue-600 shrink-0 animate-pulse" />
              <div className="min-w-0">
                <span className="font-bold block truncate">Withdrawal Currently In-Flight</span>
                <p className="text-[11px] text-blue-700 leading-snug">
                  ₹{Number(activeProcessingWth.net_amount || activeProcessingWth.amount).toFixed(2)} to {activeProcessingWth.upi_id}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSuccessData(activeProcessingWth);
                handleCheckStatus(activeProcessingWth.id);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer transition-colors shadow-xs"
            >
              Check Status
            </button>
          </div>
        )}

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
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase mb-1.5 ${
                  successData.status === 'SUCCESS'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : successData.status === 'FAILED'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {successData.status === 'SUCCESS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {successData.status === 'FAILED' && <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
                {(!successData.status || successData.status === 'PROCESSING' || successData.status === 'PENDING') && (
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                )}
                <span>
                  Status: {successData.status === 'SUCCESS' ? 'PAID' : successData.status === 'PROCESSING' ? 'PROCESSING' : 'PENDING'}
                </span>
              </div>

              <h4 className="text-lg font-black text-slate-900">
                {successData.status === 'SUCCESS'
                  ? 'Withdrawal Paid Successfully!'
                  : successData.status === 'FAILED'
                  ? 'Withdrawal Failed'
                  : successData.status === 'PROCESSING'
                  ? 'Payout In Progress (UPI)'
                  : 'Withdrawal Request Submitted'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {successData.status === 'SUCCESS'
                  ? `Your transfer of ${formatCurrency(Number(successData.net_amount || successData.amount || numAmount))} has been sent to your UPI ID.`
                  : successData.status === 'FAILED'
                  ? (successData.error_message || 'The payout could not be processed. Your wallet funds were not deducted.')
                  : successData.status === 'PROCESSING'
                  ? `Your transfer of ${formatCurrency(Number(successData.net_amount || successData.amount || numAmount))} is being processed by the banking network via PayNit. Amount will be credited to your account shortly.`
                  : `Your withdrawal request of ${formatCurrency(Number(successData.net_amount || successData.amount || numAmount))} has been submitted. Our admin team will verify and transfer the funds to your UPI ID shortly.`}
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
                <span className="font-mono font-bold text-slate-900">
                  {String(successData.upi_id || upiId).trim().toLowerCase()}
                </span>
              </div>
              {(successData.order_id || successData.reference_id) && (
                <div className="flex justify-between text-slate-600 text-[11px] pt-1 border-t border-slate-200">
                  <span>Reference ID:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {successData.reference_id || successData.order_id}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 pt-1.5 border-t border-slate-200">
                <span>Net Transfer Amount:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {formatCurrency(Number(successData.net_amount || successData.amount || numAmount))}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Platform Fee:</span>
                <span>{formatCurrency(Number(successData.fee_amount || currentFee))}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-xs pt-1 border-t border-slate-200">
                <span>Total Deducted:</span>
                <span className="text-blue-600">
                  {formatCurrency(Number(successData.amount || totalDeduction))}
                </span>
              </div>
            </div>

            {/* Actions for Status */}
            {(!successData.status || successData.status === 'PROCESSING') ? (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCheckStatus()}
                  disabled={checkingStatus}
                  className="w-full bg-amber-500 hover:bg-amber-600 active:scale-98 disabled:opacity-75 text-slate-950 font-bold py-3.5 rounded-2xl shadow-md text-xs cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                  <span>{checkingStatus ? 'Checking Gateway Status...' : 'Check Payout Status Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs cursor-pointer transition-colors"
                >
                  Close &amp; Check Transaction History
                </button>
                <p className="text-[11px] text-slate-400">
                  Transfers typically settle within 1–5 minutes. You can safely close this window while the network verifies.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-md text-xs cursor-pointer transition-colors"
              >
                {successData.status === 'FAILED' ? 'Close & Try Again' : 'Done'}
              </button>
            )}
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
                  Min ₹1 • Max ₹5,000
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500.00"
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
                Funds will be transferred directly to your UPI ID following administrator verification.
              </p>
            </div>

            {/* Dynamic Fee & Payout Breakdown */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
              <div className="flex justify-between items-center text-slate-600">
                <span>Beneficiary Payout:</span>
                <span className="font-bold text-slate-900">{formatCurrency(numAmount || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Platform Fee:</span>
                <span className="font-bold text-slate-900">{formatCurrency(currentFee)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                <span>Total Wallet Deduction:</span>
                <span className="text-blue-600">{formatCurrency(totalDeduction)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || availableBalance < totalDeduction || numAmount < 1 || numAmount > 5000}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                'Processing Payout Request...'
              ) : numAmount >= 1 && numAmount <= 5000 ? (
                `⚡ Withdraw ${formatCurrency(numAmount)} via UPI`
              ) : (
                'Enter Amount (Min ₹1 • Max ₹5,000)'
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
