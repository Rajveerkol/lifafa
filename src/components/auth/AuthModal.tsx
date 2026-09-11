import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { Logo } from '../common/Logo';
import { TrustBadges } from '../common/TrustBadges';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'signin' }) => {
  const { loginWithGoogle, isDevMode, activateDevDemo } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDevDemoLogin = () => {
    activateDevDemo();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Subtle Brand Accent Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-6 pb-6">
          {/* Centered Brand Logo */}
          <div className="flex justify-center mb-4">
            <Logo size="md" showTagline />
          </div>

          {/* Interactive Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'signin'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Mode Header */}
          <div className="text-center mb-5">
            {mode === 'signin' ? (
              <>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  Welcome <span className="text-blue-600">Back!</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Sign in to access your digital Lifafas, earnings &amp; wallet balance.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  Create Your <span className="text-blue-600">Account</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Join thousands sending &amp; claiming digital Lifafas instantly.
                </p>

                {/* Sign Up Benefits Pill */}
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-800 rounded-full text-[11px] font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Instant Welcome Lifafas • Fast Bank Withdrawals</span>
                </div>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Action: Google Authentication */}
          <div className="space-y-3 mb-5">
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow active:scale-98 transition-all text-sm cursor-pointer"
            >
              {/* Google G SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
              <span>
                {loading
                  ? 'Connecting with Google...'
                  : mode === 'signin'
                  ? 'Sign in with Google'
                  : 'Sign up with Google'}
              </span>
            </button>

            {/* Development Mode Quick Demo Trigger */}
            {isDevMode && (
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

          {/* Toggle between Sign In and Sign Up */}
          <div className="text-center text-xs text-slate-500 mb-4">
            {mode === 'signin' ? (
              <p>
                New to CreatLifafa?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                  }}
                  className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          {mode === 'signup' && (
            <p className="text-[10px] text-center text-slate-400 mb-4 leading-relaxed">
              By creating an account, you agree to our Terms of Service &amp; Privacy Policy.
            </p>
          )}

          {/* Trust Badges */}
          <TrustBadges className="mb-3" />

          <p className="text-[10px] text-center text-slate-400">
            © 2026 Creatlifafa.com. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
