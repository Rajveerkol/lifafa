import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Plus,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  ShieldAlert,
  Search,
  Filter,
} from 'lucide-react';
import {
  TelegramBot,
  BotBroadcast,
  BotBroadcastInput,
  BroadcastAudience,
  BotMenuButton,
  BotBroadcastRecipient,
} from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { TelegramMessagePreview } from '../automation/TelegramMessagePreview';

interface BotBroadcastManagerProps {
  bot: TelegramBot;
}

const AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string; desc: string }[] = [
  { value: 'ALL_ACTIVE_USERS', label: 'All Active Users', desc: 'Broadcast to all unblocked bot subscribers' },
  { value: 'ACTIVE_24H', label: 'Active in Last 24 Hours', desc: 'Engaged users who sent updates today' },
  { value: 'ACTIVE_7D', label: 'Active in Last 7 Days', desc: 'Users active over the past week' },
  { value: 'NEW_USERS', label: 'New Subscribers (48h)', desc: 'Users who first registered recently' },
];

export const BotBroadcastManager: React.FC<BotBroadcastManagerProps> = ({ bot }) => {
  const [broadcasts, setBroadcasts] = useState<BotBroadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Composer Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [buttons, setButtons] = useState<BotMenuButton[][]>([]);
  const [audience, setAudience] = useState<BroadcastAudience>('ALL_ACTIVE_USERS');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Safety Confirmation Dialog State
  const [confirmBroadcast, setConfirmBroadcast] = useState<BotBroadcast | null>(null);
  const [isCalculatingAudience, setIsCalculatingAudience] = useState(false);
  const [calculatedRecipients, setCalculatedRecipients] = useState<number | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  // Recipient Inspection Drawer
  const [inspectBroadcast, setInspectBroadcast] = useState<BotBroadcast | null>(null);
  const [recipients, setRecipients] = useState<BotBroadcastRecipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

  const loadBroadcasts = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await telegramBotService.getBotBroadcasts(bot.id);
      setBroadcasts(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load broadcasts');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadBroadcasts();
    const unsub = telegramBotService.subscribeToBotBroadcasts(bot.id, () => {
      loadBroadcasts();
    });
    return () => {
      unsub();
    };
  }, [loadBroadcasts, bot.id]);

  const handleOpenComposer = () => {
    setTitle('');
    setMessageText('');
    setPhotoUrl('');
    setButtons([]);
    setAudience('ALL_ACTIVE_USERS');
    setIsScheduled(false);
    setScheduledAt('');
    setComposerError(null);
    setIsComposerOpen(true);
  };

  const handleAddButtonRow = () => {
    setButtons((prev) => [
      ...prev,
      [
        {
          id: Math.random().toString(36).slice(2, 7),
          text: 'Visit Channel',
          type: 'URL',
          value: 'https://t.me/lifafaclub',
        },
      ],
    ]);
  };

  const handleAddButtonToRow = (rowIndex: number) => {
    setButtons((prev) => {
      const copy = [...prev];
      if (copy[rowIndex] && copy[rowIndex].length < 3) {
        copy[rowIndex].push({
          id: Math.random().toString(36).slice(2, 7),
          text: 'Option',
          type: 'COMMAND',
          value: '/menu',
        });
      }
      return copy;
    });
  };

  const handleRemoveButton = (rowIndex: number, btnIndex: number) => {
    setButtons((prev) => {
      const copy = [...prev];
      copy[rowIndex].splice(btnIndex, 1);
      return copy.filter((r) => r.length > 0);
    });
  };

  const handleUpdateButton = (
    rowIndex: number,
    btnIndex: number,
    field: keyof BotMenuButton,
    val: string
  ) => {
    setButtons((prev) => {
      const copy = [...prev];
      copy[rowIndex][btnIndex] = { ...copy[rowIndex][btnIndex], [field]: val };
      return copy;
    });
  };

  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposerError(null);

    if (!title.trim()) {
      setComposerError('Broadcast title is required');
      return;
    }
    if (!messageText.trim()) {
      setComposerError('Broadcast message text is required');
      return;
    }
    if (isScheduled && !scheduledAt) {
      setComposerError('Please select a valid scheduled date and time');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: BotBroadcastInput = {
        title: title.trim(),
        message_text: messageText.trim(),
        photo_url: photoUrl.trim() || undefined,
        buttons: buttons,
        target_audience: audience,
        scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };

      const created = await telegramBotService.createBotBroadcast(bot.id, input);
      setBroadcasts((prev) => [created, ...prev]);
      setIsComposerOpen(false);

      if (!isScheduled) {
        // Open safety confirmation directly
        handleOpenSafetyConfirmation(created);
      }
    } catch (err: any) {
      setComposerError(err.message || 'Failed to save broadcast');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSafetyConfirmation = async (bcast: BotBroadcast) => {
    setConfirmBroadcast(bcast);
    setIsCalculatingAudience(true);
    setCalculatedRecipients(null);
    try {
      const prep = await telegramBotService.prepareBroadcastRecipients(bcast.id);
      setCalculatedRecipients(prep.total_recipients);
      setBroadcasts((prev) =>
        prev.map((b) => (b.id === bcast.id ? { ...b, total_recipients: prep.total_recipients } : b))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to calculate recipients');
    } finally {
      setIsCalculatingAudience(false);
    }
  };

  const handleExecuteDispatch = async () => {
    if (!confirmBroadcast) return;
    setIsDispatching(true);
    try {
      const res = await telegramBotService.triggerBroadcastWorker(confirmBroadcast.id);
      setBroadcasts((prev) =>
        prev.map((b) => (b.id === confirmBroadcast.id ? { ...b, status: res.status as any } : b))
      );
      setConfirmBroadcast(null);
      loadBroadcasts();
    } catch (err: any) {
      alert(err.message || 'Failed to initiate broadcast dispatch');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCancelBroadcast = async (broadcastId: string) => {
    if (!window.confirm('Are you sure you want to cancel this broadcast?')) return;
    try {
      await telegramBotService.cancelBroadcast(broadcastId);
      setBroadcasts((prev) =>
        prev.map((b) => (b.id === broadcastId ? { ...b, status: 'CANCELLED' } : b))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to cancel broadcast');
    }
  };

  const handleDeleteBroadcast = async (broadcastId: string) => {
    if (!window.confirm('Delete this broadcast draft/record?')) return;
    try {
      await telegramBotService.deleteBotBroadcast(broadcastId);
      setBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete broadcast');
    }
  };

  const handleInspectRecipients = async (bcast: BotBroadcast) => {
    setInspectBroadcast(bcast);
    setIsLoadingRecipients(true);
    try {
      const recs = await telegramBotService.getBroadcastRecipients(bcast.id, 50);
      setRecipients(recs);
    } catch (err: any) {
      console.warn('Recipients error:', err.message);
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  // Telemetry metrics
  const totalSentAll = broadcasts.reduce((acc, b) => acc + (b.sent_count || 0), 0);
  const totalRecipientsAll = broadcasts.reduce((acc, b) => acc + (b.total_recipients || 0), 0);
  const activeProcessing = broadcasts.filter((b) => b.status === 'PROCESSING').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            <span>Telegram Broadcasts Engine</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Deliver announcements, media, and interactive notifications to your real Telegram audience
          </p>
        </div>

        <button
          onClick={handleOpenComposer}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Create Broadcast</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Real Broadcast Metrics (Zero fake counters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Total Broadcasts
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{broadcasts.length}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Delivered Messages
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">{totalSentAll}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Total Audience Target
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-600">{totalRecipientsAll}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-sky-100 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Active Processing
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-600">{activeProcessing}</div>
        </div>
      </div>

      {/* Broadcasts List */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
          Loading broadcast campaigns...
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
          <Send className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="font-bold text-xs text-slate-700">No broadcasts created yet</div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Reach out to your verified bot users with updates, announcements, or Lifafa giveaway links.
          </p>
          <button
            onClick={handleOpenComposer}
            className="mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Compose First Broadcast</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {broadcasts.map((bcast) => {
            const isProcessing = bcast.status === 'PROCESSING';
            const isDone = ['COMPLETED', 'PARTIAL', 'FAILED'].includes(bcast.status);
            const isDraft = bcast.status === 'DRAFT';
            const isScheduledBcast = bcast.status === 'SCHEDULED';

            return (
              <div
                key={bcast.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Status & Title */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 block truncate">
                        {bcast.title}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(bcast.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 ${
                        bcast.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : bcast.status === 'PROCESSING'
                          ? 'bg-cyan-50 text-cyan-700 border-cyan-200 animate-pulse'
                          : bcast.status === 'SCHEDULED'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : bcast.status === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : bcast.status === 'FAILED'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : bcast.status === 'CANCELLED'
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {bcast.status}
                    </span>
                  </div>

                  {/* Message Preview Box */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 font-mono line-clamp-3">
                    {bcast.message_text}
                  </div>

                  {/* Progress & Delivery Stats */}
                  <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Delivery Progress</span>
                      <span className="font-mono">
                        {bcast.sent_count} / {bcast.total_recipients} sent
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            bcast.total_recipients > 0
                              ? Math.min(100, (bcast.sent_count / bcast.total_recipients) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                      <span>Audience: {bcast.target_audience.replace('_', ' ')}</span>
                      {bcast.failed_count > 0 && (
                        <span className="text-red-500 font-bold">{bcast.failed_count} failed</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleInspectRecipients(bcast)}
                    className="text-blue-600 hover:underline font-bold text-[11px] flex items-center gap-1"
                  >
                    <span>Inspect Queue</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {(isDraft || isScheduledBcast) && (
                      <button
                        onClick={() => handleOpenSafetyConfirmation(bcast)}
                        className="py-1.5 px-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold rounded-xl shadow-2xs flex items-center gap-1 text-[11px]"
                      >
                        <Play className="w-3 h-3" />
                        <span>Send Now</span>
                      </button>
                    )}

                    {isProcessing && (
                      <button
                        onClick={() => handleCancelBroadcast(bcast.id)}
                        className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-[11px]"
                      >
                        Cancel
                      </button>
                    )}

                    {(isDraft || isDone || bcast.status === 'CANCELLED') && (
                      <button
                        onClick={() => handleDeleteBroadcast(bcast.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMPOSER MODAL */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-sky-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-cyan-200" />
                <h3 className="font-extrabold text-base tracking-tight">Create Telegram Broadcast</h3>
              </div>
              <button
                onClick={() => setIsComposerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Split View: Form (Left) + Live Preview (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto flex-1">
              <form onSubmit={handleSaveBroadcast} className="p-6 space-y-4 lg:col-span-7 border-r border-slate-100">
                {composerError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{composerError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Broadcast Title (Internal)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Weekend Giveaway Announcement"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Target Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {AUDIENCE_OPTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label} — {a.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Photo / Banner URL (Optional)</label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/banner.png"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Message Content</label>
                    <span className="text-[10px] text-slate-400">Telegram HTML format</span>
                  </div>
                  <textarea
                    rows={4}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Write your announcement message here..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Buttons matrix */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Interactive Buttons</span>
                    <button
                      type="button"
                      onClick={handleAddButtonRow}
                      className="text-xs font-bold text-blue-600 hover:text-cyan-600 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  {buttons.length > 0 && (
                    <div className="space-y-2">
                      {buttons.map((row, rIdx) => (
                        <div key={rIdx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <span>Row {rIdx + 1}</span>
                            {row.length < 3 && (
                              <button
                                type="button"
                                onClick={() => handleAddButtonToRow(rIdx)}
                                className="text-blue-600 hover:underline"
                              >
                                + Button
                              </button>
                            )}
                          </div>

                          <div className="space-y-2">
                            {row.map((btn, bIdx) => (
                              <div key={btn.id || bIdx} className="grid grid-cols-12 gap-2 items-center">
                                <input
                                  type="text"
                                  value={btn.text}
                                  onChange={(e) => handleUpdateButton(rIdx, bIdx, 'text', e.target.value)}
                                  placeholder="Label"
                                  className="col-span-4 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                />
                                <select
                                  value={btn.type}
                                  onChange={(e) => handleUpdateButton(rIdx, bIdx, 'type', e.target.value as any)}
                                  className="col-span-3 p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                                >
                                  <option value="URL">URL</option>
                                  <option value="COMMAND">Command</option>
                                  <option value="CALLBACK">Callback</option>
                                </select>
                                <input
                                  type="text"
                                  value={btn.value}
                                  onChange={(e) => handleUpdateButton(rIdx, bIdx, 'value', e.target.value)}
                                  placeholder={btn.type === 'URL' ? 'https://...' : '/help'}
                                  className="col-span-4 p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveButton(rIdx, bIdx)}
                                  className="col-span-1 text-red-500 hover:text-red-700 flex justify-center"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scheduling */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Schedule for a Future Time</span>
                  </label>

                  {isScheduled && (
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Submit Row */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
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
                      <span>{isScheduled ? 'Schedule Broadcast' : 'Continue to Confirmation'}</span>
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

      {/* SAFETY CONFIRMATION DIALOG (Server-Calculated Audience) */}
      {confirmBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-sky-100 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">Confirm Broadcast Dispatch</h4>
                <p className="text-[11px] text-slate-500">Server verified queue calculation</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Broadcast Title:</span>
                <span className="font-bold text-slate-900">{confirmBroadcast.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target Audience:</span>
                <span className="font-bold text-blue-600">
                  {confirmBroadcast.target_audience.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-700 font-bold">Authoritative Recipients:</span>
                <span className="font-mono font-black text-sm text-emerald-600">
                  {isCalculatingAudience ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating...
                    </span>
                  ) : (
                    `${calculatedRecipients ?? confirmBroadcast.total_recipients} users`
                  )}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              The broadcast worker will dispatch messages with rate-limiting protection (respecting Telegram API 429 limits).
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBroadcast(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDispatch}
                disabled={isDispatching || isCalculatingAudience}
                className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-98 flex items-center gap-1.5"
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Confirm & Dispatch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECIPIENT INSPECTION DRAWER */}
      {inspectBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  Recipient Queue: {inspectBroadcast.title}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {inspectBroadcast.sent_count} sent / {inspectBroadcast.total_recipients} total
                </p>
              </div>
              <button
                onClick={() => setInspectBroadcast(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {isLoadingRecipients ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading recipient states...
                </div>
              ) : recipients.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No recipient records found for this broadcast.
                </div>
              ) : (
                <div className="space-y-2">
                  {recipients.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-800">
                          User #{rec.telegram_user_id}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {rec.sent_at ? `Sent ${new Date(rec.sent_at).toLocaleTimeString()}` : 'Pending'}
                        </div>
                      </div>

                      <div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            rec.status === 'SENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : rec.status === 'FAILED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : rec.status === 'PROCESSING'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </div>
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
