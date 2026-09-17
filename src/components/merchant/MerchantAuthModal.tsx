import React, { useState } from 'react';
import { X, Building2, Lock, Phone, User, AlertCircle, ArrowRight, ShieldCheck, Sparkles, Copy, Check, Key, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { merchantGatewayService } from '../../services/merchantGatewayService';

interface MerchantAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MerchantAuthModal: React.FC<MerchantAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [onboardingKey, setOnboardingKey] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase is not configured in this environment');
      return;
    }

    const syntheticEmail = `${cleanMobile}@merchant.lifafa.internal`;

    try {
      setLoading(true);

      if (mode === 'signup') {
        if (!fullName.trim()) {
          setErrorMsg('Full name is required');
          setLoading(false);
          return;
        }

        if (!businessName.trim()) {
          setErrorMsg('Business / Trade name is required');
          setLoading(false);
          return;
        }

        // 1. Sign up user in Supabase Auth with synthetic internal email and MERCHANT metadata
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: syntheticEmail,
          password: password,
          options: {
            data: {
              account_type: 'MERCHANT',
              full_name: fullName.trim(),
              business_name: businessName.trim(),
              mobile_number: cleanMobile,
            },
          },
        });

        if (authErr) throw authErr;

        const userId = authData.user?.id;
        if (!userId) throw new Error('Failed to create merchant authentication record');

        // Under projects where Supabase email confirmation is enabled, signUp() returns session: null.
        // The BEFORE INSERT trigger on auth.users automatically sets email_confirmed_at = NOW() for MERCHANTs.
        // If session is null, immediately establish the authenticated session via signInWithPassword:
        if (!authData.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: syntheticEmail,
            password: password,
          });
          if (signInErr) {
            console.error('Session establishment notice:', signInErr);
          }
        }

        // The PostgreSQL trigger handle_new_merchant() automatically and atomically creates
        // the public.merchants and public.merchant_wallets records with status ACTIVE.
        // Now call the dedicated authenticated server-side API key generation RPC:
        const merchant = await merchantGatewayService.getMerchantProfile(userId);
        if (merchant) {
          try {
            const keyPair = await merchantGatewayService.generateApiKey({
              merchantId: merchant.id,
              keyName: 'Default API Key',
            });
            setOnboardingKey(keyPair);
            return; // Display initial credential screen to merchant
          } catch (keyErr) {
            console.error('Initial API key generation error:', keyErr);
          }
        }

        onSuccess();
        onClose();
      } else {
        // Sign in with Mobile + Password (via synthetic email)
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: password,
        });

        if (signInErr) {
          throw new Error('Invalid mobile number or password');
        }

        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Merchant auth error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Top Accent Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />

        {/* Close Button */}
        <button
          onClick={() => {
            if (onboardingKey) {
              onSuccess();
            }
            onClose();
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {onboardingKey ? (
          <div className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Account Activated</h3>
                <p className="text-xs text-slate-500 mt-0.5">Initial API credentials provisioned</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Save your Client Secret now.</strong>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Only the SHA-256 hash is stored in the database. This plaintext secret will <strong>NEVER</strong> be displayed again.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Client ID (Public)
                </label>
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800">
                  <span className="truncate mr-2">{onboardingKey.clientId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(onboardingKey.clientId);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="p-1 text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
                  >
                    {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Client Secret (Private)
                </label>
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800">
                  <span className="truncate mr-2">{onboardingKey.clientSecret}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(onboardingKey.clientSecret);
                      setCopiedSecret(true);
                      setTimeout(() => setCopiedSecret(false), 2000);
                    }}
                    className="p-1 text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md shadow-blue-500/25 active:scale-98 transition-all cursor-pointer"
            >
              <span>I Have Saved My Secret — Enter Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
          {/* Header Icon & Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">Merchant Gateway</h3>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  B2B
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === 'signin'
                  ? 'Sign in with your registered mobile'
                  : 'Register your business in 30 seconds (No KYC)'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'signin' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
                mode === 'signup' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register Merchant
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Business / Trade Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Shree Logistics or Ramesh Enterprises"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Enter secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center gap-2 text-[11px] text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instant Account Activation: No OTP or document upload required.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-md shadow-blue-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Processing...' : mode === 'signin' ? 'Sign In to Gateway' : 'Create Merchant Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
        )}
      </div>
    </div>
  );
};
