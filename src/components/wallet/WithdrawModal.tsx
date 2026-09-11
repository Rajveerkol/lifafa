import React, { useState } from 'react';
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

  if (!isOpen) return null;

  const availableBalance = wallet?.available_balance ?? 0;
  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numAmount <= 0) {
      setErrorMsg('Please enter a valid withdrawal amount.');
      return;
    }

    if (numAmount > availableBalance) {
      setErrorMsg(`Insufficient available balance (${formatCurrency(availableBalance)}).`);
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
                Available: {formatCurrency(availableBalance)}
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

        {successData ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-1">
              Withdrawal Request Placed!
            </h4>
            <p className="text-xs text-slate-600 mb-4 max-w-sm mx-auto">
              Your request for <strong>{formatCurrency(numAmount)}</strong> has been recorded in
              PENDING status.
            </p>

            {/* Payout abstraction note */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-5 text-left text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Bank Payout Notice:</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Your bank account withdrawal request is queued in PENDING status and will be processed via our secure payout gateway.
                  </p>
                </div>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Withdrawal Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  max={availableBalance}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
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

            {/* Fee note */}
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] text-blue-800 flex justify-between items-center">
              <span>Platform Fee:</span>
              <span className="font-bold">₹0.00 (0% Promo)</span>
            </div>

            <button
              type="submit"
              disabled={loading || availableBalance <= 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading ? 'Submitting Request...' : `Withdraw ${formatCurrency(numAmount || 0)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
