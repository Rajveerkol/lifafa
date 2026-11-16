import React, { useState, useEffect, useCallback, useId } from 'react';
import { CheckCircle2, ArrowLeft, AlertTriangle, ShieldCheck, Sparkles, Server } from 'lucide-react';

interface GameTile {
  id: string;
  title: string;
  subtitle: string;
  provider: string;
  themeGradient: string;
  borderColor: string;
  glowColor: string;
  accentColor: string;
  badge?: string;
  iconType: 'buffalo' | 'diamonds' | 'gems' | 'bandito' | 'alibaba' | 'garuda1000' | 'garuda500' | 'niubi' | 'ape';
}

const GAME_TILES: GameTile[] = [
  {
    id: 'charge-buffalo',
    title: 'CHARGE BUFFALO',
    subtitle: 'WILD PRAIRIE',
    provider: 'JILI',
    themeGradient: 'from-amber-950 via-yellow-900 to-amber-950',
    borderColor: 'border-amber-500/50',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    accentColor: '#f59e0b',
    iconType: 'buffalo',
  },
  {
    id: 'double-diamonds',
    title: 'DOUBLE DIAMONDS',
    subtitle: 'IRIDESCENT MULTIPLIER',
    provider: 'JILI',
    themeGradient: 'from-sky-950 via-indigo-900 to-purple-950',
    borderColor: 'border-sky-400/50',
    glowColor: 'rgba(56, 189, 248, 0.35)',
    accentColor: '#38bdf8',
    badge: 'HOT',
    iconType: 'diamonds',
  },
  {
    id: 'fortune-gems',
    title: 'FORTUNE GEMS',
    subtitle: 'ANCIENT IDOL',
    provider: 'JILI',
    themeGradient: 'from-amber-950 via-amber-800 to-emerald-950',
    borderColor: 'border-yellow-400/50',
    glowColor: 'rgba(250, 204, 21, 0.4)',
    accentColor: '#facc15',
    iconType: 'gems',
  },
  {
    id: 'wild-bandito',
    title: 'WILD BANDITO',
    subtitle: 'FIESTA BONANZA',
    provider: 'PG SOFT',
    themeGradient: 'from-purple-950 via-rose-950 to-indigo-950',
    borderColor: 'border-rose-400/50',
    glowColor: 'rgba(251, 113, 133, 0.35)',
    accentColor: '#fb7185',
    iconType: 'bandito',
  },
  {
    id: 'ali-baba',
    title: 'ALI BABA',
    subtitle: 'TREASURE OF CAVE',
    provider: 'JILI',
    themeGradient: 'from-violet-950 via-purple-900 to-slate-950',
    borderColor: 'border-purple-400/50',
    glowColor: 'rgba(192, 132, 252, 0.35)',
    accentColor: '#c084fc',
    iconType: 'alibaba',
  },
  {
    id: 'fortune-garuda-1000',
    title: 'GARUDA 1000',
    subtitle: '1000X MYTHIC WINGS',
    provider: 'JILI',
    themeGradient: 'from-amber-950 via-yellow-800 to-amber-900',
    borderColor: 'border-amber-400/60',
    glowColor: 'rgba(251, 191, 36, 0.45)',
    accentColor: '#fbbf24',
    badge: '1000X',
    iconType: 'garuda1000',
  },
  {
    id: 'fortune-garuda-500',
    title: 'GARUDA 500',
    subtitle: '500X CELESTIAL',
    provider: 'JILI',
    themeGradient: 'from-yellow-950 via-amber-900 to-orange-950',
    borderColor: 'border-yellow-500/50',
    glowColor: 'rgba(234, 179, 8, 0.35)',
    accentColor: '#eab308',
    badge: '500X',
    iconType: 'garuda500',
  },
  {
    id: 'super-niubi',
    title: 'SUPER NIUBI',
    subtitle: 'DELUXE CYBER BULL',
    provider: 'JILI',
    themeGradient: 'from-indigo-950 via-fuchsia-950 to-purple-950',
    borderColor: 'border-fuchsia-400/50',
    glowColor: 'rgba(232, 121, 249, 0.35)',
    accentColor: '#e879f9',
    iconType: 'niubi',
  },
  {
    id: 'wild-ape',
    title: 'WILD APE #3258',
    subtitle: 'CYBER VIP CLUB',
    provider: 'JILI',
    themeGradient: 'from-purple-950 via-indigo-950 to-slate-950',
    borderColor: 'border-violet-400/50',
    glowColor: 'rgba(167, 139, 250, 0.35)',
    accentColor: '#a78bfa',
    badge: 'VIP',
    iconType: 'ape',
  },
];

/**
 * Custom SVG Game Artwork renderer for high fidelity on all screens.
 */
function GameArtwork({ type, accent }: { type: GameTile['iconType']; accent: string }) {
  switch (type) {
    case 'buffalo':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]">
          <circle cx="50" cy="50" r="42" fill="#2b1402" stroke="#f59e0b" strokeWidth="2.5" />
          {/* Horns */}
          <path d="M 22 45 C 10 25 30 15 42 35 C 32 30 24 35 22 45 Z" fill="#fbbf24" />
          <path d="M 78 45 C 90 25 70 15 58 35 C 68 30 76 35 78 45 Z" fill="#fbbf24" />
          {/* Buffalo Face */}
          <path d="M 32 40 L 68 40 L 62 70 L 50 78 L 38 70 Z" fill="#78350f" />
          <ellipse cx="50" cy="48" rx="14" ry="12" fill="#92400e" />
          {/* Glowing Eyes */}
          <circle cx="43" cy="46" r="3" fill="#fef08a" />
          <circle cx="57" cy="46" r="3" fill="#fef08a" />
          {/* Nose Ring */}
          <circle cx="50" cy="65" r="7" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
        </svg>
      );
    case 'diamonds':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(56,189,248,0.6)]">
          <polygon points="50,15 85,38 72,82 28,82 15,38" fill="url(#diam-grad)" stroke="#38bdf8" strokeWidth="2" />
          <polygon points="50,15 68,38 50,82 32,38" fill="#bae6fd" opacity="0.6" />
          <polygon points="15,38 50,38 32,82" fill="#7dd3fc" opacity="0.7" />
          <polygon points="85,38 50,38 68,82" fill="#0284c7" opacity="0.7" />
          <defs>
            <linearGradient id="diam-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
          </defs>
        </svg>
      );
    case 'gems':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(250,204,21,0.6)]">
          {/* Aztec Golden Mask */}
          <rect x="22" y="24" width="56" height="56" rx="12" fill="#78350f" stroke="#facc15" strokeWidth="2.5" />
          <polygon points="50,14 62,24 38,24" fill="#facc15" />
          <rect x="30" y="36" width="12" height="10" rx="3" fill="#10b981" stroke="#facc15" strokeWidth="1.5" />
          <rect x="58" y="36" width="12" height="10" rx="3" fill="#10b981" stroke="#facc15" strokeWidth="1.5" />
          {/* Center Ruby Gem */}
          <polygon points="50,48 58,56 50,64 42,56" fill="#ef4444" stroke="#fef08a" strokeWidth="1.5" />
          {/* Golden Teeth */}
          <rect x="38" y="68" width="6" height="6" fill="#facc15" />
          <rect x="46" y="68" width="8" height="6" fill="#facc15" />
          <rect x="56" y="68" width="6" height="6" fill="#facc15" />
        </svg>
      );
    case 'bandito':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(251,113,133,0.5)]">
          {/* Sombrero */}
          <ellipse cx="50" cy="38" rx="44" ry="14" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
          <path d="M 34 38 C 34 20 66 20 66 38 Z" fill="#b45309" stroke="#fbbf24" strokeWidth="2" />
          {/* Skull Face */}
          <circle cx="50" cy="56" r="18" fill="#f1f5f9" />
          <ellipse cx="43" cy="54" rx="4" ry="5" fill="#0f172a" />
          <ellipse cx="57" cy="54" rx="4" ry="5" fill="#0f172a" />
          <polygon points="50,60 47,66 53,66" fill="#0f172a" />
          {/* Mustache */}
          <path d="M 38 68 C 45 64 50 67 50 67 C 50 67 55 64 62 68 C 66 70 60 74 50 71 C 40 74 34 70 38 68 Z" fill="#020617" />
        </svg>
      );
    case 'alibaba':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(192,132,252,0.5)]">
          {/* Sultan Turban */}
          <ellipse cx="50" cy="42" rx="28" ry="20" fill="#f8fafc" stroke="#c084fc" strokeWidth="2" />
          <circle cx="50" cy="30" r="6" fill="#a855f7" stroke="#fbbf24" strokeWidth="1.5" />
          <path d="M 50 24 C 54 14 58 12 60 8" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Face */}
          <ellipse cx="50" cy="58" rx="16" ry="18" fill="#fcd34d" />
          {/* Eyes & Beard */}
          <circle cx="44" cy="54" r="2.5" fill="#1e1b4b" />
          <circle cx="56" cy="54" r="2.5" fill="#1e1b4b" />
          <path d="M 40 64 C 45 74 55 74 60 64 C 55 78 45 78 40 64 Z" fill="#1e1b4b" />
        </svg>
      );
    case 'garuda1000':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(251,191,36,0.6)]">
          {/* Sunburst Halo */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" />
          {/* Golden Eagle Wings */}
          <path d="M 16 50 C 14 30 36 26 46 42 C 34 38 24 44 16 50 Z" fill="#fbbf24" />
          <path d="M 84 50 C 86 30 64 26 54 42 C 66 38 76 44 84 50 Z" fill="#fbbf24" />
          {/* Garuda Crown & Head */}
          <polygon points="50,16 56,30 44,30" fill="#facc15" stroke="#d97706" strokeWidth="1.5" />
          <circle cx="50" cy="42" r="14" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
          <polygon points="50,44 58,52 42,52" fill="#ea580c" />
          {/* 1000X Banner */}
          <rect x="26" y="66" width="48" height="16" rx="5" fill="#991b1b" stroke="#facc15" strokeWidth="1.5" />
          <text x="50" y="78" textAnchor="middle" fill="#fef08a" fontSize="10" fontWeight="900" fontFamily="sans-serif">1000X</text>
        </svg>
      );
    case 'garuda500':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(234,179,8,0.5)]">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="3 3" />
          {/* Wings */}
          <path d="M 18 52 C 16 34 36 30 46 44 C 36 42 26 46 18 52 Z" fill="#fde047" />
          <path d="M 82 52 C 84 34 64 30 54 44 C 64 42 74 46 82 52 Z" fill="#fde047" />
          {/* Bird Mask */}
          <circle cx="50" cy="42" r="14" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
          <polygon points="50,44 56,52 44,52" fill="#c2410c" />
          {/* 500 Banner */}
          <rect x="28" y="66" width="44" height="16" rx="5" fill="#b45309" stroke="#fef08a" strokeWidth="1.5" />
          <text x="50" y="78" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="sans-serif">500</text>
        </svg>
      );
    case 'niubi':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(232,121,249,0.5)]">
          {/* Cyber Bull Emblem */}
          <polygon points="50,18 84,40 70,82 30,82 16,40" fill="#3b0764" stroke="#e879f9" strokeWidth="2" />
          {/* Neon Magenta Horns */}
          <path d="M 30 42 C 20 20 40 14 48 30 C 40 26 32 32 30 42 Z" fill="#f43f5e" />
          <path d="M 70 42 C 80 20 60 14 52 30 C 60 26 68 32 70 42 Z" fill="#f43f5e" />
          <circle cx="42" cy="50" r="3.5" fill="#38bdf8" />
          <circle cx="58" cy="50" r="3.5" fill="#38bdf8" />
          <polygon points="50,56 56,66 44,66" fill="#fbbf24" />
        </svg>
      );
    case 'ape':
      return (
        <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_4px_14px_rgba(167,139,250,0.5)]">
          {/* Ape Head */}
          <circle cx="50" cy="50" r="30" fill="#4c1d95" stroke="#a78bfa" strokeWidth="2" />
          {/* Ears */}
          <circle cx="20" cy="50" r="10" fill="#581c87" stroke="#a78bfa" strokeWidth="1.5" />
          <circle cx="80" cy="50" r="10" fill="#581c87" stroke="#a78bfa" strokeWidth="1.5" />
          {/* Cyberpunk Visor */}
          <rect x="32" y="40" width="36" height="12" rx="4" fill="#06b6d4" stroke="#f43f5e" strokeWidth="1.5" />
          {/* Ape Muzzle */}
          <ellipse cx="50" cy="62" rx="14" ry="10" fill="#6d28d9" />
          <line x1="42" y1="64" x2="58" y2="64" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

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
                <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-emerald-950">
                  <img
                    src="/images/6e-club-logo.jpg"
                    alt="6E CLUB Official Logo"
                    className="w-full h-full object-cover select-none"
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
              
              {/* Pulsing 6E CLUB Logo with Circular Progress */}
              <div className="relative mb-6">
                {/* Glowing Outer Spinning Ring */}
                <div className="absolute -inset-3 rounded-full border-2 border-amber-400/40 border-t-amber-300 border-r-transparent yono-spin-slow" />
                
                {/* 6E CLUB Logo */}
                <div className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-pulse">
                  <img
                    src="/images/6e-club-logo.jpg"
                    alt="6E CLUB Loading"
                    className="w-full h-full object-cover select-none"
                  />
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
                <div className="relative w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-emerald-950/80 border-2 border-emerald-400/70 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-emerald-400" />
                </div>
              </div>

              {/* Heading: PREVIEW READY */}
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase mb-1.5">
                PREVIEW READY
              </h2>

              {/* Status Row: "Loaded" badge + "Entered UID: [uid]" */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                  Loaded
                </span>
                
                <span className="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-[#080d1a] border border-amber-500/40 text-amber-300 font-mono text-xs font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  Entered UID: <span className="text-white font-extrabold">{uid}</span>
                </span>
              </div>

              {/* 3x3 GAME PREVIEW GRID (Matches Reference Screenshot 3) */}
              <div className="w-full grid grid-cols-3 gap-2 sm:gap-2.5 p-2 sm:p-3 rounded-2xl bg-black/60 border border-amber-500/25 mb-4 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                {GAME_TILES.map((tile) => (
                  <div
                    key={tile.id}
                    className={`group relative rounded-xl overflow-hidden border ${tile.borderColor} bg-gradient-to-b ${tile.themeGradient} p-2 flex flex-col items-center justify-between transition-all duration-200 transform hover:scale-[1.04] active:scale-[0.98] cursor-pointer shadow-md`}
                    style={{
                      boxShadow: `0 4px 14px ${tile.glowColor}`,
                    }}
                  >
                    {/* Top Provider / Multiplier Badge */}
                    <div className="w-full flex justify-between items-center text-[9px] font-black tracking-wider uppercase mb-1">
                      <span className="px-1.5 py-0.2 rounded bg-black/50 text-amber-300 border border-amber-500/30">
                        {tile.provider}
                      </span>
                      {tile.badge && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-600/90 text-white font-bold text-[8px]">
                          {tile.badge}
                        </span>
                      )}
                    </div>

                    {/* Center Artwork Illustration */}
                    <div className="my-1.5 transform group-hover:scale-110 transition-transform duration-200">
                      <GameArtwork type={tile.iconType} accent={tile.accentColor} />
                    </div>

                    {/* Bottom Title Ribbon */}
                    <div className="w-full py-1 px-1 rounded-md bg-black/85 border border-white/10 text-center min-h-[32px] sm:min-h-[36px] flex flex-col justify-center">
                      <div className="text-[9px] sm:text-[10.5px] font-black text-amber-300 tracking-tight leading-tight uppercase">
                        {tile.title}
                      </div>
                      <div className="text-[7.5px] sm:text-[8px] text-slate-400 font-semibold leading-none mt-0.5 truncate">
                        {tile.subtitle}
                      </div>
                    </div>
                  </div>
                ))}
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
