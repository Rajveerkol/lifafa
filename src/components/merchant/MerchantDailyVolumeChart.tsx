import React, { useState } from 'react';
import { BarChart3, TrendingUp, CheckCircle2, XCircle, ArrowDownToLine, Send } from 'lucide-react';
import type { MerchantDailyVolumePoint } from '../../types/merchant';

interface MerchantDailyVolumeChartProps {
  data: MerchantDailyVolumePoint[];
}

export const MerchantDailyVolumeChart: React.FC<MerchantDailyVolumeChartProps> = ({ data }) => {
  const [chartMode, setChartMode] = useState<'VOLUME' | 'STATUS'>('VOLUME');
  const [hoveredPoint, setHoveredPoint] = useState<MerchantDailyVolumePoint | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
        No daily activity recorded for this period.
      </div>
    );
  }

  // Max calculations for scaling
  const maxVolume = Math.max(
    1,
    ...data.map((d) => Math.max(d.deposit_volume, d.withdrawal_volume))
  );

  const maxCount = Math.max(
    1,
    ...data.map((d) => Math.max(d.successful_count, d.failed_count))
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span>Daily Activity Trends (Last 14 Days)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated in India Standard Time (UTC+05:30)
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg self-start sm:self-center">
          <button
            onClick={() => setChartMode('VOLUME')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              chartMode === 'VOLUME'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Deposit vs Payout Volume (₹)
          </button>
          <button
            onClick={() => setChartMode('STATUS')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              chartMode === 'STATUS'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Successful vs Failed Count
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
        <div className="flex items-center gap-4">
          {chartMode === 'VOLUME' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                <span className="font-medium text-slate-700">Deposits (Float Added)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                <span className="font-medium text-slate-700">Withdrawals (Disbursed)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                <span className="font-medium text-slate-700">Successful Transactions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" />
                <span className="font-medium text-slate-700">Failed / Rejected</span>
              </div>
            </>
          )}
        </div>

        {/* Hovered details tag */}
        {hoveredPoint && (
          <div className="hidden md:flex items-center gap-2 font-mono text-[11px] bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            <span className="font-bold text-slate-900">{hoveredPoint.label}:</span>
            {chartMode === 'VOLUME' ? (
              <>
                <span className="text-emerald-700 font-semibold">Dep: {formatCurrency(hoveredPoint.deposit_volume)}</span>
                <span className="text-slate-400">|</span>
                <span className="text-blue-700 font-semibold">Wth: {formatCurrency(hoveredPoint.withdrawal_volume)}</span>
              </>
            ) : (
              <>
                <span className="text-emerald-700 font-semibold">Succ: {hoveredPoint.successful_count}</span>
                <span className="text-slate-400">|</span>
                <span className="text-rose-700 font-semibold">Fail: {hoveredPoint.failed_count}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bar Chart Visualization */}
      <div className="pt-2">
        <div className="h-48 flex items-end gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 relative">
          {/* Subtle horizontal reference lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-slate-400 w-full" />
            <div className="border-b border-slate-400 w-full" />
            <div className="border-b border-slate-400 w-full" />
          </div>

          {data.map((point) => {
            const isHovered = hoveredPoint?.date === point.date;

            let bar1Height = 0;
            let bar2Height = 0;

            if (chartMode === 'VOLUME') {
              bar1Height = Math.max(4, Math.round((point.deposit_volume / maxVolume) * 160));
              bar2Height = Math.max(4, Math.round((point.withdrawal_volume / maxVolume) * 160));
            } else {
              bar1Height = Math.max(4, Math.round((point.successful_count / maxCount) * 160));
              bar2Height = Math.max(4, Math.round((point.failed_count / maxCount) * 160));
            }

            return (
              <div
                key={point.date}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
                className={`flex-1 flex items-end justify-center gap-1 group relative cursor-pointer transition-all ${
                  isHovered ? 'scale-105 z-10' : 'opacity-90 hover:opacity-100'
                }`}
              >
                {/* Bar 1: Deposit / Success */}
                <div
                  style={{ height: `${bar1Height}px` }}
                  className={`w-full max-w-[14px] rounded-t-xs transition-all ${
                    chartMode === 'VOLUME'
                      ? 'bg-emerald-500 group-hover:bg-emerald-600'
                      : 'bg-emerald-500 group-hover:bg-emerald-600'
                  }`}
                />

                {/* Bar 2: Withdrawal / Failed */}
                <div
                  style={{ height: `${bar2Height}px` }}
                  className={`w-full max-w-[14px] rounded-t-xs transition-all ${
                    chartMode === 'VOLUME'
                      ? 'bg-blue-600 group-hover:bg-blue-700'
                      : 'bg-rose-500 group-hover:bg-rose-600'
                  }`}
                />

                {/* Mobile / Hover Tooltip */}
                {isHovered && (
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1.5 px-2.5 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-20 font-sans border border-slate-700">
                    <div className="font-bold border-b border-slate-700 pb-0.5 mb-1">{point.label}</div>
                    {chartMode === 'VOLUME' ? (
                      <div className="space-y-0.5">
                        <div className="text-emerald-300">Dep: {formatCurrency(point.deposit_volume)}</div>
                        <div className="text-blue-300">Wth: {formatCurrency(point.withdrawal_volume)}</div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-emerald-300">Success: {point.successful_count}</div>
                        <div className="text-rose-300">Failed: {point.failed_count}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-2">
          {data.map((point, index) => {
            // Display label every 2 or 3 bars on small screens to avoid overlap
            const isVisibleOnMobile = index % 3 === 0 || index === data.length - 1;
            return (
              <span
                key={point.date}
                className={`text-center flex-1 truncate ${
                  isVisibleOnMobile ? 'block' : 'hidden sm:block'
                }`}
              >
                {point.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
