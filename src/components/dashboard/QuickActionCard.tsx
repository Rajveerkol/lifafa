import React from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  iconBgColor: string;
  iconTextColor: string;
  hoverBgColor?: string;
  badge?: string;
  index?: number;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  iconBgColor,
  iconTextColor,
  badge,
  index = 0,
}) => {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        animationDelay: `${150 + index * 40}ms`,
      }}
      className="group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/40 rounded-3xl p-4 sm:p-5 border border-slate-100/80 hover:border-blue-200 shadow-2xs hover:shadow-xl hover:shadow-blue-500/8 transition-all duration-300 hover:-translate-y-1.5 active:scale-[0.97] cursor-pointer flex flex-col justify-between select-none animate-in fade-in slide-in-from-bottom-2"
    >
      {/* Subtle Ambient Hover Glow */}
      <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-blue-500/5 blur-xl group-hover:bg-blue-500/10 pointer-events-none transition-all duration-300" />

      {/* Top Row: Icon Container with 3D Depth + Action Arrow Indicator */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div
          className={`w-11 h-11 rounded-2xl ${iconBgColor} ${iconTextColor} flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md group-hover:scale-105 group-hover:-rotate-3 transition-all duration-300`}
        >
          <Icon className="w-5 h-5 transition-transform duration-300" />
        </div>

        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {badge}
            </span>
          )}
          <div className="w-7 h-7 rounded-full bg-slate-50 group-hover:bg-blue-600 flex items-center justify-center text-slate-400 group-hover:text-white transition-all duration-300 shadow-2xs">
            <ArrowRight className="w-3.5 h-3.5 translate-x-0 group-hover:translate-x-0.5 transition-transform duration-300" />
          </div>
        </div>
      </div>

      {/* Content Text */}
      <div className="min-w-0">
        <h4 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors duration-200 leading-snug truncate">
          {title}
        </h4>
        <p className="text-[11px] text-slate-400 group-hover:text-slate-500 transition-colors duration-200 mt-0.5 truncate">
          {subtitle}
        </p>
      </div>
    </div>
  );
};
