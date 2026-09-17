import { useEffect } from 'react';
import type { ThemeTypographyConfig } from './types';

const LINK_ELEMENT_ID = 'lifafa-theme-dynamic-font';

/**
 * On-demand single-theme font injector hook.
 * Avoids loading 20+ fonts upfront by fetching only the Google Font link
 * needed for the currently active theme with `display=swap`.
 */
export function useThemeFont(typography: ThemeTypographyConfig | undefined) {
  useEffect(() => {
    if (!typography || !typography.googleFontsHref) return;

    let linkEl = document.getElementById(LINK_ELEMENT_ID) as HTMLLinkElement | null;

    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.id = LINK_ELEMENT_ID;
      linkEl.rel = 'stylesheet';
      document.head.appendChild(linkEl);
    }

    if (linkEl.href !== typography.googleFontsHref) {
      linkEl.href = typography.googleFontsHref;
    }

    // Set theme CSS custom properties for instant styling with reliable fallbacks
    const root = document.documentElement;
    root.style.setProperty('--font-theme-heading', `"${typography.headingFont}", ${typography.fallbackStack}`);
    root.style.setProperty('--font-theme-numeral', `"${typography.numeralFont}", ${typography.fallbackStack}`);
    root.style.setProperty('--font-theme-body', `"${typography.bodyFont}", ${typography.fallbackStack}`);
  }, [typography]);
}
