import React, { useState } from 'react';
import { X, Send, AlertCircle, ShieldCheck, Smartphone } from 'lucide-react';
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
  const [upiId, setUpiId] = useState<string>('');
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

    const cleanUpi = upiId.trim().toLowerCase();
    if (!cleanUpi || !cleanUpi.includes('@') || !/^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      setErrorMsg('Please enter a valid UPI ID (e.g. name@okhdfcbank or 9876543210@paytm)');
      return;
    }

    try {
      setLoading(true);
      await merchantGatewayService.createPayout({
        orderId: orderId.trim(),
        amount: numAmount,
        method: 'UPI',
        upiId: cleanUpi,
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
              <h3 className="text-sm font-bold text-slate-900">Initiate Instant UPI Payout</h3>
              <p className="text-[11px] text-slate-500">Disburse via PayNit Instant UPI rails</p>
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
                <span>Gateway Fee (Flat ₹2.50):</span>
                <span className="font-semibold text-slate-900">+{formatCurrency(fee)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Total Float Deduction:</span>
                <span className="text-blue-700">{formatCurrency(totalDeducted)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Available Float: {formatCurrency(availableBalance)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Beneficiary UPI ID (VPA) *
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. name@okhdfcbank or 9876543210@paytm"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-medium focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Directly disbursed to UPI VPA via PayNit instant rails</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-start gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-slate-600">
                Payout is processed via PayNit UPI rails. Status will update automatically upon bank confirmation.
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
