import React, { useState, useEffect } from 'react';
import { Check, CheckCircle2, Copy, Share2, Sparkles, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CountUpNumber } from './CountUpNumber';
import type { Lifafa } from '../../../types/database';

interface CinematicSuccessProps {
  amount: number;
  upiId?: string;
  payoutMode?: string;
  referenceId?: string;
  lifafa: Lifafa;
  onDone?: () => void;
  onShare?: () => void;
  shareUrl?: string;
}

export const CinematicSuccess: React.FC<CinematicSuccessProps> = ({
  amount,
  upiId,
  payoutMode,
  referenceId,
  lifafa,
  onDone,
  onShare,
  shareUrl,
}) => {
  const [chestOpen, setChestOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setChestOpen(true);
      setShowContent(true);
      return;
    }

    // Sequence:
    // 0ms: Chest shakes
    // 500ms: Chest lid opens & light bursts
    // 650ms: Multiple confetti fireworks
    // 800ms: Count up & text appears
    const timer1 = setTimeout(() => {
      setChestOpen(true);

      try {
        // Multi-angle golden confetti burst
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.45 },
          colors: ['#fbbf24', '#f59e0b', '#10b981', '#ffffff', '#eab308'],
          disableForReducedMotion: true,
        });

        // Left cannon
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0.1, y: 0.6 },
            colors: ['#fbbf24', '#f59e0b', '#3b82f6', '#10b981'],
            disableForReducedMotion: true,
          });
        }, 200);

        // Right cannon
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 0.9, y: 0.6 },
            colors: ['#fbbf24', '#f59e0b', '#ec4899', '#10b981'],
            disableForReducedMotion: true,
          });
        }, 350);
      } catch (e) {
        // safe fallback
      }
    }, 500);

    const timer2 = setTimeout(() => {
      setShowContent(true);
    }, 750);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Safe Masked UPI ID formatter (e.g. 7489339907@slc -> 7489***@slc)
  const formatMaskedUpi = (raw?: string) => {
    if (!raw) return null;
    const clean = raw.trim();
    const atIdx = clean.indexOf('@');
    if (atIdx === -1) return clean;
    const prefix = clean.substring(0, atIdx);
    const domain = clean.substring(atIdx);
    if (prefix.length <= 3) {
      return `${prefix[0]}***${domain}`;
    }
    return `${prefix.substring(0, 4)}***${domain}`;
  };

  const isDirectBank = payoutMode === 'UPI_BANK';
  const maskedDestination = isDirectBank && upiId ? formatMaskedUpi(upiId) : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14]/95 backdrop-blur-md text-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto select-none animate-in fade-in duration-500">
      
      {/* Background Cinematic Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-radial from-slate-900/95 via-[#0b1120] to-[#03060f]" />
        
        {/* Radiant Center Spotlight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[560px] h-[420px] sm:h-[560px] bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Ambient floating sparkles */}
        <div className="absolute top-1/5 left-1/4 w-2 h-2 rounded-full bg-amber-300/40 blur-xs animate-particle-1" />
        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 rounded-full bg-emerald-400/30 blur-xs animate-particle-2" />
        <div className="absolute top-3/5 left-1/5 w-1.5 h-1.5 rounded-full bg-yellow-200/50 blur-xs animate-particle-1" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center text-center space-y-6">

        {/* 3D Reward Chest Celebration Icon */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center perspective-800">
          <div
            className={`relative w-20 h-20 preserve-3d transition-all ${
              !chestOpen ? 'animate-chest-shake' : ''
            }`}
          >
            {/* Ground Shadow */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/60 blur-sm rounded-full pointer-events-none" />

            {/* Chest Base */}
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-amber-500 via-amber-700 to-amber-950 rounded-b-2xl border-2 border-amber-300 shadow-2xl overflow-hidden">
              <div className="absolute inset-y-0 left-3.5 w-2 bg-yellow-400/80 border-x border-amber-950" />
              <div className="absolute inset-y-0 right-3.5 w-2 bg-yellow-400/80 border-x border-amber-950" />
              {/* Center Medallion */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-yellow-300 border-2 border-amber-900 flex items-center justify-center shadow-md">
                <span className="text-[10px] font-black text-amber-950">₹</span>
              </div>
            </div>

            {/* Chest Lid (Dramatic Flip) */}
            <div
              className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 rounded-t-2xl border-2 border-amber-200 shadow-lg origin-top transition-transform duration-700 preserve-3d"
              style={{
                transform: chestOpen ? 'rotateX(-125deg)' : 'rotateX(0deg)',
                transformOrigin: 'top center',
              }}
            >
              <div className="absolute inset-y-0 left-3.5 w-2 bg-yellow-200/90" />
              <div className="absolute inset-y-0 right-3.5 w-2 bg-yellow-200/90" />
            </div>

            {/* Dramatic Golden Bloom Eruption */}
            {chestOpen && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-28 bg-radial from-yellow-200 via-amber-400 to-transparent rounded-full animate-light-burst pointer-events-none z-30" />
            )}
          </div>
        </div>

        {/* Revealed Success Details */}
        <div
          className={`space-y-4 w-full transition-all duration-700 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-400 text-xs font-black uppercase tracking-wider shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Reward Claimed Successfully!</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 tracking-tight drop-shadow-md">
            CONGRATULATIONS!
          </h1>

          {/* Amount Display with CountUp */}
          <div className="relative mx-auto w-full p-5 rounded-3xl bg-gradient-to-b from-white/10 via-white/5 to-white/10 backdrop-blur-md border border-amber-400/30 shadow-2xl">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-300/80 block mb-1">
              Received Amount
            </span>

            <div className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
              <CountUpNumber end={amount} duration={1200} decimals={2} />
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col items-center justify-center gap-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isDirectBank
                    ? 'Dispatched directly via Instant UPI'
                    : 'Credited instantly to your Createlifafa Wallet'}
                </span>
              </span>

              {maskedDestination && (
                <span className="text-[11px] font-mono text-slate-300 font-bold">
                  Sent to: <span className="text-amber-300">{maskedDestination}</span>
                </span>
              )}

              {referenceId && (
                <span className="text-[10px] font-mono text-slate-400">
                  Ref ID: {referenceId}
                </span>
              )}
            </div>
          </div>

          {/* Subtext */}
          <p className="text-xs text-slate-300 font-medium max-w-xs mx-auto">
            Your reward has been sent successfully. Thank you for participating!
          </p>

          {/* Action Buttons */}
          <div className="w-full space-y-2.5 pt-2">
            {/* Primary DONE Button */}
            {onDone && (
              <button
                type="button"
                onClick={onDone}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-300/50"
              >
                <span>DONE</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>
            )}

            {/* Share Lifafa Button */}
            {onShare ? (
              <button
                type="button"
                onClick={onShare}
                className="w-full py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs shadow-md border border-white/15 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Share This Lifafa With Friends</span>
              </button>
            ) : shareUrl ? (
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs shadow-md border border-white/15 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-amber-400" />
                )}
                <span>{copiedLink ? 'Share Link Copied!' : 'Copy Lifafa Share Link'}</span>
              </button>
            ) : null}
          </div>

        </div>

      </div>
    </div>
  );
};
