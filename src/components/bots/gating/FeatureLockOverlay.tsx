import React from 'react';
import { Lock, Sparkles, ArrowRight, Shield } from 'lucide-react';
import {
  BotFeatureKey,
  getRequiredPlanForFeature,
  BOT_PLANS,
  BotPlanPrice,
} from '../../../utils/botFeatureEntitlements';

interface FeatureLockOverlayProps {
  currentPlanPrice: number;
  featureKey: BotFeatureKey;
  onOpenPlanComparison?: () => void;
}

export const FeatureLockOverlay: React.FC<FeatureLockOverlayProps> = ({
  currentPlanPrice,
  featureKey,
  onOpenPlanComparison,
}) => {
  const requiredPlan = getRequiredPlanForFeature(featureKey);
  const currentPlan = BOT_PLANS[currentPlanPrice as BotPlanPrice] || BOT_PLANS[99];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-5 max-w-lg mx-auto my-8">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
        <Lock className="w-7 h-7" />
      </div>

      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1 text-[10px] uppercase font-black tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
          <Shield className="w-3 h-3" />
          Plan Locked Feature
        </div>
        <h3 className="text-lg font-black text-slate-900 tracking-tight">
          {requiredPlan.name} Required
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          This feature is entitled on <b>{requiredPlan.badge}</b> and above. Your current bot is on the{' '}
          <b>{currentPlan.badge}</b> plan.
        </p>
      </div>

      {/* Plan comparison pill */}
      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs font-semibold">
        <div className="text-left">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Bot Slot</span>
          <span className="font-extrabold text-slate-700">{currentPlan.badge}</span>
        </div>

        <ArrowRight className="w-4 h-4 text-slate-300" />

        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Unlocks At</span>
          <span className="font-extrabold text-blue-600">{requiredPlan.badge}</span>
        </div>
      </div>

      {onOpenPlanComparison && (
        <button
          onClick={onOpenPlanComparison}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>View Plan Comparison Matrix</span>
        </button>
      )}
    </div>
  );
};
