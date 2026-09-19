import { useMemo, useEffect } from 'react';
import type { Lifafa } from '../types/database';
import type { LifafaThemeId } from './types';

export const VALID_THEMES: LifafaThemeId[] = [
  'birthday',
  'new_year',
  'rewards',
  'diwali',
  'holi',
  'ganesh_chaturthi',
  'durga_navami',
];

export const DEFAULT_THEME_ID: LifafaThemeId = 'rewards';

/**
 * Normalizes input string to a valid LifafaThemeId, or returns null if invalid.
 */
export function normalizeThemeId(raw?: string | null): LifafaThemeId | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/-/g, '_');
  if (VALID_THEMES.includes(cleaned as LifafaThemeId)) {
    return cleaned as LifafaThemeId;
  }
  return null;
}

/**
 * Performs semantic occasion keyword heuristic detection from title and message.
 */
export function inferThemeFromContent(title?: string | null, message?: string | null): LifafaThemeId {
  const content = `${title || ''} ${message || ''}`.toLowerCase();

  if (content.match(/\b(birthday|bday|cake|hbd|celebrate age|turns \d+)\b/)) {
    return 'birthday';
  }
  if (content.match(/\b(new year|2026|happy new year|nye|newyear|midnight)\b/)) {
    return 'new_year';
  }
  if (content.match(/\b(diwali|deepavali|deepawali|diya|diyas|patakha|laxmi|lakshmi)\b/)) {
    return 'diwali';
  }
  if (content.match(/\b(holi|gulal|pichkari|rangoli|phagwah|happy holi)\b/)) {
    return 'holi';
  }
  if (content.match(/\b(ganesh|ganpati|chaturthi|modak|bappa|vinayak|vinayaka)\b/)) {
    return 'ganesh_chaturthi';
  }
  if (content.match(/\b(durga|navami|navratri|garba|dandiya|dussehra|vijayadashami|puja|pooja)\b/)) {
    return 'durga_navami';
  }

  return DEFAULT_THEME_ID;
}

/**
 * Resolves theme ID from URL query param `?t=` or `?theme=` with semantic fallback.
 */
export function resolveThemeId(search: string, lifafa?: Lifafa | null): LifafaThemeId {
  try {
    const params = new URLSearchParams(search);
    const fromParam = normalizeThemeId(params.get('t') || params.get('theme'));
    if (fromParam) return fromParam;
  } catch {
    // ignore search parsing errors
  }

  // Fallback to semantic matching on content if available
  if (lifafa) {
    return inferThemeFromContent(lifafa.title, lifafa.message);
  }

  return DEFAULT_THEME_ID;
}

/**
 * Generates the authoritative claim URL with theme preservation query parameter.
 */
export function buildClaimUrl(code: string, themeId: LifafaThemeId): string {
  const cleanCode = (code || '').toUpperCase().trim();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://createlifafa.in';
  return `${origin}/claim/${cleanCode}?t=${themeId}`;
}

/**
 * Ensures browser URL bar cleanly reflects `?t=${themeId}` without triggering reload.
 */
export function syncUrlThemeParam(themeId: LifafaThemeId) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('t') !== themeId) {
      url.searchParams.set('t', themeId);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    // ignore
  }
}

/**
 * React hook that reactively resolves the active theme and keeps URL in sync.
 */
export function useResolvedTheme(lifafa?: Lifafa | null): LifafaThemeId {
  const themeId = useMemo(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    return resolveThemeId(search, lifafa);
  }, [lifafa]);

  useEffect(() => {
    syncUrlThemeParam(themeId);
  }, [themeId]);

  return themeId;
}
