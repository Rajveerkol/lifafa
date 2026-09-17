import React, { useState } from 'react';
import { X, ArrowDownToLine, QrCode, Copy, Check, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { merchantGatewayService } from '../../services/merchantGatewayService';
import { formatCurrency } from '../../lib/utils';

interface MerchantTopUpModalProps {
  isOpen: boolean;
  merchantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const MerchantTopUpModal: React.FC<MerchantTopUpModalProps> = ({
  isOpen,
  merchantId,
  onClose,
  onSuccess,
}) => {
  const [grossAmount, setGrossAmount] = useState<string>('5000');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const platformUpi = 'createlifafa@upi';
  const payeeName = 'CreatLifafa Payout Gateway';

  const numAmount = parseFloat(grossAmount) || 0;
  const { fee, netCredited } = merchantGatewayService.calculateDepositFee(numAmount);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(platformUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numAmount < 100) {
      setErrorMsg('Minimum float top-up amount is ₹100.00');
      return;
    }

    const cleanUtr = utrNumber.trim();
    if (cleanUtr.length < 8) {
      setErrorMsg('Please enter a valid Bank / UPI 12-digit UTR reference number');
      return;
    }

    try {
      setLoading(true);
      await merchantGatewayService.submitDeposit({
        merchantId,
        grossAmount: numAmount,
        utrNumber: cleanUtr,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit deposit request');
    } finally {
      setLoading(false);
    }
  };

  const dynamicUpiUri = `upi://pay?pa=${platformUpi}&pn=${encodeURIComponent(payeeName)}&am=${numAmount}&cu=INR`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Top Accent Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ArrowDownToLine className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Top-Up Payout Float</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deposit funds to disburse merchant bank payouts (2% platform fee)
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
            {/* Amount Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Top-Up Amount (₹)
              </label>
              <input
                type="number"
                min="100"
                step="100"
                required
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Live 2% Fee Calculator Breakdown */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Gross Transfer Amount:</span>
                <span className="font-bold text-slate-900">{formatCurrency(numAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-700">
                <span>Platform Deposit Fee (2%):</span>
                <span className="font-bold">-{formatCurrency(fee)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-black text-emerald-700">
                <span>Net Credited to Float:</span>
                <span className="text-sm">{formatCurrency(netCredited)}</span>
              </div>
            </div>

            {/* UPI QR & Details Card */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2 bg-white rounded-xl shadow-xs shrink-0">
                <QRCodeSVG value={dynamicUpiUri} size={110} />
              </div>
              <div className="space-y-1 text-center sm:text-left flex-1">
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                  Scan with any UPI App
                </span>
                <div className="text-xs font-bold text-slate-800">{payeeName}</div>
                <div className="flex items-center justify-center sm:justify-start gap-1 text-xs text-slate-600 font-mono">
                  <span>{platformUpi}</span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="p-1 text-blue-600 hover:text-blue-800"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* UTR Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bank UTR / UPI Transaction Reference Number
              </label>
              <input
                type="text"
                required
                placeholder="12-digit UTR from your banking app"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Admin will manually review this UTR and credit your float within minutes.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Float Top-Up Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
