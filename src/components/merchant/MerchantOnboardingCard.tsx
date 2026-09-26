import React, { useState } from 'react';
import { Building2, User, Phone, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MerchantOnboardingCardProps {
  onSuccess: () => void;
}

export const MerchantOnboardingCard: React.FC<MerchantOnboardingCardProps> = ({ onSuccess }) => {
  const { user, onboardMerchant } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [mobileNumber, setMobileNumber] = useState(user?.phone_number || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanBiz = businessName.trim();
    const cleanMobile = mobileNumber.replace(/\D/g, '');

    if (cleanBiz.length < 2) {
      setErrorMsg('Please enter a valid Business or Trade name');
      return;
    }

    if (cleanMobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    try {
      setLoading(true);
      await onboardMerchant(cleanBiz, cleanMobile);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to activate merchant account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="relative overflow-hidden rounded-3xl bg-white border border-blue-100 shadow-2xl p-6 sm:p-10">
        {/* Glow Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100/60 via-indigo-100/40 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-amber-100/50 via-emerald-100/30 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-black uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
              <span>Instant Merchant Onboarding</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-black uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>₹0 Setup Fee</span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
            Activate Your <span className="text-blue-600">Merchant Payout Gateway</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
            Disburse automated payouts directly to beneficiary bank accounts via PayRupee rails with isolated float accounts and developer APIs.
          </p>

          {/* Value Props Bar */}
          <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 mb-6 text-center">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Setup Fee</div>
              <div className="text-sm sm:text-base font-black text-emerald-600 mt-0.5">₹0 (Free)</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Activation</div>
              <div className="text-sm sm:text-base font-black text-blue-600 mt-0.5">Instant</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">KYC Docs</div>
              <div className="text-sm sm:text-base font-black text-purple-600 mt-0.5">Zero</div>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-semibold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Authorized Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business / Trade Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Acme Tech Innovations"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Registered Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                  <Phone className="w-4 h-4 mr-1 text-slate-400" />
                  <span className="text-slate-500 mr-1">+91</span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-20 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-extrabold py-3.5 px-8 rounded-2xl text-sm shadow-lg shadow-blue-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Activate Merchant Gateway</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Dedicated float wallet created instantly</span>
            </span>
            <span className="font-bold text-slate-500">Free forever</span>
          </div>
        </div>
      </div>
    </div>
  );
};
