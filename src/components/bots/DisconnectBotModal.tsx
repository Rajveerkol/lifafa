import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, Loader2, Bot, ArrowRight, CheckCircle2 } from 'lucide-react';
import { TelegramBot } from '../../types/telegramBot';
import { telegramBotService } from '../../services/telegramBotService';

interface DisconnectBotModalProps {
  isOpen: boolean;
  bot: TelegramBot | null;
  onClose: () => void;
  onDisconnected: (botId: string) => void;
}

export const DisconnectBotModal: React.FC<DisconnectBotModalProps> = ({
  isOpen,
  bot,
  onClose,
  onDisconnected,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !bot) return null;

  const handleConfirmDisconnect = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const res = await telegramBotService.disconnectBot(bot.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to disconnect bot from Telegram.');
        return;
      }

      onDisconnected(bot.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during bot disconnection.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-red-100 shadow-2xl shadow-red-500/10 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-red-50/80 px-6 py-5 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center border border-red-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                Disconnect Telegram Bot?
              </h3>
              <p className="text-xs text-slate-500">
                Authoritative Telegram Webhook Removal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">{bot.telegram_display_name}</div>
              <div className="text-xs text-blue-600 font-semibold">@{bot.telegram_username}</div>
              <div className="text-[10px] text-slate-400 font-mono">ID: {bot.telegram_bot_id}</div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-amber-50/70 border border-amber-200 p-4 rounded-2xl">
            <div className="font-bold text-amber-900 mb-1">What happens when you disconnect:</div>
            <ul className="space-y-1.5 list-disc list-inside text-amber-800">
              <li>
                Telegram's live webhook will be <strong>permanently deleted</strong> via Telegram API.
              </li>
              <li>
                Your purchased bot slot will be released back to <strong>AVAILABLE</strong> in your inventory.
              </li>
              <li>
                Historical events and audit logs are safely <strong>preserved</strong>.
              </li>
            </ul>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-600">
              {errorMessage}
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDisconnect}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Removing Webhook...</span>
                </>
              ) : (
                <span>Confirm Disconnect</span>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50/80 px-6 py-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Server-side verification</span>
          </span>
          <span>Zero data loss</span>
        </div>
      </div>
    </div>
  );
};
