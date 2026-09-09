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
