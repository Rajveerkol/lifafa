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
  ChevronRight,
  Ticket,
} from 'lucide-react';
import { DuelArena } from '../components/games/DuelArena';
import { HowItWorksModal } from '../components/games/HowItWorksModal';
import { useAuth } from '../context/AuthContext';
import { duelService } from '../services/duelService';
import type { DuelStats } from '../types/database';

export const GamesPage: React.FC = () => {
  const { user } = useAuth();
  const [activeGame, setActiveGame] = useState<'NONE' | 'DUEL_EARN'>('NONE');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [stats, setStats] = useState<DuelStats | null>(null);

  useEffect(() => {
    const userId = user?.id || 'user_current';
    duelService.getPlayerStats(userId).then(setStats);
  }, [user]);

  if (activeGame === 'DUEL_EARN') {
    return (
      <div className="pb-20">
        <DuelArena
          onBackToGames={() => setActiveGame('NONE')}
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
            Take a break. Challenge yourself. Earn game rewards & climb the leaderboard!
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
                Live 1v1 Battles
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <span>⚔️ DUEL EARN</span>
            </h2>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Challenge a real opponent in a rapid 5-round battle! Test your knowledge, pattern recognition, memory, accuracy, and reaction speed. Server validates all scores to ensure fair play.
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

            {/* Disclaimer */}
            <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Game Tickets are promotional game credits and have no cash value. They cannot be withdrawn or converted to money.
              </span>
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              onClick={() => setActiveGame('DUEL_EARN')}
              className="px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm shadow-xl shadow-orange-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              PLAY DUEL NOW
            </button>
            <button
              onClick={() => setHowItWorksOpen(true)}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/10 flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              How It Works
            </button>
          </div>
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
                Pick from a 4x4 grid of hidden mystery tiles. Uncover bonus game tickets, streak boosters, and special achievements!
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Tile Mystery</span>
              <span>Daily Free Turns</span>
            </div>
          </div>
        </div>
      </div>

      {/* FAIR PLAY & SECURITY BADGE */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <p>
          Lifafa Games are skill-based entertainment powered by server-authoritative scoring. No real money wagering is involved.
        </p>
      </div>

      <HowItWorksModal
        isOpen={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />
    </div>
  );
};
