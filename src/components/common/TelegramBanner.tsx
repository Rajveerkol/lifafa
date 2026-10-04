import React, { useState } from 'react';
import { Send, CheckCircle2, ArrowRight, BellRing } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';

export const TelegramBanner: React.FC = () => {
  const { user } = useAuth();
  const [isActivated, setIsActivated] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleClick = async () => {
    if (user) {
      try {
        await notificationService.savePreferences(user.id, { telegram_alerts: true });
        setIsActivated(true);
      } catch (e) {
        console.error(e);
      }
    }
    setShowModal(true);
  };

  return (
    <>
      <div className="relative group overflow-hidden bg-white/95 rounded-2xl p-3.5 sm:p-4 border border-blue-100 hover:border-blue-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between gap-3">
        {/* Soft Ambient Blue Corner Glow */}
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-blue-500/10 blur-xl pointer-events-none group-hover:bg-blue-500/15 transition-all" />

        <div className="flex items-center gap-3 min-w-0">
          {/* Circular Telegram Icon with Soft Ambient Glow */}
          <div className="relative shrink-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25 group-hover:scale-105 transition-transform duration-300">
              <Send className="w-5 h-5 -rotate-12 translate-x-[-1px] translate-y-[1px]" />
            </div>
            {/* Live Notification Pulse Indicator */}
            {!isActivated && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600 border-2 border-white" />
              </span>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug truncate">
                Activate Telegram Bot Alert
              </h4>
              <BellRing className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 leading-tight truncate">
              Get transaction &amp; important updates in real-time
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleClick}
          className={`shrink-0 flex items-center gap-1.5 text-[11px] sm:text-xs font-black px-4 py-2 sm:py-2.5 rounded-xl uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer ${
            isActivated
              ? 'bg-emerald-600 text-white shadow-emerald-500/25'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 group-hover:shadow-blue-500/40'
          }`}
        >
          {isActivated ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ACTIVATED</span>
            </>
          ) : (
            <>
              <span>ACTIVATE</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </div>

      {/* Info Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3 shadow-inner">
              <Send className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">Telegram Bot Alerts</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Connect our Telegram notification bot to receive real-time alerts whenever you claim rewards, your Lifafas are redeemed, or payouts complete.
            </p>
            <div className="bg-slate-50 rounded-2xl p-3 text-xs text-slate-500 mb-5 text-left border border-slate-100">
              <p className="font-semibold text-slate-700 mb-1">Bot Username: <span className="text-blue-600 font-mono">@createlifafa_bot</span></p>
              <p>Type <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 font-mono">/start</code> to bind your account.</p>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="https://t.me/createlifafa_bot"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm transition-all"
              >
                <span>Open in Telegram</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
