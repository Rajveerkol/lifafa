import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Eye,
  Building2,
  Power,
  Info,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  merchantGatewayService,
  MerchantUpiSettings,
  DEFAULT_MERCHANT_UPI_SETTINGS,
  MERCHANT_UPI_SETTINGS_EVENT,
} from '../../services/merchantGatewayService';

interface MerchantUpiSettingsCardProps {
  onSaved?: () => void;
}

export const MerchantUpiSettingsCard: React.FC<MerchantUpiSettingsCardProps> = ({ onSaved }) => {
  const [settings, setSettings] = useState<MerchantUpiSettings>(() => {
    try {
      const item = localStorage.getItem('lifafa_merchant_upi_settings');
      if (item) return { ...DEFAULT_MERCHANT_UPI_SETTINGS, ...JSON.parse(item) };
    } catch (e) {}
    return DEFAULT_MERCHANT_UPI_SETTINGS;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preview interactive state
  const [previewAmount, setPreviewAmount] = useState<number>(5000);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [qrImageError, setQrImageError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      try {
        const data = await merchantGatewayService.getMerchantUpiSettings();
        if (isMounted) {
          setSettings(data);
        }
      } catch (err) {
        console.error('Failed to load merchant UPI settings:', err);
      }
    };

    fetchSettings();

    // Listen to real-time events across admin tabs
    const handleBroadcast = (e: Event) => {
      const customEvent = e as CustomEvent<MerchantUpiSettings>;
      if (customEvent.detail && isMounted) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener(MERCHANT_UPI_SETTINGS_EVENT, handleBroadcast);
    return () => {
      isMounted = false;
      window.removeEventListener(MERCHANT_UPI_SETTINGS_EVENT, handleBroadcast);
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Custom QR image size must be under 2MB.');
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      setSettings((prev) => ({
        ...prev,
        qrImageUrl: base64Url,
      }));
      setQrImageError(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomQr = () => {
    setSettings((prev) => ({
      ...prev,
      qrImageUrl: '',
    }));
    setQrImageError(false);
  };

  const handleCopyUpi = () => {
    if (!settings.upiId) return;
    navigator.clipboard.writeText(settings.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSaveChanges = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUpi = settings.upiId.trim();
    const cleanPayee = settings.payeeName.trim();

    if (!cleanUpi) {
      setErrorMsg('UPI ID is required.');
      return;
    }

    if (!cleanPayee) {
      setErrorMsg('Payee Display Name is required.');
      return;
    }

    try {
      setSaving(true);
      const updated = await merchantGatewayService.updateMerchantUpiSettings({
        payeeName: cleanPayee,
        upiId: cleanUpi,
        qrImageUrl: settings.qrImageUrl?.trim() || '',
        status: settings.status,
      });

      setSettings(updated);
      setSuccessMsg('UPI collection settings updated successfully.');
      if (onSaved) onSaved();

      setTimeout(() => {
        setSuccessMsg(null);
      }, 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update UPI collection settings.');
    } finally {
      setSaving(false);
    }
  };

  const dynamicUri = `upi://pay?pa=${encodeURIComponent(settings.upiId || 'createlifafa@upi')}&pn=${encodeURIComponent(settings.payeeName || 'Createlifafa Payout Gateway')}&am=${previewAmount}&cu=INR`;

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs text-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading UPI Collection Settings...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">Merchant Gateway UPI Collection</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control the receiving UPI credentials and QR code presented to merchants for float deposits
            </p>
          </div>
        </div>

        {/* Status Pill Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              settings.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                settings.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{settings.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
          </span>
        </div>
      </div>

      {/* Confirmation & Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {/* Form & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls (7 cols) */}
        <form onSubmit={handleSaveChanges} className="lg:col-span-7 space-y-4">
          {/* Field 1: Payee Display Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Payee Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={settings.payeeName}
              onChange={(e) => setSettings((prev) => ({ ...prev, payeeName: e.target.value }))}
              placeholder="e.g. Createlifafa Payout Gateway"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Example: <code className="font-mono text-slate-600">Createlifafa Payout Gateway</code>. Shown on the deposit receipt and UPI intent.
            </p>
          </div>

          {/* Field 2: UPI ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              UPI ID (VPA) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={settings.upiId}
              onChange={(e) => setSettings((prev) => ({ ...prev, upiId: e.target.value.trim() }))}
              placeholder="e.g. createlifafa@upi"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Example: <code className="font-mono text-slate-600">createlifafa@upi</code> or bank VPA.
            </p>
          </div>

          {/* Field 3: Status Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Collection Status <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, status: 'ACTIVE' }))}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  settings.status === 'ACTIVE'
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-800 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Power className={`w-3.5 h-3.5 ${settings.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>Active</span>
              </button>

              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, status: 'INACTIVE' }))}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  settings.status === 'INACTIVE'
                    ? 'bg-rose-50/70 border-rose-300 text-rose-800 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Power className={`w-3.5 h-3.5 ${settings.status === 'INACTIVE' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Inactive</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1">
              <Info className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
              <span>
                When <strong>Inactive</strong>, merchants will see: <em className="text-rose-600 font-semibold">“UPI collection is temporarily unavailable.”</em> and float deposits will be blocked.
              </span>
            </p>
          </div>

          {/* Field 4: QR Code Configuration */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">QR Code Source</label>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {settings.qrImageUrl ? 'Custom Uploaded Image' : 'Dynamic Auto-Generated'}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-600 cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload / Replace QR Image</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {settings.qrImageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveCustomQr}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove QR (Switch to Dynamic)</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Or Direct Image URL / CDN Link
                </label>
                <input
                  type="url"
                  value={settings.qrImageUrl.startsWith('data:') ? '' : settings.qrImageUrl}
                  onChange={(e) => {
                    setSettings((prev) => ({
                      ...prev,
                      qrImageUrl: e.target.value.trim(),
                    }));
                    setQrImageError(false);
                  }}
                  placeholder="https://your-domain.com/static/merchant-qr.png"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-600"
                />
              </div>

              {settings.qrImageUrl.startsWith('data:') && (
                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Custom high-resolution QR image ready to be saved.</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Save Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={saving || !settings.upiId.trim() || !settings.payeeName.trim()}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right Column: Live Merchant Preview (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Live Merchant View Preview</span>
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase font-mono">
                {settings.qrImageUrl ? 'Custom QR' : 'Dynamic UPI'}
              </span>
            </div>

            {/* Simulated Merchant Add-Money Card */}
            <div className="mt-3 bg-white p-4 rounded-2xl border border-slate-200 text-center space-y-3 shadow-2xs">
              {settings.status === 'INACTIVE' ? (
                <div className="py-6 px-3 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-rose-800">UPI collection is temporarily unavailable.</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Merchants will see this fallback message and will not be able to submit float deposits.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Payee Display Name
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {settings.payeeName || 'Createlifafa Payout Gateway'}
                    </h4>
                  </div>

                  {/* QR Image Container */}
                  <div className="py-2 flex items-center justify-center">
                    {settings.qrImageUrl && !qrImageError ? (
                      <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-block">
                        <img
                          src={settings.qrImageUrl}
                          alt="Merchant UPI QR"
                          onError={() => setQrImageError(true)}
                          className="w-36 h-36 object-contain mx-auto rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs inline-block">
                        <QRCodeSVG
                          value={dynamicUri}
                          size={140}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                    )}
                  </div>

                  {settings.qrImageUrl && qrImageError && (
                    <p className="text-[11px] text-rose-600 font-medium">Failed to load custom QR image.</p>
                  )}

                  {/* UPI VPA Pill */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700">
                    <span>{settings.upiId || 'createlifafa@upi'}</span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="p-0.5 hover:text-blue-600 cursor-pointer"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium">
                    Merchants scan with PhonePe, GPay, Paytm, or BHIM to pay <span className="font-bold text-blue-600">₹{previewAmount.toLocaleString('en-IN')}</span>
                  </p>

                  {/* Test Amount Selector for simulation */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Test Amount:</span>
                    <div className="flex items-center gap-1 font-mono font-bold">
                      {[500, 5000, 10000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setPreviewAmount(amt)}
                          className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                            previewAmount === amt
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          ₹{amt.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-white/60 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
            All updates sync immediately to the database and broadcast to any open merchant browsers in real time.
          </div>
        </div>
      </div>
    </div>
  );
};
