import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured, signInWithGoogle, signOut } from '../lib/supabase';
import type { Profile, Wallet, AdminUser } from '../types/database';

interface AuthContextType {
  user: Profile | null;
  wallet: Wallet | null;
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  unreadNotificationsCount: number;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshNotificationsCount: () => Promise<void>;
  // Strict Dev Simulator toggle (ONLY active in development mode when Supabase credentials are not yet entered)
  isDevMode: boolean;
  activateDevDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo profile matching the screenshot "DemoAccount" for local offline preview
const DEV_DEMO_PROFILE: Profile = {
  id: 'dev-demo-user-001',
  full_name: 'Demo Account',
  email: 'demoaccount@gmail.com',
  avatar_url: null,
  phone_number: null,
  is_suspended: false,
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
};

const DEV_DEMO_WALLET: Wallet = {
  id: 'dev-demo-wallet-001',
  user_id: 'dev-demo-user-001',
  available_balance: 1500.00,
  reserved_balance: 500.00,
  total_earned: 2500.00,
  total_withdrawn: 500.00,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEV_DEMO_ADMIN: AdminUser = {
  user_id: 'dev-demo-user-001',
  role: 'SUPER_ADMIN',
  created_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(3);
  const [isDevDemoActive, setIsDevDemoActive] = useState(false);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // Development mode flag: strictly false in production build
  const isDevMode = Boolean(import.meta.env.DEV);

  const OWNER_EMAILS = ['kolrajveer33@gmail.com', 'jayakol796@gmail.com'];
  const isOwnerEmail = (email?: string | null) => {
    if (!email) return false;
    return OWNER_EMAILS.includes(email.toLowerCase().trim());
  };

  const fetchUserData = useCallback(async (userId: string, authEmail?: string) => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // 1. Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setUser(profileData as Profile);
      }

      const effectiveEmail = profileData?.email || authEmail || sessionEmail;

      // 2. Fetch wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (walletData) {
        setWallet(walletData as Wallet);
      }

      // 3. Fetch admin status
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (adminData) {
        setAdminUser(adminData as AdminUser);
      } else if (isOwnerEmail(effectiveEmail)) {
        setAdminUser({
          user_id: userId,
          role: 'SUPER_ADMIN',
          created_at: new Date().toISOString(),
        });
      } else {
        setAdminUser(null);
      }

      // 4. Fetch unread notifications count
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      setUnreadCount(count ?? 0);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    if (isDevDemoActive && isDevMode) {
      return;
    }
    if (user && isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) setWallet(data as Wallet);
    }
  }, [user, isDevDemoActive, isDevMode]);

  const refreshProfile = useCallback(async () => {
    if (user && isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setUser(data as Profile);
    }
  }, [user]);

  const refreshNotificationsCount = useCallback(async () => {
    if (user && isSupabaseConfigured && supabase) {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count ?? 0);
    }
  }, [user]);

  useEffect(() => {
    // In dev mode, check if demo is preferred
    if (isDevMode && localStorage.getItem('lifafa_dev_demo') === 'active') {
      setUser(DEV_DEMO_PROFILE);
      setWallet(DEV_DEMO_WALLET);
      setAdminUser(DEV_DEMO_ADMIN);
      setIsDevDemoActive(true);
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // Supabase auth subscription
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || null;
        setSessionEmail(email);
        if (isOwnerEmail(email)) {
          setAdminUser({
            user_id: session.user.id,
            role: 'SUPER_ADMIN',
            created_at: new Date().toISOString(),
          });
        }
        fetchUserData(session.user.id, email || undefined).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email || null;
        setSessionEmail(email);
        if (isOwnerEmail(email)) {
          setAdminUser({
            user_id: session.user.id,
            role: 'SUPER_ADMIN',
            created_at: new Date().toISOString(),
          });
        }
        fetchUserData(session.user.id, email || undefined);
      } else {
        setUser(null);
        setWallet(null);
        setAdminUser(null);
        setSessionEmail(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData, isDevMode]);

  const handleLoginWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      if (isDevMode) {
        // Dev fallback
        activateDevDemo();
        return;
      }
      throw new Error('Supabase is not configured.');
    }
    await signInWithGoogle();
  };

  const handleLogout = async () => {
    if (isDevDemoActive) {
      localStorage.removeItem('lifafa_dev_demo');
      setIsDevDemoActive(false);
      setUser(null);
      setWallet(null);
      setAdminUser(null);
      return;
    }
    await signOut();
    setUser(null);
    setWallet(null);
    setAdminUser(null);
  };

  const activateDevDemo = () => {
    if (!isDevMode) return;
    localStorage.setItem('lifafa_dev_demo', 'active');
    setUser(DEV_DEMO_PROFILE);
    setWallet(DEV_DEMO_WALLET);
    setAdminUser(DEV_DEMO_ADMIN);
    setIsDevDemoActive(true);
  };

  const isUserAdmin = Boolean(
    (adminUser && ['SUPER_ADMIN', 'ADMIN'].includes(adminUser.role)) ||
    isOwnerEmail(user?.email) ||
    isOwnerEmail(sessionEmail) ||
    (isDevDemoActive && DEV_DEMO_ADMIN.role === 'SUPER_ADMIN')
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        adminUser,
        isAdmin: isUserAdmin,
        isLoading,
        isSupabaseConnected: isSupabaseConfigured,
        unreadNotificationsCount: unreadCount,
        loginWithGoogle: handleLoginWithGoogle,
        logout: handleLogout,
        refreshWallet,
        refreshProfile,
        refreshNotificationsCount,
        isDevMode,
        activateDevDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
