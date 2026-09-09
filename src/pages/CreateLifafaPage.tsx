import React, { useState } from 'react';
import {
  Gift,
  Plus,
  Trash2,
  Lock,
  Calendar,
  AlertCircle,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Youtube,
  Instagram,
  Globe,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { lifafaService } from '../services/lifafaService';
import type { DistributionType, TaskType, Lifafa } from '../types/database';
import { formatCurrency } from '../lib/utils';
import { TelegramTaskBuilder, type VerifiedTelegramChannel } from '../components/lifafa/TelegramTaskBuilder';

interface CreateLifafaPageProps {
  onSuccessCreated: (createdLifafa: any) => void;
  onCancel: () => void;
}

export const CreateLifafaPage: React.FC<CreateLifafaPageProps> = ({
  onSuccessCreated,
  onCancel,
}) => {
  const { user, wallet, refreshWallet } = useAuth();

  // Basic Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [winnerCount, setWinnerCount] = useState('');
  const [distributionType, setDistributionType] = useState<DistributionType>('EQUAL');

  // Tasks Builder & Telegram Modal
  const [showTelegramBuilder, setShowTelegramBuilder] = useState(false);
  const [tasks, setTasks] = useState<
    Array<{
      task_type: TaskType;
      title: string;
      description: string;
      target_url: string;
      is_required: boolean;
      is_enabled: boolean;
      telegram_channel_username?: string;
      telegram_channel_id?: number;
      is_channel_verified?: boolean;
    }>
  >([]);

  // Advanced Settings State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [pinCode, setPinCode] = useState('');
  const [allowCancel, setAllowCancel] = useState(true);
  const [showRemaining, setShowRemaining] = useState(true);
  const [creatorNote, setCreatorNote] = useState('');
  const [deviceLimit, setDeviceLimit] = useState<'1' | '2' | 'unlimited'>('1');
  const [minClaimAmount, setMinClaimAmount] = useState('');
  const [maxClaimAmount, setMaxClaimAmount] = useState('');

  // Submission State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = wallet?.available_balance ?? 0;
  const numTotalAmount = parseFloat(totalAmount) || 0;
  const numWinners = parseInt(winnerCount) || 1;

  // Perpetual non-expiring date (Year 9999) satisfies database NOT NULL constraint without enforcing visible expiration
  const computeExpiryDate = (): string => '9999-12-31T23:59:59.999Z';

  const handleTelegramChannelVerified = (channel: VerifiedTelegramChannel) => {
    setTasks([
      ...tasks,
      {
        task_type: 'TELEGRAM_JOIN',
        title: `Join @${channel.channelUsername}`,
        description: `Official Telegram Channel: ${channel.channelTitle}`,
        target_url: `https://t.me/${channel.channelUsername}`,
        is_required: true,
        is_enabled: true,
        telegram_channel_username: channel.channelUsername,
        telegram_channel_id: channel.channelId,
        is_channel_verified: true,
      },
    ]);
    setShowTelegramBuilder(false);
  };

  const handleAddTask = (type: TaskType) => {
    if (type === 'TELEGRAM_JOIN' || type === 'TELEGRAM_BOT') {
      setShowTelegramBuilder(true);
      return;
    }

    const titles: Record<TaskType, string> = {
      TELEGRAM_JOIN: 'Join Telegram Channel',
      TELEGRAM_BOT: 'Start Telegram Bot',
      YOUTUBE_SUB: 'Subscribe YouTube Channel',
      INSTAGRAM_FOLLOW: 'Follow on Instagram',
      INSTAGRAM_LIKE: 'Like Instagram Post',
      REFERRAL: 'Invite 1 Friend',
      VISIT_WEBSITE: 'Visit Website',
      CUSTOM: 'Custom Community Task',
    };

    setTasks([
      ...tasks,
      {
        task_type: type,
        title: titles[type] || 'Task',
        description: '',
        target_url: '',
        is_required: true,
        is_enabled: true,
      },
    ]);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleUpdateTask = (index: number, field: string, val: any) => {
    const updated = [...tasks];
    (updated[index] as any)[field] = val;
    setTasks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      setErrorMsg('Please login to create a Lifafa.');
      return;
    }

    // Check Telegram tasks verification
    const unverifiedTg = tasks.find(
      (t) => (t.task_type === 'TELEGRAM_JOIN' || t.task_type === 'TELEGRAM_BOT') && t.is_enabled && !t.is_channel_verified
    );
    if (unverifiedTg) {
      setErrorMsg('All enabled Telegram channels must be verified by adding @createlifafa_bot as administrator.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Lifafa title is required.');
      return;
    }

    if (numTotalAmount <= 0) {
      setErrorMsg('Total amount must be greater than ₹0.');
      return;
    }

    if (numWinners < 1) {
      setErrorMsg('Winner count must be at least 1.');
      return;
    }

    if (numTotalAmount > availableBalance) {
      setErrorMsg(
        `Insufficient available wallet balance (${formatCurrency(availableBalance)}). Required: ${formatCurrency(numTotalAmount)}`
      );
      return;
    }

    try {
      setLoading(true);
      const idempotencyKey = `create_${user.id}_${Date.now()}`;

      const numDeviceLimit = deviceLimit === 'unlimited' ? 0 : parseInt(deviceLimit, 10);
      const numMinClaim = parseFloat(minClaimAmount) || undefined;
      const numMaxClaim = parseFloat(maxClaimAmount) || undefined;

      const res = await lifafaService.createLifafa(
        {
          title: title.trim(),
          message: message.trim(),
          totalAmount: numTotalAmount,
          winnerCount: numWinners,
          distributionType,
          expiresAt: computeExpiryDate(),
          isPublic,
          pinCode: pinCode.trim() || undefined,
          allowCancel,
          showRemaining,
          creatorNote: creatorNote.trim() || undefined,
          startsAt: undefined,
          deviceClaimLimit: numDeviceLimit,
          minClaimAmount: numMinClaim,
          maxClaimAmount: numMaxClaim,
          tasks: tasks.filter((t) => t.is_enabled),
        },
        idempotencyKey
      );

      await refreshWallet();
      onSuccessCreated(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create Lifafa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 md:pb-10">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Gift className="w-6 h-6 text-blue-600" />
            <span>Create Digital Lifafa</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribute rewards to your community with atomic wallet security
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Basic Information Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
            1. Lifafa Details
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lifafa Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Telegram Channel Launch Celebration 🎉"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Custom Message (Optional)
            </label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add warm wishes, celebratory note, or instructions for claimants..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Section 2: Distribution & Financial Amounts */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              2. Reward & Distribution
            </h3>
            <span className="text-xs text-slate-500">
              Available Wallet: <strong className="text-blue-700">{formatCurrency(availableBalance)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Pool Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="500.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Number of Winners *
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={winnerCount}
                onChange={(e) => setWinnerCount(e.target.value)}
                placeholder="100"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-hidden focus:border-blue-500 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Distribution Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Distribution Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDistributionType('EQUAL')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  distributionType === 'EQUAL'
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">Equal Distribution</span>
                  {distributionType === 'EQUAL' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Every winner gets exactly the same share (e.g. ₹{numTotalAmount > 0 ? (numTotalAmount / numWinners).toFixed(2) : '5.00'}).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDistributionType('RANDOM')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  distributionType === 'RANDOM'
                    ? 'border-purple-600 bg-purple-50/70 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">🎲 Random Lucky Draw</span>
                  {distributionType === 'RANDOM' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Server generates random allocations guaranteeing exact sum.
                </p>
              </button>
            </div>
          </div>

          {/* Real-time Server Validation Disclaimer */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-[11px] text-blue-800 leading-relaxed flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Atomic Concurrency Guarantee:</strong> Your ₹{numTotalAmount || 0} will be
              authoritatively reserved server-side in your wallet upon creation. The sum of all
              distributed portions is mathematically guaranteed to equal the reserved amount.
            </div>
          </div>
        </div>

        {/* Section 3: Engagement Tasks */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                3. Engagement Tasks
              </h3>
              <p className="text-[11px] text-slate-500">Require users to complete actions before claiming</p>
            </div>

            <span className="text-xs font-bold text-slate-600">
              {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>

          {/* Quick Task Add Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAddTask('TELEGRAM_JOIN')}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl border border-sky-200 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>+ Telegram Channel (Bot Verified)</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddTask('YOUTUBE_SUB')}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors"
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>+ YouTube Sub</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddTask('INSTAGRAM_FOLLOW')}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-bold rounded-xl border border-pink-200 transition-colors"
            >
              <Instagram className="w-3.5 h-3.5" />
              <span>+ Instagram Follow</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddTask('VISIT_WEBSITE')}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>+ Website Visit</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddTask('REFERRAL')}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Referral Task</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddTask('CUSTOM')}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Custom</span>
            </button>
          </div>

          {/* Real-time Telegram Verification Flow Builder */}
          {showTelegramBuilder && (
            <TelegramTaskBuilder
              onChannelVerified={handleTelegramChannelVerified}
              onCancel={() => setShowTelegramBuilder(false)}
            />
          )}

          {/* Configured Tasks List */}
          {tasks.length > 0 && (
            <div className="space-y-3 pt-2">
              {tasks.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    t.is_channel_verified ? 'bg-sky-50/50 border-sky-200' : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Task {idx + 1}: {t.task_type.replace('_', ' ')}
                      </span>
                      {t.is_channel_verified && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Bot Admin Verified
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(idx)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={t.title}
                      onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                      placeholder="Task Title"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                      required
                    />
                    <input
                      type="url"
                      value={t.target_url}
                      onChange={(e) => handleUpdateTask(idx, 'target_url', e.target.value)}
                      placeholder="Target URL (e.g. https://t.me/...)"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={t.is_required}
                        onChange={(e) => handleUpdateTask(idx, 'is_required', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-700">Mandatory to claim</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Advanced Settings Accordion */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
          >
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">4. Advanced Settings</h3>
              <p className="text-[11px] text-slate-500">Security PIN, Privacy & Creator Controls</p>
            </div>
            {showAdvanced ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showAdvanced && (
            <div className="p-5 sm:p-6 pt-0 space-y-4 border-t border-slate-100">
              {/* Anti-Farming Device Limit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Device &amp; IP Anti-Farming Limit
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '1', label: '1 Claim / Device' },
                    { id: '2', label: '2 Claims / Device' },
                    { id: 'unlimited', label: 'No Limit' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDeviceLimit(opt.id as any)}
                      className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition-all ${
                        deviceLimit === opt.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Min/Max Claim Bounds for Random Distribution */}
              {distributionType === 'RANDOM' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Min Amount / Claim (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={minClaimAmount}
                      onChange={(e) => setMinClaimAmount(e.target.value)}
                      placeholder="e.g. 1.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Max Amount / Claim (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={maxClaimAmount}
                      onChange={(e) => setMaxClaimAmount(e.target.value)}
                      placeholder="e.g. 50.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Public vs Private */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-bold text-slate-800">Public Lifafa Feed</span>
                  <p className="text-[11px] text-slate-500">Show on public explore page for all users</p>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>

              {/* Show Remaining Amount Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Show Remaining Amount</span>
                  <p className="text-[11px] text-slate-500">Display remaining prize pool to claimants</p>
                </div>
                <input
                  type="checkbox"
                  checked={showRemaining}
                  onChange={(e) => setShowRemaining(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>

              {/* Allow Cancel */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Allow Creator Cancellation</span>
                  <p className="text-[11px] text-slate-500">Refund unused funds back to wallet if cancelled</p>
                </div>
                <input
                  type="checkbox"
                  checked={allowCancel}
                  onChange={(e) => setAllowCancel(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>

              {/* PIN Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Claim Protection PIN (Optional)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="Set a 4-6 digit passcode to restrict claiming"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              {/* Creator internal note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Creator Internal Reference (Private)
                </label>
                <input
                  type="text"
                  value={creatorNote}
                  onChange={(e) => setCreatorNote(e.target.value)}
                  placeholder="Optional internal tracking label"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>
            </div>
          )}
        </div>

        {/* Fee & Final Submission */}
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/80 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Platform Creation Fee:</span>
            <strong className="text-slate-800 ml-1">₹0.00 (Free)</strong>
          </div>
          <div>
            <span className="text-slate-500">Total Wallet Deduction:</span>
            <strong className="text-blue-700 font-extrabold ml-1 text-sm">
              {formatCurrency(numTotalAmount)}
            </strong>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || numTotalAmount <= 0 || numTotalAmount > availableBalance}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Reserving Funds & Creating Lifafa...</span>
            </>
          ) : (
            <>
              <Gift className="w-5 h-5" />
              <span>Create Lifafa & Reserve {formatCurrency(numTotalAmount)}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
