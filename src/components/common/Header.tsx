import React, { useState } from 'react';
import { Menu, Bell, Shield, X, LogIn, LogOut, User, Gift, Wallet, Bot, Home, Gamepad2 } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/utils';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenNotifications,
  onOpenAuth,
}) => {
  const { user, wallet, isAdmin, unreadNotificationsCount, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'lifafa', label: 'Lifafa', icon: Gift },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'bots', label: 'Bots', icon: Bot, badge: 'Soon' },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: Shield, badge: 'PRO' });
  }

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 sm:py-3 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Mobile Drawer Trigger / Desktop Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <button
              onClick={() => onSelectTab('home')}
              className="text-left focus:outline-hidden"
            >
              <Logo size="md" />
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-red-500 text-white font-black px-1.5 py-0.2 rounded-full uppercase">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Wallet Balance Pill & Notification Bell */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <button
                  onClick={() => onSelectTab('wallet')}
                  className="hidden sm:flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60 px-3 py-1.5 rounded-full text-xs font-bold text-blue-700 transition-colors"
                >
                  <Wallet className="w-3.5 h-3.5 text-blue-600" />
                  <span>{formatCurrency(wallet?.available_balance ?? 0)}</span>
                </button>

                {/* Notification Bell matching screenshot */}
                <button
                  onClick={onOpenNotifications}
                  className="relative p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                  aria-label="View notifications"
                >
                  <Bell className="w-6 h-6 text-slate-700" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-sm ring-2 ring-white">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-md shadow-blue-500/25 active:scale-95 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-xs flex">
          <div className="w-4/5 max-w-xs bg-white h-full p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <Logo size="sm" />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {user && (
                <div className="bg-blue-50/60 rounded-2xl p-3 mb-4 border border-blue-100/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {user.full_name?.charAt(0) || 'U'}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-slate-900 truncate">{user.full_name || 'User'}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Available Balance:</span>
                    <span className="font-bold text-blue-700">{formatCurrency(wallet?.available_balance ?? 0)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold uppercase ${
                          isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {user ? (
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 py-3 rounded-xl font-semibold text-sm hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm shadow-md shadow-blue-500/25"
              >
                <LogIn className="w-4 h-4" />
                <span>Login with Google</span>
              </button>
            )}
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </>
  );
};
