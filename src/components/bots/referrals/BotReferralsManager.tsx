import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  Copy,
  Check,
  Trophy,
  Users,
  Award,
  Clock,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import {
  TelegramBot,
  BotReferral,
  BotReferralReward,
  BotReferralSettings,
  BotReferralLeaderboardEntry,
} from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';

interface BotReferralsManagerProps {
  bot: TelegramBot;
}

export const BotReferralsManager: React.FC<BotReferralsManagerProps> = ({ bot }) => {
  const [settings, setSettings] = useState<BotReferralSettings | null>(null);
  const [referrals, setReferrals] = useState<BotReferral[]>([]);
  const [rewards, setRewards] = useState<BotReferralReward[]>([]);
  const [leaderboard, setLeaderboard] = useState<BotReferralLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings Form State
  const [rewardEnabled, setRewardEnabled] = useState(true);
  const [rewardAmount, setRewardAmount] = useState<number>(10);
  const [qualificationReq, setQualificationReq] = useState<'JOIN_ONLY' | 'ACTIVE_3_DAYS' | 'MANUAL_VERIFY'>('JOIN_ONLY');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Copy Feedback
  const [copiedLink, setCopiedLink] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [sets, refs, rews, lboard] = await Promise.all([
        telegramBotService.getBotReferralSettings(bot.id),
        telegramBotService.getBotReferrals(bot.id, 50),
        telegramBotService.getBotReferralRewards(bot.id, 50),
        telegramBotService.getBotReferralLeaderboard(bot.id, 25),
      ]);

      if (sets) {
        setSettings(sets);
        setRewardEnabled(sets.reward_enabled);
        setRewardAmount(sets.reward_amount);
        setQualificationReq(sets.qualification_requirement);
      }
      setReferrals(refs);
      setRewards(rews);
      setLeaderboard(lboard);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load referral data');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadData();
    const unsub = telegramBotService.subscribeToBotReferrals(bot.id, () => {
      loadData();
    });
    return () => {
      unsub();
    };
  }, [loadData, bot.id]);

  const handleCopyInviteLink = () => {
    const link = `https://t.me/${bot.telegram_username}?start=REF_INVITE`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);
    try {
      const updated = await telegramBotService.saveBotReferralSettings(bot.id, {
        reward_enabled: rewardEnabled,
        reward_amount: Number(rewardAmount) || 10,
        qualification_requirement: qualificationReq,
      });
      setSettings(updated);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save referral settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Telemetry Calculations
  const totalReferrals = referrals.length;
  const qualifiedReferrals = referrals.filter((r) => r.status === 'QUALIFIED' || r.status === 'REWARDED').length;
  const pendingReferrals = referrals.filter((r) => r.status === 'PENDING').length;
  const totalRewardsEligible = rewards.reduce((acc, r) => acc + (r.status === 'ELIGIBLE' || r.status === 'REWARDED' ? Number(r.reward_amount) : 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <span>Referrals & Growth Engine</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Server-authoritative attribution, anti-fraud self-referral protection, and community leaderboard
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopyInviteLink}
            className="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-1.5"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-extrabold">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-blue-600" />
                <span>Copy Referral Format</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Real Referral Telemetry Cards (Zero Fake Data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Total Referrals</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{totalReferrals}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Qualified</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">{qualifiedReferrals}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Pending Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">{pendingReferrals}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Total Rewards</span>
            <Award className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-600">
            {totalRewardsEligible} pts
          </div>
        </div>
      </div>

      {/* Deep Link & Settings Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Referral Settings Card */}
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h4 className="font-extrabold text-sm text-slate-900">Referral Program Rules</h4>
            </div>
            {settingsSuccess && (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={rewardEnabled}
                onChange={(e) => setRewardEnabled(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Enable Referral Rewards Program</span>
            </label>
            <p className="text-[11px] text-slate-400">
              When enabled, verified referrers become eligible for reward points upon member join.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Reward per Referral</label>
              <div className="relative">
                <input
                  type="number"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={1}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  POINTS
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Qualification Rule</label>
              <select
                value={qualificationReq}
                onChange={(e) => setQualificationReq(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="JOIN_ONLY">Instant on First /start</option>
                <option value="ACTIVE_3_DAYS">Active for 3 Days</option>
                <option value="MANUAL_VERIFY">Manual Verification</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Anti-self referral & duplicate protection enforced
            </span>

            <button
              type="submit"
              disabled={isSavingSettings}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-2xs active:scale-98 transition-all flex items-center gap-1.5"
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Rules</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Telegram Referral Deep Link Guide */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-500" />
            <h4 className="font-extrabold text-sm text-slate-900">How Bot Deep-Links Work</h4>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Every bot subscriber can run <code>/ref</code> or <code>/referral</code> in your bot to generate their own personal deep-link:
          </p>

          <div className="p-3 bg-slate-900 text-cyan-300 rounded-2xl font-mono text-xs flex items-center justify-between border border-slate-800">
            <span className="truncate">https://t.me/{bot.telegram_username}?start=REF_xxxxxx</span>
            <button
              onClick={handleCopyInviteLink}
              className="text-slate-400 hover:text-white p-1 shrink-0 ml-2"
              title="Copy link"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Deep-links follow Telegram API standard start parameters.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Self-referrals are automatically rejected server-side.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Each user can only be referred once per bot namespace.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table (Server-side Aggregation) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h4 className="font-extrabold text-sm text-slate-900">
              Community Referral Leaderboard
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">Ranked by verified invitations</span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-1">
            <Trophy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="font-bold text-slate-700">No referral activity recorded yet</div>
            <p className="text-[11px] text-slate-400">
              When members share their <code>/ref</code> links and invite friends, top referrers will rank here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Referrer</th>
                  <th className="py-3 px-4">Telegram ID</th>
                  <th className="py-3 px-4">Total Invited</th>
                  <th className="py-3 px-4">Qualified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((row) => (
                  <tr key={row.bot_user_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {row.rank === 1 ? (
                        <span className="text-amber-500 font-black">🥇 #1</span>
                      ) : row.rank === 2 ? (
                        <span className="text-slate-400 font-black">🥈 #2</span>
                      ) : row.rank === 3 ? (
                        <span className="text-amber-700 font-black">🥉 #3</span>
                      ) : (
                        `#${row.rank}`
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      {row.username ? `@${row.username}` : row.first_name || 'Member'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      {row.telegram_user_id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {row.total_referrals} users
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">
                      {row.total_qualified} qualified
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Referral Activity Stream */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h4 className="font-extrabold text-sm text-slate-900">
              Live Referral Event Stream ({referrals.length})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">Server validated log</span>
        </div>

        {referrals.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-1">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="font-bold text-slate-700">No referral attributions yet</div>
            <p className="text-[11px] text-slate-400">
              Events will record in real time when new users launch your bot with a referral parameter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Referral Code</th>
                  <th className="py-3 px-4">Referrer</th>
                  <th className="py-3 px-4">Referred User</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(ref.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {ref.referral_code}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {ref.referrer?.username ? `@${ref.referrer.username}` : ref.referrer?.first_name || 'Referrer'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {ref.referred?.username ? `@${ref.referred.username}` : ref.referred?.first_name || 'Invited User'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          ref.status === 'QUALIFIED' || ref.status === 'REWARDED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ref.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {ref.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
