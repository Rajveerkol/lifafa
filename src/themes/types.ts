import React from 'react';
import type { Lifafa, LifafaTask } from '../types/database';

export type LifafaThemeId =
  | 'birthday'
  | 'new_year'
  | 'rewards'
  | 'diwali'
  | 'holi'
  | 'ganesh_chaturthi'
  | 'durga_navami';

export interface ThemeTypographyConfig {
  headingFont: string;
  numeralFont: string;
  bodyFont: string;
  googleFontsHref: string;
  fallbackStack: string;
}

export interface ThemeColorsConfig {
  pageBackground: string;
  envelopePrimary: string;
  envelopeSecondary: string;
  envelopeAccent: string;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  highlightGold: string;
}

export interface ThemeEnvelopeProps {
  lifafa: Lifafa;
  isEnvelopeOpened: boolean;
  onUnsealEnvelope?: () => void;
  claimedAmount?: number;
  timeLeft: string;
  isExpired: boolean;
}

export interface ThemeSealProps {
  isEnvelopeOpened: boolean;
  onUnsealEnvelope?: () => void;
  disabled?: boolean;
}

export interface ThemeClaimSectionProps {
  lifafa: Lifafa;
  user: any;
  isEnvelopeOpened: boolean;
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
  tasks: LifafaTask[];
  completedTaskIds: Set<string>;
  allRequiredDone: boolean;
  onTaskDone: (taskId: string) => void;
  onOpenAuth: () => void;
  onClaim: () => Promise<void>;
  claiming: boolean;
  errorMsg: string | null;
}

export interface ThemeTaskCardProps {
  task: LifafaTask & {
    telegram_channel_username?: string;
    telegram_channel_id?: number;
    is_channel_verified?: boolean;
  };
  isCompleted: boolean;
  onCompleted: (taskId: string) => void;
  onOpenAuth?: () => void;
}

export interface ThemeProgressProps {
  totalRequired: number;
  completedCount: number;
  allDone: boolean;
}

export interface ThemeRewardRevealProps {
  amount: number;
  code: string;
  payoutMode: string;
  lifafa: Lifafa;
  onClose?: () => void;
  onOpenShare?: (lifafa: Lifafa) => void;
}

export interface ThemeStatusProps {
  lifafa: Lifafa;
  onNavigateHome?: () => void;
  message?: string;
}

export interface ThemeDecorationsProps {
  className?: string;
}

export interface LifafaTheme {
  id: LifafaThemeId;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  previewGradient: string;
  typography: ThemeTypographyConfig;
  colors: ThemeColorsConfig;
  components: {
    Envelope: React.FC<ThemeEnvelopeProps>;
    ClaimSection: React.FC<ThemeClaimSectionProps>;
    TaskCard: React.FC<ThemeTaskCardProps>;
    ProgressIndicator: React.FC<ThemeProgressProps>;
    RewardReveal: React.FC<ThemeRewardRevealProps>;
    Decorations: React.FC<ThemeDecorationsProps>;
    ExpiredView: React.FC<ThemeStatusProps>;
    FullyClaimedView: React.FC<ThemeStatusProps>;
  };
}
