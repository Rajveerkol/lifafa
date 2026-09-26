import type { LifafaTheme, ThemeVisualConfig } from '../../types';
import { createThemeComponents } from '../../shared/createThemeComponents';

export const birthdayVisualConfig: ThemeVisualConfig = {
  id: 'birthday',
  name: 'Birthday Bash',
  tagline: 'Joyful birthday celebration with pastel ribbons, balloons, and sweet surprises',
  badge: '🎂 Birthday',
  emoji: '🎂',
  description: 'Joyful birthday celebration with pastel ribbons, balloons, and sweet surprises.',
  previewGradient: 'from-pink-500 via-rose-500 to-purple-600',
  pageBackground: 'bg-gradient-to-b from-[#FFF0F5] via-[#FFF5F8] to-[#FDF2F8]',
  heroGradient: 'bg-gradient-to-br from-[#E11D48] via-[#EC4899] to-[#9333EA]',
  heroTagLabel: 'BIRTHDAY LIFAFA 🎂',
  heroArtwork: '/images/themes/birthday_gift.jpg',
  progressBarFill: 'bg-gradient-to-r from-pink-400 to-purple-500',
  channelHeaderIconBg: 'bg-rose-500 text-white',
  channelHeaderBadgeBg: 'bg-pink-50 text-pink-800 border-pink-200/80',
  accentColor: '#EC4899',
  ctaGradient: 'bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-700 hover:to-purple-700',
  ctaShadow: 'shadow-pink-500/25',
  ambientTextLeft: 'Celebrate Share Joy 🎂',
  ambientTextRight: 'Make Wishes Come True ✨',
  ambientTextRotated: 'Birthday Gift Big Happiness ♡',
  ambientTextColor: 'text-pink-400/30',
};

const components = createThemeComponents(birthdayVisualConfig);

export const birthdayTheme: LifafaTheme = {
  id: 'birthday',
  name: 'Birthday Bash',
  tagline: birthdayVisualConfig.tagline,
  badge: birthdayVisualConfig.badge,
  description: birthdayVisualConfig.description,
  previewGradient: birthdayVisualConfig.previewGradient,
  typography: {
    headingFont: 'Fredoka',
    numeralFont: 'Fredoka',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Inter:wght@400;600;700&display=swap',
    fallbackStack: `'Comic Sans MS', 'Chalkboard SE', cursive, sans-serif`,
  },
  colors: {
    pageBackground: birthdayVisualConfig.pageBackground,
    envelopePrimary: '#f43f5e',
    envelopeSecondary: '#ec4899',
    envelopeAccent: '#fbbf24',
    cardBackground: 'bg-white/95',
    cardBorder: 'border-pink-200',
    textPrimary: '#881337',
    textSecondary: '#9f1239',
    textMuted: '#be123c',
    highlightGold: '#f59e0b',
  },
  visualConfig: birthdayVisualConfig,
  components,
};

export const BirthdayEnvelope = components.Envelope;
export const BirthdayClaimSection = components.ClaimSection;
export const BirthdayTaskCard = components.TaskCard;
export const BirthdayProgressIndicator = components.ProgressIndicator;
export const BirthdayRewardReveal = components.RewardReveal;
export const BirthdayDecorations = components.Decorations;
export const BirthdayExpiredView = components.ExpiredView;
export const BirthdayFullyClaimedView = components.FullyClaimedView;
