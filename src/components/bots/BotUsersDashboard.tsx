import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Activity,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Shield,
  Clock,
  Radio,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle2,
  Terminal,
  LayoutGrid,
  GitFork,
  Send,
  Target,
  Share2,
  Lock,
  BarChart2,
  Zap,
} from 'lucide-react';
import { TelegramBot, BotUser, BotEvent, BotUserStats } from '../../types/telegramBot';
import { telegramBotService } from '../../services/telegramBotService';
import { BotUserDetailDrawer } from './BotUserDetailDrawer';
import { BotActivityFeed } from './BotActivityFeed';
import { BotCommandsManager } from './automation/BotCommandsManager';
import { BotMenuBuilder } from './automation/BotMenuBuilder';
import { BotAutoRepliesManager } from './automation/BotAutoRepliesManager';
import { BotWorkflowsManager } from './automation/BotWorkflowsManager';
import { BotBroadcastManager } from './broadcasts/BotBroadcastManager';
import { BotCampaignsManager } from './campaigns/BotCampaignsManager';
import { BotReferralsManager } from './referrals/BotReferralsManager';
import { FeatureLockOverlay } from './gating/FeatureLockOverlay';
import { PlanComparisonModal } from './gating/PlanComparisonModal';
import { BotAdvancedAnalytics } from './analytics/BotAdvancedAnalytics';
import { BotAdminControls } from './admin/BotAdminControls';
import { EnterpriseCommandCenter } from './enterprise/EnterpriseCommandCenter';
import {
  BOT_PLANS,
  BotPlanPrice,
  hasBotFeature,
} from '../../utils/botFeatureEntitlements';

interface BotUsersDashboardProps {
  bot: TelegramBot;
  onBack: () => void;
}

export const BotUsersDashboard: React.FC<BotUsersDashboardProps> = ({ bot, onBack }) => {
  const [activeTab, setActiveTab] = useState<
    | 'users'
    | 'analytics'
    | 'broadcasts'
    | 'campaigns'
    | 'referrals'
    | 'commands'
    | 'menus'
    | 'replies'
    | 'admin'
    | 'workflows'
    | 'feed'
  >('users');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Authoritative Bot-Level Plan Entitlement (bot_slots.plan_price)
  const planPrice = Number(bot.plan_price || bot.bot_slot?.plan_price || 99);
  const currentPlan = BOT_PLANS[planPrice as BotPlanPrice] || BOT_PLANS[99];

  const [stats, setStats] = useState<BotUserStats>({
    total_users: 0,
    new_users_today: 0,
    active_users_24h: 0,
    messages_today: 0,
    new_users_this_week: 0,
  });
  const [users, setUsers] = useState<BotUser[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [events, setEvents] = useState<BotEvent[]>([]);

  // Search & Filters (Server-side)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected User for Detail Drawer
  const [selectedUser, setSelectedUser] = useState<BotUser | null>(null);

  // 1. Load Stats
  const loadStats = useCallback(async () => {
    try {
      const data = await telegramBotService.getBotUserStats(bot.id);
      setStats(data);
    } catch (err: any) {
      console.warn('Stats fetch warning:', err.message);
    } finally {
      setIsLoadingStats(false);
    }
  }, [bot.id]);

  // 2. Load Paginated Users (Server-side)
  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      setErrorMessage(null);
      const res = await telegramBotService.getBotUsers(bot.id, {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        status: statusFilter,
      });
      setUsers(res.users);
      setTotalUsersCount(res.total);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch users');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [bot.id, currentPage, searchTerm, statusFilter]);

  // 3. Load Events Feed
  const loadEvents = useCallback(async () => {
    try {
      const data = await telegramBotService.getBotActivityFeed(bot.id, 30);
      setEvents(data);
    } catch (err: any) {
      console.warn('Events fetch warning:', err.message);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [bot.id]);

  // Initial load
  useEffect(() => {
    loadStats();
    loadUsers();
    loadEvents();
  }, [loadStats, loadUsers, loadEvents]);

  // Realtime Subscriptions (No polling, pure DB reactivity)
  useEffect(() => {
    // Listen for users updates
    const unsubUsers = telegramBotService.subscribeToBotUsers(bot.id, () => {
      loadUsers();
      loadStats();
    });

    // Listen for event feed updates
    const unsubFeed = telegramBotService.subscribeToBotEventsFeed(bot.id, (newEvent) => {
      setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== newEvent.id)]);
      loadStats();
    });

    return () => {
      unsubUsers();
      unsubFeed();
    };
  }, [bot.id, loadUsers, loadStats]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(totalUsersCount / pageSize));

  const formatRelative = (isoString?: string | null) => {
    if (!isoString) return 'Never';
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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Breadcrumb & Bot Identification */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-3xl p-5 border border-sky-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shadow-2xs"
            title="Back to Command Center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {bot.telegram_display_name}
              </h2>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-2xs ${currentPlan.badgeColor}`}>
                {currentPlan.badge}
              </span>
              <button
                onClick={() => setIsPlanModalOpen(true)}
                className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200 transition-colors flex items-center gap-1 shadow-2xs"
                title="View Feature Entitlements Matrix"
              >
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span>Compare Plans</span>
              </button>
            </div>
            <a
              href={`https://t.me/${bot.telegram_username}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>@{bot.telegram_username}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200 overflow-x-auto max-w-full w-full lg:w-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users ({totalUsersCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcasts')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'broadcasts'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-blue-500" />
            <span>Broadcasts</span>
            {!hasBotFeature(planPrice, 'bot.broadcast') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'campaigns'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-cyan-500" />
            <span>Campaigns</span>
            {!hasBotFeature(planPrice, 'bot.campaigns') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('referrals')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'referrals'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Referrals</span>
            {!hasBotFeature(planPrice, 'bot.basic_referrals') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('commands')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'commands'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-blue-500" />
            <span>Commands</span>
            {!hasBotFeature(planPrice, 'bot.commands') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('menus')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'menus'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-500" />
            <span>Menu Builder</span>
            {!hasBotFeature(planPrice, 'bot.menus') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('replies')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'replies'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
            <span>Auto-Replies</span>
            {!hasBotFeature(planPrice, 'bot.auto_replies') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-500" />
            <span>Staff & Admin</span>
            {!hasBotFeature(planPrice, 'bot.multiple_admins') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'workflows'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Enterprise Automation</span>
            {!hasBotFeature(planPrice, 'bot.enterprise_automation') && (
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'feed'
                ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Activity Feed</span>
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* REAL TELEMETRY USER METRICS CARDS (NO FAKE DATA) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Total Users */}
            <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Users</span>
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">
                {isLoadingStats ? '...' : stats.total_users}
              </div>
            </div>

            {/* New Today */}
            <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">New Today</span>
                <UserPlus className="w-3.5 h-3.5 text-cyan-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-cyan-600">
                {isLoadingStats ? '...' : stats.new_users_today}
              </div>
            </div>

            {/* Active 24h */}
            <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active (24h)</span>
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {isLoadingStats ? '...' : stats.active_users_24h}
              </div>
            </div>

            {/* Messages Today */}
            <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Messages Today</span>
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-600">
                {isLoadingStats ? '...' : stats.messages_today}
              </div>
            </div>

            {/* New This Week */}
            <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">New This Week</span>
                <Calendar className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-600">
                {isLoadingStats ? '...' : stats.new_users_this_week}
              </div>
            </div>
          </div>

          {/* USERS DIRECTORY VIEW */}
          <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden flex flex-col">
            {/* Search & Filter Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search Telegram ID, username, name..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span>Status:</span>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-2xs"
                >
                  <option value="ALL">All Users</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="BLOCKED">Blocked Only</option>
                </select>

                <button
                  onClick={loadUsers}
                  disabled={isLoadingUsers}
                  className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-colors shadow-2xs"
                  title="Refresh Table"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-2 border-b border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Users Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Telegram ID</th>
                    <th className="py-3 px-4">First Seen</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading verified users from database...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-2">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-800">No Telegram users yet</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                          {searchTerm
                            ? 'No users match your search criteria.'
                            : `When Telegram users send /start to @${bot.telegram_username}, they will automatically appear here.`}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Telegram User';
                      return (
                        <tr
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="hover:bg-sky-50/40 cursor-pointer transition-colors group"
                        >
                          {/* User Identity Column */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{name}</span>
                                  {u.is_premium && (
                                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[11px] text-blue-600 font-semibold truncate">
                                  {u.username ? `@${u.username}` : <span className="text-slate-400 italic font-normal">no username</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Telegram User ID */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                            {u.telegram_user_id}
                          </td>

                          {/* First Seen */}
                          <td className="py-3.5 px-4 text-slate-500">
                            {formatRelative(u.first_seen_at)}
                          </td>

                          {/* Last Active */}
                          <td className="py-3.5 px-4 text-slate-700 font-semibold">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatRelative(u.last_seen_at)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                u.status === 'BLOCKED'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${
                                  u.status === 'BLOCKED' ? 'bg-red-500' : 'bg-emerald-500'
                                }`}
                              />
                              {u.status}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(u);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                              title="Inspect Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {users.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                {Math.min(currentPage * pageSize, totalUsersCount)} of {totalUsersCount} users
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoadingUsers}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoadingUsers}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 shadow-2xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADVANCED ANALYTICS (PHASE 5) */}
      {activeTab === 'analytics' && (
        <BotAdvancedAnalytics
          bot={bot}
          planPrice={planPrice}
          onOpenPlanComparison={() => setIsPlanModalOpen(true)}
        />
      )}

      {/* BROADCASTS ENGINE */}
      {activeTab === 'broadcasts' && (
        !hasBotFeature(planPrice, 'bot.broadcast') ? (
          <FeatureLockOverlay
            currentPlanPrice={planPrice}
            featureKey="bot.broadcast"
            onOpenPlanComparison={() => setIsPlanModalOpen(true)}
          />
        ) : (
          <BotBroadcastManager bot={bot} />
        )
      )}

      {/* CAMPAIGNS MANAGER */}
      {activeTab === 'campaigns' && (
        !hasBotFeature(planPrice, 'bot.campaigns') ? (
          <FeatureLockOverlay
            currentPlanPrice={planPrice}
            featureKey="bot.campaigns"
            onOpenPlanComparison={() => setIsPlanModalOpen(true)}
          />
        ) : (
          <BotCampaignsManager bot={bot} />
        )
      )}

      {/* REFERRALS & LEADERBOARD */}
      {activeTab === 'referrals' && (
        !hasBotFeature(planPrice, 'bot.basic_referrals') ? (
          <FeatureLockOverlay
            currentPlanPrice={planPrice}
            featureKey="bot.basic_referrals"
            onOpenPlanComparison={() => setIsPlanModalOpen(true)}
          />
        ) : (
          <BotReferralsManager bot={bot} />
        )
      )}

      {/* COMMANDS ENGINE */}
      {activeTab === 'commands' && (
        !hasBotFeature(planPrice, 'bot.commands') ? (
          <FeatureLockOverlay
            currentPlanPrice={planPrice}
            featureKey="bot.commands"
            onOpenPlanComparison={() => setIsPlanModalOpen(true)}
          />
        ) : (
          <BotCommandsManager bot={bot} />
        )
      )}

      {/* MENU BUILDER */}
      {activeTab === 'menus' && (
        !hasBotFeature(planPrice, 'bot.menus') ? (
          <FeatureLockOverlay
            currentPlanPrice={planPrice}
            featureKey="bot.menus"
            onOpenPlanComparison={() => setIsPlanModalOpen(true)}
          />
        ) : (
          <BotMenuBuilder bot={bot} />
        )
      )}

      {/* AUTO-REPLIES */}
      {activeTab === 'replies' && (
        !hasBotFeature(planPrice, 'bot.auto_replies') ? (
          <FeatureLockOverlay
            currentPlanPrice={planPrice}
            featureKey="bot.auto_replies"
            onOpenPlanComparison={() => setIsPlanModalOpen(true)}
          />
        ) : (
          <BotAutoRepliesManager bot={bot} />
        )
      )}

      {/* STAFF & ADMIN CONTROLS (PHASE 5) */}
      {activeTab === 'admin' && (
        <BotAdminControls
          bot={bot}
          planPrice={planPrice}
          onOpenPlanComparison={() => setIsPlanModalOpen(true)}
        />
      )}

      {/* ENTERPRISE AUTOMATION COMMAND CENTER (PHASE 6) */}
      {activeTab === 'workflows' && (
        <EnterpriseCommandCenter
          bot={bot}
          planPrice={planPrice}
          onOpenPlanComparison={() => setIsPlanModalOpen(true)}
        />
      )}

      {/* LIVE ACTIVITY FEED */}
      {activeTab === 'feed' && (
        <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
              <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                Real-Time Webhook Update Stream
              </h3>
            </div>
            <button
              onClick={loadEvents}
              disabled={isLoadingEvents}
              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <BotActivityFeed events={events} isLoading={isLoadingEvents} />
        </div>
      )}

      {/* USER DETAIL DRAWER */}
      <BotUserDetailDrawer
        user={selectedUser}
        botUsername={bot.telegram_username}
        onClose={() => setSelectedUser(null)}
        onStatusUpdated={(updated) => {
          setSelectedUser(updated);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        }}
      />

      {/* PLAN COMPARISON MATRIX MODAL */}
      <PlanComparisonModal
        currentPlanPrice={planPrice}
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
      />
    </div>
  );
};
