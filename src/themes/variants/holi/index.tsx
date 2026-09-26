import type { LifafaTheme, ThemeVisualConfig } from '../../types';
import { createThemeComponents } from '../../shared/createThemeComponents';

export const holiVisualConfig: ThemeVisualConfig = {
  id: 'holi',
  name: 'Holi Fiesta',
  tagline: 'Vibrant burst of organic colors, water splashes and joyful cash surprises',
  badge: '🎨 Holi',
  emoji: '🎨',
  description: 'Vibrant burst of organic colors, water splashes and joyful cash surprises.',
  previewGradient: 'from-pink-500 via-amber-500 to-cyan-500',
  pageBackground: 'bg-gradient-to-b from-[#FFF1F2] via-[#FEF2F2] to-[#FDF4FF]',
  heroGradient: 'bg-gradient-to-br from-[#EC4899] via-[#F59E0B] to-[#06B6D4]',
  heroTagLabel: 'HOLI LIFAFA 🎨',
  heroArtwork: '/images/themes/holi_gift.jpg',
  progressBarFill: 'bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-400',
  channelHeaderIconBg: 'bg-pink-600 text-white',
  channelHeaderBadgeBg: 'bg-yellow-50 text-amber-900 border-amber-200/80',
  accentColor: '#EC4899',
  ctaGradient: 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-600 hover:to-amber-600',
  ctaShadow: 'shadow-pink-500/25',
  ambientTextLeft: 'Bura Na Mano Holi Hai 🎨',
  ambientTextRight: 'Rang Barse Khushiyan ✨',
  ambientTextRotated: 'Festival of Colors Big Fun 🌈',
  ambientTextColor: 'text-pink-400/40',
};

const components = createThemeComponents(holiVisualConfig);

export const holiTheme: LifafaTheme = {
  id: 'holi',
  name: 'Holi Fiesta',
  tagline: holiVisualConfig.tagline,
  badge: holiVisualConfig.badge,
  description: holiVisualConfig.description,
  previewGradient: holiVisualConfig.previewGradient,
  typography: {
    headingFont: 'Comfortaa',
    numeralFont: 'Fredoka',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Fredoka:wght@600;700&family=Inter:wght@400;600;700&display=swap',
    fallbackStack: `'Arial Rounded MT Bold', sans-serif`,
  },
  colors: {
    pageBackground: holiVisualConfig.pageBackground,
    envelopePrimary: '#ec4899',
    envelopeSecondary: '#f59e0b',
    envelopeAccent: '#06b6d4',
    cardBackground: 'bg-white',
    cardBorder: 'border-pink-200',
    textPrimary: '#831843',
    textSecondary: '#9d174d',
    textMuted: '#be185d',
    highlightGold: '#f59e0b',
  },
  visualConfig: holiVisualConfig,
  components,
};

export const HoliEnvelope = components.Envelope;
export const HoliClaimSection = components.ClaimSection;
export const HoliTaskCard = components.TaskCard;
export const HoliProgressIndicator = components.ProgressIndicator;
export const HoliRewardReveal = components.RewardReveal;
export const HoliDecorations = components.Decorations;
export const HoliExpiredView = components.ExpiredView;
export const HoliFullyClaimedView = components.FullyClaimedView;
