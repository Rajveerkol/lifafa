import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
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
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          {/* Circular Telegram Icon */}
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-sky-500/20">
            <Send className="w-5 h-5 -rotate-12 translate-x-[-1px] translate-y-[1px]" />
          </div>

          <div className="flex flex-col">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
              Activate Telegram Bot Alert
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">
              Get all transaction and important updates via Telegram
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleClick}
          className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-xs font-black px-3.5 py-2 rounded-full uppercase tracking-wider shadow-md shadow-red-500/25 active:scale-95 transition-all"
        >
          {isActivated ? 'ACTIVATED' : 'CLICK HERE'}
        </button>
      </div>

      {/* Info Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
              <Send className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Telegram Bot Alerts</h3>
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm"
              >
                Open in Telegram
              </a>
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-xs font-semibold"
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
