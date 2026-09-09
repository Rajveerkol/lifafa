import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showTagline = false,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    hero: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    hero: 'text-4xl md:text-5xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Visual Envelope + Gift Icon Badge inspired by reference logo */}
      <div className={`relative flex items-center justify-center shrink-0 ${iconDimensions[size]}`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 via-blue-500 to-indigo-500 rounded-2xl shadow-md shadow-blue-500/30 rotate-[-3deg]"></div>
        
        {/* Stylized Gift Envelope SVG */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative w-4/5 h-4/5 text-white drop-shadow"
        >
          {/* Envelope Body */}
          <path
            d="M6 16C6 13.7909 7.79086 12 10 12H38C40.2091 12 42 13.7909 42 16V34C42 36.2091 40.2091 38 38 38H10C7.79086 38 6 36.2091 6 34V16Z"
            fill="url(#env-grad)"
          />
          {/* Flap */}
          <path
            d="M6 16L24 28L42 16"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Emerging Gift Box */}
          <rect x="16" y="8" width="16" height="14" rx="2" fill="#ffffff" />
          <rect x="22" y="8" width="4" height="14" fill="#3b82f6" />
          <rect x="16" y="14" width="16" height="3" fill="#3b82f6" />
          {/* Ribbon Bow */}
          <path
            d="M20 7C20 5.5 21.5 4 23 5.5C24 6.5 24 7 24 7C24 7 24 6.5 25 5.5C26.5 4 28 5.5 28 7C28 8.5 25.5 8.5 24 8.5C22.5 8.5 20 8.5 20 7Z"
            fill="#60a5fa"
          />
          {/* Rupee Coin in corner */}
          <circle cx="36" cy="32" r="7" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
          <text
            x="36"
            y="35"
            fontSize="8"
            fontWeight="bold"
            fill="#78350f"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            ₹
          </text>
          <defs>
            <linearGradient id="env-grad" x1="6" y1="12" x2="42" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1e40af" />
              <stop offset="1" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Small Golden Crown on Logo */}
        <div className="absolute -top-1.5 -left-1 text-amber-400 text-xs drop-shadow">
          👑
        </div>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col">
        <div className="flex items-center tracking-tight">
          <span className={`font-black text-slate-900 drop-shadow-sm ${textSizes[size]}`}>
            Creat
          </span>
          <span className={`font-black text-blue-600 drop-shadow-sm ${textSizes[size]}`}>
            lifafa
          </span>
          <span className="ml-1 bg-red-600 text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-md tracking-normal shadow-sm">
            .com
          </span>
        </div>

        {showTagline && (
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-extrabold text-slate-500 mt-0.5">
            <span>CREATE</span>
            <span className="text-red-500">•</span>
            <span className="text-red-600">SHARE</span>
            <span className="text-red-500">•</span>
            <span>CELEBRATE</span>
          </div>
        )}
      </div>
    </div>
  );
};
