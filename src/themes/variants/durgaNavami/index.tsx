import type { LifafaTheme, ThemeVisualConfig } from '../../types';
import { createThemeComponents } from '../../shared/createThemeComponents';

export const durgaVisualConfig: ThemeVisualConfig = {
  id: 'durga_navami',
  name: 'Durga Navami',
  tagline: 'Sacred celebration of divine feminine power with crimson sindoor, lotus and festive gifts',
  badge: '🔱 Durga Navami',
  emoji: '🔱',
  description: 'Sacred celebration of divine feminine power with crimson sindoor, lotus and festive gifts.',
  previewGradient: 'from-red-900 via-rose-900 to-amber-700',
  pageBackground: 'bg-gradient-to-b from-[#FFF1F2] via-[#FFE4E6] to-[#FFF7ED]',
  heroGradient: 'bg-gradient-to-br from-[#991B1B] via-[#7F1D1D] to-[#450A0A]',
  heroTagLabel: 'SHUBH NAVAMI LIFAFA 🔱',
  heroArtwork: '/images/themes/navami_gift.jpg',
  progressBarFill: 'bg-gradient-to-r from-amber-400 to-yellow-400',
  channelHeaderIconBg: 'bg-red-700 text-white',
  channelHeaderBadgeBg: 'bg-red-50 text-red-900 border-red-200/80',
  accentColor: '#991B1B',
  ctaGradient: 'bg-gradient-to-r from-red-700 via-rose-700 to-amber-600 hover:from-red-800 hover:to-amber-700',
  ctaShadow: 'shadow-red-600/25',
  ambientTextLeft: 'Jai Mata Di 🔱',
  ambientTextRight: 'Shubh Durga Navami 🌺',
  ambientTextRotated: 'Devi Blessings Big Happiness 🔱',
  ambientTextColor: 'text-red-400/30',
};

const components = createThemeComponents(durgaVisualConfig);

export const durgaTheme: LifafaTheme = {
  id: 'durga_navami',
  name: 'Durga Navami',
  tagline: durgaVisualConfig.tagline,
  badge: durgaVisualConfig.badge,
  description: durgaVisualConfig.description,
  previewGradient: durgaVisualConfig.previewGradient,
  typography: {
    headingFont: 'Rozha One',
    numeralFont: 'Cinzel Decorative',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Inter:wght@400;600;700&family=Rozha+One&display=swap',
    fallbackStack: `'Times New Roman', Times, serif`,
  },
  colors: {
    pageBackground: durgaVisualConfig.pageBackground,
    envelopePrimary: '#991b1b',
    envelopeSecondary: '#7f1d1d',
    envelopeAccent: '#f59e0b',
    cardBackground: 'bg-white',
    cardBorder: 'border-red-200',
    textPrimary: '#450a0a',
    textSecondary: '#7f1d1d',
    textMuted: '#991b1b',
    highlightGold: '#f59e0b',
  },
  visualConfig: durgaVisualConfig,
  components,
};

export const DurgaEnvelope = components.Envelope;
export const DurgaClaimSection = components.ClaimSection;
export const DurgaTaskCard = components.TaskCard;
export const DurgaProgressIndicator = components.ProgressIndicator;
export const DurgaRewardReveal = components.RewardReveal;
export const DurgaDecorations = components.Decorations;
export const DurgaExpiredView = components.ExpiredView;
export const DurgaFullyClaimedView = components.FullyClaimedView;
