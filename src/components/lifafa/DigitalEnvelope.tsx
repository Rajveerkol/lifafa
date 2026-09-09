import React, { useState } from 'react';
import { Gift, Sparkles, Clock, Users, Lock, ChevronDown } from 'lucide-react';
import type { Lifafa } from '../../types/database';
import { formatCurrency, formatTimeRemaining } from '../../lib/utils';

interface DigitalEnvelopeProps {
  lifafa: Lifafa;
  isEnvelopeOpened: boolean;
  onUnsealEnvelope?: () => void;
  claimedAmount?: number;
}

export const DigitalEnvelope: React.FC<DigitalEnvelopeProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
}) => {
  const { isExpired, formatted: timeLeft } = formatTimeRemaining(lifafa.expires_at);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none my-2 transition-all">
      {/* 3D Digital Envelope Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-700 via-blue-800 to-indigo-900 p-1.5 shadow-2xl shadow-blue-900/40 border-2 border-blue-400/40">
        
        {/* Envelope Top Triangular Flap */}
        <div
          onClick={!isEnvelopeOpened ? onUnsealEnvelope : undefined}
          className={`relative h-24 bg-gradient-to-b from-blue-600 to-blue-700 rounded-t-3xl overflow-hidden flex items-center justify-center border-b border-blue-400/30 transition-all duration-500 ${
            !isEnvelopeOpened ? 'cursor-pointer hover:from-blue-500 hover:to-blue-600' : ''
          }`}
        >
          {/* Triangular Fold SVG */}
          <div className="absolute inset-0 bg-blue-500/20" />
          <svg
            className="absolute bottom-0 w-full h-16 text-blue-800/80 drop-shadow-md"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon points="0,0 100,0 50,85" fill="currentColor" opacity="0.4" />
          </svg>

          {/* Golden Royal Wax Seal */}
          <div
            className={`relative z-10 w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 p-0.5 shadow-xl shadow-amber-900/50 flex items-center justify-center transition-transform duration-300 ${
              !isEnvelopeOpened ? 'scale-105 animate-bounce-subtle hover:scale-110' : 'scale-90 opacity-90'
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex flex-col items-center justify-center border border-amber-200/80 shadow-inner">
              <span className="text-xl font-black text-amber-100 font-serif drop-shadow-xs">₹</span>
              {!isEnvelopeOpened && (
                <span className="text-[7px] font-black text-amber-200 uppercase tracking-tighter -mt-1">
                  TAP
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sealed Teaser Banner when envelope not unsealed yet */}
        {!isEnvelopeOpened ? (
          <div
            onClick={onUnsealEnvelope}
            className="cursor-pointer bg-white/95 backdrop-blur-xs rounded-2xl mx-2 -mt-3 mb-2 p-5 text-center space-y-3 z-20 shadow-xl border border-blue-200/60 hover:bg-white transition-all active:scale-99"
          >
            <div className="inline-flex items-center gap-1 font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px]">
              {lifafa.code}
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 line-clamp-1">{lifafa.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                You received a special digital cash gift!
              </p>
            </div>

            <button
              type="button"
              onClick={onUnsealEnvelope}
              className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-amber-950 font-black py-2.5 px-4 rounded-xl text-xs shadow-md shadow-amber-500/30 flex items-center justify-center gap-1.5 transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-900" />
              <span>Tap Wax Seal to Open Envelope</span>
            </button>
          </div>
        ) : (
          /* Revealed Digital Cash Card emerging from the envelope */
          <div className="relative bg-white rounded-2xl mx-2 -mt-4 mb-2 p-4 sm:p-5 shadow-xl border border-blue-100 text-center space-y-3 z-20 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[10px]">
                {lifafa.code}
              </span>
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeLeft}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                {lifafa.distribution_type === 'RANDOM' ? '🎲 Lucky Random Lifafa' : '⚡ Equal Share Lifafa'}
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1.5 line-clamp-1">
                {lifafa.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                {lifafa.message || 'Complete the verified tasks below to claim your digital cash gift!'}
              </p>
            </div>

            {/* Amount Badge */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-100 rounded-2xl p-3">
              {claimedAmount ? (
                <div>
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                    You Claimed
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                    {formatCurrency(claimedAmount)}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Total Reward Pool
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-700">
                    {formatCurrency(lifafa.total_amount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium mt-1 pt-1 border-t border-blue-100/60">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    <strong>{lifafa.claimed_count}</strong> of {lifafa.winner_count} Claimed
                  </span>
                </span>
                {lifafa.pin_code && (
                  <span className="flex items-center gap-1 text-slate-600 font-semibold">
                    <Lock className="w-3 h-3 text-blue-600" />
                    PIN Protected
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Envelope Pocket Bottom Stitching */}
        <div className="h-6 bg-gradient-to-t from-blue-900 to-blue-800 rounded-b-2xl flex items-center justify-center">
          <div className="w-16 h-1 rounded-full bg-blue-500/40" />
        </div>
      </div>
    </div>
  );
};
