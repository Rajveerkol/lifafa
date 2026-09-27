import React, { useState, useEffect } from 'react';
import { X, ArrowDownToLine, Copy, Check, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  merchantGatewayService,
  type MerchantUpiSettings,
  DEFAULT_MERCHANT_UPI_SETTINGS,
  MERCHANT_UPI_SETTINGS_EVENT,
} from '../../services/merchantGatewayService';
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
  const [upiSettings, setUpiSettings] = useState<MerchantUpiSettings>(() => {
    try {
      const item = localStorage.getItem('lifafa_merchant_upi_settings');
      if (item) return { ...DEFAULT_MERCHANT_UPI_SETTINGS, ...JSON.parse(item) };
    } catch (e) {}
    return DEFAULT_MERCHANT_UPI_SETTINGS;
  });
  const [qrImgError, setQrImgError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadSettings = async () => {
      try {
        const s = await merchantGatewayService.getMerchantUpiSettings();
        if (isMounted) setUpiSettings(s);
      } catch (err) {
        console.warn('Error loading merchant upi settings in modal:', err);
      }
    };

    loadSettings();

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<MerchantUpiSettings>;
      if (customEvent.detail && isMounted) {
        setUpiSettings(customEvent.detail);
        setQrImgError(false);
      }
    };

    window.addEventListener(MERCHANT_UPI_SETTINGS_EVENT, handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener(MERCHANT_UPI_SETTINGS_EVENT, handleUpdate);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const numAmount = parseFloat(grossAmount) || 0;
  const { fee, netCredited } = merchantGatewayService.calculateDepositFee(numAmount);

  const handleCopyUpi = () => {
    if (!upiSettings.upiId) return;
    navigator.clipboard.writeText(upiSettings.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (upiSettings.status === 'INACTIVE') {
      setErrorMsg('UPI collection is temporarily unavailable.');
      return;
    }

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

  const dynamicUpiUri = `upi://pay?pa=${encodeURIComponent(upiSettings.upiId || 'createlifafa@upi')}&pn=${encodeURIComponent(upiSettings.payeeName || 'CreatLifafa Payout Gateway')}&am=${numAmount}&cu=INR`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Float via UPI</h3>
              <p className="text-[11px] text-slate-500">2% standard gateway processing fee</p>
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deposit Gross Amount (₹) *
              </label>
              <input
                type="number"
                min="100"
                step="100"
                required
                disabled={upiSettings.status === 'INACTIVE'}
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            {/* Fee calculation breakdown */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Transfer Amount:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(numAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Platform Processing Fee (2%):</span>
                <span className="font-semibold text-amber-700">-{formatCurrency(fee)}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Net Credit to Float Balance:</span>
                <span className="text-emerald-700">{formatCurrency(netCredited)}</span>
              </div>
            </div>

            {/* UPI QR & Details / Inactive Fallback */}
            {upiSettings.status === 'INACTIVE' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>UPI collection is temporarily unavailable.</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed pl-5.5">
                  Direct float top-ups are currently paused by platform administrators.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 flex flex-col sm:flex-row items-center gap-4">
                <div className="p-2 bg-white rounded-md border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center">
                  {upiSettings.qrImageUrl && !qrImgError ? (
                    <img
                      src={upiSettings.qrImageUrl}
                      alt="Merchant Float UPI QR"
                      onError={() => setQrImgError(true)}
                      className="w-24 h-24 object-contain rounded"
                    />
                  ) : (
                    <QRCodeSVG value={dynamicUpiUri} size={96} />
                  )}
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Scan via any UPI App
                  </span>
                  <div className="text-xs font-bold text-slate-900">{upiSettings.payeeName}</div>
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-xs text-slate-600 font-mono">
                    <span>{upiSettings.upiId}</span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="p-0.5 text-blue-600 hover:text-blue-800 cursor-pointer"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UTR Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank UTR / UPI Reference Number *
              </label>
              <input
                type="text"
                required
                disabled={upiSettings.status === 'INACTIVE'}
                placeholder="12-digit UTR from your banking application"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold uppercase focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Your balance will be credited after admin verification.
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
                disabled={loading || upiSettings.status === 'INACTIVE'}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {upiSettings.status === 'INACTIVE'
                  ? 'UPI Collection Unavailable'
                  : loading
                  ? 'Submitting Deposit...'
                  : 'Submit Deposit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
