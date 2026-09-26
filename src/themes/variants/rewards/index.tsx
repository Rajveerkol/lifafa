import type { LifafaTheme, ThemeVisualConfig } from '../../types';
import { createThemeComponents } from '../../shared/createThemeComponents';

export const rewardsVisualConfig: ThemeVisualConfig = {
  id: 'rewards',
  name: 'Digital Reward',
  tagline: 'Premium digital reward envelope with royal blue gradients and cash rewards',
  badge: '🎁 Reward',
  emoji: '🎁',
  description: 'Premium digital reward envelope with royal blue gradients and cash rewards.',
  previewGradient: 'from-[#1E3A8A] via-[#1E40AF] to-[#1D4ED8]',
  pageBackground: 'bg-gradient-to-b from-[#F0F6FF] via-[#E8F1FD] to-[#F3F8FF]',
  heroGradient: 'bg-gradient-to-br from-[#1E40AF] via-[#1D4ED8] to-[#1E3A8A]',
  heroTagLabel: 'YOUR LIFAFA 🎁',
  heroArtwork: '/images/themes/rewards_gift.jpg',
  progressBarFill: 'bg-gradient-to-r from-sky-400 to-blue-500',
  channelHeaderIconBg: 'bg-blue-600 text-white',
  channelHeaderBadgeBg: 'bg-amber-50 text-amber-800 border-amber-200/80',
  accentColor: '#2563EB',
  ctaGradient: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
  ctaShadow: 'shadow-blue-500/25',
  ambientTextLeft: 'Join Share Earn ❤️',
  ambientTextRight: 'Together We Grow 🌱',
  ambientTextRotated: 'Small Gift Big Happiness ♡',
  ambientTextColor: 'text-blue-300/40',
};

const components = createThemeComponents(rewardsVisualConfig);

export const rewardsTheme: LifafaTheme = {
  id: 'rewards',
  name: 'Digital Reward',
  tagline: rewardsVisualConfig.tagline,
  badge: rewardsVisualConfig.badge,
  description: rewardsVisualConfig.description,
  previewGradient: rewardsVisualConfig.previewGradient,
  typography: {
    headingFont: 'Inter',
    numeralFont: 'Inter',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap',
    fallbackStack: `'Trebuchet MS', 'Segoe UI', sans-serif`,
  },
  colors: {
    pageBackground: rewardsVisualConfig.pageBackground,
    envelopePrimary: '#1e3a8a',
    envelopeSecondary: '#1d4ed8',
    envelopeAccent: '#38bdf8',
    cardBackground: 'bg-white',
    cardBorder: 'border-slate-100',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    highlightGold: '#f59e0b',
  },
  visualConfig: rewardsVisualConfig,
  components,
};

export const RewardsEnvelope = components.Envelope;
export const RewardsClaimSection = components.ClaimSection;
export const RewardsTaskCard = components.TaskCard;
export const RewardsProgressIndicator = components.ProgressIndicator;
export const RewardsRewardReveal = components.RewardReveal;
export const RewardsDecorations = components.Decorations;
export const RewardsExpiredView = components.ExpiredView;
export const RewardsFullyClaimedView = components.FullyClaimedView;
