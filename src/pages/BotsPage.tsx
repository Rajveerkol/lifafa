import React, { useState, useEffect } from 'react';
import { Bot, Bell, CheckCircle2, Sparkles, Send, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';

interface BotsPageProps {
  onOpenAuth: () => void;
}

export const BotsPage: React.FC<BotsPageProps> = ({ onOpenAuth }) => {
  const { user } = useAuth();
  const [isNotified, setIsNotified] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      notificationService.getPreferences(user.id).then((prefs) => {
        if (prefs?.bot_coming_soon_alerts) {
          setIsNotified(true);
        }
      });
    }
  }, [user]);

  const handleNotifyMe = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    try {
      setLoading(true);
      await notificationService.savePreferences(user.id, {
        bot_coming_soon_alerts: true,
      });
      setIsNotified(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 sm:py-12 px-4 text-center pb-24 md:pb-12">
      {/* Bot Icon Graphic */}
      <div className="relative inline-block mb-6">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 mx-auto">
          <Bot className="w-12 h-12 sm:w-14 sm:h-14 animate-pulse-subtle" />
        </div>
        <span className="absolute -top-2 -right-2 bg-red-600 text-white font-black text-[10px] sm:text-xs px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
          Coming Soon
        </span>
      </div>

      {/* Heading & Subtitle */}
      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
        Automated Telegram & Social Bots
      </h2>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto mb-8">
        We are crafting high-speed automation bots to distribute cash Lifafas directly inside your
        Telegram groups, channels, and community threads automatically.
      </p>

      {/* Feature Teasers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2">
            <Send className="w-4 h-4" />
          </div>
          <h5 className="text-xs font-bold text-slate-900 mb-0.5">Telegram Auto-Drop</h5>
          <p className="text-[11px] text-slate-400">Scheduled drops for subscribers</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
            <Zap className="w-4 h-4" />
          </div>
          <h5 className="text-xs font-bold text-slate-900 mb-0.5">Instant Verification</h5>
          <p className="text-[11px] text-slate-400">Automated membership validation</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
            <Sparkles className="w-4 h-4" />
          </div>
          <h5 className="text-xs font-bold text-slate-900 mb-0.5">Custom Triggers</h5>
          <p className="text-[11px] text-slate-400">Reward top community contributors</p>
        </div>
      </div>

      {/* Notify Me Action */}
      <div className="max-w-xs mx-auto">
        {isNotified ? (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>You're on the early access notify list!</span>
          </div>
        ) : (
          <button
            onClick={handleNotifyMe}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Notify Me When Available'}</span>
          </button>
        )}

        {!user && (
          <p className="text-[10px] text-slate-400 mt-2">
            Requires logging in with your Google account.
          </p>
        )}
      </div>
    </div>
  );
};
