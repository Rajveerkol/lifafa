import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Wallet,
  Send,
  ArrowDownToLine,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Key,
  Shield,
  FileText,
  DollarSign,
  Users,
  Search,
  Check,
  X,
  Sliders,
  Bell,
  Eye,
  Activity,
  ChevronRight,
  Info,
} from 'lucide-react';
import { merchantGatewayService } from '../../services/merchantGatewayService';
import type {
  Merchant,
  MerchantWallet,
  MerchantPayout,
  MerchantDeposit,
  MerchantLedgerEntry,
  MerchantPayoutEvent,
} from '../../types/merchant';
import { formatCurrency, formatDate } from '../../lib/utils';

type MerchantAdminTab =
  | 'merchants'
  | 'deposits'
  | 'payouts'
  | 'wallets'
  | 'ledger'
  | 'fees'
  | 'events'
  | 'reports'
  | 'settings';

export const AdminMerchantPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MerchantAdminTab>('deposits');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data lists
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [deposits, setDeposits] = useState<MerchantDeposit[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [wallets, setWallets] = useState<MerchantWallet[]>([]);
  const [ledger, setLedger] = useState<MerchantLedgerEntry[]>([]);
  const [events, setEvents] = useState<MerchantPayoutEvent[]>([]);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [depositFilter, setDepositFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [payoutFilter, setPayoutFilter] = useState<'ALL' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('ALL');

  // Review Modals
  const [approvingDeposit, setApprovingDeposit] = useState<MerchantDeposit | null>(null);
  const [rejectingDeposit, setRejectingDeposit] = useState<MerchantDeposit | null>(null);
  const [approvingMerchant, setApprovingMerchant] = useState<Merchant | null>(null);
  const [editingFeeMerchant, setEditingFeeMerchant] = useState<Merchant | null>(null);
  const [feeStatusInput, setFeeStatusInput] = useState<'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAID' | 'FAILED'>('PAID');
  const [feeRefInput, setFeeRefInput] = useState('');
  const [feeMethodInput, setFeeMethodInput] = useState('UPI_DIRECT');
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Selected event payload modal
  const [selectedEvent, setSelectedEvent] = useState<MerchantPayoutEvent | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [mList, dList, pList, wList, lList, eList] = await Promise.all([
        merchantGatewayService.getAllMerchants(),
        merchantGatewayService.getAllMerchantDeposits(),
        merchantGatewayService.getAllMerchantPayouts(),
        merchantGatewayService.getAllMerchantWallets(),
        merchantGatewayService.getAllMerchantLedger(),
        merchantGatewayService.getAllMerchantEvents(),
      ]);
      setMerchants(mList);
      setDeposits(dList);
      setPayouts(pList);
      setWallets(wList);
      setLedger(lList);
      setEvents(eList);
    } catch (err) {
      console.error('Error loading merchant admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleApprove = async () => {
    if (!approvingDeposit) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await merchantGatewayService.approveMerchantDeposit(approvingDeposit.id, adminNotes);
      setActionSuccess(`Deposit approved! Net ₹${approvingDeposit.net_credited} credited to merchant float.`);
      setApprovingDeposit(null);
      setAdminNotes('');
      await loadData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve deposit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingDeposit) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await merchantGatewayService.rejectMerchantDeposit(
        rejectingDeposit.id,
        adminNotes.trim() || 'Rejected by platform administrator'
      );
      setActionSuccess('Deposit rejected.');
      setRejectingDeposit(null);
      setAdminNotes('');
      await loadData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject deposit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveMerchant = async () => {
    if (!approvingMerchant) return;
    if (approvingMerchant.setup_fee_status !== 'PAID') {
      setActionError('Cannot approve merchant: ₹999 setup fee must be PAID before activating gateway.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await merchantGatewayService.adminApproveMerchant(approvingMerchant.id, adminNotes);
      setActionSuccess(`Merchant "${approvingMerchant.business_name}" activated successfully! Float operations & API unlocked.`);
      setApprovingMerchant(null);
      setAdminNotes('');
      await loadData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve merchant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSetupFee = async () => {
    if (!editingFeeMerchant) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await merchantGatewayService.adminRecordSetupFee(
        editingFeeMerchant.id,
        feeStatusInput,
        feeRefInput.trim() || undefined,
        feeMethodInput.trim() || undefined
      );
      setActionSuccess(`Setup fee status for "${editingFeeMerchant.business_name}" updated to ${feeStatusInput}.`);
      setEditingFeeMerchant(null);
      await loadData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update setup fee');
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics Calculations
  const totalFloatDeposited = deposits
    .filter((d) => d.status === 'APPROVED')
    .reduce((sum, d) => sum + Number(d.gross_amount), 0);
  const totalDepositFees = deposits
    .filter((d) => d.status === 'APPROVED')
    .reduce((sum, d) => sum + Number(d.deposit_fee), 0);
  const totalPayoutVolume = payouts
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPayoutFees = payouts
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + Number(p.fee_amount), 0);
  const pendingDepositsCount = deposits.filter((d) => d.status === 'PENDING').length;
  const pendingMerchantsCount = merchants.filter((m) => m.status === 'PENDING_APPROVAL').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'APPROVED':
      case 'ACTIVE':
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>{status === 'PAID' ? '₹999 PAID' : status}</span>
          </span>
        );
      case 'PROCESSING':
      case 'PENDING':
      case 'PENDING_APPROVAL':
      case 'PAYMENT_PENDING':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>{status === 'PENDING_APPROVAL' ? 'PENDING APPROVAL' : status === 'PAYMENT_PENDING' ? 'FEE PENDING' : status}</span>
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
      case 'REVERSED':
      case 'SUSPENDED':
      case 'PAYMENT_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border border-red-200">
            <XCircle className="w-3 h-3" />
            <span>{status === 'PAYMENT_REQUIRED' ? 'PAYMENT REQUIRED' : status}</span>
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
            {status}
          </span>
        );
    }
  };

  const navTabs: { id: MerchantAdminTab; label: string; icon: any; count?: number }[] = [
    { id: 'deposits', label: 'Deposits', icon: ArrowDownToLine, count: pendingDepositsCount },
    { id: 'payouts', label: 'Payouts', icon: Send, count: payouts.length },
    { id: 'merchants', label: 'Merchants', icon: Building2, count: pendingMerchantsCount > 0 ? pendingMerchantsCount : undefined },
    { id: 'wallets', label: 'Wallets', icon: Wallet },
    { id: 'ledger', label: 'Audit Ledger', icon: FileText },
    { id: 'fees', label: 'Fee Rules', icon: DollarSign },
    { id: 'events', label: 'Webhook Events', icon: Activity },
    { id: 'reports', label: 'Reports', icon: Sliders },
    { id: 'settings', label: 'Settings', icon: Shield },
  ];

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading Multi-Merchant Gateway Administration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Gateway Admin Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 text-white shadow-xl border border-blue-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Merchant Gateway Administration</h2>
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-blue-400/30">
                  Live System
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Isolated B2B float oversight, manual UPI reviews, provider reconciliation, and audit logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 p-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Overview Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Float Deposited</span>
            <span className="text-lg font-black text-emerald-400 mt-0.5 block">{formatCurrency(totalFloatDeposited)}</span>
            <span className="text-[10px] text-slate-400">2% Fees: {formatCurrency(totalDepositFees)}</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Disbursed</span>
            <span className="text-lg font-black text-white mt-0.5 block">{formatCurrency(totalPayoutVolume)}</span>
            <span className="text-[10px] text-slate-400">Fees: {formatCurrency(totalPayoutFees)}</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Deposit Reviews</span>
            <span className={`text-lg font-black mt-0.5 block ${pendingDepositsCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {pendingDepositsCount}
            </span>
            <span className="text-[10px] text-slate-400">Manual review required</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Registered Merchants</span>
            <span className="text-lg font-black text-white mt-0.5 block">{merchants.length}</span>
            <span className="text-[10px] text-emerald-400">Active accounts</span>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-bold">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-800 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-bold">{actionError}</span>
        </div>
      )}

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    tab.id === 'deposits' && pendingDepositsCount > 0
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* A. Deposits Management */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDepositFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    depositFilter === filter
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
                placeholder="Search by UTR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
            {deposits
              .filter((d) => depositFilter === 'ALL' || d.status === depositFilter)
              .filter((d) => !searchTerm || d.utr_number.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((d) => {
                const merchant = merchants.find((m) => m.id === d.merchant_id);
                return (
                  <div key={d.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 font-mono">UTR: {d.utr_number}</span>
                        {getStatusBadge(d.status)}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <span>Merchant: <strong>{merchant?.business_name || d.merchant_id.slice(0, 8)}</strong></span>
                        <span>•</span>
                        <span>Code: <code className="text-slate-500">{merchant?.merchant_code || 'N/A'}</code></span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Submitted: {formatDate(d.created_at)}
                        {d.reviewed_at && ` • Reviewed: ${formatDate(d.reviewed_at)}`}
                      </div>
                      {d.admin_notes && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-block mt-1">
                          Admin Note: {d.admin_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-black text-emerald-700">
                          Net: {formatCurrency(d.net_credited)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Gross: {formatCurrency(d.gross_amount)} | Fee (2%): {formatCurrency(d.deposit_fee)}
                        </div>
                      </div>

                      {d.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setApprovingDeposit(d);
                              setAdminNotes('');
                            }}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectingDeposit(d);
                              setAdminNotes('');
                            }}
                            className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* B. Payouts Oversight */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['ALL', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPayoutFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    payoutFilter === filter
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
            {payouts
              .filter((p) => payoutFilter === 'ALL' || p.status === payoutFilter)
              .filter(
                (p) =>
                  !searchTerm ||
                  p.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.account_holder_name.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((p) => {
                const merchant = merchants.find((m) => m.id === p.merchant_id);
                return (
                  <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{p.account_holder_name}</span>
                        {getStatusBadge(p.status)}
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        <span>{p.bank_account_number_masked}</span> • <span>{p.ifsc_code}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Order: <strong>{p.order_id}</strong> • Provider Order: <code>{p.provider_order_id}</code>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Merchant: <strong>{merchant?.business_name || p.merchant_id.slice(0, 8)}</strong> (Code: {merchant?.merchant_code})
                      </div>
                      {p.provider_reference_id && (
                        <div className="text-[11px] text-emerald-700 font-mono">
                          Provider Ref / UTR: {p.provider_reference_id}
                        </div>
                      )}
                      {p.rejection_reason && (
                        <div className="text-[11px] text-red-600">Rejection: {p.rejection_reason}</div>
                      )}
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-sm font-black text-slate-900">{formatCurrency(p.amount)}</div>
                      <div className="text-[11px] text-slate-400">
                        Fee: {formatCurrency(p.fee_amount)} • Total: {formatCurrency(p.total_deducted)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(p.created_at)}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* C. Merchants Directory */}
      {activeTab === 'merchants' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
          {merchants.map((m) => {
            const wallet = wallets.find((w) => w.merchant_id === m.id);
            const isPaid = m.setup_fee_status === 'PAID';
            const isActive = m.status === 'ACTIVE';

            return (
              <div key={m.id} className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                {/* 1. Identity & Status */}
                <div className="space-y-1.5 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-900">{m.business_name}</span>
                    {getStatusBadge(m.status)}
                    {getStatusBadge(m.setup_fee_status || 'PAYMENT_REQUIRED')}
                  </div>
                  <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                    <span>Code: <strong className="text-slate-700">{m.merchant_code}</strong></span>
                    <span>•</span>
                    <span>Mobile: {m.mobile_number}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Registered: {formatDate(m.created_at)}
                  </div>
                </div>

                {/* 2. Setup Fee Audit Details */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1 min-w-[240px]">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Setup Fee Amount:</span>
                    <strong className="text-slate-800">₹{m.setup_fee_amount ?? 999}.00</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Payment Ref:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[140px]" title={m.setup_fee_reference || 'N/A'}>
                      {m.setup_fee_reference || 'None'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Paid Date:</span>
                    <span className="text-slate-700">
                      {m.setup_fee_paid_at ? formatDate(m.setup_fee_paid_at) : 'Not Paid'}
                    </span>
                  </div>
                  {m.setup_fee_payment_method && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Method:</span>
                      <span>{m.setup_fee_payment_method}</span>
                    </div>
                  )}
                </div>

                {/* 3. Float Balances */}
                <div className="text-left lg:text-right min-w-[160px]">
                  <div className="text-xs text-slate-500">Available Float</div>
                  <div className="text-base font-black text-emerald-700">
                    {formatCurrency(wallet?.available_balance ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Locked: {formatCurrency(wallet?.locked_payout_balance ?? 0)}
                  </div>
                </div>

                {/* 4. Administrative Actions */}
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                  <button
                    onClick={() => {
                      setEditingFeeMerchant(m);
                      setFeeStatusInput(m.setup_fee_status || 'PAID');
                      setFeeRefInput(m.setup_fee_reference || '');
                      setFeeMethodInput(m.setup_fee_payment_method || 'ADMIN_OVERRIDE');
                    }}
                    className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                    title="Override or Record Setup Fee"
                  >
                    Manage Fee
                  </button>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setApprovingMerchant(m)}
                      disabled={!isPaid}
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        isPaid
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 cursor-pointer active:scale-98'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                      title={isPaid ? 'Approve Gateway Access' : 'Cannot approve: Setup fee is not PAID'}
                    >
                      <Check className="w-4 h-4" />
                      <span>{isPaid ? 'Approve Gateway' : 'Requires ₹999 Fee'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* D. Wallets & Float Oversight */}
      {activeTab === 'wallets' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
          {wallets.map((w) => {
            const merchant = merchants.find((m) => m.id === w.merchant_id);
            return (
              <div key={w.id} className="p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">{merchant?.business_name}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Code: {merchant?.merchant_code} • Wallet ID: {w.id.slice(0, 8)}...
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-black text-emerald-700">{formatCurrency(w.available_balance)}</div>
                  <div className="text-[10px] text-slate-500">
                    Locked: {formatCurrency(w.locked_payout_balance)} | Deposited: {formatCurrency(w.total_deposited)} | Fees: {formatCurrency(w.total_fees_paid)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* E. Audit Ledger Entries */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
          {ledger.map((l) => (
            <div key={l.id} className="p-4 flex items-center justify-between text-xs">
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
                  Fee: {formatCurrency(l.fee_amount)} | After: {formatCurrency(l.balance_after)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* F. Fee Rules Table */}
      {activeTab === 'fees' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-2xs">
          <div>
            <h3 className="text-sm font-black text-slate-900">Multi-Merchant Platform Fee Schedule</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enforced server-side in migration 028/029 and verified mathematically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Float Deposit Fee</span>
              <div className="text-2xl font-black text-slate-900 mt-1">2.00%</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Deducted automatically from gross UPI deposit amount before crediting available float.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Payout Fee (Tier 1)</span>
              <div className="text-2xl font-black text-slate-900 mt-1">₹3.70</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Applies to all disbursements where amount &le; ₹100.00.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Payout Fee (Tier 2)</span>
              <div className="text-2xl font-black text-slate-900 mt-1">₹3.80</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Applies to disbursements where amount &gt; ₹100.00 and &le; ₹1,000.00.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* G. Webhook Events Audit Log */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
          {events.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No webhook events logged yet.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 font-mono">{e.event_type}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                      {e.provider_event_id}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {formatDate(e.created_at)} {e.payout_id && `• Payout: ${e.payout_id.slice(0, 8)}`}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEvent(e)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Payload</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* H. Reports & Financial Summary */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-2xs">
          <div>
            <h3 className="text-sm font-black text-slate-900">Financial Liquidity &amp; Performance Summary</h3>
            <p className="text-xs text-slate-500 mt-0.5">Authoritative platform totals derived from isolated tables</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
              <span className="text-[10px] uppercase font-bold text-blue-600">Gross Float Deposits</span>
              <div className="text-xl font-black text-slate-900 mt-1">{formatCurrency(totalFloatDeposited)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <span className="text-[10px] uppercase font-bold text-emerald-600">Net Float Credited</span>
              <div className="text-xl font-black text-emerald-700 mt-1">{formatCurrency(totalFloatDeposited - totalDepositFees)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
              <span className="text-[10px] uppercase font-bold text-amber-700">Platform Deposit Fees</span>
              <div className="text-xl font-black text-amber-800 mt-1">{formatCurrency(totalDepositFees)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100">
              <span className="text-[10px] uppercase font-bold text-purple-700">Disbursed Payouts</span>
              <div className="text-xl font-black text-purple-900 mt-1">{formatCurrency(totalPayoutVolume)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100">
              <span className="text-[10px] uppercase font-bold text-teal-700">Payout Fees Earned</span>
              <div className="text-xl font-black text-teal-900 mt-1">{formatCurrency(totalPayoutFees)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-600">Total Net Platform Revenue</span>
              <div className="text-xl font-black text-slate-900 mt-1">{formatCurrency(totalDepositFees + totalPayoutFees)}</div>
            </div>
          </div>
        </div>
      )}

      {/* I. Gateway Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs">
          <div>
            <h3 className="text-sm font-black text-slate-900">Gateway Platform Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">Platform isolation parameters</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="font-bold">One-Time Setup Fee (₹999):</span>
              <span className="text-amber-700 font-bold">Pending final provider decision</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="font-bold">Provider Integration:</span>
              <span className="font-mono text-blue-700">PayRupee (https://payrupee.tech/v1/payouts/)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="font-bold">Webhook Signature Algorithm:</span>
              <span className="font-mono text-slate-900">HMAC SHA-256 (X-PAYRUPEE-SIGNATURE)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-bold">Max Payout per Transaction:</span>
              <span className="font-mono text-slate-900">₹1,000.00</span>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approvingDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">Approve Merchant Float Deposit</h4>
              <button onClick={() => setApprovingDeposit(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
              <div>UTR: <strong className="font-mono">{approvingDeposit.utr_number}</strong></div>
              <div>Gross Amount: <strong>{formatCurrency(approvingDeposit.gross_amount)}</strong></div>
              <div>Deposit Fee (2%): <strong className="text-amber-600">-{formatCurrency(approvingDeposit.deposit_fee)}</strong></div>
              <div>Net Float to Credit: <strong className="text-emerald-600">{formatCurrency(approvingDeposit.net_credited)}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Admin Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Verified in ICICI Current Account"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setApprovingDeposit(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
              >
                {actionLoading ? 'Approving...' : 'Confirm & Credit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">Reject Merchant Float Deposit</h4>
              <button onClick={() => setRejectingDeposit(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
              <div>UTR: <strong className="font-mono">{rejectingDeposit.utr_number}</strong></div>
              <div>Gross Amount: <strong>{formatCurrency(rejectingDeposit.gross_amount)}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason</label>
              <input
                type="text"
                placeholder="e.g. UTR not found in bank statement"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setRejectingDeposit(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-xs"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Payload Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 text-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-200">Webhook Raw Event Payload</h4>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{selectedEvent.provider_event_id}</div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="bg-slate-950 p-4 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-80 border border-slate-800">
              {JSON.stringify(selectedEvent.raw_payload, null, 2)}
            </pre>

            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Merchant Approval Modal */}
      {approvingMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Approve Merchant Gateway</h4>
              </div>
              <button onClick={() => setApprovingMerchant(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Business Name:</span>
                <strong className="text-slate-900">{approvingMerchant.business_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Merchant Code:</span>
                <span className="font-mono text-slate-700">{approvingMerchant.merchant_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Setup Fee:</span>
                <span className="font-bold text-emerald-700">₹{approvingMerchant.setup_fee_amount ?? 999} (PAID)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Ref:</span>
                <span className="font-mono text-slate-700">{approvingMerchant.setup_fee_reference || 'N/A'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Approving this merchant sets their status to <strong>ACTIVE</strong> and unlocks live float deposit, instant PayRupee payout dispatch, and server-side API key generation.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Administrative Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Verified payment ref ACT-XXXX; approved for production"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setApprovingMerchant(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveMerchant}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer active:scale-98"
              >
                {actionLoading ? 'Activating...' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Setup Fee Modal */}
      {editingFeeMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Manage Setup Fee Status</h4>
              </div>
              <button onClick={() => setEditingFeeMerchant(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl text-xs border border-slate-200">
              <span className="text-slate-500">Merchant: </span>
              <strong className="text-slate-900">{editingFeeMerchant.business_name}</strong>
              <span className="text-slate-400 font-mono text-[11px] ml-2">({editingFeeMerchant.merchant_code})</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Setup Fee Status</label>
                <select
                  value={feeStatusInput}
                  onChange={(e: any) => setFeeStatusInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="PAID">PAID (₹999 Verified)</option>
                  <option value="PAYMENT_PENDING">PAYMENT_PENDING (Verification in Progress)</option>
                  <option value="PAYMENT_REQUIRED">PAYMENT_REQUIRED (Awaiting Payment)</option>
                  <option value="FAILED">FAILED (Payment Failed / Rejected)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Reference / UTR</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-UTR-12345678 or ACT-999-REF"
                  value={feeRefInput}
                  onChange={(e) => setFeeRefInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <input
                  type="text"
                  placeholder="e.g. UPI_DIRECT, BANK_TRANSFER, ADMIN_MANUAL"
                  value={feeMethodInput}
                  onChange={(e) => setFeeMethodInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingFeeMerchant(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSetupFee}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-98"
              >
                {actionLoading ? 'Saving...' : 'Save Fee Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
