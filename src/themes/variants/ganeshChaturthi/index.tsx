import type { LifafaTheme, ThemeVisualConfig } from '../../types';
import { createThemeComponents } from '../../shared/createThemeComponents';

export const ganeshVisualConfig: ThemeVisualConfig = {
  id: 'ganesh_chaturthi',
  name: 'Ganesh Utsav',
  tagline: 'Divine blessings of Lord Ganesha with sweet modak, auspicious marigold and good fortune',
  badge: '🐘 Ganesh Utsav',
  emoji: '🐘',
  description: 'Divine blessings of Lord Ganesha with sweet modak, auspicious marigold and good fortune.',
  previewGradient: 'from-orange-600 via-amber-600 to-red-700',
  pageBackground: 'bg-gradient-to-b from-[#FFFBEB] via-[#FEF3C7] to-[#FFF7ED]',
  heroGradient: 'bg-gradient-to-br from-[#EA580C] via-[#C2410C] to-[#B91C1C]',
  heroTagLabel: 'GANESH UTSAV LIFAFA 🐘',
  heroArtwork: '/images/themes/ganesh_gift.jpg',
  progressBarFill: 'bg-gradient-to-r from-amber-400 to-yellow-400',
  channelHeaderIconBg: 'bg-orange-600 text-white',
  channelHeaderBadgeBg: 'bg-amber-50 text-amber-900 border-amber-300/80',
  accentColor: '#EA580C',
  ctaGradient: 'bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-700 hover:to-red-700',
  ctaShadow: 'shadow-orange-500/25',
  ambientTextLeft: 'Ganpati Bappa Morya 🐘',
  ambientTextRight: 'Siddhi Vinayak Blessings 🕉️',
  ambientTextRotated: 'Mangal Murti Big Joy ✨',
  ambientTextColor: 'text-orange-400/30',
};

const components = createThemeComponents(ganeshVisualConfig);

export const ganeshTheme: LifafaTheme = {
  id: 'ganesh_chaturthi',
  name: 'Ganesh Utsav',
  tagline: ganeshVisualConfig.tagline,
  badge: ganeshVisualConfig.badge,
  description: ganeshVisualConfig.description,
  previewGradient: ganeshVisualConfig.previewGradient,
  typography: {
    headingFont: 'Samarkan',
    numeralFont: 'Rozha One',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Rozha+One&display=swap',
    fallbackStack: `'Palatino Linotype', 'Book Antiqua', serif`,
  },
  colors: {
    pageBackground: ganeshVisualConfig.pageBackground,
    envelopePrimary: '#ea580c',
    envelopeSecondary: '#c2410c',
    envelopeAccent: '#f59e0b',
    cardBackground: 'bg-white',
    cardBorder: 'border-orange-200',
    textPrimary: '#431407',
    textSecondary: '#7c2d12',
    textMuted: '#9a3412',
    highlightGold: '#f59e0b',
  },
  visualConfig: ganeshVisualConfig,
  components,
};

export const GaneshEnvelope = components.Envelope;
export const GaneshClaimSection = components.ClaimSection;
export const GaneshTaskCard = components.TaskCard;
export const GaneshProgressIndicator = components.ProgressIndicator;
export const GaneshRewardReveal = components.RewardReveal;
export const GaneshDecorations = components.Decorations;
export const GaneshExpiredView = components.ExpiredView;
export const GaneshFullyClaimedView = components.FullyClaimedView;
