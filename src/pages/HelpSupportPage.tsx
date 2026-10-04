import React, { useState } from 'react';
import {
  Headphones,
  ArrowLeft,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Gift,
  Wallet,
  Send,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface HelpSupportPageProps {
  onBack: () => void;
  onNavigate?: (tab: string) => void;
}

interface FaqItem {
  question: string;
  category: string;
  answer: string;
}

export const HelpSupportPage: React.FC<HelpSupportPageProps> = ({ onBack, onNavigate }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const faqs: FaqItem[] = [
    {
      category: 'CREATING',
      question: 'How do I create a Lifafa giveaway?',
      answer:
        'To create a Lifafa, tap "Create" or "+" from your dashboard. Choose whether to distribute rewards EQUALLY among all winners or randomly (LUCKY / RANDOM). Configure the total amount and number of winners. You can also attach required social tasks, such as joining your verified Telegram channel.',
    },
    {
      category: 'CLAIMING',
      question: 'How do claimants receive their money?',
      answer:
        'When a user claims a Lifafa, the funds are instantly credited to their Lifafa platform wallet. The user can then withdraw their funds to any valid UPI ID or Indian bank account at any time with zero withdrawal friction.',
    },
    {
      category: 'TELEGRAM',
      question: 'How does Telegram channel verification work?',
      answer:
        'When creating a Lifafa with a Telegram task, you add our official bot (@createlifafa_bot) as an administrator in your channel with invite link permissions. Claimants verify membership with one click: they open the bot via a secure deep link, tap START, and our server confirms their membership before releasing the reward.',
    },
    {
      category: 'DEPOSITS',
      question: 'How do I deposit money into my wallet?',
      answer:
        'Go to your Wallet and tap "Deposit Funds". Pay the exact amount via your preferred UPI app (Google Pay, PhonePe, Paytm, BHIM) to the platform UPI ID or scan the QR code. Once payment succeeds, enter the 12-digit UTR / Transaction Reference number. The admin reviews and credits your wallet.',
    },
    {
      category: 'WITHDRAWALS',
      question: 'How long do withdrawals take?',
      answer:
        'Withdrawal requests are submitted to platform administrators for verification. Once reviewed, payments are dispatched directly to the bank account or UPI ID provided in your withdrawal request.',
    },
    {
      category: 'SECURITY',
      question: 'What happens if not all winners claim a Lifafa?',
      answer:
        'As long as the Lifafa is active, claimants can claim their share. If you ever need to cancel an uncompleted Lifafa (and cancellation was enabled during creation), you can cancel it from your Lifafa dashboard to instantly refund all remaining unclaimed balance back to your wallet.',
    },
  ];

  const categories = [
    { id: 'ALL', label: 'All Topics' },
    { id: 'CREATING', label: 'Creating' },
    { id: 'CLAIMING', label: 'Claiming' },
    { id: 'TELEGRAM', label: 'Telegram Tasks' },
    { id: 'DEPOSITS', label: 'Deposits & Wallet' },
  ];

  const filteredFaqs =
    selectedCategory === 'ALL'
      ? faqs
      : faqs.filter((f) => f.category === selectedCategory);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Headphones className="w-6 h-6 text-blue-600" />
            <span>Help & Support</span>
          </h2>
          <p className="text-xs text-slate-500">
            Frequently asked questions, task guides, and platform assistance
          </p>
        </div>
      </div>

      {/* Flagship Animated Telegram Support Card */}
      <a
        href="https://t.me/createlifafa_support"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Direct Telegram Support @createlifafa_support"
        className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-white via-blue-50/40 to-sky-50/20 border border-blue-100/90 shadow-lg shadow-blue-500/8 hover:shadow-xl hover:shadow-blue-500/15 hover:border-blue-300 transition-all duration-300 active:scale-[0.985] cursor-pointer no-underline motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
      >
        {/* Ambient Subtle Glow Orbs */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-blue-400/15 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-400/25 transition-all duration-500"></div>
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-sky-300/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            {/* 3D Floating Telegram Brand Icon */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-[#0088cc] via-[#179cde] to-[#37aee2] text-white flex items-center justify-center shadow-lg shadow-[#0088cc]/30 group-hover:scale-105 group-hover:rotate-2 transition-transform duration-300 motion-safe:animate-bounce-gentle">
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 fill-white -translate-x-0.5 translate-y-0.5 drop-shadow-xs"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </div>
              {/* Online pulse indicator */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
            </div>

            {/* Support Information */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200/70 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-blue-700 uppercase tracking-wider shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Official Support</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500 group-hover:text-blue-600 transition-colors">
                  @createlifafa_support
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Need Help?
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-snug">
                  हमारी support team से सीधे बात करें
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="sm:shrink-0 flex items-center justify-end pt-1 sm:pt-0">
            <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 group-hover:from-blue-700 group-hover:to-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-md shadow-blue-500/25 group-hover:shadow-blue-500/40 group-hover:scale-[1.02] transition-all duration-200">
              <Send className="w-3.5 h-3.5 -rotate-12 group-hover:translate-x-0.5 transition-transform" />
              <span>Chat with Support</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </a>

      {/* Official In-Platform Support Card */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-blue-600/15">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Platform Support Desk</span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight">
              Need assistance with your account?
            </h3>
            <p className="text-xs text-blue-100 leading-relaxed">
              If you have inquiries regarding deposits, UTR verification, withdrawals, or community giveaways, you can contact support through the platform. Our administration team reviews all inquiries promptly.
            </p>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id)}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === c.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* FAQs Accordion List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openFaqIndex === idx;
          return (
            <div key={idx} className="transition-colors">
              <button
                type="button"
                onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
              >
                <span className="text-xs sm:text-sm font-bold text-slate-900 pr-4">
                  {faq.question}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 text-xs text-slate-600 leading-relaxed bg-slate-50/50">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          onClick={() => onNavigate && onNavigate('wallet')}
          className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-900">Wallet & Deposits</h5>
            <p className="text-[11px] text-slate-500">Check balance & deposit funds</p>
          </div>
        </div>

        <div
          onClick={() => onNavigate && onNavigate('lifafa')}
          className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-900">Explore Lifafas</h5>
            <p className="text-[11px] text-slate-500">View active community giveaways</p>
          </div>
        </div>
      </div>
    </div>
  );
};
