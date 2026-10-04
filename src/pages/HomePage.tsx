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
import { QuickActionCard } from '../components/dashboard/QuickActionCard';
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
  const [myClaimedMap, setMyClaimedMap] = useState<Map<string, number>>(new Map());
  const [quickCode, setQuickCode] = useState('');
  const [searchingCode, setSearchingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    lifafaService.getPublicLifafas().then((list) => {
      setFeaturedLifafas(list.slice(0, 4));
    });
  }, []);

  useEffect(() => {
    if (user) {
      lifafaService.getMyClaimedLifafas(user.id).then((claims) => {
        const map = new Map<string, number>();
        for (const c of claims) {
          if (c.lifafa_id) {
            map.set(c.lifafa_id, c.amount);
          }
        }
        setMyClaimedMap(map);
      });
    } else {
      setMyClaimedMap(new Map());
    }
  }, [user]);

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
    <div className="relative space-y-5 sm:space-y-6 pb-20 md:pb-10 overflow-x-clip">
      {/* Ambient background spotlights for subtle 3D lighting depth (contained to prevent horizontal overflow) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-10 left-1/4 w-96 h-96 bg-blue-400/5 rounded-full blur-3xl" />
        <div className="absolute top-72 right-4 w-80 h-80 bg-indigo-400/5 rounded-full blur-3xl" />
      </div>

      {/* If user is logged in, show the full Flagship Dashboard */}
      {user ? (
        <section className="space-y-4">
          {/* 1. Hero 3D Wallet Balance Card (Flagship Element) */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <HeroWalletCard
              onAddMoneyClick={onOpenAddMoney}
              onWithdrawClick={onOpenWithdraw}
            />
          </div>

          {/* 2. Telegram Bot Alert Banner with live notification pulse */}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
            <TelegramBanner />
          </div>

          {/* 3. Action Grid (2x3 on mobile, 3x2 on tablet/desktop) with 3D Interactive QuickActionCards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 animate-in fade-in duration-500 delay-150">
            <QuickActionCard
              icon={Gift}
              title="Explore Lifafa"
              subtitle="Claim digital rewards"
              onClick={() => onNavigate('lifafa')}
              iconBgColor="bg-purple-50"
              iconTextColor="text-purple-600"
              index={0}
            />

            <QuickActionCard
              icon={Users}
              title="Refer & Earn"
              subtitle="Invite friends & earn"
              onClick={() => onNavigate('profile')}
              iconBgColor="bg-amber-50"
              iconTextColor="text-amber-600"
              index={1}
            />

            <QuickActionCard
              icon={FileText}
              title="Wallet History"
              subtitle="Check balance & ledger"
              onClick={() => onNavigate('wallet')}
              iconBgColor="bg-blue-50"
              iconTextColor="text-blue-600"
              index={2}
            />

            <QuickActionCard
              icon={Send}
              title="Transactions"
              subtitle="View all transactions"
              onClick={() => onNavigate('wallet')}
              iconBgColor="bg-sky-50"
              iconTextColor="text-sky-600"
              index={3}
            />

            <QuickActionCard
              icon={PlusCircle}
              title="Create Lifafa"
              subtitle="Gift money with tasks"
              onClick={() => onNavigate('lifafa', { action: 'create' })}
              iconBgColor="bg-emerald-50"
              iconTextColor="text-emerald-600"
              badge="Popular"
              index={4}
            />

            <QuickActionCard
              icon={Headphones}
              title="Support"
              subtitle="Get help & support"
              onClick={() => onNavigate('profile')}
              iconBgColor="bg-indigo-50"
              iconTextColor="text-indigo-600"
              index={5}
            />
          </div>

          {/* 4. Trust Badges row */}
          <div className="animate-in fade-in duration-500 delay-200">
            <TrustBadges />
          </div>
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
      <section className="group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/20 rounded-3xl p-4 sm:p-5 border border-slate-100/90 hover:border-blue-200/80 shadow-2xs hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-black text-slate-800 tracking-tight">Quick Lifafa Claim</span>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">• Have a code from friends or Telegram?</span>
        </div>
        <form onSubmit={handleQuickCodeClaim} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-hover:text-blue-500" />
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              placeholder="Enter Lifafa Code (e.g. LF-8X92K)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono uppercase tracking-wider focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={searchingCode || !quickCode.trim()}
            className="w-full sm:w-auto shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-2.5 px-6 rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {searchingCode ? 'Looking up...' : 'Claim Code'}
          </button>
        </form>
        {codeError && <p className="text-[11px] text-red-600 mt-2 pl-2 font-medium">{codeError}</p>}
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
                isClaimed={myClaimedMap.has(lifafa.id)}
                claimedAmount={myClaimedMap.get(lifafa.id)}
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
        className="group relative overflow-hidden bg-gradient-to-r from-indigo-50/80 via-blue-50/70 to-purple-50/60 border border-blue-100/80 hover:border-blue-200 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300"
      >
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:-rotate-3 transition-transform duration-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h4 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                Automated Gifting Bots
              </h4>
              <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automate digital gifting on Telegram channels and groups automatically.
            </p>
          </div>
        </div>

        <button className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 px-5 rounded-xl shadow-md shadow-blue-500/20 group-hover:shadow-lg active:scale-95 transition-all cursor-pointer">
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
