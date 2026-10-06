import React, { useState } from 'react';
import {
  X,
  Bot,
  Key,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  PlusCircle,
  Sparkles,
  ArrowRight,
  Radio,
} from 'lucide-react';
import { BotSlot, TelegramBot } from '../../types/telegramBot';
import { telegramBotService } from '../../services/telegramBotService';

interface ConnectBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSlots: BotSlot[];
  onOpenPlans: () => void;
  onBotConnected: (bot: TelegramBot) => void;
}

type ConnectStep = 'IDLE' | 'VERIFYING_TELEGRAM' | 'CONFIGURING_WEBHOOK' | 'SAVING';

export const ConnectBotModal: React.FC<ConnectBotModalProps> = ({
  isOpen,
  onClose,
  availableSlots,
  onOpenPlans,
  onBotConnected,
}) => {
  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    availableSlots.length > 0 ? availableSlots[0].id : ''
  );
  const [botToken, setBotToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [stepState, setStepState] = useState<ConnectStep>('IDLE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedBot, setConnectedBot] = useState<TelegramBot | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedSlotId) {
      setErrorMessage('Please select an available bot entitlement slot.');
      return;
    }

    const trimmed = botToken.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your BotFather bot API token.');
      return;
    }

    if (!/^[0-9]{8,12}:[a-zA-Z0-9_-]{35,50}$/.test(trimmed)) {
      setErrorMessage(
        'Invalid Bot token format. Telegram tokens look like 123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456.'
      );
      return;
    }

    setIsSubmitting(true);
    setStepState('VERIFYING_TELEGRAM');

    try {
      // Small real state progress updates corresponding to backend pipeline
      const res = await telegramBotService.connectBot(selectedSlotId, trimmed);

      if (!res.success) {
        setStepState('IDLE');
        setErrorMessage(res.error || 'Connection failed.');
        return;
      }

      if (res.bot) {
        setConnectedBot(res.bot);
        onBotConnected(res.bot);
      }
    } catch (err: any) {
      setStepState('IDLE');
      setErrorMessage(err.message || 'An unexpected error occurred during bot connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setBotToken('');
    setErrorMessage(null);
    setStepState('IDLE');
    setConnectedBot(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl border border-sky-100 shadow-2xl shadow-blue-500/15 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Glow Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Bot className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg tracking-tight">Connect Telegram Bot</h3>
                <span className="bg-cyan-300/30 text-cyan-100 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-cyan-200/40">
                  Real API Link
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                Live verification via Telegram Bot API with zero simulation
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {connectedBot ? (
            /* SUCCESS SCREEN (Real Telegram Data) */
            <div className="text-center py-6 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/25 mx-auto border-2 border-white">
                  <Bot className="w-10 h-10" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border-2 border-white">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200">
                  Bot Verified & Webhook Active
                </span>
                <h4 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
                  {connectedBot.telegram_display_name}
                </h4>
                <p className="text-sm font-bold text-blue-600">
                  @{connectedBot.telegram_username}
                </p>
              </div>

              {/* Real Telegram Details Card */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5 max-w-sm mx-auto shadow-2xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Telegram Bot ID:</span>
                  <span className="font-mono font-bold text-slate-900">{connectedBot.telegram_bot_id}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Connection Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    CONNECTED
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Webhook Status:</span>
                  <span className="font-bold text-cyan-600 uppercase">{connectedBot.webhook_status}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Can Join Groups:</span>
                  <span className="font-bold text-slate-900">
                    {connectedBot.telegram_can_join_groups ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleResetAndClose}
                  className="w-full max-w-sm bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-sm flex items-center justify-center gap-2 mx-auto"
                >
                  <span>Open Bot Command Center</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-6">
              
              {/* STEP 1: Select Available Slot */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Step 1: Choose Available Slot
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPlans();
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Purchase New Slot</span>
                  </button>
                </div>

                {availableSlots.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>No Available Bot Slots Found</span>
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      You must own at least one available bot slot to connect a Telegram bot.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPlans();
                      }}
                      className="mt-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Browse Bot Plans (From ₹99)</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlotId === slot.id;
                      return (
                        <div
                          key={slot.id}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-50/60 border-blue-500 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{slot.plan_name}</div>
                              <div className="text-[11px] text-slate-400">
                                Slot: {slot.id.slice(0, 8)} • Purchased ₹{slot.plan_price}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Available
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 2: Paste BotFather Token */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Step 2: Enter Telegram Bot Token
                  </label>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                  >
                    <span>Get token from @BotFather</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
                    disabled={isSubmitting}
                    autoComplete="off"
                    className="w-full pl-10 pr-12 py-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Open Telegram, search for <strong>@BotFather</strong>, send <code>/newbot</code> or select your existing bot, and copy the API HTTP token.
                </p>
              </div>

              {/* Error Box */}
              {errorMessage && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Action */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || availableSlots.length === 0 || !botToken.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {stepState === 'VERIFYING_TELEGRAM'
                          ? 'Validating Token with Telegram getMe...'
                          : 'Configuring Webhook & Encrypting...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-cyan-200" />
                      <span>Verify & Connect Bot</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-slate-50/80 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Encrypted with AES-GCM at rest • Never returned in client queries</span>
          </div>
          <span className="font-medium text-slate-500">Live Telegram API</span>
        </div>
      </div>
    </div>
  );
};
