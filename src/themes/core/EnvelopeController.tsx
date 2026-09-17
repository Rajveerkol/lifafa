import React from 'react';
import type { Lifafa } from '../../types/database';
import { formatTimeRemaining } from '../../lib/utils';
import { useTheme } from '../ThemeContext';

export interface EnvelopeControllerProps {
  lifafa: Lifafa;
  isEnvelopeOpened: boolean;
  onUnsealEnvelope: () => void;
  claimedAmount?: number;
}

export const EnvelopeController: React.FC<EnvelopeControllerProps> = ({
  lifafa,
  isEnvelopeOpened,
  onUnsealEnvelope,
  claimedAmount,
}) => {
  const { theme: currentTheme } = useTheme();
  const { isExpired, formatted: timeLeft } = formatTimeRemaining(lifafa.expires_at);

  const EnvelopeComponent = currentTheme.components.Envelope;

  return (
    <EnvelopeComponent
      lifafa={lifafa}
      isEnvelopeOpened={isEnvelopeOpened}
      onUnsealEnvelope={onUnsealEnvelope}
      claimedAmount={claimedAmount}
      timeLeft={timeLeft}
      isExpired={isExpired}
    />
  );
};
