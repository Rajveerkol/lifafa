import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  X,
  Coins,
} from 'lucide-react';
import {
  merchantGatewayService,
  type MerchantOrderStatusCheckResult,
} from '../../services/merchantGatewayService';
import { formatCurrency } from '../../lib/utils';

interface MerchantOrderStatusCheckerProps {
  onStatusChecked?: () => void;
  initialOrderId?: string;
  autoCheck?: boolean;
}

export const MerchantOrderStatusChecker: React.FC<MerchantOrderStatusCheckerProps> = ({
  onStatusChecked,
  initialOrderId = '',
  autoCheck = false,
}) => {
  const [orderId, setOrderId] = useState<string>(initialOrderId);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<MerchantOrderStatusCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (e?: React.FormEvent, checkId?: string) => {
    if (e) e.preventDefault();
    const cleanId = (checkId || orderId).trim();
    if (!cleanId) {
      setError('Please enter a valid Order ID.');
      return;
    }

    if (cleanId.length < 3 || cleanId.length > 100 || !/^[a-zA-Z0-9_\-\.:]{3,100}$/.test(cleanId)) {
      setError('Invalid Order ID format. Must contain only letters, numbers, and hyphens/underscores.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await merchantGatewayService.checkPayoutStatus(cleanId);
      setResult(res);

      // If status changed or refund occurred, refresh merchant dashboard balances & ledger
      if (res.refunded || res.status === 'SUCCESS' || res.status === 'FAILED') {
        if (onStatusChecked) {
          onStatusChecked();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Transaction not found. Please verify the Order ID belongs to your merchant account.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-check if initialOrderId is provided with autoCheck
  React.useEffect(() => {
    if (initialOrderId && autoCheck) {
      setOrderId(initialOrderId);
      handleCheck(undefined, initialOrderId);
    }
  }, [initialOrderId, autoCheck]);

  const handleClear = () => {
    setOrderId('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Check Payout Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify real provider status or automatically refund failed Gateway payouts
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Automated Gateway Refund</span>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => handleCheck(e)} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter Order ID (e.g. PM260424ABCDEF1234, ORD_...)"
              disabled={loading}
              className="w-full pl-3.5 pr-8 py-2 bg-slate-50/50 border border-slate-300 rounded-md text-xs sm:text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-60"
            />
            {orderId && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !orderId.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-md shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Check Status</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Lookup Error: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Result Cards */}
      {result && (
        <div className="animate-in fade-in space-y-3">
          {/* 1. SUCCESS STATE */}
          {result.status === 'SUCCESS' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>🟢 Payout Successful</span>
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      Disbursed to beneficiary by banking provider
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-emerald-200/80 text-emerald-900">
                  Completed
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Order ID</span>
                  <span className="font-mono font-bold text-emerald-950 select-all">{result.order_id}</span>
                </div>
                {result.amount != null && (
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Transfer Amount</span>
                    <span className="font-mono font-bold text-emerald-950">{formatCurrency(result.amount)}</span>
                  </div>
                )}
                {result.fee != null && (
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Gateway Fee</span>
                    <span className="font-mono text-emerald-800">+{formatCurrency(result.fee)}</span>
                  </div>
                )}
                {result.provider_reference_id && (
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Bank UTR / Ref</span>
                    <span className="font-mono font-semibold text-emerald-900 select-all truncate block">
                      {result.provider_reference_id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. PROCESSING STATE */}
          {result.status === 'PROCESSING' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-blue-950 flex items-center gap-1.5">
                      <span>🟡 Payout Processing</span>
                    </h4>
                    <p className="text-[11px] text-blue-800">
                      Transaction is still processing with the banking network
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-blue-200/80 text-blue-900">
                  Processing
                </span>
              </div>

              <div className="p-2.5 bg-white/70 border border-blue-200/80 rounded text-xs text-blue-900 leading-relaxed">
                Clearing settlement usually completes within a few minutes. Locked float is preserved. If it does not complete, re-check here to trigger an automatic refund.
              </div>

              <div className="pt-2 border-t border-blue-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-blue-700 font-sans">Order ID:</span>
                  <span className="font-bold text-blue-950 select-all">{result.order_id}</span>
                </div>
                {result.amount != null && (
                  <div>
                    <span className="text-blue-700">Amount: </span>
                    <span className="font-mono font-bold text-blue-950">{formatCurrency(result.amount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. FAILED + REFUNDED STATE */}
          {result.status === 'FAILED' && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-md space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-rose-950 flex items-center gap-1.5">
                      <span>🔴 Payout Failed</span>
                    </h4>
                    <p className="text-[11px] text-rose-800">
                      The payout was declined or failed at banking provider
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-rose-200/80 text-rose-900">
                  Failed
                </span>
              </div>

              {/* Authoritative Refund Notification */}
              {result.refunded ? (
                <div className="p-3 bg-white border border-emerald-200 rounded-md flex items-start gap-3 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-100">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>💰 Amount refunded to your Gateway wallet</span>
                      {result.refund_amount != null && (
                        <span className="text-emerald-700 font-mono font-black">
                          (+{formatCurrency(result.refund_amount)})
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 mt-0.5 leading-snug text-[11px]">
                      The full locked/deducted float (Transfer Amount + Gateway Fee) has now been credited back to your Merchant Gateway wallet.
                    </p>
                    {result.rejection_reason && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-700">Provider Reason: </span>
                        <span>{result.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : result.already_refunded ? (
                <div className="p-3 bg-white border border-blue-200 rounded-md flex items-start gap-3 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>💰 Already Refunded to Gateway Wallet</span>
                      {result.refund_amount != null && (
                        <span className="text-blue-700 font-mono font-black">
                          ({formatCurrency(result.refund_amount)})
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 mt-0.5 leading-snug text-[11px]">
                      The full locked/deducted float (Transfer Amount + Gateway Fee) had already been safely refunded to your Gateway wallet previously.
                    </p>
                    {result.rejection_reason && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-700">Provider Reason: </span>
                        <span>{result.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : result.is_historical ? (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md flex items-start gap-3 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <span>ℹ️ Historical Transaction</span>
                      <span className="text-amber-800 font-mono text-[10px] font-semibold bg-amber-200/60 px-1.5 py-0.5 rounded">
                        Pre-Automation
                      </span>
                    </div>
                    <p className="text-amber-800 mt-0.5 leading-snug text-[11px]">
                      This transaction was created prior to automated refund activation. Wallet balance was not modified. Please contact support if manual reconciliation is required.
                    </p>
                    {result.rejection_reason && (
                      <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] text-amber-900/80">
                        <span className="font-semibold">Provider Reason: </span>
                        <span>{result.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : result.no_deduction ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-start gap-3 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 border border-slate-300">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-slate-800">
                      ℹ️ No Wallet Deduction Recorded
                    </div>
                    <p className="text-slate-600 mt-0.5 leading-snug text-[11px]">
                      No wallet funds were locked or deducted for this transaction, so ₹0.00 was refunded.
                    </p>
                    {result.rejection_reason && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-700">Provider Reason: </span>
                        <span>{result.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white border border-rose-200 rounded-md flex items-start gap-3 shadow-2xs">
                  <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 border border-rose-100">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-slate-900">
                      {result.message || 'Payout failed at banking provider.'}
                    </div>
                    {result.rejection_reason && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-700">Provider Reason: </span>
                        <span>{result.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-rose-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-rose-700 font-sans text-[11px]">Order ID:</span>
                  <span className="font-bold text-rose-950 select-all">{result.order_id}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-rose-800 font-medium">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Gateway Ledger Reconciled</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. UNKNOWN / AMBIGUOUS STATE */}
          {result.status === 'UNKNOWN' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    ⚪ Unable to confirm status
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Banking provider did not return a definitive status
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {result.message || 'Unable to confirm status with banking provider at this moment. Locked float is preserved. Please try again later.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
