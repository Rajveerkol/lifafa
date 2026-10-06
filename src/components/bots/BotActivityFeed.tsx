import React from 'react';
import {
  Activity,
  Play,
  MessageSquare,
  Edit3,
  MousePointerClick,
  Sparkles,
  Clock,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { BotEvent } from '../../types/telegramBot';

interface BotActivityFeedProps {
  events: BotEvent[];
  isLoading: boolean;
}

export const BotActivityFeed: React.FC<BotActivityFeedProps> = ({ events, isLoading }) => {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' + date.toLocaleDateString() + ')';
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'START_COMMAND':
        return {
          icon: <Play className="w-3.5 h-3.5 text-cyan-500 fill-cyan-500/20" />,
          title: 'User started the bot (/start)',
          bg: 'bg-cyan-50 border-cyan-200 text-cyan-800',
        };
      case 'MESSAGE':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />,
          title: 'User sent a message',
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
        };
      case 'EDITED_MESSAGE':
        return {
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-500" />,
          title: 'User edited message',
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
        };
      case 'CALLBACK_QUERY':
        return {
          icon: <MousePointerClick className="w-3.5 h-3.5 text-purple-500" />,
          title: 'User pressed button callback',
          bg: 'bg-purple-50 border-purple-200 text-purple-800',
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-slate-500" />,
          title: `Update received: ${eventType}`,
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-100">
        <Activity className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
        Loading real-time event feed...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-2">
          <Radio className="w-6 h-6" />
        </div>
        <p className="font-bold text-slate-700">No webhook events recorded yet</p>
        <p className="text-[11px] text-slate-400 mt-1">
          When users interact with your bot on Telegram, live events will appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((evt) => {
        const badge = getEventBadge(evt.event_type);
        return (
          <div
            key={evt.id}
            className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:border-sky-200 transition-colors flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${badge.bg}`}>
                {badge.icon}
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span>{badge.title}</span>
                  {evt.update_id && (
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      #{evt.update_id}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                  {evt.telegram_user_id && (
                    <span>
                      User ID: <strong className="font-mono text-slate-700">{evt.telegram_user_id}</strong>
                    </span>
                  )}
                  {evt.telegram_chat_id && (
                    <span>
                      Chat: <strong className="font-mono text-slate-700">{evt.telegram_chat_id}</strong>
                    </span>
                  )}
                  {evt.metadata?.start_param && (
                    <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                      ref: {evt.metadata.start_param}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" />
                {formatTime(evt.created_at)}
              </span>
              <span className="inline-block mt-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Processed
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
