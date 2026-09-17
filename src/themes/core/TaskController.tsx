import React, { useState, useEffect, useRef } from 'react';
import type { LifafaTask } from '../../types/database';
import { taskService } from '../../services/taskService';
import { telegramService } from '../../services/telegramService';
import { useAuth } from '../../context/AuthContext';

export interface UseTaskLogicResult {
  user: any;
  isTelegramTask: boolean;
  channelUsername: string;
  channelUrl: string;
  // Non-telegram state & actions
  genericLoading: boolean;
  genericError: string | null;
  handleGenericAction: () => Promise<void>;
  // Telegram state & actions
  hasJoined: boolean;
  setHasJoined: (val: boolean) => void;
  tgBinding: {
    isBound: boolean;
    telegramUsername: string | null;
    telegramUserId: number | null;
  } | null;
  isConnectingTg: boolean;
  awaitingBotStart: boolean;
  botDeepLink: string | null;
  isVerifyingMembership: boolean;
  verificationError: string | null;
  handleJoinTelegram: (e?: React.MouseEvent) => void;
  handleConnectTelegram: (e?: React.MouseEvent) => Promise<void>;
  handleVerifyMembership: (e?: React.MouseEvent) => Promise<void>;
  checkBindingStatus: (silent?: boolean) => Promise<void>;
}

export function useTaskLogic(
  task: LifafaTask & {
    telegram_channel_username?: string;
    telegram_channel_id?: number;
    is_channel_verified?: boolean;
  },
  isCompleted: boolean,
  onCompleted: (taskId: string) => void,
  onOpenAuth?: () => void
): UseTaskLogicResult {
  const { user } = useAuth();
  const [genericLoading, setGenericLoading] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  const isTelegramTask =
    task.task_type === 'TELEGRAM_JOIN' || task.task_type === 'TELEGRAM_BOT';

  const [hasJoined, setHasJoined] = useState(false);
  const [tgBinding, setTgBinding] = useState<{
    isBound: boolean;
    telegramUsername: string | null;
    telegramUserId: number | null;
  } | null>(null);
  const [isConnectingTg, setIsConnectingTg] = useState(false);
  const [awaitingBotStart, setAwaitingBotStart] = useState(false);
  const [botDeepLink, setBotDeepLink] = useState<string | null>(null);
  const [isVerifyingMembership, setIsVerifyingMembership] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  // Normalization
  const rawTarget = (task.target_url || '').trim();
  const cleanTarget = rawTarget.replace(/\/+$/, '');
  const extractedUsername = (
    task.telegram_channel_username ||
    cleanTarget.split('/').pop() ||
    cleanTarget
  )
    .replace(/^@/, '')
    .trim();

  const channelUsername = extractedUsername.startsWith('http') ? '' : extractedUsername;

  const channelUrl = cleanTarget.startsWith('http')
    ? cleanTarget
    : cleanTarget.startsWith('t.me/')
    ? `https://${cleanTarget}`
    : channelUsername
    ? `https://t.me/${channelUsername}`
    : 'https://t.me';

  const checkBindingStatus = async (silent = false) => {
    if (!user) return;
    try {
      const status = await telegramService.getUserTelegramBinding(user.id);
      setTgBinding(status);
      if (status.isBound) {
        setAwaitingBotStart(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (!silent) {
        setVerificationError(
          'Telegram account not linked yet. Please tap START in @createlifafa_bot and retry.'
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isTelegramTask && user) {
      checkBindingStatus(true);
    }
  }, [isTelegramTask, user]);

  useEffect(() => {
    if (awaitingBotStart && user) {
      pollIntervalRef.current = setInterval(() => {
        checkBindingStatus(true);
      }, 2500);

      const handleWindowFocus = () => {
        checkBindingStatus(true);
      };
      window.addEventListener('focus', handleWindowFocus);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, [awaitingBotStart, user]);

  const handleJoinTelegram = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHasJoined(true);
    try {
      window.open(channelUrl, '_blank', 'noopener,noreferrer');
    } catch {}
  };

  const handleConnectTelegram = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) {
      setVerificationError('Please sign in with Google to connect your Telegram account.');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    try {
      setIsConnectingTg(true);
      setVerificationError(null);
      const nonce = await telegramService.generateBindingNonce();
      const deepLink = telegramService.getBindingDeepLink(nonce);
      setBotDeepLink(deepLink);
      setAwaitingBotStart(true);

      try {
        const a = document.createElement('a');
        a.href = deepLink;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        try {
          window.open(deepLink, '_blank', 'noopener,noreferrer');
        } catch {}
      }
    } catch (err: any) {
      setVerificationError(err.message || 'Failed to initiate Telegram connection');
    } finally {
      setIsConnectingTg(false);
    }
  };

  const handleVerifyMembership = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isCompleted || !user) {
      if (!user && onOpenAuth) onOpenAuth();
      return;
    }

    if (!tgBinding?.isBound || !tgBinding.telegramUserId) {
      setVerificationError('Please connect your Telegram account first.');
      return;
    }

    try {
      setIsVerifyingMembership(true);
      setVerificationError(null);

      const targetIdentifier = channelUsername || task.telegram_channel_username || '';

      const result = await telegramService.verifyMembership(
        targetIdentifier,
        task.telegram_channel_id,
        tgBinding.telegramUserId,
        task.id,
        tgBinding.telegramUsername
      );

      if (result.verified) {
        onCompleted(task.id);
      } else {
        setVerificationError(
          result.error ||
          "We couldn't verify your membership yet. Please make sure you joined the channel, then try again."
        );
      }
    } catch {
      setVerificationError(
        "We couldn't verify your membership yet. Please make sure you joined the channel, then try again."
      );
    } finally {
      setIsVerifyingMembership(false);
    }
  };

  const handleGenericAction = async () => {
    if (isCompleted || !user) {
      if (!user && onOpenAuth) onOpenAuth();
      return;
    }

    if (task.target_url) {
      window.open(task.target_url, '_blank', 'noopener,noreferrer');
    }

    try {
      setGenericLoading(true);
      setGenericError(null);
      const res = await taskService.verifyAndRecordTask(
        task.id,
        task.lifafa_id,
        user.id,
        task.task_type,
        task.target_url
      );

      if (res.verified) {
        onCompleted(task.id);
      } else {
        setGenericError(res.message);
      }
    } catch (e: any) {
      setGenericError(e.message || 'Verification failed');
    } finally {
      setGenericLoading(false);
    }
  };

  return {
    user,
    isTelegramTask,
    channelUsername,
    channelUrl,
    genericLoading,
    genericError,
    handleGenericAction,
    hasJoined,
    setHasJoined,
    tgBinding,
    isConnectingTg,
    awaitingBotStart,
    botDeepLink,
    isVerifyingMembership,
    verificationError,
    handleJoinTelegram,
    handleConnectTelegram,
    handleVerifyMembership,
    checkBindingStatus,
  };
}
