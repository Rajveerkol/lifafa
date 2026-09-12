import React from 'react';
import { X, Ticket, Users, Swords, Trophy, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      number: '01',
      title: 'Convert Cash to Game Tickets',
      desc: 'Exchange available wallet balance for Game Tickets at ₹10 = 1 Ticket. Use 1 Game Ticket to enter a 1v1 duel.',
      icon: Ticket,
      color: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: 'text-amber-600',
    },
    {
      number: '02',
      title: 'Get Matched with an Opponent',
      desc: 'Our real-time matchmaking pairs you with a fellow competitor. A 3-second VS countdown prepares both players.',
      icon: Users,
      color: 'from-blue-500 to-indigo-500',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconColor: 'text-blue-600',
    },
    {
      number: '03',
      title: 'Complete 5 Rapid Challenges',
      desc: 'Test your brain across 5 mini-rounds: Quick Quiz, Pattern Match, Memory Sequence, Accuracy Tap, and Speed Reaction.',
      icon: Swords,
      color: 'from-purple-500 to-pink-500',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      iconColor: 'text-purple-600',
    },
    {
      number: '04',
      title: 'Winner Receives 2 Game Tickets',
      desc: 'Points are awarded based on accuracy and speed. The champion wins 2 Game Tickets, which can be converted back to cash at ₹10 per ticket.',
      icon: Trophy,
      color: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-100 p-6 sm:p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/20 mb-3">
            <Swords className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
            How Duel Earn Works
            <Sparkles className="w-5 h-5 text-amber-500" />
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Fast 1v1 brain duels. Prove your skill in 5 quick rounds!
          </p>
        </div>

        {/* Step-by-Step Cards */}
        <div className="space-y-3.5 mb-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`flex items-start gap-3.5 p-3.5 rounded-2xl border ${step.border} ${step.bg} transition-transform hover:scale-[1.01]`}
              >
                <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 ${step.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Step {step.number}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real Balance & Conversion Policy Card */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs leading-relaxed mb-6 flex items-start gap-3 shadow-lg">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300 block mb-0.5">
              Real Balance & Ticket System
            </span>
            Game Tickets are purchased from your available wallet cash at ₹10 per ticket. Winner rewards (2 tickets) can be converted back to available cash anytime at 1 Ticket = ₹10 and withdrawn to your verified bank account.
          </div>
        </div>

        {/* Round Breakdown Mini Guide */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            5 Battle Rounds Overview
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-white p-2 rounded-xl border border-slate-100 text-center">
              <span className="font-bold text-slate-800 block">R1: Quiz</span>
              <span className="text-[10px] text-slate-500">Quick trivia</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-100 text-center">
              <span className="font-bold text-slate-800 block">R2: Pattern</span>
              <span className="text-[10px] text-slate-500">Complete sequence</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-100 text-center">
              <span className="font-bold text-slate-800 block">R3: Memory</span>
              <span className="text-[10px] text-slate-500">Recall order</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-100 text-center">
              <span className="font-bold text-slate-800 block">R4: Accuracy</span>
              <span className="text-[10px] text-slate-500">Target tap</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-100 text-center col-span-2 sm:col-span-1">
              <span className="font-bold text-slate-800 block">R5: Speed</span>
              <span className="text-[10px] text-slate-500">Fast reaction</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all transform active:scale-[0.98]"
        >
          Got it, Let's Play!
        </button>
      </div>
    </div>
  );
};
