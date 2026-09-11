import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import type { Withdrawal, WalletTransaction, WithdrawalStatus } from '../../types/database';
import { formatCurrency, formatDate } from '../../lib/utils';

interface WithdrawalHistoryProps {
  withdrawals: Withdrawal[];
  transactions?: WalletTransaction[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onOpenWithdraw?: () => void;
}

export const WithdrawalHistory: React.FC<WithdrawalHistoryProps> = ({
  withdrawals,
  transactions = [],
  loading = false,
  error = null,
  onRefresh,
  onOpenWithdraw,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PAID' | 'PROCESSING' | 'FAILED'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyRef = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatMaskedAccount = (masked: string | null | undefined): string => {
    if (!masked) return 'Bank Account';
    const clean = masked.trim();
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 4) {
      return `••••${digits.slice(-4)}`;
    }
    const parts = clean.split(/[- ]+/);
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) {
      return `••••${lastPart}`;
    }
    return clean.replace(/X/gi, '•');
  };

  const getStatusPresentation = (status: WithdrawalStatus) => {
    switch (status) {
      case 'SUCCESS':
        return {
          label: 'Paid',
          badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case 'PROCESSING':
        return {
          label: 'Processing',
          badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/80',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />,
        };
      case 'FAILED':
      case 'REVERSED':
        return {
          label: 'Failed',
          badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200/80',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
        };
      case 'PENDING':
      default:
        return {
          label: 'Pending',
          badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200/80',
          icon: <Clock className="w-3.5 h-3.5 text-blue-600" />,
        };
    }
  };

  const isWithdrawalRefunded = (w: Withdrawal): boolean => {
    // Database confirmation: reversal entry in wallet_transactions or terminal FAILED/REVERSED status
    const hasReversalTx = transactions.some(
      (t) =>
        t.type === 'WITHDRAWAL_REVERSAL' &&
        (t.reference_id === w.id || (t.metadata && t.metadata.withdrawal_id === w.id))
    );
    return hasReversalTx || w.status === 'FAILED' || w.status === 'REVERSED';
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (filter === 'ALL') return true;
    if (filter === 'PAID') return w.status === 'SUCCESS';
    if (filter === 'PROCESSING') return w.status === 'PROCESSING' || w.status === 'PENDING';
    if (filter === 'FAILED') return w.status === 'FAILED' || w.status === 'REVERSED';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter and Refresh Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: 'ALL', label: 'All', count: withdrawals.length },
              {
                key: 'PAID',
                label: 'Paid',
                count: withdrawals.filter((w) => w.status === 'SUCCESS').length,
              },
              {
                key: 'PROCESSING',
                label: 'Processing',
                count: withdrawals.filter((w) => w.status === 'PROCESSING' || w.status === 'PENDING').length,
              },
              {
                key: 'FAILED',
                label: 'Failed',
                count: withdrawals.filter((w) => w.status === 'FAILED' || w.status === 'REVERSED').length,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filter === item.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filter === item.key ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="self-end sm:self-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
            title="Refresh withdrawals"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-xs font-bold text-rose-900 underline hover:no-underline shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 bg-slate-50/70 border border-slate-100 rounded-2xl animate-pulse space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 bg-slate-200 rounded-md w-32"></div>
                <div className="h-5 bg-slate-200 rounded-full w-16"></div>
              </div>
              <div className="h-12 bg-slate-200/60 rounded-xl w-full"></div>
              <div className="flex justify-between items-center pt-2">
                <div className="h-3 bg-slate-200 rounded-md w-24"></div>
                <div className="h-3 bg-slate-200 rounded-md w-20"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredWithdrawals.length === 0 && (
        <div className="py-14 px-4 text-center">
          <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Building2 className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-1">
            {filter === 'ALL' ? 'No Withdrawals Yet' : `No ${filter.toLowerCase()} withdrawals`}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 leading-relaxed">
            {filter === 'ALL'
              ? 'When you withdraw funds to your bank account, your withdrawal status, fee breakdown, and payment details will appear here.'
              : `You currently have no withdrawals in ${filter.toLowerCase()} status.`}
          </p>
          {onOpenWithdraw && filter === 'ALL' && (
            <button
              onClick={onOpenWithdraw}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-blue-700 transition-colors"
            >
              <span>Withdraw Funds</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Withdrawals List */}
      {!loading && !error && filteredWithdrawals.length > 0 && (
        <div className="space-y-3">
          {filteredWithdrawals.map((w) => {
            const statusInfo = getStatusPresentation(w.status);
            const refId = w.payout_reference_id || w.provider_order_id;
            const isRefunded = isWithdrawalRefunded(w);
            const maskedAcc = formatMaskedAccount(w.bank_account_number_masked);
            const payoutAmount = w.net_amount ?? w.amount;
            const feeAmount = w.fee_amount ?? 0;
            const totalDeducted = w.amount;

            return (
              <div
                key={w.id}
                className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs hover:border-slate-300 transition-all space-y-3.5"
              >
                {/* Header Row: Recipient & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {w.account_holder_name}
                      </h5>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                        <span className="font-semibold text-slate-700">{maskedAcc}</span>
                        {w.ifsc_code && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400">{w.ifsc_code}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold uppercase shrink-0 ${statusInfo.badgeClass}`}
                  >
                    {statusInfo.icon}
                    <span>{statusInfo.label}</span>
                  </div>
                </div>

                {/* Financial Breakdown 3-Box Container (Clearly Distinguishing Payout, Fee, Deduction) */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                  <div className="border-r border-slate-200/60 pr-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                      Payout Amount
                    </span>
                    <span className="text-xs sm:text-sm font-black text-emerald-600 mt-0.5 block">
                      {formatCurrency(payoutAmount)}
                    </span>
                  </div>

                  <div className="border-r border-slate-200/60 pr-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                      Platform Fee
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-600 mt-0.5 block">
                      {formatCurrency(feeAmount)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                      Total Deducted
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 block">
                      {formatCurrency(totalDeducted)}
                    </span>
                  </div>
                </div>

                {/* Contextual Explanations */}
                {w.status === 'PROCESSING' && (
                  <div className="p-2.5 bg-amber-50/80 border border-amber-200/60 rounded-xl flex items-start gap-2 text-xs text-amber-800">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-snug">
                      Your withdrawal has been accepted for processing. Bank credit may take some time.
                    </p>
                  </div>
                )}

                {(w.status === 'FAILED' || w.status === 'REVERSED') && (
                  <div className="p-2.5 bg-rose-50/80 border border-rose-200/60 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                    <RotateCcw className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="leading-snug">
                      {isRefunded
                        ? `Your withdrawal could not be completed. The full amount of ${formatCurrency(
                            totalDeducted
                          )} has been refunded to your wallet balance.`
                        : 'Your withdrawal could not be completed. Our system is reconciling your account.'}
                    </p>
                  </div>
                )}

                {w.status === 'SUCCESS' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Bank payout dispatched successfully</span>
                  </div>
                )}

                {/* Footer Metadata: Date & Provider Reference */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>{formatDate(w.created_at)}</span>

                  {refId && (
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-slate-400">Ref:</span>
                      <span className="text-slate-600 font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                        {refId}
                      </span>
                      <button
                        onClick={() => handleCopyRef(refId, w.id)}
                        className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-sm"
                        title="Copy Reference ID"
                      >
                        {copiedId === w.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
