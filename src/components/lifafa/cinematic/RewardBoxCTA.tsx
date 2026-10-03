import React, { useState } from 'react';
import { Sparkles, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
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
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#f59e0b', '#fbbf24', '#ffffff', '#eab308'],
        disableForReducedMotion: true,
      });
    } catch (e) {
      // safe fallback
    }

    setTimeout(() => {
      onClick();
    }, 650);
  };

  if (!isUnlocked) {
    return (
      <div className="w-full select-none pt-2">
        <div className="relative w-full rounded-2xl bg-slate-100/90 border border-slate-200/80 p-4 text-center space-y-2 opacity-85">
          <div className="flex items-center justify-center gap-2 text-slate-500 font-bold text-xs">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>{disabledMessage || 'Complete required tasks above to unlock reward'}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="w-2/3 h-full bg-slate-400 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full select-none pt-2">
      {/* 3D Reward Box Button Container */}
      <div
        id="reward-box-cta"
        onClick={handleClick}
        className={`group relative w-full cursor-pointer perspective-800 transition-all duration-300 ${
          isOpening ? 'scale-102' : 'hover:scale-[1.01] active:scale-[0.98]'
        }`}
      >
        {/* Soft Golden Ground Ambient Glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 via-yellow-400/40 to-amber-600/30 rounded-3xl blur-md group-hover:blur-lg opacity-80 group-hover:opacity-100 transition-all pointer-events-none" />

        {/* Main 3D Card Shell */}
        <div className="relative rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-2 border-amber-400/60 p-4 sm:p-5 shadow-2xl overflow-hidden preserve-3d">
          
          {/* Subtle Shimmer Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between gap-4">
            
            {/* 3D Treasure Chest Interactive Miniature */}
            <div className="relative w-16 h-16 sm:w-18 sm:h-18 shrink-0 flex items-center justify-center">
              
              {/* Chest Float Shell */}
              <div
                className={`relative w-14 h-14 preserve-3d transition-transform duration-500 ${
                  !isOpening ? 'animate-chest-float group-hover:rotate-x-12' : ''
                }`}
              >
                {/* Chest Base Body */}
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 rounded-b-xl border border-amber-300 shadow-xl overflow-hidden">
                  {/* Metal band straps */}
                  <div className="absolute inset-y-0 left-2.5 w-1.5 bg-yellow-400/60 border-x border-amber-950" />
                  <div className="absolute inset-y-0 right-2.5 w-1.5 bg-yellow-400/60 border-x border-amber-950" />
                  {/* Center Keyhole Plate */}
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-yellow-300 border border-amber-950 flex items-center justify-center shadow-xs">
                    <div className="w-1 h-1.5 bg-amber-950 rounded-xs" />
                  </div>
                </div>

                {/* 3D Chest Lid (Opens on click) */}
                <div
                  className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-600 rounded-t-xl border border-amber-200 shadow-md origin-top transition-transform duration-500 preserve-3d"
                  style={{
                    transform: isOpening ? 'rotateX(-120deg)' : 'rotateX(0deg)',
                    transformOrigin: 'top center',
                  }}
                >
                  <div className="absolute inset-y-0 left-2.5 w-1.5 bg-yellow-200/80" />
                  <div className="absolute inset-y-0 right-2.5 w-1.5 bg-yellow-200/80" />
                </div>

                {/* Inner Light Eruption when opening */}
                {isOpening && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-16 bg-radial from-yellow-200 via-amber-400 to-transparent rounded-full animate-light-burst pointer-events-none z-30" />
                )}
              </div>
            </div>

            {/* Visual Messaging */}
            <div className="space-y-1 text-left flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  <span>Tasks Verified</span>
                </span>
                {amountText && (
                  <span className="text-[11px] font-black text-emerald-400">
                    {amountText}
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight group-hover:text-amber-300 transition-colors">
                YOUR REWARD IS READY
              </h3>

              <p className="text-xs text-slate-300 font-medium">
                Tap to open reward box &amp; enter UPI ID
              </p>
            </div>

            {/* Glowing Action Arrow */}
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/30 group-hover:translate-x-1 transition-transform shrink-0">
              <ArrowRight className="w-5 h-5 font-black" />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
