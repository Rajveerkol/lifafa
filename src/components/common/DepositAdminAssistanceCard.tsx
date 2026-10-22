import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownToLine,
  Send,
  ExternalLink,
  ShieldAlert,
  X,
  Sparkles,
  HelpCircle,
  MessageCircle,
} from 'lucide-react';
import { DEPOSIT_ASSISTANCE_CONFIG } from '../../config/depositAssistance';

export interface DepositAdminAssistanceCardProps {
  variant?: 'wallet' | 'merchant' | 'compact';
  allowDismiss?: boolean;
  className?: string;
  onDismiss?: () => void;
}

export const DepositAdminAssistanceCard: React.FC<DepositAdminAssistanceCardProps> = ({
  variant = 'wallet',
  allowDismiss = true,
  className = '',
  onDismiss,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (!allowDismiss) return false;
    try {
      return sessionStorage.getItem(DEPOSIT_ASSISTANCE_CONFIG.dismissStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(DEPOSIT_ASSISTANCE_CONFIG.dismissStorageKey, 'true');
    } catch {}
    if (onDismiss) onDismiss();
  };

  const handleRestore = () => {
    setIsDismissed(false);
    try {
      sessionStorage.removeItem(DEPOSIT_ASSISTANCE_CONFIG.dismissStorageKey);
    } catch {}
  };

  // If feature is disabled globally, do not render
  if (!DEPOSIT_ASSISTANCE_CONFIG.enabled) {
    return null;
  }

  // If dismissed by the user, show a non-intrusive compact banner/pill to easily reopen if needed
  if (isDismissed) {
    return (
      <div className={`flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-blue-50/90 to-indigo-50/80 border border-blue-200/60 rounded-xl text-xs text-blue-800 shadow-2xs ${className}`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-[11px] text-slate-700">
            Need deposit assistance?
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={DEPOSIT_ASSISTANCE_CONFIG.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
          >
            <span>Telegram Support</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={handleRestore}
            className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded-md hover:bg-white/80 transition-colors"
            title="Show details"
          >
            Show notice
          </button>
        </div>
      </div>
    );
  }

  const isMerchant = variant === 'merchant';
  const bodyMessage = isMerchant
    ? DEPOSIT_ASSISTANCE_CONFIG.merchantMessage
    : DEPOSIT_ASSISTANCE_CONFIG.message;
  const securityMessage = isMerchant
    ? DEPOSIT_ASSISTANCE_CONFIG.merchantSecurityNote
    : DEPOSIT_ASSISTANCE_CONFIG.securityNote;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 border border-blue-200/80 shadow-lg shadow-blue-500/5 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 ${className}`}
    >
      {/* Decorative ambient subtle glow orbs */}
      <div className="absolute -top-10 -right-10 w-36 h-36 bg-blue-400/15 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-400/25 transition-all duration-500" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-300/15 rounded-full blur-2xl pointer-events-none" />

      <div className="relative p-4 sm:p-5">
        {/* Top row: Badges & Dismiss Control */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Status Badge */}
            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-blue-700 uppercase tracking-wider shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{DEPOSIT_ASSISTANCE_CONFIG.badgeText}</span>
            </span>

            {/* Telegram Verified Handle Tag */}
            <span className="text-[11px] font-mono font-bold text-slate-500 group-hover:text-blue-700 transition-colors">
              {DEPOSIT_ASSISTANCE_CONFIG.telegramHandle}
            </span>
          </div>

          {/* Dismiss button */}
          {allowDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss deposit assistance notice"
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content Section: 3D Floating Icon + Text + Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {/* Floating Dual Icon Container */}
            <div className="relative shrink-0 mt-0.5 sm:mt-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 group-hover:rotate-1 transition-transform duration-300 motion-safe:animate-bounce-gentle">
                {/* Official Telegram SVG Icon */}
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 fill-white -translate-x-0.5 translate-y-0.5 drop-shadow-xs"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </div>

              {/* Deposit/Wallet badge overlay */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border-2 border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                {isMerchant ? (
                  <ArrowDownToLine className="w-2.5 h-2.5" />
                ) : (
                  <Wallet className="w-2.5 h-2.5" />
                )}
              </div>
            </div>

            {/* Title & Body */}
            <div className="space-y-1">
              <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{DEPOSIT_ASSISTANCE_CONFIG.title}</span>
                <Sparkles className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
              </h4>
              <p className="text-xs sm:text-[13px] text-slate-600 font-medium leading-relaxed max-w-xl">
                {bodyMessage}
              </p>
            </div>
          </div>

          {/* Action CTA Button: Must open official Telegram */}
          <div className="sm:shrink-0 flex items-center justify-end pt-1 sm:pt-0">
            <a
              href={DEPOSIT_ASSISTANCE_CONFIG.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Contact official support on Telegram @createlifafa_support"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl sm:rounded-2xl shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer no-underline text-center"
            >
              <Send className="w-3.5 h-3.5 -rotate-12" />
              <span>{DEPOSIT_ASSISTANCE_CONFIG.buttonText}</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>
        </div>

        {/* Security & Anti-Fraud Notice */}
        <div className="mt-3.5 pt-3 border-t border-blue-100/70 flex items-start gap-2 text-[11px] text-slate-500">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong className="text-slate-700 font-semibold">Security Note: </strong>
            <span>{securityMessage}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
