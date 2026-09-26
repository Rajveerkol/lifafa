import type { LifafaTheme, ThemeVisualConfig } from '../../types';
import { createThemeComponents } from '../../shared/createThemeComponents';

export const newYearVisualConfig: ThemeVisualConfig = {
  id: 'new_year',
  name: 'New Year Gala',
  tagline: 'Midnight glamour with golden sparklers, fireworks, and festive cash drops',
  badge: '🎆 New Year',
  emoji: '🎆',
  description: 'Midnight glamour with golden sparklers, fireworks, and festive cash drops.',
  previewGradient: 'from-slate-950 via-indigo-950 to-amber-900',
  pageBackground: 'bg-gradient-to-b from-[#0F172A] via-[#1E1B4B] to-[#0F172A]',
  heroGradient: 'bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4338CA]',
  heroTagLabel: 'NEW YEAR LIFAFA 🎆',
  heroArtwork: '/images/themes/newyear_gift.jpg',
  progressBarFill: 'bg-gradient-to-r from-amber-400 to-yellow-300',
  channelHeaderIconBg: 'bg-indigo-600 text-white',
  channelHeaderBadgeBg: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  accentColor: '#F59E0B',
  ctaGradient: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700',
  ctaShadow: 'shadow-amber-500/25',
  ambientTextLeft: 'Happy New Year 2026 🥂',
  ambientTextRight: 'Together We Shine ⭐',
  ambientTextRotated: 'Golden Beginnings Big Cheer 🎆',
  ambientTextColor: 'text-indigo-400/30',
  isDark: true,
};

const components = createThemeComponents(newYearVisualConfig);

export const newYearTheme: LifafaTheme = {
  id: 'new_year',
  name: 'New Year Gala',
  tagline: newYearVisualConfig.tagline,
  badge: newYearVisualConfig.badge,
  description: newYearVisualConfig.description,
  previewGradient: newYearVisualConfig.previewGradient,
  typography: {
    headingFont: 'Playfair Display',
    numeralFont: 'Cinzel',
    bodyFont: 'Inter',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap',
    fallbackStack: `'Times New Roman', Times, serif`,
  },
  colors: {
    pageBackground: newYearVisualConfig.pageBackground,
    envelopePrimary: '#0f172a',
    envelopeSecondary: '#1e1b4b',
    envelopeAccent: '#f59e0b',
    cardBackground: 'bg-slate-900/90',
    cardBorder: 'border-slate-800',
    textPrimary: '#ffffff',
    textSecondary: '#e2e8f0',
    textMuted: '#94a3b8',
    highlightGold: '#f59e0b',
  },
  visualConfig: newYearVisualConfig,
  components,
};

export const NewYearEnvelope = components.Envelope;
export const NewYearClaimSection = components.ClaimSection;
export const NewYearTaskCard = components.TaskCard;
export const NewYearProgressIndicator = components.ProgressIndicator;
export const NewYearRewardReveal = components.RewardReveal;
export const NewYearDecorations = components.Decorations;
export const NewYearExpiredView = components.ExpiredView;
export const NewYearFullyClaimedView = components.FullyClaimedView;
