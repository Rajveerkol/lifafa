import React from 'react';
import type { LifafaThemeId } from '../../themes/types';
import { ALL_THEMES } from '../../themes/registry';
import { Check, Sparkles } from 'lucide-react';

interface ThemeSelectorProps {
  selectedTheme: LifafaThemeId;
  onSelectTheme: (themeId: LifafaThemeId) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  selectedTheme,
  onSelectTheme,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            Lifafa Visual Theme & Occasion
          </label>
          <p className="text-[11px] text-slate-500">
            Each theme transforms the unsealing envelope, fonts, animations, PIN pads & claiming experience
          </p>
        </div>
        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          7 Designs Available
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {ALL_THEMES.map((theme) => {
          const isSelected = selectedTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className={`relative text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
              }`}
            >
              {/* Top Accent Gradient Bar */}
              <div
                className={`h-1.5 w-full rounded-full bg-gradient-to-r ${theme.previewGradient} mb-2`}
              />

              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="text-[11px] font-extrabold text-slate-800 line-clamp-1">
                    {theme.badge}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                  {theme.tagline}
                </p>
              </div>

              {/* Typography & Style Preview Tag */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                <span className="font-semibold truncate">
                  {theme.typography.headingFont}
                </span>
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: theme.colors.envelopePrimary }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
