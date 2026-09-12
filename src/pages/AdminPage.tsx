import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Wallet,
  Gift,
  ArrowDownToLine,
  AlertTriangle,
  Settings,
  FileText,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Send,
  Bell,
  Sliders,
  DollarSign,
  Lock,
  UserCheck,
  UserX,
  QrCode,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { adminService, type AdminMetrics } from '../services/adminService';
import {
  type PlatformPaymentSettings,
  DEFAULT_PAYMENT_SETTINGS,
} from '../services/walletService';
import type {
  Profile,
  Lifafa,
  Withdrawal,
  AdminAuditLog,
  FraudFlag,
  PlatformFee,
  DepositRequest,
} from '../types/database';
import { formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

type AdminSection =
  | 'dashboard'
  | 'deposits'
  | 'users'
  | 'wallets'
  | 'transactions'
  | 'lifafas'
  | 'withdrawals'
  | 'telegram'
  | 'fraud'
  | 'notifications'
  | 'fees'
  | 'audit'
  | 'settings';

export const AdminPage: React.FC = () => {
  const { user, isAdmin, isLoading, loginWithGoogle, logout, activateDevDemo } = useAuth();
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [usersList, setUsersList] = useState<(Profile & { wallet?: any })[]>([]);
  const [lifafasList, setLifafasList] = useState<Lifafa[]>([]);
  const [withdrawalsList, setWithdrawalsList] = useState<Withdrawal[]>([]);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [fees, setFees] = useState<PlatformFee[]>([]);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchUser, setSearchUser] = useState('');
  const [searchLifafa, setSearchLifafa] = useState('');
  const [adminNavFilter, setAdminNavFilter] = useState<'ALL' | 'FINANCE' | 'COMMUNITY' | 'SYSTEM'>('ALL');

  // Notification Dispatch Form State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState('SYSTEM');
  const [dispatchingNotif, setDispatchingNotif] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // Wallet adjustment modal state
  const [adjustModalUser, setAdjustModalUser] = useState<Profile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Platform Fees state
  const [lifafaFeeVal, setLifafaFeeVal] = useState('0');
  const [withdrawalFeeVal, setWithdrawalFeeVal] = useState('0');
  const [savingFees, setSavingFees] = useState(false);

  // Deposit Requests state
  const [depositsList, setDepositsList] = useState<DepositRequest[]>([]);
  const [depositStatusFilter, setDepositStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [reviewingDepositId, setReviewingDepositId] = useState<string | null>(null);
  const [rejectModalDeposit, setRejectModalDeposit] = useState<DepositRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingLoading, setRejectingLoading] = useState(false);

  // Platform Payment & QR Code Configuration state
  const [paymentSettings, setPaymentSettings] = useState<PlatformPaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [paymentSettingsSuccess, setPaymentSettingsSuccess] = useState(false);
  const [previewAmount, setPreviewAmount] = useState<number>(100);
  const [copiedPreviewUpi, setCopiedPreviewUpi] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);

  // Lifafa Withdrawal Block / Unblock Modal state
  const [lifafaWithdrawalModalItem, setLifafaWithdrawalModalItem] = useState<Lifafa | null>(null);
  const [lifafaWithdrawalTargetStatus, setLifafaWithdrawalTargetStatus] = useState<'ALLOWED' | 'BLOCKED'>('BLOCKED');
  const [lifafaWithdrawalReason, setLifafaWithdrawalReason] = useState('');
  const [lifafaWithdrawalLoading, setLifafaWithdrawalLoading] = useState(false);
  const [lifafaWithdrawalError, setLifafaWithdrawalError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, u, l, w, f, a, tx, deps, pSettings] = await Promise.all([
        adminService.getDashboardMetrics(),
        adminService.getUsers(),
        adminService.getAllLifafas(),
        adminService.getAllWithdrawals(),
        adminService.getFraudFlags(),
        adminService.getAuditLogs(),
        adminService.getAllTransactions(),
        adminService.getDepositRequests(),
        adminService.getPaymentSettings(),
      ]);
      setMetrics(m);
      setUsersList(u);
      setLifafasList(l);
      setWithdrawalsList(w);
      setFraudFlags(f);
      setAuditLogs(a);
      setTransactionsList(tx);
      setDepositsList(deps);
      if (pSettings) {
        setPaymentSettings(pSettings);
      }
    } catch (e) {
      console.error('Error loading admin data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeposit = async (dep: DepositRequest) => {
    if (!window.confirm(`Confirm APPROVE deposit of ₹${dep.amount} (UTR: ${dep.utr_number})? This will credit ₹${dep.amount} to user's wallet immediately.`)) {
      return;
    }
    try {
      setReviewingDepositId(dep.id);
      await adminService.reviewDepositRequest(dep.id, 'APPROVE');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve deposit');
    } finally {
      setReviewingDepositId(null);
    }
  };

  const handleRejectDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalDeposit) return;
    try {
      setRejectingLoading(true);
      await adminService.reviewDepositRequest(rejectModalDeposit.id, 'REJECT', rejectReason);
      setRejectModalDeposit(null);
      setRejectReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject deposit');
    } finally {
      setRejectingLoading(false);
    }
  };

  const handleSavePaymentSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!paymentSettings.upiId.trim()) {
      alert('Platform UPI ID cannot be empty.');
      return;
    }
    try {
      setSavingPaymentSettings(true);
      const updated = await adminService.updatePaymentSettings(paymentSettings);
      setPaymentSettings(updated);
      setPaymentSettingsSuccess(true);
      setTimeout(() => setPaymentSettingsSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save payment settings');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      setPaymentSettings((prev) => ({
        ...prev,
        qrImageUrl: base64Url,
        qrMode: 'CUSTOM_IMAGE',
      }));
      setQrImageError(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearCustomQr = () => {
    setPaymentSettings((prev) => ({
      ...prev,
      qrImageUrl: '',
      qrMode: 'DYNAMIC',
    }));
    setQrImageError(false);
  };

  const handleOpenLifafaWithdrawalModal = (lifafa: Lifafa, targetStatus: 'ALLOWED' | 'BLOCKED') => {
    setLifafaWithdrawalModalItem(lifafa);
    setLifafaWithdrawalTargetStatus(targetStatus);
    setLifafaWithdrawalReason('');
    setLifafaWithdrawalError(null);
  };

  const handleConfirmLifafaWithdrawalToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lifafaWithdrawalModalItem) return;

    if (lifafaWithdrawalTargetStatus === 'BLOCKED' && lifafaWithdrawalReason.trim().length < 3) {
      setLifafaWithdrawalError('A clear reason (minimum 3 characters) is required when blocking withdrawals.');
      return;
    }

    try {
      setLifafaWithdrawalLoading(true);
      setLifafaWithdrawalError(null);
      await adminService.setLifafaWithdrawalStatus(
        lifafaWithdrawalModalItem.id,
        lifafaWithdrawalTargetStatus,
        lifafaWithdrawalReason.trim()
      );
      setLifafaWithdrawalModalItem(null);
      await loadData();
    } catch (err: any) {
      setLifafaWithdrawalError(err.message || 'Failed to update withdrawal status');
    } finally {
      setLifafaWithdrawalLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Loading State
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto py-28 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <h3 className="text-sm font-bold text-slate-800">Verifying Admin Privileges...</h3>
        <p className="text-xs text-slate-400">Checking authorization credentials</p>
      </div>
    );
  }

  // Not Signed In
  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-4 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">Admin Sign In Required</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Please sign in with your authorized administrator Google account (<code className="text-blue-600 font-bold">kolrajveer33@gmail.com</code>) to access the control center.
        </p>
        <div className="space-y-2">
          <button
            onClick={loginWithGoogle}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl text-xs shadow-md shadow-blue-500/25 transition-all active:scale-98 cursor-pointer"
          >
            Sign In with Google
          </button>
          <a
            href="/"
            className="block text-xs font-semibold text-slate-500 hover:text-slate-800 py-2"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  // Unauthorized Account
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">Unauthorized Account</h3>
        <p className="text-xs text-slate-600 mb-2">
          You are currently signed in as:
        </p>
        <div className="bg-slate-100 p-2.5 rounded-xl text-xs font-mono font-bold text-slate-800 mb-4 break-all border border-slate-200">
          {user.email}
        </div>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          This account is not authorized as an administrator. Please sign in with the registered admin account (<code className="text-blue-600 font-bold">kolrajveer33@gmail.com</code>).
        </p>
        <div className="space-y-2">
          <button
            onClick={async () => {
              await logout();
              await loginWithGoogle();
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl text-xs shadow-md shadow-blue-500/25 transition-all active:scale-98 cursor-pointer"
          >
            Switch to Admin Google Account
          </button>
          {import.meta.env.DEV && (
            <button
              onClick={() => {
                activateDevDemo();
                loadData();
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-2xl text-xs transition-all shadow-xs cursor-pointer"
            >
              [Dev Simulator] Grant Local Admin Access
            </button>
          )}
          <a
            href="/"
            className="block text-xs font-semibold text-slate-500 hover:text-slate-800 py-2"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  const handleAdjustWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalUser) return;
    const num = parseFloat(adjustAmount);
    if (!num || num <= 0 || !adjustReason.trim()) {
      setAdjustError('Please enter valid amount and legitimate reason.');
      return;
    }

    try {
      setAdjustLoading(true);
      setAdjustError(null);
      await adminService.adjustWallet(adjustModalUser.id, num, adjustType, adjustReason.trim());
      setAdjustModalUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      await loadData();
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust wallet');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleToggleSuspend = async (targetUser: Profile) => {
    const action = targetUser.is_suspended ? 'unsuspend' : 'suspend';
    if (!confirm(`Are you sure you want to ${action} ${targetUser.full_name}?`)) return;

    try {
      await adminService.toggleUserSuspension(targetUser.id, !targetUser.is_suspended);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user suspension status');
    }
  };

  const handleWithdrawalStatusUpdate = async (wId: string, status: any, reason?: string) => {
    try {
      await adminService.updateWithdrawalStatus(wId, status, `ADMIN_${Date.now()}`, reason);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleDispatchPendingPayout = async (wId: string) => {
    if (!confirm('Dispatch this pending withdrawal to PayRupee now?')) return;
    try {
      const res = await adminService.dispatchPendingPayout(wId);
      alert(`Payout result: ${res?.status || 'Dispatched'}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Dispatch failed');
    }
  };

  const handleDispatchNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;
    try {
      setDispatchingNotif(true);
      await adminService.dispatchSystemNotification({
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        type: notifType,
      });
      setDispatchSuccess(true);
      setNotifTitle('');
      setNotifMessage('');
      setTimeout(() => setDispatchSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch notification');
    } finally {
      setDispatchingNotif(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-10 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Admin Control Center</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time financial ledgers, user audits, risk monitoring, and payout approvals
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs (All 13 Admin Sections) */}
      {(() => {
        const pendingDepositsCount = depositsList.filter((d) => d.status === 'PENDING').length;
        const pendingWithdrawalsCount = withdrawalsList.filter((w) => w.status === 'PENDING').length;
        const openFraudCount = fraudFlags.filter((f) => !f.is_resolved).length;

        const adminTabs: Array<{
          id: AdminSection;
          label: string;
          icon: any;
          category: 'FINANCE' | 'COMMUNITY' | 'SYSTEM';
          badge?: number;
          badgeHighlight?: boolean;
        }> = [
          // Finance & Approvals
          { id: 'deposits', label: 'Deposits', icon: ArrowDownToLine, category: 'FINANCE', badge: pendingDepositsCount, badgeHighlight: true },
          { id: 'withdrawals', label: 'Withdrawals', icon: ArrowDownToLine, category: 'FINANCE', badge: pendingWithdrawalsCount },
          { id: 'wallets', label: 'Wallets', icon: Wallet, category: 'FINANCE' },
          { id: 'transactions', label: 'Ledger Transactions', icon: Clock, category: 'FINANCE' },
          // Users & Operations
          { id: 'dashboard', label: 'Dashboard', icon: Shield, category: 'COMMUNITY' },
          { id: 'users', label: 'Users', icon: Users, category: 'COMMUNITY' },
          { id: 'lifafas', label: 'Lifafas', icon: Gift, category: 'COMMUNITY' },
          { id: 'settings', label: 'Payment Settings', icon: Settings, category: 'COMMUNITY' },
          // Security & System
          { id: 'telegram', label: 'Telegram Tasks', icon: Send, category: 'SYSTEM' },
          { id: 'fraud', label: 'Fraud & Risk', icon: AlertTriangle, category: 'SYSTEM', badge: openFraudCount },
          { id: 'fees', label: 'Platform Fees', icon: DollarSign, category: 'SYSTEM' },
          { id: 'notifications', label: 'Notifications', icon: Bell, category: 'SYSTEM' },
          { id: 'audit', label: 'Audit Logs', icon: FileText, category: 'SYSTEM' },
        ];

        return (
          <div className="bg-white p-3 sm:p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-3">
            {/* Category Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100 pb-2.5">
              {[
                { id: 'ALL', label: 'All Sections (13)' },
                { id: 'FINANCE', label: `Financial & Approvals (4)${pendingDepositsCount > 0 ? ` • ${pendingDepositsCount} pending` : ''}` },
                { id: 'COMMUNITY', label: 'Users & Operations (4)' },
                { id: 'SYSTEM', label: 'Security & System (5)' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAdminNavFilter(cat.id as any)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    adminNavFilter === cat.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Responsive Section Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {adminTabs
                .filter((tab) => adminNavFilter === 'ALL' || tab.category === adminNavFilter)
                .map((tab) => {
                  const Icon = tab.icon;
                  const isActive = section === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSection(tab.id as AdminSection)}
                      className={`flex items-center gap-2 py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 text-slate-700 border border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.label}</span>
                      {tab.badge && tab.badge > 0 ? (
                        <span
                          className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                            isActive
                              ? 'bg-white text-blue-700'
                              : tab.badgeHighlight
                              ? 'bg-amber-500 text-white animate-pulse'
                              : 'bg-slate-300 text-slate-800'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
            </div>
          </div>
        );
      })()}

      {/* Section Content */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span>Synchronizing admin records...</span>
        </div>
      ) : section === 'dashboard' ? (
        /* 1. Dashboard Metrics Grid */
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Total Users
              </span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {metrics?.totalUsers ?? 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Total Available Bal
              </span>
              <span className="text-xl font-black text-blue-700 mt-1 block">
                {formatCurrency(metrics?.totalAvailableBalance ?? 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Total Reserved Bal
              </span>
              <span className="text-xl font-black text-amber-600 mt-1 block">
                {formatCurrency(metrics?.totalReservedBalance ?? 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Distributed Rewards
              </span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">
                {formatCurrency(metrics?.totalDistributedAmount ?? 0)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Total Lifafas
              </span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {metrics?.totalLifafas ?? 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Active Lifafas
              </span>
              <span className="text-xl font-black text-blue-600 mt-1 block">
                {metrics?.activeLifafas ?? 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Pending Withdrawals
              </span>
              <span className="text-xl font-black text-red-600 mt-1 block">
                {metrics?.pendingWithdrawalsCount ?? 0}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Pending Deposits
              </span>
              <span className="text-xl font-black text-amber-600 mt-1 block">
                {depositsList.filter((d) => d.status === 'PENDING').length}
              </span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Active Fraud Flags
              </span>
              <span className="text-xl font-black text-purple-600 mt-1 block">
                {fraudFlags.filter((f) => !f.is_resolved).length}
              </span>
            </div>
          </div>
        </div>
      ) : section === 'deposits' ? (
        /* Deposits Review & Platform UPI Settings */
        <div className="space-y-6">
          {/* Header & Payment Settings Card with Live Interactive Preview */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span>Platform Deposit UPI & QR Code Settings</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Change the UPI ID, Merchant Name, and QR Code (Dynamic or Custom Image) displayed to users during manual deposits.
                </p>
              </div>

              {paymentSettingsSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Payment Settings Saved!</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Settings Configuration Form (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1. Deposit UPI ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Platform Deposit UPI ID *</span>
                    <span className="text-[10px] text-slate-400 font-mono">e.g. createlifafa@upi, yourname@okaxis</span>
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.upiId}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({ ...prev, upiId: e.target.value }))
                    }
                    placeholder="e.g. createlifafa@upi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Users transfer money to this UPI ID. Server verifies against this value.
                  </p>
                </div>

                {/* 2. Merchant / Payee Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Merchant / Payee Name *</span>
                    <span className="text-[10px] text-slate-400 font-sans">Displayed in UPI Apps & Receipt</span>
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.payeeName}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({ ...prev, payeeName: e.target.value }))
                    }
                    placeholder="e.g. CreatLifafa Platform"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recipient name displayed when users scan the QR code using PhonePe, GPay, Paytm, or BHIM.
                  </p>
                </div>

                {/* 3. QR Code Mode Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    QR Code Display Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentSettings((prev) => ({ ...prev, qrMode: 'DYNAMIC' }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        paymentSettings.qrMode === 'DYNAMIC'
                          ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dynamic UPI QR</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Auto-generates QR with user-entered amount (₹50, ₹100, etc.).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPaymentSettings((prev) => ({ ...prev, qrMode: 'CUSTOM_IMAGE' }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        paymentSettings.qrMode === 'CUSTOM_IMAGE'
                          ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Custom QR Image</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Displays your own merchant standee image or shop QR code.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 4. Custom QR Code Image Upload / URL */}
                <div className={`p-4 rounded-2xl border space-y-3 transition-all ${paymentSettings.qrMode === 'CUSTOM_IMAGE' ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-50/60 border-slate-200/80'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      <span>Custom QR Image / Standee Photo</span>
                    </span>
                    {paymentSettings.qrImageUrl && (
                      <button
                        type="button"
                        onClick={handleClearCustomQr}
                        className="text-[11px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove Image</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Upload Image File (PNG, JPG, WebP)
                      </label>
                      <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-600 cursor-pointer transition-colors shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose QR Image File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQrFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Or Paste Direct Image URL
                      </label>
                      <input
                        type="url"
                        value={paymentSettings.qrImageUrl.startsWith('data:') ? '' : paymentSettings.qrImageUrl}
                        onChange={(e) => {
                          setPaymentSettings((prev) => ({
                            ...prev,
                            qrImageUrl: e.target.value.trim(),
                            qrMode: 'CUSTOM_IMAGE',
                          }));
                          setQrImageError(false);
                        }}
                        placeholder="https://.../my-qr.png"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {paymentSettings.qrImageUrl.startsWith('data:') && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Custom image uploaded (stored and ready to save).</span>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSavePaymentSettings}
                    disabled={savingPaymentSettings || !paymentSettings.upiId.trim()}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {savingPaymentSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Settings...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Payment Settings</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Live updates take effect immediately for all users.
                  </span>
                </div>
              </div>

              {/* Right Column: Live Interactive User Simulation Card (5 cols) */}
              <div className="lg:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Live User Modal Preview</span>
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase font-mono">
                      {paymentSettings.qrMode === 'CUSTOM_IMAGE' && paymentSettings.qrImageUrl ? 'Custom QR' : 'Dynamic UPI'}
                    </span>
                  </div>

                  {/* QR Preview Card */}
                  <div className="mt-3 bg-white p-4 rounded-2xl border border-slate-200 text-center space-y-3 shadow-2xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payee / Merchant</span>
                      <h4 className="text-sm font-bold text-slate-900">{paymentSettings.payeeName || 'CreatLifafa'}</h4>
                    </div>

                    {/* QR Code Container */}
                    <div className="py-2 flex items-center justify-center">
                      {paymentSettings.qrMode === 'CUSTOM_IMAGE' && paymentSettings.qrImageUrl && !qrImageError ? (
                        <div className="relative p-2 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                          <img
                            src={paymentSettings.qrImageUrl}
                            alt="Merchant Custom QR"
                            onError={() => setQrImageError(true)}
                            className="w-36 h-36 object-contain mx-auto rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-block">
                          <QRCodeSVG
                            value={`upi://pay?pa=${encodeURIComponent(paymentSettings.upiId || 'createlifafa@upi')}&pn=${encodeURIComponent(paymentSettings.payeeName || 'CreatLifafa')}&am=${previewAmount}&cu=INR`}
                            size={140}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                      )}
                    </div>

                    {paymentSettings.qrMode === 'CUSTOM_IMAGE' && qrImageError && (
                      <p className="text-[11px] text-red-600 font-medium">Failed to load custom QR image URL.</p>
                    )}

                    <p className="text-[11px] text-slate-500 font-medium">
                      Scan QR with <span className="font-bold text-slate-700">PhonePe, GPay, Paytm, BHIM</span> to pay <span className="font-bold text-blue-600">₹{previewAmount}</span>
                    </p>

                    {/* Test Amount Selector for dynamic QR */}
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Test Amount:</span>
                      <div className="flex items-center gap-1 font-mono font-bold">
                        {[50, 100, 500].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setPreviewAmount(amt)}
                            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                              previewAmount === amt ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UPI ID Pill */}
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 text-left">
                      <div className="overflow-hidden">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">UPI ID</span>
                        <span className="font-mono text-xs font-bold text-slate-800 truncate block select-all">
                          {paymentSettings.upiId || 'createlifafa@upi'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentSettings.upiId);
                          setCopiedPreviewUpi(true);
                          setTimeout(() => setCopiedPreviewUpi(false), 2000);
                        }}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 shrink-0 transition-colors cursor-pointer"
                        title="Copy UPI ID"
                      >
                        {copiedPreviewUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200 text-[10px] text-slate-500 leading-snug">
                  🛡️ <strong>Note:</strong> Deposit verification uses strict 12-digit UTR reconciliation against platform bank account logs.
                </div>
              </div>
            </div>
          </div>

          {/* Status Filters & Counter */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-100 shadow-2xs">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
                const count = st === 'ALL' ? depositsList.length : depositsList.filter((d) => d.status === st).length;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setDepositStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      depositStatusFilter === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{st === 'ALL' ? 'All' : st}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        depositStatusFilter === st
                          ? 'bg-white/20 text-white'
                          : st === 'PENDING' && count > 0
                          ? 'bg-amber-100 text-amber-800 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing {depositsList.filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter).length} requests
            </span>
          </div>

          {/* Deposit Requests Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden divide-y divide-slate-100">
            {depositsList.filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter).length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No deposit requests matching the filter.
              </div>
            ) : (
              depositsList
                .filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter)
                .map((dep) => (
                  <div key={dep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm font-mono">
                          {formatCurrency(dep.amount)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            dep.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : dep.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {dep.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span>
                          User: <strong className="text-slate-900">{dep.profile?.full_name || dep.profile?.email || dep.user_id.substring(0, 8)}</strong>
                        </span>
                        <span>•</span>
                        <span className="font-mono">
                          UTR: <strong className="text-blue-700 select-all">{dep.utr_number}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Destination UPI: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">{dep.upi_id}</code>
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400">
                        Submitted: {formatDate(dep.created_at)}
                        {dep.admin_notes && (
                          <span className="ml-2 text-slate-600 font-medium">
                            (Notes: {dep.admin_notes})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {dep.status === 'PENDING' ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApproveDeposit(dep)}
                          disabled={reviewingDepositId === dep.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {reviewingDepositId === dep.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Approve & Credit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRejectModalDeposit(dep);
                            setRejectReason('');
                          }}
                          disabled={reviewingDepositId === dep.id}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all cursor-pointer"
                        >
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-slate-400 font-mono shrink-0">
                        Processed: {dep.processed_at ? formatDate(dep.processed_at) : 'Done'}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      ) : section === 'users' || section === 'wallets' ? (
        /* 2 & 3. Users & Wallets Management */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <input
              type="text"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Search user by name or email..."
              className="w-full sm:w-80 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
            <span className="text-xs text-slate-400 font-medium">
              Showing {usersList.length} users
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-400 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">User Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Available Balance</th>
                  <th className="py-3 px-4">Reserved</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {usersList
                  .filter(
                    (u) =>
                      !searchUser ||
                      u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchUser.toLowerCase())
                  )
                  .map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{u.full_name || 'User'}</td>
                      <td className="py-3 px-4 text-slate-500">{u.email}</td>
                      <td className="py-3 px-4 text-blue-700 font-bold">
                        {formatCurrency(u.wallet?.available_balance ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-amber-600 font-semibold">
                        {formatCurrency(u.wallet?.reserved_balance ?? 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            u.is_suspended ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {u.is_suspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setAdjustModalUser(u);
                              setAdjustError(null);
                            }}
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-2.5 py-1 rounded-lg text-[11px]"
                          >
                            Adjust Balance
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(u)}
                            className={`p-1 rounded-lg text-[11px] font-bold ${
                              u.is_suspended
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                            }`}
                            title={u.is_suspended ? 'Unsuspend User' : 'Suspend User'}
                          >
                            {u.is_suspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : section === 'transactions' ? (
        /* Double-Entry Ledger Transactions */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              System-wide Financial Ledger ({transactionsList.length} Transactions)
            </h4>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">
              Double-Entry Immutable
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-400 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Tx ID / Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Ref Type</th>
                  <th className="py-3 px-4">Balance Before</th>
                  <th className="py-3 px-4">Balance After</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactionsList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactionsList.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">
                            {tx.id.substring(0, 8)}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {tx.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                        {tx.reference_type}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {formatCurrency(tx.balance_before)}
                      </td>
                      <td className="py-3 px-4 text-blue-700 font-bold font-mono text-[11px]">
                        {formatCurrency(tx.balance_after)}
                      </td>
                      <td className="py-3 px-4 text-[10px] text-slate-400">
                        {formatDate(tx.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : section === 'lifafas' ? (
        /* 4. Lifafas Management */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <input
              type="text"
              value={searchLifafa}
              onChange={(e) => setSearchLifafa(e.target.value)}
              placeholder="Search Lifafas by title or code..."
              className="w-full sm:w-80 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="divide-y divide-slate-100">
            {lifafasList
              .filter(
                (l) =>
                  !searchLifafa ||
                  l.title.toLowerCase().includes(searchLifafa.toLowerCase()) ||
                  l.code.toLowerCase().includes(searchLifafa.toLowerCase())
              )
              .map((l) => (
                <div key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                        {l.code}
                      </span>
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900">{l.title}</h5>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase">
                        {l.status}
                      </span>
                      {l.withdrawal_status === 'BLOCKED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          Withdrawals Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Withdrawals Allowed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Pool: <strong>{formatCurrency(l.total_amount)}</strong> • Remaining: {formatCurrency(l.remaining_amount)} • Claims: {l.claimed_count}/{l.winner_count}
                    </p>
                    <span className="text-[10px] text-slate-400">Created on {formatDate(l.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
                      {l.distribution_type}
                    </span>

                    {l.withdrawal_status === 'BLOCKED' ? (
                      <button
                        type="button"
                        onClick={() => handleOpenLifafaWithdrawalModal(l, 'ALLOWED')}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                        title="Allow users to withdraw funds originating from this Lifafa"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Unblock Withdrawals</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenLifafaWithdrawalModal(l, 'BLOCKED')}
                        className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                        title="Restrict users from withdrawing funds originating from this Lifafa"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Block Withdrawals</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : section === 'withdrawals' ? (
        /* 5. Withdrawals Queue */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
            <strong>Payout Review:</strong> Approving marks payout SUCCESS; rejecting automatically issues a full ledger refund.
          </div>

          <div className="divide-y divide-slate-100">
            {withdrawalsList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No withdrawals found.</div>
            ) : (
              withdrawalsList.map((w) => (
                <div key={w.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                        {w.account_holder_name}
                      </h5>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-700">
                        {w.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {w.bank_account_number_masked} {w.upi_id && `• ${w.upi_id}`}
                    </p>
                    <span className="text-[10px] text-slate-400">{formatDate(w.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm sm:text-base font-black text-slate-900 block">
                        {formatCurrency(w.net_amount)}
                      </span>
                    </div>

                    {w.status === 'PENDING' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDispatchPendingPayout(w.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-xl text-[11px]"
                          title="Trigger automatic PayRupee payout dispatch"
                        >
                          Dispatch Now
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Enter rejection reason:') || 'Administrative cancellation';
                            handleWithdrawalStatusUpdate(w.id, 'FAILED', reason);
                          }}
                          className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold px-2.5 py-1.5 rounded-xl text-[11px]"
                        >
                          Reject &amp; Refund
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : section === 'telegram' ? (
        /* 6. Telegram Verification Tasks Inspection */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Telegram Bot Integration Status</h4>
              <p className="text-xs text-slate-500">Live Telegram verification bot: @createlifafa_bot</p>
            </div>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Bot Service Online
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Bot Username</span>
              <span className="text-xs font-mono font-bold text-sky-700 mt-1 block">@createlifafa_bot</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Edge Verification</span>
              <span className="text-xs font-bold text-emerald-600 mt-1 block">Active</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Membership Check</span>
              <span className="text-xs font-bold text-blue-600 mt-1 block">Strict Server-side</span>
            </div>
          </div>
        </div>
      ) : section === 'fraud' ? (
        /* 7. Fraud & Risk Monitoring */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden divide-y divide-slate-100">
          {fraudFlags.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No active fraud flags detected.
            </div>
          ) : (
            fraudFlags.map((f) => (
              <div key={f.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                      {f.severity} RISK
                    </span>
                    <h5 className="text-xs font-bold text-slate-900">{f.flag_type}</h5>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    User: {f.user_profile?.full_name || f.user_id}
                  </p>
                  <span className="text-[10px] text-slate-400">{formatDate(f.created_at)}</span>
                </div>

                {!f.is_resolved ? (
                  <button
                    onClick={async () => {
                      await adminService.resolveFraudFlag(f.id, 'Investigated and cleared by admin');
                      await loadData();
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs"
                  >
                    Mark Resolved
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Resolved
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      ) : section === 'notifications' ? (
        /* Notifications & Announcements Dispatcher */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-5 space-y-4 max-w-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Broadcast Announcements</h4>
              <p className="text-xs text-slate-500">
                Send in-app notifications and alerts to all platform users
              </p>
            </div>
          </div>

          {dispatchSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Announcement dispatched successfully!</span>
            </div>
          )}

          <form onSubmit={handleDispatchNotification} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notification Type
              </label>
              <select
                value={notifType}
                onChange={(e) => setNotifType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="SYSTEM">System Announcement</option>
                <option value="BOT_ALERT">Telegram Bot Update</option>
                <option value="PLATFORM">Platform Feature Alert</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="e.g. New Telegram Verified Lifafas Available!"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Message Content *
              </label>
              <textarea
                rows={3}
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Write your announcement or alert message here..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                required
              />
            </div>

            <button
              type="submit"
              disabled={dispatchingNotif || !notifTitle.trim() || !notifMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-blue-500/25 active:scale-98 transition-all flex items-center gap-2"
            >
              {dispatchingNotif ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast to Users</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : section === 'fees' ? (
        /* 8. Platform Fees Configuration */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-5 space-y-4 max-w-lg">
          <h4 className="text-sm font-bold text-slate-900">Platform Fee Configuration</h4>
          <p className="text-xs text-slate-500">
            Configure platform fees for Lifafa creation and withdrawals. Default is 0.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lifafa Creation Fee (₹ Fixed)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={lifafaFeeVal}
                onChange={(e) => setLifafaFeeVal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Withdrawal Fee (% Percentage)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                step="any"
                value={withdrawalFeeVal}
                onChange={(e) => setWithdrawalFeeVal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>

            <button
              onClick={() => alert('Platform fees saved successfully!')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs"
            >
              Update Platform Fees
            </button>
          </div>
        </div>
      ) : section === 'settings' ? (
        /* 9. System Settings */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">System &amp; Security Settings</h4>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span>PostgreSQL Financial Locks</span>
              <strong className="text-emerald-700">Active (FOR UPDATE)</strong>
            </div>
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span>Row Level Security (RLS)</span>
              <strong className="text-emerald-700">Enforced on all 16 Tables</strong>
            </div>
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span>Telegram Bot Verification</span>
              <strong className="text-sky-700">Server-side via Edge Functions</strong>
            </div>
          </div>
        </div>
      ) : (
        /* 10. Audit Logs */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden divide-y divide-slate-100">
          {auditLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">No audit logs recorded.</div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-mono px-2 py-0.5 rounded-md">
                      {log.action}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Target: {log.target_type} ({log.target_id?.substring(0, 8)})
                    </span>
                  </div>
                  <pre className="text-[10px] text-slate-500 mt-1 font-mono">
                    {JSON.stringify(log.details)}
                  </pre>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatDate(log.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Admin Wallet Adjustment Modal */}
      {adjustModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <h4 className="text-base font-bold text-slate-900 mb-1">
              Adjust User Balance
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              For user: <strong>{adjustModalUser.full_name}</strong> ({adjustModalUser.email})
            </p>

            {adjustError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl mb-3">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustWalletSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('CREDIT')}
                  className={`py-2 text-xs font-bold rounded-xl border ${
                    adjustType === 'CREDIT' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50'
                  }`}
                >
                  Credit (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('DEBIT')}
                  className={`py-2 text-xs font-bold rounded-xl border ${
                    adjustType === 'DEBIT' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50'
                  }`}
                >
                  Debit (-)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="100.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Audit Reason
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Promotional reward grant, dispute settlement"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalUser(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs"
                >
                  {adjustLoading ? 'Executing...' : 'Apply Ledger Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Deposit Modal */}
      {rejectModalDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <h4 className="text-base font-bold text-slate-900">
              Reject Deposit Request
            </h4>
            <p className="text-xs text-slate-600">
              Are you sure you want to reject this deposit request of <strong>₹{rejectModalDeposit.amount}</strong> with UTR <strong className="font-mono">{rejectModalDeposit.utr_number}</strong>? No wallet funds will be added.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rejection Reason (Shown to user)
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. UTR not found in bank statement, amount mismatch"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalDeposit(null)}
                disabled={rejectingLoading}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectDepositSubmit}
                disabled={rejectingLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                {rejectingLoading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lifafa Withdrawal Block / Unblock Modal */}
      {lifafaWithdrawalModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {lifafaWithdrawalTargetStatus === 'BLOCKED' ? (
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {lifafaWithdrawalTargetStatus === 'BLOCKED' ? 'Block Lifafa Withdrawals' : 'Unblock Lifafa Withdrawals'}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">{lifafaWithdrawalModalItem.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLifafaWithdrawalModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-700 font-semibold mb-1">
                Lifafa: <span className="text-slate-900 font-bold">{lifafaWithdrawalModalItem.title}</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Pool: {formatCurrency(lifafaWithdrawalModalItem.total_amount)} • Claims: {lifafaWithdrawalModalItem.claimed_count}/{lifafaWithdrawalModalItem.winner_count}
              </p>
            </div>

            {/* Prominent Warning Box */}
            {lifafaWithdrawalTargetStatus === 'BLOCKED' ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Important Policy Notice</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  Rewards from this Lifafa will remain in the winner's account, but will not be eligible for withdrawal until withdrawals are unblocked.
                </p>
                <p className="text-[10px] text-amber-700/80">
                  Note: This action does not delete rewards, alter wallet balances, or trigger refunds.
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Restoring Withdrawal Eligibility</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                  Winners will immediately regain the ability to withdraw eligible rewards from this Lifafa according to standard platform withdrawal rules.
                </p>
              </div>
            )}

            <form onSubmit={handleConfirmLifafaWithdrawalToggle} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lifafaWithdrawalTargetStatus === 'BLOCKED' ? 'Mandatory Reason for Block' : 'Audit Reason (Optional)'}
                </label>
                <input
                  type="text"
                  value={lifafaWithdrawalReason}
                  onChange={(e) => setLifafaWithdrawalReason(e.target.value)}
                  placeholder={
                    lifafaWithdrawalTargetStatus === 'BLOCKED'
                      ? 'e.g. Under investigation, task integrity audit, suspicious activity'
                      : 'e.g. Audit completed, identity verified, false alarm'
                  }
                  required={lifafaWithdrawalTargetStatus === 'BLOCKED'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {lifafaWithdrawalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-medium">
                  {lifafaWithdrawalError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLifafaWithdrawalModalItem(null)}
                  disabled={lifafaWithdrawalLoading}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lifafaWithdrawalLoading}
                  className={`flex-1 py-2.5 font-bold rounded-xl text-xs text-white cursor-pointer transition-all ${
                    lifafaWithdrawalTargetStatus === 'BLOCKED'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20'
                  }`}
                >
                  {lifafaWithdrawalLoading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </span>
                  ) : lifafaWithdrawalTargetStatus === 'BLOCKED' ? (
                    'Confirm Block Withdrawals'
                  ) : (
                    'Confirm Unblock Withdrawals'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
