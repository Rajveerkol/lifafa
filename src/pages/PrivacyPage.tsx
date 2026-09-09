import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, EyeOff, Server, UserCheck } from 'lucide-react';

interface PrivacyPageProps {
  onBack: () => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 md:pb-12">
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
            <span>Privacy Policy</span>
          </h2>
          <p className="text-xs text-slate-500">
            How we protect your data, OAuth scopes, and ledger privacy
          </p>
        </div>
      </div>

      {/* Privacy Guarantee Banner */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-3xl p-5 text-xs text-emerald-950 leading-relaxed flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">Our Privacy Commitment</span>
          <span>
            Lifafa respects your personal data. We never sell, monetize, or broker your personal information. All wallet transactions and user records are stored securely with PostgreSQL Row Level Security.
          </span>
        </div>
      </div>

      {/* Privacy Policy Content */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-2xs space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            1. Information We Collect
          </h3>
          <p>
            When you interact with the Lifafa application, we collect only the minimal data necessary to provide and secure our services:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>
              <strong>Google Identity Information:</strong> Your primary email address, full name, and avatar image URL provided securely via Google OAuth 2.0.
            </li>
            <li>
              <strong>Wallet &amp; Transaction Ledger:</strong> Records of deposits, UTR numbers submitted for verification, Lifafa creation entries, claim distributions, and withdrawal requests.
            </li>
            <li>
              <strong>Telegram Verification Data:</strong> When connecting your Telegram account to verify channel memberships, we store your numeric Telegram User ID and username via our official bot (@createlifafa_bot).
            </li>
            <li>
              <strong>Technical Telemetry:</strong> Device identifiers and IP hashes used exclusively for anti-farming protection and sybil attack mitigation.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            2. How Information is Used
          </h3>
          <p>We utilize the collected data strictly for:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Authenticating your account and preserving session integrity.</li>
            <li>Processing financial transactions and maintaining an auditable double-entry wallet ledger.</li>
            <li>Verifying channel membership tasks server-side via the Telegram Bot API.</li>
            <li>Preventing multi-account fraud, device spoofing, and bot abuse.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            3. Data Storage &amp; Security Architecture
          </h3>
          <p>
            All persistent data is hosted in high-security cloud database infrastructure protected by Row Level Security (RLS). Database access is strictly partitioned so that non-administrative users can only access their own user records and ledger entries. Sensitive operations (such as balance adjustments, deposit approvals, and claim disbursements) execute through transactional stored procedures with cryptographic idempotency keys.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            4. Third-Party Integrations
          </h3>
          <p>
            We interface with third-party service providers solely to fulfill core platform functionality:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Google Identity Services:</strong> For zero-password single sign-on authentication.</li>
            <li><strong>Telegram Bot API:</strong> For channel membership validation.</li>
            <li><strong>Banking / UPI Networks:</strong> For payment routing and manual UTR verification.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            5. Your Rights &amp; Data Deletion
          </h3>
          <p>
            You have the right to review the personal data associated with your account or request data closure. To request account deletion or data clarification, you may contact platform administration through the platform.
          </p>
        </section>
      </div>
    </div>
  );
};
