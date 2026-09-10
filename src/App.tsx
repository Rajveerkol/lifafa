import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { HomePage } from './pages/HomePage';
import { LifafaDashboardPage } from './pages/LifafaDashboardPage';
import { CreateLifafaPage } from './pages/CreateLifafaPage';
import { WalletPage } from './pages/WalletPage';
import { BotsPage } from './pages/BotsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { AccountSecurityPage } from './pages/AccountSecurityPage';
import { HelpSupportPage } from './pages/HelpSupportPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';

import { AuthModal } from './components/auth/AuthModal';
import { WithdrawModal } from './components/wallet/WithdrawModal';
import { AddMoneyModal } from './components/wallet/AddMoneyModal';
import { ClaimModal } from './components/lifafa/ClaimModal';
import { ShareModal } from './components/lifafa/ShareModal';
import { NotificationDrawer } from './components/common/NotificationDrawer';

import { useAuth } from './context/AuthContext';
import { lifafaService } from './services/lifafaService';
import type { Lifafa } from './types/database';

export function App() {
  const { user } = useAuth();

  const getInitialTab = () => {
    const raw = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (
      [
        'home',
        'lifafa',
        'bots',
        'wallet',
        'profile',
        'admin',
        'account-security',
        'help-support',
        'terms',
        'privacy',
      ].includes(raw)
    ) {
      return raw;
    }
    return 'home';
  };

  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);
  const [isCreatingLifafa, setIsCreatingLifafa] = useState(false);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [addMoneyModalOpen, setAddMoneyModalOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  // Lifafa Modals
  const [selectedClaimLifafa, setSelectedClaimLifafa] = useState<Lifafa | null>(null);
  const [selectedShareLifafa, setSelectedShareLifafa] = useState<Lifafa | null>(null);

  const clearClaimQueryParam = () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('claim')) {
        url.searchParams.delete('claim');
        const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {}
  };

  // Sync URL history on browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setSelectedClaimLifafa(null);
      setSelectedShareLifafa(null);
      clearClaimQueryParam();
      const raw = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (
        [
          'home',
          'lifafa',
          'bots',
          'wallet',
          'profile',
          'admin',
          'account-security',
          'help-support',
          'terms',
          'privacy',
        ].includes(raw)
      ) {
        setCurrentTab(raw);
      } else {
        setCurrentTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check URL query parameters for claim code (e.g. ?claim=LF-8X92K)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const claimCode = params.get('claim');
    if (claimCode) {
      // Immediately sanitize URL bar so returning from Telegram, window focus,
      // or tab navigation never traps or re-triggers the claim modal.
      clearClaimQueryParam();
      lifafaService.getLifafaByCode(claimCode).then((found) => {
        if (found) {
          setSelectedClaimLifafa(found);
        }
      });
    }
  }, []);

  const handleTabChange = (tab: string, extra?: any) => {
    // Dismiss claim/share modal and clear claim query param so navigation is never trapped
    setSelectedClaimLifafa(null);
    setSelectedShareLifafa(null);
    clearClaimQueryParam();

    if (tab === 'lifafa' && extra?.action === 'create') {
      setIsCreatingLifafa(true);
      setCurrentTab('lifafa');
      window.history.pushState({}, '', '/lifafa');
      return;
    }
    setIsCreatingLifafa(false);
    setCurrentTab(tab);
    window.history.pushState({}, '', tab === 'home' ? '/' : `/${tab}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseClaimModal = () => {
    setSelectedClaimLifafa(null);
    clearClaimQueryParam();
  };

  const handleClaimLifafa = (lifafa: Lifafa) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setSelectedClaimLifafa(lifafa);
  };

  const handleShareLifafa = (lifafa: Lifafa) => {
    setSelectedShareLifafa(lifafa);
  };

  const handleCreatedLifafaSuccess = (result: any) => {
    setIsCreatingLifafa(false);
    setCurrentTab('lifafa');
    // Open share screen for the newly created Lifafa
    lifafaService.getLifafaByCode(result.code).then((found) => {
      if (found) {
        setSelectedShareLifafa(found);
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f8faff] text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        onOpenNotifications={() => setNotificationDrawerOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        {currentTab === 'home' && (
          <HomePage
            onNavigate={handleTabChange}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenWithdraw={() => setWithdrawModalOpen(true)}
            onOpenAddMoney={() => setAddMoneyModalOpen(true)}
            onClaimLifafa={handleClaimLifafa}
            onShareLifafa={handleShareLifafa}
          />
        )}

        {currentTab === 'lifafa' &&
          (isCreatingLifafa ? (
            <CreateLifafaPage
              onSuccessCreated={handleCreatedLifafaSuccess}
              onCancel={() => setIsCreatingLifafa(false)}
            />
          ) : (
            <LifafaDashboardPage
              onCreateClick={() => setIsCreatingLifafa(true)}
              onClaimClick={handleClaimLifafa}
              onShareClick={handleShareLifafa}
            />
          ))}

        {currentTab === 'bots' && <BotsPage onOpenAuth={() => setAuthModalOpen(true)} />}

        {currentTab === 'wallet' && (
          <WalletPage
            onOpenWithdraw={() => setWithdrawModalOpen(true)}
            onOpenAddMoney={() => setAddMoneyModalOpen(true)}
          />
        )}

        {currentTab === 'profile' && (
          <ProfilePage
            onNavigate={handleTabChange}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {currentTab === 'admin' && <AdminPage />}

        {currentTab === 'account-security' && (
          <AccountSecurityPage onBack={() => handleTabChange('profile')} />
        )}

        {currentTab === 'help-support' && (
          <HelpSupportPage
            onBack={() => handleTabChange('profile')}
            onNavigate={handleTabChange}
          />
        )}

        {currentTab === 'terms' && (
          <TermsPage onBack={() => handleTabChange('profile')} />
        )}

        {currentTab === 'privacy' && (
          <PrivacyPage onBack={() => handleTabChange('profile')} />
        )}
      </main>

      {/* Mobile Bottom Navigation (Home, Lifafa, Bots, Wallet, Profile) */}
      <BottomNav currentTab={currentTab} onSelectTab={handleTabChange} />

      {/* Modals & Drawers */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <WithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
      />

      <AddMoneyModal
        isOpen={addMoneyModalOpen}
        onClose={() => setAddMoneyModalOpen(false)}
        onGoToAdmin={() => handleTabChange('admin')}
        onGoToExplore={() => handleTabChange('lifafa')}
      />

      <ClaimModal
        lifafa={selectedClaimLifafa}
        isOpen={Boolean(selectedClaimLifafa)}
        onClose={handleCloseClaimModal}
        onOpenShare={handleShareLifafa}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <ShareModal
        lifafa={selectedShareLifafa}
        isOpen={Boolean(selectedShareLifafa)}
        onClose={() => setSelectedShareLifafa(null)}
      />

      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
    </div>
  );
}

export default App;
