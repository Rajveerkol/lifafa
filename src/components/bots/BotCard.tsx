import React from 'react';
import { Bot, Users, Activity, ExternalLink, ChevronRight, Clock, Sliders } from 'lucide-react';
import { TelegramBot } from '../../types/telegramBot';
import { BOT_PLANS, BotPlanPrice } from '../../utils/botFeatureEntitlements';

interface BotCardProps {
  bot: TelegramBot;
  onInspect: (bot: TelegramBot) => void;
  onDisconnect: (bot: TelegramBot) => void;
  onManageUsers?: (bot: TelegramBot) => void;
}

export const BotCard: React.FC<BotCardProps> = ({ bot, onInspect, onDisconnect, onManageUsers }) => {
  const isConnected = bot.status === 'CONNECTED' && bot.connection_status === 'CONNECTED';
  const planPrice = Number(bot.plan_price || bot.bot_slot?.plan_price || 99);
  const currentPlan = BOT_PLANS[planPrice as BotPlanPrice] || BOT_PLANS[99];

  // Format relative or timestamp
  const formatRelative = (isoString?: string | null) => {
    if (!isoString) return 'No events yet';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  };

  return (
    <div className="group relative bg-white rounded-3xl border border-sky-100/80 shadow-md hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 p-5 flex flex-col justify-between overflow-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-100/50 via-sky-50/20 to-transparent rounded-bl-full pointer-events-none -z-0" />

      <div className="relative z-10 space-y-4">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                <Bot className="w-7 h-7" />
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                title={bot.status}
              />
            </div>

            <div>
              <h4 className="font-extrabold text-base text-slate-900 tracking-tight leading-snug">
                {bot.telegram_display_name}
              </h4>
              <a
                href={`https://t.me/${bot.telegram_username}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-blue-600 hover:text-cyan-600 transition-colors inline-flex items-center gap-1"
              >
                <span>@{bot.telegram_username}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                ID: {bot.telegram_bot_id}
              </div>
            </div>
          </div>

          {/* Connection Status & Plan Badge */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {bot.status}
            </span>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shadow-2xs ${currentPlan.badgeColor}`}>
              {currentPlan.badge}
            </span>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Webhook</div>
            <div className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  bot.webhook_status === 'ACTIVE' ? 'bg-cyan-500' : 'bg-amber-400'
                }`}
              />
              <span className="truncate">{bot.webhook_status}</span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400">Last Webhook Event</div>
            <div className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{formatRelative(bot.last_webhook_event_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 pt-4 mt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2">
          {onManageUsers && (
            <button
              onClick={() => onManageUsers(bot)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users & Activity</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onInspect(bot)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors shadow-2xs"
            title="Diagnostics & Health"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDisconnect(bot)}
            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors"
            title="Disconnect Bot"
          >
            <span className="text-xs font-bold">Disconnect</span>
          </button>
        </div>
      </div>
    </div>
  );
};
