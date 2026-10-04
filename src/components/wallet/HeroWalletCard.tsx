import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Plus, Wallet as WalletIcon, User, Sparkles, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/utils';
import { CountUpNumber } from '../lifafa/cinematic/CountUpNumber';

interface HeroWalletCardProps {
  onAddMoneyClick: () => void;
  onWithdrawClick: () => void;
}

export const HeroWalletCard: React.FC<HeroWalletCardProps> = ({
  onAddMoneyClick,
  onWithdrawClick,
}) => {
  const { user, wallet } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Parallax Tilt State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [prevBalance, setPrevBalance] = useState<number>(wallet?.available_balance ?? 0);
  const [isBalanceUpdated, setIsBalanceUpdated] = useState(false);

  const availableBalance = wallet?.available_balance ?? 0;
  const reservedBalance = wallet?.reserved_balance ?? 0;
  const displayName = user?.full_name || 'My Account';

  // Trigger subtle glow pulse on balance update
  useEffect(() => {
    if (wallet && wallet.available_balance !== prevBalance) {
      setIsBalanceUpdated(true);
      setPrevBalance(wallet.available_balance);
      const timer = setTimeout(() => setIsBalanceUpdated(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [wallet?.available_balance]);

  // Mouse Tilt Interaction (Desktop only, respects prefers-reduced-motion)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTilt({ x: rotateX, y: rotateY });
    setGlare({ x: glareX, y: glareY, opacity: 0.15 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: tilt.x === 0 && tilt.y === 0 ? 'transform 0.5s ease-out' : 'transform 0.1s ease-out',
      }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#1e40af] p-5 sm:p-6 text-white shadow-2xl shadow-blue-600/30 border border-blue-400/30 select-none preserve-3d"
    >
      {/* Specular Glare / Light Reflection Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, ${glare.opacity}) 0%, rgba(255, 255, 255, 0) 65%)`,
        }}
      />

      {/* Decorative ambient background curves */}
      <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-indigo-600/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />

      {/* Subtle top edge metallic highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

      {/* Top Row: Balance Header & Floating 3D Orb/Coin */}
      <div className="relative flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {/* Logo badge in 3D raised circle */}
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md p-0.5 border border-white/30 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/30">
            <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-white to-blue-50 flex items-center justify-center text-blue-700 font-black text-sm shadow-inner">
              <span className="text-blue-600 text-base">L</span>
              <span className="text-red-500 text-xs">.</span>
            </div>
          </div>

          <div>
            <div className="text-blue-100 text-xs font-semibold tracking-wide flex items-center gap-1.5">
              <span>Total Available Balance</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Interactive Animated Balance Display */}
            <div className="flex items-center gap-2 pt-0.5">
              <div
                className={`transition-all duration-500 ${
                  isBalanceUpdated ? 'scale-105 drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]' : ''
                }`}
              >
                {showBalance ? (
                  <CountUpNumber
                    end={availableBalance}
                    duration={1000}
                    decimals={2}
                    className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-md text-white"
                  />
                ) : (
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-blue-200">
                    ₹ • • • • •
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/15 cursor-pointer"
                aria-label="Toggle balance visibility"
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Top Right Floating 3D Coin Badge & Quick Add Button */}
        <div className="flex items-center gap-2">
          {/* Subtle 3D Currency Badge */}
          <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/30 backdrop-blur-md shadow-inner animate-bounce-gentle">
            <span className="text-sm font-black text-white/90 font-serif">₹</span>
          </div>

          <button
            type="button"
            onClick={onAddMoneyClick}
            className="w-10 h-10 rounded-2xl bg-white/95 hover:bg-white text-blue-600 transition-all hover:scale-105 active:scale-95 shadow-md shadow-blue-900/30 flex items-center justify-center font-bold cursor-pointer"
            title="Add Money"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Middle Row: User Pill Badge & Reserved Balance */}
      <div className="relative mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 transition-colors backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium text-white shadow-xs">
          <User className="w-3.5 h-3.5 text-blue-200" />
          <span>User: <strong className="font-bold text-white">{displayName}</strong></span>
        </div>

        {reservedBalance > 0 && (
          <div className="inline-flex items-center gap-1.5 bg-amber-400/20 backdrop-blur-md text-amber-200 text-xs px-3 py-1.5 rounded-full font-bold border border-amber-300/30 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Reserved: {formatCurrency(reservedBalance)}</span>
          </div>
        )}
      </div>

      {/* Bottom Action Buttons: + Add Money and Withdraw */}
      <div className="relative grid grid-cols-2 gap-3">
        {/* Add Money Primary Glass CTA */}
        <button
          type="button"
          onClick={onAddMoneyClick}
          className="group flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 hover:border-white/50 backdrop-blur-md text-white font-black py-3.5 px-4 rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Add Money</span>
        </button>

        {/* Withdraw High-Contrast Premium Card CTA */}
        <button
          type="button"
          onClick={onWithdrawClick}
          className="group flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-blue-700 font-black py-3.5 px-4 rounded-2xl text-xs sm:text-sm shadow-lg shadow-blue-950/25 active:scale-98 hover:scale-[1.01] transition-all cursor-pointer border border-white/80"
        >
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <WalletIcon className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span>Withdraw</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-blue-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </button>
      </div>
    </div>
  );
};
