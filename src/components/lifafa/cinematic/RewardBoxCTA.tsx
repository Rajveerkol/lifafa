import React, { useState } from 'react';
import { Gift, Lock, ArrowRight, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RewardBoxCTAProps {
  isUnlocked: boolean;
  onClick: () => void;
  disabledMessage?: string;
  amountText?: string;
}

export const RewardBoxCTA: React.FC<RewardBoxCTAProps> = ({
  isUnlocked,
  onClick,
  disabledMessage,
  amountText,
}) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = () => {
    if (!isUnlocked || isOpening) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onClick();
      return;
    }

    setIsOpening(true);

    try {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.85 },
        colors: ['#f59e0b', '#fbbf24', '#ffffff', '#10b981'],
        disableForReducedMotion: true,
      });
    } catch {
      // safe fallback
    }

    setTimeout(() => {
      onClick();
    }, 380);
  };

  if (!isUnlocked) {
    return (
      <div className="w-full select-none">
        <div className="relative w-full rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-700/60 py-2.5 px-3.5 sm:px-4 flex items-center justify-between gap-3 text-slate-400 opacity-80 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold truncate">
              {disabledMessage || 'Complete tasks above to unlock reward'}
            </span>
          </div>
          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
            <div className="w-2/3 h-full bg-slate-500 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full select-none">
      {/* Compact Premium 3D Animated CTA Bar */}
      <button
        id="reward-box-cta"
        type="button"
        onClick={handleClick}
        disabled={isOpening}
        aria-label="Claim Reward Now"
        className={`group relative w-full cursor-pointer rounded-2xl p-0.5 border border-amber-400/50 transition-all duration-300 ${
          isOpening
            ? 'scale-[1.02] shadow-2xl shadow-amber-500/50'
            : 'hover:scale-[1.01] active:scale-[0.985] shadow-xl shadow-amber-950/40 hover:shadow-amber-500/30'
        }`}
      >
        {/* Subtle Ambient Outer Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/30 via-yellow-400/40 to-amber-600/30 rounded-2xl blur-sm group-hover:blur-md opacity-75 group-hover:opacity-100 transition-all pointer-events-none" />

        {/* Premium Dark Glass Body */}
        <div className="relative rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 overflow-hidden backdrop-blur-md">
          
          {/* Subtle Dynamic Light Shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

          {/* Left: Animated 3D Reward Box / Gift Icon */}
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center">
            {/* Glowing Icon Base */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-400/25 via-yellow-500/15 to-amber-600/30 border border-amber-400/50 shadow-inner" />
            
            {/* Animated 3D Floating Chest / Gift Icon */}
            <div className={`relative flex items-center justify-center text-amber-300 transition-transform duration-300 ${!isOpening ? 'animate-bounce-gentle group-hover:scale-110' : 'scale-125'}`}>
              <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]" />
              <Sparkles className="w-2.5 h-2.5 text-yellow-200 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>

          {/* Center: High-Impact Compact Typography */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 group-hover:text-yellow-200 transition-colors uppercase leading-tight">
                CLAIM NOW
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-300 group-hover:text-amber-200/90 transition-colors truncate">
              {amountText ? `Your ${amountText} reward is ready` : 'Your reward is ready'}
            </p>
          </div>

          {/* Right: Sleek Action Arrow Pill with Hover Translation */}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/25 group-hover:translate-x-1 group-hover:shadow-amber-400/40 transition-all shrink-0">
            <ArrowRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 font-black" />
          </div>

        </div>
      </button>
    </div>
  );
};
