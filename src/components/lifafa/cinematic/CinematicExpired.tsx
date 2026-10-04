import React, { useEffect, useState } from 'react';
import {
  Lock,
  Gift,
  Check,
  Sparkles,
  ArrowRight,
  Clock,
  Users,
  Coins,
  ArrowLeft,
} from 'lucide-react';
import type { Lifafa } from '../../../types/database';
import { formatCurrency } from '../../../lib/utils';

interface CinematicExpiredProps {
  lifafa: Lifafa;
  onExploreMore?: () => void;
  onNavigateHome?: () => void;
}

export const CinematicExpired: React.FC<CinematicExpiredProps> = ({
  lifafa,
  onExploreMore,
  onNavigateHome,
}) => {
  // Animation state progression:
  // 'floating' -> 'opening' -> 'closing' -> 'stamped'
  const [animStep, setAnimStep] = useState<'floating' | 'opening' | 'closing' | 'stamped'>('floating');

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setAnimStep('stamped');
      return;
    }

    // Choreographed animation timeline
    // 0ms: Lifafa floating
    // 500ms: Envelope opens slightly, coins/particles float up & evaporate
    const timer1 = setTimeout(() => {
      setAnimStep('opening');
    }, 500);

    // 1700ms: Envelope flap closes
    const timer2 = setTimeout(() => {
      setAnimStep('closing');
    }, 1700);

    // 2200ms: Stamped with dramatic slam and glowing ring checkmark
    const timer3 = setTimeout(() => {
      setAnimStep('stamped');
    }, 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const isClosedStatus = lifafa.status === 'COMPLETED' || lifafa.claimed_count >= lifafa.winner_count;

  return (
    <div className="fixed inset-0 z-50 bg-[#080B14] text-white flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto select-none">
      {/* Background Atmosphere - Deep Navy to Purple to Blue Gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Deep ambient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080B14] via-[#0F1426] to-[#171233]" />

        {/* Ambient Glowing Color Orbs */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[340px] sm:w-[600px] h-[340px] sm:h-[600px] bg-blue-600/12 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 -right-20 w-[260px] sm:w-[450px] h-[260px] sm:h-[450px] bg-purple-600/12 rounded-full blur-[90px]" />
        <div className="absolute bottom-10 -left-20 w-[240px] sm:w-[400px] h-[240px] sm:h-[400px] bg-indigo-600/15 rounded-full blur-[90px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-radial from-purple-500/10 via-transparent to-transparent blur-2xl" />

        {/* Floating Ambient Sparks, Stars & Golden Dust */}
        <div className="absolute top-16 left-12 w-2 h-2 rounded-full bg-amber-400/40 blur-xs animate-particle-1" />
        <div className="absolute top-1/4 right-16 w-3 h-3 rounded-full bg-blue-400/30 blur-xs animate-particle-2" />
        <div className="absolute bottom-1/3 left-10 w-2.5 h-2.5 rounded-full bg-purple-400/35 blur-xs animate-particle-1" />
        <div className="absolute top-2/3 right-12 w-1.5 h-1.5 rounded-full bg-amber-300/40 blur-xs animate-particle-2" />
        <div className="absolute top-1/2 left-1/4 w-2 h-2 rounded-full bg-cyan-400/30 blur-xs animate-particle-1" />
        <div className="absolute top-24 right-1/3 w-1 h-1 rounded-full bg-amber-200/60 blur-[0.5px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-indigo-300/40 blur-xs animate-particle-2" />
      </div>

      {/* Top Header Badge */}
      <div className="relative z-10 pt-2 sm:pt-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-3 duration-500">
        <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-xl border border-rose-500/40 shadow-lg shadow-rose-500/15 text-rose-300 text-xs font-black tracking-wider uppercase overflow-hidden">
          {/* Subtle animated shine passing across */}
          <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-button-shine pointer-events-none" />
          <Lock className="w-3.5 h-3.5 text-rose-400 relative z-10" />
          <span className="relative z-10">{isClosedStatus ? '🔒 LIFAFA CLOSED' : '⏱️ LIFAFA EXPIRED'}</span>
        </div>
      </div>

      {/* Central 3D Lifafa & Narrative Area */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center text-center space-y-5 sm:space-y-6 my-auto py-4">
        {/* 3D Lifafa Envelope Presentation */}
        <div className="relative w-[280px] sm:w-[340px] h-[180px] sm:h-[220px] perspective-1000">
          {/* Main Envelope Body */}
          <div
            className={`relative w-full h-full rounded-3xl p-5 border border-white/15 transition-all duration-700 preserve-3d shadow-2xl ${
              animStep === 'stamped'
                ? 'shadow-rose-950/40 brightness-95 opacity-95'
                : 'shadow-purple-950/60 motion-safe:animate-envelope-float'
            }`}
            style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 25%, #4C1D95 55%, #1D4ED8 80%, #701A75 100%)',
              transform:
                animStep === 'stamped'
                  ? 'rotateX(4deg) rotateY(-2deg)'
                  : 'rotateX(8deg) rotateY(0deg)',
            }}
          >
            {/* Glossy Diagonal Specular Sheen */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/0 via-white/10 to-transparent pointer-events-none" />

            {/* Gold Corner Accents */}
            <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-amber-400/70 rounded-tl-lg" />
            <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-amber-400/70 rounded-tr-lg" />
            <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-amber-400/70 rounded-bl-lg" />
            <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-amber-400/70 rounded-br-lg" />

            {/* Inner Lifafa Details */}
            <div className="h-full flex flex-col justify-between text-left relative z-10">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-black tracking-widest text-amber-300/90 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
                  {lifafa.code}
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-purple-200/80">
                  {lifafa.distribution_type}
                </span>
              </div>

              {/* Center Emblem: Gold Medallion or Padlock */}
              <div className="self-center relative flex items-center justify-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-amber-200">
                  {animStep === 'stamped' ? (
                    <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-slate-950" />
                  ) : (
                    <Coins className="w-7 h-7 sm:w-8 sm:h-8 text-slate-950" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="truncate max-w-[160px] font-semibold">{lifafa.title}</span>
                <span className="font-extrabold text-amber-300">
                  {formatCurrency(lifafa.total_amount)}
                </span>
              </div>
            </div>

            {/* Envelope Flap (3D folding simulation) */}
            <div
              className={`absolute top-0 left-0 right-0 h-16 sm:h-20 bg-gradient-to-b from-indigo-800 via-purple-900 to-indigo-950 border-b border-white/20 origin-top transition-transform duration-700 ease-in-out pointer-events-none rounded-t-3xl ${
                animStep === 'opening'
                  ? 'rotate-x-120 opacity-40 scale-y-75'
                  : 'rotate-x-0 opacity-80'
              }`}
              style={{
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              }}
            />

            {/* Evaporating Gold Particles and Coins */}
            {animStep === 'opening' && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                <div className="animate-coins-disperse flex items-center gap-1.5 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">
                  <Coins className="w-8 h-8" />
                  <Sparkles className="w-5 h-5 text-yellow-200" />
                  <Coins className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            )}

            {/* Glowing 3D "CLAIMED" / "OVER" Stamp */}
            {animStep === 'stamped' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                <div className="animate-stamp-slam border-4 border-rose-500/90 text-rose-400 bg-rose-950/85 backdrop-blur-md shadow-2xl shadow-rose-500/60 rounded-2xl px-5 sm:px-7 py-2 tracking-widest font-black uppercase text-xl sm:text-2xl rotate-[-10deg]">
                  <span className="block drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]">
                    {isClosedStatus ? 'CLAIMED' : 'OVER'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Narrative & Status Description */}
        <div className="space-y-3 px-2">
          {/* Circular Glowing Checkmark Ring */}
          {animStep === 'stamped' && (
            <div className="flex items-center justify-center motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in duration-500">
              <div className="w-12 h-12 rounded-full bg-slate-900/90 border-2 border-emerald-400/80 flex items-center justify-center animate-ring-glow-pulse text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                <Check className="w-6 h-6 stroke-[3] text-emerald-400" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-purple-200 tracking-tight">
              {isClosedStatus ? 'ALL REWARDS CLAIMED' : 'LIFAFA HAS ENDED'}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-300 max-w-sm mx-auto leading-relaxed">
              All rewards from this Lifafa have already been claimed.
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto pt-0.5">
              Don't worry! Explore more Lifafas and grab your chance to win rewards.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5 pt-1">
          {/* Primary CTA Button: Explore More Lifafas */}
          <button
            type="button"
            onClick={onExploreMore || onNavigateHome}
            className="group relative w-full overflow-hidden py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-blue-600/30 hover:shadow-blue-500/50 transition-all duration-300 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            {/* Passing animated light shine */}
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/35 to-transparent animate-button-shine pointer-events-none" />

            <Gift className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition-transform" />
            <span className="tracking-wide">EXPLORE MORE LIFAFA 🎁</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary Action: Back to Home */}
          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          )}
        </div>

        {/* Lifafa Information Breakdown Card */}
        <div className="w-full bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 sm:p-4 text-left space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
            <span className="font-extrabold text-white flex items-center gap-1.5 truncate max-w-[200px]">
              <Gift className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">{lifafa.title}</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
              {isClosedStatus ? 'STATUS: CLOSED' : 'STATUS: EXPIRED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-400" />
                <span>Total Pool</span>
              </span>
              <p className="font-black text-amber-300">{formatCurrency(lifafa.total_amount)}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-400" />
                <span>Claims</span>
              </span>
              <p className="font-black text-slate-200">
                {lifafa.winner_count} / {lifafa.winner_count} Claimed
              </p>
            </div>

            {lifafa.creator_profile?.full_name && (
              <div className="col-span-2 pt-1 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Created by</span>
                <span className="font-bold text-slate-200">{lifafa.creator_profile.full_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 pt-2 pb-1 text-center">
        <span className="text-[11px] text-slate-500 font-medium tracking-wider">
          CreateLifafa • Instant Digital Rewards
        </span>
      </div>
    </div>
  );
};

