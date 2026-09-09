import React from 'react';
import { ShieldCheck, Gift, Zap } from 'lucide-react';

export const TrustBadges: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`grid grid-cols-3 gap-2 bg-gradient-to-b from-blue-50/70 to-slate-50 border border-blue-100/80 rounded-2xl p-3.5 shadow-sm ${className}`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-sm shadow-blue-500/30">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold text-slate-900 leading-tight">100% Safe</span>
        <span className="text-[10px] text-slate-500 font-medium leading-tight">& Secure</span>
      </div>

      <div className="flex flex-col items-center text-center border-x border-blue-100 px-1">
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mb-1.5 shadow-sm shadow-indigo-500/30">
          <Gift className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold text-slate-900 leading-tight">Exciting</span>
        <span className="text-[10px] text-slate-500 font-medium leading-tight">Rewards</span>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mb-1.5 shadow-sm shadow-blue-400/30">
          <Zap className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-bold text-slate-900 leading-tight">Instant</span>
        <span className="text-[10px] text-slate-500 font-medium leading-tight">Payouts</span>
      </div>
    </div>
  );
};
