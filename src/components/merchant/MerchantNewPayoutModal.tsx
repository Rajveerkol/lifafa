import React, { useState } from 'react';
import { X, Send, Building, ShieldCheck, AlertCircle, Info } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Initiate Bank Payout</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Disburse funds directly to a beneficiary bank account
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Payout Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Merchant Order ID
                </label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="m_ord_1001"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Live Fee Breakdown Pill */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Beneficiary Receives:</span>
                <span className="font-bold text-slate-900">{formatCurrency(numAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Payout Gateway Fee ({numAmount <= 100 ? '₹3.70' : '₹3.80'}):</span>
                <span className="font-bold text-amber-600">+{formatCurrency(fee)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-black text-slate-900">
                <span>Total Deducted from Float:</span>
                <span className="text-sm text-blue-700">{formatCurrency(totalDeducted)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Beneficiary Full Name
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="As printed on bank account"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Confirm Account Number
                </label>
                <input
                  type="text"
                  required
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                  placeholder="Re-enter account number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bank IFSC Code
              </label>
              <input
                type="text"
                required
                maxLength={11}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-2 text-[11px] text-blue-800">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Status remains PROCESSING until PayRupee sends bank confirmation.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md shadow-blue-600/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting Payout...' : `Confirm & Deduct ${formatCurrency(totalDeducted)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
