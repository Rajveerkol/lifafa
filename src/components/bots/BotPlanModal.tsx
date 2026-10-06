import React, { useState } from 'react';
import { X, Check, ShieldCheck, Zap, Bot, ArrowRight, Loader2, AlertCircle, Sparkles, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { telegramBotService, PurchaseSlotResponse } from '../../services/telegramBotService';
import { CANONICAL_BOT_PLANS, BotPlanTier } from '../../types/telegramBot';

interface BotPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSlotPurchased: (purchase: PurchaseSlotResponse) => void;
}

export const BotPlanModal: React.FC<BotPlanModalProps> = ({ isOpen, onClose, onSlotPurchased }) => {
  const { wallet, refreshWallet } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<BotPlanTier>(CANONICAL_BOT_PLANS[0]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<PurchaseSlotResponse | null>(null);

  if (!isOpen) return null;

  const currentBalance = Number(wallet?.available_balance || 0);
  const isBalanceSufficient = currentBalance >= selectedPlan.price;

  const handlePurchase = async () => {
    setError(null);
    if (!isBalanceSufficient) {
      setError(`Insufficient wallet balance. You need ₹${selectedPlan.price} but have ₹${currentBalance.toFixed(2)}.`);
      return;
    }

    try {
      setIsPurchasing(true);
      const res = await telegramBotService.purchaseBotSlot(selectedPlan.price);
      if (res.success) {
        setSuccessData(res);
        await refreshWallet();
        onSlotPurchased(res);
      } else {
        setError('Purchase could not be processed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete slot purchase');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-sky-100 shadow-2xl shadow-blue-500/15 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Glow Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Bot className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight">Acquire Bot Entitlement Slot</h3>
                <span className="bg-cyan-300/30 text-cyan-100 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-cyan-200/40">
                  Instant Access
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                Each slot unlocks 1 dedicated Telegram Bot connection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successData ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto border border-cyan-200 shadow-lg shadow-cyan-500/20">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">Slot Unlocked Successfully!</h4>
                <p className="text-sm text-slate-500 mt-1">
                  Your <span className="font-bold text-blue-600">{successData.plan_name}</span> is now active in your inventory.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 max-w-sm mx-auto text-left text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Slot ID:</span>
                  <span className="font-mono text-slate-900 font-bold">{successData.slot_id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amount Deducted:</span>
                  <span className="font-bold text-slate-900">₹{successData.plan_price}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Status:</span>
                  <span className="font-bold text-emerald-600 uppercase">AVAILABLE</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setSuccessData(null);
                  onClose();
                }}
                className="w-full max-w-sm bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-sm flex items-center justify-center gap-2 mx-auto"
              >
                <span>Continue to Connect Bot</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Wallet Bar */}
              <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center border border-sky-200 shadow-2xs">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Your Wallet Available Balance</div>
                    <div className="text-base font-black text-slate-900">
                      ₹{currentBalance.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-full border border-blue-200">
                    Auto-Debited on Purchase
                  </span>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Bot Plan Tier
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {CANONICAL_BOT_PLANS.map((tier) => {
                    const isSelected = selectedPlan.price === tier.price;
                    return (
                      <div
                        key={tier.price}
                        onClick={() => setSelectedPlan(tier)}
                        className={`relative p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-gradient-to-b from-blue-50/70 to-cyan-50/40 border-blue-500 shadow-md shadow-blue-500/10'
                            : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                        }`}
                      >
                        {/* 1. Badge Layer */}
                        {tier.badge && (
                          <div className="absolute top-3.5 right-3.5 z-10 pointer-events-none">
                            <span
                              className={`inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs ${
                                tier.badge === 'VIP'
                                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/60 shadow-amber-500/20'
                                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-blue-500/20'
                              }`}
                            >
                              {tier.badge}
                            </span>
                          </div>
                        )}

                        {/* 2. Header Layer (Plan Name & Price) */}
                        <div className={`mb-2 ${tier.badge ? 'pr-20' : ''}`}>
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight leading-snug">
                            {tier.name}
                          </h4>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-lg sm:text-xl font-black text-blue-600 tracking-tight">
                              ₹{tier.price}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              /one-time
                            </span>
                          </div>
                        </div>

                        {/* 3. Tagline */}
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                          {tier.tagline}
                        </p>

                        {/* 4. Features */}
                        <ul className="space-y-1.5 pt-2.5 border-t border-slate-100">
                          {tier.features.slice(0, 3).map((feat, i) => (
                            <li key={i} className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                              <span className="leading-tight">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Summary & Purchase Action */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium px-1">
                  <span>Selected Slot: <strong className="text-slate-900">{selectedPlan.name}</strong></span>
                  <span>Total Due: <strong className="text-slate-900 text-sm">₹{selectedPlan.price}</strong></span>
                </div>

                <button
                  onClick={handlePurchase}
                  disabled={isPurchasing || !isBalanceSufficient}
                  className={`w-full py-4 px-6 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${
                    isBalanceSufficient
                      ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25 active:scale-98'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authorizing Wallet Transaction...</span>
                    </>
                  ) : !isBalanceSufficient ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Insufficient Balance (Needs ₹{selectedPlan.price})</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-cyan-200" />
                      <span>Confirm & Unlock 1 Bot Slot (₹{selectedPlan.price})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50/80 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Server-authoritative wallet debit with audit ledger</span>
          </div>
          <span>Phase 1 Bot Entitlement</span>
        </div>
      </div>
    </div>
  );
};
