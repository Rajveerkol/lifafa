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
  Wallet,
  Sparkles,
  Info,
  ChevronRight,
  Receipt,
  HelpCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import {
  walletService,
  type PlatformPaymentSettings,
  DEFAULT_PAYMENT_SETTINGS,
  PAYMENT_SETTINGS_STORAGE_KEY,
} from '../../services/walletService';
import { calculateDepositFee } from '../../lib/feeCalculations';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { DepositRequest } from '../../types/database';
import { DepositAdminAssistanceCard } from '../common/DepositAdminAssistanceCard';
import { FundsSafetyNoticeModal } from '../compliance/FundsSafetyNoticeModal';
import { termsComplianceService } from '../../services/termsComplianceService';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToAdmin?: () => void;
  onGoToExplore?: () => void;
}

type DepositStep = 'amount' | 'pay' | 'verify' | 'success';

export const AddMoneyModal: React.FC<AddMoneyModalProps> = ({
  isOpen,
  onClose,
  onGoToAdmin,
}) => {
  const { user, refreshWallet } = useAuth();

  const [activeTab, setActiveTab] = useState<'deposit' | 'history'>('deposit');
  const [step, setStep] = useState<DepositStep>('amount');

  // Amount state (Default: ₹500)
  const [amount, setAmount] = useState<number>(500);
  const [customAmountInput, setCustomAmountInput] = useState<string>('500');
  const [utrNumber, setUtrNumber] = useState<string>('');

  // Payment settings state
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

  // Feedback states
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedDeposit, setSubmittedDeposit] = useState<any>(null);

  // History state
  const [history, setHistory] = useState<DepositRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Mandatory Funds Safety Terms Acceptance state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsNoticeOpen, setTermsNoticeOpen] = useState(false);

  // Quick amount choices matching specification
  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  // Check mandatory Funds Safety Terms acceptance status on open
  useEffect(() => {
    if (isOpen && user?.id) {
      termsComplianceService.getUserTermsStatus(user.id).then((res) => {
        setTermsAccepted(res.has_accepted);
      }).catch(() => {});
    }
  }, [isOpen, user?.id]);

  // Load platform payment settings
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

  // Listen for real-time updates dispatched when admin updates payment settings
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

  // Amount & Fee Calculations
  const feeCalc = calculateDepositFee(amount);
  const depositFee = feeCalc.fee;
  const totalPayable = feeCalc.totalPayable;
  const isAmountValid = amount >= 100 && !isNaN(amount);

  // Handlers for Amount Selection
  const handleSelectQuickAmount = (val: number) => {
    setAmount(val);
    setCustomAmountInput(val.toString());
    setErrorMsg(null);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmountInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      setAmount(parsed);
      if (parsed < 100) {
        setErrorMsg('Minimum deposit amount is ₹100.00');
      } else {
        setErrorMsg(null);
      }
    } else {
      setAmount(0);
      setErrorMsg('Please enter a valid amount');
    }
  };

  // Copy Handlers with Visual Feedback
  const handleCopyUpi = () => {
    const upi = paymentSettings.upiId || depositUpiId || 'createlifafa@upi';
    navigator.clipboard.writeText(upi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(totalPayable.toString());
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  // Step Navigation Handlers
  const handleContinueToPayment = () => {
    if (!isAmountValid) {
      setErrorMsg('Please select or enter an amount of at least ₹100.00');
      return;
    }
    if (!termsAccepted) {
      setTermsNoticeOpen(true);
      return;
    }
    setErrorMsg(null);
    setStep('pay');
  };

  const handleProceedToVerify = () => {
    setErrorMsg(null);
    setStep('verify');
  };

  const handleBackToAmount = () => {
    setErrorMsg(null);
    setStep('amount');
  };

  const handleBackToPay = () => {
    setErrorMsg(null);
    setStep('pay');
  };

  // Submit UTR to Backend
  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('Please log in to submit a deposit request.');
      return;
    }

    const cleanUtr = utrNumber.trim().toUpperCase();
    if (!cleanUtr || cleanUtr.length < 6) {
      setErrorMsg('Please enter a valid 12-digit UTR or Transaction Reference number.');
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
    setStep('amount');
    setUtrNumber('');
    setErrorMsg(null);
    setSubmittedDeposit(null);
  };

  // UPI Intent URI construction
  const activeUpiId = paymentSettings.upiId || depositUpiId || 'createlifafa@upi';
  const activePayeeName = paymentSettings.payeeName || 'Createlifafa';
  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayeeName)}&am=${totalPayable}&cu=INR`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <style>{`
        @keyframes scanBeam {
          0% { transform: translateY(-10%); opacity: 0; }
          20% { opacity: 0.9; }
          80% { opacity: 0.9; }
          100% { transform: translateY(180px); opacity: 0; }
        }
        .qr-scanner-line {
          animation: scanBeam 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .qr-scanner-line { animation: none; display: none; }
        }
      `}</style>

      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl shadow-[0_25px_60px_-15px_rgba(37,99,235,0.35)] border border-blue-500/20 overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        
        {/* Glow Accents Behind Card */}
        <div className="absolute top-0 left-1/4 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Bar: Header & Tabs */}
        <div className="relative z-10 px-5 pt-4 pb-3 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  Deposit Money
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 border border-blue-500/30">
                    UPI Instant
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs (Deposit vs History) */}
          <div className="flex gap-2 mt-3 pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('deposit');
                handleResetForm();
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'deposit'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="relative z-10 overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {activeTab === 'deposit' ? (
            <>
              {/* Step Progress Bar (Only visible during active deposit flow) */}
              {step !== 'success' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
                  <div className="grid grid-cols-3 gap-1 relative text-[11px] font-bold">
                    {/* Step 1: Amount */}
                    <div className="flex items-center gap-1.5 justify-center">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          step === 'amount'
                            ? 'bg-blue-500 text-white ring-2 ring-blue-400/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {step !== 'amount' ? <Check className="w-3 h-3" /> : '01'}
                      </span>
                      <span className={step === 'amount' ? 'text-white font-extrabold' : 'text-slate-400'}>
                        Amount
                      </span>
                    </div>

                    {/* Step 2: Pay */}
                    <div className="flex items-center gap-1.5 justify-center">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          step === 'pay'
                            ? 'bg-blue-500 text-white ring-2 ring-blue-400/40'
                            : step === 'verify'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-white/10 text-slate-500'
                        }`}
                      >
                        {step === 'verify' ? <Check className="w-3 h-3" /> : '02'}
                      </span>
                      <span className={step === 'pay' ? 'text-white font-extrabold' : 'text-slate-400'}>
                        Pay
                      </span>
                    </div>

                    {/* Step 3: Verify */}
                    <div className="flex items-center gap-1.5 justify-center">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          step === 'verify'
                            ? 'bg-blue-500 text-white ring-2 ring-blue-400/40'
                            : 'bg-white/10 text-slate-500'
                        }`}
                      >
                        03
                      </span>
                      <span className={step === 'verify' ? 'text-white font-extrabold' : 'text-slate-400'}>
                        Verify
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* STEP 1: CHOOSE AMOUNT                                        */}
              {/* ============================================================ */}
              {step === 'amount' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-250">
                  <div className="text-left space-y-0.5">
                    <h4 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Add Money to Your Wallet
                    </h4>
                    <p className="text-xs text-slate-400">
                      Choose your deposit amount to continue.
                    </p>
                  </div>

                  {/* Quick Amount Selector Grid */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                      <span>Select Quick Amount</span>
                      <span className="text-cyan-400">Min ₹100</span>
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      {quickAmounts.map((qVal) => {
                        const isSelected = amount === qVal;
                        const isTier1 = qVal < 1000;
                        return (
                          <button
                            key={qVal}
                            type="button"
                            onClick={() => handleSelectQuickAmount(qVal)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                              isSelected
                                ? 'bg-gradient-to-br from-blue-600/30 via-indigo-600/20 to-violet-600/30 border-blue-400 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300'
                            }`}
                          >
                            <div className="text-sm sm:text-base font-black text-white">
                              ₹{qVal.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              {isTier1 ? '+₹100 Fee' : '+2% Fee'}
                            </div>
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Amount Input Box */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Or Enter Custom Amount
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-lg font-black text-slate-400 select-none">
                        ₹
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customAmountInput}
                        onChange={handleCustomAmountChange}
                        placeholder="e.g. 500"
                        className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 rounded-2xl text-lg font-black text-white placeholder:text-slate-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Live Fee Breakdown Card */}
                  <div className="p-4 bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-indigo-950/40 rounded-2xl border border-white/10 shadow-inner space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Deposit Amount (Wallet Credit)</span>
                      <span className="font-bold text-white">{formatCurrency(amount > 0 ? amount : 0)}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1">
                        <span>Platform Fee</span>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          {amount >= 1000 ? '(2%)' : amount >= 100 ? '(Flat ₹100)' : ''}
                        </span>
                      </span>
                      <span className="font-bold text-amber-300">+{formatCurrency(depositFee)}</span>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Total Payable</span>
                      <span className="text-lg font-black text-cyan-300 tracking-tight">
                        {formatCurrency(totalPayable)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                      💡 You pay <strong className="text-slate-200">{formatCurrency(totalPayable)}</strong> via UPI. Your wallet balance will be credited with exactly <strong className="text-emerald-400">{formatCurrency(amount > 0 ? amount : 0)}</strong> upon verification.
                    </p>
                  </div>

                  {/* Primary Continue Button */}
                  <button
                    type="button"
                    onClick={handleContinueToPayment}
                    disabled={!isAmountValid}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Telegram Assistance Banner */}
                  <DepositAdminAssistanceCard variant="compact" />
                </div>
              )}

              {/* ============================================================ */}
              {/* STEP 2: QR & UPI PAYMENT                                     */}
              {/* ============================================================ */}
              {step === 'pay' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-250">
                  <div className="text-left space-y-0.5">
                    <h4 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Complete Your Payment
                    </h4>
                    <p className="text-xs text-slate-400">
                      Scan the QR code or pay using the UPI details below.
                    </p>
                  </div>

                  {/* Payment Summary Pill */}
                  <div className="p-3 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 rounded-2xl border border-blue-500/20 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total to Pay</span>
                      <span className="text-base font-black text-cyan-300">{formatCurrency(totalPayable)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Wallet Credit</span>
                      <span className="text-xs font-bold text-emerald-400">{formatCurrency(amount)}</span>
                    </div>
                  </div>

                  {/* Animated QR Code Box */}
                  <div className="relative mx-auto w-52 p-4 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl border border-white/20 shadow-xl flex flex-col items-center justify-center overflow-hidden">
                    {/* Scanning Beam Animation */}
                    <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 rounded-full shadow-[0_0_12px_#38bdf8] qr-scanner-line z-20 pointer-events-none" />

                    <div className="p-3 bg-white rounded-2xl shadow-md z-10">
                      {paymentSettings.qrMode === 'CUSTOM_IMAGE' && paymentSettings.qrImageUrl ? (
                        <img
                          src={paymentSettings.qrImageUrl}
                          alt="Merchant Payment QR"
                          className="w-40 h-40 object-contain rounded-lg"
                        />
                      ) : (
                        <QRCodeSVG
                          value={upiPayUrl}
                          size={160}
                          level="M"
                          includeMargin={false}
                        />
                      )}
                    </div>

                    <div className="mt-2.5 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 z-10">
                      <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Scan with any UPI App</span>
                    </div>
                  </div>

                  {/* Merchant UPI ID Card with Copy Buttons */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Merchant UPI ID
                      </span>
                      <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                        {activePayeeName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2.5 bg-slate-950/70 rounded-xl border border-white/10 font-mono text-xs font-bold text-white truncate select-all">
                        {activeUpiId}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy UPI</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                      <span className="text-slate-400">Exact Payable Amount:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-300">₹{totalPayable}</span>
                        <button
                          type="button"
                          onClick={handleCopyAmount}
                          className="text-[10px] text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {copiedAmount ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedAmount ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Payment Instruction Note */}
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-blue-200">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      After completing the payment in PhonePe, GPay, Paytm, or BHIM, click below to enter your <strong>12-digit UTR</strong>.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleBackToAmount}
                      className="py-3.5 px-4 bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleProceedToVerify}
                      className="flex-1 py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>I've Completed Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <DepositAdminAssistanceCard variant="compact" />
                </div>
              )}

              {/* ============================================================ */}
              {/* STEP 3: ENTER UTR AND SUBMIT                                 */}
              {/* ============================================================ */}
              {step === 'verify' && (
                <form onSubmit={handleSubmitDeposit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-250">
                  <div className="text-left space-y-0.5">
                    <h4 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Verify Your Deposit
                    </h4>
                    <p className="text-xs text-slate-400">
                      Enter the UTR / reference number from your payment app.
                    </p>
                  </div>

                  {/* Summary Card */}
                  <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Deposit Amount (Wallet Credit)</span>
                      <span className="font-bold text-white">{formatCurrency(amount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Applicable Fee</span>
                      <span className="font-bold text-amber-300">+{formatCurrency(depositFee)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Total Paid to Payee</span>
                      <span className="font-bold text-cyan-300">{formatCurrency(totalPayable)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 pt-1.5 border-t border-white/5 font-mono text-[11px]">
                      <span>Merchant UPI</span>
                      <span className="text-slate-300 select-all">{activeUpiId}</span>
                    </div>
                  </div>

                  {/* UTR Input Field */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex justify-between items-center text-[11px]">
                      <label className="font-bold uppercase tracking-wider text-slate-300">
                        12-Digit UTR / Reference Number
                      </label>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {utrNumber.trim().length} Characters
                      </span>
                    </div>

                    <input
                      type="text"
                      maxLength={30}
                      value={utrNumber}
                      onChange={(e) => {
                        setUtrNumber(e.target.value.toUpperCase());
                        setErrorMsg(null);
                      }}
                      placeholder="e.g. 428901234567"
                      className="w-full px-4 py-3 bg-slate-950/80 border border-white/15 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 rounded-2xl font-mono text-base font-bold text-white placeholder:text-slate-600 outline-none transition-all uppercase tracking-wider"
                    />

                    <p className="text-[10px] text-slate-400">
                      Found on your payment receipt in Google Pay, PhonePe, Paytm, or BHIM as <strong>UTR, Ref No, or UPI Transaction ID</strong>.
                    </p>
                  </div>

                  {/* Security / Fraud Warning */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2 text-[11px] text-amber-300">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Every submission is reconciled directly against official bank statements. Submitting fake or invalid UTRs will lead to account restrictions.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleBackToPay}
                      disabled={loading}
                      className="py-3.5 px-4 bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-50 text-slate-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading || utrNumber.trim().length < 6}
                      className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
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

                  <DepositAdminAssistanceCard variant="compact" />
                </form>
              )}

              {/* ============================================================ */}
              {/* STEP 4: SUCCESS CARD                                         */}
              {/* ============================================================ */}
              {step === 'success' && (
                <div className="text-center space-y-4 py-2 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
                  </div>

                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Status: PENDING REVIEW</span>
                    </div>

                    <h4 className="text-xl font-black text-white tracking-tight pt-1">
                      Deposit Request Submitted!
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Your payment details have been submitted for verification.
                    </p>
                  </div>

                  {/* Submission Details Card */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs space-y-2.5 text-left">
                    {submittedDeposit?.deposit_id && (
                      <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                        <span>Request ID:</span>
                        <span className="font-bold text-white select-all">{submittedDeposit.deposit_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Submitted UTR:</span>
                      <span className="font-mono font-bold text-cyan-300">{utrNumber}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Wallet Credit:</span>
                      <span className="font-black text-emerald-400 text-sm">{formatCurrency(amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Total Paid:</span>
                      <span className="font-bold text-white">{formatCurrency(totalPayable)}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                    Our admin team verifies incoming payments against bank statements. Your wallet will be credited automatically once confirmed.
                  </p>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                    >
                      <History className="w-4 h-4" />
                      <span>View Deposit History</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-2.5 text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Done / Close
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ============================================================ */
            /* TAB 2: DEPOSIT HISTORY                                       */
            /* ============================================================ */
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Your Deposit Requests</span>
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span>Loading history...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="py-10 text-center space-y-2 bg-white/5 border border-white/5 rounded-2xl p-6">
                  <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No deposit requests submitted yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('deposit');
                      handleResetForm();
                    }}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    Submit a deposit now
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {history.map((dep) => (
                    <div
                      key={dep.id}
                      className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between text-xs hover:border-white/20 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">
                            {formatCurrency(dep.amount)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              dep.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : dep.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {dep.status}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          UTR: <span className="text-slate-300">{dep.utr_number}</span>
                        </div>
                        {dep.admin_notes && (
                          <div className="text-[10px] text-slate-400 italic">
                            Note: {dep.admin_notes}
                          </div>
                        )}
                      </div>

                      <div className="text-right text-[10px] text-slate-500 font-mono">
                        {formatDate(dep.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Mandatory Funds Safety Notice Modal */}
      <FundsSafetyNoticeModal
        isOpen={termsNoticeOpen}
        userEmail={user?.email || undefined}
        userType="CUSTOMER"
        initialMobile={user?.phone_number || ''}
        forceMandatory={false}
        onAccepted={() => {
          setTermsAccepted(true);
          setTermsNoticeOpen(false);
          setStep('pay');
        }}
        onRejected={() => {
          setTermsAccepted(false);
          setTermsNoticeOpen(false);
          setErrorMsg('Acceptance of Funds Safety terms is mandatory before continuing to payment.');
        }}
        onClose={() => setTermsNoticeOpen(false)}
      />
    </div>
  );
};
