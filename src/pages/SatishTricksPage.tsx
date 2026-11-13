import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Sparkles, RefreshCw, Copy, Check, ExternalLink } from 'lucide-react';

/**
 * Generates an exclusive 9-digit numeric demo code.
 * Invariant: Never starts with zero (first digit 1-9, remaining 8 digits 0-9).
 */
function generateRandom9DigitCode(): string {
  const firstDigit = Math.floor(Math.random() * 9) + 1; // 1 to 9
  let restDigits = '';
  for (let i = 0; i < 8; i++) {
    restDigits += Math.floor(Math.random() * 10); // 0 to 9
  }
  return `${firstDigit}${restDigits}`;
}

export function SatishTricksPage() {
  // Requirement 4: On open, a random 9-digit code must already be visible
  const [code, setCode] = useState<string>(() => generateRandom9DigitCode());
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast notification
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Requirement 5: Generate New Code with animation and anti-spam lock
  const handleGenerateCode = useCallback(() => {
    if (isGenerating) return; // Prevent duplicate clicks during animation

    setIsGenerating(true);
    setCopied(false);

    // Halfway through flip animation, update the displayed code
    setTimeout(() => {
      const nextCode = generateRandom9DigitCode();
      setCode(nextCode);
      setToastMessage('New demo code generated!');
    }, 220);

    // Re-enable clicks after animation completes
    setTimeout(() => {
      setIsGenerating(false);
    }, 500);
  }, [isGenerating]);

  // Requirement 6: Copy Code with robust fallback
  const handleCopyCode = useCallback(async () => {
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        success = true;
      } else {
        // Fallback for older browsers or non-secure contexts
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      success = false;
    }

    if (success) {
      setCopied(true);
      setToastMessage('Code copied successfully!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      setToastMessage('Failed to copy. Please select manually.');
    }
  }, [code]);

  return (
    <div className="satish-page-container relative min-h-screen w-full overflow-x-hidden bg-[#0a031c] text-white flex flex-col justify-between selection:bg-yellow-400 selection:text-slate-950 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Scoped CSS animations for high-performance visual effects */}
      <style>{`
        @keyframes satishFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes satishPulseSlow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.08); }
        }
        @keyframes satishGlowBorder {
          0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 15px rgba(250, 204, 21, 0.3)); }
          50% { opacity: 1; filter: drop-shadow(0 0 25px rgba(250, 204, 21, 0.6)); }
        }
        @keyframes satishParticleDrift {
          0% { transform: translateY(0px) translateX(0px); opacity: 0.2; }
          50% { transform: translateY(-30px) translateX(15px); opacity: 0.8; }
          100% { transform: translateY(-60px) translateX(0px); opacity: 0; }
        }
        .satish-float {
          animation: satishFloat 6s ease-in-out infinite;
        }
        .satish-pulse {
          animation: satishPulseSlow 4s ease-in-out infinite;
        }
        .satish-glow-border {
          animation: satishGlowBorder 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .satish-float, .satish-pulse, .satish-glow-border {
            animation: none !important;
          }
        }
      `}</style>

      {/* AMBIENT BACKGROUND GLOWS & PARTICLES */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Top royal purple & violet orb */}
        <div className="satish-pulse absolute -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[450px] bg-gradient-to-b from-purple-600/30 via-indigo-600/20 to-transparent rounded-full blur-[110px]" />

        {/* Electric blue accent orb (left side) */}
        <div className="satish-pulse absolute top-1/3 -left-36 w-[420px] h-[420px] bg-sky-500/15 rounded-full blur-[100px]" style={{ animationDelay: '1.5s' }} />

        {/* Neon yellow/amber accent orb (right side) */}
        <div className="satish-pulse absolute top-1/2 -right-32 w-[380px] h-[380px] bg-amber-400/15 rounded-full blur-[90px]" style={{ animationDelay: '2.5s' }} />

        {/* Bottom deep violet glow */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-purple-900/25 rounded-full blur-[120px]" />

        {/* Decorative Floating Sparkle Particles */}
        <div className="absolute top-[18%] left-[12%] w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-[0_0_8px_#fde047] opacity-60 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute top-[28%] right-[15%] w-2 h-2 bg-sky-400 rounded-full shadow-[0_0_10px_#38bdf8] opacity-70 animate-pulse" style={{ animationDuration: '2.4s' }} />
        <div className="absolute top-[68%] left-[18%] w-1.5 h-1.5 bg-purple-300 rounded-full shadow-[0_0_8px_#d8b4fe] opacity-50 animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[75%] right-[22%] w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15] opacity-60 animate-pulse" style={{ animationDuration: '3.2s' }} />
      </div>

      {/* TOP HEADER SECTION */}
      <header className="relative z-10 w-full pt-8 pb-4 px-4 sm:px-6 flex flex-col items-center text-center">
        {/* Animated Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-extrabold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          </span>
          <span>LIVE PROMO</span>
        </div>

        {/* Small Gift Icon with Glowing Animation */}
        <div className="satish-float relative mb-3">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-300 rounded-2xl blur-md opacity-50" />
          <div className="relative p-3 rounded-2xl bg-gradient-to-br from-amber-400/25 via-yellow-500/15 to-purple-900/40 border border-amber-400/50 text-amber-300 shadow-[0_0_20px_rgba(250,204,21,0.35)]">
            <Gift className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
        </div>

        {/* Brand Title: SATISH TRICKS */}
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight uppercase">
          <span className="bg-gradient-to-r from-white via-yellow-200 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(250,204,21,0.45)]">
            SATISH TRICKS
          </span>
        </h1>

        {/* Small Subtitle */}
        <p className="mt-1 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-purple-200/80">
          Exclusive Code Generator
        </p>
      </header>

      {/* MAIN CODE GENERATOR CARD */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 sm:px-6 my-auto py-4">
        {/* Outer glowing border card container */}
        <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-b from-yellow-400/50 via-purple-500/30 to-sky-400/40 shadow-[0_15px_50px_-10px_rgba(124,58,237,0.4)]">
          {/* Inner Glassmorphic Surface */}
          <div className="relative rounded-3xl bg-[#12072e]/85 backdrop-blur-2xl p-6 sm:p-8 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col items-center text-center">
            
            {/* Card Badge / Heading */}
            <div className="flex items-center gap-2 text-yellow-300 text-xs sm:text-sm font-extrabold uppercase tracking-widest mb-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>UNIQUE CODE GENERATOR</span>
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>

            {/* Card Subtitle */}
            <p className="text-xs sm:text-sm text-purple-200/70 font-medium mb-6">
              Generate your exclusive 9-digit demo code
            </p>

            {/* CODE CONTAINER (White / Yellow Gradient with 3D Flip) */}
            <div className="relative w-full mb-6">
              {/* Subtle pulsing background glow behind code */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 via-amber-300/25 to-yellow-400/20 rounded-2xl blur-lg opacity-70" />

              {/* Code Box */}
              <div
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#1b0a42] to-[#0c0420] border-2 border-yellow-400/50 p-5 sm:p-6 shadow-[0_0_30px_rgba(250,204,21,0.25)] transition-all duration-300 ease-out ${
                  isGenerating
                    ? 'scale-95 rotate-x-90 opacity-40 blur-[2px]'
                    : 'scale-100 rotate-x-0 opacity-100 blur-0'
                }`}
                style={{ perspective: '800px', transformStyle: 'preserve-3d' }}
              >
                {/* Tech Corner Accent Marks */}
                <div className="absolute top-1.5 left-2 text-[10px] text-yellow-400/40 font-mono tracking-wider">
                  DEMO // 9-DIGIT
                </div>
                <div className="absolute top-1.5 right-2 text-[10px] text-emerald-400/70 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  VALID
                </div>

                {/* THE 9-DIGIT CODE */}
                <div className="py-2 flex items-center justify-center">
                  <span
                    className="font-mono font-black text-3xl sm:text-4xl tracking-[0.18em] sm:tracking-[0.24em] bg-gradient-to-r from-white via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(250,204,21,0.6)] select-all cursor-pointer"
                    title="Click Copy Code below"
                  >
                    {code}
                  </span>
                </div>

                {/* Subtle bottom shine line */}
                <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
              </div>
            </div>

            {/* BUTTON GROUP */}
            <div className="w-full flex flex-col gap-3">
              {/* 1. GENERATE NEW CODE BUTTON */}
              <button
                type="button"
                onClick={handleGenerateCode}
                disabled={isGenerating}
                aria-label="Generate new 9-digit code"
                className="group relative w-full py-4 px-6 rounded-2xl font-black text-slate-950 text-sm sm:text-base tracking-wider uppercase bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 hover:from-yellow-200 hover:via-yellow-300 hover:to-amber-300 active:scale-[0.98] transition-all duration-200 shadow-[0_0_25px_rgba(250,204,21,0.45)] hover:shadow-[0_0_35px_rgba(250,204,21,0.7)] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed select-none overflow-hidden"
              >
                {/* Light shimmer swipe across button */}
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform ease-out pointer-events-none" />

                <RefreshCw
                  className={`w-5 h-5 text-slate-950 transition-transform ${
                    isGenerating ? 'animate-spin' : 'group-hover:rotate-180 duration-500'
                  }`}
                />
                <span>{isGenerating ? 'GENERATING...' : 'GENERATE NEW CODE'}</span>
              </button>

              {/* 2. COPY CODE BUTTON */}
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label="Copy current code"
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base tracking-wider uppercase transition-all duration-200 border flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] select-none backdrop-blur-md ${
                  copied
                    ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'bg-white/10 hover:bg-white/15 border-purple-400/30 hover:border-yellow-400/50 text-white shadow-lg'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-emerald-300 animate-bounce" />
                    <span className="text-emerald-200 font-extrabold">COPIED!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 text-purple-200" />
                    <span>COPY CODE</span>
                  </>
                )}
              </button>

              {/* 3. JOIN TELEGRAM BUTTON */}
              <a
                href="https://t.me/mishra4488"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join official Telegram channel @mishra4488"
                className="group w-full py-3.5 px-6 rounded-2xl font-black text-white text-sm sm:text-base tracking-wider uppercase bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all duration-200 shadow-[0_0_25px_rgba(14,165,233,0.45)] hover:shadow-[0_0_35px_rgba(14,165,233,0.7)] flex items-center justify-center gap-2.5 cursor-pointer select-none"
              >
                {/* Authentic Telegram Airplane SVG Icon */}
                <svg
                  className="w-5 h-5 fill-current text-white transition-transform group-hover:scale-110"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                <span>JOIN TELEGRAM</span>
                <ExternalLink className="w-4 h-4 text-sky-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>

            {/* Helpful instructions note */}
            <p className="mt-5 text-[11px] text-purple-200/50 leading-relaxed max-w-xs">
              Click &quot;Generate New Code&quot; for instant codes. Tap &quot;Copy Code&quot; to copy directly to your clipboard.
            </p>
          </div>
        </div>
      </main>

      {/* FLOATING TOAST NOTIFICATION */}
      <div
        className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ${
          toastMessage ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <div className="px-5 py-2.5 rounded-full bg-slate-900/90 text-yellow-300 font-bold text-xs sm:text-sm border border-yellow-400/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
          <span>{toastMessage}</span>
        </div>
      </div>

      {/* FOOTER SECTION */}
      <footer className="relative z-10 w-full py-6 px-4 text-center text-xs text-purple-300/60 flex flex-col items-center gap-1.5">
        <p className="font-semibold tracking-wide">
          SATISH TRICKS • Powered by CreateLifafa
        </p>
        <p className="text-[11px] text-purple-300/40">
          © {new Date().getFullYear()} SATISH TRICKS • All rights reserved
        </p>
        <p className="text-[10px] text-purple-300/30 max-w-xs mt-1 leading-tight">
          Demo codes are generated for promotional and entertainment use only. Not an official voucher or redeemable currency.
        </p>
      </footer>
    </div>
  );
}

export default SatishTricksPage;
