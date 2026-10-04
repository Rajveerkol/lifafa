import React, { useState } from 'react';
import {
  Gift,
  Plus,
  Trash2,
  Lock,
  Calendar,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Send,
  Youtube,
  Video,
  Instagram,
  Globe,
  UserPlus,
  ShieldCheck,
  Check,
  Palette,
  Settings,
  Layers,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { lifafaService, calculateLifafaPayoutFees, getLifafaPayoutFee } from '../services/lifafaService';
import type { DistributionType, TaskType, Lifafa, PayoutMode } from '../types/database';
import { formatCurrency } from '../lib/utils';
import { TelegramTaskBuilder, type VerifiedTelegramChannel } from '../components/lifafa/TelegramTaskBuilder';
import { YouTubeTaskBuilder } from '../components/lifafa/YouTubeTaskBuilder';
import { extractYouTubeVideoId } from '../utils/youtubeUtils';
import { ThemeSelector } from '../components/lifafa/ThemeSelector';
import { inferThemeFromContent } from '../themes/useThemeResolver';
import type { LifafaThemeId } from '../themes/types';

interface CreateLifafaPageProps {
  onSuccessCreated: (createdLifafa: any) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 1, label: 'Details', icon: Gift },
  { id: 2, label: 'Requirements', icon: Layers },
  { id: 3, label: 'Reward', icon: Sparkles },
  { id: 4, label: 'Settings', icon: Settings },
  { id: 5, label: 'Review', icon: CheckCircle2 },
];

export const CreateLifafaPage: React.FC<CreateLifafaPageProps> = ({
  onSuccessCreated,
  onCancel,
}) => {
  const { user, wallet, refreshWallet } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Details
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<LifafaThemeId>('rewards');
  const [isThemeManuallySelected, setIsThemeManuallySelected] = useState(false);

  // Step 2: Requirements (Tasks)
  const [showTelegramBuilder, setShowTelegramBuilder] = useState(false);
  const [showYouTubeBuilder, setShowYouTubeBuilder] = useState(false);
  const [tasks, setTasks] = useState<
    Array<{
      task_type: TaskType;
      title: string;
      description: string;
      target_url: string;
      youtube_video_id?: string;
      is_required: boolean;
      is_enabled: boolean;
      telegram_channel_username?: string;
      telegram_channel_id?: number;
      is_channel_verified?: boolean;
    }>
  >([]);

  // Step 3: Reward
  const [totalAmount, setTotalAmount] = useState('');
  const [winnerCount, setWinnerCount] = useState('');
  const [distributionType, setDistributionType] = useState<DistributionType>('EQUAL');
  const [payoutMode, setPayoutMode] = useState<PayoutMode>('WALLET');
  const [minClaimAmount, setMinClaimAmount] = useState('');
  const [maxClaimAmount, setMaxClaimAmount] = useState('');

  // Step 4: Settings
  const [isPublic, setIsPublic] = useState(true);
  const [pinCode, setPinCode] = useState('');
  const [showPinCode, setShowPinCode] = useState(false);
  const [allowCancel, setAllowCancel] = useState(true);
  const [showRemaining, setShowRemaining] = useState(true);
  const [creatorNote, setCreatorNote] = useState('');
  const [deviceLimit, setDeviceLimit] = useState<'1' | '2' | 'unlimited'>('1');

  // Submission State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableBalance = wallet?.available_balance ?? 0;
  const numTotalAmount = parseFloat(totalAmount) || 0;
  const numWinners = parseInt(winnerCount) || 1;
  const numMaxClaim = parseFloat(maxClaimAmount) || undefined;

  const estimatedPayoutFees = calculateLifafaPayoutFees(
    numTotalAmount,
    numWinners,
    distributionType,
    payoutMode,
    numMaxClaim
  );
  const totalFundingRequired = numTotalAmount + estimatedPayoutFees;

  // Perpetual non-expiring date (Year 9999) satisfies database NOT NULL constraint without enforcing visible expiration
  const computeExpiryDate = (): string => '9999-12-31T23:59:59.999Z';

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isThemeManuallySelected) {
      const inferred = inferThemeFromContent(val, message);
      setSelectedTheme(inferred);
    }
  };

  const handleMessageChange = (val: string) => {
    setMessage(val);
    if (!isThemeManuallySelected) {
      const inferred = inferThemeFromContent(title, val);
      setSelectedTheme(inferred);
    }
  };

  const handleThemeSelect = (themeId: LifafaThemeId) => {
    setSelectedTheme(themeId);
    setIsThemeManuallySelected(true);
  };

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

  const handleYouTubeWatchAdded = (data: { videoUrl: string; videoId: string; title: string }) => {
    setTasks([
      ...tasks,
      {
        task_type: 'YOUTUBE_WATCH',
        title: data.title || 'Watch YouTube Video',
        description: `[YOUTUBE_WATCH:${data.videoId}] Watch the complete video to unlock your claim.`,
        target_url: data.videoUrl,
        youtube_video_id: data.videoId,
        is_required: true,
        is_enabled: true,
      },
    ]);
    setShowYouTubeBuilder(false);
  };

  const handleAddTask = (type: TaskType) => {
    if (type === 'TELEGRAM_JOIN' || type === 'TELEGRAM_BOT') {
      setShowTelegramBuilder(true);
      return;
    }

    if (type === 'YOUTUBE_WATCH') {
      setShowYouTubeBuilder(true);
      return;
    }

    const titles: Record<TaskType, string> = {
      TELEGRAM_JOIN: 'Join Telegram Channel',
      TELEGRAM_BOT: 'Start Telegram Bot',
      YOUTUBE_SUB: 'Subscribe YouTube Channel',
      YOUTUBE_WATCH: 'Watch YouTube Video',
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

  const validateCurrentStep = (step: number): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (!title.trim()) {
        setErrorMsg('Lifafa title is required.');
        return false;
      }
      return true;
    }

    if (step === 2) {
      // Check unverified Telegram tasks
      const unverifiedTg = tasks.find(
        (t) => (t.task_type === 'TELEGRAM_JOIN' || t.task_type === 'TELEGRAM_BOT') && t.is_enabled && !t.is_channel_verified
      );
      if (unverifiedTg) {
        setErrorMsg('All enabled Telegram channels must be verified by adding @createlifafa_bot as administrator.');
        return false;
      }

      // Check invalid YouTube Watch tasks
      const invalidYt = tasks.find(
        (t) =>
          t.task_type === 'YOUTUBE_WATCH' &&
          t.is_enabled &&
          (!t.target_url || !extractYouTubeVideoId(t.target_url))
      );
      if (invalidYt) {
        setErrorMsg('Please enter a valid YouTube Video URL for all Watch Video requirements.');
        return false;
      }

      return true;
    }

    if (step === 3) {
      if (numTotalAmount <= 0) {
        setErrorMsg('Total amount must be greater than ₹0.');
        return false;
      }
      if (numWinners < 1) {
        setErrorMsg('Winner count must be at least 1.');
        return false;
      }
      if (totalFundingRequired > availableBalance) {
        setErrorMsg(
          `Insufficient available wallet balance (${formatCurrency(availableBalance)}). Required: ${formatCurrency(totalFundingRequired)} (Prize Pool: ${formatCurrency(numTotalAmount)}${estimatedPayoutFees > 0 ? ` + Payout Fees: ${formatCurrency(estimatedPayoutFees)}` : ''})`
        );
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 5) {
      return;
    }
    setErrorMsg(null);

    if (!user) {
      setErrorMsg('Please login to create a Lifafa.');
      return;
    }

    if (!validateCurrentStep(1) || !validateCurrentStep(2) || !validateCurrentStep(3)) {
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
          payoutMode,
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
      onSuccessCreated({ ...res, theme_id: selectedTheme });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create Lifafa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 md:pb-10">
      {/* Page Header with 3D Blue Gift Box & Playful Accents */}
      <div className="mb-6 p-5 sm:p-6 bg-gradient-to-r from-[#EEF5FF] via-[#F4F9FF] to-[#E0EDFD] border border-blue-100 rounded-3xl shadow-xs relative overflow-hidden flex items-center justify-between gap-4">
        <div className="relative z-10 space-y-1.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 text-blue-700 rounded-full text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Small Lifafa, Big Happiness!</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>Create Digital Lifafa</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md">
            Distribute rewards to your community with instant verification &amp; atomic wallet security.
          </p>
        </div>

        <div className="relative z-10 shrink-0 flex items-center gap-3">
          <img
            src="/images/lifafa_hero_gift.jpg"
            alt="Create Lifafa Gift"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl shadow-lg border-2 border-white drop-shadow-md animate-in zoom-in-95 duration-300"
          />
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl hover:bg-white/80 transition-colors cursor-pointer self-start"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* 5-Step Wizard Progress Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs mb-5">
        <div className="flex items-center justify-between relative">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;

            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.id < currentStep || validateCurrentStep(currentStep)) {
                      setCurrentStep(s.id);
                    }
                  }}
                  className={`flex flex-col items-center gap-1 relative z-10 transition-all cursor-pointer ${
                    isCurrent
                      ? 'scale-105'
                      : isCompleted
                      ? 'opacity-90'
                      : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-colors shadow-2xs ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white shadow-blue-500/25 ring-2 ring-blue-600/30'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-[10px] font-bold tracking-tight text-center hidden xs:inline ${
                      isCurrent ? 'text-blue-700' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-1 rounded-full transition-colors ${
                      currentStep > s.id ? 'bg-emerald-500' : 'bg-slate-100'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 mb-5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (currentStep === 5) {
            handleSubmit(e);
          }
        }}
        className="space-y-5"
      >
        {/* STEP 1: DETAILS */}
        {currentStep === 1 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Step 1: Lifafa Details</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Occasion & Message</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Choose your festive artwork and craft your greeting</p>
            </div>

            {/* Live 3D Red Envelope Preview Card - Reference Screenshot 1 */}
            <div className="bg-gradient-to-r from-rose-50 via-amber-50/50 to-orange-50 border border-rose-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
              <img
                src="/images/lifafa_envelope_preview.jpg"
                alt="Festive Envelope Preview"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-2xl shadow-md border border-white shrink-0"
              />
              <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider block">
                  Live Envelope Preview
                </span>
                <h4 className="text-sm font-black text-slate-900 truncate">
                  {title.trim() ? title : 'Your Lifafa Title Here'}
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2 italic">
                  {message.trim() ? `"${message}"` : '"Beautiful surprises create happier moments ❤️"'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lifafa Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Community Mega Giveaway 🎉"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Celebratory Message (Optional)
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => handleMessageChange(e.target.value)}
                placeholder="Add warm wishes, celebratory note, or instructions for claimants..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Theme & Occasion Selector */}
            <div className="pt-2 border-t border-slate-100">
              <ThemeSelector
                selectedTheme={selectedTheme}
                onSelectTheme={handleThemeSelect}
              />
            </div>
          </div>
        )}

        {/* STEP 2: REQUIREMENTS */}
        {currentStep === 2 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Step 2: Claim Requirements</span>
                  <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">Optional Tasks</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Require participants to join your channel or perform actions</p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>

            {/* Quick Task Add Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Add Tasks to Your Lifafa</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAddTask('TELEGRAM_JOIN')}
                  className="flex items-center gap-1.5 py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl border border-sky-200 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>+ Telegram Channel (Bot Verified)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddTask('YOUTUBE_SUB')}
                  className="flex items-center gap-1.5 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors cursor-pointer"
                >
                  <Youtube className="w-3.5 h-3.5 text-red-600" />
                  <span>+ YouTube Sub</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddTask('INSTAGRAM_FOLLOW')}
                  className="flex items-center gap-1.5 py-2 px-3 bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-bold rounded-xl border border-pink-200 transition-colors cursor-pointer"
                >
                  <Instagram className="w-3.5 h-3.5 text-pink-600" />
                  <span>+ Instagram Follow</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddTask('VISIT_WEBSITE')}
                  className="flex items-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Website Visit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddTask('REFERRAL')}
                  className="flex items-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Referral Task</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddTask('CUSTOM')}
                  className="flex items-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Custom</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddTask('YOUTUBE_WATCH')}
                  className="flex items-center gap-1.5 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5 text-red-600" />
                  <span>🎥 + Watch YouTube Video</span>
                </button>
              </div>
            </div>

            {/* Telegram Channel Verification Flow Builder */}
            {showTelegramBuilder && (
              <TelegramTaskBuilder
                onChannelVerified={handleTelegramChannelVerified}
                onCancel={() => setShowTelegramBuilder(false)}
              />
            )}

            {/* YouTube Video Watch Requirement Builder */}
            {showYouTubeBuilder && (
              <YouTubeTaskBuilder
                onAdd={handleYouTubeWatchAdded}
                onCancel={() => setShowYouTubeBuilder(false)}
              />
            )}

            {/* Configured Tasks List */}
            {tasks.length > 0 ? (
              <div className="space-y-3 pt-2">
                {tasks.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border space-y-3 ${
                      t.is_channel_verified
                        ? 'bg-sky-50/50 border-sky-200'
                        : t.task_type === 'YOUTUBE_WATCH'
                        ? 'bg-red-50/30 border-red-200'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Task {idx + 1}: {t.task_type === 'YOUTUBE_WATCH' ? 'Watch YouTube Video' : t.task_type.replace('_', ' ')}
                        </span>
                        {t.is_channel_verified && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Bot Admin Verified
                          </span>
                        )}
                        {t.task_type === 'YOUTUBE_WATCH' && (
                          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Youtube className="w-3 h-3 text-red-600" />
                            Video Watch
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
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
                        onChange={(e) => {
                          const val = e.target.value;
                          const vid = extractYouTubeVideoId(val);
                          handleUpdateTask(idx, 'target_url', val);
                          if (t.task_type === 'YOUTUBE_WATCH' && vid) {
                            handleUpdateTask(idx, 'youtube_video_id', vid);
                            handleUpdateTask(idx, 'description', `[YOUTUBE_WATCH:${vid}] Watch complete video to unlock claim.`);
                          }
                        }}
                        placeholder={t.task_type === 'YOUTUBE_WATCH' ? "YouTube Video URL (e.g. https://youtube.com/watch?v=...)" : "Target URL (e.g. https://t.me/...)"}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                        required
                      />
                    </div>

                    {/* Preview for YouTube Watch Task */}
                    {t.task_type === 'YOUTUBE_WATCH' && t.target_url && extractYouTubeVideoId(t.target_url) && (
                      <div className="relative w-full aspect-video max-w-xs rounded-xl overflow-hidden bg-black border border-slate-200 shadow-xs">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${extractYouTubeVideoId(t.target_url)}?rel=0`}
                          title="YouTube Video Preview"
                          className="w-full h-full border-0 pointer-events-none"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={t.is_required}
                          onChange={(e) => handleUpdateTask(idx, 'is_required', e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="font-semibold text-slate-700">Mandatory requirement to claim</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                <p className="text-xs text-slate-500">No tasks added yet. Participants will be able to claim instantly without requirements.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: REWARD */}
        {currentStep === 3 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Step 3: Reward & Distribution</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Budget</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Specify prize pool, winners count, and delivery mode</p>
              </div>
              <span className="text-xs text-slate-500">
                Wallet: <strong className="text-blue-700">{formatCurrency(availableBalance)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Pool Amount (₹) <span className="text-red-500">*</span>
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
                  Number of Winners <span className="text-red-500">*</span>
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

            {/* Reward Destination (Payout Mode) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Reward Destination
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPayoutMode('UPI_BANK')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    payoutMode === 'UPI_BANK'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-bold text-slate-900">UPI / Bank Payout</span>
                    </div>
                    {payoutMode === 'UPI_BANK' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Winners claim straight to their bank account / UPI VPA.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPayoutMode('WALLET')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    payoutMode === 'WALLET'
                      ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="text-xs font-bold text-slate-900">Createlifafa Wallet</span>
                    </div>
                    {payoutMode === 'WALLET' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Instant crediting into claimant&apos;s digital wallet.
                  </p>
                </button>
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
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
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
                    Every winner gets ₹{numTotalAmount > 0 ? (numTotalAmount / numWinners).toFixed(2) : '0.00'}.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionType('RANDOM')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    distributionType === 'RANDOM'
                      ? 'border-purple-600 bg-purple-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">🎲 Lucky Draw</span>
                    {distributionType === 'RANDOM' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Randomized lucky sums with sum guarantee.
                  </p>
                </button>
              </div>
            </div>

            {/* Optional Min/Max Claim Bounds for Random Distribution */}
            {distributionType === 'RANDOM' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Min / Claim (₹)
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
                    Max / Claim (₹)
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

            {/* Funding & Payout Fee Summary Card */}
            {numTotalAmount > 0 && numWinners > 0 && (
              <div className="p-4 rounded-2xl border transition-all space-y-2.5 bg-slate-50 border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Prize Pool:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(numTotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-600">Estimated Payout Fees:</span>
                    {payoutMode === 'UPI_BANK' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                        {numWinners} claims × ₹{distributionType === 'EQUAL' ? getLifafaPayoutFee(numTotalAmount / numWinners).toFixed(2) : getLifafaPayoutFee(numTotalAmount / numWinners).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className={`font-bold ${payoutMode === 'UPI_BANK' ? 'text-amber-700' : 'text-emerald-600'}`}>
                    {payoutMode === 'UPI_BANK' ? formatCurrency(estimatedPayoutFees) : '₹0.00 (Wallet Free)'}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs">
                  <span className="font-black text-slate-800">Total Required Funding:</span>
                  <span className="text-sm font-black text-blue-700">{formatCurrency(totalFundingRequired)}</span>
                </div>
                {payoutMode === 'UPI_BANK' && (
                  <p className="text-[11px] text-slate-500 italic pt-0.5">
                    * Payout fees are reserved in escrow and only recognized when a winner claims. Any unclaimed fees are fully refunded when the Lifafa closes.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: SETTINGS */}
        {currentStep === 4 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Step 4: Privacy & Protection</span>
                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Security</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Control fraud prevention, PIN access, and feed visibility</p>
            </div>

            {/* Anti-Farming Device Limit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Device Anti-Farming Protection
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
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      deviceLimit === opt.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PIN Code */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="creator-pin-code" className="block text-xs font-bold text-slate-700">
                  Claim Protection PIN (Optional)
                </label>
                {pinCode && (
                  <span className="text-[10px] font-semibold text-slate-500">
                    {showPinCode ? 'PIN Visible' : 'PIN Hidden'}
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  id="creator-pin-code"
                  type={showPinCode ? 'text' : 'password'}
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-6 digit passcode required to claim"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal caret-slate-900 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all [color-scheme:light]"
                />
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setShowPinCode(!showPinCode)}
                  aria-label={showPinCode ? 'Hide PIN' : 'Reveal PIN'}
                  className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  {showPinCode ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                If configured, claimants must enter this exact PIN to unlock and claim the Lifafa.
              </p>
            </div>

            {/* Public vs Private */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-bold text-slate-800">Public Lifafa Feed</span>
                <p className="text-[11px] text-slate-500">Display in public explore feed</p>
              </div>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Show Remaining Amount Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Show Remaining Pool Amount</span>
                <p className="text-[11px] text-slate-500">Show balance left to claimants</p>
              </div>
              <input
                type="checkbox"
                checked={showRemaining}
                onChange={(e) => setShowRemaining(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Allow Cancel */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Allow Creator Cancellation</span>
                <p className="text-[11px] text-slate-500">Refund unclaimed funds back to wallet</p>
              </div>
              <input
                type="checkbox"
                checked={allowCancel}
                onChange={(e) => setAllowCancel(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Creator internal note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Internal Tracking Note (Private)
              </label>
              <input
                type="text"
                value={creatorNote}
                onChange={(e) => setCreatorNote(e.target.value)}
                placeholder="Optional private label for your dashboard"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW */}
        {currentStep === 5 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-5 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Step 5: Review & Confirm</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Final Check</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Verify your Lifafa configuration before fund reservation</p>
            </div>

            {/* Summary Card */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Lifafa Title</span>
                <span className="text-xs font-black text-slate-900">{title}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Selected Theme</span>
                <span className="text-xs font-bold text-indigo-700 uppercase bg-indigo-50 px-2 py-0.5 rounded-md">{selectedTheme}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Prize Pool</span>
                <span className="text-sm font-black text-slate-900">{formatCurrency(numTotalAmount)}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Estimated Payout Fees</span>
                <span className={`text-xs font-bold ${payoutMode === 'UPI_BANK' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {payoutMode === 'UPI_BANK' ? formatCurrency(estimatedPayoutFees) : '₹0.00 (Wallet Free)'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Total Required Funding</span>
                <span className="text-base font-black text-blue-700">{formatCurrency(totalFundingRequired)}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Winners & Distribution</span>
                <span className="text-xs font-bold text-slate-800">
                  {numWinners} winners ({distributionType === 'EQUAL' ? `₹${(numTotalAmount / numWinners).toFixed(2)} each` : 'Lucky Draw'})
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Reward Destination</span>
                <span className="text-xs font-bold text-slate-800">{payoutMode === 'UPI_BANK' ? 'Direct UPI / Bank' : 'Createlifafa Wallet'}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-500">Tasks Required</span>
                <span className="text-xs font-bold text-slate-800">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">PIN Protection</span>
                <span className="text-xs font-bold text-slate-800">{pinCode ? 'Enabled 🔒' : 'None'}</span>
              </div>
            </div>

            {/* Atomic Wallet Deductions Note */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-emerald-800 font-bold block">Total Wallet Reservation:</span>
                <span className="text-[11px] text-emerald-600">
                  {payoutMode === 'UPI_BANK'
                    ? `Prize Pool: ${formatCurrency(numTotalAmount)} + Payout Fees: ${formatCurrency(estimatedPayoutFees)}`
                    : 'No external payout fees (₹0.00)'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-emerald-700">{formatCurrency(totalFundingRequired)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex items-center gap-1.5 py-3 px-5 rounded-2xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex items-center gap-1.5 py-3.5 px-6 rounded-2xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 active:scale-98 transition-all cursor-pointer"
            >
              <span>Next: {STEPS[currentStep].label}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || numTotalAmount <= 0 || numTotalAmount > availableBalance}
              className="flex items-center gap-2 py-3.5 px-7 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/30 active:scale-98 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reserving Funds...</span>
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>Create Lifafa & Reserve {formatCurrency(numTotalAmount)}</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
