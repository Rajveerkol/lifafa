import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Users,
  Activity,
  MessageSquare,
  Send,
  Target,
  Share2,
  Lock,
  Sparkles,
  Loader2,
  Calendar,
  AlertCircle,
  BarChart2,
  Shield,
} from 'lucide-react';
import { TelegramBot } from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { BOT_PLANS, BotPlanPrice, hasBotFeature } from '../../../utils/botFeatureEntitlements';

interface BotAdvancedAnalyticsProps {
  bot: TelegramBot;
  planPrice: number;
  onOpenPlanComparison: () => void;
}

export const BotAdvancedAnalytics: React.FC<BotAdvancedAnalyticsProps> = ({
  bot,
  planPrice,
  onOpenPlanComparison,
}) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await telegramBotService.getBotPlanAnalytics(bot.id);
      setAnalytics(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load bot analytics');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const currentPlan = BOT_PLANS[planPrice as BotPlanPrice] || BOT_PLANS[99];
  const hasBasicAnalytics = hasBotFeature(planPrice, 'bot.basic_analytics');
  const hasProAnalytics = hasBotFeature(planPrice, 'bot.advanced_analytics');
  const hasBusinessAnalytics = planPrice >= 999;
  const hasEnterpriseAnalytics = planPrice >= 1999;

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
        Loading authoritative analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Bot Performance & Telemetry
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${currentPlan.badgeColor}`}
            >
              {currentPlan.badge}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time telemetry and engagement metrics entitled for this specific bot slot
          </p>
        </div>

        <button
          onClick={onOpenPlanComparison}
          className="text-xs font-bold text-blue-600 hover:text-cyan-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 py-2 px-3.5 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Compare All Tiers</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TIER 1: CORE TELEMETRY (All bots including ₹99) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Subscribers</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {analytics?.total_users ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Active (24h)</span>
            <Activity className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-600">
            {analytics?.active_users_24h ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Messages Today</span>
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600">
            {analytics?.messages_today ?? 0}
          </div>
        </div>
      </div>

      {/* TIER 2: BASIC ENGAGEMENT ANALYTICS (₹299+) */}
      {hasBasicAnalytics ? (
        <div className="space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Engagement & Growth (Basic ₹299+)
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Broadcasts</span>
                <Send className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {analytics?.total_broadcasts ?? 0}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Total Referrals</span>
                <Share2 className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-600">
                {analytics?.total_referrals ?? 0}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Qualified Invites</span>
                <Users className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {analytics?.qualified_referrals ?? 0}
              </div>
            </div>
          </div>

          {/* Daily Subscriber Growth Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-5">
            <div className="font-extrabold text-xs text-slate-800 mb-3 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <span>7-Day Verified Subscriber Registration Growth</span>
            </div>

            {(!analytics?.user_growth || analytics.user_growth.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No registrations recorded over the past 7 days.
              </div>
            ) : (
              <div className="space-y-2">
                {analytics.user_growth.map((row: any) => (
                  <div
                    key={row.date}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <span className="font-mono text-slate-600 font-semibold">{row.date}</span>
                    <span className="font-extrabold text-blue-600 font-mono">
                      +{row.count} new subscribers
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* LOCKED TEASER FOR BASIC (STARTER BOTS) */
        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-xs text-slate-800">
              Engagement & Growth Analytics Locked
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
              Broadcast delivery metrics, referral conversion tracking, and subscriber growth graphs require Basic (₹299) or higher.
            </p>
          </div>
          <button
            onClick={onOpenPlanComparison}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Upgrade Bot Slot →
          </button>
        </div>
      )}

      {/* TIER 3: PRO CAMPAIGN & SEGMENTATION ANALYTICS (₹499+) */}
      {hasProAnalytics ? (
        <div className="space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Campaign & Advanced Segmentation (Pro ₹499+)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Active Campaigns</span>
                <Target className="w-3.5 h-3.5 text-cyan-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-cyan-600">
                {analytics?.total_campaigns ?? 0}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                <span>Conversion Rate</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {analytics?.total_referrals > 0
                  ? `${Math.round(((analytics?.qualified_referrals || 0) / analytics.total_referrals) * 100)}%`
                  : '0%'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LOCKED TEASER FOR PRO */
        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-xs text-slate-800">
              Pro Campaign & Segmentation Analytics Locked
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
              Promotional conversion metrics, campaign participant funnels, and audience segmentation insights unlock on Pro (₹499).
            </p>
          </div>
          <button
            onClick={onOpenPlanComparison}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Explore Pro Plan →
          </button>
        </div>
      )}

      {/* TIER 4: BUSINESS AUDIENCE TAGGING (₹999+) */}
      {hasBusinessAnalytics && analytics?.tag_breakdown && analytics.tag_breakdown.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <div className="text-xs font-extrabold text-slate-800">
            Subscriber Tag Segmentation (Business ₹999+)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {analytics.tag_breakdown.map((t: any) => (
              <div key={t.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block truncate">#{t.name}</span>
                <span className="font-mono text-blue-600 font-extrabold text-sm">
                  {t.user_count} users
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
