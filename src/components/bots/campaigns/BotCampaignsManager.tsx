import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Plus,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  ExternalLink,
  Loader2,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  TelegramBot,
  BotCampaign,
  BotCampaignInput,
  BotMenuButton,
  BotCampaignParticipant,
} from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { TelegramMessagePreview } from '../automation/TelegramMessagePreview';

interface BotCampaignsManagerProps {
  bot: TelegramBot;
}

export const BotCampaignsManager: React.FC<BotCampaignsManagerProps> = ({ bot }) => {
  const [campaigns, setCampaigns] = useState<BotCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [messageText, setMessageText] = useState('');
  const [buttons, setButtons] = useState<BotMenuButton[][]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Participants Drawer
  const [inspectCampaign, setInspectCampaign] = useState<BotCampaign | null>(null);
  const [participants, setParticipants] = useState<BotCampaignParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await telegramBotService.getBotCampaigns(bot.id);
      setCampaigns(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadCampaigns();
    const unsub = telegramBotService.subscribeToBotCampaigns(bot.id, () => {
      loadCampaigns();
    });
    return () => {
      unsub();
    };
  }, [loadCampaigns, bot.id]);

  const handleOpenCreate = () => {
    const now = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    setName('');
    setDescription('');
    setMessageText('🎉 Exclusive Community Campaign is now Live! Participate now for bonus rewards.');
    setButtons([
      [
        {
          id: Math.random().toString(36).slice(2, 7),
          text: 'Participate Now',
          type: 'CALLBACK',
          value: 'cb_camp_join',
        },
      ],
    ]);
    setStartAt(now.toISOString().slice(0, 16));
    setEndAt(nextWeek.toISOString().slice(0, 16));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await telegramBotService.deleteBotCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete campaign');
    }
  };

  const handleInspectParticipants = async (camp: BotCampaign) => {
    setInspectCampaign(camp);
    setIsLoadingParticipants(true);
    try {
      const parts = await telegramBotService.getCampaignParticipants(camp.id, 50);
      setParticipants(parts);
    } catch (err: any) {
      console.warn('Participants error:', err.message);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Campaign name is required');
      return;
    }
    if (!messageText.trim()) {
      setFormError('Campaign message text is required');
      return;
    }
    if (!startAt || !endAt) {
      setFormError('Start date and end date are both required');
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setFormError('End date must be after the start date');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: BotCampaignInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        message_text: messageText.trim(),
        buttons: buttons,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
      };

      const created = await telegramBotService.createBotCampaign(bot.id, input);
      setCampaigns((prev) => [created, ...prev]);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span>Telegram Campaigns</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Create structured engagement campaigns, limited-time promotions, and track real participants
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Create Campaign</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
          <Target className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="font-bold text-xs text-slate-700">No campaigns launched yet</div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Run giveaways, holiday events, or milestone celebrations with automated participant tracking.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch First Campaign</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((camp) => {
            const now = new Date();
            const start = new Date(camp.start_at);
            const end = new Date(camp.end_at);
            const isActive = now >= start && now <= end && camp.status !== 'CANCELLED';

            return (
              <div
                key={camp.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 block truncate">
                        {camp.name}
                      </span>
                      {camp.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{camp.description}</p>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : now < start
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isActive ? 'Active Now' : now < start ? 'Upcoming' : 'Ended'}
                    </span>
                  </div>

                  {/* Message box */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 font-mono line-clamp-2">
                    {camp.message_text}
                  </div>

                  {/* Dates & Participant Count */}
                  <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Timeline</span>
                      <div className="font-medium text-slate-700 text-[11px]">
                        {start.toLocaleDateString()} — {end.toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Participants</span>
                      <div className="font-mono font-extrabold text-blue-600">
                        {camp.total_participants} joined
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleInspectParticipants(camp)}
                    className="text-blue-600 hover:underline font-bold text-[11px] flex items-center gap-1"
                  >
                    <span>View Participants ({camp.total_participants})</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => handleDeleteCampaign(camp.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-sky-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Target className="w-5 h-5 text-cyan-200" />
                <h3 className="font-extrabold text-base tracking-tight">Create Telegram Campaign</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="p-6 space-y-4 lg:col-span-7 border-r border-slate-100">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Campaign Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Diwali Lifafa Celebration"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Description (Optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Exclusive bonus campaign for verified subscribers"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">End Date & Time</label>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Campaign Message Prompt</label>
                  <textarea
                    rows={4}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Message shown when campaign is presented to Telegram users..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-98 flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save & Activate Campaign</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Preview Column */}
              <div className="p-6 bg-slate-50 flex flex-col justify-center items-center lg:col-span-5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Live Telegram Preview
                </div>
                <TelegramMessagePreview
                  botName={bot.telegram_display_name}
                  botUsername={bot.telegram_username}
                  messageText={messageText}
                  buttons={buttons}
                  menuType="INLINE"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PARTICIPANTS INSPECTION DRAWER */}
      {inspectCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  Participants: {inspectCampaign.name}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {participants.length} verified participants recorded
                </p>
              </div>
              <button
                onClick={() => setInspectCampaign(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {isLoadingParticipants ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading verified participants...
                </div>
              ) : participants.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No users have participated in this campaign yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {participants.map((part) => (
                    <div
                      key={part.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-800">
                          Telegram User #{part.telegram_user_id}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Joined {new Date(part.joined_at).toLocaleString()}
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {part.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
