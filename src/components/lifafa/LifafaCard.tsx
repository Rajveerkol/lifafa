import React from 'react';
import { Gift, Users, Clock, CheckCircle, ArrowRight, Lock, Sparkles } from 'lucide-react';
import type { Lifafa } from '../../types/database';
import { formatCurrency, formatTimeRemaining } from '../../lib/utils';

interface LifafaCardProps {
  lifafa: Lifafa;
  onClaimClick: (lifafa: Lifafa) => void;
  onShareClick?: (lifafa: Lifafa) => void;
  isCreator?: boolean;
}

export const LifafaCard: React.FC<LifafaCardProps> = ({
  lifafa,
  onClaimClick,
  onShareClick,
  isCreator = false,
}) => {
  const { isExpired, formatted: timeLeft } = formatTimeRemaining(lifafa.expires_at);
  const claimedPercent = Math.min(
    100,
    Math.round((lifafa.claimed_count / Math.max(1, lifafa.winner_count)) * 100)
  );

  const isCompleted = lifafa.status === 'COMPLETED' || lifafa.claimed_count >= lifafa.winner_count;
  const canClaim = lifafa.status === 'ACTIVE' && !isExpired && !isCompleted;

  return (
    <div className="group bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-100 transition-all flex flex-col justify-between">
      <div>
        {/* Top Badges & Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                lifafa.distribution_type === 'RANDOM'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {lifafa.distribution_type === 'RANDOM' ? '🎲 Random Lucky' : '⚡ Equal Split'}
            </span>

            {lifafa.pin_code && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                PIN
              </span>
            )}

            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              lifafa.payout_mode === 'UPI_BANK'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-50 text-slate-600 border border-slate-200'
            }`}>
              {lifafa.payout_mode === 'UPI_BANK' ? '🏦 UPI/Bank' : '💼 Wallet'}
            </span>
          </div>

          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              isCompleted
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : canClaim
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isCompleted ? 'COMPLETED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
          </span>
        </div>

        {/* Title and Creator */}
        <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
          {lifafa.title}
        </h4>
        <p className="text-xs text-slate-500 line-clamp-2 mb-4">
          {lifafa.message || 'Claim your digital reward gift from this Lifafa!'}
        </p>

        {/* Amount & Winner Stats Grid */}
        <div className="bg-slate-50/80 rounded-2xl p-3 mb-4 border border-slate-100/80">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Pool Prize
              </span>
              <span className="text-lg font-black text-slate-900">
                {formatCurrency(lifafa.total_amount)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                Winners
              </span>
              <div className="flex items-center gap-1 justify-end text-sm font-bold text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {lifafa.claimed_count} / {lifafa.winner_count}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted ? 'bg-slate-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
              }`}
              style={{ width: `${claimedPercent}%` }}
            />
          </div>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-4 px-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-[11px]">{timeLeft}</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
            {lifafa.code}
          </span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        {onShareClick && (
          <button
            onClick={() => onShareClick(lifafa)}
            className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            Share
          </button>
        )}

        <button
          onClick={() => onClaimClick(lifafa)}
          disabled={!canClaim}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
            canClaim
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-98'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>{canClaim ? 'Claim Now' : isCompleted ? 'Completed' : 'Closed'}</span>
          {canClaim && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
