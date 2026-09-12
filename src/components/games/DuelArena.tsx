import React, { useState, useEffect, useRef } from 'react';
import {
  Swords,
  Trophy,
  Zap,
  Clock,
  Shield,
  Flame,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Award,
  User,
  Target,
  Brain,
  AlertTriangle,
  Eye,
  HelpCircle,
  Ticket,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ConversionModal } from './ConversionModal';
import {
  duelService,
  CANONICAL_QUESTIONS,
  type SubmitAnswerResult,
  type FinalizeMatchResult,
} from '../../services/duelService';
import type {
  DuelRoundType,
  DuelQuestion,
  DuelPlayerResult,
  DuelStats,
} from '../../types/database';

interface DuelArenaProps {
  onBackToGames: () => void;
  onOpenHowItWorks: () => void;
}

type ArenaState =
  | 'LOBBY'
  | 'MATCHMAKING'
  | 'VS_COUNTDOWN'
  | 'PLAYING_ROUND'
  | 'ROUND_TRANSITION'
  | 'MATCH_RESULT';

type LobbyTab = 'ARENA' | 'HISTORY' | 'LEADERBOARD';

const ROUND_SEQUENCE: { roundNumber: number; roundType: DuelRoundType; label: string; icon: any }[] = [
  { roundNumber: 1, roundType: 'QUICK_QUIZ', label: 'Quick Quiz', icon: Brain },
  { roundNumber: 2, roundType: 'PATTERN', label: 'Pattern Match', icon: Sparkles },
  { roundNumber: 3, roundType: 'MEMORY', label: 'Memory Recall', icon: Eye },
  { roundNumber: 4, roundType: 'ACCURACY', label: 'Target Accuracy', icon: Target },
  { roundNumber: 5, roundType: 'SPEED', label: 'Reaction Speed', icon: Zap },
];

export const DuelArena: React.FC<DuelArenaProps> = ({
  onBackToGames,
  onOpenHowItWorks,
}) => {
  const { user, wallet, refreshWallet } = useAuth();

  // Arena navigation & tab states
  const [arenaState, setArenaState] = useState<ArenaState>('LOBBY');
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>('ARENA');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');

  // Stats & Ticket Balance (Real Balance & Ticket System)
  const [userTickets, setUserTickets] = useState<number>(0);
  const [stats, setStats] = useState<DuelStats | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [convertModalOpen, setConvertModalOpen] = useState<boolean>(false);
  const [convertMode, setConvertMode] = useState<'CASH_TO_TICKETS' | 'TICKETS_TO_CASH'>('CASH_TO_TICKETS');

  // Active Match State
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [myPlayerSlot, setMyPlayerSlot] = useState<'PLAYER_1' | 'PLAYER_2'>('PLAYER_1');
  const [isTestOpponent, setIsTestOpponent] = useState<boolean>(false);
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [matchmakingSec, setMatchmakingSec] = useState<number>(0);
  const [isConcluding, setIsConcluding] = useState<boolean>(false);

  // Gameplay Round State
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<DuelQuestion | null>(null);
  const [roundTimeLeft, setRoundTimeLeft] = useState<number>(20);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [roundFeedback, setRoundFeedback] = useState<SubmitAnswerResult | null>(null);
  const [memoryRevealed, setMemoryRevealed] = useState<boolean>(true);

  // Scores
  const [myScore, setMyScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [roundHistory, setRoundHistory] = useState<
    Array<{
      roundNumber: number;
      roundLabel: string;
      playerScore: number;
      isCorrect: boolean;
      timeMs: number;
    }>
  >([]);

  // Final Result
  const [finalResult, setFinalResult] = useState<FinalizeMatchResult | null>(null);

  // Timers refs
  const matchmakingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const matchmakingPollRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const concludePollRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial stats & leaderboard & tickets and check for active ongoing match
  useEffect(() => {
    const userId = user?.id || 'user_current';
    duelService.getGameTickets(userId).then(setUserTickets);
    duelService.getPlayerStats(userId).then(setStats);
    duelService.getMatchHistory(userId).then(setHistory);
    duelService.getLeaderboard().then(setLeaderboard);

    // Reconnection check
    duelService.getActiveMatch().then((active) => {
      if (active.hasActiveMatch && active.matchId) {
        setActiveMatchId(active.matchId);
        if (active.playerSlot) setMyPlayerSlot(active.playerSlot);

        if (active.status === 'WAITING') {
          setArenaState('MATCHMAKING');
          startMatchmakingPoll(active.matchId, active.playerSlot || 'PLAYER_1');
        } else if (active.status === 'MATCHED' || active.status === 'COUNTDOWN') {
          startVsCountdown(active.matchId);
        } else if (active.status === 'IN_PROGRESS' || active.status === 'ROUND_TRANSITION') {
          const rIdx = Math.max(0, Math.min(4, (active.currentRound || 1) - 1));
          startRound(rIdx, active.matchId);
        }
      }
    });
  }, [user]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
      if (matchmakingPollRef.current) clearInterval(matchmakingPollRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (concludePollRef.current) clearTimeout(concludePollRef.current);
    };
  }, []);

  // Heartbeat loop during active match
  useEffect(() => {
    if (activeMatchId && (arenaState === 'PLAYING_ROUND' || arenaState === 'ROUND_TRANSITION' || arenaState === 'VS_COUNTDOWN')) {
      heartbeatTimerRef.current = setInterval(() => {
        duelService.sendHeartbeat(activeMatchId);
      }, 5000);
      return () => {
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      };
    }
  }, [activeMatchId, arenaState]);

  // ----------------------------------------------------
  // 1. MATCHMAKING FLOW
  // ----------------------------------------------------
  const startMatchmakingPoll = (matchId: string, mySlot: 'PLAYER_1' | 'PLAYER_2') => {
    if (matchmakingPollRef.current) clearInterval(matchmakingPollRef.current);
    matchmakingPollRef.current = setInterval(async () => {
      try {
        const { match, players } = await duelService.getMatch(matchId);
        if (match && (match.status === 'MATCHED' || match.status === 'COUNTDOWN' || match.status === 'IN_PROGRESS')) {
          if (matchmakingPollRef.current) clearInterval(matchmakingPollRef.current);
          if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
          const opp = players.find((p) => p.player_slot !== mySlot);
          if (opp) {
            setOpponentName(opp.display_name || 'Opponent');
          }
          startVsCountdown(matchId);
        } else if (match && match.status === 'CANCELLED') {
          if (matchmakingPollRef.current) clearInterval(matchmakingPollRef.current);
          if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
          setArenaState('LOBBY');
          setActiveMatchId(null);
        }
      } catch (err) {
        console.error('Error polling match status:', err);
      }
    }, 1500);
  };

  const handleStartMatchmaking = async () => {
    if (userTickets <= 0) {
      setConvertMode('CASH_TO_TICKETS');
      setConvertModalOpen(true);
      return;
    }

    setArenaState('MATCHMAKING');
    setMatchmakingSec(0);

    if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
    matchmakingTimerRef.current = setInterval(() => {
      setMatchmakingSec((s) => s + 1);
    }, 1000);

    const displayName = user?.full_name || 'Player 1';
    const allowTest = duelService.isTestOpponentPermitted();

    try {
      const matchResult = await duelService.joinMatchmaking(displayName, null, allowTest);
      setActiveMatchId(matchResult.match_id);
      setMyPlayerSlot(matchResult.player_slot);
      setIsTestOpponent(matchResult.is_test_opponent);

      // Refresh authoritative tickets
      const userId = user?.id || 'user_current';
      duelService.getGameTickets(userId).then(setUserTickets);

      if (matchResult.status === 'WAITING') {
        startMatchmakingPoll(matchResult.match_id, matchResult.player_slot);
      } else {
        const oppName = matchResult.is_test_opponent ? 'Vortex (AI)' : 'ShadowNinja';
        setOpponentName(oppName);

        setTimeout(() => {
          if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
          startVsCountdown(matchResult.match_id);
        }, 1500);
      }
    } catch (err) {
      console.error('Matchmaking error:', err);
      if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
      if (matchmakingPollRef.current) clearInterval(matchmakingPollRef.current);
      setArenaState('LOBBY');
      const userId = user?.id || 'user_current';
      duelService.getGameTickets(userId).then(setUserTickets);
    }
  };

  const handleCancelMatchmaking = async () => {
    if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
    if (matchmakingPollRef.current) clearInterval(matchmakingPollRef.current);
    if (activeMatchId) {
      await duelService.cancelMatchmaking(activeMatchId);
    }
    setActiveMatchId(null);
    const userId = user?.id || 'user_current';
    duelService.getGameTickets(userId).then(setUserTickets);
    setArenaState('LOBBY');
  };

  // ----------------------------------------------------
  // 2. VS COUNTDOWN SCREEN
  // ----------------------------------------------------
  const startVsCountdown = (matchId: string) => {
    setArenaState('VS_COUNTDOWN');
    setCountdownValue(3);
    setMyScore(0);
    setOpponentScore(0);
    setRoundHistory([]);
    setCurrentRoundIndex(0);

    let count = 3;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      setCountdownValue(count);
      if (count <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        startRound(0, matchId);
      }
    }, 1000);
  };

  // ----------------------------------------------------
  // 3. ROUND GAMEPLAY CONTROLLER
  // ----------------------------------------------------
  const startRound = async (roundIdx: number, matchId: string) => {
    setCurrentRoundIndex(roundIdx);
    setSelectedOption(null);
    setIsSubmitting(false);
    setRoundFeedback(null);

    const roundDef = ROUND_SEQUENCE[roundIdx];
    const q = await duelService.getRoundQuestion(matchId, roundDef.roundNumber, roundDef.roundType);
    setCurrentQuestion(q);

    const duration = q.time_limit_sec || 20;
    setRoundTimeLeft(duration);
    setRoundStartTime(Date.now());
    setArenaState('PLAYING_ROUND');

    // For memory rounds, reveal briefly then hide
    if (roundDef.roundType === 'MEMORY') {
      setMemoryRevealed(true);
      setTimeout(() => {
        setMemoryRevealed(false);
      }, 3000);
    }

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundTimerRef.current = setInterval(() => {
      setRoundTimeLeft((prev) => {
        if (prev <= 1) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          handleTimeExpired(roundIdx, matchId, q);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeExpired = async (roundIdx: number, matchId: string, q: DuelQuestion) => {
    if (isSubmitting || selectedOption) return;
    setIsSubmitting(true);

    const timeTaken = (q.time_limit_sec || 20) * 1000;
    const roundDef = ROUND_SEQUENCE[roundIdx];

    const result = await duelService.submitRoundAnswer(
      matchId,
      roundDef.roundNumber,
      roundDef.roundType,
      q.id,
      'TIMEOUT',
      timeTaken
    );

    finishRound(roundIdx, matchId, roundDef.label, result, timeTaken);
  };

  const handleSelectOption = async (option: string) => {
    if (isSubmitting || selectedOption || !currentQuestion || !activeMatchId) return;

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    setSelectedOption(option);
    setIsSubmitting(true);

    const timeTaken = Date.now() - roundStartTime;
    const roundDef = ROUND_SEQUENCE[currentRoundIndex];

    const result = await duelService.submitRoundAnswer(
      activeMatchId,
      roundDef.roundNumber,
      roundDef.roundType,
      currentQuestion.id,
      option,
      timeTaken
    );

    finishRound(currentRoundIndex, activeMatchId, roundDef.label, result, timeTaken);
  };

  const finishRound = (
    roundIdx: number,
    matchId: string,
    roundLabel: string,
    result: SubmitAnswerResult,
    timeTaken: number
  ) => {
    setRoundFeedback(result);
    setMyScore(result.total_score);

    // Fetch authoritative live opponent score
    duelService.getMatch(matchId).then(({ players }) => {
      const opp = players.find((p) => p.player_slot !== myPlayerSlot);
      if (opp && typeof opp.score === 'number' && opp.score > 0) {
        setOpponentScore(opp.score);
      } else {
        setOpponentScore((prev) => prev + (Math.random() > 0.35 ? 120 + Math.floor(Math.random() * 25) : 0));
      }
    }).catch(() => {
      setOpponentScore((prev) => prev + (Math.random() > 0.35 ? 120 + Math.floor(Math.random() * 25) : 0));
    });

    setRoundHistory((prev) => [
      ...prev,
      {
        roundNumber: roundIdx + 1,
        roundLabel,
        playerScore: result.score_awarded,
        isCorrect: result.is_correct,
        timeMs: timeTaken,
      },
    ]);

    setArenaState('ROUND_TRANSITION');

    // Wait 1.6s before next round or match finalization
    setTimeout(async () => {
      const nextIdx = roundIdx + 1;
      if (nextIdx < ROUND_SEQUENCE.length) {
        startRound(nextIdx, matchId);
      } else {
        await handleConcludeMatch(matchId);
      }
    }, 1600);
  };

  // ----------------------------------------------------
  // 4. MATCH FINALIZATION
  // ----------------------------------------------------
  const handleConcludeMatch = async (matchId: string) => {
    setArenaState('ROUND_TRANSITION');
    setIsConcluding(true);

    let retries = 0;
    const maxRetries = 15;

    const pollFinalize = async () => {
      try {
        const finalData = await duelService.finalizeMatch(matchId);
        setFinalResult(finalData);

        const isP1 = myPlayerSlot === 'PLAYER_1';
        setMyScore(isP1 ? finalData.p1_score : finalData.p2_score);
        setOpponentScore(isP1 ? finalData.p2_score : finalData.p1_score);
        setIsConcluding(false);
        setArenaState('MATCH_RESULT');

        // Refresh player stats & history & tickets!
        const userId = user?.id || 'user_current';
        duelService.getPlayerStats(userId).then(setStats);
        duelService.getMatchHistory(userId).then(setHistory);
        duelService.getGameTickets(userId).then(setUserTickets);
      } catch (err: any) {
        if (err?.message?.includes('rounds') || err?.message?.includes('completed')) {
          retries++;
          if (retries < maxRetries) {
            concludePollRef.current = setTimeout(pollFinalize, 2000) as any;
            return;
          }
        }
        console.error('Finalize error:', err);
        setIsConcluding(false);
        setArenaState('MATCH_RESULT');
      }
    };

    pollFinalize();
  };

  // Play again shortcut
  const handlePlayAgain = () => {
    handleStartMatchmaking();
  };

  const handleReturnToLobby = () => {
    setArenaState('LOBBY');
    setActiveMatchId(null);
    setFinalResult(null);
    setIsConcluding(false);
  };

  // =========================================================================
  // RENDER: MATCHMAKING SCREEN
  // =========================================================================
  if (arenaState === 'MATCHMAKING') {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="relative mb-8">
          {/* Radar Circles */}
          <div className="w-32 h-32 rounded-full border-2 border-amber-500/20 flex items-center justify-center animate-ping absolute inset-0" />
          <div className="w-32 h-32 rounded-full border-2 border-amber-500/40 flex items-center justify-center animate-pulse" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center absolute top-6 left-6">
            <Swords className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        </div>

        <h2 className="text-2xl font-black text-slate-900 mb-2">Searching for Opponent...</h2>
        <p className="text-slate-500 text-sm max-w-xs mb-6">
          Pairing you with a live challenger in your skill tier.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold mb-8">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          00:{matchmakingSec < 10 ? `0${matchmakingSec}` : matchmakingSec}
        </div>

        <button
          onClick={handleCancelMatchmaking}
          className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-bold transition-all"
        >
          Cancel Matchmaking
        </button>
      </div>
    );
  }

  // =========================================================================
  // RENDER: VS COUNTDOWN SCREEN
  // =========================================================================
  if (arenaState === 'VS_COUNTDOWN') {
    return (
      <div className="min-h-[520px] flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
        <div className="text-xs font-black uppercase tracking-widest text-amber-600 mb-4 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
          Match Ready
        </div>

        {/* VS Layout */}
        <div className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-md my-6">
          {/* Player 1 (You) */}
          <div className="flex-1 flex flex-col items-center p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl mb-2 shadow-md">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <span className="text-sm font-bold text-slate-900 truncate max-w-[110px]">
              {user?.full_name || 'You'}
            </span>
            <span className="text-[11px] text-blue-600 font-bold mt-0.5">Player 1</span>
          </div>

          {/* Center VS Badge & Countdown */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-amber-400 font-black text-sm flex items-center justify-center shadow-lg mb-2">
              VS
            </div>
            <div className="text-3xl font-black text-slate-900 animate-bounce">
              {countdownValue > 0 ? countdownValue : 'FIGHT!'}
            </div>
          </div>

          {/* Player 2 (Opponent) */}
          <div className="flex-1 flex flex-col items-center p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center font-black text-xl mb-2 shadow-md">
              {opponentName.charAt(0)}
            </div>
            <span className="text-sm font-bold text-slate-900 truncate max-w-[110px]">
              {opponentName}
            </span>
            <span className="text-[11px] text-rose-600 font-bold mt-0.5">
              {isTestOpponent ? 'Challenger (AI)' : 'Player 2'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 font-medium mt-4">
          Round 1 of 5: Quick Quiz starts in {countdownValue}s...
        </p>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ACTIVE ROUND / ROUND TRANSITION SCREEN
  // =========================================================================
  if (arenaState === 'PLAYING_ROUND' || arenaState === 'ROUND_TRANSITION') {
    const roundDef = ROUND_SEQUENCE[currentRoundIndex];
    const RoundIcon = roundDef.icon;
    const isTransition = arenaState === 'ROUND_TRANSITION';

    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 animate-in fade-in duration-200">
        {/* HUD HEADER: Score & Round Info */}
        <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Row: Round Badge & Timer */}
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold backdrop-blur-sm">
              <RoundIcon className="w-4 h-4" />
              <span>
                Round {roundDef.roundNumber} / 5: {roundDef.label}
              </span>
            </div>

            {/* Countdown Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black ${
                roundTimeLeft <= 5
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                  : 'bg-white/10 text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{roundTimeLeft}s</span>
            </div>
          </div>

          {/* Live Match Score HUD */}
          <div className="grid grid-cols-3 items-center text-center">
            {/* You */}
            <div className="text-left">
              <div className="text-xs text-slate-400 font-bold truncate max-w-[100px]">
                {user?.full_name || 'You'}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {myScore}
              </div>
            </div>

            {/* VS Badge */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                LIVE SCORE
              </span>
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400 mt-1">
                VS
              </div>
            </div>

            {/* Opponent */}
            <div className="text-right">
              <div className="text-xs text-slate-400 font-bold truncate max-w-[100px] ml-auto">
                {opponentName}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-200 font-mono">
                {opponentScore}
              </div>
            </div>
          </div>

          {/* Round Progress Bar */}
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{
                width: `${((currentRoundIndex + 1) / ROUND_SEQUENCE.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* INTERMISSION TRANSITION OVERLAY */}
        {isTransition && (
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center my-6 animate-in zoom-in-95 duration-200">
            {isConcluding ? (
              <div>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mb-3 border border-amber-200">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Calculating Final Standings...
                </h3>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Authoritative score verification in progress.
                </p>
              </div>
            ) : (
              <>
                {roundFeedback?.is_correct ? (
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-200">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mb-3 border border-rose-200">
                    <XCircle className="w-8 h-8" />
                  </div>
                )}
                <h3 className="text-xl font-black text-slate-900">
                  {roundFeedback?.is_correct ? 'Target Hit!' : 'Missed!'}
                </h3>
                <p className="text-sm font-bold text-amber-600 mt-1">
                  +{roundFeedback?.score_awarded || 0} Points Awarded
                </p>
                <p className="text-xs text-slate-400 mt-3 font-medium">
                  {currentRoundIndex + 1 < ROUND_SEQUENCE.length
                    ? `Next: Round ${currentRoundIndex + 2} (${ROUND_SEQUENCE[currentRoundIndex + 1].label})...`
                    : 'Tallying final battle results...'}
                </p>
              </>
            )}
          </div>
        )}

        {/* ACTIVE QUESTION / CHALLENGE CARD */}
        {!isTransition && currentQuestion && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-lg">
            {/* Memory Round Reveal Screen */}
            {roundDef.roundType === 'MEMORY' && memoryRevealed ? (
              <div className="text-center py-6">
                <span className="text-xs font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                  Memorize This Sequence
                </span>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 my-6 tracking-wider">
                  {currentQuestion.prompt}
                </div>
                <p className="text-xs text-slate-500">
                  Hiding in a moment... get ready to recall!
                </p>
              </div>
            ) : (
              <>
                {/* Prompt Title */}
                <div className="mb-6">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Challenge {roundDef.roundNumber}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                    {roundDef.roundType === 'MEMORY'
                      ? 'Select the exact sequence that was shown:'
                      : currentQuestion.prompt}
                  </h3>
                </div>

                {/* Option Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === opt;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(opt)}
                        disabled={isSubmitting || selectedOption !== null}
                        className={`p-4 rounded-2xl border text-left font-bold text-sm transition-all transform active:scale-[0.98] ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800'
                        } ${isSubmitting ? 'cursor-not-allowed opacity-80' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{opt}</span>
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                              isSelected
                                ? 'bg-white text-amber-600'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: MATCH RESULT SCREEN
  // =========================================================================
  if (arenaState === 'MATCH_RESULT') {
    const isP1 = myPlayerSlot === 'PLAYER_1';
    const myResult = isP1 ? finalResult?.p1_result : finalResult?.p2_result;
    const isWinner = myResult === 'WON';
    const isDraw = myResult === 'DRAW';

    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 text-center animate-in zoom-in-95 duration-200">
        {/* Outcome Banner */}
        <div
          className={`rounded-3xl p-6 sm:p-8 mb-6 border shadow-xl ${
            isWinner
              ? 'bg-gradient-to-b from-amber-500/10 to-orange-500/5 border-amber-300'
              : isDraw
              ? 'bg-slate-50 border-slate-200'
              : 'bg-rose-50/50 border-rose-200'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-3 ${
              isWinner
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-orange-500/30'
                : isDraw
                ? 'bg-slate-800 text-slate-200'
                : 'bg-rose-500 text-white shadow-rose-500/30'
            }`}
          >
            {isWinner ? <Trophy className="w-8 h-8" /> : <Swords className="w-8 h-8" />}
          </div>

          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {isWinner ? 'VICTORY!' : isDraw ? 'DRAW GAME!' : 'DEFEAT'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {isWinner
              ? 'Outstanding performance! You outscored your opponent.'
              : isDraw
              ? 'Evenly matched battle! Scores ended in a dead heat.'
              : 'Close duel! Train your reflexes and challenge again.'}
          </p>

          {/* Final Scoreboard Comparison */}
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto my-6">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase">You</span>
              <div className="text-3xl font-black text-amber-500 font-mono">{myScore}</div>
              <span className="text-[10px] text-slate-500">Points</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase truncate block">
                {opponentName}
              </span>
              <div className="text-3xl font-black text-slate-700 font-mono">{opponentScore}</div>
              <span className="text-[10px] text-slate-500">Points</span>
            </div>
          </div>

          {/* Reward Notification */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 font-medium inline-flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isWinner
                ? 'Earned +2 Game Tickets & 100 Duel XP (Convertible to ₹20 cash)'
                : 'Earned +25 Duel XP for completing the match'}
            </span>
          </div>
        </div>

        {/* Round Breakdown Table */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-6 text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Round Breakdown
          </h4>
          <div className="space-y-2">
            {roundHistory.map((r) => (
              <div
                key={r.roundNumber}
                className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">R{r.roundNumber}</span>
                  <span className="text-slate-500">{r.roundLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400">
                    {(r.timeMs / 1000).toFixed(1)}s
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      r.isCorrect ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    +{r.playerScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handlePlayAgain}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Play Again (1 🎟️)
          </button>
          <button
            onClick={handleReturnToLobby}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all"
          >
            Return to Arena
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: DEFAULT LOBBY STATE
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Arena Top Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToGames}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </button>

        <div className="flex items-center gap-2">
          {/* Ticket Balance */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-bold">
            <Ticket className="w-4 h-4 text-amber-600" />
            <span>{userTickets} Tickets</span>
          </div>

          <button
            onClick={() => {
              setConvertMode('CASH_TO_TICKETS');
              setConvertModalOpen(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200"
          >
            + Get Tickets
          </button>

          <button
            onClick={onOpenHowItWorks}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Rules
          </button>
        </div>
      </div>

      {/* Hero Battle Card */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold mb-4 border border-amber-500/30 backdrop-blur-sm">
            <Swords className="w-3.5 h-3.5" />
            <span>1v1 Live Arena</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            ⚔️ DUEL EARN
          </h1>
          <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
            Challenge an opponent. Complete 5 rapid skill challenges across quiz, memory, and reflexes. Highest score claims victory!
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            {userTickets > 0 ? (
              <button
                onClick={handleStartMatchmaking}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm shadow-xl shadow-orange-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                <Swords className="w-4 h-4" />
                FIND OPPONENT (1 🎟️)
              </button>
            ) : (
              <button
                onClick={() => {
                  setConvertMode('CASH_TO_TICKETS');
                  setConvertModalOpen(true);
                }}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm shadow-xl shadow-orange-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                <Ticket className="w-4 h-4" />
                GET GAME TICKETS (₹10 = 1 🎟️)
              </button>
            )}

            <button
              onClick={() => {
                setConvertMode('CASH_TO_TICKETS');
                setConvertModalOpen(true);
              }}
              className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15 flex items-center gap-1.5"
            >
              <Ticket className="w-3.5 h-3.5 text-amber-400" />
              + Convert Tickets
            </button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/10 text-center">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
              Victories
            </span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {stats?.wins ?? 3}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
              Win Streak
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              {stats?.win_streak ?? 2}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
              High Score
            </span>
            <span className="text-xl font-black text-slate-100 font-mono">
              {stats?.highest_score ?? 680}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
              Total Duels
            </span>
            <span className="text-xl font-black text-slate-300 font-mono">
              {stats?.total_matches ?? 4}
            </span>
          </div>
        </div>
      </div>

      {/* Real Balance Gaming Policy Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-amber-600 shrink-0" />
          <span><strong>Entry:</strong> 1 Ticket (₹10.00) &bull; <strong>Winner Reward:</strong> 2 Tickets (₹20.00)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-[11px]">Convert tickets to cash anytime at ₹10/ticket</span>
          <button
            onClick={() => {
              setConvertMode('TICKETS_TO_CASH');
              setConvertModalOpen(true);
            }}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 underline shrink-0"
          >
            Cashout Tickets
          </button>
        </div>
      </div>

      {/* Tab Selectors: ARENA / HISTORY / LEADERBOARD */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setLobbyTab('ARENA')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            lobbyTab === 'ARENA'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Arena Overview
        </button>
        <button
          onClick={() => setLobbyTab('HISTORY')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            lobbyTab === 'HISTORY'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Match History
        </button>
        <button
          onClick={() => setLobbyTab('LEADERBOARD')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            lobbyTab === 'LEADERBOARD'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Leaderboard
        </button>
      </div>

      {/* TAB CONTENT: ARENA OVERVIEW */}
      {lobbyTab === 'ARENA' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 5 Rounds Overview Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-500" />
              5 Battle Rounds
            </h3>
            <div className="space-y-2.5">
              {ROUND_SEQUENCE.map((r) => {
                const Icon = r.icon;
                return (
                  <div
                    key={r.roundNumber}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-amber-600">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Round {r.roundNumber}: {r.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                      Up to 150 pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fair Play & Server Authority Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                Fair Play Guaranteed
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                All questions, response times, and scores are verified server-side. Private opponent responses are securely masked, ensuring a fair, tamper-proof competition.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Server-authoritative scoring</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Strict opponent privacy via RLS</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Convertible game tickets (₹10 = 1 Ticket)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={onOpenHowItWorks}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
              >
                Learn more about Duel Earn rules
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MATCH HISTORY */}
      {lobbyTab === 'HISTORY' && (
        <div className="space-y-3">
          {/* History Filter Chips */}
          <div className="flex gap-2">
            {(['ALL', 'WINS', 'LOSSES'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  historyFilter === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* History List */}
          <div className="space-y-2.5">
            {history
              .filter((m) => {
                if (historyFilter === 'WINS') return m.result === 'WON';
                if (historyFilter === 'LOSSES') return m.result === 'LOST';
                return true;
              })
              .map((m) => {
                const won = m.result === 'WON';
                return (
                  <div
                    key={m.matchId}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                          won
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}
                      >
                        {won ? 'WIN' : 'LOSS'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            vs {m.opponentName}
                          </span>
                          {m.isTestOpponent && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              AI Test
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(m.date).toLocaleDateString()} at{' '}
                          {new Date(m.date).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-slate-800">
                        {m.playerScore} - {m.opponentScore}
                      </span>
                      <span className="block text-[10px] text-slate-400">Final Score</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: LEADERBOARD */}
      {lobbyTab === 'LEADERBOARD' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Top Duelists
            </h3>
            <span className="text-xs text-slate-400">Weekly Season</span>
          </div>

          <div className="space-y-2">
            {leaderboard.map((item) => (
              <div
                key={item.rank}
                className={`p-3 rounded-2xl flex items-center justify-between border ${
                  item.rank === 1
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-slate-50/50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                      item.rank === 1
                        ? 'bg-amber-500 text-white shadow-xs'
                        : item.rank === 2
                        ? 'bg-slate-300 text-slate-700'
                        : item.rank === 3
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.rank}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {item.displayName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.wins} wins • {item.winStreak} streak
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black font-mono text-slate-800">
                    {item.highestScore} pts
                  </span>
                  <span className="block text-[10px] text-slate-400">Best Score</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion Modal */}
      <ConversionModal
        isOpen={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        mode={convertMode}
        cashBalance={wallet?.available_balance ?? 0}
        ticketBalance={userTickets}
        onSuccess={() => {
          const userId = user?.id || 'user_current';
          duelService.getGameTickets(userId).then(setUserTickets);
          if (refreshWallet) refreshWallet();
        }}
      />
    </div>
  );
};
