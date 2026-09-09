import React, { useState } from 'react';
import { Eye, EyeOff, Plus, Wallet as WalletIcon, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/utils';

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

  const availableBalance = wallet?.available_balance ?? 0;
  const reservedBalance = wallet?.reserved_balance ?? 0;
  const displayName = user?.full_name || 'DemoAccount';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 sm:p-6 text-white shadow-xl shadow-blue-600/20">
      {/* Decorative ambient background curves */}
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-12 w-48 h-48 rounded-full bg-indigo-500/25 blur-3xl pointer-events-none" />

      {/* Top Row: Balance Header & Quick Plus */}
      <div className="relative flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Logo badge in circle matching screenshot */}
          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md p-1 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-blue-700 font-black text-sm">
              <span className="text-blue-600">L</span>
              <span className="text-red-500 text-xs">.</span>
            </div>
          </div>

          <div>
            <div className="text-blue-100 text-xs font-medium tracking-wide">
              Total Balance
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {showBalance ? formatCurrency(availableBalance) : '₹ • • • • •'}
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-blue-200 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                aria-label="Toggle balance visibility"
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Top Right Quick Add Button */}
        <button
          onClick={onAddMoneyClick}
          className="w-10 h-10 rounded-2xl bg-white text-blue-600 hover:bg-blue-50 transition-transform active:scale-95 shadow-md flex items-center justify-center font-bold"
          title="Add Money"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Middle Row: User Pill Badge matching screenshot */}
      <div className="relative mb-5">
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium text-white shadow-xs">
          <User className="w-3.5 h-3.5 text-blue-200" />
          <span>User : <strong className="font-semibold">{displayName}</strong></span>
          {reservedBalance > 0 && (
            <span className="ml-2 bg-amber-400/30 text-amber-200 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-amber-300/30">
              Reserved: {formatCurrency(reservedBalance)}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Action Buttons: + Add Money and Withdraw */}
      <div className="relative grid grid-cols-2 gap-3">
        <button
          onClick={onAddMoneyClick}
          className="flex items-center justify-center gap-2 bg-blue-500/50 hover:bg-blue-500/70 border border-white/25 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-2xl text-xs sm:text-sm shadow-sm active:scale-98 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Money</span>
        </button>

        <button
          onClick={onWithdrawClick}
          className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-blue-700 font-bold py-3 px-4 rounded-2xl text-xs sm:text-sm shadow-md active:scale-98 transition-all"
        >
          <WalletIcon className="w-4 h-4 text-blue-600" />
          <span>Withdraw</span>
        </button>
      </div>
    </div>
  );
};
