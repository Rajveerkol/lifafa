import React, { useState } from 'react';
import {
  TrendingUp,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowDownToLine,
  Send,
  PieChart,
  Filter,
} from 'lucide-react';
import type { MerchantFinancialAnalytics } from '../../types/merchant';
import { MerchantDailyVolumeChart } from './MerchantDailyVolumeChart';
import { formatInr } from './MerchantFinancialOverviewCards';

interface MerchantAnalyticsSectionProps {
  analytics: MerchantFinancialAnalytics | null;
  onViewTransactions?: (type?: 'ALL' | 'DEPOSIT' | 'WITHDRAWAL', status?: string) => void;
}

export const MerchantAnalyticsSection: React.FC<MerchantAnalyticsSectionProps> = ({
  analytics,
  onViewTransactions,
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');

  if (!analytics) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
        Loading analytics...
      </div>
    );
  }

  // Derive dynamic metrics based on selected timeframe
  let timeframeTitle = 'Lifetime Overview';
  let depVolume = analytics.total_deposited_amount;
  let wthVolume = analytics.total_withdrawn_amount;
  let txCount = analytics.total_transactions_count;
  let depCount = analytics.total_deposited_count;
  let wthCount = analytics.total_withdrawn_count;

  if (selectedTimeframe === 'TODAY') {
    timeframeTitle = "Today's Activity (IST)";
    depVolume = analytics.today_deposits_amount;
    wthVolume = analytics.today_withdrawals_amount;
    txCount = analytics.today_transactions_count;
    depCount = analytics.today_deposits_count;
    wthCount = analytics.today_withdrawals_count;
  } else if (selectedTimeframe === 'YESTERDAY') {
    timeframeTitle = "Yesterday's Activity (IST)";
    depVolume = analytics.yesterday_deposits_amount;
    wthVolume = analytics.yesterday_withdrawals_amount;
    txCount = analytics.yesterday_transactions_count;
    depCount = analytics.yesterday_deposits_count;
    wthCount = analytics.yesterday_withdrawals_count;
  } else if (selectedTimeframe === 'WEEK') {
    timeframeTitle = 'Last 7 Days Activity';
    depVolume = analytics.last_7_days_deposits_amount;
    wthVolume = analytics.last_7_days_withdrawals_amount;
    txCount = analytics.last_7_days_transactions_count;
  } else if (selectedTimeframe === 'MONTH') {
    timeframeTitle = 'Last 30 Days Activity';
    depVolume = analytics.last_30_days_deposits_amount;
    wthVolume = analytics.last_30_days_withdrawals_amount;
    txCount = analytics.last_30_days_transactions_count;
  }

  const totalVol = depVolume + wthVolume;
  const depPercent = totalVol > 0 ? ((depVolume / totalVol) * 100).toFixed(1) : '50.0';
  const wthPercent = totalVol > 0 ? ((wthVolume / totalVol) * 100).toFixed(1) : '50.0';

  const totalStatuses =
    analytics.successful_count +
    analytics.pending_count +
    analytics.failed_count +
    analytics.rejected_count;

  const successRate =
    totalStatuses > 0 ? ((analytics.successful_count / totalStatuses) * 100).toFixed(1) + '%' : '100%';

  return (
    <div className="space-y-5">
      {/* 1. Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pr-1">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Timeframe:</span>
          </span>
          {(
            [
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: "Today (IST)" },
              { id: 'YESTERDAY', label: "Yesterday (IST)" },
              { id: 'WEEK', label: 'Last 7 Days' },
              { id: 'MONTH', label: 'Last 30 Days' },
            ] as const
          ).map((tf) => (
            <button
              key={tf.id}
              onClick={() => setSelectedTimeframe(tf.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedTimeframe === tf.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Transaction Type Filter */}
        <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
          <span className="text-xs text-slate-500 font-medium">Type:</span>
          {(['ALL', 'DEPOSIT', 'WITHDRAWAL'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedType === t
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'ALL' ? 'All' : t === 'DEPOSIT' ? 'Deposits' : 'Payouts'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Primary Analytics Metrics Grid for Selected Timeframe */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
              Performance Breakdown
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">{timeframeTitle}</h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">Overall Success Rate</span>
            <div className="text-lg font-black font-mono text-emerald-600">{successRate}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          {/* Deposited Volume */}
          {(selectedType === 'ALL' || selectedType === 'DEPOSIT') && (
            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Deposited Volume
                </span>
                <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-lg font-black font-mono text-emerald-900 mt-1">
                {formatInr(depVolume)}
              </div>
              <span className="text-[11px] text-emerald-700/80 mt-0.5 block">
                Net float credited to wallet
              </span>
            </div>
          )}

          {/* Withdrawn Volume */}
          {(selectedType === 'ALL' || selectedType === 'WITHDRAWAL') && (
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                  Payout Volume
                </span>
                <Send className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-lg font-black font-mono text-blue-900 mt-1">
                {formatInr(wthVolume)}
              </div>
              <span className="text-[11px] text-blue-700/80 mt-0.5 block">
                Gross principal disbursed
              </span>
            </div>
          )}

          {/* Total Transactions in Frame */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Transaction Count
              </span>
              <Layers className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {txCount.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Processed within timeframe
            </span>
          </div>

          {/* Deposit vs Withdrawal Ratio Bar */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <span>Volume Ratio</span>
                <PieChart className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="flex items-center justify-between text-xs font-mono font-bold mt-1 text-slate-700">
                <span className="text-emerald-700">{depPercent}% Dep</span>
                <span className="text-blue-700">{wthPercent}% Wth</span>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex mt-2">
              <div style={{ width: `${depPercent}%` }} className="bg-emerald-500 h-full" />
              <div style={{ width: `${wthPercent}%` }} className="bg-blue-600 h-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Status Breakdown Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Successful */}
        <div
          onClick={() => onViewTransactions && onViewTransactions('ALL', 'SUCCESS')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Successful
            </span>
            <span className="p-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
            {analytics.successful_count.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block group-hover:text-blue-600 transition-colors">
            Approved deposits &amp; payouts &rarr;
          </span>
        </div>

        {/* Pending */}
        <div
          onClick={() => onViewTransactions && onViewTransactions('ALL', 'PENDING')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending
            </span>
            <span className="p-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700 mt-1">
            {analytics.pending_count.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block group-hover:text-blue-600 transition-colors">
            Under admin or bank review &rarr;
          </span>
        </div>

        {/* Failed */}
        <div
          onClick={() => onViewTransactions && onViewTransactions('WITHDRAWAL', 'FAILED')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Failed
            </span>
            <span className="p-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
              <XCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-700 mt-1">
            {analytics.failed_count.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block group-hover:text-blue-600 transition-colors">
            Auto-refunded to float &rarr;
          </span>
        </div>

        {/* Rejected / Reversed */}
        <div
          onClick={() => onViewTransactions && onViewTransactions('ALL', 'REJECTED')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Rejected / Reversed
            </span>
            <span className="p-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-800 mt-1">
            {analytics.rejected_count.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block group-hover:text-blue-600 transition-colors">
            Invalid UTR or VPA rejects &rarr;
          </span>
        </div>
      </div>

      {/* 4. Interactive Daily Trends Chart */}
      <MerchantDailyVolumeChart data={analytics.daily_chart} />

      {/* 5. Timeframe Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Comparative Timeframe Summary
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Deposit Volume</th>
                <th className="px-4 py-2.5">Payout Volume</th>
                <th className="px-4 py-2.5">Transaction Count</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Today (IST)</span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-emerald-700">
                  {formatInr(analytics.today_deposits_amount)}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-blue-700">
                  {formatInr(analytics.today_withdrawals_amount)}
                </td>
                <td className="px-4 py-3 font-mono">
                  {analytics.today_transactions_count.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedTimeframe('TODAY')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View &rarr;
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span>Yesterday (IST)</span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-emerald-700">
                  {formatInr(analytics.yesterday_deposits_amount)}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-blue-700">
                  {formatInr(analytics.yesterday_withdrawals_amount)}
                </td>
                <td className="px-4 py-3 font-mono">
                  {analytics.yesterday_transactions_count.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedTimeframe('YESTERDAY')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View &rarr;
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  <span>Last 7 Days</span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-emerald-700">
                  {formatInr(analytics.last_7_days_deposits_amount)}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-blue-700">
                  {formatInr(analytics.last_7_days_withdrawals_amount)}
                </td>
                <td className="px-4 py-3 font-mono">
                  {analytics.last_7_days_transactions_count.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedTimeframe('WEEK')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View &rarr;
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span>Last 30 Days</span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-emerald-700">
                  {formatInr(analytics.last_30_days_deposits_amount)}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-blue-700">
                  {formatInr(analytics.last_30_days_withdrawals_amount)}
                </td>
                <td className="px-4 py-3 font-mono">
                  {analytics.last_30_days_transactions_count.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedTimeframe('MONTH')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View &rarr;
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70 transition-colors font-bold bg-slate-50/40">
                <td className="px-4 py-3 text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0" />
                  <span>Lifetime Total</span>
                </td>
                <td className="px-4 py-3 font-mono text-emerald-700">
                  {formatInr(analytics.total_deposited_amount)}
                </td>
                <td className="px-4 py-3 font-mono text-blue-700">
                  {formatInr(analytics.total_withdrawn_amount)}
                </td>
                <td className="px-4 py-3 font-mono text-slate-900">
                  {analytics.total_transactions_count.toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedTimeframe('ALL')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View &rarr;
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
