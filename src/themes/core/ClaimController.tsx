import React, { useState } from 'react';
import type { Lifafa, LifafaTask } from '../../types/database';
import { lifafaService } from '../../services/lifafaService';
import { useAuth } from '../../context/AuthContext';

export interface UseClaimLogicResult {
  pinCode: string;
  setPinCode: (val: string) => void;
  requiresPin: boolean;
  accountHolderName: string;
  setAccountHolderName: (val: string) => void;
  bankAccountNumber: string;
  setBankAccountNumber: (val: string) => void;
  ifscCode: string;
  setIfscCode: (val: string) => void;
  upiId: string;
  setUpiId: (val: string) => void;
  claiming: boolean;
  errorMsg: string | null;
  setErrorMsg: (val: string | null) => void;
  executeClaim: () => Promise<void>;
}

export function useClaimLogic(
  lifafa: Lifafa | null,
  code: string,
  allRequiredDone: boolean,
  onOpenAuth?: () => void,
  onClaimSuccess?: (claimResult: {
    amount: number;
    code: string;
    payoutMode: string;
    payoutDispatched?: boolean;
    withdrawalStatus?: string;
    payoutError?: string;
    referenceId?: string;
  }) => void
): UseClaimLogicResult {
  const { user, refreshWallet } = useAuth();
  const [pinCode, setPinCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const requiresPin = Boolean(lifafa?.pin_code);

  const executeClaim = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!lifafa) return;

    if (!allRequiredDone) {
      setErrorMsg('Please complete all required tasks above to claim your reward.');
      return;
    }

    if (requiresPin && !pinCode.trim()) {
      setErrorMsg('Please enter the secret PIN code to unlock this Lifafa.');
      return;
    }

    // Payout details validation if in UPI_BANK mode
    if (lifafa.payout_mode === 'UPI_BANK') {
      if (!accountHolderName.trim() || accountHolderName.trim().length < 2) {
        setErrorMsg('Please enter your full registered bank account holder name.');
        return;
      }
      if (!bankAccountNumber.trim() || bankAccountNumber.trim().length < 6) {
        setErrorMsg('Please enter a valid Bank Account Number (minimum 6 digits).');
        return;
      }
      if (!ifscCode.trim() || !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifscCode.trim())) {
        setErrorMsg('Please enter a valid 11-character IFSC code (e.g. SBIN0001234).');
        return;
      }
    }

    try {
      setClaiming(true);
      setErrorMsg(null);

      const payoutDetails =
        lifafa.payout_mode === 'UPI_BANK'
          ? {
              accountHolderName: accountHolderName.trim(),
              bankAccountNumber: bankAccountNumber.trim() || undefined,
              ifscCode: ifscCode.trim().toUpperCase() || undefined,
              upiId: upiId.trim() || undefined,
            }
          : undefined;

      const idempotencyKey = crypto.randomUUID();

      const res = await lifafaService.claimLifafa(
        lifafa.code || code,
        pinCode.trim() || undefined,
        undefined,
        undefined,
        idempotencyKey,
        payoutDetails
      );

      await refreshWallet();

      if (onClaimSuccess) {
        onClaimSuccess({
          amount: res.amount,
          code: lifafa.code || code,
          payoutMode: res.payout_mode || lifafa.payout_mode || 'WALLET',
          payoutDispatched: res.payout_dispatched,
          withdrawalStatus: res.withdrawal_status,
          payoutError: res.payout_error,
          referenceId: res.payout_reference_id,
        });
      }
    } catch (err: any) {
      console.error('Claim error:', err);
      setErrorMsg(err.message || 'Failed to claim Lifafa. Please verify tasks and try again.');
    } finally {
      setClaiming(false);
    }
  };

  return {
    pinCode,
    setPinCode,
    requiresPin,
    accountHolderName,
    setAccountHolderName,
    bankAccountNumber,
    setBankAccountNumber,
    ifscCode,
    setIfscCode,
    upiId,
    setUpiId,
    claiming,
    errorMsg,
    setErrorMsg,
    executeClaim,
  };
}
