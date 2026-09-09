import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Wallet,
  Gift,
  Users,
  FileText,
  Lock,
  Headphones,
  FileCheck,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Edit3,
  Check,
  Sparkles,
  Crown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../lib/utils';

interface ProfilePageProps {
  onNavigate: (tab: string, extra?: any) => void;
  onOpenAuth: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate, onOpenAuth }) => {
  const { user, wallet, logout } = useAuth();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState(user?.phone_number || '+91 9876543210');
  const [activeModal, setActiveModal] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
          <User className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">Account Required</h3>
        <p className="text-xs text-slate-500 mb-6">
          Sign in with Google to view your profile, wallet ledger, and reward history.
        </p>
        <button
          onClick={onOpenAuth}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl text-xs shadow-md shadow-blue-500/25"
        >
          Login with Google
        </button>
      </div>
    );
  }

  const displayName = user.full_name || 'DemoAccount';

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24 md:pb-12">
      {/* 1. Profile Hero Gradient Banner matching media_1788926051778.png */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 sm:p-6 text-white shadow-xl shadow-blue-600/15">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {/* Avatar Circle */}
            <div className="relative">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={displayName}
                  className="w-14 h-14 rounded-full border-2 border-white shadow-md object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center font-black text-xl text-white shadow-inner">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight">{displayName}</h3>
              <p className="text-xs text-blue-100 flex items-center gap-1">
                <span>Welcome back!</span>
                <span>👋</span>
              </p>

              {/* Trusted Member Crown Badge */}
              <div className="mt-1.5 inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-bold text-amber-300">
                <span>👑</span>
                <span>Trusted Member</span>
              </div>
            </div>
          </div>

          {/* Edit Profile Pill Button */}
          <button
            onClick={() => setActiveModal('edit-profile')}
            className="flex items-center gap-1.5 bg-white text-blue-700 font-bold px-3.5 py-2 rounded-2xl text-xs shadow-sm hover:bg-slate-50 active:scale-95 transition-all shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* 2. User Info Card matching media_1788926051778.png */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-2xs divide-y divide-slate-100">
        <div className="flex items-center justify-between py-2.5 first:pt-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700">Full Name</span>
          </div>
          <span className="text-xs font-bold text-slate-900">{displayName}</span>
        </div>

        <div className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700">Email Address</span>
          </div>
          <span className="text-xs font-medium text-slate-800">{user.email}</span>
        </div>

        <div className="flex items-center justify-between py-2.5 last:pb-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700">Mobile Number</span>
          </div>
          <span className="text-xs font-medium text-slate-800 font-mono">{phone}</span>
        </div>
      </div>

      {/* 3. My Account 4-Grid matching media_1788926051778.png */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <User className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            My Account
          </h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div
            onClick={() => onNavigate('wallet')}
            className="bg-white rounded-3xl p-3.5 border border-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer text-center flex flex-col items-center"
          >
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-1.5">
              <Wallet className="w-5 h-5" />
            </div>
            <h5 className="text-xs font-bold text-slate-900">My Wallet</h5>
            <p className="text-[10px] text-slate-400">Check balance</p>
          </div>

          <div
            onClick={() => onNavigate('lifafa', { tab: 'claimed' })}
            className="bg-white rounded-3xl p-3.5 border border-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer text-center flex flex-col items-center"
          >
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5">
              <Gift className="w-5 h-5" />
            </div>
            <h5 className="text-xs font-bold text-slate-900">My Rewards</h5>
            <p className="text-[10px] text-slate-400">View rewards</p>
          </div>

          <div
            onClick={() => setActiveModal('referral')}
            className="bg-white rounded-3xl p-3.5 border border-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer text-center flex flex-col items-center"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
              <Users className="w-5 h-5" />
            </div>
            <h5 className="text-xs font-bold text-slate-900">Referral</h5>
            <p className="text-[10px] text-slate-400">Invite & earn</p>
          </div>

          <div
            onClick={() => onNavigate('wallet')}
            className="bg-white rounded-3xl p-3.5 border border-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer text-center flex flex-col items-center"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5">
              <FileText className="w-5 h-5" />
            </div>
            <h5 className="text-xs font-bold text-slate-900">Transaction History</h5>
            <p className="text-[10px] text-slate-400">View all</p>
          </div>
        </div>
      </div>

      {/* 4. Account & Support List matching media_1788926051778.png */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Account & Support
          </h4>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          <div
            onClick={() => setActiveModal('security')}
            className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">Account Security</h5>
                <p className="text-[10px] text-slate-400">Google OAuth & Session protection</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          <div
            onClick={() => setActiveModal('support')}
            className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">Help & Support</h5>
                <p className="text-[10px] text-slate-400">Get help and contact support</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          <div
            onClick={() => setActiveModal('terms')}
            className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">Terms & Conditions</h5>
                <p className="text-[10px] text-slate-400">Read our platform terms</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          <div
            onClick={() => setActiveModal('privacy')}
            className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">Privacy Policy</h5>
                <p className="text-[10px] text-slate-400">Read our privacy commitments</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* 5. Logout Button matching media_1788926051778.png */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 border border-red-500 text-red-600 font-bold py-3.5 rounded-2xl text-xs transition-colors shadow-2xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>

      {/* Support & Legal Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-left">
            <h4 className="text-base font-bold text-slate-900 mb-2 capitalize">
              {activeModal.replace('-', ' ')}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {activeModal === 'support'
                ? 'For support, bug reports, or partnership inquiries, reach out to our official support Telegram @CreatLifafaSupport.'
                : activeModal === 'referral'
                ? `Share your referral link with friends: ${window.location.origin}/?ref=${user.id.substring(0, 8)}`
                : 'All transactions on Lifafa are protected by 256-bit encryption, strict Row Level Security, and PostgreSQL transactional guarantees.'}
            </p>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
