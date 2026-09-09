import React from 'react';
import { Home, Gift, Bot, Wallet, User } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  // Fixed navigation structure strictly following rules:
  // "There must NOT be a Games section. 'Lifafa' replaces Games completely."
  const items = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'lifafa', label: 'Lifafa', icon: Gift },
    { id: 'bots', label: 'Bots', icon: Bot, isSoon: true },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-2 py-1.5 shadow-lg shadow-slate-900/5">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
                isActive ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'stroke-[2.5px]' : 'stroke-2'
                  }`}
                />
                {item.isSoon && (
                  <span className="absolute -top-1.5 -right-3.5 bg-amber-500 text-white text-[8px] font-black px-1 py-0.2 rounded-full uppercase scale-85">
                    SOON
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight ${
                  isActive ? 'font-bold text-blue-600' : 'font-medium text-slate-500'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
