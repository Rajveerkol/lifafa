import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Lifafa } from '../../../types/database';
import { formatCurrency } from '../../../lib/utils';

interface CinematicEnvelopeProps {
  lifafa: Lifafa;
  onOpened: () => void;
  accentColor?: string;
  themeEmoji?: string;
}

export const CinematicEnvelope: React.FC<CinematicEnvelopeProps> = ({
  lifafa,
  onOpened,
  themeEmoji = '🎁',
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleOpen = () => {
    if (isOpening || isExiting) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onOpened();
      return;
    }

    setIsOpening(true);

    // Fire golden confetti burst from center of screen
    try {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#f59e0b', '#fbbf24', '#ffffff', '#eab308', '#ca8a04'],
        disableForReducedMotion: true,
      });
    } catch (e) {
      // safe fallback if blocked
    }

    // After realistic flap flip + light burst, smoothly fade out into content
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onOpened();
      }, 400);
    }, 850);
  };

  const perUserAmount = (lifafa.total_amount / (lifafa.winner_count || 1)).toFixed(
    lifafa.total_amount % (lifafa.winner_count || 1) === 0 ? 0 : 2
  );

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden select-none transition-opacity duration-400 ${
        isExiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Ambient Glow & Atmospheric Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep ambient dark backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1d] via-[#060913] to-[#02040a]" />

        {/* Golden Central Spotlights */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[540px] h-[380px] sm:h-[540px] bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

        {/* Ambient floating dust particles */}
        <div className="absolute top-1/5 left-1/5 w-2 h-2 rounded-full bg-amber-300/40 blur-xs animate-particle-1" />
        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 rounded-full bg-amber-400/30 blur-xs animate-particle-2" />
        <div className="absolute top-2/3 left-1/3 w-1.5 h-1.5 rounded-full bg-yellow-200/50 blur-xs animate-particle-1" />
        <div className="absolute top-1/6 right-1/6 w-2.5 h-2.5 rounded-full bg-yellow-300/30 blur-xs animate-particle-2" />
      </div>

      {/* Top Header Badge */}
      <div className="relative z-10 pt-2 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-amber-200 text-xs font-semibold shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Exclusive Digital Lifafa Gift</span>
          <span className="text-sm">{themeEmoji}</span>
        </div>
      </div>

      {/* Center 3D Envelope Presentation Area */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center text-center space-y-6 my-auto">
        
        {/* Envelope 3D Box */}
        <div
          className={`relative w-[310px] sm:w-[360px] h-[210px] sm:h-[240px] perspective-1000 transition-transform duration-700 ${
            isOpening ? 'scale-105' : 'hover:scale-[1.02]'
          }`}
        >
          {/* Outer floating shell */}
          <div
            onClick={handleOpen}
            className={`w-full h-full relative cursor-pointer preserve-3d transition-all ${
              !isOpening ? 'animate-envelope-float' : ''
            }`}
          >
            {/* Soft ground shadow underneath envelope */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[85%] h-6 bg-black/70 blur-md rounded-full transform -rotate-x-30 pointer-events-none" />

            {/* Back Envelope Base */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] border border-amber-500/40 shadow-2xl overflow-hidden">
              {/* Inner golden glow when opening */}
              <div
                className={`absolute inset-0 bg-radial from-amber-400/50 via-yellow-500/20 to-transparent transition-opacity duration-500 ${
                  isOpening ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>

            {/* Peeking Reward Card / Letter inside envelope */}
            <div
              className={`absolute left-3 right-3 rounded-xl bg-gradient-to-b from-amber-50 via-white to-amber-100/90 text-slate-900 p-4 border border-amber-300 shadow-xl transition-all duration-700 ease-out preserve-3d ${
                isOpening ? '-translate-y-20 scale-100 opacity-100 z-10' : 'top-2 bottom-2 translate-y-1 scale-95 opacity-90'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 border-b border-amber-200/80 pb-1.5">
                <span className="font-mono tracking-wider">{lifafa.code}</span>
                <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-black">
                  <span>₹{perUserAmount}</span>
                  <span>Per Winner</span>
                </span>
              </div>
              <div className="mt-2.5 text-center">
                <h4 className="text-sm font-black text-slate-950 truncate">
                  {lifafa.title}
                </h4>
                {lifafa.message && (
                  <p className="text-[11px] text-slate-600 italic mt-0.5 truncate">
                    "{lifafa.message}"
                  </p>
                )}
              </div>
            </div>

            {/* Front Envelope Pocket (Left & Right folded triangles) */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none z-20 overflow-hidden">
              {/* Left Flap Fold */}
              <div
                className="absolute inset-0 bg-gradient-to-tr from-[#1e293b] via-[#111827] to-transparent opacity-95"
                style={{
                  clipPath: 'polygon(0% 0%, 0% 100%, 50% 55%)',
                }}
              />
              {/* Right Flap Fold */}
              <div
                className="absolute inset-0 bg-gradient-to-tl from-[#1e293b] via-[#111827] to-transparent opacity-95"
                style={{
                  clipPath: 'polygon(100% 0%, 100% 100%, 50% 55%)',
                }}
              />
              {/* Bottom Envelope Pocket Fold */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#131c2e] to-[#1e293b] border-b border-amber-500/40"
                style={{
                  clipPath: 'polygon(0% 100%, 100% 100%, 50% 48%)',
                }}
              />

              {/* Gold hairline borders along folds */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50">
                <line x1="0" y1="100%" x2="50%" y2="48%" stroke="#f59e0b" strokeWidth="1.5" />
                <line x1="100%" y1="100%" x2="50%" y2="48%" stroke="#f59e0b" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Top Triangular Flap (The 3D opening lid) */}
            <div
              className="absolute top-0 left-0 right-0 h-[105px] sm:h-[120px] origin-top z-30 transition-transform duration-800 preserve-3d"
              style={{
                transform: isOpening ? 'rotateX(-180deg)' : 'rotateX(0deg)',
                transformOrigin: 'top center',
              }}
            >
              {/* Front side of flap (when closed) */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#24334d] via-[#172133] to-[#0f172a] shadow-lg border-t border-amber-400/50 backface-hidden"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                }}
              />

              {/* Back side of flap (revealed when flipped open) */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#0b101b] via-[#131a29] to-[#1a2337] border-b border-amber-300/40"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                  transform: 'rotateY(180deg) rotateZ(180deg)',
                  backfaceVisibility: 'hidden',
                }}
              />

              {/* 3D Wax Seal Button on the Flap Tip */}
              <div
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-40 transition-all duration-300 ${
                  isOpening ? 'scale-90 opacity-90' : 'hover:scale-110 active:scale-95'
                }`}
              >
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 p-0.5 shadow-2xl shadow-amber-500/60 flex items-center justify-center cursor-pointer">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 flex flex-col items-center justify-center border-2 border-amber-200/90 shadow-inner">
                    <span className="text-xl sm:text-2xl font-black text-amber-100 font-serif drop-shadow-md">
                      ₹
                    </span>
                    {!isOpening && (
                      <span className="text-[7px] font-black text-amber-200 tracking-widest -mt-1 uppercase animate-pulse">
                        TAP
                      </span>
                    )}
                  </div>

                  {!isOpening && (
                    <div className="absolute inset-0 rounded-full border-2 border-amber-400/60 animate-ping pointer-events-none opacity-40" />
                  )}
                </div>
              </div>
            </div>

            {/* Dramatic light beam burst when opened */}
            {isOpening && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 bg-radial from-yellow-300 via-amber-400/80 to-transparent rounded-full animate-light-burst pointer-events-none z-50" />
            )}
          </div>
        </div>

        {/* Creator Info & Hint */}
        <div className="space-y-1.5 pt-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm">
            {lifafa.title}
          </h2>
          <p className="text-xs text-slate-300 font-medium max-w-xs mx-auto">
            {lifafa.message
              ? `"${lifafa.message}"`
              : 'You have received an exclusive digital cash gift.'}
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-amber-300/90 pt-1 font-semibold">
            <span>Pool: {formatCurrency(lifafa.total_amount)}</span>
            <span>•</span>
            <span>{lifafa.winner_count} Winners</span>
          </div>
        </div>

        {/* Big Premium CTA Button */}
        <div className="w-full max-w-xs pt-1">
          <button
            type="button"
            id="open-lifafa-btn"
            onClick={handleOpen}
            disabled={isOpening}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-200/80"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>{isOpening ? 'OPENING ENVELOPE...' : 'OPEN LIFAFA'}</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>

          {/* Quick Skip for accessibility */}
          <button
            type="button"
            id="skip-animation-btn"
            onClick={onOpened}
            className="mt-3 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer underline underline-offset-2"
          >
            Skip animation &amp; view requirements
          </button>
        </div>

      </div>

      {/* Subtle Footer Watermark */}
      <div className="relative z-10 pb-1 text-[11px] text-slate-500 flex items-center justify-between w-full max-w-sm">
        <span>© {new Date().getFullYear()} Createlifafa</span>
        <span className="flex items-center gap-1 text-amber-400/60 font-semibold">
          <Sparkles className="w-3 h-3" />
          <span>India's Modern Digital Gifting</span>
        </span>
      </div>
    </div>
  );
};
