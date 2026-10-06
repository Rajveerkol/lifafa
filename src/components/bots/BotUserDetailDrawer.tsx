import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  ShieldAlert,
  Clock,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Calendar,
  Globe,
  Hash,
} from 'lucide-react';
import { BotUser } from '../../types/telegramBot';
import { telegramBotService } from '../../services/telegramBotService';

interface BotUserDetailDrawerProps {
  user: BotUser | null;
  botUsername: string;
  onClose: () => void;
  onStatusUpdated: (updatedUser: BotUser) => void;
}

export const BotUserDetailDrawer: React.FC<BotUserDetailDrawerProps> = ({
  user,
  botUsername,
  onClose,
  onStatusUpdated,
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (!user) return null;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Telegram User';
  const isBlocked = user.status === 'BLOCKED';

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const handleToggleStatus = async () => {
    setStatusError(null);
    setIsUpdatingStatus(true);
    const nextStatus = isBlocked ? 'ACTIVE' : 'BLOCKED';

    try {
      const ok = await telegramBotService.updateBotUserStatus(user.id, nextStatus);
      if (ok) {
        onStatusUpdated({
          ...user,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setStatusError(err.message || 'Failed to update user status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-sky-100 flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <User className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight leading-snug">
                Telegram User Details
              </h3>
              <p className="text-xs text-blue-100">
                Live profile from @{botUsername}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* User Hero Identity */}
          <div className="p-5 bg-gradient-to-b from-sky-50/70 to-blue-50/30 rounded-3xl border border-sky-100 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 text-white flex items-center justify-center text-xl font-black shadow-md shadow-blue-500/20 shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-base text-slate-900 truncate">
                  {displayName}
                </h4>
                {user.is_premium && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Premium
                  </span>
                )}
              </div>
              {user.username ? (
                <a
                  href={`https://t.me/${user.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>@{user.username}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-slate-400 text-[11px] italic">No username set</span>
              )}
              <div className="pt-0.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                    isBlocked
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isBlocked ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                  />
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          {/* Real Identifiers Grid */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Identifiers & Identity
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>Telegram User ID</span>
                </div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {user.telegram_user_id}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-slate-400" />
                  <span>Chat ID</span>
                </div>
                <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
                  {user.telegram_chat_id ? user.telegram_chat_id : 'N/A'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>Language</span>
                </div>
                <div className="font-bold text-slate-900 mt-0.5 uppercase">
                  {user.language_code || 'Not reported'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Account Type</span>
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {user.is_bot ? 'Bot Account' : 'Human User'}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timestamps */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Interaction Timeline
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>First Seen</span>
                </span>
                <span className="font-bold text-slate-800">
                  {formatDateTime(user.first_seen_at)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Last Seen</span>
                </span>
                <span className="font-bold text-slate-800">
                  {formatDateTime(user.last_seen_at)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Last Message</span>
                </span>
                <span className="font-bold text-slate-800">
                  {formatDateTime(user.last_message_at)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">/start Invocations</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                  {user.start_count}
                </span>
              </div>

              {user.start_param && (
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  <span className="text-slate-500 block">Initial Deep-Link Parameter</span>
                  <div className="p-2 bg-slate-50 rounded-lg font-mono text-[11px] text-slate-800 break-all">
                    {user.start_param}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Control */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Platform Access Control
            </div>
            {statusError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}
            <button
              onClick={handleToggleStatus}
              disabled={isUpdatingStatus}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                isBlocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Platform Status...</span>
                </>
              ) : isBlocked ? (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Unblock User Access (Mark Active)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Block User Access (Platform Level)</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Platform status only controls platform access and does not simulate Telegram-level blocks.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Real Database Record</span>
          <span className="font-mono">{user.id.slice(0, 8)}...</span>
        </div>
      </div>
    </div>
  );
};
