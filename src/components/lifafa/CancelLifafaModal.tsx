import React, { useEffect, useState } from 'react';
import {
  X,
  AlertTriangle,
  RotateCcw,
  Users,
  Gift,
  CreditCard,
  Wallet,
  Sparkles,
  CheckCircle2,
  Loader2,
  Info,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { CancelLifafaPreview, CancelLifafaResult, Lifafa } from '../../types/database';
import { lifafaService } from '../../services/lifafaService';
import { formatCurrency } from '../../lib/utils';

interface CancelLifafaModalProps {
  lifafa: Lifafa | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export const CancelLifafaModal: React.FC<CancelLifafaModalProps> = ({
  lifafa,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [preview, setPreview] = useState<CancelLifafaPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<CancelLifafaResult | null>(null);

  // Fetch authoritative financial preview whenever modal opens for a lifafa
  useEffect(() => {
    if (!isOpen || !lifafa) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError(null);
      setConfirmLoading(false);
      setConfirmError(null);
      setSuccessResult(null);
      return;
    }

    let isMounted = true;
    const fetchPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      setSuccessResult(null);
      setConfirmError(null);

      try {
        const data = await lifafaService.previewCancelLifafaRefund(lifafa.id);
        if (isMounted) {
          setPreview(data);
        }
      } catch (err: any) {
        if (isMounted) {
          let msg = err.message || 'Failed to load refund breakdown';
          if (
            msg.toLowerCase().includes('column') ||
            msg.toLowerCase().includes('syntax error') ||
            msg.toLowerCase().includes('relation')
          ) {
            msg = 'Unable to calculate refund breakdown at this time. Please try again.';
          }
          setPreviewError(msg);
        }
      } finally {
        if (isMounted) {
          setPreviewLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [isOpen, lifafa]);

  if (!isOpen || !lifafa) {
    return null;
  }

  // Handle final authoritative execution
  const handleConfirmCancel = async () => {
    if (confirmLoading) return;

    try {
      setConfirmLoading(true);
      setConfirmError(null);

      const res = await lifafaService.refundExpiredOrCancelled(lifafa.id);
      setSuccessResult(res);
      await onSuccess();
    } catch (err: any) {
      let msg = err.message || 'Failed to cancel Lifafa';
      if (
        msg.toLowerCase().includes('column') ||
        msg.toLowerCase().includes('syntax error') ||
        msg.toLowerCase().includes('relation') ||
        msg.toLowerCase().includes('violates')
      ) {
        msg = 'An unexpected database error occurred while processing the cancellation. Please try again.';
      }
      setConfirmError(msg);
    } finally {
      setConfirmLoading(false);
    }
  };

  const isUpiMode = preview ? preview.payout_mode === 'UPI_BANK' : lifafa.payout_mode === 'UPI_BANK';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirmLoading) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-blue-900/20 overflow-hidden motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-4 duration-300">
        {/* Ambient Top Glow Sheen */}
        <div className="absolute -top-16 -right-16 w-52 h-52 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={confirmLoading}
          aria-label="Close dialog"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ------------------------------------------------------------- */}
        {/* SUCCESS STATE */}
        {/* ------------------------------------------------------------- */}
        {successResult ? (
          <div className="p-6 sm:p-8 space-y-6 text-center motion-safe:animate-in motion-safe:zoom-in-95 duration-300">
            {/* Animated Celebration Icon */}
            <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 motion-safe:animate-bounce-gentle">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full inline-block">
                Refund Completed
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Lifafa Cancelled Successfully
              </h3>
              <p className="text-sm font-bold text-emerald-600">
                {formatCurrency(successResult.total_refunded)} has been refunded to your wallet.
              </p>
            </div>

            {/* Authoritative Audit Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left text-xs bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Users Claimed</span>
                <p className="font-extrabold text-slate-800">
                  {successResult.claimed_count} users claimed
                </p>
              </div>

              {isUpiMode && (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Consumed Charges</span>
                  <p className="font-extrabold text-slate-800">
                    {formatCurrency(successResult.consumed_fees || 0)}
                  </p>
                </div>
              )}

              <div className="space-y-0.5 sm:col-span-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Refund Credited</span>
                <p className="font-extrabold text-emerald-600">
                  {formatCurrency(successResult.total_refunded)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.99] cursor-pointer"
            >
              Done & Return to Dashboard
            </button>
          </div>
        ) : (
          /* ----------------------------------------------------------- */
          /* BREAKDOWN & CONFIRMATION STATE                              */
          /* ----------------------------------------------------------- */
          <div className="p-5 sm:p-7 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
                <RotateCcw className="w-6 h-6 -rotate-45" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md">
                    {lifafa.code}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {lifafa.status}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Cancel Lifafa?
                </h3>
                <p className="text-xs text-slate-500 leading-snug">
                  Here's exactly what will happen to your remaining Lifafa balance.
                </p>
              </div>
            </div>

            {/* Error in Preview Fetch */}
            {previewError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{previewError}</span>
              </div>
            )}

            {/* Loading Skeleton */}
            {previewLoading ? (
              <div className="space-y-3 py-6 text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-500">
                  Calculating authoritative live refund breakdown...
                </p>
              </div>
            ) : preview ? (
              <>
                {/* Eligibility Notice if Lifafa is NOT eligible */}
                {!preview.is_eligible && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                    <span className="font-medium">{preview.eligibility_message}</span>
                  </div>
                )}

                {/* 6-Grid Authoritative Financial Breakdown */}
                <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3 sm:p-4 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {/* Users Claimed */}
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                        <Users className="w-3 h-3 text-slate-500" />
                        <span>Users Claimed</span>
                      </div>
                      <p className="text-sm font-extrabold text-slate-900">
                        {preview.claimed_count} / {preview.winner_count}
                      </p>
                    </div>

                    {/* Total Prize Pool */}
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                        <Gift className="w-3 h-3 text-slate-500" />
                        <span>Total Prize Pool</span>
                      </div>
                      <p className="text-sm font-extrabold text-slate-900">
                        {formatCurrency(preview.total_prize_pool)}
                      </p>
                    </div>

                    {/* Amount Already Distributed */}
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span>Already Distributed</span>
                      </div>
                      <p className="text-sm font-extrabold text-slate-700">
                        {formatCurrency(preview.already_distributed_amount)}
                      </p>
                    </div>

                    {/* Payout Charges Deducted (UPI Lifafas) */}
                    {isUpiMode ? (
                      <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                          <CreditCard className="w-3 h-3 text-slate-500" />
                          <span>Charges Consumed</span>
                        </div>
                        <p className="text-sm font-extrabold text-slate-700">
                          {formatCurrency(preview.consumed_payout_fee)}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                          <Wallet className="w-3 h-3 text-slate-500" />
                          <span>Payout Mode</span>
                        </div>
                        <p className="text-sm font-extrabold text-slate-700">
                          Wallet Credits
                        </p>
                      </div>
                    )}

                    {/* Remaining Prize */}
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                      <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Remaining Prize</span>
                      </div>
                      <p className="text-sm font-extrabold text-emerald-600">
                        {formatCurrency(preview.remaining_prize)}
                      </p>
                    </div>

                    {/* Remaining Payout Fee Reserve (UPI Lifafas) */}
                    {isUpiMode ? (
                      <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                        <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold uppercase">
                          <CreditCard className="w-3 h-3 text-emerald-500" />
                          <span>Remaining Fee Escrow</span>
                        </div>
                        <p className="text-sm font-extrabold text-emerald-600">
                          {formatCurrency(preview.remaining_payout_fee_reserve)}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                          <Info className="w-3 h-3 text-slate-400" />
                          <span>Fee Escrow</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-500">
                          Zero escrow (Wallet)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Creation Fee Non-refundable notice */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span className="inline-flex items-center gap-1">
                      <Info className="w-3 h-3 text-slate-400" />
                      {preview.creation_fee_note}
                    </span>
                    <span className="text-[10px] text-slate-400">Claims closed immediately</span>
                  </div>
                </div>

                {/* Prominent "YOU WILL RECEIVE" Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white p-4 sm:p-5 shadow-lg shadow-blue-600/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold tracking-widest uppercase text-blue-200">
                        You Will Receive (Refund)
                      </span>
                      <div className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 flex items-center gap-1">
                        <span>{formatCurrency(preview.total_refundable_amount)}</span>
                        <Sparkles className="w-5 h-5 text-amber-300 inline motion-safe:animate-pulse-subtle" />
                      </div>
                      <p className="text-[11px] text-blue-100/90 mt-1">
                        Instantly released back to your available wallet balance.
                      </p>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                      <Wallet className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Execution Error alert if confirm failed */}
                {confirmError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span className="font-medium">{confirmError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                  {/* Keep Lifafa (Secondary / Cancel) */}
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={confirmLoading}
                    className="w-full sm:w-1/3 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                  >
                    Keep Lifafa
                  </button>

                  {/* Primary CTA: Cancel & Refund */}
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={confirmLoading || !preview.is_eligible}
                    className="w-full sm:w-2/3 py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 hover:shadow-rose-600/35 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirmLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Processing Refund...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>
                          OK, Cancel & Refund {formatCurrency(preview.total_refundable_amount)}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
