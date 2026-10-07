import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  X,
  ExternalLink,
  Lock,
  Search,
  Bell,
  HelpCircle,
  User,
  LogOut,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Info,
  ShieldCheck,
  Download,
  Menu,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import {
  merchantGatewayService,
  type MerchantUpiSettings,
  DEFAULT_MERCHANT_UPI_SETTINGS,
  MERCHANT_UPI_SETTINGS_EVENT,
} from '../services/merchantGatewayService';
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
import { MerchantOnboardingCard } from '../components/merchant/MerchantOnboardingCard';
import { AuthModal } from '../components/auth/AuthModal';
import { MerchantTopUpModal } from '../components/merchant/MerchantTopUpModal';
import { MerchantNewPayoutModal } from '../components/merchant/MerchantNewPayoutModal';
import { MerchantApiKeysManager } from '../components/merchant/MerchantApiKeysManager';
import { MerchantIpWhitelistManager } from '../components/merchant/MerchantIpWhitelistManager';
import { MerchantOrderStatusChecker } from '../components/merchant/MerchantOrderStatusChecker';
import { MerchantApiDocumentation } from '../components/merchant/MerchantApiDocumentation';

export type MerchantNavSection =
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

interface MerchantPortalPageProps {
  onNavigateHome?: () => void;
}

// Restrained fintech status badge with subtle dot indicator
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'SUCCESS':
      return (
        <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
          Payment Completed
        </span>
      );
    case 'APPROVED':
    case 'ACTIVE':
    case 'PAID':
      return (
        <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
          {status === 'PAID' ? 'ACTIVE' : status}
        </span>
      );
    case 'PROCESSING':
      return (
        <span
          className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200"
          title="Payment request accepted for processing. Provider verification pending."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 shrink-0 animate-ping" />
          PROCESSING
        </span>
      );
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'PAYMENT_PENDING':
      return (
        <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          {status === 'PENDING_APPROVAL' ? 'PENDING APPROVAL' : status === 'PAYMENT_PENDING' ? 'PAYMENT PENDING' : status}
        </span>
      );
    case 'FAILED':
    case 'REJECTED':
    case 'REVERSED':
    case 'SUSPENDED':
    case 'PAYMENT_REQUIRED':
      return (
        <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 shrink-0" />
          {status === 'PAYMENT_REQUIRED' ? 'PAYMENT REQUIRED' : status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5 shrink-0" />
          {status}
        </span>
      );
  }
};

// Generic CSV export helper
const exportToCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const MerchantPortalPage: React.FC<MerchantPortalPageProps> = ({ onNavigateHome }) => {
  const { user, merchant: contextMerchant, logout, refreshMerchant, refreshWallet } = useAuth();

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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Modals & Drawers
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [newPayoutModalOpen, setNewPayoutModalOpen] = useState(false);
  const [payoutConfirmModalOpen, setPayoutConfirmModalOpen] = useState(false);
  const [selectedPayoutDetail, setSelectedPayoutDetail] = useState<MerchantPayout | null>(null);
  const [selectedDepositDetail, setSelectedDepositDetail] = useState<MerchantDeposit | null>(null);

  // Filters & Search
  const [payoutSearch, setPayoutSearch] = useState('');
  const [checkerOrderId, setCheckerOrderId] = useState<string>('');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'ALL' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('ALL');
  const [payoutDateFilter, setPayoutDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [depositSearch, setDepositSearch] = useState('');
  const [depositStatusFilter, setDepositStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Manual Add Money Form State
  const [depositAmount, setDepositAmount] = useState<string>('5000');
  const [depositUtr, setDepositUtr] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [depositErrorMsg, setDepositErrorMsg] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Manual Make Payout Form State
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'IMPS'>('UPI');
  const [payoutOrderId, setPayoutOrderId] = useState<string>(`ord_${Date.now().toString().slice(-6)}`);
  const [payoutAmount, setPayoutAmount] = useState<string>('500');
  const [payoutUpiId, setPayoutUpiId] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [submittingPayout, setSubmittingPayout] = useState<boolean>(false);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);
  const [payoutErrorMsg, setPayoutErrorMsg] = useState<string | null>(null);


  // Webhook URL in profile
  const [webhookUrl, setWebhookUrl] = useState<string>('https://api.yourdomain.com/webhooks/lifafa');
  const [webhookSaved, setWebhookSaved] = useState<boolean>(false);

  // Admin-configured UPI collection settings
  const [upiSettings, setUpiSettings] = useState<MerchantUpiSettings>(() => {
    try {
      const item = localStorage.getItem('lifafa_merchant_upi_settings');
      if (item) return { ...DEFAULT_MERCHANT_UPI_SETTINGS, ...JSON.parse(item) };
    } catch (e) {}
    return DEFAULT_MERCHANT_UPI_SETTINGS;
  });
  const [upiQrImageError, setUpiQrImageError] = useState<boolean>(false);

  const loadUpiSettings = useCallback(async () => {
    try {
      const s = await merchantGatewayService.getMerchantUpiSettings();
      setUpiSettings(s);
    } catch (err) {
      console.warn('Error loading merchant UPI settings:', err);
    }
  }, []);

  const loadMerchantData = useCallback(async () => {
    try {
      if (!contextMerchant) {
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
        if (refreshWallet) {
          refreshWallet().catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error loading merchant gateway records:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contextMerchant, refreshMerchant, refreshWallet]);

  useEffect(() => {
    loadMerchantData();
    loadUpiSettings();

    const handleUpiUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<MerchantUpiSettings>;
      if (customEvent.detail) {
        setUpiSettings(customEvent.detail);
        setUpiQrImageError(false);
      }
    };

    window.addEventListener(MERCHANT_UPI_SETTINGS_EVENT, handleUpiUpdate);
    return () => {
      window.removeEventListener(MERCHANT_UPI_SETTINGS_EVENT, handleUpiUpdate);
    };
  }, [loadMerchantData, loadUpiSettings]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadMerchantData();
    loadUpiSettings();
    if (refreshWallet) {
      refreshWallet().catch(() => {});
    }
  };

  const handleCopyUpi = () => {
    if (!upiSettings.upiId) return;
    navigator.clipboard.writeText(upiSettings.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };


  // Inline Deposit Submission
  const handleInlineDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;
    setDepositErrorMsg(null);
    setDepositSuccessMsg(null);

    if (upiSettings.status === 'INACTIVE') {
      setDepositErrorMsg('UPI collection is temporarily unavailable.');
      return;
    }

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

    const depCalc = merchantGatewayService.calculateDepositFee(grossNum);
    const payableAmount = depCalc.totalPayable;
    const walletCredit = depCalc.walletCredit;

    try {
      setSubmittingDeposit(true);
      await merchantGatewayService.submitDeposit({
        merchantId: merchant.id,
        grossAmount: payableAmount,
        utrNumber: cleanUtr,
      });

      setDepositSuccessMsg(`Float top-up of ₹${walletCredit} (Total Paid: ₹${payableAmount} incl. 2% fee) submitted! Status: PENDING admin verification.`);
      setDepositUtr('');
      await loadMerchantData();
      if (refreshWallet) {
        refreshWallet().catch(() => {});
      }
      setTimeout(() => setDepositSuccessMsg(null), 6000);
    } catch (err: any) {
      setDepositErrorMsg(err.message || 'Failed to submit float deposit request');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  // Inline Payout Validation & Review Step
  const handleReviewPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;
    setPayoutErrorMsg(null);
    setPayoutSuccessMsg(null);

    const amtNum = parseFloat(payoutAmount) || 0;
    if (amtNum <= 0) {
      setPayoutErrorMsg('Please enter a valid payout amount');
      return;
    }

    if (amtNum > 5000) {
      setPayoutErrorMsg('Maximum payout amount per transaction is ₹5,000.00');
      return;
    }

    const { totalDeducted } = merchantGatewayService.calculatePayoutFee(amtNum);
    const available = wallet?.available_balance ?? 0;

    if (totalDeducted > available) {
      setPayoutErrorMsg(
        `Insufficient float balance. Required: ${formatCurrency(totalDeducted)}, Available: ${formatCurrency(available)}`
      );
      return;
    }

    const cleanUpi = payoutUpiId.trim().toLowerCase();
    if (!cleanUpi || !cleanUpi.includes('@') || !/^[a-zA-Z0-9._-]{2,255}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      setPayoutErrorMsg('Please enter a valid UPI ID (e.g. name@okhdfcbank or 9876543210@paytm)');
      return;
    }

    // Open confirmation step modal
    setPayoutConfirmModalOpen(true);
  };

  // Final Confirmed Payout Submission (UPI Only)
  const handleFinalPayoutDispatch = async () => {
    if (!merchant) return;
    const amtNum = parseFloat(payoutAmount) || 0;

    try {
      setSubmittingPayout(true);
      await merchantGatewayService.createPayout({
        orderId: payoutOrderId.trim(),
        amount: amtNum,
        method: 'UPI',
        upiId: payoutUpiId.trim().toLowerCase(),
      });

      setPayoutConfirmModalOpen(false);
      setPayoutSuccessMsg('Payment Completed');
      setPayoutOrderId(`ord_${Date.now().toString().slice(-6)}`);
      setPayoutUpiId('');
      await loadMerchantData();
      if (refreshWallet) {
        refreshWallet().catch(() => {});
      }
      setTimeout(() => setPayoutSuccessMsg(null), 7000);
    } catch (err: any) {
      setPayoutConfirmModalOpen(false);
      setPayoutErrorMsg(err.message || 'Unable to initiate payout. Please try again.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  // Live Payout fee calculation (Unified tiered slabs)
  const numPayoutAmt = parseFloat(payoutAmount) || 0;
  const { fee: livePayoutFee, totalDeducted: liveTotalDeducted } = merchantGatewayService.calculatePayoutFee(numPayoutAmt);

  // Live Deposit fee calculation (Unified 2% deposit fee)
  const numDepositAmt = parseFloat(depositAmount) || 0;
  const liveDepCalc = merchantGatewayService.calculateDepositFee(numDepositAmt);
  const liveDepositFee = liveDepCalc.fee;
  const liveTotalPayable = liveDepCalc.totalPayable;
  const liveNetCredited = liveDepCalc.walletCredit;
  const dynamicUpiUri = `upi://pay?pa=${encodeURIComponent(upiSettings.upiId || 'createlifafa@upi')}&pn=${encodeURIComponent(upiSettings.payeeName || 'Createlifafa Payout Gateway')}&am=${liveTotalPayable}&cu=INR`;

  // Real Metric Calculations (NO FAKE DATA)
  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const todayPayouts = payouts.filter((p) => new Date(p.created_at).toDateString() === today);
    const todayVolume = todayPayouts
      .filter((p) => p.status === 'SUCCESS' || p.status === 'PROCESSING')
      .reduce((sum, p) => sum + p.amount, 0);

    const monthPayouts = payouts.filter((p) => {
      const d = new Date(p.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthlyVolume = monthPayouts
      .filter((p) => p.status === 'SUCCESS' || p.status === 'PROCESSING')
      .reduce((sum, p) => sum + p.amount, 0);

    const successCount = payouts.filter((p) => p.status === 'SUCCESS').length;
    const successRate = payouts.length > 0 ? ((successCount / payouts.length) * 100).toFixed(1) + '%' : '100%';

    return {
      todayVolume,
      todayCount: todayPayouts.length,
      monthlyVolume,
      successRate,
      successCount,
    };
  }, [payouts]);

  // Date filter helper
  const isWithinDateFilter = (dateStr: string, filter: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH') => {
    if (filter === 'ALL') return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (filter === 'TODAY') {
      return d.toDateString() === now.toDateString();
    }
    if (filter === 'WEEK') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (filter === 'MONTH') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Filtered Payouts
  const filteredPayouts = useMemo(() => {
    return payouts
      .filter((p) => payoutStatusFilter === 'ALL' || p.status === payoutStatusFilter)
      .filter((p) => isWithinDateFilter(p.created_at, payoutDateFilter))
      .filter(
        (p) =>
          !payoutSearch ||
          p.order_id.toLowerCase().includes(payoutSearch.toLowerCase()) ||
          (p.account_holder_name && p.account_holder_name.toLowerCase().includes(payoutSearch.toLowerCase())) ||
          (p.bank_account_number_masked && p.bank_account_number_masked.toLowerCase().includes(payoutSearch.toLowerCase())) ||
          (p.upi_id && p.upi_id.toLowerCase().includes(payoutSearch.toLowerCase())) ||
          (p.provider_reference_id && p.provider_reference_id.toLowerCase().includes(payoutSearch.toLowerCase()))
      );
  }, [payouts, payoutStatusFilter, payoutDateFilter, payoutSearch]);

  // Filtered Deposits
  const filteredDeposits = useMemo(() => {
    return deposits
      .filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter)
      .filter(
        (d) =>
          !depositSearch ||
          d.utr_number.toLowerCase().includes(depositSearch.toLowerCase()) ||
          d.id.toLowerCase().includes(depositSearch.toLowerCase())
      );
  }, [deposits, depositStatusFilter, depositSearch]);

  // CSV Exporters
  const handleExportPayouts = () => {
    const headers = ['Order ID', 'Method', 'Beneficiary / VPA', 'Account / VPA', 'IFSC', 'Amount', 'Fee', 'Total Deducted', 'Status', 'UTR Ref', 'Date'];
    const rows = filteredPayouts.map((p) => [
      p.order_id,
      p.payout_method || (p.upi_id ? 'UPI' : 'IMPS'),
      p.account_holder_name || p.upi_id || '',
      p.upi_id || p.bank_account_number_masked || '',
      p.ifsc_code || '',
      p.amount,
      p.fee_amount,
      p.total_deducted,
      p.status,
      p.provider_reference_id || '',
      p.created_at,
    ]);
    exportToCsv(`merchant_payouts_${Date.now()}.csv`, headers, rows);
  };

  const handleExportDeposits = () => {
    const headers = ['Deposit ID', 'Gross Amount', 'Fee', 'Net Credited', 'UTR Number', 'Status', 'Submitted At', 'Reviewed At', 'Admin Notes'];
    const rows = filteredDeposits.map((d) => [
      d.id,
      d.gross_amount,
      d.deposit_fee,
      d.net_credited,
      d.utr_number,
      d.status,
      d.created_at,
      d.reviewed_at || '',
      d.admin_notes || '',
    ]);
    exportToCsv(`merchant_deposits_${Date.now()}.csv`, headers, rows);
  };

  const handleExportLedger = () => {
    const headers = ['Date', 'Entry Type', 'Amount', 'Fee', 'Balance After', 'Idempotency Key'];
    const rows = ledger.map((l) => [
      l.created_at,
      l.entry_type,
      l.amount,
      l.fee_amount,
      l.balance_after,
      l.idempotency_key,
    ]);
    exportToCsv(`merchant_ledger_${Date.now()}.csv`, headers, rows);
  };

  // 12 Standard Merchant Navigation Items
  const navItems: { id: MerchantNavSection; label: string; icon: any; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Building2 },
    { id: 'add-money', label: 'Add Money', icon: ArrowDownToLine },
    { id: 'make-payout', label: 'Make Payout', icon: Send },
    { id: 'payouts', label: 'Payout History', icon: Clock, count: payouts.length },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'deposits', label: 'Deposit History', icon: FileText, count: deposits.length },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
    { id: 'api-settings', label: 'API Settings', icon: Key },
    { id: 'api-docs', label: 'API Documentation', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: 2 },
    { id: 'profile', label: 'Profile & Settings', icon: User },
    { id: 'help-support', label: 'Help & Support', icon: HelpCircle },
  ];

  // Section Title & Subtitle Map
  const sectionMeta: Record<MerchantNavSection, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Real-time overview of merchant float and disbursement activity' },
    'add-money': { title: 'Add Float via UPI', subtitle: 'Deposit funds to payout balance with instant 2% fee calculation' },
    'make-payout': { title: 'Make Payout', subtitle: 'Disburse funds directly to beneficiary accounts via PayNit instant UPI rails' },
    payouts: { title: 'Payout History', subtitle: 'Searchable audit log of all bank transfers and disbursement statuses' },
    wallet: { title: 'Float Wallet & Ledger', subtitle: 'Double-entry balance audit ledger and float movement records' },
    deposits: { title: 'Deposit History', subtitle: 'Record of manual UPI float deposits and administrative clearing' },
    reports: { title: 'Financial Reports', subtitle: 'Volume analytics, disbursement success rates, and fee summaries' },
    'api-settings': { title: 'API Settings & Security', subtitle: 'Manage developer credentials and authorized server IP whitelists' },
    'api-docs': { title: 'API Documentation', subtitle: 'Technical integration specifications, cURL examples, and webhook events' },
    notifications: { title: 'Gateway Notifications', subtitle: 'Operational alerts regarding float thresholds and transaction events' },
    profile: { title: 'Merchant Profile', subtitle: 'Business identity, fee tier configuration, and webhook endpoints' },
    'help-support': { title: 'Help & Support', subtitle: 'Clearing cycle guidelines, UTR resolution, and failure codes reference' },
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-xs text-center max-w-sm w-full">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">Loading Merchant Gateway</h3>
          <p className="text-xs text-slate-500 mt-1">Connecting to isolated float rails...</p>
        </div>
      </div>
    );
  }

  // Not logged in or not a merchant view
  if (!merchant) {
    if (!user) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg shadow-xs p-8 text-center space-y-6">
            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 mx-auto flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>

            <div>
              <span className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 uppercase tracking-wider mb-2">
                B2B Payout Infrastructure
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Createlifafa.xyz Merchant Gateway
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto">
                Automated disbursements via PayNit instant UPI rails with isolated merchant float wallets and developer APIs.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-md text-sm shadow-xs transition-colors cursor-pointer"
              >
                <span>Sign In with Google to Access Portal</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Specifications */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Setup Fee</div>
                <div className="text-sm font-semibold text-emerald-700 mt-0.5">₹0 (Free)</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Payout Fee</div>
                <div className="text-sm font-semibold font-mono text-slate-900 mt-0.5">₹2.50 Flat</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Payout Rails</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">Instant UPI</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Activation</div>
                <div className="text-sm font-semibold text-blue-700 mt-0.5">Instant Zero-KYC</div>
              </div>
            </div>

            {onNavigateHome && (
              <div className="pt-2">
                <button
                  onClick={onNavigateHome}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Consumer App</span>
                </button>
              </div>
            )}
          </div>

          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <MerchantOnboardingCard onSuccess={loadMerchantData} />
          {onNavigateHome && (
            <div className="text-center mt-4">
              <button
                onClick={onNavigateHome}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Consumer App</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sidebar navigation item component
  const NavButton: React.FC<{ item: (typeof navItems)[0]; onClick?: () => void }> = ({ item, onClick }) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    return (
      <button
        onClick={() => {
          setActiveSection(item.id);
          if (onClick) onClick();
        }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
          isActive
            ? 'bg-blue-50 text-blue-700 font-semibold'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
          <span className="truncate">{item.label}</span>
        </div>
        {typeof item.count === 'number' && item.count > 0 && (
          <span
            className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ${
              isActive ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {item.count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* ======================================================== */}
      {/* 1. FIXED DESKTOP LEFT SIDEBAR (250px)                   */}
      {/* ======================================================== */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 h-screen sticky top-0 justify-between select-none">
        {/* Top Branding & Merchant Identity */}
        <div className="p-4 space-y-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold tracking-tight text-slate-900 block leading-tight">Createlifafa.xyz</span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">Payout Gateway</span>
              </div>
            </div>
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Merchant Account Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-900 truncate" title={merchant.business_name}>
                {merchant.business_name}
              </span>
              <StatusBadge status={merchant.status} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
              <span>Code: {merchant.merchant_code}</span>
              <span>{merchant.mobile_number}</span>
            </div>
          </div>
        </div>

        {/* Middle Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-thin">
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Operations
          </div>
          {navItems.slice(0, 7).map((item) => (
            <NavButton key={item.id} item={item} />
          ))}

          <div className="pt-3 px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Developers &amp; System
          </div>
          {navItems.slice(7).map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
        </nav>

        {/* Bottom Switcher & Sign Out */}
        <div className="p-3 border-t border-slate-200 space-y-1.5 bg-slate-50/50">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Back to Createlifafa.xyz</span>
            </button>
          )}

          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MOBILE DRAWER SIDEBAR (< lg screens)                 */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-xl flex flex-col justify-between z-10">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Createlifafa.xyz Merchant</span>
                  <span className="text-[10px] text-slate-500 font-mono">Code: {merchant.merchant_code}</span>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  onClick={() => setMobileDrawerOpen(false)}
                />
              ))}
            </nav>

            <div className="p-3 border-t border-slate-200 space-y-1 bg-slate-50">
              {onNavigateHome && (
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onNavigateHome();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                  <span>Back to Createlifafa.xyz</span>
                </button>
              )}
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MAIN CONTENT AREA & TOP HEADER                        */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header in Main Area */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger trigger for mobile */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                {sectionMeta[activeSection].title}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block truncate">
                {sectionMeta[activeSection].subtitle}
              </p>
            </div>
          </div>

          {/* Right Header Controls: Float balance pill & quick actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Float Balance Pill */}
            <div
              onClick={() => setActiveSection('wallet')}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer transition-colors"
              title="Click to view Float Ledger"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block leading-tight">Float Balance</span>
                <span className="text-xs font-bold font-mono text-slate-900 leading-tight">
                  {formatCurrency(wallet?.available_balance ?? 0)}
                </span>
              </div>
            </div>

            {/* Quick Action: Add Money */}
            <button
              onClick={() => setActiveSection('add-money')}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Money</span>
            </button>

            {/* Quick Action: Make Payout */}
            <button
              onClick={() => setActiveSection('make-payout')}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Make Payout</span>
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setActiveSection('notifications')}
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
            </button>

            {/* Refresh Action */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </header>

        {/* Main Content Body Container */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {merchant?.status === 'SUSPENDED' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-xs text-red-800 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Your merchant account is currently suspended. Automatic payouts are disabled. Contact platform support.</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 1: DASHBOARD (OVERVIEW)                          */}
          {/* ======================================================== */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Balance & Float Financial Block */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Float Balance</span>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-0.5">
                      {formatCurrency(wallet?.available_balance ?? 0)}
                    </div>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Disbursements are instantly debited from this balance with zero delay.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveSection('add-money')}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 py-2 rounded-md shadow-xs transition-colors cursor-pointer"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Top-Up Float</span>
                    </button>
                    <button
                      onClick={() => setActiveSection('make-payout')}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-md shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Disburse Payout</span>
                    </button>
                  </div>
                </div>

                {/* Sub-balances grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 uppercase">In-Transit (Locked)</span>
                    <div className="text-base font-semibold font-mono text-amber-600 mt-0.5">
                      {formatCurrency(wallet?.locked_payout_balance ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 uppercase">Total Deposited</span>
                    <div className="text-base font-semibold font-mono text-slate-800 mt-0.5">
                      {formatCurrency(wallet?.total_deposited ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 uppercase">Total Paid Out</span>
                    <div className="text-base font-semibold font-mono text-slate-800 mt-0.5">
                      {formatCurrency(wallet?.total_paid_out ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 uppercase">Total Fees Paid</span>
                    <div className="text-base font-semibold font-mono text-slate-800 mt-0.5">
                      {formatCurrency(wallet?.total_fees_paid ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Stat Metric Row (Derived strictly from REAL data) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <span className="text-[11px] font-medium text-slate-500 uppercase">Today's Payout Volume</span>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                    {formatCurrency(metrics.todayVolume)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">{metrics.todayCount} transfers today</span>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <span className="text-[11px] font-medium text-slate-500 uppercase">Today's Payout Count</span>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                    {metrics.todayCount}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Dispatches</span>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <span className="text-[11px] font-medium text-slate-500 uppercase">Monthly Volume</span>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                    {formatCurrency(metrics.monthlyVolume)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Current calendar month</span>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <span className="text-[11px] font-medium text-slate-500 uppercase">Success Rate</span>
                  <div className="text-lg font-bold font-mono text-emerald-600 mt-1">
                    {metrics.successRate}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">{metrics.successCount} of {payouts.length} successful</span>
                </div>
              </div>

              {/* Quick Developer & Integration Status Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">API Integration Status</h4>
                    <p className="text-[11px] text-slate-500">
                      API Keys: {apiKeys.length > 0 ? `${apiKeys.length} configured` : 'None'} • IP Whitelist:{' '}
                      {whitelist.length > 0 ? `${whitelist.length} IPs active` : 'Open / Unrestricted'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveSection('api-settings')}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage Credentials</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Recent Payouts Table (Compact 5 rows) */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Recent Disbursements</h3>
                    <p className="text-[11px] text-slate-500">Latest bank transfers initiated from merchant float</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('payouts')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All Payouts ({payouts.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {payouts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No payouts dispatched yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-2.5">Order ID</th>
                          <th className="px-4 py-2.5">Beneficiary</th>
                          <th className="px-4 py-2.5">Account / IFSC</th>
                          <th className="px-4 py-2.5">Amount</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {payouts.slice(0, 5).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-slate-900">{p.order_id}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">{p.account_holder_name}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">
                              {p.bank_account_number_masked} • {p.ifsc_code}
                            </td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                              {formatDate(p.created_at)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => setSelectedPayoutDetail(p)}
                                className="text-blue-600 hover:text-blue-800 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Deposits Table (Compact 5 rows) */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Recent Float Top-Ups</h3>
                    <p className="text-[11px] text-slate-500">Manual UPI deposits submitted for administrative review</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('deposits')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All Deposits ({deposits.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {deposits.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No float deposits submitted yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-2.5">UTR Reference</th>
                          <th className="px-4 py-2.5">Gross Amount</th>
                          <th className="px-4 py-2.5">Platform Fee (2%)</th>
                          <th className="px-4 py-2.5">Net Float Credited</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {deposits.slice(0, 5).map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-slate-900">{d.utr_number}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-700">{formatCurrency(d.gross_amount)}</td>
                            <td className="px-4 py-2.5 font-mono text-amber-600">-{formatCurrency(d.deposit_fee)}</td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-emerald-700">
                              +{formatCurrency(d.net_credited)}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={d.status} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                              {formatDate(d.created_at)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => setSelectedDepositDetail(d)}
                                className="text-blue-600 hover:text-blue-800 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 2: ADD MONEY (FLOAT TOP-UP)                      */}
          {/* ======================================================== */}
          {activeSection === 'add-money' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Amount & Live Fee Breakdown */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                  <div className="pb-3 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-900">Step 1: Select Amount &amp; Scan UPI</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Platform fee is exactly 2.0% deducted at clearing.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Deposit Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="5000"
                      className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-mono font-semibold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />

                    {/* Quick amount chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[1000, 5000, 10000, 25000, 50000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositAmount(String(amt))}
                          className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                            depositAmount === String(amt)
                              ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          ₹{amt.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fee Breakdown Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Deposit Amount:</span>
                      <span className="font-mono font-medium text-slate-900">{formatCurrency(numDepositAmt)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Deposit Fee (2.0%):</span>
                      <span className="font-mono font-medium text-amber-700">+{formatCurrency(liveDepositFee)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-semibold text-slate-900">
                      <span>Total Payable:</span>
                      <span className="font-mono text-sm text-blue-700">{formatCurrency(liveTotalPayable)}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-200 flex justify-between font-semibold text-emerald-700">
                      <span>Float Credited to Wallet:</span>
                      <span className="font-mono text-sm">{formatCurrency(liveNetCredited)}</span>
                    </div>
                  </div>

                  {/* Admin-Configured UPI QR Code / Inactive Fallback */}
                  {upiSettings.status === 'INACTIVE' ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-900 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>UPI collection is temporarily unavailable.</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-relaxed pl-6">
                        Float deposits via UPI are temporarily paused by platform administrators. Please try again later or contact support.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-4">
                      <div className="p-1.5 bg-white rounded border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center">
                        {upiSettings.qrImageUrl && !upiQrImageError ? (
                          <img
                            src={upiSettings.qrImageUrl}
                            alt="Merchant Float UPI QR"
                            onError={() => setUpiQrImageError(true)}
                            className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded"
                          />
                        ) : (
                          <QRCodeSVG value={dynamicUpiUri} size={90} />
                        )}
                      </div>
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Payee UPI Identifier
                        </span>
                        <div className="font-medium text-slate-800">{upiSettings.payeeName}</div>
                        <div className="flex items-center gap-1.5 font-mono text-slate-600 text-[11px]">
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
                </div>

                {/* Right Column: UTR Submission Form */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                  <div className="pb-3 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-900">Step 2: Submit Bank Reference / UTR</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter the 12-digit UTR from your bank or UPI payment app.
                    </p>
                  </div>

                  {depositSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{depositSuccessMsg}</span>
                    </div>
                  )}

                  {depositErrorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{depositErrorMsg}</span>
                    </div>
                  )}

                  {upiSettings.status === 'INACTIVE' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold">UPI collection is temporarily unavailable. Submission disabled.</span>
                    </div>
                  )}

                  <form onSubmit={handleInlineDepositSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Bank UTR / UPI Transaction Reference (12 digits)
                      </label>
                      <input
                        type="text"
                        required
                        disabled={upiSettings.status === 'INACTIVE'}
                        placeholder="e.g. 423512345678"
                        value={depositUtr}
                        onChange={(e) => setDepositUtr(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-md border border-slate-300 text-xs font-mono font-semibold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 space-y-1">
                      <div className="font-semibold text-slate-800">Clearing &amp; Reconciliation Notice</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Deposits are credited to your available payout float within 5–15 minutes after administrator verification. Float is never credited prior to banking confirmation.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingDeposit || upiSettings.status === 'INACTIVE'}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-md text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {upiSettings.status === 'INACTIVE'
                        ? 'UPI Collection Unavailable'
                        : submittingDeposit
                        ? 'Submitting Reference...'
                        : 'Submit Deposit for Verification'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Recent Top-Up Requests below */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-900">Your Top-Up History</h3>
                </div>
                {deposits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">No deposit requests recorded.</div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {deposits.slice(0, 5).map((d) => (
                      <div key={d.id} className="p-3.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-900">UTR: {d.utr_number}</span>
                            <StatusBadge status={d.status} />
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">{formatDate(d.created_at)}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-semibold text-emerald-700">+{formatCurrency(d.net_credited)}</span>
                          <span className="text-[11px] text-slate-400 block font-mono">Gross: {formatCurrency(d.gross_amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 3: MAKE PAYOUT (DISBURSE)                        */}
          {/* ======================================================== */}
          {activeSection === 'make-payout' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Initiate Instant Payout</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Direct disbursement via PayNit Instant UPI rails (24x7 Settlement)
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    Float: {formatCurrency(wallet?.available_balance ?? 0)}
                  </span>
                </div>

                {payoutSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{payoutSuccessMsg}</span>
                  </div>
                )}

                {payoutErrorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{payoutErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleReviewPayout} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Payout Amount (₹) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="5000"
                        step="any"
                        required
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="500"
                        className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm font-mono font-semibold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Merchant Order / Transfer ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={payoutOrderId}
                        onChange={(e) => setPayoutOrderId(e.target.value)}
                        placeholder="ord_1001"
                        className="w-full px-3 py-2 rounded-md border border-slate-300 text-xs font-mono font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Real-time Fee Deduction Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Beneficiary Receives:</span>
                      <span className="font-mono font-semibold text-slate-900">{formatCurrency(numPayoutAmt)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Payout Fee:</span>
                      <span className="font-mono font-semibold text-amber-700">+{formatCurrency(livePayoutFee)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-semibold text-slate-900">
                      <span>Total Deduction from Float:</span>
                      <span className="font-mono text-sm text-blue-700">{formatCurrency(liveTotalDeducted)}</span>
                    </div>
                    {liveTotalDeducted > (wallet?.available_balance ?? 0) && (
                      <div className="pt-1 text-[11px] text-red-600 font-medium">
                        Warning: Total deduction exceeds your available float balance.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Beneficiary UPI ID (VPA) *
                    </label>
                    <input
                      type="text"
                      required
                      value={payoutUpiId}
                      onChange={(e) => setPayoutUpiId(e.target.value)}
                      placeholder="e.g. name@okhdfcbank or 9876543210@paytm"
                      className="w-full px-3 py-2 rounded-md border border-slate-300 text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Disbursed directly via PayNit instant UPI rails</p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      Payouts are processed instantly via automated PayNit UPI rails. Verify beneficiary details carefully before confirming.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Review Payout &amp; Confirm
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 4: PAYOUT HISTORY                                */}
          {/* ======================================================== */}
          {activeSection === 'payouts' && (
            <div className="space-y-4">
              {/* Order ID Status Check & Safe Reconcile */}
              <MerchantOrderStatusChecker
                initialOrderId={checkerOrderId}
                key={checkerOrderId}
                onStatusChecked={loadMerchantData}
              />

              {/* Filter & Search Bar */}
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Status tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {(['ALL', 'SUCCESS', 'PROCESSING', 'PENDING', 'FAILED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setPayoutStatusFilter(filter)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        payoutStatusFilter === filter
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {filter === 'SUCCESS' ? 'Payment Completed' : filter}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {/* Date range dropdown */}
                  <select
                    value={payoutDateFilter}
                    onChange={(e) => setPayoutDateFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 focus:outline-hidden"
                  >
                    <option value="ALL">All Time</option>
                    <option value="TODAY">Today</option>
                    <option value="WEEK">Last 7 Days</option>
                    <option value="MONTH">This Month</option>
                  </select>

                  {/* Search box */}
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search order / beneficiary..."
                      value={payoutSearch}
                      onChange={(e) => setPayoutSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  {/* CSV Export */}
                  <button
                    onClick={handleExportPayouts}
                    className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                    title="Export Payouts as CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                {filteredPayouts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No payouts found matching your search or filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-2.5">Transfer ID</th>
                          <th className="px-4 py-2.5">Method</th>
                          <th className="px-4 py-2.5">Beneficiary / VPA</th>
                          <th className="px-4 py-2.5">Destination</th>
                          <th className="px-4 py-2.5">Amount</th>
                          <th className="px-4 py-2.5">Fee</th>
                          <th className="px-4 py-2.5">Total Deducted</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Provider UTR</th>
                          <th className="px-4 py-2.5">Date &amp; Time</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredPayouts.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPayoutDetail(p)}
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-2.5 font-mono text-slate-900 font-medium">{p.order_id}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                (p.payout_method === 'UPI' || p.upi_id)
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {(p.payout_method === 'UPI' || p.upi_id) ? 'UPI' : 'IMPS'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {p.account_holder_name || p.upi_id || '—'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">
                              {(p.payout_method === 'UPI' || p.upi_id) ? (
                                <span className="text-blue-700 font-semibold">{p.upi_id || '—'}</span>
                              ) : (
                                <span>{p.bank_account_number_masked || '••••'} {p.ifsc_code ? `• ${p.ifsc_code}` : ''}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-amber-700">
                              {formatCurrency(p.fee_amount)}
                            </td>
                            <td className="px-4 py-2.5 font-mono font-medium text-slate-800">
                              {formatCurrency(p.total_deducted)}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                              {p.provider_reference_id || '—'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                              {formatDate(p.created_at)}
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPayoutDetail(p);
                                }}
                                className="text-slate-600 hover:text-slate-900 font-medium text-[11px] cursor-pointer"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCheckerOrderId(p.order_id);
                                  window.scrollTo({ top: 100, behavior: 'smooth' });
                                }}
                                className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-100 transition-colors"
                                title="Check real-time provider status"
                              >
                                <Search className="w-2.5 h-2.5" />
                                <span>Check Status</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 5: WALLET (FLOAT & LEDGER)                       */}
          {/* ======================================================== */}
          {activeSection === 'wallet' && (
            <div className="space-y-6">
              {/* Balance Summary Card */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-semibold uppercase text-slate-500">Float Wallet Ledger</span>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                      {formatCurrency(wallet?.available_balance ?? 0)}
                    </div>
                  </div>
                  <button
                    onClick={handleExportLedger}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Statement CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-medium">In-Transit Locked</span>
                    <div className="text-sm font-semibold font-mono text-amber-600 mt-0.5">
                      {formatCurrency(wallet?.locked_payout_balance ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-medium">Total Top-Ups</span>
                    <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                      {formatCurrency(wallet?.total_deposited ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-medium">Total Paid Out</span>
                    <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                      {formatCurrency(wallet?.total_paid_out ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-medium">Total Fees Paid</span>
                    <div className="text-sm font-semibold font-mono text-slate-800 mt-0.5">
                      {formatCurrency(wallet?.total_fees_paid ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Immutable Double-Entry Ledger Table */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-900">Float Audit Trail</h3>
                  <p className="text-[11px] text-slate-500">Pessimistically locked double-entry financial journal</p>
                </div>

                {ledger.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No ledger entries recorded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-2.5">Date &amp; Time</th>
                          <th className="px-4 py-2.5">Transaction Type</th>
                          <th className="px-4 py-2.5">Idempotency Key</th>
                          <th className="px-4 py-2.5">Amount</th>
                          <th className="px-4 py-2.5">Fee</th>
                          <th className="px-4 py-2.5 text-right">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {ledger.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{formatDate(l.created_at)}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">{l.entry_type}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 truncate max-w-xs">{l.idempotency_key}</td>
                            <td className="px-4 py-2.5 font-mono font-semibold">
                              <span className={l.amount >= 0 ? 'text-emerald-700' : 'text-slate-800'}>
                                {l.amount >= 0 ? `+${formatCurrency(l.amount)}` : formatCurrency(l.amount)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">{formatCurrency(l.fee_amount)}</td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-right text-slate-900">
                              {formatCurrency(l.balance_after)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 6: DEPOSIT HISTORY                               */}
          {/* ======================================================== */}
          {activeSection === 'deposits' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setDepositStatusFilter(filter)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        depositStatusFilter === filter
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search UTR number..."
                      value={depositSearch}
                      onChange={(e) => setDepositSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <button
                    onClick={handleExportDeposits}
                    className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                    title="Export Deposits as CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                {filteredDeposits.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No float deposits recorded matching your filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-2.5">UTR Reference</th>
                          <th className="px-4 py-2.5">Gross Amount</th>
                          <th className="px-4 py-2.5">Fee (2%)</th>
                          <th className="px-4 py-2.5">Net Float Credited</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Submitted At</th>
                          <th className="px-4 py-2.5">Reviewed At</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredDeposits.map((d) => (
                          <tr
                            key={d.id}
                            onClick={() => setSelectedDepositDetail(d)}
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-2.5 font-mono text-slate-900 font-semibold">{d.utr_number}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-700">{formatCurrency(d.gross_amount)}</td>
                            <td className="px-4 py-2.5 font-mono text-amber-700">-{formatCurrency(d.deposit_fee)}</td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-emerald-700">
                              +{formatCurrency(d.net_credited)}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={d.status} />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{formatDate(d.created_at)}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{d.reviewed_at ? formatDate(d.reviewed_at) : '—'}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDepositDetail(d);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-medium text-[11px] cursor-pointer"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 7: REPORTS                                       */}
          {/* ======================================================== */}
          {activeSection === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Volume Analytics &amp; Expenditure</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Authoritative financial summary calculated from real ledger data</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportPayouts}
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Payouts CSV</span>
                    </button>
                    <button
                      onClick={handleExportDeposits}
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Deposits CSV</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium uppercase">Gross Disbursed</span>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {formatCurrency(wallet?.total_paid_out ?? 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium uppercase">Gross Float Added</span>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {formatCurrency(wallet?.total_deposited ?? 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium uppercase">Total Fees Paid</span>
                    <div className="text-lg font-bold font-mono text-amber-700 mt-1">
                      {formatCurrency(wallet?.total_fees_paid ?? 0)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium uppercase">Success Rate</span>
                    <div className="text-lg font-bold font-mono text-emerald-600 mt-1">
                      {metrics.successRate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Table */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                  Payout Status Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-emerald-50/50 rounded-md border border-emerald-100">
                    <span className="text-emerald-700 font-medium">Payment Completed</span>
                    <div className="text-base font-bold font-mono text-emerald-900 mt-0.5">
                      {payouts.filter((p) => p.status === 'SUCCESS').length}
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50/50 rounded-md border border-blue-100">
                    <span className="text-blue-700 font-medium">Processing</span>
                    <div className="text-base font-bold font-mono text-blue-900 mt-0.5">
                      {payouts.filter((p) => p.status === 'PROCESSING').length}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50/50 rounded-md border border-amber-100">
                    <span className="text-amber-700 font-medium">Pending</span>
                    <div className="text-base font-bold font-mono text-amber-900 mt-0.5">
                      {payouts.filter((p) => p.status === 'PENDING').length}
                    </div>
                  </div>
                  <div className="p-3 bg-red-50/50 rounded-md border border-red-100">
                    <span className="text-red-700 font-medium">Failed / Reversed</span>
                    <div className="text-base font-bold font-mono text-red-900 mt-0.5">
                      {payouts.filter((p) => p.status === 'FAILED' || p.status === 'REVERSED').length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 8: API SETTINGS                                  */}
          {/* ======================================================== */}
          {activeSection === 'api-settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-6">
                <MerchantApiKeysManager
                  merchantId={merchant.id}
                  keys={apiKeys}
                  onRefresh={loadMerchantData}
                />

                <div className="pt-4 border-t border-slate-200">
                  <MerchantIpWhitelistManager
                    merchantId={merchant.id}
                    whitelist={whitelist}
                    onRefresh={loadMerchantData}
                  />
                </div>
              </div>

              {/* Developer Security Information */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Security Architecture &amp; Authentication</div>
                <p className="text-[11px] leading-relaxed">
                  Inbound API requests are verified server-side against cryptographically hashed secrets. If IP Whitelisting is active, originating requests from unauthorized CIDRs are rejected immediately with HTTP 403 Forbidden.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 9: API DOCUMENTATION                             */}
          {/* ======================================================== */}
          {activeSection === 'api-docs' && (
            <MerchantApiDocumentation />
          )}

          {/* ======================================================== */}
          {/* SECTION 10: NOTIFICATIONS                                */}
          {/* ======================================================== */}
          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Operational Gateway Alerts</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live notifications regarding your float account and disbursement rails
                  </p>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-900">Merchant Account Active &amp; Verified</strong>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Your account ({merchant.merchant_code}) is live. Automated PayNit Instant UPI rails are operational 24x7.
                      </p>
                    </div>
                  </div>

                  {wallet && wallet.available_balance < 1000 && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-900">Low Float Balance Notice</strong>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Available float is currently {formatCurrency(wallet.available_balance)}. Top up float to prevent disbursement interruptions.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-blue-900">Pessimistic Float Locking Active</strong>
                      <p className="text-[11px] text-blue-800 mt-0.5">
                        Double-entry ledger is synchronized. All pending transfers reserve locked float until delivery confirmation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 11: PROFILE & SETTINGS                           */}
          {/* ======================================================== */}
          {activeSection === 'profile' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                <div className="pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Merchant Business Profile</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Account attributes and clearing configurations</p>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex justify-between">
                    <span className="text-slate-500">Business Name:</span>
                    <strong className="text-slate-900">{merchant.business_name}</strong>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex justify-between">
                    <span className="text-slate-500">Merchant Code:</span>
                    <strong className="font-mono text-blue-700">{merchant.merchant_code}</strong>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex justify-between">
                    <span className="text-slate-500">Registered Mobile:</span>
                    <strong className="font-mono text-slate-900">{merchant.mobile_number}</strong>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex justify-between">
                    <span className="text-slate-500">Account Classification:</span>
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      B2B Merchant (Isolated Float)
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-500">Gateway Status:</span>
                    <StatusBadge status={merchant.status} />
                  </div>
                </div>

                {/* Webhook Configuration Field */}
                <div className="pt-2 space-y-2">
                  <label className="block text-xs font-semibold text-slate-900">
                    Webhook Notification Endpoint URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => {
                        setWebhookUrl(e.target.value);
                        setWebhookSaved(false);
                      }}
                      placeholder="https://api.yourdomain.com/webhooks"
                      className="flex-1 px-3 py-1.5 rounded-md border border-slate-300 text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setWebhookSaved(true);
                        setTimeout(() => setWebhookSaved(false), 3000);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      {webhookSaved ? 'Saved!' : 'Save'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Events for payout status transitions and deposit approvals are dispatched here with signature verification.
                  </p>
                </div>

                {/* Locked-in Fee Schedule Card */}
                <div className="pt-2 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-900">Locked-in Merchant Fee Schedule</h4>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Platform Setup Fee:</span>
                      <strong className="text-emerald-700">₹0.00 (Waived)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Deposit Top-Up Fee:</span>
                      <strong className="font-mono text-slate-800">2.0%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payout Fee (Instant UPI):</span>
                      <strong className="font-mono text-slate-800">₹2.50 Flat</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Maximum Per Transaction:</span>
                      <strong className="font-mono text-slate-800">₹1,000.00</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2.5 px-4 rounded-md text-xs transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out from Merchant Account</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION 12: HELP & SUPPORT                               */}
          {/* ======================================================== */}
          {activeSection === 'help-support' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                <div className="pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Merchant Help &amp; Support</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Clearing guidelines, reconciliation, and provider failure codes</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-1">
                    <h4 className="font-semibold text-slate-900">How long does a transfer take?</h4>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Instant UPI transfers settle within 1 to 5 seconds into beneficiary accounts. Provider status updates via automated webhook.
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-1">
                    <h4 className="font-semibold text-slate-900">How long do float top-ups take to review?</h4>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Administrator reviews typically clear within 5 to 15 minutes during standard Indian banking hours.
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-1">
                    <h4 className="font-semibold text-slate-900">What happens if a bank payout fails?</h4>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      If the provider returns a definitive rejection or failure, the principal and gateway fee are automatically credited back to your available float.
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-1">
                    <h4 className="font-semibold text-slate-900">Direct Support Channels</h4>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Contact our dedicated B2B gateway desk at <strong className="text-slate-900">support@createlifafa.xyz</strong> or reach out on Telegram.
                    </p>
                  </div>
                </div>

                {/* System Operational Status */}
                <div className="pt-2 border-t border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-900 mb-2">Banking Rails &amp; System Health</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <span className="font-medium text-slate-800 block">PayNit Instant UPI Rails</span>
                        <span className="text-[10px] text-slate-500">OPERATIONAL</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <span className="font-medium text-slate-800 block">Float Pessimistic Lock</span>
                        <span className="text-[10px] text-slate-500">HEALTHY</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <span className="font-medium text-slate-800 block">Webhook Dispatcher</span>
                        <span className="text-[10px] text-slate-500">ACTIVE</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* 4. MODALS & SLIDE-OVER DETAIL DRAWERS                    */}
      {/* ======================================================== */}

      {/* Make Payout Review & Confirmation Modal */}
      {payoutConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-lg p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900">Confirm Payout Disbursement</h4>
              <button
                onClick={() => setPayoutConfirmModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Payout Rail:</span>
                <span className="font-semibold text-blue-700">UPI (Instant)</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">UPI ID (VPA):</span>
                <span className="font-mono font-semibold text-slate-900">{payoutUpiId}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Transfer Amount:</span>
                <span className="font-mono font-semibold text-slate-900">{formatCurrency(numPayoutAmt)}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Gateway Fee:</span>
                <span className="font-mono font-semibold text-amber-700">+{formatCurrency(livePayoutFee)}</span>
              </div>
              <div className="flex justify-between p-2 bg-blue-50 rounded border border-blue-200 font-semibold">
                <span className="text-blue-900">Total Float Deduction:</span>
                <span className="font-mono text-blue-900">{formatCurrency(liveTotalDeducted)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900">
              Disbursements are dispatched immediately via automated PayNit UPI rails. Once submitted, this transfer cannot be reversed.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPayoutConfirmModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded-md transition-colors cursor-pointer"
              >
                Back &amp; Edit
              </button>
              <button
                type="button"
                onClick={handleFinalPayoutDispatch}
                disabled={submittingPayout}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingPayout ? 'Dispatching Transfer...' : 'Confirm & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Details Slide-Over Drawer */}
      {selectedPayoutDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Payout Transfer</span>
                  <h3 className="text-sm font-bold font-mono text-slate-900">{selectedPayoutDetail.order_id}</h3>
                </div>
                <button
                  onClick={() => setSelectedPayoutDetail(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-md border border-slate-200">
                  <span className="text-slate-500 font-medium">Disbursement Status:</span>
                  <StatusBadge status={selectedPayoutDetail.status} />
                </div>

                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payout Rail:</span>
                    <strong className="text-blue-700">{selectedPayoutDetail.payout_method || (selectedPayoutDetail.upi_id ? 'UPI' : 'IMPS')}</strong>
                  </div>
                  {(selectedPayoutDetail.payout_method === 'UPI' || selectedPayoutDetail.upi_id) ? (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Beneficiary UPI ID:</span>
                      <strong className="font-mono text-slate-900">{selectedPayoutDetail.upi_id}</strong>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Beneficiary Name:</span>
                        <strong className="text-slate-900">{selectedPayoutDetail.account_holder_name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Bank Account:</span>
                        <strong className="font-mono text-slate-900">{selectedPayoutDetail.bank_account_number_masked}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">IFSC Code:</span>
                        <strong className="font-mono text-slate-900">{selectedPayoutDetail.ifsc_code}</strong>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Provider:</span>
                    <strong className="text-slate-900">PayNit</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transfer Amount:</span>
                    <strong className="font-mono text-slate-900">{formatCurrency(selectedPayoutDetail.amount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gateway Fee:</span>
                    <strong className="font-mono text-amber-700">+{formatCurrency(selectedPayoutDetail.fee_amount)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="font-semibold text-slate-900">Total Deducted:</span>
                    <strong className="font-mono text-blue-700">{formatCurrency(selectedPayoutDetail.total_deducted)}</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                  <span className="text-slate-500 block">Provider Ref / Bank UTR:</span>
                  <div className="font-mono font-semibold text-slate-900 select-all">
                    {selectedPayoutDetail.provider_reference_id || 'Pending Provider Settlement'}
                  </div>
                </div>

                {selectedPayoutDetail.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800">
                    <strong className="block font-semibold">Rejection Reason:</strong>
                    <p className="mt-0.5 text-[11px]">{selectedPayoutDetail.rejection_reason}</p>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                  <div>Created: {formatDate(selectedPayoutDetail.created_at)}</div>
                  <div>Internal ID: {selectedPayoutDetail.id}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-6">
              <button
                onClick={() => {
                  const targetOrderId = selectedPayoutDetail.order_id;
                  setSelectedPayoutDetail(null);
                  setActiveSection('payouts');
                  setCheckerOrderId(targetOrderId);
                  window.scrollTo({ top: 100, behavior: 'smooth' });
                }}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold py-2 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Check Real-Time Provider Status</span>
              </button>

              <button
                onClick={() => setSelectedPayoutDetail(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded-md transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Details Slide-Over Drawer */}
      {selectedDepositDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Float Top-Up Receipt</span>
                  <h3 className="text-sm font-bold font-mono text-slate-900">UTR: {selectedDepositDetail.utr_number}</h3>
                </div>
                <button
                  onClick={() => setSelectedDepositDetail(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-md border border-slate-200">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <StatusBadge status={selectedDepositDetail.status} />
                </div>

                <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gross Transfer Amount:</span>
                    <strong className="font-mono text-slate-900">{formatCurrency(selectedDepositDetail.gross_amount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Platform Fee (2.0%):</span>
                    <strong className="font-mono text-amber-700">-{formatCurrency(selectedDepositDetail.deposit_fee)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="font-semibold text-emerald-700">Net Float Credited:</span>
                    <strong className="font-mono text-emerald-700 text-sm">+{formatCurrency(selectedDepositDetail.net_credited)}</strong>
                  </div>
                </div>

                {selectedDepositDetail.admin_notes && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <strong className="text-slate-700 block font-semibold">Administrator Notes:</strong>
                    <p className="mt-0.5 text-[11px] text-slate-600">{selectedDepositDetail.admin_notes}</p>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                  <div>Submitted: {formatDate(selectedDepositDetail.created_at)}</div>
                  {selectedDepositDetail.reviewed_at && <div>Reviewed: {formatDate(selectedDepositDetail.reviewed_at)}</div>}
                  <div>Deposit ID: {selectedDepositDetail.id}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedDepositDetail(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded-md transition-colors cursor-pointer mt-6"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* Floating Modals */}
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
        onSuccess={() => {
          loadMerchantData();
          setPayoutSuccessMsg('Payment Completed');
          setTimeout(() => setPayoutSuccessMsg(null), 7000);
        }}
      />
    </div>
  );
};
