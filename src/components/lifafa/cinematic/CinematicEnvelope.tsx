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

    // Fire royal blue and white confetti burst from center of screen
    try {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#2563eb', '#3b82f6', '#60a5fa', '#ffffff', '#1d4ed8', '#38bdf8'],
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
      className={`fixed inset-0 z-50 bg-[#F8FBFF] text-slate-900 flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden select-none transition-opacity duration-400 ${
        isExiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Ambient Glow & Atmospheric Effects - White + Blue Brand Palette */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft, clean background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F0F7FF] via-[#F8FBFF] to-[#EEF5FF]" />

        {/* Brand Blue Central Ambient Spotlights */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[560px] h-[380px] sm:h-[560px] bg-blue-500/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/8 rounded-full blur-2xl pointer-events-none" />

        {/* Ambient floating subtle blue particles */}
        <div className="absolute top-1/5 left-1/5 w-2 h-2 rounded-full bg-blue-400/40 blur-xs animate-particle-1" />
        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 rounded-full bg-blue-300/35 blur-xs animate-particle-2" />
        <div className="absolute top-2/3 left-1/3 w-1.5 h-1.5 rounded-full bg-indigo-400/30 blur-xs animate-particle-1" />
        <div className="absolute top-1/6 right-1/6 w-2.5 h-2.5 rounded-full bg-cyan-400/35 blur-xs animate-particle-2" />
      </div>

      {/* Top Header Badge - White Glass with Blue Accents */}
      <div className="relative z-10 pt-2 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-blue-200 shadow-md shadow-blue-500/10 text-blue-700 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <span>Exclusive Digital Lifafa Gift</span>
          <span className="text-sm">{themeEmoji}</span>
        </div>
      </div>

      {/* Center 3D Envelope Presentation Area */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center text-center space-y-5 sm:space-y-6 my-auto">
        
        {/* Envelope 3D Box */}
        <div
          className={`relative w-[300px] sm:w-[360px] h-[200px] sm:h-[240px] perspective-1000 transition-transform duration-700 ${
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
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[85%] h-6 bg-blue-900/15 blur-md rounded-full transform -rotate-x-30 pointer-events-none" />

            {/* Back Envelope Base - Royal Blue Inner Lining */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#1d4ed8] via-[#1e40af] to-[#172554] border-2 border-blue-400/50 shadow-2xl shadow-blue-600/20 overflow-hidden">
              {/* Inner blue glow when opening */}
              <div
                className={`absolute inset-0 bg-radial from-cyan-400/60 via-blue-500/30 to-transparent transition-opacity duration-500 ${
                  isOpening ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>

            {/* Peeking Reward Card / Letter inside envelope */}
            <div
              className={`absolute left-3 right-3 rounded-xl bg-gradient-to-b from-white via-blue-50/50 to-white text-slate-900 p-4 border border-blue-200/90 shadow-xl shadow-blue-500/10 transition-all duration-700 ease-out preserve-3d ${
                isOpening ? '-translate-y-20 scale-100 opacity-100 z-10' : 'top-2 bottom-2 translate-y-1 scale-95 opacity-90'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-blue-950 border-b border-blue-100 pb-1.5">
                <span className="font-mono tracking-wider text-blue-700">{lifafa.code}</span>
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-black">
                  <span>₹{perUserAmount}</span>
                  <span>Per Winner</span>
                </span>
              </div>
              <div className="mt-2.5 text-center">
                <h4 className="text-sm font-black text-blue-950 truncate">
                  {lifafa.title}
                </h4>
                {lifafa.message && (
                  <p className="text-[11px] text-slate-500 italic mt-0.5 truncate">
                    "{lifafa.message}"
                  </p>
                )}
              </div>
            </div>

            {/* Front Envelope Pocket (White body with subtle blue gradient panels) */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none z-20 overflow-hidden">
              {/* Left Flap Fold */}
              <div
                className="absolute inset-0 bg-gradient-to-tr from-white via-blue-50/90 to-blue-100/70 shadow-sm"
                style={{
                  clipPath: 'polygon(0% 0%, 0% 100%, 50% 55%)',
                }}
              />
              {/* Right Flap Fold */}
              <div
                className="absolute inset-0 bg-gradient-to-tl from-white via-blue-50/90 to-blue-100/70 shadow-sm"
                style={{
                  clipPath: 'polygon(100% 0%, 100% 100%, 50% 55%)',
                }}
              />
              {/* Bottom Envelope Pocket Fold */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#f0f7ff] via-white to-[#e2effe] border-b border-blue-300/60 shadow-md"
                style={{
                  clipPath: 'polygon(0% 100%, 100% 100%, 50% 48%)',
                }}
              />

              {/* Metallic blue hairline borders along folds */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60">
                <line x1="0" y1="100%" x2="50%" y2="48%" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.45" />
                <line x1="100%" y1="100%" x2="50%" y2="48%" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.45" />
              </svg>
            </div>

            {/* Top Triangular Flap (The 3D opening lid) */}
            <div
              className="absolute top-0 left-0 right-0 h-[100px] sm:h-[120px] origin-top z-30 transition-transform duration-800 preserve-3d"
              style={{
                transform: isOpening ? 'rotateX(-180deg)' : 'rotateX(0deg)',
                transformOrigin: 'top center',
              }}
            >
              {/* Front side of flap (when closed - White/light blue pearl) */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-white via-[#f0f7ff] to-[#dbeafe] shadow-md border-t border-blue-200 backface-hidden"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                }}
              />

              {/* Back side of flap (revealed when flipped open - Royal blue lining) */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#1d4ed8] via-[#1e40af] to-[#172554] border-b border-blue-300/40"
                style={{
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                  transform: 'rotateY(180deg) rotateZ(180deg)',
                  backfaceVisibility: 'hidden',
                }}
              />

              {/* 3D Wax Seal Button on the Flap Tip - Primary Brand Blue */}
              <div
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-40 transition-all duration-300 ${
                  isOpening ? 'scale-90 opacity-90' : 'hover:scale-110 active:scale-95'
                }`}
              >
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-blue-700 via-blue-500 to-indigo-500 p-0.5 shadow-2xl shadow-blue-600/50 flex items-center justify-center cursor-pointer">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex flex-col items-center justify-center border-2 border-white/80 shadow-inner">
                    <span className="text-xl sm:text-2xl font-black text-white font-serif drop-shadow-md">
                      ₹
                    </span>
                    {!isOpening && (
                      <span className="text-[7px] font-black text-blue-100 tracking-widest -mt-1 uppercase animate-pulse">
                        TAP
                      </span>
                    )}
                  </div>

                  {!isOpening && (
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400/60 animate-ping pointer-events-none opacity-40" />
                  )}
                </div>
              </div>
            </div>

            {/* Dramatic light beam burst when opened - Cyan & Soft Blue */}
            {isOpening && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 bg-radial from-white via-cyan-300/80 to-transparent rounded-full animate-light-burst pointer-events-none z-50" />
            )}
          </div>
        </div>

        {/* Creator Info & Hint */}
        <div className="space-y-1.5 pt-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {lifafa.title}
          </h2>
          <p className="text-xs text-slate-600 font-medium max-w-xs mx-auto">
            {lifafa.message
              ? `"${lifafa.message}"`
              : 'You have received an exclusive digital cash gift.'}
          </p>
          
          {/* Reward Pool & Winners Section - Brand Palette */}
          <div className="pt-1">
            <div className="inline-flex items-center justify-center gap-2.5 px-3.5 py-1 rounded-full bg-blue-50/80 border border-blue-200/80 text-xs text-slate-600 font-bold shadow-2xs">
              <span>Pool: <strong className="font-black text-blue-700">{formatCurrency(lifafa.total_amount)}</strong></span>
              <span className="text-blue-300">•</span>
              <span><strong className="font-black text-blue-700">{lifafa.winner_count}</strong> Winners</span>
            </div>
          </div>
        </div>

        {/* Big Premium Brand Blue CTA Button */}
        <div className="w-full max-w-xs pt-1">
          <button
            type="button"
            id="open-lifafa-btn"
            onClick={handleOpen}
            disabled={isOpening}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-500/35 hover:shadow-blue-500/50 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-400/60 group"
          >
            <Sparkles className="w-4 h-4 text-blue-100 group-hover:rotate-12 transition-transform" />
            <span>{isOpening ? 'OPENING ENVELOPE...' : 'OPEN LIFAFA'}</span>
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Quick Skip for accessibility */}
          <button
            type="button"
            id="skip-animation-btn"
            onClick={onOpened}
            className="mt-3 text-[11px] text-slate-500 hover:text-blue-700 transition-colors cursor-pointer underline underline-offset-2"
          >
            Skip animation &amp; view requirements
          </button>
        </div>

      </div>

      {/* Subtle Footer Watermark */}
      <div className="relative z-10 pb-1 text-[11px] text-slate-400 flex items-center justify-between w-full max-w-sm">
        <span>© {new Date().getFullYear()} Createlifafa</span>
        <span className="flex items-center gap-1 text-blue-600/80 font-semibold">
          <Sparkles className="w-3 h-3 text-blue-500" />
          <span>India's Modern Digital Gifting</span>
        </span>
      </div>
    </div>
  );
};
