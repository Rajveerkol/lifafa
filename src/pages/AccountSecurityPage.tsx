import React from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Globe,
  LogOut,
  Clock,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

interface AccountSecurityPageProps {
  onBack: () => void;
}

export const AccountSecurityPage: React.FC<AccountSecurityPageProps> = ({ onBack }) => {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <span>Account Security</span>
          </h2>
          <p className="text-xs text-slate-500">
            Authentication credentials, active sessions, and cryptographic guarantees
          </p>
        </div>
      </div>

      {/* Security Status Banner */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-5 sm:p-6 shadow-lg shadow-emerald-600/15">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/30 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-100 uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              <span>Protected Account</span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight">
              Enterprise OAuth Security Active
            </h3>
            <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
              Your account is authenticated via Google Identity Services with hardware-grade JWT encryption. Lifafa never stores your Google password or private financial keys.
            </p>
          </div>
        </div>
      </div>

      {/* Authentication Details */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-4">
        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span>Authentication Provider</span>
        </h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">Identity Provider</span>
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
                <span>Google OAuth 2.0 (OpenID Connect)</span>
              </span>
            </div>
            <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Connected
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">Authenticated Email</span>
              <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                {user?.email || 'N/A'}
              </span>
            </div>
            <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              Primary
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">User Identifier (Principal)</span>
              <span className="text-xs font-mono text-slate-600 mt-0.5 block truncate max-w-[200px] sm:max-w-xs">
                {user?.id || 'N/A'}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-400">UUID v4</span>
          </div>
        </div>
      </div>

      {/* Security Architecture & Guarantees */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-3">
        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Platform Protections</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100/60 space-y-1">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              Row Level Security (RLS)
            </span>
            <p className="text-[11px] text-blue-800/80 leading-relaxed">
              Every database query is constrained by strict PostgreSQL security policies. Only you and authorized platform RPCs can access your wallet ledger.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100/60 space-y-1">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              Atomic Double-Entry Ledger
            </span>
            <p className="text-[11px] text-indigo-800/80 leading-relaxed">
              Balances are derived from immutable, transactional journal entries with idempotency keys preventing any double credits or phantom debits.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-100/60 space-y-1">
            <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              Single-Use Nonce Verification
            </span>
            <p className="text-[11px] text-teal-800/80 leading-relaxed">
              Telegram task bindings use cryptographic, 10-minute expiring nonces generated server-side to ensure zero identity spoofing.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100/60 space-y-1">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Device Anti-Farming Shield
            </span>
            <p className="text-[11px] text-amber-800/80 leading-relaxed">
              Hardware fingerprinting and client rate limits protect giveaways from automated bot networks and farm scripts.
            </p>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/80 space-y-2.5">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Security Recommendations</span>
        </h4>
        <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4">
          <li>Ensure Two-Step Verification (2FA) is turned ON on your Google account.</li>
          <li>Never share your UPI PIN or banking passwords with anyone. Lifafa never asks for your UPI PIN.</li>
          <li>Always verify that the website URL is the official Lifafa domain before logging in.</li>
        </ul>
      </div>

      {/* Logout All Sessions */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 border border-red-500 text-red-600 font-bold py-3.5 rounded-2xl text-xs transition-colors shadow-2xs cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Current Session</span>
        </button>
      </div>
    </div>
  );
};
