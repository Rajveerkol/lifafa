import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Swords,
  Brain,
  Grid,
  Trophy,
  Sparkles,
  ShieldCheck,
  Flame,
  HelpCircle,
  Play,
  Lock,
  Ticket,
  Wallet,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { DuelArena } from '../components/games/DuelArena';
import { HowItWorksModal } from '../components/games/HowItWorksModal';
import { ConversionModal } from '../components/games/ConversionModal';
import { useAuth } from '../context/AuthContext';
import {
  duelService,
  TICKET_CONVERSION_RATE,
  type GameTransactionItem,
} from '../services/duelService';
import type { DuelStats } from '../types/database';
import { formatCurrency } from '../lib/utils';

export const GamesPage: React.FC = () => {
  const { user, wallet, refreshWallet } = useAuth();
  const [activeGame, setActiveGame] = useState<'NONE' | 'DUEL_EARN'>('NONE');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [stats, setStats] = useState<DuelStats | null>(null);
  const [userTickets, setUserTickets] = useState<number>(0);
  const [gameTransactions, setGameTransactions] = useState<GameTransactionItem[]>([]);
  const [txFilter, setTxFilter] = useState<'ALL' | 'CONVERSIONS' | 'DUELS'>('ALL');

  // Conversion Modal State
  const [convertModalOpen, setConvertModalOpen] = useState<boolean>(false);
  const [convertMode, setConvertMode] = useState<'CASH_TO_TICKETS' | 'TICKETS_TO_CASH'>('CASH_TO_TICKETS');

  const loadData = () => {
    const userId = user?.id || 'user_current';
    duelService.getPlayerStats(userId).then(setStats);
    duelService.getGameTickets(userId).then(setUserTickets);
    duelService.getGameTransactions(userId).then(setGameTransactions);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleOpenConversion = (mode: 'CASH_TO_TICKETS' | 'TICKETS_TO_CASH') => {
    setConvertMode(mode);
    setConvertModalOpen(true);
  };

  const filteredTransactions = gameTransactions.filter((tx) => {
    if (txFilter === 'CONVERSIONS') {
      return tx.type === 'CASH_TO_TICKETS' || tx.type === 'TICKETS_TO_CASH';
    }
    if (txFilter === 'DUELS') {
      return tx.type === 'DUEL_ENTRY' || tx.type === 'DUEL_REWARD' || tx.type === 'DUEL_REFUND';
    }
    return true;
  });

  if (activeGame === 'DUEL_EARN') {
    return (
      <div className="pb-20">
        <DuelArena
          onBackToGames={() => {
            setActiveGame('NONE');
            loadData();
            if (refreshWallet) refreshWallet();
          }}
          onOpenHowItWorks={() => setHowItWorksOpen(true)}
        />
        <HowItWorksModal
          isOpen={howItWorksOpen}
          onClose={() => setHowItWorksOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-24">
      {/* GAMES HERO HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold mb-2">
            <Gamepad2 className="w-4 h-4" />
            <span>Games Arena</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Play & Challenge
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Skill-based 1v1 challenges. Convert wallet cash to Game Tickets, compete, and redeem winnings.
          </p>
        </div>

        <button
          onClick={() => setHowItWorksOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold shadow-xs transition-all self-start sm:self-auto"
        >
          <HelpCircle className="w-4 h-4 text-amber-500" />
          <span>How It Works</span>
        </button>
      </div>

      {/* GAME BALANCE & TICKET CONVERSION HUB */}
      <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* Cash Available Balance */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/60 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                  Game Balance
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono tracking-tight block">
                  {formatCurrency(wallet?.available_balance ?? 0)}
                </span>
                <span className="text-[11px] text-slate-500">Available Wallet Cash</span>
              </div>
            </div>

            {/* Game Tickets */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/10 border border-amber-200/60 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <Ticket className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider block">
                  Game Tickets
                </span>
                <span className="text-2xl font-black text-amber-900 font-mono tracking-tight block">
                  {userTickets} Tickets
                </span>
                <span className="text-[11px] text-amber-600 font-medium">
                  ₹{TICKET_CONVERSION_RATE.toFixed(2)} = 1 Ticket
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Cash → Tickets & Tickets → Cash */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 min-w-[200px]">
            <button
              onClick={() => handleOpenConversion('CASH_TO_TICKETS')}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Cash → Tickets</span>
            </button>
            <button
              onClick={() => handleOpenConversion('TICKETS_TO_CASH')}
              className="px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span>Tickets → Cash</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Direct balance conversion: <strong>₹{TICKET_CONVERSION_RATE.toFixed(2)} = 1 Game Ticket</strong>
            </span>
          </div>
          <span>Convert game tickets back to wallet cash anytime with zero fee</span>
        </div>
      </div>

      {/* FEATURED GAME: DUEL EARN */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                Featured Game
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                Live 1v1 Skill Battles
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <span>⚔️ DUEL EARN</span>
            </h2>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Challenge an opponent in a rapid 5-round battle! Test your knowledge, pattern recognition, memory, accuracy, and reaction speed. Winner takes 2 Game Tickets (₹20 cash value).
            </p>

            {/* Quick Stats Chips */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300">Wins:</span>
                <span className="font-bold text-white font-mono">{stats?.wins ?? 3}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-slate-300">Streak:</span>
                <span className="font-bold text-white font-mono">{stats?.win_streak ?? 2}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">High Score:</span>
                <span className="font-bold text-white font-mono">{stats?.highest_score ?? 680}</span>
              </div>
            </div>

            {/* Entry & Prize Details */}
            <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Entry: 1 Game Ticket (₹10.00) &bull; Winner Reward: 2 Game Tickets (₹20.00) &bull; 100% Skill-Based
              </span>
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            {userTickets > 0 ? (
              <button
                onClick={() => setActiveGame('DUEL_EARN')}
                className="px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm shadow-xl shadow-orange-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                PLAY DUEL NOW (1 🎟️)
              </button>
            ) : (
              <button
                onClick={() => handleOpenConversion('CASH_TO_TICKETS')}
                className="px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm shadow-xl shadow-orange-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" />
                GET GAME TICKETS
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleOpenConversion('CASH_TO_TICKETS')}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/10 flex items-center justify-center gap-1.5"
              >
                <Ticket className="w-3.5 h-3.5 text-amber-400" />
                Convert
              </button>
              <button
                onClick={() => setHowItWorksOpen(true)}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/10 flex items-center justify-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Rules
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GAME TRANSACTION HISTORY */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-500" />
              Game Transaction History
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Recent ticket exchanges, duel entries, and victory rewards
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 self-start sm:self-auto">
            <button
              onClick={() => setTxFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                txFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTxFilter('CONVERSIONS')}
              className={`px-3 py-1 rounded-lg transition-all ${
                txFilter === 'CONVERSIONS' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Conversions
            </button>
            <button
              onClick={() => setTxFilter('DUELS')}
              className={`px-3 py-1 rounded-lg transition-all ${
                txFilter === 'DUELS' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Duels
            </button>
          </div>
        </div>

        {/* Transaction Items */}
        <div className="space-y-2.5">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No game transactions found.
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/60 border border-slate-100 transition-colors text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'CASH_TO_TICKETS'
                        ? 'bg-amber-100 text-amber-700'
                        : tx.type === 'TICKETS_TO_CASH'
                        ? 'bg-emerald-100 text-emerald-700'
                        : tx.type === 'DUEL_REWARD'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {tx.type === 'CASH_TO_TICKETS' ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : tx.type === 'TICKETS_TO_CASH' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : tx.type === 'DUEL_REWARD' ? (
                      <Trophy className="w-4 h-4" />
                    ) : (
                      <Swords className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 block">{tx.title}</span>
                      {tx.conversion_rate !== undefined && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                          ₹{tx.conversion_rate.toFixed(2)}/🎟️
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">{tx.description}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`font-black font-mono block ${
                      tx.tickets > 0 ? 'text-emerald-600' : 'text-slate-700'
                    }`}
                  >
                    {tx.tickets > 0 ? `+${tx.tickets}` : tx.tickets} 🎟️
                  </span>
                  {tx.amount_cash !== undefined && (
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {tx.type === 'CASH_TO_TICKETS' ? `-₹${tx.amount_cash.toFixed(2)}` : `+₹${tx.amount_cash.toFixed(2)}`}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {new Date(tx.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MORE GAMES / COMING SOON SECTION */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            More Games
          </h3>
          <span className="text-xs text-slate-400">Coming Soon</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Coming Soon: Trivia Rush */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Brain className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                <Lock className="w-3 h-3" /> Coming Soon
              </span>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900">🧠 Trivia Rush</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Solo timed sprint. Answer 10 progressive trivia questions before the clock strikes zero to multiply your game XP!
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Solo Sprint</span>
              <span>10 Questions</span>
            </div>
          </div>

          {/* Coming Soon: Lucky Grid */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Grid className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                <Lock className="w-3 h-3" /> Coming Soon
              </span>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900">🎯 Lucky Grid</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pick from a 4x4 grid of hidden mystery tiles. Uncover game tickets, streak boosters, and special achievements!
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Tile Mystery</span>
              <span>Skill Challenges</span>
            </div>
          </div>
        </div>
      </div>

      {/* FAIR PLAY & SECURITY BADGE */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <p>
          Lifafa Games are skill-based entertainment powered by server-authoritative scoring. Convert tickets to available cash anytime at ₹10.00/ticket.
        </p>
      </div>

      <HowItWorksModal
        isOpen={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />

      {/* Conversion Modal */}
      <ConversionModal
        isOpen={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        mode={convertMode}
        cashBalance={wallet?.available_balance ?? 0}
        ticketBalance={userTickets}
        onSuccess={() => {
          loadData();
          if (refreshWallet) refreshWallet();
        }}
      />
    </div>
  );
};
