import React from 'react';
import { Bot, ExternalLink, Sparkles } from 'lucide-react';
import { BotMenuButton } from '../../../types/telegramBot';

interface TelegramMessagePreviewProps {
  botName: string;
  botUsername: string;
  messageText: string;
  buttons?: BotMenuButton[][];
  menuType?: 'INLINE' | 'REPLY_KEYBOARD';
}

export const TelegramMessagePreview: React.FC<TelegramMessagePreviewProps> = ({
  botName,
  botUsername,
  messageText,
  buttons = [],
  menuType = 'INLINE',
}) => {
  const isReplyKeyboard = menuType === 'REPLY_KEYBOARD';

  return (
    <div className="relative rounded-3xl border border-sky-200/80 bg-slate-900/90 text-slate-100 p-4 sm:p-5 shadow-xl overflow-hidden flex flex-col justify-between max-w-sm mx-auto w-full">
      {/* Telegram Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

      {/* Top Banner */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Preview — not sent to Telegram
        </span>
        <span className="font-mono text-[10px]">TG API 10.3</span>
      </div>

      {/* Chat Area */}
      <div className="relative z-10 py-4 space-y-3 flex-1">
        {/* Bot Message Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white truncate">{botName}</span>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-mono font-bold uppercase">
                bot
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate">@{botUsername}</span>
          </div>
        </div>

        {/* Message Bubble */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-200 leading-relaxed shadow-md backdrop-blur-xs">
          <div
            className="whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{
              __html: (messageText || 'Message content will preview here...').replace(/\n/g, '<br/>'),
            }}
          />

          <div className="text-right text-[10px] text-slate-400 mt-1 font-mono">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Inline Buttons (rendered directly below bubble) */}
        {!isReplyKeyboard && buttons && buttons.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {buttons.map((row, rIdx) => (
              <div key={rIdx} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                {row.map((btn, bIdx) => (
                  <button
                    key={bIdx}
                    type="button"
                    className="py-2 px-2.5 bg-sky-950/70 hover:bg-sky-900/80 text-cyan-200 border border-sky-700/50 rounded-xl text-xs font-bold text-center truncate transition-colors shadow-2xs flex items-center justify-center gap-1"
                  >
                    <span className="truncate">{btn.text || 'Button'}</span>
                    {btn.type === 'URL' && <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply Keyboard (rendered at bottom dock) */}
      {isReplyKeyboard && buttons && buttons.length > 0 && (
        <div className="relative z-10 pt-3 border-t border-slate-800 space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold text-center mb-1">
            Keyboard Panel
          </div>
          {buttons.map((row, rIdx) => (
            <div key={rIdx} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map((btn, bIdx) => (
                <button
                  key={bIdx}
                  type="button"
                  className="py-2.5 px-3 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-center truncate shadow-2xs"
                >
                  <span className="truncate">{btn.text || 'Option'}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
