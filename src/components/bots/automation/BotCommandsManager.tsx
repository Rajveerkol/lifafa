import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Plus,
  Terminal,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  Sliders,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
} from 'lucide-react';
import { TelegramBot, BotCommand, BotCommandInput, BotMenuButton } from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { TelegramMessagePreview } from './TelegramMessagePreview';

interface BotCommandsManagerProps {
  bot: TelegramBot;
}

const BUILT_IN_COMMANDS = [
  {
    command: 'start',
    description: 'Initial greeting & user registration',
    type: 'Built-in Core',
    customizable: true,
  },
  {
    command: 'help',
    description: 'Dynamic help menu of all enabled commands',
    type: 'Built-in Core',
    customizable: false,
  },
  {
    command: 'menu',
    description: 'Open interactive menu layout',
    type: 'Built-in Core',
    customizable: true,
  },
  {
    command: 'profile',
    description: 'View user registration details & status',
    type: 'Built-in Core',
    customizable: false,
  },
  {
    command: 'status',
    description: 'Operational health & webhook status',
    type: 'Built-in Core',
    customizable: false,
  },
];

export const BotCommandsManager: React.FC<BotCommandsManagerProps> = ({ bot }) => {
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<BotCommand | null>(null);

  // Form State
  const [cmdName, setCmdName] = useState('');
  const [cmdDescription, setCmdDescription] = useState('');
  const [responseType, setResponseType] = useState<'TEXT' | 'INLINE_BUTTONS'>('TEXT');
  const [responseText, setResponseText] = useState('');
  const [buttons, setButtons] = useState<BotMenuButton[][]>([]);
  const [cmdEnabled, setCmdEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCommands = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await telegramBotService.getBotCommands(bot.id);
      setCommands(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load bot commands');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadCommands();
    const unsubscribe = telegramBotService.subscribeToBotCommands(bot.id, () => {
      loadCommands();
    });
    return () => {
      unsubscribe();
    };
  }, [loadCommands, bot.id]);

  const handleOpenCreate = () => {
    setEditingCommand(null);
    setCmdName('');
    setCmdDescription('');
    setResponseType('TEXT');
    setResponseText('Hello! Here is the response to your command.');
    setButtons([]);
    setCmdEnabled(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cmd: BotCommand) => {
    setEditingCommand(cmd);
    setCmdName(cmd.command);
    setCmdDescription(cmd.description);
    setResponseType(cmd.response_type === 'INLINE_BUTTONS' ? 'INLINE_BUTTONS' : 'TEXT');
    setResponseText(cmd.response_text);
    setButtons(cmd.buttons || []);
    setCmdEnabled(cmd.enabled);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggle = async (cmd: BotCommand) => {
    try {
      const next = !cmd.enabled;
      await telegramBotService.toggleBotCommand(cmd.id, next);
      setCommands((prev) => prev.map((c) => (c.id === cmd.id ? { ...c, enabled: next } : c)));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle command');
    }
  };

  const handleDelete = async (cmdId: string) => {
    if (!window.confirm('Are you sure you want to delete this custom command?')) return;
    try {
      await telegramBotService.deleteBotCommand(cmdId);
      setCommands((prev) => prev.filter((c) => c.id !== cmdId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete command');
    }
  };

  // Add button to matrix
  const handleAddButtonRow = () => {
    setButtons((prev) => [
      ...prev,
      [
        {
          id: Math.random().toString(36).slice(2, 7),
          text: 'New Button',
          type: 'COMMAND',
          value: '/help',
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
          text: 'Button',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const clean = cmdName.replace(/^\//, '').trim().toLowerCase();
    if (!/^[a-z0-9_]{1,32}$/.test(clean)) {
      setFormError('Command name must be 1-32 lowercase letters, numbers, or underscores.');
      return;
    }

    if (!cmdDescription.trim()) {
      setFormError('Please provide a command description.');
      return;
    }

    if (!responseText.trim()) {
      setFormError('Response text is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: BotCommandInput = {
        command: clean,
        description: cmdDescription.trim(),
        response_type: responseType,
        response_text: responseText.trim(),
        buttons: responseType === 'INLINE_BUTTONS' ? buttons : [],
        enabled: cmdEnabled,
      };

      if (editingCommand) {
        const updated = await telegramBotService.updateBotCommand(editingCommand.id, input);
        setCommands((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await telegramBotService.createBotCommand(bot.id, input);
        setCommands((prev) => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save command.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-600" />
            <span>Telegram Bot Commands</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure built-in commands and create custom commands with text or inline buttons
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Create Command</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Built-in Core Commands */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Built-in Core Commands</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {BUILT_IN_COMMANDS.map((core) => {
            const customOverride = commands.find((c) => c.command === core.command);
            return (
              <div
                key={core.command}
                className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                      /{core.command}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {core.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-medium">
                    {customOverride ? customOverride.description : core.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Always Active
                  </span>
                  {core.customizable && (
                    <button
                      onClick={() => {
                        if (customOverride) {
                          handleOpenEdit(customOverride);
                        } else {
                          setEditingCommand(null);
                          setCmdName(core.command);
                          setCmdDescription(core.description);
                          setResponseType('TEXT');
                          setResponseText(`Welcome to /${core.command}!`);
                          setButtons([]);
                          setCmdEnabled(true);
                          setIsModalOpen(true);
                        }
                      }}
                      className="text-blue-600 hover:text-cyan-600 font-bold"
                    >
                      {customOverride ? 'Edit Response' : 'Customize'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Owner Commands */}
      <div className="space-y-3 pt-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Custom Commands ({commands.length})</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
            Loading bot commands...
          </div>
        ) : commands.length === 0 ? (
          <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
            <Terminal className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-bold text-xs text-slate-700">No custom commands created yet</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Add commands like <code>/offers</code>, <code>/rules</code>, or <code>/support</code> for your users.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Custom Command</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                      /{cmd.command}
                    </span>
                    <button
                      onClick={() => handleToggle(cmd)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
                    >
                      {cmd.enabled ? (
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

                  <p className="text-xs font-bold text-slate-800">{cmd.description}</p>
                  <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 font-mono line-clamp-2 border border-slate-100">
                    {cmd.response_text}
                  </div>

                  {cmd.buttons && cmd.buttons.length > 0 && (
                    <div className="text-[10px] text-cyan-700 font-bold flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>{cmd.buttons.flat().length} interactive button(s)</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEdit(cmd)}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(cmd.id)}
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
      </div>

      {/* CREATE / EDIT COMMAND MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-sky-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-5 h-5 text-cyan-200" />
                <h3 className="font-extrabold text-base tracking-tight">
                  {editingCommand ? `Edit /${editingCommand.command}` : 'Create Custom Telegram Command'}
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
                  <label className="text-xs font-bold text-slate-700">Command Keyword</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">
                      /
                    </span>
                    <input
                      type="text"
                      value={cmdName}
                      onChange={(e) => setCmdName(e.target.value.toLowerCase())}
                      placeholder="offers"
                      disabled={isSubmitting}
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Lowercase alphanumeric only (e.g., <code>offers</code> for <code>/offers</code>).
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Description</label>
                  <input
                    type="text"
                    value={cmdDescription}
                    onChange={(e) => setCmdDescription(e.target.value)}
                    placeholder="View today's exclusive offers"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      With Interactive Buttons
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Response Message Text</label>
                  <textarea
                    rows={4}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="HTML formatted response (supports <b>bold</b>, <i>italic</i>, etc.)"
                    disabled={isSubmitting}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Interactive Buttons Matrix */}
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
                        No buttons added yet. Click &quot;Add Row&quot; to configure button rows.
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
                                    <option value="URL">External URL</option>
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
                      checked={cmdEnabled}
                      onChange={(e) => setCmdEnabled(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Command is Active & Enabled</span>
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
                        <span>Save Command</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Telegram Live Preview Column */}
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
