import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Send,
  Layers,
  Activity,
} from 'lucide-react';
import type { MerchantFinancialAnalytics, MerchantWallet } from '../../types/merchant';

interface MerchantFinancialOverviewCardsProps {
  analytics: MerchantFinancialAnalytics | null;
  wallet: MerchantWallet | null;
  onTopUpClick?: () => void;
  onPayoutClick?: () => void;
  onViewTransactionsClick?: (type?: 'ALL' | 'DEPOSIT' | 'WITHDRAWAL', status?: string) => void;
}

export const formatInr = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export const MerchantFinancialOverviewCards: React.FC<MerchantFinancialOverviewCardsProps> = ({
  analytics,
  wallet,
  onTopUpClick,
  onPayoutClick,
  onViewTransactionsClick,
}) => {
  const availableBalance = analytics?.available_float_balance ?? wallet?.available_balance ?? 0;
  const lockedBalance = analytics?.locked_payout_balance ?? wallet?.locked_payout_balance ?? 0;

  const totalDeposited = analytics?.total_deposited_amount ?? wallet?.total_deposited ?? 0;
  const totalWithdrawn = analytics?.total_withdrawn_amount ?? wallet?.total_paid_out ?? 0;

  const todayDeposits = analytics?.today_deposits_amount ?? 0;
  const todayWithdrawals = analytics?.today_withdrawals_amount ?? 0;
  const todayTxCount = analytics?.today_transactions_count ?? 0;
  const totalTxCount = analytics?.total_transactions_count ?? 0;

  const pendingDepositsCount = analytics?.pending_deposits_count ?? 0;
  const pendingDepositsAmount = analytics?.pending_deposits_amount ?? 0;
  const pendingWithdrawalsCount = analytics?.pending_withdrawals_count ?? 0;
  const pendingWithdrawalsAmount = analytics?.pending_withdrawals_amount ?? 0;

  return (
    <div className="space-y-4">
      {/* 1. Hero Available Float Balance Card */}
      <div className="bg-white rounded-xl border border-blue-200/80 shadow-xs p-5 relative overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                Authoritative Float
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Instant 24x7 UPI Rail</span>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 mt-1">
              {formatInr(availableBalance)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Available for real-time disbursements without banking settlement delays.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onTopUpClick && (
              <button
                onClick={onTopUpClick}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Add Float</span>
              </button>
            )}
            {onPayoutClick && (
              <button
                onClick={onPayoutClick}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Make Payout</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-balances breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
          <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              In-Transit (Locked)
            </span>
            <div className="text-base font-bold font-mono text-amber-600 mt-0.5">
              {formatInr(lockedBalance)}
            </div>
            <span className="text-[10px] text-slate-400">Reserved for pending payouts</span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              Total Float Added
            </span>
            <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
              {formatInr(totalDeposited)}
            </div>
            <span className="text-[10px] text-slate-400">
              {analytics?.total_deposited_count ?? 0} approved deposits
            </span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              Total Disbursed
            </span>
            <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
              {formatInr(totalWithdrawn)}
            </div>
            <span className="text-[10px] text-slate-400">
              {analytics?.total_withdrawn_count ?? 0} completed payouts
            </span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
              Lifetime Transactions
            </span>
            <div className="text-base font-bold font-mono text-blue-700 mt-0.5">
              {totalTxCount.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400">Deposits &amp; payouts</span>
          </div>
        </div>
      </div>

      {/* 2. Today's Activity Cards (India Standard Time) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Deposits */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Today's Deposits
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-700 mt-1.5">
            {formatInr(todayDeposits)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{analytics?.today_deposits_count ?? 0} successful top-ups</span>
            <span className="text-[10px] text-slate-400 font-mono">IST (Today)</span>
          </div>
        </div>

        {/* Today's Withdrawals */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Today's Withdrawals
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Send className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-blue-700 mt-1.5">
            {formatInr(todayWithdrawals)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{analytics?.today_withdrawals_count ?? 0} completed payouts</span>
            <span className="text-[10px] text-slate-400 font-mono">IST (Today)</span>
          </div>
        </div>

        {/* Today's Transactions Count */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Today's Transactions
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Activity className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-slate-900 mt-1.5">
            {todayTxCount.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>All types processed</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Active</span>
          </div>
        </div>

        {/* Total Transactions Count */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Transactions
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-slate-900 mt-1.5">
            {totalTxCount.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>Lifetime total</span>
            {onViewTransactionsClick && (
              <button
                onClick={() => onViewTransactionsClick('ALL')}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                View History &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Pending Transactions Alert Banner (Deposits & Withdrawals Separated) */}
      {(pendingDepositsCount > 0 || pendingWithdrawalsCount > 0) && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Pending Transactions Under Review
              </h4>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-800 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Pending Deposits:</span>
                  <span className="font-mono font-bold">{pendingDepositsCount}</span>
                  <span>({formatInr(pendingDepositsAmount)})</span>
                </div>
                <span className="text-amber-400 hidden sm:inline">&bull;</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Pending Withdrawals:</span>
                  <span className="font-mono font-bold">{pendingWithdrawalsCount}</span>
                  <span>({formatInr(pendingWithdrawalsAmount)})</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {pendingDepositsCount > 0 && onViewTransactionsClick && (
              <button
                onClick={() => onViewTransactionsClick('DEPOSIT', 'PENDING')}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                View Pending Deposits
              </button>
            )}
            {pendingWithdrawalsCount > 0 && onViewTransactionsClick && (
              <button
                onClick={() => onViewTransactionsClick('WITHDRAWAL', 'PENDING')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                View Pending Payouts
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
