import React, { useState, useEffect } from 'react';
import {
  X,
  Bot,
  Activity,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Trash2,
  ExternalLink,
  MessageSquare,
  Users,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { TelegramBot, TelegramBotEvent } from '../../types/telegramBot';
import { telegramBotService } from '../../services/telegramBotService';
import { BOT_PLANS, BotPlanPrice } from '../../utils/botFeatureEntitlements';

interface BotDetailsModalProps {
  isOpen: boolean;
  bot: TelegramBot | null;
  onClose: () => void;
  onRequestDisconnect: (bot: TelegramBot) => void;
  onBotUpdated: (updatedBot: TelegramBot) => void;
  onManageUsers?: (bot: TelegramBot) => void;
}

export const BotDetailsModal: React.FC<BotDetailsModalProps> = ({
  isOpen,
  bot,
  onClose,
  onRequestDisconnect,
  onBotUpdated,
  onManageUsers,
}) => {
  const [events, setEvents] = useState<TelegramBotEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !bot) return;

    let isMounted = true;
    setIsLoadingEvents(true);

    // 1. Load initial real events
    telegramBotService
      .getBotEvents(bot.id, 25)
      .then((data) => {
        if (isMounted) setEvents(data);
      })
      .finally(() => {
        if (isMounted) setIsLoadingEvents(false);
      });

    // 2. Realtime listener for incoming events
    const unsubscribe = telegramBotService.subscribeToBotEvents(bot.id, (newEvent: TelegramBotEvent) => {
      if (isMounted) {
        setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen, bot]);

  if (!isOpen || !bot) return null;

  const handleSyncHealth = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await telegramBotService.syncBotHealth(bot.id);
      if (res.success && res.bot) {
        onBotUpdated(res.bot);
        setSyncStatus('Telegram health check confirmed OK!');
      } else {
        setSyncStatus(res.error || 'Health check reported degradation');
      }
    } catch (err: any) {
      setSyncStatus(err.message || 'Health check failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' + date.toLocaleDateString() + ')';
  };

  const planPrice = Number(bot.plan_price || bot.bot_slot?.plan_price || 99);
  const currentPlan = BOT_PLANS[planPrice as BotPlanPrice] || BOT_PLANS[99];

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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-lg tracking-tight">{bot.telegram_display_name}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  bot.status === 'CONNECTED'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                    : 'bg-slate-500/20 text-slate-200 border-slate-400/40'
                }`}>
                  {bot.status}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  {currentPlan.badge}
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                @{bot.telegram_username} • Telegram ID: {bot.telegram_bot_id}
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
          
          {/* Health & Diagnostic Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Live Health Status:</span>
                <span className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {bot.connection_status}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Last verified: <strong>{formatTime(bot.last_verified_at)}</strong>
              </div>
              {bot.last_webhook_event_at && (
                <div className="text-[11px] text-slate-500">
                  Last webhook event: <strong>{formatTime(bot.last_webhook_event_at)}</strong>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onManageUsers && (
                <button
                  onClick={() => {
                    onClose();
                    onManageUsers(bot);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-98"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Users ({bot.telegram_username})</span>
                </button>
              )}

              <button
                onClick={handleSyncHealth}
                disabled={isSyncing}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold py-2.5 px-3.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Testing...' : 'Ping API'}</span>
              </button>
            </div>
          </div>

          {syncStatus && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-2xl space-y-1">
              <div className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-600" />
                <span>Group Participation</span>
              </div>
              <div className="font-bold text-slate-900">
                {bot.telegram_can_join_groups ? 'Allowed to join groups' : 'Direct messages only'}
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-1">
              <div className="text-slate-500 font-semibold flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                <span>Group Privacy Mode</span>
              </div>
              <div className="font-bold text-slate-900">
                {bot.telegram_can_read_all_group_messages
                  ? 'All messages readable'
                  : 'Commands & mentions only'}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 sm:col-span-2">
              <div className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-600" />
                <span>Configured Webhook Destination</span>
              </div>
              <div className="font-mono text-[11px] text-slate-700 break-all bg-white p-2 rounded-lg border border-slate-200">
                {bot.webhook_url}
              </div>
            </div>
          </div>

          {/* Real-time Webhook Events Audit Stream */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Live Event Stream & Audit Log
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                {events.length} {events.length === 1 ? 'event' : 'events'} recorded
              </span>
            </div>

            {isLoadingEvents ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                Loading events from server...
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                No webhook events received yet. Messages sent to @{bot.telegram_username} will appear here in real time.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-start justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-[11px]">
                          {evt.event_type}
                        </span>
                        {evt.telegram_update_id && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            update_id: {evt.telegram_update_id}
                          </span>
                        )}
                      </div>
                      {evt.raw_payload && (
                        <div className="text-[11px] text-slate-500">
                          {evt.raw_payload.message_type
                            ? `Type: ${evt.raw_payload.message_type}`
                            : JSON.stringify(evt.raw_payload).slice(0, 80)}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {formatTime(evt.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone: Disconnect */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Need to take this bot offline or detach it from this slot?
            </div>
            <button
              onClick={() => {
                onClose();
                onRequestDisconnect(bot);
              }}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs py-2.5 px-4 rounded-xl border border-red-200 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect Bot</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50/80 px-6 py-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Encrypted Token Vault • Realtime Postgres replication</span>
          </span>
          <a
            href={`https://t.me/${bot.telegram_username}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 font-bold hover:underline flex items-center gap-1"
          >
            <span>Open in Telegram</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
