import React, { useState } from 'react';
import { X, Send, AlertCircle, ShieldCheck } from 'lucide-react';
import { merchantGatewayService } from '../../services/merchantGatewayService';
import { formatCurrency } from '../../lib/utils';

interface MerchantNewPayoutModalProps {
  isOpen: boolean;
  merchantId: string;
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const MerchantNewPayoutModal: React.FC<MerchantNewPayoutModalProps> = ({
  isOpen,
  merchantId,
  availableBalance,
  onClose,
  onSuccess,
}) => {
  const [orderId, setOrderId] = useState<string>(`ord_${Date.now().toString().slice(-6)}`);
  const [amount, setAmount] = useState<string>('500');
  const [recipientName, setRecipientName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const { fee, totalDeducted } = merchantGatewayService.calculatePayoutFee(numAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numAmount <= 0) {
      setErrorMsg('Please enter a valid payout amount');
      return;
    }

    if (numAmount > 1000) {
      setErrorMsg('Maximum payout amount per transaction is ₹1,000.00');
      return;
    }

    if (totalDeducted > availableBalance) {
      setErrorMsg(`Insufficient float balance. Required: ${formatCurrency(totalDeducted)}, Available: ${formatCurrency(availableBalance)}`);
      return;
    }

    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      setErrorMsg('Bank account numbers do not match');
      return;
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setErrorMsg('Invalid 11-character IFSC code format (e.g. HDFC0001234)');
      return;
    }

    try {
      setLoading(true);
      await merchantGatewayService.createPayout({
        orderId: orderId.trim(),
        amount: numAmount,
        recipient: {
          name: recipientName.trim(),
          account_number: accountNumber.trim(),
          ifsc: cleanIfsc,
        },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch payout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Initiate Instant Payout</h3>
              <p className="text-[11px] text-slate-500">Disburse directly via IMPS rails</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payout Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merchant Order ID *
                </label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="ord_1001"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Fee summary */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Beneficiary Receives:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(numAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Gateway Fee ({numAmount <= 100 ? '₹3.70' : '₹3.80'}):</span>
                <span className="font-semibold text-slate-900">+{formatCurrency(fee)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Total Deduction:</span>
                <span className="text-blue-700">{formatCurrency(totalDeducted)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Available Float: {formatCurrency(availableBalance)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Beneficiary Full Name *
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Name as per bank records"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account Number"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Account *
                </label>
                <input
                  type="text"
                  required
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                  placeholder="Re-enter Account"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank IFSC Code *
              </label>
              <input
                type="text"
                required
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold uppercase text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden [color-scheme:light]"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-start gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Status will transition to PROCESSING upon submission. Final confirmation arrives via webhook callback.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Initiating Payout...' : 'Confirm & Disburse'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
