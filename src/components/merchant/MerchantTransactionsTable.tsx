import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  ArrowDownToLine,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Calendar,
} from 'lucide-react';
import type {
  MerchantUnifiedTransaction,
  MerchantTransactionsQueryParams,
  MerchantTransactionsResponse,
} from '../../types/merchant';
import { merchantGatewayService } from '../../services/merchantGatewayService';
import { formatInr } from './MerchantFinancialOverviewCards';

interface MerchantTransactionsTableProps {
  merchantId: string;
  initialType?: 'ALL' | 'DEPOSIT' | 'WITHDRAWAL';
  initialStatus?: string;
  onRefreshAnalytics?: () => void;
}

export const MerchantTransactionsTable: React.FC<MerchantTransactionsTableProps> = ({
  merchantId,
  initialType = 'ALL',
  initialStatus = 'ALL',
  onRefreshAnalytics,
}) => {
  // Query Filters State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>(initialType);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED' | 'REJECTED'>(
    (initialStatus as any) || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Results State
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<MerchantTransactionsResponse>({
    transactions: [],
    total_count: 0,
    page: 1,
    pageSize: 100,
    total_pages: 1,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync initial props if changed from outside
  useEffect(() => {
    if (initialType) setTypeFilter(initialType);
    if (initialStatus) setStatusFilter(initialStatus as any);
  }, [initialType, initialStatus]);

  // Fetch paginated transactions from server/service
  const loadTransactions = async (pageToLoad: number = currentPage) => {
    setLoading(true);
    try {
      // Calculate date filter strings
      let startIso: string | undefined;
      let endIso: string | undefined;

      if (datePreset === 'TODAY') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        startIso = d.toISOString();
      } else if (datePreset === 'YESTERDAY') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        startIso = d.toISOString();
        const endD = new Date(d);
        endD.setHours(23, 59, 59, 999);
        endIso = endD.toISOString();
      } else if (datePreset === 'WEEK') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startIso = d.toISOString();
      } else if (datePreset === 'MONTH') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startIso = d.toISOString();
      } else if (datePreset === 'CUSTOM') {
        if (customStartDate) startIso = new Date(customStartDate).toISOString();
        if (customEndDate) {
          const endD = new Date(customEndDate);
          endD.setHours(23, 59, 59, 999);
          endIso = endD.toISOString();
        }
      }

      const params: MerchantTransactionsQueryParams = {
        merchantId,
        page: pageToLoad,
        pageSize: 100, // Explicit authoritative requirement: exactly 100 records per page
        type: typeFilter,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
        startDate: startIso,
        endDate: endIso,
        minAmount: minAmount.trim() ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount.trim() ? parseFloat(maxAmount) : undefined,
      };

      const res = await merchantGatewayService.getMerchantUnifiedTransactions(params);
      setData(res);
      setCurrentPage(res.page);
    } catch (err) {
      console.error('Failed to load merchant transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch whenever filters change (Always reset to page 1)
  useEffect(() => {
    setCurrentPage(1);
    loadTransactions(1);
  }, [
    merchantId,
    typeFilter,
    statusFilter,
    searchQuery,
    datePreset,
    customStartDate,
    customEndDate,
    minAmount,
    maxAmount,
  ]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > data.total_pages || newPage === currentPage) return;
    setCurrentPage(newPage);
    loadTransactions(newPage);
    // Smooth scroll to top of table
    const tableEl = document.getElementById('merchant-tx-table-container');
    if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (!data.transactions.length) return;
    const headers = [
      'Type',
      'Reference / Order ID',
      'Provider Ref / UTR',
      'Gross Amount',
      'Fee',
      'Net Amount',
      'Status',
      'Payment Method',
      'Beneficiary / Sender',
      'Created At',
    ];

    const rows = data.transactions.map((t) => [
      t.type,
      `"${t.reference_id}"`,
      `"${t.provider_reference_id || t.provider_order_id || ''}"`,
      t.amount,
      t.fee,
      t.net_amount,
      t.status,
      t.payment_method,
      `"${t.recipient_or_sender || ''}"`,
      `"${new Date(t.created_at).toLocaleString('en-IN')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `merchant_transactions_page_${currentPage}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  // Calculate slice range numbers
  const displayFrom = data.total_count === 0 ? 0 : (currentPage - 1) * data.pageSize + 1;
  const displayTo = Math.min(currentPage * data.pageSize, data.total_count);

  // Generate numbered pagination buttons with ellipsis windowing
  const getPaginationPages = () => {
    const total = data.total_pages;
    const current = currentPage;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  return (
    <div id="merchant-tx-table-container" className="space-y-4">
      {/* 1. Control Toolbar (Filters & Search) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
        {/* Top Filter Row: Type + Status Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Type Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { id: 'ALL', label: 'All Transactions' },
                { id: 'DEPOSIT', label: 'Deposits Only' },
                { id: 'WITHDRAWAL', label: 'Payouts Only' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  typeFilter === t.id
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {(
              [
                { id: 'ALL', label: 'All Status' },
                { id: 'SUCCESS', label: 'Successful' },
                { id: 'PENDING', label: 'Pending' },
                { id: 'FAILED', label: 'Failed' },
                { id: 'REJECTED', label: 'Rejected' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === st.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Second Row: Search + Date Filters + Amount Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID, UTR, Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Date range dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today (IST)</option>
              <option value="YESTERDAY">Yesterday (IST)</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
              <option value="CUSTOM">Custom Date Range...</option>
            </select>
          </div>

          {/* Amount range filters */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min ₹"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
            <span className="text-slate-300 text-xs">-</span>
            <input
              type="number"
              placeholder="Max ₹"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Action buttons (Export & Refresh) */}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => {
                loadTransactions(currentPage);
                if (onRefreshAnalytics) onRefreshAnalytics();
              }}
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Refresh Transactions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!data.transactions.length}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              title="Export Current Page as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Custom date range inputs when active */}
        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600 animate-in fade-in">
            <span className="font-semibold text-slate-700">Custom Dates:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
            />
            <span>to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
            />
          </div>
        )}
      </div>

      {/* 2. Transactions Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && data.transactions.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-600">Loading 100 transactions per page...</p>
          </div>
        ) : data.transactions.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Transactions Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No transactions match your current search query or applied filters. Try clearing filters or adjusting your date range.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 select-none">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reference / Order ID</th>
                  <th className="px-4 py-3">Timestamp (IST)</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Net Float Impact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provider Ref / UTR</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.transactions.map((tx) => {
                  const isExpanded = expandedId === tx.id;
                  const isDeposit = tx.type === 'DEPOSIT';

                  return (
                    <React.Fragment key={tx.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        {/* Type Badge */}
                        <td className="px-4 py-3">
                          {isDeposit ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
                              <span>DEPOSIT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              <Send className="w-3 h-3 text-blue-600" />
                              <span>PAYOUT</span>
                            </span>
                          )}
                        </td>

                        {/* Reference ID / Order ID */}
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[140px]" title={tx.reference_id}>
                              {tx.reference_id}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(tx.reference_id, `ref-${tx.id}`);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                              title="Copy Reference"
                            >
                              {copiedId === `ref-${tx.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Date Time in IST */}
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {formatDate(tx.created_at)}
                        </td>

                        {/* Gross Amount */}
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {formatInr(tx.amount)}
                        </td>

                        {/* Fee */}
                        <td className="px-4 py-3 font-mono text-amber-700">
                          {tx.fee > 0 ? `-${formatInr(tx.fee)}` : '₹0.00'}
                        </td>

                        {/* Net Impact */}
                        <td className="px-4 py-3 font-mono font-bold">
                          {isDeposit ? (
                            <span className="text-emerald-700">+{formatInr(tx.net_amount)}</span>
                          ) : (
                            <span className="text-slate-900">-{formatInr(tx.net_amount)}</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3">
                          {tx.status === 'SUCCESS' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Payment Completed
                            </span>
                          )}
                          {tx.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending
                            </span>
                          )}
                          {tx.status === 'PROCESSING' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Processing
                            </span>
                          )}
                          {tx.status === 'FAILED' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Failed
                            </span>
                          )}
                          {tx.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Rejected
                            </span>
                          )}
                        </td>

                        {/* Provider Reference / UTR */}
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {tx.provider_reference_id ? (
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[130px]">{tx.provider_reference_id}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(tx.provider_reference_id!, `pr-${tx.id}`);
                                }}
                                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                title="Copy UTR / RRN"
                              >
                                {copiedId === `pr-${tx.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>

                        {/* Expand Details Trigger */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : tx.id);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={9} className="px-5 py-4 border-b border-slate-200">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                  <span>Transaction Audit Inspection</span>
                                  <span className="font-mono text-[11px] text-slate-400">ID: {tx.id}</span>
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                  Method: <strong>{tx.payment_method}</strong>
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                <div>
                                  <span className="text-slate-400 text-[11px] block">
                                    {isDeposit ? 'Deposit Origin / Bank' : 'Beneficiary Account / VPA'}
                                  </span>
                                  <span className="font-mono font-bold text-slate-800 break-all">
                                    {tx.recipient_or_sender || 'N/A'}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-slate-400 text-[11px] block">Gateway Provider Order ID</span>
                                  <span className="font-mono text-slate-800">
                                    {tx.provider_order_id || 'N/A'}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-slate-400 text-[11px] block">Reviewed / Processed At</span>
                                  <span className="font-mono text-slate-800">
                                    {tx.reviewed_or_processed_at ? formatDate(tx.reviewed_or_processed_at) : 'Awaiting Review'}
                                  </span>
                                </div>
                              </div>

                              {tx.notes_or_reason && (
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                                  <span className="font-semibold text-slate-800">Notes / Audit Log: </span>
                                  <span>{tx.notes_or_reason}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Pagination Controls (Authoritative 100 Records Per Page) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          {/* Record summary */}
          <div className="font-medium text-slate-600">
            Showing <strong className="text-slate-900 font-mono">{displayFrom.toLocaleString('en-IN')}</strong> &ndash;{' '}
            <strong className="text-slate-900 font-mono">{displayTo.toLocaleString('en-IN')}</strong> of{' '}
            <strong className="text-slate-900 font-mono">{data.total_count.toLocaleString('en-IN')}</strong> transactions
            <span className="text-slate-400 text-[11px] ml-2 font-mono">(100 per page)</span>
          </div>

          {/* Numbered Page Buttons & Navigation */}
          <div className="flex items-center gap-1 select-none">
            {/* First Page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || loading}
              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded-md hover:bg-slate-200/60 transition-colors font-medium cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Numbered Page Buttons */}
            <div className="flex items-center gap-1 mx-1">
              {getPaginationPages().map((p, idx) => {
                if (p === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400 select-none">
                      &hellip;
                    </span>
                  );
                }

                const pageNum = p as number;
                const isActive = pageNum === currentPage;

                return (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={loading}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= data.total_pages || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded-md hover:bg-slate-200/60 transition-colors font-medium cursor-pointer"
              title="Next Page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => handlePageChange(data.total_pages)}
              disabled={currentPage >= data.total_pages || loading}
              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
