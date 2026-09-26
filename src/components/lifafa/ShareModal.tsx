import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Send,
  Sparkles,
  Trophy,
  Users,
  MessageSquare,
  Gift,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Lifafa } from '../../types/database';
import { formatCurrency } from '../../lib/utils';
import { buildClaimUrl, resolveThemeId } from '../../themes/useThemeResolver';

interface ShareModalProps {
  lifafa: Lifafa | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ lifafa, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen || !lifafa) return null;

  const themeId = (lifafa as any).theme_id || resolveThemeId(window.location.search, lifafa);
  const shareUrl = buildClaimUrl(lifafa.code, themeId);
  const shareText = `🎁 Claim your digital cash reward from "${lifafa.title}" on Create Lifafa! Pool: ${formatCurrency(lifafa.total_amount)}: ${shareUrl}`;
  const perUserAmount = (lifafa.total_amount / (lifafa.winner_count || 1)).toFixed(2);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lifafa.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2200);
  };

  const handleWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleSMS = () => {
    window.open(`sms:?body=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: lifafa.title,
          text: shareText,
          url: shareUrl,
        });
      } catch (e) {
        // Cancelled or unsupported
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#EEF5FF] via-[#F8FAFC] to-white rounded-3xl shadow-2xl border border-blue-100/80 overflow-hidden text-center my-auto">
        {/* Festive Header Bar */}
        <div className="pt-4 pb-2 px-5 flex items-center justify-between relative z-10">
          <div className="text-left">
            <h2 className="text-base font-black text-slate-900 leading-tight">Lifafa Ready!</h2>
            <p className="text-[11px] font-bold text-blue-600">Small Lifafa, Big Happiness! ✨</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white shadow-xs hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-6 pt-1 space-y-4 relative z-10">
          {/* 3D Opened Lifafa with Rising Coin Illustration */}
          <div className="relative mx-auto w-36 h-36 sm:w-44 sm:h-44">
            <img
              src="/images/lifafa_ready_share.jpg"
              alt="Lifafa Ready"
              className="w-full h-full object-contain rounded-3xl drop-shadow-xl animate-in zoom-in-95 duration-300"
            />
          </div>

          {/* Royal Blue Card - Matching Reference Screenshot 3 */}
          <div className="bg-gradient-to-br from-[#1E40AF] via-[#1D4ED8] to-[#2563EB] rounded-3xl p-4 sm:p-5 text-white shadow-lg space-y-3.5 text-left">
            <div>
              <h3 className="text-sm sm:text-base font-black leading-tight text-white flex items-center gap-1.5">
                <span>🎉 Congratulations! Your Lifafa is Ready!</span>
              </h3>
              <p className="text-[11px] text-blue-100/90 font-medium truncate mt-0.5">
                "{lifafa.title}"
              </p>
            </div>

            {/* Per-User Pill Badge & Distribution Mode */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-black text-white">
                <Gift className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {lifafa.distribution_type === 'EQUAL'
                    ? `₹${perUserAmount} Per User`
                    : `Pool: ${formatCurrency(lifafa.total_amount)} (Random)`}
                </span>
              </div>
              <span className="text-[11px] text-blue-200 font-bold">
                {lifafa.winner_count} Lucky Winners
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-blue-200">
                <span>Claim Progress</span>
                <span>0 / {lifafa.winner_count} Claimed (0%)</span>
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all w-[3%]" />
              </div>
            </div>

            {/* Link Copy Input Box with Embedded Copy Button */}
            <div className="pt-1">
              <div className="flex items-center bg-white rounded-2xl p-1.5 shadow-xs">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent px-2.5 text-xs font-mono text-slate-800 font-bold focus:outline-hidden truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Circular Social Share Buttons Row - Matching Reference Screenshot 3 */}
          <div className="pt-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Share With Your Audience
            </p>
            <div className="flex items-center justify-center gap-3.5 sm:gap-4">
              {/* WhatsApp */}
              <button
                type="button"
                onClick={handleWhatsApp}
                title="Share on WhatsApp"
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-110 active:scale-95 transition-all">
                  <Share2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">WhatsApp</span>
              </button>

              {/* Telegram */}
              <button
                type="button"
                onClick={handleTelegram}
                title="Share on Telegram"
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#229ED9] text-white flex items-center justify-center shadow-md shadow-sky-500/25 group-hover:scale-110 active:scale-95 transition-all">
                  <Send className="w-5 h-5 -rotate-12" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Telegram</span>
              </button>

              {/* Message / SMS */}
              <button
                type="button"
                onClick={handleSMS}
                title="Share via Message"
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 group-hover:scale-110 active:scale-95 transition-all">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Message</span>
              </button>

              {/* Copy Link */}
              <button
                type="button"
                onClick={handleCopy}
                title="Copy Link"
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-110 active:scale-95 transition-all">
                  {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-bold text-slate-600">Copy</span>
              </button>

              {/* More / Native */}
              <button
                type="button"
                onClick={handleNativeShare}
                title="More Sharing Options"
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-slate-700 text-white flex items-center justify-center shadow-md shadow-slate-600/25 group-hover:scale-110 active:scale-95 transition-all">
                  <Share2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600">More</span>
              </button>
            </div>
          </div>

          {/* Quick Access Claim Code & QR Code Toggle */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Code:</span>
              <span className="text-xs font-mono font-black text-blue-700">{lifafa.code}</span>
              <button
                onClick={handleCopyCode}
                className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors"
                title="Copy code"
              >
                {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-600" />
              <span>{showQR ? 'Hide QR' : 'Show QR'}</span>
            </button>
          </div>

          {showQR && (
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs inline-block animate-in fade-in">
              <QRCodeSVG value={shareUrl} size={140} level="M" />
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Scan with phone camera</p>
            </div>
          )}

          {/* Done Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
          >
            Close &amp; Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
