import React, { useState, useEffect } from 'react';
import { User, Phone, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ProfileOnboardingModal: React.FC = () => {
  const { user, needsProfileCompletion, updateProfileInfo } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (user.full_name && user.full_name !== 'Lifafa User') {
        setFullName(user.full_name);
      }
      if (user.phone_number) {
        setPhoneNumber(user.phone_number);
      }
    }
  }, [user]);

  if (!needsProfileCompletion || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim();
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name');
      return;
    }

    if (cleanPhone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    try {
      setLoading(true);
      await updateProfileInfo(cleanName, cleanPhone);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save profile information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 text-center overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-amber-300/40 via-red-400/30 to-pink-500/30 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-gradient-to-tr from-blue-400/30 via-cyan-400/20 to-indigo-500/30 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">
          {/* Festive Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <Sparkles className="w-8 h-8 text-amber-300" />
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            Complete Your Profile
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6 leading-relaxed">
            Welcome to <strong>Create Lifafa</strong>! Please provide your name and mobile number to enable instant withdrawals and rewards.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold text-left">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                  <Phone className="w-4 h-4 mr-1 text-slate-400" />
                  <span className="text-slate-500 mr-1">+91</span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-20 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-extrabold py-3.5 px-6 rounded-2xl text-sm shadow-lg shadow-blue-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Save &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Bank-grade encryption • Never shared with third parties</span>
          </div>
        </div>
      </div>
    </div>
  );
};
