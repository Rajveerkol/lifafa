import React, { useState } from 'react';
import { Building2, User, Phone, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MerchantOnboardingCardProps {
  onSuccess: () => void;
  onNavigateHome?: () => void;
}

export const MerchantOnboardingCard: React.FC<MerchantOnboardingCardProps> = ({
  onSuccess,
  onNavigateHome,
}) => {
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
      setErrorMsg('Please enter a valid Business or Trade name (at least 2 characters)');
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
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-[11px] font-semibold">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Merchant Gateway Activation</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[11px] font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Free Activation</span>
            </span>
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Register Your Merchant Account
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Automate instant disbursements directly to beneficiary UPI accounts with an isolated float account and developer APIs.
          </p>
        </div>

        {/* Feature summary */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-center">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase block">Setup Fee</span>
            <span className="text-xs font-bold text-emerald-700 mt-0.5 block">₹0 Free</span>
          </div>
          <div className="border-x border-slate-200">
            <span className="text-[10px] font-semibold text-slate-400 uppercase block">Clearing Rail</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5 block">Instant UPI</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase block">Float Model</span>
            <span className="text-xs font-bold text-slate-900 mt-0.5 block">Pre-Funded</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Activation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Authorized Representative Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Legal Name"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Business / Trade / Brand Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Tech Solutions"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              This name will appear on the merchant portal and payout records.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registered Indian Mobile Number *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                required
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              By activating, you agree to comply with Indian payment settlement guidelines. Float deposits require administrative verification before crediting.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="w-1/3 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Activating Merchant...' : 'Activate Merchant Gateway'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
