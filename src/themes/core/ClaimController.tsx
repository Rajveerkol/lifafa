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

    if (user && lifafa.creator_id === user.id) {
      setErrorMsg('Creators cannot claim their own Lifafa.');
      return;
    }

    if ((lifafa as any).withdrawal_status === 'BLOCKED') {
      setErrorMsg('This Lifafa has been blocked by platform administration.');
      return;
    }

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
      const cleanName = accountHolderName.trim();
      const cleanAcc = bankAccountNumber.trim();
      const cleanIfsc = ifscCode.trim().toUpperCase();
      const cleanUpi = upiId.trim();

      if (!cleanName || cleanName.length < 2) {
        setErrorMsg('Please enter your full registered bank account holder name.');
        return;
      }
      if (!cleanAcc || !/^\d{6,20}$/.test(cleanAcc)) {
        setErrorMsg('Please enter a valid bank account number.');
        return;
      }
      if (!cleanIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        setErrorMsg('Please enter a valid IFSC code.');
        return;
      }
      // Optional UPI ID fallback: empty is allowed, but if provided, must be valid
      if (cleanUpi && !/^[a-zA-Z0-9._-]{2,100}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
        setErrorMsg('Please enter a valid UPI ID.');
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
      let rawMsg = err.message || 'Failed to claim Lifafa. Please verify tasks and try again.';
      if (rawMsg.toLowerCase().includes('regular expression') || rawMsg.toLowerCase().includes('repetition count')) {
        rawMsg = 'Please enter a valid IFSC code or Bank Account.';
      }
      setErrorMsg(rawMsg);
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
