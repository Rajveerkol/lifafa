import React, { useState } from 'react';
import {
  X,
  ArrowRightLeft,
  Wallet,
  Ticket,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { duelService, TICKET_CONVERSION_RATE } from '../../services/duelService';
import { formatCurrency } from '../../lib/utils';

interface ConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'CASH_TO_TICKETS' | 'TICKETS_TO_CASH';
  cashBalance: number;
  ticketBalance: number;
  onSuccess?: () => void;
}

export const ConversionModal: React.FC<ConversionModalProps> = ({
  isOpen,
  onClose,
  mode,
  cashBalance,
  ticketBalance,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const isCashToTickets = mode === 'CASH_TO_TICKETS';

  // Input states
  const [amountInput, setAmountInput] = useState<string>(isCashToTickets ? '50' : '5');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  // Conversions calculations
  const parsedVal = Number(amountInput) || 0;
  const cashAmount = isCashToTickets ? parsedVal : parsedVal * TICKET_CONVERSION_RATE;
  const ticketCount = isCashToTickets ? Math.floor(parsedVal / TICKET_CONVERSION_RATE) : parsedVal;

  const resultingCash = isCashToTickets
    ? Math.max(0, cashBalance - cashAmount)
    : cashBalance + cashAmount;

  const resultingTickets = isCashToTickets
    ? ticketBalance + ticketCount
    : Math.max(0, ticketBalance - ticketCount);

  // Validation rules
  let validationError: string | null = null;
  if (isCashToTickets) {
    if (parsedVal <= 0) {
      validationError = 'Enter an amount greater than ₹0';
    } else if (parsedVal % TICKET_CONVERSION_RATE !== 0) {
      validationError = `Amount must be a multiple of ₹${TICKET_CONVERSION_RATE}`;
    } else if (parsedVal > cashBalance) {
      validationError = `Insufficient balance (Available: ${formatCurrency(cashBalance)})`;
    }
  } else {
    if (parsedVal < 1 || !Number.isInteger(parsedVal)) {
      validationError = 'Enter at least 1 ticket (whole number)';
    } else if (parsedVal > ticketBalance) {
      validationError = `Insufficient tickets (Available: ${ticketBalance} Tickets)`;
    }
  }

  // Quick preset chips
  const presets = isCashToTickets ? [20, 50, 100, 200, 500] : [2, 5, 10, 20, 50];

  const handleConfirm = async () => {
    if (validationError) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setActivationNotice(null);

    try {
      if (isCashToTickets) {
        const res = await duelService.convertCashToTickets(parsedVal);
        if (res.isPendingActivation) {
          setActivationNotice(
            res.message || 'Game balance conversion is currently being activated. No balance has been changed.'
          );
        } else if (!res.success) {
          setErrorMessage(res.message || 'Failed to convert cash to Game Tickets.');
        } else {
          if (onSuccess) onSuccess();
          onClose();
        }
      } else {
        const res = await duelService.convertTicketsToCash(parsedVal);
        if (res.isPendingActivation) {
          setActivationNotice(
            res.message || 'Game balance conversion is currently being activated. No balance has been changed.'
          );
        } else if (!res.success) {
          setErrorMessage(res.message || 'Failed to convert Game Tickets to cash.');
        } else {
          if (onSuccess) onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process conversion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 p-6 sm:p-7 relative max-h-[95vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
              isCashToTickets
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-orange-500/20'
                : 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/20'
            }`}
          >
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {isCashToTickets ? 'Cash → Tickets' : 'Tickets → Cash'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isCashToTickets
                ? 'Exchange available wallet cash for Game Tickets'
                : 'Convert your Game Tickets back into available cash'}
            </p>
          </div>
        </div>

        {/* Conversion Rate Card */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-950">Conversion Rate:</span>
          </div>
          <span className="text-xs font-black text-amber-900 font-mono bg-white px-2.5 py-1 rounded-xl border border-amber-200">
            ₹10.00 = 1 Game Ticket
          </span>
        </div>

        {/* Current Balances Header */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-center">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Game Balance</span>
            <span className="text-sm font-black text-slate-900 font-mono">
              {formatCurrency(cashBalance)}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Game Tickets</span>
            <span className="text-sm font-black text-amber-600 font-mono">
              {ticketBalance} 🎟️
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-bold text-slate-700 block">
            {isCashToTickets ? 'Amount to Convert (₹)' : 'Number of Tickets to Convert'}
          </label>
          <div className="relative">
            <input
              type="number"
              min={isCashToTickets ? 10 : 1}
              step={isCashToTickets ? 10 : 1}
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setErrorMessage(null);
                setActivationNotice(null);
              }}
              placeholder={isCashToTickets ? '50' : '5'}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-slate-900 font-mono font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">
              {isCashToTickets ? 'INR (₹)' : 'Tickets (🎟️)'}
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setAmountInput(String(p));
                  setErrorMessage(null);
                  setActivationNotice(null);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  parsedVal === p
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isCashToTickets ? `₹${p}` : `${p} 🎟️`}
              </button>
            ))}
          </div>
        </div>

        {/* Live Resulting Balance Preview */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5 mb-5 text-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Conversion Summary
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">
              {isCashToTickets ? 'Tickets to Receive:' : 'Cash Value to Receive:'}
            </span>
            <span className="font-black text-amber-400 font-mono text-sm">
              {isCashToTickets ? `${ticketCount} Game Tickets` : formatCurrency(cashAmount)}
            </span>
          </div>
          <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-slate-300">
            <span>Resulting Cash Balance:</span>
            <span className="font-mono font-bold text-white">{formatCurrency(resultingCash)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Resulting Ticket Balance:</span>
            <span className="font-mono font-bold text-amber-300">{resultingTickets} Tickets</span>
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Backend Error Banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Activation Notice Banner (Requirement 4) */}
        {activationNotice && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1 mb-4">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Backend Activation Notice</span>
            </div>
            <p className="leading-relaxed pl-6">{activationNotice}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={Boolean(validationError) || isSubmitting}
            onClick={handleConfirm}
            className={`flex-1 py-3 px-4 rounded-2xl text-white text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5 ${
              validationError || isSubmitting
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : isCashToTickets
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-orange-500/20'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/20'
            }`}
          >
            {isSubmitting ? (
              <span>Processing...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Conversion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
