import React, { createContext, useContext, useState, useEffect } from 'react';
import type { LifafaTheme, LifafaThemeId } from './types';
import { getTheme, DEFAULT_THEME_ID } from './registry';
import { useThemeFont } from './useThemeFont';

interface ThemeContextValue {
  themeId: LifafaThemeId;
  theme: LifafaTheme;
  setThemeId: (id: LifafaThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  themeId?: LifafaThemeId;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  themeId: initialThemeId = DEFAULT_THEME_ID,
  children,
}) => {
  const [currentThemeId, setCurrentThemeId] = useState<LifafaThemeId>(initialThemeId);

  useEffect(() => {
    if (initialThemeId && initialThemeId !== currentThemeId) {
      setCurrentThemeId(initialThemeId);
    }
  }, [initialThemeId]);

  const currentTheme = getTheme(currentThemeId);

  // Dynamically load only this theme's fonts and configure CSS custom properties
  useThemeFont(currentTheme.typography);

  return (
    <ThemeContext.Provider
      value={{
        themeId: currentThemeId,
        theme: currentTheme,
        setThemeId: setCurrentThemeId,
      }}
    >
      <div
        className="theme-container min-h-full w-full"
        style={{
          fontFamily: `"${currentTheme.typography.bodyFont}", ${currentTheme.typography.fallbackStack}`,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    const fallbackTheme = getTheme(DEFAULT_THEME_ID);
    return {
      themeId: DEFAULT_THEME_ID,
      theme: fallbackTheme,
      setThemeId: () => {},
    };
  }
  return context;
}
