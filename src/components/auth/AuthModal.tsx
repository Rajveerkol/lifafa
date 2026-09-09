import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Logo } from '../common/Logo';
import { TrustBadges } from '../common/TrustBadges';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, isSupabaseConnected, isDevMode, activateDevDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDevDemoLogin = () => {
    activateDevDemo();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Top curved gradient decorative header */}
        <div className="h-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 relative flex items-center justify-end px-4">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4 pb-6">
          {/* Centered Logo */}
          <div className="flex justify-center -mt-10 mb-4">
            <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-100">
              <Logo size="md" showTagline />
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900">
              Welcome <span className="text-blue-600">Back!</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Join Lifafa and start your digital gifting & reward journey
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Action: Google Authentication */}
          <div className="space-y-3 mb-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow active:scale-98 transition-all text-sm"
            >
              {/* Google G SVG */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            {/* Development Mode Quick Demo Trigger (ONLY visible in local dev when Supabase is not connected) */}
            {isDevMode && !isSupabaseConnected && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                <p className="text-[11px] text-amber-800 font-medium mb-2">
                  Development Mode: Supabase credentials not yet configured in .env.
                </p>
                <button
                  onClick={handleDevDemoLogin}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-xl shadow-xs"
                >
                  Load Demo Account (Screenshot Preview)
                </button>
              </div>
            )}
          </div>

          {/* Trust Badges matching screenshot */}
          <TrustBadges className="mb-4" />

          <p className="text-[10px] text-center text-slate-400">
            © 2026 Creatlifafa.com. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
