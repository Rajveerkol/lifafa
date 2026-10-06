import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Zap,
  ShieldCheck,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Radio,
  Lock,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BotSlot, TelegramBot } from '../types/telegramBot';
import { telegramBotService, PurchaseSlotResponse } from '../services/telegramBotService';
import { BotCard } from '../components/bots/BotCard';
import { BotPlanModal } from '../components/bots/BotPlanModal';
import { ConnectBotModal } from '../components/bots/ConnectBotModal';
import { DisconnectBotModal } from '../components/bots/DisconnectBotModal';
import { BotDetailsModal } from '../components/bots/BotDetailsModal';
import { BotUsersDashboard } from '../components/bots/BotUsersDashboard';

interface BotsPageProps {
  onOpenAuth: () => void;
}

export const BotsPage: React.FC<BotsPageProps> = ({ onOpenAuth }) => {
  const { user } = useAuth();

  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [slots, setSlots] = useState<BotSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sub-view: Active Bot for User Management (Phase 2)
  const [managingUsersBot, setManagingUsersBot] = useState<TelegramBot | null>(null);

  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [inspectingBot, setInspectingBot] = useState<TelegramBot | null>(null);
  const [disconnectingBot, setDisconnectingBot] = useState<TelegramBot | null>(null);

  // Authoritative real data loader
  const loadData = useCallback(async () => {
    if (!user) {
      setBots([]);
      setSlots([]);
      setIsLoading(false);
      return;
    }

    try {
      setFetchError(null);
      const [fetchedSlots, fetchedBots] = await Promise.all([
        telegramBotService.getBotSlots(user.id),
        telegramBotService.getBots(user.id),
      ]);
      setSlots(fetchedSlots);
      setBots(fetchedBots);

      // Keep managingUsersBot synchronized
      if (managingUsersBot) {
        const found = fetchedBots.find((b) => b.id === managingUsersBot.id);
        if (found) setManagingUsersBot(found);
      }
    } catch (err: any) {
      console.error('Failed to load bot telemetry:', err);
      setFetchError(err.message || 'Unable to load bot infrastructure.');
    } finally {
      setIsLoading(false);
    }
  }, [user, managingUsersBot]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription (Postgres Realtime triggers auto-refresh on changes)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = telegramBotService.subscribeToUserUpdates(user.id, () => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [user, loadData]);

  // Real Metric Calculations (NO FAKE STATS)
  const availableSlots = slots.filter((s) => s.status === 'AVAILABLE');
  const activeBots = bots.filter(
    (b) => b.status === 'CONNECTED' && b.connection_status === 'CONNECTED'
  );
  const totalBotsCount = bots.length;
  const offlineBotsCount = bots.filter((b) => b.status !== 'CONNECTED').length;

  const handleSlotPurchased = (newPurchase: PurchaseSlotResponse) => {
    loadData();
  };

  const handleBotConnected = (newBot: TelegramBot) => {
    loadData();
  };

  const handleBotDisconnected = (botId: string) => {
    if (managingUsersBot?.id === botId) {
      setManagingUsersBot(null);
    }
    loadData();
  };

  const handleBotUpdated = (updatedBot: TelegramBot) => {
    setBots((prev) => prev.map((b) => (b.id === updatedBot.id ? updatedBot : b)));
    if (inspectingBot?.id === updatedBot.id) {
      setInspectingBot(updatedBot);
    }
    if (managingUsersBot?.id === updatedBot.id) {
      setManagingUsersBot(updatedBot);
    }
  };

  // Unauthenticated State
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center pb-24 md:pb-12">
        <div className="relative inline-block mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 mx-auto">
            <Bot className="w-12 h-12" />
          </div>
          <span className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
            Phase 2 Live
          </span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          BOT COMMAND CENTER
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto mb-8">
          Connect, manage and monitor your Telegram automation bots and users in real time.
        </p>

        <div className="p-8 bg-white rounded-3xl border border-sky-100 shadow-xl shadow-blue-500/10 max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-lg text-slate-900">Sign in to Access Bot Automation</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Acquire bot entitlement slots, link your @BotFather bot token securely, track real Telegram users and stream live webhook events.
          </p>
          <button
            onClick={onOpenAuth}
            className="w-full bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            <span>Sign In to Continue</span>
          </button>
        </div>
      </div>
    );
  }

  // PHASE 2 SUB-VIEW: Telegram Bot User Command Center
  if (managingUsersBot) {
    return (
      <div className="max-w-6xl mx-auto py-8 sm:py-10 px-4 pb-24 md:pb-16">
        <BotUsersDashboard
          bot={managingUsersBot}
          onBack={() => setManagingUsersBot(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 sm:py-10 px-4 space-y-8 pb-24 md:pb-16 animate-in fade-in duration-300">
      
      {/* COMMAND CENTER HEADER */}
      <div className="relative bg-gradient-to-r from-blue-900 via-sky-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white overflow-hidden shadow-xl shadow-blue-900/10 border border-sky-700/30">
        {/* Futuristic Grid Accent */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-cyan-400/15 border border-cyan-300/30 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-cyan-200">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Production Engine • Phase 1 & 2 Live</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              BOT COMMAND CENTER
            </h1>
            <p className="text-xs sm:text-sm text-sky-200 max-w-xl font-medium leading-relaxed">
              Connect, manage and monitor your Telegram automation bots with real user management, server-side token encryption, and live webhooks.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setIsPlanModalOpen(true)}
              className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 border border-white/20 text-white font-extrabold text-xs sm:text-sm py-3 px-5 rounded-2xl backdrop-blur-md transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm"
            >
              <Zap className="w-4 h-4 text-cyan-300" />
              <span>Get Bot Slots</span>
            </button>

            <button
              onClick={() => {
                if (availableSlots.length === 0) {
                  setIsPlanModalOpen(true);
                } else {
                  setIsConnectModalOpen(true);
                }
              }}
              className="flex-1 md:flex-none bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-600 text-slate-950 font-black text-xs sm:text-sm py-3 px-6 rounded-2xl shadow-lg shadow-cyan-400/25 transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ CONNECT NEW BOT</span>
            </button>
          </div>
        </div>
      </div>

      {/* REAL TELEMETRY METRIC CARDS (NO FAKE DATA) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Bots */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-sky-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Bots
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {isLoading ? '...' : totalBotsCount}
            </div>
          </div>
        </div>

        {/* Connected Bots */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-sky-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Connected
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">
              {isLoading ? '...' : activeBots.length}
            </div>
          </div>
        </div>

        {/* Available Slots */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-sky-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Available Slots
            </div>
            <div className="text-xl sm:text-2xl font-black text-cyan-600">
              {isLoading ? '...' : availableSlots.length}
            </div>
          </div>
        </div>

        {/* Offline / Inactive */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-sky-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-200 shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Offline / Detached
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-700">
              {isLoading ? '...' : offlineBotsCount}
            </div>
          </div>
        </div>
      </div>

      {/* ERROR ALERT IF ANY */}
      {fetchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs font-semibold text-red-600">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={loadData}
            className="text-red-700 underline font-bold hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* CONNECTED BOTS SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Connected Telegram Bots
            </h2>
            <p className="text-xs text-slate-500">
              Active bots receiving webhooks, registering users and processing events
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            title="Refresh Realtime Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-48 bg-white rounded-3xl border border-slate-100 p-5 animate-pulse flex flex-col justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-8 bg-slate-50 rounded-xl" />
              </div>
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="bg-white rounded-3xl border border-sky-100 p-8 sm:p-12 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto border border-sky-100 shadow-inner">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                No Telegram bots connected yet
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Link your first bot using an available slot and your Telegram BotFather API token.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsPlanModalOpen(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors"
              >
                Browse Plans (From ₹99)
              </button>
              <button
                onClick={() => {
                  if (availableSlots.length === 0) {
                    setIsPlanModalOpen(true);
                  } else {
                    setIsConnectModalOpen(true);
                  }
                }}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Connect Bot</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onInspect={(b) => setInspectingBot(b)}
                onDisconnect={(b) => setDisconnectingBot(b)}
                onManageUsers={(b) => setManagingUsersBot(b)}
              />
            ))}
          </div>
        )}
      </div>

      {/* SLOTS INVENTORY SECTION */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Purchased Bot Entitlement Slots ({slots.length})
            </h2>
            <p className="text-xs text-slate-500">
              Each slot grants 1 independent Telegram bot connection
            </p>
          </div>
          <button
            onClick={() => setIsPlanModalOpen(true)}
            className="text-xs font-bold text-blue-600 hover:text-cyan-600 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add More Slots</span>
          </button>
        </div>

        {slots.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            No bot slots purchased yet. Acquire a slot starting at ₹99 to connect your Telegram bot.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {slots.map((slot) => {
              const isAvailable = slot.status === 'AVAILABLE';
              return (
                <div
                  key={slot.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        {slot.plan_name}
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        ₹{slot.plan_price}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Slot: {slot.id.slice(0, 8)}...
                    </div>
                  </div>

                  <div>
                    {isAvailable ? (
                      <button
                        onClick={() => setIsConnectModalOpen(true)}
                        className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-black uppercase px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <span>Connect</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-slate-200">
                        In Use
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALS */}
      <BotPlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSlotPurchased={handleSlotPurchased}
      />

      <ConnectBotModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        availableSlots={availableSlots}
        onOpenPlans={() => setIsPlanModalOpen(true)}
        onBotConnected={handleBotConnected}
      />

      <DisconnectBotModal
        isOpen={Boolean(disconnectingBot)}
        bot={disconnectingBot}
        onClose={() => setDisconnectingBot(null)}
        onDisconnected={handleBotDisconnected}
      />

      <BotDetailsModal
        isOpen={Boolean(inspectingBot)}
        bot={inspectingBot}
        onClose={() => setInspectingBot(null)}
        onRequestDisconnect={(b) => {
          setInspectingBot(null);
          setDisconnectingBot(b);
        }}
        onBotUpdated={handleBotUpdated}
        onManageUsers={(b) => setManagingUsersBot(b)}
      />
    </div>
  );
};
