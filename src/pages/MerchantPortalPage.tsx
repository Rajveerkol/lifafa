import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Wallet,
  Send,
  ArrowDownToLine,
  Key,
  Shield,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Search,
  Sliders,
  Bell,
  HelpCircle,
  User,
  LogOut,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Info,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { merchantGatewayService } from '../services/merchantGatewayService';
import type {
  Merchant,
  MerchantWallet,
  MerchantPayout,
  MerchantDeposit,
  MerchantLedgerEntry,
  MerchantApiKey,
  MerchantIpWhitelist,
} from '../types/merchant';
import { formatCurrency, formatDate } from '../lib/utils';
import { MerchantAuthModal } from '../components/merchant/MerchantAuthModal';
import { MerchantTopUpModal } from '../components/merchant/MerchantTopUpModal';
import { MerchantNewPayoutModal } from '../components/merchant/MerchantNewPayoutModal';
import { MerchantApiKeysManager } from '../components/merchant/MerchantApiKeysManager';
import { MerchantIpWhitelistManager } from '../components/merchant/MerchantIpWhitelistManager';

type MerchantNavSection =
  | 'dashboard'
  | 'add-money'
  | 'make-payout'
  | 'payouts'
  | 'wallet'
  | 'deposits'
  | 'reports'
  | 'api-settings'
  | 'api-docs'
  | 'notifications'
  | 'profile'
  | 'help-support';

export const MerchantPortalPage: React.FC = () => {
  const { merchant: contextMerchant, isMerchant, logout, refreshMerchant } = useAuth();

  const [merchant, setMerchant] = useState<Merchant | null>(contextMerchant);
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [deposits, setDeposits] = useState<MerchantDeposit[]>([]);
  const [ledger, setLedger] = useState<MerchantLedgerEntry[]>([]);
  const [apiKeys, setApiKeys] = useState<MerchantApiKey[]>([]);
  const [whitelist, setWhitelist] = useState<MerchantIpWhitelist[]>([]);

  const [activeSection, setActiveSection] = useState<MerchantNavSection>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [newPayoutModalOpen, setNewPayoutModalOpen] = useState(false);

  // Filters & Search
  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'ALL' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('ALL');
  const [depositSearch, setDepositSearch] = useState('');
  const [depositStatusFilter, setDepositStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Manual Add Money View Form State
  const [depositAmount, setDepositAmount] = useState<string>('5000');
  const [depositUtr, setDepositUtr] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [depositErrorMsg, setDepositErrorMsg] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Manual Make Payout View Form State
  const [payoutOrderId, setPayoutOrderId] = useState<string>(`ord_${Date.now().toString().slice(-6)}`);
  const [payoutAmount, setPayoutAmount] = useState<string>('500');
  const [recipientName, setRecipientName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [submittingPayout, setSubmittingPayout] = useState<boolean>(false);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);
  const [payoutErrorMsg, setPayoutErrorMsg] = useState<string | null>(null);

  // API Docs copy state
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);

  const platformUpi = 'createlifafa@upi';
  const payeeName = 'CreatLifafa Payout Gateway';

  const loadMerchantData = useCallback(async () => {
    try {
      let currentMch = contextMerchant;
      if (!currentMch) {
        // Probe current user
        await refreshMerchant();
      }

      if (contextMerchant) {
        setMerchant(contextMerchant);
        const [w, pList, dList, lList, kList, ipList] = await Promise.all([
          merchantGatewayService.getMerchantWallet(contextMerchant.id),
          merchantGatewayService.getMerchantPayouts(contextMerchant.id),
          merchantGatewayService.getMerchantDeposits(contextMerchant.id),
          merchantGatewayService.getMerchantLedger(contextMerchant.id),
          merchantGatewayService.getMerchantApiKeys(contextMerchant.id),
          merchantGatewayService.getMerchantIpWhitelist(contextMerchant.id),
        ]);

        setWallet(w);
        setPayouts(pList);
        setDeposits(dList);
        setLedger(lList);
        setApiKeys(kList);
        setWhitelist(ipList);
      }
    } catch (err) {
      console.error('Error loading merchant gateway records:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contextMerchant, refreshMerchant]);

  useEffect(() => {
    loadMerchantData();
  }, [loadMerchantData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadMerchantData();
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(platformUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Inline Deposit Submission
  const handleInlineDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;
    setDepositErrorMsg(null);
    setDepositSuccessMsg(null);

    const grossNum = parseFloat(depositAmount) || 0;
    if (grossNum < 100) {
      setDepositErrorMsg('Minimum float top-up amount is ₹100.00');
      return;
    }

    const cleanUtr = depositUtr.trim().toUpperCase();
    if (cleanUtr.length < 8) {
      setDepositErrorMsg('Please enter a valid Bank / UPI 12-digit UTR reference number');
      return;
    }

    try {
      setSubmittingDeposit(true);
      await merchantGatewayService.submitDeposit({
        merchantId: merchant.id,
        grossAmount: grossNum,
        utrNumber: cleanUtr,
      });

      setDepositSuccessMsg(`Float top-up of ₹${grossNum} submitted! Status: PENDING admin verification.`);
      setDepositUtr('');
      await loadMerchantData();
      setTimeout(() => setDepositSuccessMsg(null), 5000);
    } catch (err: any) {
      setDepositErrorMsg(err.message || 'Failed to submit float deposit request');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  // Inline Payout Submission
  const handleInlinePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;
    setPayoutErrorMsg(null);
    setPayoutSuccessMsg(null);

    const amtNum = parseFloat(payoutAmount) || 0;
    if (amtNum <= 0) {
      setPayoutErrorMsg('Please enter a valid payout amount');
      return;
    }

    if (amtNum > 1000) {
      setPayoutErrorMsg('Maximum payout amount per transaction is ₹1,000.00');
      return;
    }

    const { fee, totalDeducted } = merchantGatewayService.calculatePayoutFee(amtNum);
    const available = wallet?.available_balance ?? 0;

    if (totalDeducted > available) {
      setPayoutErrorMsg(`Insufficient float balance. Required: ${formatCurrency(totalDeducted)}, Available: ${formatCurrency(available)}`);
      return;
    }

    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      setPayoutErrorMsg('Bank account numbers do not match');
      return;
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setPayoutErrorMsg('Invalid 11-character IFSC code format (e.g. HDFC0001234)');
      return;
    }

    try {
      setSubmittingPayout(true);
      const res = await merchantGatewayService.createPayout({
        orderId: payoutOrderId.trim(),
        amount: amtNum,
        recipient: {
          name: recipientName.trim(),
          account_number: accountNumber.trim(),
          ifsc: cleanIfsc,
        },
      });

      setPayoutSuccessMsg(
        `Payout initiated successfully! Provider status: ${res?.status || 'PROCESSING'}. Final status will be confirmed after provider verification.`
      );
      setPayoutOrderId(`ord_${Date.now().toString().slice(-6)}`);
      setRecipientName('');
      setAccountNumber('');
      setConfirmAccountNumber('');
      setIfscCode('');
      await loadMerchantData();
      setTimeout(() => setPayoutSuccessMsg(null), 6000);
    } catch (err: any) {
      setPayoutErrorMsg(err.message || 'Failed to dispatch payout');
    } finally {
      setSubmittingPayout(false);
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>{status}</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-blue-200"
            title="Payment request has been accepted for processing. Final status will be confirmed after provider verification."
          >
            <Clock className="w-3 h-3 animate-spin" />
            <span>PROCESSING</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>PENDING</span>
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
      case 'REVERSED':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-red-200">
            <XCircle className="w-3 h-3" />
            <span>{status}</span>
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
            {status}
          </span>
        );
    }
  };

  // Payout fee live calculation
  const numPayoutAmt = parseFloat(payoutAmount) || 0;
  const { fee: livePayoutFee, totalDeducted: liveTotalDeducted } = merchantGatewayService.calculatePayoutFee(numPayoutAmt);

  // Deposit fee live calculation
  const numDepositAmt = parseFloat(depositAmount) || 0;
  const { fee: liveDepositFee, netCredited: liveNetCredited } = merchantGatewayService.calculateDepositFee(numDepositAmt);
  const dynamicUpiUri = `upi://pay?pa=${platformUpi}&pn=${encodeURIComponent(payeeName)}&am=${numDepositAmt}&cu=INR`;

  // 12 Merchant Navigation Items
  const navItems: { id: MerchantNavSection; label: string; icon: any; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Building2 },
    { id: 'add-money', label: 'Add Money', icon: ArrowDownToLine },
    { id: 'make-payout', label: 'Make Payout', icon: Send },
    { id: 'payouts', label: 'Payout History', icon: Clock, count: payouts.length },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'deposits', label: 'Deposit History', icon: ArrowDownToLine, count: deposits.length },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
    { id: 'api-settings', label: 'API Settings', icon: Key },
    { id: 'api-docs', label: 'API Documentation', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'help-support', label: 'Help & Support', icon: HelpCircle },
  ];

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-24 text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading merchant gateway portal...</p>
      </div>
    );
  }

  // Not logged in as merchant view
  if (!merchant) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 sm:p-12 text-white shadow-2xl border border-blue-900/40 text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-600/30 border border-blue-400/40 text-blue-400 mx-auto flex items-center justify-center mb-5 shadow-lg">
            <Building2 className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            B2B Payout Infrastructure
          </span>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white max-w-xl mx-auto">
            Multi-Merchant <span className="text-blue-400">Payout Gateway</span>
          </h1>

          <p className="text-sm text-slate-300 mt-3 max-w-md mx-auto leading-relaxed">
            Automate instant disbursements directly to beneficiary bank accounts with isolated float accounts, PayRupee rails, and developer APIs.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-8 py-3.5 rounded-2xl text-xs shadow-lg shadow-blue-600/30 active:scale-98 transition-all cursor-pointer"
            >
              Sign In / Register Merchant
            </button>
          </div>

          {/* Fee Schedule & KYC Banner */}
          <div className="mt-10 pt-8 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div>
              <div className="text-xs text-slate-400">Deposit Fee</div>
              <div className="text-lg font-black text-white mt-0.5">2.0%</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Payout Fee (&le; ₹100)</div>
              <div className="text-lg font-black text-white mt-0.5">₹3.70</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Payout Fee (&gt; ₹100)</div>
              <div className="text-lg font-black text-white mt-0.5">₹3.80</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">KYC Requirement</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">Zero (No Docs)</div>
            </div>
          </div>
        </div>

        <MerchantAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={loadMerchantData}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 md:pb-12 px-2 sm:px-4">
      {/* 1. Merchant Identity & Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-blue-900/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
              {merchant?.business_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">{merchant?.business_name}</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-500/30">
                  {merchant?.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-0.5 font-mono">
                <span>Code: {merchant?.merchant_code}</span>
                <span>•</span>
                <span>Mobile: {merchant?.mobile_number}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setActiveSection('add-money')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/30 active:scale-98 transition-all cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Add Money</span>
            </button>
            <button
              onClick={() => setActiveSection('make-payout')}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/30 active:scale-98 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Make Payout</span>
            </button>
          </div>
        </div>

        {/* 5 Balance & Float Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Available Balance</span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5 block">
              {formatCurrency(wallet?.available_balance ?? 0)}
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Locked Balance</span>
            <span className="text-lg sm:text-xl font-black text-amber-300 mt-0.5 block">
              {formatCurrency(wallet?.locked_payout_balance ?? 0)}
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Deposited</span>
            <span className="text-lg sm:text-xl font-black text-white mt-0.5 block">
              {formatCurrency(wallet?.total_deposited ?? 0)}
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Paid</span>
            <span className="text-lg sm:text-xl font-black text-white mt-0.5 block">
              {formatCurrency(wallet?.total_paid_out ?? 0)}
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Fees</span>
            <span className="text-lg sm:text-xl font-black text-blue-300 mt-0.5 block">
              {formatCurrency(wallet?.total_fees_paid ?? 0)}
            </span>
          </div>
        </div>

        {/* ₹999 Setup Fee Notice Banner */}
        <div className="mt-4 p-3 bg-amber-500/15 border border-amber-400/30 rounded-2xl flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>One-Time Setup Fee (₹999):</strong> Setup fee payment integration pending final provider decision.
            </span>
          </div>
          <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full uppercase">
            Notice
          </span>
        </div>
      </div>

      {/* 2. Full 12-Section Merchant Navigation Bar */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none flex gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Navigation Section Contents */}

      {/* SECTION 1: DASHBOARD */}
      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-slate-900">Top-Up Payout Float</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deposit funds via UPI with live 2% fee calculation. Status remains PENDING until administrator review.
              </p>
              <button
                onClick={() => setActiveSection('add-money')}
                className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                <span>Add Money Now</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-slate-900">Disburse Instant Payout</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Transfer directly to beneficiary bank account. Exact tiered fee (₹3.70 / ₹3.80) deducted server-side.
              </p>
              <button
                onClick={() => setActiveSection('make-payout')}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                <span>Initiate Transfer</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Recent Payouts Preview */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">Recent Payouts</h3>
                <p className="text-xs text-slate-500">Latest disbursements dispatched from float</p>
              </div>
              <button
                onClick={() => setActiveSection('payouts')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                View All ({payouts.length})
              </button>
            </div>

            {payouts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No payouts dispatched yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payouts.slice(0, 5).map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{p.account_holder_name}</span>
                        {getStatusBadge(p.status)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {p.bank_account_number_masked} • {p.ifsc_code} • Order: {p.order_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900">{formatCurrency(p.amount)}</div>
                      <div className="text-[10px] text-slate-400">{formatDate(p.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Deposits Preview */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">Recent Float Top-Ups</h3>
                <p className="text-xs text-slate-500">Manual UPI deposits submitted for review</p>
              </div>
              <button
                onClick={() => setActiveSection('deposits')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                View All ({deposits.length})
              </button>
            </div>

            {deposits.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No float deposits submitted yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deposits.slice(0, 5).map((d) => (
                  <div key={d.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-slate-900">UTR: {d.utr_number}</span>
                        {getStatusBadge(d.status)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(d.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-700">+{formatCurrency(d.net_credited)}</div>
                      <div className="text-[10px] text-slate-400">Gross: {formatCurrency(d.gross_amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: ADD MONEY (MANUAL UPI DEPOSIT FLOW) */}
      {activeSection === 'add-money' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-2xs max-w-2xl mx-auto">
          <div>
            <h3 className="text-lg font-black text-slate-900">Add Float via UPI</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit your UPI transaction reference number. Net float will be credited after administrator approval.
            </p>
          </div>

          {depositSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">{depositSuccessMsg}</span>
            </div>
          )}

          {depositErrorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-bold">{depositErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleInlineDepositSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Deposit Gross Amount (₹)
              </label>
              <input
                type="number"
                min="100"
                step="100"
                required
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="5000"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Live 2% Fee Calculator */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Gross Transfer Amount:</span>
                <span className="font-bold text-slate-900">{formatCurrency(numDepositAmt)}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-700">
                <span>Platform Deposit Fee (2%):</span>
                <span className="font-bold">-{formatCurrency(liveDepositFee)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-black text-emerald-700">
                <span>Net Credited to Available Float:</span>
                <span className="text-sm">{formatCurrency(liveNetCredited)}</span>
              </div>
            </div>

            {/* QR Code Card */}
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
                placeholder="12-digit UTR from your UPI payment app"
                value={depositUtr}
                onChange={(e) => setDepositUtr(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Submitted status remains <strong>PENDING</strong> until manual administrator review. Float is NEVER auto-credited.
              </p>
            </div>

            <button
              type="submit"
              disabled={submittingDeposit}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {submittingDeposit ? 'Submitting Deposit...' : 'Submit Deposit Request'}
            </button>
          </form>
        </div>
      )}

      {/* SECTION 3: MAKE PAYOUT */}
      {activeSection === 'make-payout' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-2xs max-w-2xl mx-auto">
          <div>
            <h3 className="text-lg font-black text-slate-900">Initiate Bank Payout</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Disburse directly from your float balance to beneficiary bank account
            </p>
          </div>

          {payoutSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">{payoutSuccessMsg}</span>
            </div>
          )}

          {payoutErrorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-bold">{payoutErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleInlinePayoutSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="500"
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
                  value={payoutOrderId}
                  onChange={(e) => setPayoutOrderId(e.target.value)}
                  placeholder="m_ord_1001"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Live Fee Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Beneficiary Receives:</span>
                <span className="font-bold text-slate-900">{formatCurrency(numPayoutAmt)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Payout Fee ({numPayoutAmt <= 100 ? '₹3.70 Tier' : '₹3.80 Tier'}):</span>
                <span className="font-bold text-amber-600">+{formatCurrency(livePayoutFee)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-black text-slate-900">
                <span>Total Deducted from Float:</span>
                <span className="text-sm text-blue-700">{formatCurrency(liveTotalDeducted)}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Available Float: {formatCurrency(wallet?.available_balance ?? 0)}
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
                placeholder="As registered on bank account"
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
                  placeholder="Enter account number"
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
                placeholder="e.g. HDFC0001234"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Authoritative State Transition Notice:</strong>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Payment request has been accepted for processing. Final status will be confirmed after provider verification.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingPayout}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md shadow-blue-600/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {submittingPayout ? 'Submitting Payout...' : `Confirm & Deduct ${formatCurrency(liveTotalDeducted)}`}
            </button>
          </form>
        </div>
      )}

      {/* SECTION 4: PAYOUT HISTORY */}
      {activeSection === 'payouts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(['ALL', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPayoutStatusFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    payoutStatusFilter === filter
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Order ID / Beneficiary..."
                value={payoutSearch}
                onChange={(e) => setPayoutSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
            {payouts
              .filter((p) => payoutStatusFilter === 'ALL' || p.status === payoutStatusFilter)
              .filter(
                (p) =>
                  !payoutSearch ||
                  p.order_id.toLowerCase().includes(payoutSearch.toLowerCase()) ||
                  p.account_holder_name.toLowerCase().includes(payoutSearch.toLowerCase())
              )
              .map((p) => (
                <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{p.account_holder_name}</span>
                      {getStatusBadge(p.status)}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>{p.bank_account_number_masked}</span> • <span>{p.ifsc_code}</span> • Order: <code>{p.order_id}</code>
                    </div>
                    {p.provider_reference_id && (
                      <div className="text-[11px] text-emerald-700 font-mono">
                        Provider Ref / UTR: {p.provider_reference_id}
                      </div>
                    )}
                    {p.rejection_reason && (
                      <div className="text-[11px] text-red-600">Reason: {p.rejection_reason}</div>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-sm font-black text-slate-900">{formatCurrency(p.amount)}</div>
                    <div className="text-[11px] text-slate-400">
                      Fee: {formatCurrency(p.fee_amount)} | Total: {formatCurrency(p.total_deducted)}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatDate(p.created_at)}</div>
                  </div>
                </div>
              ))}
            {payouts.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">No payouts matching your criteria.</div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: WALLET & AUDIT LEDGER */}
      {activeSection === 'wallet' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-black text-slate-900">Float Wallet Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Available Balance</span>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  {formatCurrency(wallet?.available_balance ?? 0)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">In-Transit (Locked)</span>
                <div className="text-xl font-black text-amber-600 mt-1">
                  {formatCurrency(wallet?.locked_payout_balance ?? 0)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Deposited</span>
                <div className="text-xl font-black text-slate-800 mt-1">
                  {formatCurrency(wallet?.total_deposited ?? 0)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Fees Paid</span>
                <div className="text-xl font-black text-blue-600 mt-1">
                  {formatCurrency(wallet?.total_fees_paid ?? 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Immutable Float Ledger */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div>
              <h3 className="text-sm font-black text-slate-900">Immutable Float Audit Ledger</h3>
              <p className="text-xs text-slate-500">Cryptographically sound audit trail of all balance movements</p>
            </div>

            {ledger.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No ledger entries recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {ledger.map((l) => (
                  <div key={l.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{l.entry_type}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatDate(l.created_at)} • Idem: {l.idempotency_key}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className={`font-bold ${l.amount >= 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {l.amount >= 0 ? `+${formatCurrency(l.amount)}` : formatCurrency(l.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Fee: {formatCurrency(l.fee_amount)} | Balance After: {formatCurrency(l.balance_after)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 6: DEPOSIT HISTORY */}
      {activeSection === 'deposits' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDepositStatusFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    depositStatusFilter === filter
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search UTR Number..."
                value={depositSearch}
                onChange={(e) => setDepositSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
            {deposits
              .filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter)
              .filter((d) => !depositSearch || d.utr_number.toLowerCase().includes(depositSearch.toLowerCase()))
              .map((d) => (
                <div key={d.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-900">UTR: {d.utr_number}</span>
                      {getStatusBadge(d.status)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Submitted: {formatDate(d.created_at)}
                      {d.reviewed_at && ` • Reviewed: ${formatDate(d.reviewed_at)}`}
                    </div>
                    {d.admin_notes && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                        Admin Note: {d.admin_notes}
                      </div>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-sm font-black text-emerald-700">
                      +{formatCurrency(d.net_credited)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Gross: {formatCurrency(d.gross_amount)} | Fee (2%): {formatCurrency(d.deposit_fee)}
                    </div>
                  </div>
                </div>
              ))}
            {deposits.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">No float deposits recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 7: REPORTS */}
      {activeSection === 'reports' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-2xs">
          <div>
            <h3 className="text-lg font-black text-slate-900">Financial Reports &amp; Volume Analytics</h3>
            <p className="text-xs text-slate-500 mt-0.5">Authoritative overview of your business float and disbursements</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
              <span className="text-[10px] uppercase font-bold text-blue-700">Total Float Deposited</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatCurrency(wallet?.total_deposited ?? 0)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
              <span className="text-[10px] uppercase font-bold text-purple-700">Total Paid Out</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatCurrency(wallet?.total_paid_out ?? 0)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
              <span className="text-[10px] uppercase font-bold text-amber-700">Total Fees Paid</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatCurrency(wallet?.total_fees_paid ?? 0)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[10px] uppercase font-bold text-emerald-700">Available Float</span>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {formatCurrency(wallet?.available_balance ?? 0)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-600">Total Payouts Dispatched</span>
              <div className="text-xl font-black text-slate-900 mt-1">{payouts.length}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-600">Payout Success Rate</span>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {payouts.length > 0
                  ? `${Math.round(
                      (payouts.filter((p) => p.status === 'SUCCESS').length / payouts.length) * 100
                    )}%`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 8: API SETTINGS */}
      {activeSection === 'api-settings' && (
        <div className="space-y-6">
          <MerchantApiKeysManager
            merchantId={merchant.id}
            keys={apiKeys}
            onRefresh={loadMerchantData}
          />

          <MerchantIpWhitelistManager
            merchantId={merchant.id}
            whitelist={whitelist}
            onRefresh={loadMerchantData}
          />
        </div>
      )}

      {/* SECTION 9: API DOCUMENTATION */}
      {activeSection === 'api-docs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-2xs">
          <div>
            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mb-2">
              REST Specification v1.0
            </span>
            <h3 className="text-lg font-black text-slate-900">Developer API Integration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Programmatically initiate automated disbursements from your ERP or custom backend
            </p>
          </div>

          <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span>Endpoint:</span>
              <span className="text-emerald-400 font-bold">POST https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/merchant-payrupee-payout</span>
            </div>

            <div className="space-y-1 text-slate-300">
              <div className="font-bold text-slate-400">Required Headers:</div>
              <div>X-Client-Id: &lt;YOUR_API_CLIENT_ID&gt;</div>
              <div>X-Client-Secret: &lt;YOUR_API_CLIENT_SECRET&gt;</div>
              <div>X-Idempotency-Key: &lt;UNIQUE_TRANSACTION_KEY&gt;</div>
              <div>Content-Type: application/json</div>
            </div>
          </div>

          {/* Fee Tier Rules */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">Exact Tiered Fee Rules</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">Amount Range</th>
                    <th className="p-3">Fee Amount</th>
                    <th className="p-3">Total Float Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600">
                  <tr>
                    <td className="p-3 font-mono">₹1.00 &ndash; ₹100.00</td>
                    <td className="p-3 font-mono font-bold text-amber-600">₹3.70</td>
                    <td className="p-3 font-mono">Amount + ₹3.70</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono">₹100.01 &ndash; ₹1,000.00</td>
                    <td className="p-3 font-mono font-bold text-amber-600">₹3.80</td>
                    <td className="p-3 font-mono">Amount + ₹3.80</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Request Payload Example */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">Request Body Schema</h4>
            <pre className="bg-slate-950 p-4 rounded-2xl text-[11px] font-mono text-slate-200 overflow-x-auto border border-slate-800">
{`{
  "order_id": "cust_payout_1001",
  "amount": 250.00,
  "recipient": {
    "name": "Ramesh Kumar",
    "account_number": "001201567890",
    "ifsc": "HDFC0001234"
  }
}`}
            </pre>
          </div>

          {/* Responses Specification */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900">Response Lifecycle Codes</h4>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <strong>HTTP 202 Accepted: PROCESSING</strong>
                <p className="text-[11px] text-blue-900 mt-0.5">
                  Payment request has been accepted for processing. Final status will be confirmed after provider verification.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <strong>HTTP 200 OK: SUCCESS (Finalized by Inbound Webhook)</strong>
                <p className="text-[11px] text-emerald-900 mt-0.5">
                  Beneficiary bank confirmed delivery. Locked float deducted and total disbursed updated.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <strong>HTTP 400 Bad Request: FAILED</strong>
                <p className="text-[11px] text-red-900 mt-0.5">
                  Request rejected (e.g. invalid IFSC, insufficient float balance). Float and fee immediately unlocked.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 10: NOTIFICATIONS */}
      {activeSection === 'notifications' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-2xs">
          <div>
            <h3 className="text-lg font-black text-slate-900">Operational Gateway Notifications</h3>
            <p className="text-xs text-slate-500">Live operational alerts regarding your float and disbursements</p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Merchant Account Active</strong>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Your merchant gateway account ({merchant.merchant_code}) is live. Float balance is monitored 24/7.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Automated Float Deductions Active</strong>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Strict pessimistic locking is active. Disbursements cannot exceed available float balance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 11: PROFILE */}
      {activeSection === 'profile' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-2xs max-w-xl mx-auto">
          <div>
            <h3 className="text-lg font-black text-slate-900">Merchant Business Profile</h3>
            <p className="text-xs text-slate-500">B2B Account details and session management</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
              <span className="text-slate-500">Business / Trade Name:</span>
              <strong className="text-slate-900">{merchant.business_name}</strong>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
              <span className="text-slate-500">Merchant Code:</span>
              <strong className="font-mono text-blue-600">{merchant.merchant_code}</strong>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
              <span className="text-slate-500">Registered Mobile:</span>
              <strong className="font-mono text-slate-900">{merchant.mobile_number}</strong>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
              <span className="text-slate-500">Account Type:</span>
              <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                MERCHANT (Isolated)
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
              <span className="text-slate-500">Gateway Status:</span>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                {merchant.status}
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-3 px-4 rounded-2xl text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out from Merchant Account</span>
          </button>
        </div>
      )}

      {/* SECTION 12: HELP & SUPPORT */}
      {activeSection === 'help-support' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-2xs">
          <div>
            <h3 className="text-lg font-black text-slate-900">Merchant Gateway Help &amp; Support</h3>
            <p className="text-xs text-slate-500">Clearing cycles, FAQ, and payout reconciliation guidelines</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">How long does an IMPS payout take?</h4>
              <p className="text-slate-600 leading-relaxed">
                IMPS disbursements clear within 5 to 60 seconds into beneficiary accounts. Provider status updates via webhook.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">How long do float top-ups take to review?</h4>
              <p className="text-slate-600 leading-relaxed">
                Administrator reviews typically clear within 5 to 15 minutes during standard Indian banking hours.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">What happens if a bank payout fails?</h4>
              <p className="text-slate-600 leading-relaxed">
                If the provider returns a definitive rejection or failed webhook, the full principal and gateway fee are automatically credited back to your available float.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">Need immediate gateway assistance?</h4>
              <p className="text-slate-600 leading-relaxed">
                Contact our dedicated B2B gateway desk at <strong>support@lifafa.internal</strong> or reach out on Telegram.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Modals */}
      <MerchantTopUpModal
        isOpen={topUpModalOpen}
        merchantId={merchant.id}
        onClose={() => setTopUpModalOpen(false)}
        onSuccess={loadMerchantData}
      />

      <MerchantNewPayoutModal
        isOpen={newPayoutModalOpen}
        merchantId={merchant.id}
        availableBalance={wallet?.available_balance ?? 0}
        onClose={() => setNewPayoutModalOpen(false)}
        onSuccess={loadMerchantData}
      />
    </div>
  );
};
