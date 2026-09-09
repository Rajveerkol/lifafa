import React, { useState, useEffect } from 'react';
import {
  Gift,
  PlusCircle,
  Compass,
  ArrowRight,
  ShieldCheck,
  Send,
  Users,
  FileText,
  CreditCard,
  Headphones,
  CheckCircle2,
  Sparkles,
  Search,
} from 'lucide-react';
import { HeroWalletCard } from '../components/wallet/HeroWalletCard';
import { TelegramBanner } from '../components/common/TelegramBanner';
import { TrustBadges } from '../components/common/TrustBadges';
import { LifafaCard } from '../components/lifafa/LifafaCard';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';
import { lifafaService } from '../services/lifafaService';
import type { Lifafa } from '../types/database';

interface HomePageProps {
  onNavigate: (tab: string, extra?: any) => void;
  onOpenAuth: () => void;
  onOpenWithdraw: () => void;
  onOpenAddMoney: () => void;
  onClaimLifafa: (lifafa: Lifafa) => void;
  onShareLifafa: (lifafa: Lifafa) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onOpenAuth,
  onOpenWithdraw,
  onOpenAddMoney,
  onClaimLifafa,
  onShareLifafa,
}) => {
  const { user } = useAuth();
  const [featuredLifafas, setFeaturedLifafas] = useState<Lifafa[]>([]);
  const [quickCode, setQuickCode] = useState('');
  const [searchingCode, setSearchingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    lifafaService.getPublicLifafas().then((list) => {
      setFeaturedLifafas(list.slice(0, 4));
    });
  }, []);

  const handleQuickCodeClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCode.trim()) return;

    try {
      setSearchingCode(true);
      setCodeError(null);
      const found = await lifafaService.getLifafaByCode(quickCode.trim());
      if (found) {
        onClaimLifafa(found);
        setQuickCode('');
      } else {
        setCodeError('Lifafa not found with that code. Please check and try again.');
      }
    } catch (e: any) {
      setCodeError(e.message || 'Lookup failed');
    } finally {
      setSearchingCode(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-20 md:pb-10">
      {/* If user is logged in, show the full Dashboard matching reference screenshot media_1788926025859.png */}
      {user ? (
        <section className="space-y-4">
          {/* 1. Hero Wallet Balance Card */}
          <HeroWalletCard
            onAddMoneyClick={onOpenAddMoney}
            onWithdrawClick={onOpenWithdraw}
          />

          {/* 2. Telegram Bot Alert Banner */}
          <TelegramBanner />

          {/* 3. Action Grid (2x3 on mobile, matching media_1788926025859.png) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Lifafa replaces Games completely */}
            <div
              onClick={() => onNavigate('lifafa')}
              className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  Explore Lifafa
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Claim digital rewards</p>
              </div>
            </div>

            <div
              onClick={() => onNavigate('profile')}
              className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  Refer & Earn
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Invite friends & earn</p>
              </div>
            </div>

            <div
              onClick={() => onNavigate('wallet')}
              className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  Wallet History
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Check balance & ledger</p>
              </div>
            </div>

            <div
              onClick={() => onNavigate('wallet')}
              className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2">
                <Send className="w-5 h-5 -rotate-12" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  Transactions
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">View all transactions</p>
              </div>
            </div>

            <div
              onClick={() => onNavigate('lifafa', { action: 'create' })}
              className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-2">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  Creat Lifafa
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Gift money with tasks</p>
              </div>
            </div>

            <div
              onClick={() => onNavigate('profile')}
              className="bg-white rounded-3xl p-4 border border-slate-100 shadow-2xs hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                  Support
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Get help & support</p>
              </div>
            </div>
          </div>

          {/* 4. Trust Badges row */}
          <TrustBadges />
        </section>
      ) : (
        /* Landing Hero Section when visitor is not logged in */
        <section className="bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-xl shadow-blue-700/20">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>India's Modern Digital Gifting Platform</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Create, Share & Claim <span className="text-amber-300">Digital Lifafas</span>
            </h1>

            <p className="text-sm sm:text-base text-blue-100 leading-relaxed max-w-xl">
              Distribute digital cash rewards instantly to friends, followers, and community members. Set custom tasks, equal or lucky random allocations, with atomic financial safety.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onOpenAuth}
                className="bg-white hover:bg-slate-100 text-blue-700 font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-black/10 active:scale-98 transition-all text-sm flex items-center gap-2"
              >
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('lifafa')}
                className="bg-blue-500/40 hover:bg-blue-500/60 border border-white/20 backdrop-blur-md text-white font-bold py-3.5 px-6 rounded-2xl text-sm transition-all"
              >
                Explore Public Lifafas
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Quick Code Lookup Box */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-2xs">
        <form onSubmit={handleQuickCodeClaim} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              placeholder="Enter Lifafa Code (e.g. LF-8X92K)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono uppercase focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={searchingCode || !quickCode.trim()}
            className="w-full sm:w-auto shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/20 active:scale-98 transition-all"
          >
            {searchingCode ? 'Looking up...' : 'Claim Code'}
          </button>
        </form>
        {codeError && <p className="text-[11px] text-red-600 mt-2 pl-2">{codeError}</p>}
      </section>

      {/* Featured Public Lifafas Feed */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Active Digital Lifafas
            </h3>
            <p className="text-xs text-slate-500">Live rewards open for claims right now</p>
          </div>

          <button
            onClick={() => onNavigate('lifafa')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {featuredLifafas.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-2">
              <Gift className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Public Lifafas Right Now</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Be the first to create and share a digital cash Lifafa with your community!
            </p>
            <button
              onClick={() => onNavigate('lifafa', { action: 'create' })}
              className="mt-4 bg-blue-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs"
            >
              Create First Lifafa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {featuredLifafas.map((lifafa) => (
              <LifafaCard
                key={lifafa.id}
                lifafa={lifafa}
                onClaimClick={onClaimLifafa}
                onShareClick={onShareLifafa}
              />
            ))}
          </div>
        )}
      </section>

      {/* How it Works / Trust & Security */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-3xl p-6 sm:p-8 text-white space-y-6 shadow-md">
        <div className="text-center max-w-md mx-auto">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 bg-blue-900/50 px-3 py-1 rounded-full">
            Simple & Transparent
          </span>
          <h3 className="text-xl sm:text-2xl font-black mt-2">How Lifafa Works</h3>
          <p className="text-xs text-slate-400 mt-1">3 easy steps to share and claim digital rewards</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-4 border border-white/10 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white mx-auto flex items-center justify-center font-bold text-sm mb-2 shadow-xs">
              1
            </div>
            <h5 className="text-sm font-bold mb-1">Create Lifafa</h5>
            <p className="text-[11px] text-slate-400 leading-snug">
              Set total reward amount, number of lucky winners, and optional engagement tasks.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-4 border border-white/10 text-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white mx-auto flex items-center justify-center font-bold text-sm mb-2 shadow-xs">
              2
            </div>
            <h5 className="text-sm font-bold mb-1">Share Everywhere</h5>
            <p className="text-[11px] text-slate-400 leading-snug">
              Share link, QR code, or unique Lifafa code to Telegram, WhatsApp, and social media.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-4 border border-white/10 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white mx-auto flex items-center justify-center font-bold text-sm mb-2 shadow-xs">
              3
            </div>
            <h5 className="text-sm font-bold mb-1">Instant Wallet Credit</h5>
            <p className="text-[11px] text-slate-400 leading-snug">
              Recipients complete tasks and claim funds directly into their verified wallet.
            </p>
          </div>
        </div>
      </section>

      {/* Bots Coming Soon Teaser */}
      <section
        onClick={() => onNavigate('bots')}
        className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-all"
      >
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                Automated Gifting Bots
              </h4>
              <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full uppercase">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automate digital gifting on Telegram channels and groups automatically.
            </p>
          </div>
        </div>

        <button className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs">
          Notify Me
        </button>
      </section>

      {/* Footer */}
      <footer className="pt-6 border-t border-slate-200 text-center text-xs text-slate-400 space-y-2">
        <Logo size="sm" className="justify-center" />
        <p className="text-[11px]">
          100% Safe & Secure Indian Digital Gifting Platform. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
};
