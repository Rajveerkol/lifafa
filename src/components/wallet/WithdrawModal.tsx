import React, { useState, useEffect } from 'react';
import { X, Wallet, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { walletService } from '../../services/walletService';
import { formatCurrency } from '../../lib/utils';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose }) => {
  const { user, wallet, refreshWallet } = useAuth();
  const [amount, setAmount] = useState('');
  const [accountHolder, setAccountHolder] = useState(user?.full_name || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const [withdrawableData, setWithdrawableData] = useState<{
    available_balance: number;
    blocked_balance: number;
    withdrawable_balance: number;
  }>({
    available_balance: wallet?.available_balance ?? 0,
    blocked_balance: 0,
    withdrawable_balance: wallet?.available_balance ?? 0,
  });

  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      walletService.getWithdrawableBalance().then((res) => {
        if (isMounted) {
          setWithdrawableData(res);
        }
      }).catch((e) => {
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

    if (!accountHolder.trim()) {
      setErrorMsg('Account holder name is required.');
      return;
    }

    if (!accountNumber.trim() || accountNumber.length < 9) {
      setErrorMsg('Please enter a valid bank account number (min 9 digits).');
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      setErrorMsg('Bank account numbers do not match.');
      return;
    }
    if (!ifsc.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) {
      setErrorMsg('Please enter a valid 11-character IFSC code (e.g. HDFC0001234).');
      return;
    }

    try {
      setLoading(true);
      const idempotencyKey = `wth_${user?.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const result = await walletService.requestWithdrawal(
        {
          amount: numAmount,
          accountHolderName: accountHolder.trim(),
          bankAccountNumber: accountNumber.trim(),
          ifscCode: ifsc.trim().toUpperCase(),
        },
        idempotencyKey
      );

      await refreshWallet();
      setSuccessData(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Withdraw Funds</h3>
              <p className="text-[11px] text-blue-100">
                {withdrawableData.blocked_balance > 0
                  ? `Withdrawable: ${formatCurrency(withdrawableData.withdrawable_balance)} • Total: ${formatCurrency(availableBalance)}`
                  : `Available: ${formatCurrency(availableBalance)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
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

        {successData ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-1">
              {successData.status === 'SUCCESS' ? 'Withdrawal Successful!' : 'Withdrawal Processing'}
            </h4>
            <p className="text-xs text-slate-600 mb-4 max-w-sm mx-auto">
              Your bank payout of <strong>{formatCurrency(numAmount)}</strong> has been {successData.status === 'SUCCESS' ? 'dispatched successfully' : 'initiated and is being processed'}.
            </p>

            {/* Breakdown summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-5 text-left text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Beneficiary Payout:</span>
                <span className="font-bold text-slate-900">{formatCurrency(numAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Platform Fee:</span>
                <span className="font-bold text-slate-900">₹{FIXED_FEE.toFixed(2)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Total Debited:</span>
                <span className="text-blue-600">{formatCurrency(totalDeduction)}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md text-sm"
            >
              Done
            </button>
          </div>
        ) : (
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
                  Withdrawal Amount (₹)
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

            {/* Account Holder Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Full name as per bank records"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:bg-white"
                required
              />
            </div>

            {/* Bank Account Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bank Account Number
              </label>
              <input
                type="password"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter bank account number"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-blue-500 focus:bg-white"
                required
              />
            </div>

            {/* Confirm Account Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Confirm Account Number
              </label>
              <input
                type="text"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="Re-enter bank account number"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-blue-500 focus:bg-white"
                required
              />
            </div>

            {/* IFSC Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                maxLength={11}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:border-blue-500 focus:bg-white"
                required
              />
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading
                ? 'Processing Payout...'
                : numAmount >= 10
                ? `Withdraw ${formatCurrency(numAmount)} (Total: ${formatCurrency(totalDeduction)})`
                : 'Enter Amount (Min ₹10)'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
