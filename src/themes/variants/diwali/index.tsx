import type { LifafaTheme, ThemeVisualConfig } from '../../types';
import { createThemeComponents } from '../../shared/createThemeComponents';

export const diwaliVisualConfig: ThemeVisualConfig = {
  id: 'diwali',
  name: 'Diwali Dhamaka',
  tagline: 'Auspicious deepotsav with glowing earthen diyas, marigold flowers and festive rewards',
  badge: '🪔 Diwali',
  emoji: '🪔',
  description: 'Auspicious deepotsav with glowing earthen diyas, marigold flowers and festive rewards.',
  previewGradient: 'from-purple-900 via-amber-600 to-rose-900',
  pageBackground: 'bg-gradient-to-b from-[#FFFBEB] via-[#FEF3C7] to-[#FFF7ED]',
  heroGradient: 'bg-gradient-to-br from-[#581C87] via-[#7E22CE] to-[#9D174D]',
  heroTagLabel: 'DIWALI LIFAFA 🪔',
  heroArtwork: '/images/themes/diwali_gift.jpg',
  progressBarFill: 'bg-gradient-to-r from-amber-400 to-yellow-400',
  channelHeaderIconBg: 'bg-purple-700 text-white',
  channelHeaderBadgeBg: 'bg-amber-50 text-amber-900 border-amber-300/80',
  accentColor: '#D97706',
  ctaGradient: 'bg-gradient-to-r from-amber-500 via-orange-600 to-purple-700 hover:from-amber-600 hover:to-purple-800',
  ctaShadow: 'shadow-amber-500/25',
  ambientTextLeft: 'Shubh Deepavali 🪔',
  ambientTextRight: 'Lights Joy & Prosperity ✨',
  ambientTextRotated: 'Festive Drop Big Happiness 🪔',
  ambientTextColor: 'text-amber-500/30',
};

const components = createThemeComponents(diwaliVisualConfig);

export const diwaliTheme: LifafaTheme = {
  id: 'diwali',
  name: 'Diwali Dhamaka',
  tagline: diwaliVisualConfig.tagline,
  badge: diwaliVisualConfig.badge,
  description: diwaliVisualConfig.description,
  previewGradient: diwaliVisualConfig.previewGradient,
  typography: {
    headingFont: 'Rozha One',
    numeralFont: 'Cinzel Decorative',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Inter:wght@400;600;700&family=Rozha+One&display=swap',
    fallbackStack: `'Georgia', serif`,
  },
  colors: {
    pageBackground: diwaliVisualConfig.pageBackground,
    envelopePrimary: '#581c87',
    envelopeSecondary: '#7e22ce',
    envelopeAccent: '#d97706',
    cardBackground: 'bg-white',
    cardBorder: 'border-amber-200',
    textPrimary: '#451a03',
    textSecondary: '#78350f',
    textMuted: '#92400e',
    highlightGold: '#f59e0b',
  },
  visualConfig: diwaliVisualConfig,
  components,
};

export const DiwaliEnvelope = components.Envelope;
export const DiwaliClaimSection = components.ClaimSection;
export const DiwaliTaskCard = components.TaskCard;
export const DiwaliProgressIndicator = components.ProgressIndicator;
export const DiwaliRewardReveal = components.RewardReveal;
export const DiwaliDecorations = components.Decorations;
export const DiwaliExpiredView = components.ExpiredView;
export const DiwaliFullyClaimedView = components.FullyClaimedView;
