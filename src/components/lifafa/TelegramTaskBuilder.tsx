import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2, ShieldCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { telegramService } from '../../services/telegramService';

export interface VerifiedTelegramChannel {
  channelUsername: string;
  channelTitle: string;
  channelId?: number;
  isVerified: boolean;
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
  const [needsAdminHelp, setNeedsAdminHelp] = useState(false);
  const [verifiedChannel, setVerifiedChannel] = useState<VerifiedTelegramChannel | null>(null);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim()) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      setNeedsAdminHelp(false);

      const res = await telegramService.verifyChannelAdmin(username.trim());

      if (res.verified) {
        const verified = {
          channelUsername: res.channelUsername,
          channelTitle: res.channelTitle || res.channelUsername,
          channelId: res.channelId,
          isVerified: true,
        };
        setVerifiedChannel(verified);
      } else {
        setErrorMsg(res.error || 'Channel verification failed.');
        setNeedsAdminHelp(Boolean(res.needsAdmin));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAdd = () => {
    if (verifiedChannel) {
      onChannelVerified(verifiedChannel);
    }
  };

  return (
    <div className="bg-gradient-to-b from-sky-50/60 to-white rounded-3xl p-5 border border-sky-100 shadow-sm space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center">
            <Send className="w-4 h-4 -rotate-12" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Verify Telegram Channel
            </h4>
            <p className="text-[11px] text-slate-500">
              Bot must be an admin to verify claimant memberships
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>

      {verifiedChannel ? (
        /* Channel Successfully Verified State */
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h5 className="text-sm font-bold text-slate-900">
              {verifiedChannel.channelTitle}
            </h5>
            <p className="text-xs text-emerald-700 font-mono mt-0.5">
              @{verifiedChannel.channelUsername} • Bot Admin Verified ✓
            </p>
          </div>

          <button
            type="button"
            onClick={handleConfirmAdd}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all"
          >
            Add Task to Lifafa
          </button>
        </div>
      ) : (
        /* Input & Verification Flow */
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Telegram Channel / Group Username *
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
                    handleVerify();
                  }
                }}
                placeholder="e.g. MyTechCommunity"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          {/* Setup Instructions Box */}
          <div className="bg-white/80 rounded-2xl p-3.5 border border-sky-100 text-xs text-slate-600 space-y-2">
            <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Required Bot Admin Setup:</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
              <li>Open your Telegram channel settings</li>
              <li>
                Add our bot <strong className="text-sky-700 font-mono">@{telegramService.BOT_USERNAME}</strong>
              </li>
              <li>Promote bot to <strong>Administrator</strong> (with Invite Users permission)</li>
              <li>Click &quot;Verify Channel &amp; Bot&quot; below</li>
            </ol>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verification Status:</p>
                <p className="text-[11px] mt-0.5">{errorMsg}</p>
                {needsAdminHelp && (
                  <a
                    href={`https://t.me/${telegramService.BOT_USERNAME}?startgroup=botstart`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-sky-700 hover:text-sky-800 bg-sky-100/70 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <span>Add @{telegramService.BOT_USERNAME} to Channel</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleVerify()}
              disabled={loading || !username.trim()}
              className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-sky-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching &amp; Verifying Permissions...</span>
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
