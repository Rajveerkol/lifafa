import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  QrCode,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  ShieldCheck,
  RefreshCw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import {
  walletService,
  type PlatformPaymentSettings,
  DEFAULT_PAYMENT_SETTINGS,
  PAYMENT_SETTINGS_STORAGE_KEY,
} from '../../services/walletService';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { DepositRequest } from '../../types/database';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToAdmin?: () => void;
  onGoToExplore?: () => void;
}

type DepositStep = 'amount_and_pay' | 'enter_utr' | 'success';

export const AddMoneyModal: React.FC<AddMoneyModalProps> = ({
  isOpen,
  onClose,
  onGoToAdmin,
}) => {
  const { user, wallet, isAdmin, refreshWallet } = useAuth();

  const [activeTab, setActiveTab] = useState<'deposit' | 'history'>('deposit');
  const [step, setStep] = useState<DepositStep>('amount_and_pay');

  const [amount, setAmount] = useState<number>(100);
  const [customAmountInput, setCustomAmountInput] = useState<string>('100');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [paymentSettings, setPaymentSettings] = useState<PlatformPaymentSettings>(() => {
    try {
      const stored = localStorage.getItem(PAYMENT_SETTINGS_STORAGE_KEY);
      if (stored) return { ...DEFAULT_PAYMENT_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_PAYMENT_SETTINGS;
  });
  const [depositUpiId, setDepositUpiId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(PAYMENT_SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.upiId) return parsed.upiId;
      }
    } catch {}
    return DEFAULT_PAYMENT_SETTINGS.upiId;
  });

  const [copiedUpi, setCopiedUpi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedDeposit, setSubmittedDeposit] = useState<any>(null);

  // History state
  const [history, setHistory] = useState<DepositRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load platform payment settings (UPI ID, payee name, QR image/mode)
  useEffect(() => {
    if (isOpen) {
      walletService.getPaymentSettings().then((settings) => {
        if (settings) {
          setPaymentSettings(settings);
          if (settings.upiId) setDepositUpiId(settings.upiId);
        }
      });
    }
  }, [isOpen]);

  // Listen for real-time updates dispatched when admin saves payment settings
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      if (e?.detail) {
        setPaymentSettings(e.detail);
        if (e.detail.upiId) setDepositUpiId(e.detail.upiId);
      }
    };
    window.addEventListener('lifafa_payment_settings_updated', handleSettingsUpdated as EventListener);
    return () => {
      window.removeEventListener('lifafa_payment_settings_updated', handleSettingsUpdated as EventListener);
    };
  }, []);

  // Load user deposit history
  const fetchHistory = async () => {
    if (!user) return;
    try {
      setLoadingHistory(true);
      const res = await walletService.getUserDeposits(user.id);
      setHistory(res as DepositRequest[]);
    } catch (err) {
      console.error('Failed to load deposit history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      fetchHistory();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const quickAmounts = [50, 100, 200, 500, 1000];

  const handleSelectQuickAmount = (val: number) => {
    setAmount(val);
    setCustomAmountInput(val.toString());
    setErrorMsg(null);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmountInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
      setErrorMsg(null);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(depositUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleProceedToUtr = () => {
    if (amount < 1) {
      setErrorMsg('Deposit amount must be at least ₹1.00');
      return;
    }
    setErrorMsg(null);
    setStep('enter_utr');
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('Please log in to submit a deposit request.');
      return;
    }

    const cleanUtr = utrNumber.trim().toUpperCase();
    if (!cleanUtr || cleanUtr.length < 6) {
      setErrorMsg('Please enter a valid 12-digit UTR/Transaction Reference number.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await walletService.submitDepositRequest(amount, cleanUtr);
      setSubmittedDeposit(res);
      setStep('success');
      await refreshWallet();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit deposit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setStep('amount_and_pay');
    setUtrNumber('');
    setErrorMsg(null);
    setSubmittedDeposit(null);
  };

  // UPI payment intent link with configured payee name and UPI ID
  const activeUpiId = paymentSettings.upiId || depositUpiId || 'createlifafa@upi';
  const activePayeeName = paymentSettings.payeeName || 'CreatLifafa';
  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayeeName)}&am=${amount}&cu=INR`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Deposit Money (Manual UPI)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pay via any UPI app & submit 12-digit UTR for admin verification
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/30 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('deposit');
              handleResetForm();
            }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'deposit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Deposit Funds
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>My Deposit History</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Notice:</p>
                <p className="text-[11px] mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {activeTab === 'deposit' ? (
            <>
              {/* STEP 1: Select Amount & Pay */}
              {step === 'amount_and_pay' && (
                <div className="space-y-4">
                  {/* Current Balance Overview */}
                  <div className="flex items-center justify-between p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs">
                    <span className="text-slate-600 font-medium">Current Available Wallet Balance:</span>
                    <span className="font-bold text-blue-900 font-mono">
                      {formatCurrency(wallet?.available_balance ?? 0)}
                    </span>
                  </div>

                  {/* Amount Input & Quick Chips */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Deposit Amount (₹) *
                    </label>
                    <div className="relative mb-2.5">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={customAmountInput}
                        onChange={handleCustomAmountChange}
                        placeholder="Enter amount (min ₹1)"
                        className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleSelectQuickAmount(val)}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                            amount === val
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          +₹{val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Details Card (UPI ID & Dynamic QR) */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        Payee: <strong className="text-slate-800">{activePayeeName}</strong>
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Verified Account
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="overflow-hidden">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">UPI ID</span>
                        <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 break-all select-all">
                          {activeUpiId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="ml-2 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* QR Code (Custom Image or Dynamic UPI QR) */}
                    <div className="text-center py-2 flex flex-col items-center">
                      {paymentSettings.qrMode === 'CUSTOM_IMAGE' && paymentSettings.qrImageUrl ? (
                        <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-block">
                          <img
                            src={paymentSettings.qrImageUrl}
                            alt="Deposit UPI QR Code"
                            className="w-40 h-40 object-contain mx-auto rounded-xl"
                          />
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-block">
                          <QRCodeSVG
                            value={upiPayUrl}
                            size={144}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 mt-2 font-medium">
                        Scan QR with <span className="font-bold text-slate-700">PhonePe, GPay, Paytm, BHIM</span> to pay <span className="font-bold text-blue-600">₹{amount}</span>
                      </p>
                    </div>

                    {/* Mobile UPI Direct App Intent Button */}
                    <a
                      href={upiPayUrl}
                      className="sm:hidden w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open UPI App to Pay ₹{amount}</span>
                    </a>

                    {/* Instructions */}
                    <div className="bg-white/80 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
                      <p className="font-bold text-slate-700">Steps to deposit:</p>
                      <p>1. Open your UPI app and transfer exactly <strong className="text-slate-900">₹{amount}</strong> to the UPI ID above.</p>
                      <p>2. Once payment is successful, copy the <strong className="text-slate-900">12-digit UTR / Ref No.</strong> from transaction details.</p>
                      <p>3. Click the button below to submit the UTR for verification.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleProceedToUtr}
                    disabled={amount < 1}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <span>I Have Paid ₹{amount} → Enter UTR Number</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 2: Enter UTR */}
              {step === 'enter_utr' && (
                <form onSubmit={handleSubmitDeposit} className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Payment Amount</span>
                      <span className="font-bold text-slate-900 text-sm">{formatCurrency(amount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-[10px]">Paid to UPI</span>
                      <span className="font-mono font-bold text-slate-700 text-xs">{depositUpiId}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      12-Digit UTR / Transaction Reference Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="e.g. 423589123456"
                      maxLength={30}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-500 focus:bg-white uppercase tracking-wider"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Find the 12-digit UTR or Reference ID in your GPay / PhonePe / Paytm payment receipt.
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Important Fraud Warning:
                    </p>
                    <p>
                      Submitting fake or invalid UTR numbers will lead to permanent account suspension. Every submission is reconciled directly against bank account statements.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep('amount_and_pay')}
                      disabled={loading}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-1 transition-all"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading || utrNumber.trim().length < 6}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Submit Deposit Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Success Confirmation */}
              {step === 'success' && (
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Deposit Request Submitted!</h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                      Your manual UPI deposit of <strong className="text-slate-900">₹{amount}</strong> has been received with status <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold text-[10px]">PENDING</span>.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-left space-y-2 max-w-sm mx-auto font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Amount:</span>
                      <span className="font-bold text-slate-800">₹{amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Submitted UTR:</span>
                      <span className="font-bold text-slate-800">{utrNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Destination UPI:</span>
                      <span className="text-slate-700">{depositUpiId}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    The admin team will verify this UTR against platform account records. Upon approval, your available wallet balance will update automatically.
                  </p>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('history');
                        fetchHistory();
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>View in Deposit History</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* TAB 2: Deposit History */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-700">Past Deposit Submissions</span>
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading deposit history...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Clock className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                  <p>No deposit requests yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('deposit');
                      handleResetForm();
                    }}
                    className="mt-2 text-blue-600 font-bold hover:underline"
                  >
                    Submit a deposit now
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 font-mono">
                            {formatCurrency(item.amount)}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                          UTR: <span className="font-semibold text-slate-700">{item.utr_number}</span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatDate(item.created_at)}
                        </p>
                        {item.status === 'REJECTED' && item.admin_notes && (
                          <p className="text-[10px] text-red-600 font-medium">
                            Reason: {item.admin_notes}
                          </p>
                        )}
                      </div>

                      {item.status === 'APPROVED' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {item.status === 'PENDING' && (
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      {item.status === 'REJECTED' && (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info & Admin shortcut */}
        {isAdmin && onGoToAdmin && (
          <div className="p-3 bg-slate-100/70 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Administrator Access:</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToAdmin();
              }}
              className="text-blue-700 hover:text-blue-800 font-bold text-xs flex items-center gap-1"
            >
              <span>Manage Deposit Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
