import React, { useState } from 'react';
import { X, Copy, Check, Share2, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Lifafa } from '../../types/database';
import { formatCurrency } from '../../lib/utils';

interface ShareModalProps {
  lifafa: Lifafa | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ lifafa, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !lifafa) return null;

  const shareUrl = `${window.location.origin}/claim/${lifafa.code}`;
  const shareText = `🎁 Grab your digital cash reward from "${lifafa.title}" on Lifafa! Claim up to ${formatCurrency(lifafa.total_amount)}: ${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
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
        // Ignored or cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-slate-900 mb-1">Share Lifafa</h3>
        <p className="text-xs text-slate-500 mb-5">
          Invite friends to claim rewards from <strong>{lifafa.title}</strong>
        </p>

        {/* QR Code Container */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-inner inline-block mb-4">
          <QRCodeSVG value={shareUrl} size={160} level="M" />
        </div>

        {/* Unique Code Pill */}
        <div className="mb-5">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">
            Unique Claim Code
          </span>
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200/80 px-4 py-2 rounded-xl">
            <span className="text-base font-black font-mono text-blue-700 tracking-wider">
              {lifafa.code}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(lifafa.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-blue-600 hover:text-blue-800"
              title="Copy Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Social Share Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
          >
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleTelegram}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Telegram</span>
          </button>
        </div>

        {/* Copy Link / Native Share */}
        <button
          onClick={handleNativeShare}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-blue-500/25 active:scale-98 transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" />
              <span>Link Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Copy Link & Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
