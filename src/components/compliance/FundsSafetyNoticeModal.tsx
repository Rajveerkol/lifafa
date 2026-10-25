import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Phone,
  FileText,
  Clock,
  Lock,
  Loader2,
  X,
  ExternalLink,
  ChevronDown,
  Info,
} from 'lucide-react';
import { termsComplianceService, DEFAULT_TERMS_CAMPAIGN, type TermsCampaign } from '../../services/termsComplianceService';

interface FundsSafetyNoticeModalProps {
  isOpen: boolean;
  onAccepted: () => void;
  onRejected?: () => void;
  onClose?: () => void;
  userEmail?: string;
  userType?: 'MERCHANT' | 'CUSTOMER';
  initialMobile?: string;
  forceMandatory?: boolean; // If true, cannot dismiss via backdrop
}

type ModalStep = 'review' | 'confirm' | 'mobile' | 'dialog' | 'success' | 'rejected';

export const FundsSafetyNoticeModal: React.FC<FundsSafetyNoticeModalProps> = ({
  isOpen,
  onAccepted,
  onRejected,
  onClose,
  userEmail,
  userType = 'CUSTOMER',
  initialMobile = '',
  forceMandatory = true,
}) => {
  const [step, setStep] = useState<ModalStep>('review');
  const [campaign, setCampaign] = useState<TermsCampaign>(DEFAULT_TERMS_CAMPAIGN);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [mobileNumber, setMobileNumber] = useState(initialMobile);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptedTimestamp, setAcceptedTimestamp] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load active campaign on mount
  useEffect(() => {
    if (isOpen) {
      termsComplianceService.getActiveCampaign().then(setCampaign).catch(() => {});
      termsComplianceService.recordNoticeEvent({
        campaignId: campaign.id,
        version: campaign.version,
        eventType: 'DISPLAYED',
      });
      // Reset form states
      setStep('review');
      setHasScrolledToEnd(false);
      setAgreedToTerms(false);
      setErrorMessage(null);
      if (initialMobile) {
        setMobileNumber(initialMobile.replace(/^\+91/, ''));
      }
    }
  }, [isOpen]);

  // Monitor scroll progress to enforce mandatory full-text review
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 25;
    if (isAtBottom && !hasScrolledToEnd) {
      setHasScrolledToEnd(true);
      termsComplianceService.recordNoticeEvent({
        campaignId: campaign.id,
        version: campaign.version,
        eventType: 'SCROLLED_END',
      });
    }
  };

  // Step 1 -> Step 2
  const handleProceedToConfirmation = () => {
    if (!hasScrolledToEnd || !agreedToTerms) return;
    setStep('confirm');
  };

  // Step 2 Confirm -> Mobile Step
  const handleAcceptTermsDecision = () => {
    setStep('mobile');
  };

  // Step 2 Reject -> Save Rejection Event
  const handleRejectTermsDecision = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      await termsComplianceService.submitTermsDecision({
        campaignId: campaign.id,
        version: campaign.version,
        decision: 'REJECTED',
        termsHash: campaign.content_hash,
      });
      setStep('rejected');
      if (onRejected) onRejected();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record rejection decision.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mobile Validation & Pre-Confirmation Dialog
  const handleValidateMobile = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileError(null);
    const clean = mobileNumber.replace(/[^0-9]/g, '');
    if (clean.length !== 10) {
      setMobileError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setStep('dialog');
  };

  // Final Mobile Submission
  const handleFinalMobileSubmit = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const clean = mobileNumber.replace(/[^0-9]/g, '');
      const fullMobile = `+91${clean}`;

      await termsComplianceService.submitTermsDecision({
        campaignId: campaign.id,
        version: campaign.version,
        decision: 'ACCEPTED',
        mobileNumber: fullMobile,
        termsHash: campaign.content_hash,
      });

      setAcceptedTimestamp(new Date().toISOString());
      setStep('success');
      onAccepted();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit terms acceptance.');
      setStep('mobile');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 border border-white/15 rounded-3xl shadow-2xl shadow-blue-500/10 text-white overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between gap-3 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Important: Funds Safety &amp; Responsibility Notice
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {campaign.version}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mandatory compliance verification for funds submission and float operations
              </p>
            </div>
          </div>

          {!forceMandatory && onClose && step !== 'dialog' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2 text-xs text-red-300 animate-in shake">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 1: REVIEW AND AGREEMENT                                 */}
        {/* ============================================================ */}
        {step === 'review' && (
          <div className="p-4 sm:p-6 flex-1 flex flex-col overflow-hidden space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <FileText className="w-4 h-4 text-blue-400" />
                Step 1 of 2: Review Complete Terms
              </span>
              <span className="font-mono text-[11px] text-cyan-400">
                {hasScrolledToEnd ? '✓ Complete terms reviewed' : '↓ Scroll down to continue'}
              </span>
            </div>

            {/* Scrollable Terms Content */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-950/70 border border-white/10 rounded-2xl text-xs space-y-4 text-slate-300 leading-relaxed font-sans shadow-inner scrollbar-thin scrollbar-thumb-white/20"
              style={{ maxHeight: '42vh' }}
            >
              <div className="space-y-1 pb-2 border-b border-white/10">
                <h4 className="text-sm font-bold text-white">CreateLifafa Platform Funds Declaration</h4>
                <p className="text-[11px] text-slate-400">Applicable to all account holders utilizing deposit and payout features.</p>
              </div>

              <div>
                <strong className="text-white block mb-1">1. Accurate Payment Information</strong>
                <p>
                  I confirm that funds I deposit or transfer through CreateLifafa are submitted using payment details and instructions displayed by the platform. I am responsible for checking the recipient details, amount, applicable charges, and transaction reference before completing a payment.
                </p>
              </div>

              <div>
                <strong className="text-white block mb-1">2. Fund Status and Verification</strong>
                <p>
                  A submitted deposit request does not automatically mean the payment has been received, verified, cleared, or credited. Funds remain subject to applicable banking/payment-provider processes, reconciliation, fraud checks, and the platform's published procedures.
                </p>
              </div>

              <div>
                <strong className="text-white block mb-1">3. Responsibility for My Transactions</strong>
                <p>
                  I am responsible for ensuring that transfers I initiate are authorized, lawful, and made from accounts or payment methods I am permitted to use. I must retain transaction receipts and provide accurate reference details when requested.
                </p>
              </div>

              {/* MANDATORY HIGHLIGHTED CALLOUT PHRASE */}
              <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-indigo-500/15 border-2 border-amber-400/40 rounded-2xl text-amber-200 shadow-lg shadow-amber-500/5 space-y-1.5 my-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Important Funds Declaration (Section 4)</span>
                </div>
                <p className="text-xs sm:text-sm font-extrabold leading-snug text-white">
                  “The funds I deposit are subject to verification and applicable banking/payment rules. I understand that I am responsible for providing accurate transaction information and cooperating with legitimate verification requests.”
                </p>
                <p className="text-[11px] text-amber-300/90 pt-1 leading-relaxed">
                  I understand that the funds I deposit are subject to payment verification, banking rules, applicable law, and the platform's published terms. I must not assume that every transfer is immediately available or guaranteed to be recoverable.
                </p>
              </div>

              <div>
                <strong className="text-white block mb-1">5. Suspicious or Unverified Transactions</strong>
                <p>
                  If a transaction is flagged, disputed, reversed, held, or suspected to involve fraud or unlawful activity, the platform may temporarily restrict the affected transaction or balance to the extent permitted by applicable law and the platform's valid policies. The platform must follow applicable legal obligations and its dispute-resolution process.
                </p>
              </div>

              <div>
                <strong className="text-white block mb-1">6. My Responsibility and Cooperation</strong>
                <p>
                  I agree to provide accurate information, cooperate with lawful verification requests, and report suspicious activity promptly. Responsibility for a transaction will be assessed based on the actual facts, applicable law, and relevant platform policies.
                </p>
              </div>

              <div>
                <strong className="text-white block mb-1">7. No False Guarantee</strong>
                <p>
                  The platform does not promise that every transfer is risk-free, instantly settled, or immune from banking disputes. Nothing in these terms removes statutory rights or makes the user automatically liable for circumstances outside their control.
                </p>
              </div>

              <div className="pb-2">
                <strong className="text-white block mb-1">8. Acceptance Record</strong>
                <p>
                  My acceptance records the version of the terms I reviewed, my authenticated account, the confirmation time, and the mobile number I provide or confirm. The platform will use this information only for legitimate compliance, security, support, and audit purposes under its applicable privacy policy.
                </p>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center text-blue-300 font-bold text-[11px]">
                End of Terms &amp; Conditions (Version {campaign.version})
              </div>
            </div>

            {/* Scroll Indicator Prompt */}
            {!hasScrolledToEnd && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 py-2 rounded-xl animate-pulse border border-amber-500/20">
                <ChevronDown className="w-4 h-4" />
                <span>Please scroll to the very bottom of the terms to unlock agreement</span>
              </div>
            )}

            {/* Explicit Checkbox Agreement */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  disabled={!hasScrolledToEnd}
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/30 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                  I have read, understood, and agree to these <strong className="text-white">Funds Safety &amp; Responsibility Terms &amp; Conditions</strong>.
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleProceedToConfirmation}
                  disabled={!hasScrolledToEnd || !agreedToTerms}
                  className="flex-1 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Continue to Final Confirmation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: FINAL CONFIRMATION & REJECT OPTION                   */}
        {/* ============================================================ */}
        {step === 'confirm' && (
          <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-6 animate-in zoom-in-95 duration-200">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Step 2 of 2: Explicit Confirmation Decision
                </span>
              </div>

              <div className="p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 border border-white/10 rounded-2xl space-y-3">
                <h4 className="text-sm font-black text-white">Confirm Binding Acceptance</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You are about to accept the <strong className="text-cyan-300">Funds Safety &amp; Responsibility Notice ({campaign.version})</strong>. This will be permanently recorded in your audit profile alongside your authenticated account.
                </p>

                <div className="p-3 bg-white/5 rounded-xl text-xs space-y-1.5 font-mono text-slate-300 border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account:</span>
                    <span className="text-white font-bold">{userEmail || 'Authenticated User'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Terms Version:</span>
                    <span className="text-cyan-300">{campaign.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Campaign ID:</span>
                    <span className="text-slate-300">{campaign.campaign_code}</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <p>
                    Acceptance enables active deposit submissions and float processing. Rejecting will restrict these financial features until terms are acknowledged.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleAcceptTermsDecision}
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm &amp; Accept Terms</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  disabled={submitting}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-2xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleRejectTermsDecision}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Decision...</span>
                    </>
                  ) : (
                    <span>Reject Terms</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: MOBILE NUMBER INPUT                                  */}
        {/* ============================================================ */}
        {step === 'mobile' && (
          <form onSubmit={handleValidateMobile} className="p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-6 animate-in zoom-in-95 duration-200">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Phone className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-slate-300">Confirm Your Registered Mobile Number</span>
              </div>

              <div className="p-4 bg-slate-950/70 border border-white/10 rounded-2xl space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Provide or confirm your 10-digit mobile number. This will be linked to your terms acceptance record for banking reconciliation, fraud compliance, and account recovery.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Mobile Number (India +91) *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-xs font-bold font-mono text-cyan-400 bg-white/5 py-1 px-2 rounded-lg border border-white/10 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      inputMode="numeric"
                      value={mobileNumber}
                      onChange={(e) => {
                        setMobileNumber(e.target.value.replace(/[^0-9]/g, ''));
                        setMobileError(null);
                      }}
                      placeholder="9876543210"
                      className="w-full pl-16 pr-4 py-3 bg-slate-950 border border-white/15 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 rounded-2xl font-mono text-base font-bold text-white placeholder:text-slate-600 outline-none transition-all tracking-wider"
                    />
                  </div>
                  {mobileError && (
                    <p className="text-[11px] text-red-400 font-medium pl-1">{mobileError}</p>
                  )}
                </div>

                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                  <p>
                    This is saved as a <strong>User-Confirmed Mobile Number</strong>. We do not dispatch unsolicited SMS messages or share your number with third parties.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Review &amp; Confirm Number</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* STEP 4: ANIMATED CONFIRMATION DIALOG (PLEASE CHECK NUMBER)   */}
        {/* ============================================================ */}
        {step === 'dialog' && (
          <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-3xl bg-blue-500/20 border border-blue-500/40 text-blue-400 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Phone className="w-7 h-7 text-blue-400 animate-pulse" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">Please check your mobile number again</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Ensure this is your accurate personal or business WhatsApp/SMS phone number.
                </p>
              </div>

              <div className="inline-block p-4 bg-slate-950/90 border-2 border-cyan-500/40 rounded-2xl shadow-inner font-mono text-xl sm:text-2xl font-black text-cyan-300 tracking-wider">
                +91 {mobileNumber.slice(0, 5)} {mobileNumber.slice(5)}
              </div>

              <p className="text-[11px] text-slate-400">
                Action: <span className="text-white font-bold">Confirm Mobile Number</span> (Recorded under User-Confirmed status)
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleFinalMobileSubmit}
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Finalizing Terms Acceptance...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Yes, This Is My Number — Submit Acceptance</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep('mobile')}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
              >
                ← Edit Number
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: SUCCESS CARD                                         */}
        {/* ============================================================ */}
        {step === 'success' && (
          <div className="p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-1">
              <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Status: Terms Accepted
              </span>
              <h4 className="text-xl font-black text-white pt-1">
                Notice &amp; Terms Confirmed!
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your acceptance has been cryptographically recorded for compliance and funds security verification.
              </p>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs space-y-2 text-left max-w-md mx-auto font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Terms Version:</span>
                <span className="text-cyan-300 font-bold">{campaign.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Confirmed Mobile:</span>
                <span className="text-white font-bold">+91 {mobileNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mobile Status:</span>
                <span className="text-emerald-400 font-bold">USER_CONFIRMED</span>
              </div>
              {acceptedTimestamp && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-300">{new Date(acceptedTimestamp).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full max-w-md py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
            >
              Continue to Protected Feature
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* REJECTED SCREEN                                              */}
        {/* ============================================================ */}
        {step === 'rejected' && (
          <div className="p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>

            <div className="space-y-1">
              <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                Decision: Terms Rejected
              </span>
              <h4 className="text-xl font-black text-white pt-1">
                Deposit &amp; Float Features Restricted
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Under platform safety policies, submitting deposits, merchant gateway float top-ups, and payout dispatches require accepting the Funds Safety terms.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-red-500/20 rounded-2xl text-xs space-y-2 text-left max-w-md mx-auto text-slate-300">
              <div className="font-bold text-red-400 text-xs">Currently Restricted:</div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-400">
                <li>Customer wallet manual UPI deposit requests</li>
                <li>Merchant portal float top-ups and live QR generation</li>
                <li>Automated / instant payout dispatches</li>
              </ul>
              <div className="text-[11px] text-emerald-400 pt-1">
                ✓ Non-deposit features (account dashboard, lifafa claims) remain accessible.
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setStep('review')}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border border-white/10"
              >
                Review Terms Again
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Exit / Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
