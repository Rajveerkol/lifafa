import React, { useState, useEffect, useCallback, useId } from 'react';
import { CheckCircle2, ArrowLeft, AlertTriangle, ShieldCheck, Sparkles, Server } from 'lucide-react';

export function YonoAppPage() {
  const [screen, setScreen] = useState<'INPUT' | 'LOADING' | 'PREVIEW'>('INPUT');
  const [uid, setUid] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Loading screen states
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('Connecting to demo server...');

  const inputId = useId();

  // Handle UID input change (strictly numeric, max 6 digits)
  const handleUidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = raw.replace(/\D/g, '').slice(0, 6);
    setUid(clean);
    if (error) setError(null);
  };

  // Submit UID with validation
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!uid || uid.length < 6) {
      setError('Please enter a valid 6-digit numeric game UID');
      return;
    }

    setError(null);
    setScreen('LOADING');
    setLoadingProgress(0);
    setLoadingMessage('Connecting to demo server...');
  };

  // 3-second animated loading sequence
  useEffect(() => {
    if (screen !== 'LOADING') return;

    const startTime = Date.now();
    const duration = 3000; // 3 seconds exact

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setLoadingProgress(progress);

      // Sequence:
      // 0 - 1s (0% - 33%): Connecting to demo server...
      // 1s - 2s (33% - 66%): Preparing your VIP experience...
      // 2s - 3s (66% - 100%): Loading game preview...
      if (elapsed < 1000) {
        setLoadingMessage('Connecting to demo server...');
      } else if (elapsed < 2000) {
        setLoadingMessage('Preparing your VIP experience...');
      } else {
        setLoadingMessage('Loading game preview...');
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        setLoadingProgress(100);
        setTimeout(() => {
          setScreen('PREVIEW');
        }, 150);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [screen]);

  // Return to UID Entry screen
  const handleBackToEntry = useCallback(() => {
    setScreen('INPUT');
    setUid('');
    setError(null);
    setLoadingProgress(0);
  }, []);

  return (
    <div className="yono-portal-container relative min-h-screen w-full overflow-x-hidden bg-[#050608] text-white flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Scoped CSS Keyframe Animations */}
      <style>{`
        @keyframes yonoGlowPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.05); }
        }
        @keyframes yonoBorderSpark {
          0%, 100% { border-color: rgba(245, 158, 11, 0.4); }
          50% { border-color: rgba(251, 191, 36, 0.75); }
        }
        @keyframes yonoSpinSlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .yono-pulse-glow {
          animation: yonoGlowPulse 4s ease-in-out infinite;
        }
        .yono-border-glow {
          animation: yonoBorderSpark 3s ease-in-out infinite;
        }
        .yono-spin-slow {
          animation: yonoSpinSlow 8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .yono-pulse-glow, .yono-border-glow, .yono-spin-slow {
            animation: none !important;
          }
        }
      `}</style>

      {/* AMBIENT BACKGROUND LIGHTING (Dark brown & gold radial glow) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Central warm gold/amber radial lighting spotlight */}
        <div
          className="yono-pulse-glow absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[550px] rounded-full blur-[120px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(217, 119, 6, 0.18), rgba(180, 83, 9, 0.08) 50%, transparent 75%)',
          }}
        />

        {/* Top-right subtle amber highlight */}
        <div className="absolute -top-24 -right-24 w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-[100px]" />

        {/* Bottom-left subtle emerald/gold glow */}
        <div className="absolute -bottom-24 -left-24 w-[450px] h-[450px] bg-emerald-900/15 rounded-full blur-[110px]" />
      </div>

      {/* TOP BRAND HEADER */}
      <header className="relative z-10 w-full pt-8 pb-3 px-4 sm:px-6 flex flex-col items-center text-center">
        {/* Heading: YONO APP */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-wider uppercase">
          <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(245,158,11,0.45)]">
            YONO APP
          </span>
        </h1>

        {/* Subtitle: VIP PLAYER PORTAL */}
        <p className="mt-1 text-xs sm:text-sm font-bold tracking-[0.25em] uppercase text-amber-200/70">
          VIP PLAYER PORTAL
        </p>
      </header>

      {/* MAIN CARD CONTAINER */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 sm:px-6 my-auto py-3">
        {/* =========================================================================
            SCREEN 1: INITIAL UID ENTRY SCREEN
           ========================================================================= */}
        {screen === 'INPUT' && (
          <div className="yono-border-glow relative rounded-3xl p-[1.5px] bg-gradient-to-b from-amber-500/50 via-amber-600/25 to-orange-500/40 shadow-[0_15px_50px_-10px_rgba(0,0,0,0.8)] transition-all">
            {/* Charcoal / Dark Navy Glass Surface */}
            <div className="relative rounded-3xl bg-[#0d121f]/95 backdrop-blur-2xl p-6 sm:p-8 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col items-center text-center">
              
              {/* Status Indicator: Server: Online */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/90 border border-emerald-500/35 text-[11px] font-extrabold text-emerald-400 tracking-wider uppercase mb-5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                </span>
                <span className="flex items-center gap-1">
                  <Server className="w-3 h-3 text-emerald-400" />
                  Server: Online
                </span>
              </div>

              {/* 6E CLUB Logo (Uploaded Asset) */}
              <div className="relative mb-4 group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-emerald-400 rounded-2xl blur-md opacity-40 group-hover:opacity-70 transition-opacity" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-emerald-950">
                  <img
                    src="/images/6e-club-logo.jpg"
                    alt="6E CLUB Official Logo"
                    className="w-full h-full object-cover select-none block"
                  />
                </div>
              </div>

              {/* Heading: VIP Activation Panel */}
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase mb-1">
                VIP Activation Panel
              </h2>

              {/* Subtitle: Enter your 6-digit game UID to continue */}
              <p className="text-xs sm:text-sm text-slate-300 font-medium mb-3">
                Enter your 6-digit game UID to continue
              </p>

              {/* Notice: Demo interface — no real game account changes */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold mb-6">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Demo interface — no real game account changes</span>
              </div>

              {/* UID Form */}
              <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
                
                {/* Live Digit Counter: 0 / 6 */}
                <div className="w-full flex justify-between items-center text-xs mb-1.5 px-1">
                  <span className="text-slate-400 font-medium">Numeric Game UID</span>
                  <span
                    className={`font-mono font-bold tracking-wider ${
                      uid.length === 6 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {uid.length} / 6 digits
                  </span>
                </div>

                {/* Compound UID Input Box (Matching Reference Screenshot 1) */}
                <div
                  className={`w-full flex items-center rounded-2xl bg-[#070a13] border-2 transition-all p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] ${
                    error
                      ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : 'border-amber-500/40 focus-within:border-amber-400 focus-within:shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                  }`}
                >
                  {/* Left Label Badge: Enter UID */}
                  <label
                    htmlFor={inputId}
                    className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shrink-0 shadow-md select-none cursor-pointer"
                  >
                    Enter UID
                  </label>

                  {/* Input field */}
                  <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={uid}
                    onChange={handleUidChange}
                    placeholder="Enter UID number..."
                    autoComplete="off"
                    autoFocus
                    className="flex-1 bg-transparent px-3 py-2 text-white font-mono text-base sm:text-lg font-bold tracking-[0.2em] placeholder:text-slate-500 placeholder:font-sans placeholder:tracking-normal placeholder:font-normal placeholder:text-sm outline-none"
                  />
                </div>

                {/* Validation Error Message */}
                {error && (
                  <p className="mt-2 text-xs text-rose-400 font-semibold flex items-center gap-1 self-start px-1 animate-pulse">
                    <span>⚠</span> {error}
                  </p>
                )}

                {/* Large Golden-Orange Button: CONTINUE */}
                <button
                  type="submit"
                  disabled={uid.length !== 6}
                  className="group relative w-full mt-6 py-4 px-6 rounded-2xl font-black text-slate-950 text-base sm:text-lg tracking-wider uppercase bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 hover:from-amber-300 hover:via-orange-400 hover:to-amber-300 active:scale-[0.98] transition-all duration-200 shadow-[0_0_30px_rgba(245,158,11,0.45)] hover:shadow-[0_0_40px_rgba(245,158,11,0.7)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none overflow-hidden"
                >
                  {/* Shimmer sheen swipe */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform ease-out pointer-events-none" />
                  <span>CONTINUE</span>
                  <Sparkles className="w-5 h-5 text-slate-950 group-hover:rotate-12 transition-transform" />
                </button>
              </form>

              {/* Bottom security pill */}
              <div className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected Sandbox Demo • Zero Login Required</span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 2: ANIMATED 3-SECOND LOADING SCREEN
           ========================================================================= */}
        {screen === 'LOADING' && (
          <div className="yono-border-glow relative rounded-3xl p-[1.5px] bg-gradient-to-b from-amber-500/50 via-amber-600/30 to-orange-500/40 shadow-[0_15px_50px_-10px_rgba(0,0,0,0.8)]">
            <div className="relative rounded-3xl bg-[#0d121f]/95 backdrop-blur-2xl p-8 sm:p-10 border border-white/10 flex flex-col items-center text-center">
              
              {/* Pulsing 6E CLUB Logo with Symmetrical Circular Progress Spinner */}
              <div className="relative mb-6 flex items-center justify-center">
                {/* Fixed-size circular spinner frame with ample clearance */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
                  {/* Outer spinning gradient ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 border-t-amber-400 border-r-amber-400/70 yono-spin-slow pointer-events-none shadow-[0_0_15px_rgba(245,158,11,0.25)]" />
                  
                  {/* Subtle pulsing amber glow behind logo */}
                  <div className="absolute inset-3 rounded-full bg-amber-500/10 blur-md animate-pulse pointer-events-none" />

                  {/* 6E CLUB Logo: Explicit fixed dimensions, rounded-2xl, beautifully centered with zero overlay */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.4)] bg-emerald-950 shrink-0">
                    <img
                      src="/images/6e-club-logo.jpg"
                      alt="6E CLUB Loading"
                      className="w-full h-full object-cover select-none block"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Status Text */}
              <h3 className="text-lg sm:text-xl font-black text-white tracking-wide uppercase mb-1">
                {loadingMessage}
              </h3>

              <p className="text-xs text-amber-200/70 font-mono tracking-wider mb-6">
                CONNECTING UID: <span className="text-amber-400 font-bold">{uid}</span>
              </p>

              {/* Golden Glowing Progress Bar */}
              <div className="w-full bg-[#070a13] rounded-full h-3 p-0.5 border border-amber-500/30 overflow-hidden mb-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                <div
                  className="bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 h-full rounded-full transition-all duration-100 ease-out shadow-[0_0_15px_rgba(250,204,21,0.7)]"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>

              {/* Progress Percentage Display */}
              <div className="flex items-center justify-between w-full px-1 text-xs">
                <span className="text-slate-400 font-medium">Progress</span>
                <span className="text-amber-300 font-mono font-black text-sm">{loadingProgress}%</span>
              </div>

              {/* Demo Notice */}
              <p className="mt-6 text-[11px] text-slate-400/70 max-w-xs">
                Local UI demonstration — preparing high-resolution preview tiles
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 3: FINAL DEMO PREVIEW SCREEN (3x3 GAME GRID)
           ========================================================================= */}
        {screen === 'PREVIEW' && (
          <div className="yono-border-glow relative rounded-3xl p-[1.5px] bg-gradient-to-b from-emerald-500/50 via-amber-500/30 to-emerald-500/40 shadow-[0_15px_60px_-10px_rgba(0,0,0,0.9)] animate-fade-in">
            <div className="relative rounded-3xl bg-[#0c111e]/95 backdrop-blur-2xl p-5 sm:p-7 border border-white/10 flex flex-col items-center text-center">
              
              {/* Animated Green Circle Checkmark */}
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-emerald-400 rounded-full blur-md opacity-40 animate-pulse" />
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-950/80 border-2 border-emerald-400/70 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-emerald-400" />
                </div>
              </div>

              {/* Heading: HACK ACTIVE SUCCESSFUL */}
              <h2 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-wider uppercase mb-1.5 drop-shadow-[0_2px_10px_rgba(16,185,129,0.4)]">
                HACK ACTIVE SUCCESSFUL
              </h2>

              {/* Status Row: Connected UID: [uid] */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 font-mono text-xs font-bold shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  </span>
                  <span>Connected UID: <strong className="text-white font-extrabold">{uid}</strong></span>
                </span>
              </div>

              {/* 3x3 GAME PREVIEW GRID (Official Reference Image) */}
              <div className="w-full my-2 rounded-2xl overflow-hidden border border-amber-500/30 shadow-[0_4px_25px_rgba(245,158,11,0.25)] bg-black/60 p-1">
                <img
                  src="/images/yono-games-grid.jpg"
                  alt="YONO APP VIP Game Grid"
                  className="w-full h-auto object-cover rounded-xl select-none block"
                  loading="eager"
                />
              </div>

              {/* Disclaimer Notice */}
              <p className="text-[10px] sm:text-[11px] text-amber-200/60 leading-tight mb-5 max-w-xs">
                Demonstration preview only. Does not unlock real games, generate winnings, or alter account balances.
              </p>

              {/* Button: BACK TO UID ENTRY */}
              <button
                type="button"
                onClick={handleBackToEntry}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-amber-200 text-sm sm:text-base tracking-wider uppercase bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg select-none"
              >
                <ArrowLeft className="w-4 h-4 text-amber-300" />
                <span>BACK TO UID ENTRY</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER SECTION */}
      <footer className="relative z-10 w-full py-6 px-4 text-center text-xs text-amber-300/60 flex flex-col items-center gap-1">
        <p className="font-semibold tracking-wide">
          YONO APP • VIP PLAYER PORTAL
        </p>
        <p className="text-[11px] text-amber-300/40">
          © {new Date().getFullYear()} 6E CLUB • All rights reserved
        </p>
        <p className="text-[10px] text-slate-500 max-w-xs mt-1 leading-tight">
          Demo interface designed strictly for demonstration & promotional previews. Not affiliated with real game servers or financial wagering.
        </p>
      </footer>
    </div>
  );
}

export default YonoAppPage;
