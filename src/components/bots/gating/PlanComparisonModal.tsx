import React from 'react';
import { X, Check, Lock, Sparkles, Shield, Zap } from 'lucide-react';
import {
  BOT_PLANS,
  FEATURE_ENTITLEMENT_MAP,
  BotPlanPrice,
  BotFeatureKey,
  hasBotFeature,
} from '../../../utils/botFeatureEntitlements';

interface PlanComparisonModalProps {
  currentPlanPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

const PLAN_PRICES: BotPlanPrice[] = [99, 299, 499, 999, 1999];

export const PlanComparisonModal: React.FC<PlanComparisonModalProps> = ({
  currentPlanPrice,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl border border-sky-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-5 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-200" />
              <h3 className="font-extrabold text-base tracking-tight">Bot Plan Feature Matrix</h3>
            </div>
            <p className="text-xs text-cyan-100 mt-0.5">
              Features are bound strictly to this specific bot slot plan
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plan Header Badges */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 overflow-x-auto">
          <div className="grid grid-cols-5 gap-2 min-w-[650px]">
            {PLAN_PRICES.map((price) => {
              const plan = BOT_PLANS[price];
              const isCurrent = Number(currentPlanPrice) === price;

              return (
                <div
                  key={price}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-500 shadow-2xs ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    {plan.tier}
                  </div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    ₹{plan.price}
                  </div>
                  {isCurrent ? (
                    <span className="inline-block mt-1 text-[9px] bg-blue-600 text-white font-extrabold px-2 py-0.2 rounded-full">
                      Active Bot
                    </span>
                  ) : (
                    <span className="inline-block mt-1 text-[9px] text-slate-400 font-semibold">
                      Slot Tier
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="min-w-[650px]">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Feature Name</th>
                  {PLAN_PRICES.map((p) => (
                    <th key={p} className="py-2.5 px-3 text-center">
                      ₹{p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(FEATURE_ENTITLEMENT_MAP).map(([key, feat]) => {
                  return (
                    <tr key={key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{feat.name}</div>
                        <div className="text-[10px] text-slate-400">{feat.description}</div>
                      </td>

                      {PLAN_PRICES.map((p) => {
                        const allowed = hasBotFeature(p, key as BotFeatureKey);
                        const isCurrentSlot = Number(currentPlanPrice) === p;

                        return (
                          <td
                            key={p}
                            className={`py-3 px-3 text-center ${
                              isCurrentSlot ? 'bg-blue-50/40 font-bold' : ''
                            }`}
                          >
                            {allowed ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 inline-flex items-center justify-center mx-auto">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 inline-flex items-center justify-center mx-auto">
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px]">
            Feature gating is enforced server-side. Each bot slot operates under its purchased entitlement.
          </span>
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
};
