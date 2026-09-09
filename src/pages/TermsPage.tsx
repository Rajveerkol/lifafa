import React from 'react';
import { FileCheck, ArrowLeft, ShieldAlert, Scale, CheckCircle2 } from 'lucide-react';

interface TermsPageProps {
  onBack: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
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
            <FileCheck className="w-6 h-6 text-blue-600" />
            <span>Terms &amp; Conditions</span>
          </h2>
          <p className="text-xs text-slate-500">
            Platform usage agreements, digital giveaway rules, and financial policies
          </p>
        </div>
      </div>

      {/* Summary Alert */}
      <div className="bg-blue-50 border border-blue-200/80 rounded-3xl p-5 text-xs text-blue-900 leading-relaxed flex items-start gap-3">
        <Scale className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">Agreement Summary</span>
          <span>
            By using Lifafa, you agree to these Terms. Lifafa is a digital giveaway and community engagement reward platform. We do not facilitate gambling, speculative betting, or unregistered financial investments.
          </span>
        </div>
      </div>

      {/* Terms Body */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-2xs space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            1. Acceptance of Terms &amp; Eligibility
          </h3>
          <p>
            By accessing or using the Lifafa application, website, and related services, you confirm that you are at least 18 years of age (or have valid guardian consent) and are legally competent to enter into a binding contract in your jurisdiction.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            2. Platform Purpose &amp; Nature of Lifafas
          </h3>
          <p>
            Lifafa provides software mechanisms for creators and community organizers to distribute voluntary monetary rewards (Lifafas) to participants. Lifafas may be distributed either equally among designated recipients or via algorithmic randomized allotments. Lifafas are non-custodial community gifts and do not constitute dividends, interest, or securities.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            3. Wallet Deposits &amp; Verification
          </h3>
          <p>
            To create Lifafas, creators deposit funds using manual UPI transfer. Every deposit requires a genuine 12-digit Unique Transaction Reference (UTR) number issued by the banking network. Deposits are reviewed and authorized by platform administrators. Attempting to submit fraudulent, duplicate, or manipulated UTR numbers constitutes a breach of these Terms and will lead to immediate account suspension.
          </p>
          <p>
            Funds deposited into the platform wallet are non-refundable once allocated into active or completed Lifafas. Unclaimed portions of cancelled Lifafas return to the creator’s wallet balance.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            4. Fair Participation &amp; Anti-Farming Rules
          </h3>
          <p>
            Users agree to participate fairly. The following behaviors are strictly prohibited:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Operating multiple accounts to bypass per-device or per-user claim limits.</li>
            <li>Using automated scripts, bots, emulators, or browser extensions to automate claims.</li>
            <li>Falsifying Telegram or social task completions.</li>
            <li>Engaging in Sybil attacks or fraudulent referral generation.</li>
          </ul>
          <p>
            Any rewards obtained through prohibited behavior may be reversed, and associated accounts will be permanently blacklisted.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            5. Withdrawals &amp; Banking Payouts
          </h3>
          <p>
            Claimants may submit withdrawal requests to their registered UPI ID or Indian bank account. All withdrawals are audited against anti-fraud ledgers. While platform administrators endeavor to process withdrawals promptly, processing timelines may vary depending on banking settlement windows.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            6. Limitation of Liability
          </h3>
          <p>
            Lifafa and its operators are not liable for losses caused by third-party UPI service disruptions, Telegram API downtime, incorrect banking credentials provided by users, or unauthorized access resulting from user negligence in securing their Google accounts.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            7. Amendments &amp; Contact
          </h3>
          <p>
            Lifafa reserves the right to modify these Terms at any time. Continued use of the platform following modifications constitutes acceptance of the revised Terms. For legal inquiries, please contact support through the platform.
          </p>
        </section>
      </div>
    </div>
  );
};
