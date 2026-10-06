import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Save,
  Plus,
  Trash2,
  X,
  ExternalLink,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LayoutGrid,
  Sparkles,
  Info,
} from 'lucide-react';
import { TelegramBot, BotMenu, BotMenuButton, MenuType } from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { TelegramMessagePreview } from './TelegramMessagePreview';

interface BotMenuBuilderProps {
  bot: TelegramBot;
}

const DEFAULT_MENU_MESSAGE = `🤖 <b>Welcome to the Main Menu!</b>\n\nChoose an option below to explore our services, claim Lifafa giveaways, or get live support.`;

const DEFAULT_BUTTONS: BotMenuButton[][] = [
  [
    { id: 'btn_1', text: '🎁 Claim Lifafa', type: 'COMMAND', value: '/start' },
    { id: 'btn_2', text: '📋 View Help', type: 'COMMAND', value: '/help' },
  ],
  [
    { id: 'btn_3', text: '👤 My Profile', type: 'COMMAND', value: '/profile' },
    { id: 'btn_4', text: '⚡ Bot Status', type: 'COMMAND', value: '/status' },
  ],
  [
    { id: 'btn_5', text: '🌐 Official Website', type: 'URL', value: 'https://lifafa.club' },
  ],
];

export const BotMenuBuilder: React.FC<BotMenuBuilderProps> = ({ bot }) => {
  const [menu, setMenu] = useState<BotMenu | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('Main Navigation Menu');
  const [messageText, setMessageText] = useState(DEFAULT_MENU_MESSAGE);
  const [menuType, setMenuType] = useState<MenuType>('INLINE');
  const [buttons, setButtons] = useState<BotMenuButton[][]>(DEFAULT_BUTTONS);

  const loadMenu = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const existingMenu = await telegramBotService.getBotMenu(bot.id);
      if (existingMenu) {
        setMenu(existingMenu);
        setTitle(existingMenu.title || 'Main Navigation Menu');
        setMessageText(existingMenu.message_text || DEFAULT_MENU_MESSAGE);
        setMenuType(existingMenu.menu_type || 'INLINE');
        setButtons(existingMenu.buttons && existingMenu.buttons.length > 0 ? existingMenu.buttons : DEFAULT_BUTTONS);
      } else {
        setTitle('Main Navigation Menu');
        setMessageText(DEFAULT_MENU_MESSAGE);
        setMenuType('INLINE');
        setButtons(DEFAULT_BUTTONS);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load bot menu configuration');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadMenu();
    const unsubscribe = telegramBotService.subscribeToBotMenu(bot.id, () => {
      loadMenu();
    });
    return () => {
      unsubscribe();
    };
  }, [loadMenu, bot.id]);

  // Button Matrix Handlers
  const handleAddRow = () => {
    if (buttons.length >= 8) {
      alert('Maximum 8 button rows allowed.');
      return;
    }
    const newBtn: BotMenuButton = {
      id: Math.random().toString(36).slice(2, 7),
      text: 'New Option',
      type: 'COMMAND',
      value: '/help',
    };
    setButtons((prev) => [...prev, [newBtn]]);
  };

  const handleAddButtonToRow = (rowIndex: number) => {
    setButtons((prev) => {
      const copy = [...prev];
      if (copy[rowIndex] && copy[rowIndex].length < 3) {
        copy[rowIndex].push({
          id: Math.random().toString(36).slice(2, 7),
          text: 'Button',
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
      return copy.filter((row) => row.length > 0);
    });
  };

  const handleRemoveRow = (rowIndex: number) => {
    setButtons((prev) => prev.filter((_, idx) => idx !== rowIndex));
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaveSuccess(false);

    if (!title.trim()) {
      setErrorMessage('Please provide a menu title');
      return;
    }

    if (!messageText.trim()) {
      setErrorMessage('Please provide message text to accompany the menu');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await telegramBotService.saveBotMenu(bot.id, {
        title: title.trim(),
        message_text: messageText.trim(),
        menu_type: menuType,
        buttons: buttons,
        is_main_menu: true,
      });
      setMenu(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save menu changes.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
        Loading Telegram Menu Designer...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600" />
            <span>Interactive Menu Builder</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Design the default interactive menu for <code>/menu</code> with inline buttons or custom reply keyboards
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-xs py-2.5 px-5 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Menu</span>
            </>
          )}
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Menu saved successfully! Users typing <code>/menu</code> in Telegram will now receive this layout.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Split Grid: Editor (Left) + Live Telegram Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Column */}
        <form onSubmit={handleSave} className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          {/* Menu Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Internal Menu Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Main Navigation Menu"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Menu Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Menu Keyboard Style</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMenuType('INLINE')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  menuType === 'INLINE'
                    ? 'bg-blue-50 border-blue-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-extrabold text-xs text-blue-700 flex items-center gap-1.5">
                  <span>Inline Keyboard</span>
                  <span className="text-[10px] bg-blue-200/60 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                    Default
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Buttons attached directly below the message bubble. Supports URLs and callbacks.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMenuType('REPLY_KEYBOARD')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  menuType === 'REPLY_KEYBOARD'
                    ? 'bg-blue-50 border-blue-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-extrabold text-xs text-blue-700">Reply Keyboard</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Replaces the user&apos;s Telegram text input with custom pushable buttons docked at bottom.
                </div>
              </button>
            </div>
          </div>

          {/* Message Text */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Accompanying Message Text</label>
              <span className="text-[10px] text-slate-400">Telegram HTML format allowed</span>
            </div>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Enter the message displayed above the menu..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Button Grid Editor */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700">Keyboard Button Rows</span>
                <p className="text-[11px] text-slate-400">Arrange up to 3 buttons per row</p>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-1.5 px-3 rounded-xl border border-blue-200 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Row</span>
              </button>
            </div>

            {buttons.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 text-center text-xs text-slate-400">
                No buttons configured. Click &quot;+ Add Row&quot; to build your menu buttons.
              </div>
            ) : (
              <div className="space-y-3">
                {buttons.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2.5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Row {rIdx + 1} ({row.length} button{row.length > 1 ? 's' : ''})
                      </span>
                      <div className="flex items-center gap-2">
                        {row.length < 3 && (
                          <button
                            type="button"
                            onClick={() => handleAddButtonToRow(rIdx)}
                            className="text-blue-600 hover:text-cyan-600 font-bold"
                          >
                            + Button
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(rIdx)}
                          className="text-red-500 hover:text-red-700 p-1 rounded"
                          title="Delete entire row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Buttons inside this row */}
                    <div className="space-y-2">
                      {row.map((btn, bIdx) => (
                        <div
                          key={btn.id || bIdx}
                          className="grid grid-cols-12 gap-2 items-center p-2 bg-white rounded-xl border border-slate-200 shadow-2xs"
                        >
                          {/* Button Label */}
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={btn.text}
                              onChange={(e) => handleUpdateButton(rIdx, bIdx, 'text', e.target.value)}
                              placeholder="Button Label"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Action Type */}
                          <div className="col-span-3">
                            <select
                              value={btn.type}
                              onChange={(e) => handleUpdateButton(rIdx, bIdx, 'type', e.target.value as any)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="COMMAND">Command</option>
                              <option value="URL">External URL</option>
                              <option value="CALLBACK">Callback Data</option>
                            </select>
                          </div>

                          {/* Action Value */}
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={btn.value}
                              onChange={(e) => handleUpdateButton(rIdx, bIdx, 'value', e.target.value)}
                              placeholder={
                                btn.type === 'URL'
                                  ? 'https://...'
                                  : btn.type === 'COMMAND'
                                  ? '/help'
                                  : 'action_key'
                              }
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Remove button */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveButton(rIdx, bIdx)}
                              className="text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                Live Telegram Preview
              </span>
              <span className="text-[10px] font-mono text-slate-400">Real-time Simulation</span>
            </div>

            <TelegramMessagePreview
              botName={bot.telegram_display_name}
              botUsername={bot.telegram_username}
              messageText={messageText}
              buttons={buttons}
              menuType={menuType}
            />

            <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                When a user sends <code>/menu</code> or triggers the main menu action, the bot will deliver this exact layout to the user&apos;s Telegram chat.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
