import React, { useState } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';
import { telegramService } from '../../services/telegramService';

export interface VerifiedTelegramChannel {
  channelUsername: string;
  channelTitle: string;
  channelId?: number;
  isVerified: boolean;
}

interface DiscoveredChannel {
  channelUsername: string;
  channelTitle: string;
  channelId?: number;
  botUsername: string;
}

interface TelegramTaskBuilderProps {
  onChannelVerified: (channel: VerifiedTelegramChannel) => void;
  onCancel: () => void;
}

export const TelegramTaskBuilder: React.FC<TelegramTaskBuilderProps> = ({
  onChannelVerified,
  onCancel,
}) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stage 1 -> Stage 2: Channel found, awaiting admin promotion
  const [discoveredChannel, setDiscoveredChannel] = useState<DiscoveredChannel | null>(null);

  // Stage 2 -> Stage 3: Bot admin verified
  const [verifiedChannel, setVerifiedChannel] = useState<VerifiedTelegramChannel | null>(null);

  // Stage 1: Search & Discover Channel
  const handleSearchAndConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await telegramService.verifyChannelAdmin(clean);

      if (res.verified) {
        // Direct full verification (bot already admin)
        setVerifiedChannel({
          channelUsername: res.channelUsername,
          channelTitle: res.channelTitle || res.channelUsername,
          channelId: res.channelId,
          isVerified: true,
        });
        setDiscoveredChannel(null);
      } else if (res.needsAdmin && res.channelTitle) {
        // Channel discovered successfully! Prompt admin promotion
        setDiscoveredChannel({
          channelUsername: res.channelUsername,
          channelTitle: res.channelTitle,
          channelId: res.channelId,
          botUsername: res.botUsername || telegramService.BOT_USERNAME,
        });
        setErrorMsg(null);
      } else {
        // Channel not found or other business error
        setErrorMsg(res.error || 'Could not verify channel access.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Re-check bot admin status
  const handleCheckAdminAgain = async () => {
    const target = discoveredChannel?.channelUsername || username.trim().replace(/^@/, '');
    if (!target) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await telegramService.verifyChannelAdmin(target);

      if (res.verified) {
        // Success! Bot is now an administrator
        setVerifiedChannel({
          channelUsername: res.channelUsername,
          channelTitle: res.channelTitle || discoveredChannel?.channelTitle || res.channelUsername,
          channelId: res.channelId || discoveredChannel?.channelId,
          isVerified: true,
        });
        setDiscoveredChannel(null);
      } else {
        // Still not admin
        const botName = res.botUsername || discoveredChannel?.botUsername || telegramService.BOT_USERNAME;
        setErrorMsg(
          `Bot @${botName} is not yet an administrator of @${target}. Please grant administrator privileges in channel settings and click Check Admin Access again.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToSearch = () => {
    setDiscoveredChannel(null);
    setVerifiedChannel(null);
    setErrorMsg(null);
  };

  const handleConfirmAdd = () => {
    if (verifiedChannel) {
      onChannelVerified(verifiedChannel);
    }
  };

  return (
    <div className="bg-gradient-to-b from-sky-50/60 to-white rounded-3xl p-5 border border-sky-100 shadow-sm space-y-4 animate-in fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
            <Send className="w-4 h-4 -rotate-12" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Verify Telegram Channel
            </h4>
            <p className="text-[11px] text-slate-500">
              Two-step verification: Discover channel and confirm bot administrator rights
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* STAGE 3: Successfully Verified */}
      {verifiedChannel ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-3 animate-in zoom-in-95">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 bg-emerald-100/80 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
              <span>✓ All Checks Passed</span>
            </div>
            <h5 className="text-sm font-black text-slate-900">
              {verifiedChannel.channelTitle}
            </h5>
            <p className="text-xs text-emerald-700 font-mono mt-0.5">
              @{verifiedChannel.channelUsername} • Bot Admin Confirmed
            </p>
          </div>

          <button
            type="button"
            onClick={handleConfirmAdd}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
          >
            Add Task to Lifafa
          </button>
        </div>
      ) : discoveredChannel ? (
        /* STAGE 2: Channel Found - Bot Admin Promotion Required */
        <div className="space-y-4 animate-in fade-in">
          {/* Channel Found Banner */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                TG
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Stage 1: Channel Found &amp; Accessible ✓
                </span>
                <h5 className="text-xs font-black text-slate-900 truncate">
                  {discoveredChannel.channelTitle}
                </h5>
                <span className="text-[11px] font-mono text-slate-500">
                  @{discoveredChannel.channelUsername}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetToSearch}
              className="text-[11px] text-slate-500 hover:text-slate-800 font-bold shrink-0 underline"
            >
              Change
            </button>
          </div>

          {/* Stage 2 Action Box */}
          <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs space-y-3">
            <div className="flex items-start gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <h6 className="text-xs font-bold text-amber-900">
                  Stage 2: Please Add @{discoveredChannel.botUsername} as Administrator
                </h6>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  The channel exists, but our bot does not have administrator privileges yet. To verify claimant memberships automatically, promote the bot to Administrator.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-600 space-y-1.5 border border-slate-100 font-medium">
              <p className="font-bold text-slate-800">Quick steps in Telegram:</p>
              <p>1. Open channel <strong>{discoveredChannel.channelTitle}</strong> in Telegram.</p>
              <p>
                2. Go to <strong>Channel Settings &gt; Administrators &gt; Add Administrator</strong>.
              </p>
              <p>
                3. Search and add: <strong className="text-sky-700 font-mono">@{discoveredChannel.botUsername}</strong>.
              </p>
              <p>4. Save permissions and click <strong>&quot;Check Admin Access&quot;</strong> below.</p>
            </div>

            <a
              href={`https://t.me/${discoveredChannel.channelUsername}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl border border-sky-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Open @{discoveredChannel.channelUsername} in Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verification Notice:</p>
                <p className="text-[11px] mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Action Buttons for Stage 2 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleResetToSearch}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleCheckAdminAgain}
              disabled={loading}
              className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-sky-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking Admin Access...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verify Again / Check Admin Access</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* STAGE 1: Search & Discover Channel */
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Telegram Public Channel Username *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchAndConfirm();
                  }
                }}
                placeholder="e.g. SatishTricks"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-sky-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Enter your public Telegram channel username without @.
            </p>
          </div>

          {/* Setup Instructions Box */}
          <div className="bg-white/80 rounded-2xl p-3.5 border border-sky-100 text-xs text-slate-600 space-y-2">
            <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>How Verification Works:</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
              <li>Click <strong>&quot;Search &amp; Confirm Channel Access&quot;</strong> to confirm channel exists</li>
              <li>
                Promote <strong className="text-sky-700 font-mono">@{telegramService.BOT_USERNAME}</strong> to Administrator
              </li>
              <li>Click <strong>&quot;Check Admin Access&quot;</strong> to finalize verification</li>
            </ol>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verification Notice:</p>
                <p className="text-[11px] mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSearchAndConfirm()}
              disabled={loading || !username.trim()}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-sky-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching &amp; Confirming Channel...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Search &amp; Confirm Channel Access</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

