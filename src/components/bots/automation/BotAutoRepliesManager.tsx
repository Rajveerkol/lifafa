import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Loader2,
  X,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
} from 'lucide-react';
import {
  TelegramBot,
  BotAutoReply,
  BotAutoReplyInput,
  AutoReplyTriggerType,
  BotMenuButton,
} from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { TelegramMessagePreview } from './TelegramMessagePreview';

interface BotAutoRepliesManagerProps {
  bot: TelegramBot;
}

const TRIGGER_TYPES: { value: AutoReplyTriggerType; label: string; desc: string }[] = [
  { value: 'CONTAINS_TEXT', label: 'Contains Keyword', desc: 'Triggers when user message contains word(s)' },
  { value: 'EXACT_TEXT', label: 'Exact Match', desc: 'Triggers only if message matches exactly' },
  { value: 'STARTS_WITH', label: 'Starts With', desc: 'Triggers if message begins with keyword' },
  { value: 'COMMAND', label: 'Custom Command', desc: 'Triggers on custom command prefix' },
];

export const BotAutoRepliesManager: React.FC<BotAutoRepliesManagerProps> = ({ bot }) => {
  const [replies, setReplies] = useState<BotAutoReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<BotAutoReply | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<AutoReplyTriggerType>('CONTAINS_TEXT');
  const [triggerValue, setTriggerValue] = useState('');
  const [responseType, setResponseType] = useState<'TEXT' | 'INLINE_BUTTONS'>('TEXT');
  const [responseText, setResponseText] = useState('');
  const [priority, setPriority] = useState<number>(10);
  const [buttons, setButtons] = useState<BotMenuButton[][]>([]);
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter / Search
  const [searchQuery, setSearchQuery] = useState('');

  const loadReplies = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await telegramBotService.getBotAutoReplies(bot.id);
      setReplies(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load auto-reply rules');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadReplies();
    const unsubscribe = telegramBotService.subscribeToBotAutoReplies(bot.id, () => {
      loadReplies();
    });
    return () => {
      unsubscribe();
    };
  }, [loadReplies, bot.id]);

  const handleOpenCreate = () => {
    setEditingReply(null);
    setName('');
    setTriggerType('CONTAINS_TEXT');
    setTriggerValue('');
    setResponseType('TEXT');
    setResponseText('Thank you for contacting us! How can I assist you further?');
    setPriority(10);
    setButtons([]);
    setEnabled(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: BotAutoReply) => {
    setEditingReply(rule);
    setName(rule.name);
    setTriggerType(rule.trigger_type);
    setTriggerValue(rule.trigger_value);
    setResponseType(rule.response_type === 'INLINE_BUTTONS' ? 'INLINE_BUTTONS' : 'TEXT');
    setResponseText(rule.response_text);
    setPriority(rule.priority || 10);
    setButtons(rule.buttons || []);
    setEnabled(rule.enabled);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggle = async (rule: BotAutoReply) => {
    try {
      const next = !rule.enabled;
      await telegramBotService.toggleBotAutoReply(rule.id, next);
      setReplies((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle rule');
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this auto-reply rule?')) return;
    try {
      await telegramBotService.deleteBotAutoReply(ruleId);
      setReplies((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  // Button matrix helpers
  const handleAddButtonRow = () => {
    setButtons((prev) => [
      ...prev,
      [
        {
          id: Math.random().toString(36).slice(2, 7),
          text: 'Get Support',
          type: 'URL',
          value: 'https://lifafa.club',
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
          value: '/help',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Rule name is required');
      return;
    }

    if (!triggerValue.trim()) {
      setFormError('Trigger keyword/value is required');
      return;
    }

    if (!responseText.trim()) {
      setFormError('Response message text is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: BotAutoReplyInput = {
        name: name.trim(),
        trigger_type: triggerType,
        trigger_value: triggerValue.trim(),
        response_type: responseType,
        response_text: responseText.trim(),
        buttons: responseType === 'INLINE_BUTTONS' ? buttons : [],
        priority: Number(priority) || 0,
        enabled,
      };

      if (editingReply) {
        const updated = await telegramBotService.updateBotAutoReply(editingReply.id, input);
        setReplies((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await telegramBotService.createBotAutoReply(bot.id, input);
        setReplies((prev) => [created, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save auto-reply rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReplies = replies.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.trigger_value.toLowerCase().includes(q) ||
      r.response_text.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span>Keyword Auto-Replies</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically reply when Telegram users send specific keywords, phrases, or inquiries
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Auto-Reply</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      {replies.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules by name, keyword or reply text..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      )}

      {/* Rules Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
          Loading auto-reply rules...
        </div>
      ) : replies.length === 0 ? (
        <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="font-bold text-xs text-slate-700">No auto-reply rules configured yet</div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Configure keywords like <code>pricing</code>, <code>rules</code>, or <code>support</code> to reply instantly without human intervention.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Auto-Reply Rule</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredReplies.map((rule) => (
            <div
              key={rule.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                {/* Header info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{rule.name}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                      P:{rule.priority}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggle(rule)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    {rule.enabled ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <ToggleRight className="w-4 h-4 text-emerald-600" /> Enabled
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <ToggleLeft className="w-4 h-4 text-slate-400" /> Disabled
                      </span>
                    )}
                  </button>
                </div>

                {/* Trigger pill */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-lg font-semibold">
                    {rule.trigger_type.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                    &quot;{rule.trigger_value}&quot;
                  </span>
                </div>

                {/* Response text snippet */}
                <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 font-mono line-clamp-2 border border-slate-100">
                  {rule.response_text}
                </div>

                {rule.buttons && rule.buttons.length > 0 && (
                  <div className="text-[10px] text-cyan-700 font-bold flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>{rule.buttons.flat().length} interactive button(s)</span>
                  </div>
                )}
              </div>

              {/* Actions footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(rule)}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT RULE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-sky-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-cyan-200" />
                <h3 className="font-extrabold text-base tracking-tight">
                  {editingReply ? `Edit Auto-Reply: ${editingReply.name}` : 'Create Keyword Auto-Reply Rule'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Split view (Form + Telegram Preview) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto flex-1">
              {/* Form Column */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4 lg:col-span-7 border-r border-slate-100">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Rule Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pricing Inquiry"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Trigger Condition</label>
                    <select
                      value={triggerType}
                      onChange={(e) => setTriggerType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TRIGGER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Priority (Higher = 1st)</label>
                    <input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                      placeholder="10"
                      min={0}
                      max={1000}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Keyword / Trigger Text</label>
                  <input
                    type="text"
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                    placeholder="e.g. price, how much, cost"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Response Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setResponseType('TEXT')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                        responseType === 'TEXT'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Plain Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponseType('INLINE_BUTTONS')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                        responseType === 'INLINE_BUTTONS'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      With Buttons
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Response Message Text</label>
                  <textarea
                    rows={4}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="HTML formatted response message..."
                    disabled={isSubmitting}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Buttons matrix */}
                {responseType === 'INLINE_BUTTONS' && (
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

                    {buttons.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                        No buttons added. Click &quot;Add Row&quot; to configure response buttons.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {buttons.map((row, rIdx) => (
                          <div key={rIdx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                              <span>Row {rIdx + 1} ({row.length} button{row.length > 1 ? 's' : ''})</span>
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
                                    <option value="COMMAND">Command</option>
                                    <option value="URL">URL</option>
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
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Rule is Active</span>
                  </label>

                  <div className="flex items-center gap-2">
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
                        <span>Save Rule</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Telegram Preview Column */}
              <div className="p-6 bg-slate-50 flex flex-col justify-center items-center lg:col-span-5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Live Telegram Preview
                </div>
                <TelegramMessagePreview
                  botName={bot.telegram_display_name}
                  botUsername={bot.telegram_username}
                  messageText={responseText}
                  buttons={responseType === 'INLINE_BUTTONS' ? buttons : []}
                  menuType="INLINE"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
