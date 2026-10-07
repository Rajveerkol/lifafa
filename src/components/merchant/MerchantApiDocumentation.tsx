import React, { useState } from 'react';
import {
  Copy,
  Check,
  ShieldCheck,
  Key,
  ArrowRight,
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  Terminal,
  Zap,
  Globe,
  Server,
  Layers,
  HelpCircle,
} from 'lucide-react';

export const MerchantApiDocumentation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payout' | 'status' | 'security'>('status');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const statusCurlCommand = `curl -X POST https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/check-order-status \\
  -H "Content-Type: application/json" \\
  -H "X-Client-Id: YOUR_API_CLIENT_ID" \\
  -H "X-Client-Secret: YOUR_API_CLIENT_SECRET" \\
  -d '{"order_id": "ord_1001"}'`;

  const payoutCurlCommand = `curl -X POST https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/merchant-paynit-payout \\
  -H "Content-Type: application/json" \\
  -H "X-Client-Id: YOUR_API_CLIENT_ID" \\
  -H "X-Client-Secret: YOUR_API_CLIENT_SECRET" \\
  -H "X-Idempotency-Key: idemp_${Date.now()}" \\
  -d '{
    "order_id": "ord_1001",
    "amount": 250.00,
    "payout_method": "UPI",
    "upi_id": "beneficiary@upi",
    "note": "Vendor Settlement"
  }'`;

  return (
    <div className="space-y-6">
      {/* Top Architecture Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-700/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                Production REST API v1.0
              </span>
              <span className="inline-flex items-center text-[10px] font-medium text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-500/30">
                Createlifafa Merchant Gateway
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">Developer API Integration Suite</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Programmatically initiate automated instant UPI disbursements and query real-time transaction reconciliation statuses from your custom backend or ERP.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 shrink-0">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Strict Zero Provider Exposure</span>
          </div>
        </div>

        {/* Developer Flow Diagram */}
        <div className="mt-5 pt-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Architectural Gateway Flow
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 flex flex-col items-center justify-center">
              <Server className="w-5 h-5 text-blue-400 mb-1" />
              <span className="font-semibold text-slate-100">Your Server</span>
              <span className="text-[10px] text-slate-400">Backend / ERP</span>
            </div>
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 flex flex-col items-center justify-center relative">
              <div className="hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10">
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
              <Globe className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="font-semibold text-slate-100">Createlifafa API</span>
              <span className="text-[10px] text-emerald-300">Public Gateway</span>
            </div>
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 flex flex-col items-center justify-center relative">
              <div className="hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10">
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
              <Layers className="w-5 h-5 text-indigo-400 mb-1" />
              <span className="font-semibold text-slate-100">Internal Engine</span>
              <span className="text-[10px] text-slate-400">Auth, Ledger &amp; Safety</span>
            </div>
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 flex flex-col items-center justify-center relative">
              <div className="hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10">
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
              <Zap className="w-5 h-5 text-amber-400 mb-1" />
              <span className="font-semibold text-slate-100">Banking Network</span>
              <span className="text-[10px] text-amber-300">Instant UPI Rails</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg flex items-start gap-3 text-xs text-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Enterprise Boundary Guarantee:</strong> You integrate exclusively with Createlifafa Merchant Gateway. You do <em>NOT</em> integrate directly with PayNit or any underlying banking provider. All provider endpoints, credentials, encryption keys, and raw banking handshakes are executed strictly server-side on isolated Createlifafa infrastructure.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-4 pt-3">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'status'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>2. Transaction Status API</span>
          <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold">NEW</span>
        </button>

        <button
          onClick={() => setActiveTab('payout')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'payout'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>1. Merchant Payout API</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>3. Auth &amp; Security Specs</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: TRANSACTION STATUS API                           */}
      {/* ======================================================== */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <div className="bg-white rounded-b-lg rounded-t-none border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6 -mt-6">
            <div>
              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider mb-2">
                POST /api/v1/payout/status
              </span>
              <h3 className="text-base font-semibold text-slate-900">Check Payout Status &amp; Reconcile</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Check the real-time banking lifecycle of any disbursement using your custom Order ID. If a new transfer is definitively rejected, the gateway automatically reverses the locked float balance back to your merchant wallet.
              </p>
            </div>

            {/* Endpoints Box */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-900">Endpoints</h4>
              
              {/* Documented Public Endpoint */}
              <div className="p-3.5 bg-slate-900 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300 font-bold text-[10px]">POST</span>
                    <span className="text-slate-400 text-[11px]">Public Gateway Endpoint:</span>
                  </div>
                  <button
                    onClick={() => handleCopy('https://createlifafa.xyz/api/v1/payout/status', 'ep_pub_status')}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                  >
                    {copiedKey === 'ep_pub_status' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'ep_pub_status' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-emerald-400 font-semibold break-all text-[12px]">
                  https://createlifafa.xyz/api/v1/payout/status
                </div>
              </div>

              {/* Direct Gateway Edge Function */}
              <div className="p-3.5 bg-slate-900 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-600/30 text-indigo-300 font-bold text-[10px]">POST</span>
                    <span className="text-slate-400 text-[11px]">Direct Gateway Edge Function:</span>
                  </div>
                  <button
                    onClick={() => handleCopy('https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/check-order-status', 'ep_edge_status')}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                  >
                    {copiedKey === 'ep_edge_status' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'ep_edge_status' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-indigo-300 font-semibold break-all text-[12px]">
                  https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/check-order-status
                </div>
              </div>
            </div>

            {/* Request Headers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900">Required Request Headers</h4>
                <button
                  onClick={() => handleCopy(`Content-Type: application/json\nX-Client-Id: YOUR_API_CLIENT_ID\nX-Client-Secret: YOUR_API_CLIENT_SECRET\nX-Idempotency-Key: OPTIONAL_UNIQUE_KEY`, 'headers_status')}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'headers_status' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'headers_status' ? 'Headers Copied!' : 'Copy Headers'}</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Header</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Required</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">Content-Type</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Must be <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">application/json</code></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">X-Client-Id</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Your unique Merchant API Client ID (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">mc_live_...</code>)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">X-Client-Secret</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Your secret key. Verified against SHA-256 hash. Never shared.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-slate-600">X-Idempotency-Key</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 text-slate-500">Optional</td>
                      <td className="p-2.5">Unique request key for safe network retries.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Request Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900">Request Body Schema</h4>
                <button
                  onClick={() => handleCopy('{\n  "order_id": "ord_1001"\n}', 'body_status')}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'body_status' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'body_status' ? 'JSON Copied!' : 'Copy JSON'}</span>
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Strict Input Rule:</strong> Only <code className="font-mono font-bold">order_id</code> is accepted. Payout amount, beneficiary details, UPI IDs, and provider tokens must NOT be passed.
                </span>
              </div>

              <pre className="bg-slate-900 p-3.5 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`{
  "order_id": "ord_1001"
}`}
              </pre>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Field</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Required</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">order_id</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Your unique reference assigned during payout creation (3–100 alphanumeric characters, hyphens, and underscores). Must belong to your merchant account.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Normalized Response Schemas */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-900">Normalized Response Contracts</h4>
              <p className="text-xs text-slate-500">
                All status inquiries return standardized JSON envelopes. Provider-specific payloads are filtered and sanitized into the clean schema below.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SUCCESS */}
                <div className="border border-emerald-200 bg-emerald-50/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      HTTP 200 — SUCCESS
                    </span>
                    <button
                      onClick={() => handleCopy(`{\n  "success": true,\n  "order_id": "ord_1001",\n  "status": "SUCCESS",\n  "message": "Payment Completed",\n  "amount": 250.00,\n  "payout_method": "UPI",\n  "upi_id": "user@okaxis",\n  "utr": "UTR123456789"\n}`, 'res_success')}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'res_success' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'res_success' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-md text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`{
  "success": true,
  "order_id": "ord_1001",
  "status": "SUCCESS",
  "message": "Payment Completed",
  "amount": 250.00,
  "payout_method": "UPI",
  "upi_id": "user@okaxis",
  "utr": "UTR123456789"
}`}
                  </pre>
                  <p className="text-[11px] text-emerald-800">Funds successfully credited to beneficiary VPA. Bank UTR number is provided.</p>
                </div>

                {/* PROCESSING */}
                <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <Clock className="w-4 h-4 text-amber-600" />
                      HTTP 200 — PROCESSING
                    </span>
                    <button
                      onClick={() => handleCopy(`{\n  "success": true,\n  "order_id": "ord_1001",\n  "status": "PROCESSING",\n  "message": "Payment is still processing"\n}`, 'res_proc')}
                      className="text-[11px] text-amber-700 hover:text-amber-900 cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'res_proc' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'res_proc' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-md text-[11px] font-mono text-amber-300 overflow-x-auto border border-slate-800">
{`{
  "success": true,
  "order_id": "ord_1001",
  "status": "PROCESSING",
  "message": "Payment is still processing"
}`}
                  </pre>
                  <p className="text-[11px] text-amber-800">Disbursement queued in banking settlement pipes. Float remains locked. Retry in 30 seconds.</p>
                </div>

                {/* FAILED */}
                <div className="border border-red-200 bg-red-50/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      HTTP 200 — FAILED (Auto-Refunded)
                    </span>
                    <button
                      onClick={() => handleCopy(`{\n  "success": false,\n  "order_id": "ord_1001",\n  "status": "FAILED",\n  "message": "Payment Failed"\n}`, 'res_failed')}
                      className="text-[11px] text-red-700 hover:text-red-900 cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'res_failed' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'res_failed' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-md text-[11px] font-mono text-rose-400 overflow-x-auto border border-slate-800">
{`{
  "success": false,
  "order_id": "ord_1001",
  "status": "FAILED",
  "message": "Payment Failed"
}`}
                  </pre>
                  <p className="text-[11px] text-red-800">Bank rejected transaction. Locked principal + ₹2.50 fee are automatically reversed to merchant wallet.</p>
                </div>

                {/* ERROR STATES */}
                <div className="border border-slate-200 bg-slate-50/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Standard Error Responses
                    </span>
                    <button
                      onClick={() => handleCopy(`// HTTP 404 Not Found:\n{\n  "success": false,\n  "message": "Transaction not found"\n}\n\n// HTTP 401 Unauthorized:\n{\n  "success": false,\n  "message": "Invalid API credentials"\n}\n\n// HTTP 400 Bad Request:\n{\n  "success": false,\n  "message": "Order ID is required"\n}`, 'res_errors')}
                      className="text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'res_errors' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'res_errors' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-900 p-3 rounded-md text-[10px] font-mono text-slate-300 overflow-x-auto border border-slate-800 space-y-1">
{`// HTTP 404 (or unowned transaction):
{ "success": false, "message": "Transaction not found" }

// HTTP 401 (invalid key/secret):
{ "success": false, "message": "Invalid API credentials" }

// HTTP 400 (missing order_id):
{ "success": false, "message": "Order ID is required" }`}
                  </pre>
                  <p className="text-[11px] text-slate-500">Unowned orders return 404 to completely prevent merchant data enumeration.</p>
                </div>
              </div>
            </div>

            {/* cURL Example */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-slate-600" />
                  <span>Ready-to-Run cURL Command</span>
                </h4>
                <button
                  onClick={() => handleCopy(statusCurlCommand, 'curl_status')}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'curl_status' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'curl_status' ? 'cURL Copied!' : 'Copy cURL Command'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 p-4 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto border border-slate-800 leading-relaxed">
                {statusCurlCommand}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MERCHANT PAYOUT API                              */}
      {/* ======================================================== */}
      {activeTab === 'payout' && (
        <div className="space-y-6">
          <div className="bg-white rounded-b-lg rounded-t-none border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6 -mt-6">
            <div>
              <span className="inline-flex items-center text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider mb-2">
                POST /functions/v1/merchant-paynit-payout
              </span>
              <h3 className="text-base font-semibold text-slate-900">Disburse Instant UPI Payout</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Atomically lock float and disburse instant UPI payments to any virtual payment address (VPA) 24x7x365 across India.
              </p>
            </div>

            {/* Endpoints Box */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-900">Endpoint</h4>
              <div className="p-3.5 bg-slate-900 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300 font-bold text-[10px]">POST</span>
                    <span className="text-slate-400 text-[11px]">Gateway Edge Endpoint:</span>
                  </div>
                  <button
                    onClick={() => handleCopy('https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/merchant-paynit-payout', 'ep_payout')}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                  >
                    {copiedKey === 'ep_payout' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'ep_payout' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-emerald-400 font-semibold break-all text-[12px]">
                  https://pxqyeonymwlpiklfyjbb.supabase.co/functions/v1/merchant-paynit-payout
                </div>
              </div>
            </div>

            {/* Fee Schedule Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-900">Authoritative Flat Fee Structure</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Payout Rail</th>
                      <th className="p-2.5">Amount Range</th>
                      <th className="p-2.5">Provider Payout Fee</th>
                      <th className="p-2.5">Float Deduction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-semibold text-blue-700">UPI (VPA)</td>
                      <td className="p-2.5 font-mono">₹1.00 &ndash; ₹1,000.00</td>
                      <td className="p-2.5 font-mono font-semibold text-amber-700">₹2.50</td>
                      <td className="p-2.5 font-mono">Principal + ₹2.50</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* JSON Request Schema */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900">UPI Request Body Schema</h4>
                <button
                  onClick={() => handleCopy(`{\n  "order_id": "ord_1001",\n  "amount": 250.00,\n  "payout_method": "UPI",\n  "upi_id": "beneficiary@upi",\n  "note": "Vendor Settlement"\n}`, 'body_payout')}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'body_payout' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'body_payout' ? 'JSON Copied!' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 p-3.5 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`{
  "order_id": "ord_1001",
  "amount": 250.00,
  "payout_method": "UPI",
  "upi_id": "beneficiary@upi",
  "note": "Vendor Settlement"
}`}
              </pre>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Field</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Required</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">order_id</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Unique order reference assigned by your system (3–100 chars).</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">amount</td>
                      <td className="p-2.5 font-mono text-slate-500">Number</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Disbursement amount in INR (between ₹1.00 and ₹1,000.00).</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">payout_method</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Must be <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">UPI</code>.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-blue-700 font-semibold">upi_id</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 font-bold text-red-600">Yes</td>
                      <td className="p-2.5">Valid Virtual Payment Address (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">name@bank</code>).</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-slate-600">note</td>
                      <td className="p-2.5 font-mono text-slate-500">String</td>
                      <td className="p-2.5 text-slate-500">Optional</td>
                      <td className="p-2.5">Disbursement description or transaction remark (up to 100 chars).</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* cURL Example */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-slate-600" />
                  <span>Ready-to-Run cURL Command</span>
                </h4>
                <button
                  onClick={() => handleCopy(payoutCurlCommand, 'curl_payout')}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'curl_payout' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'curl_payout' ? 'cURL Copied!' : 'Copy cURL Command'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 p-4 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto border border-slate-800 leading-relaxed">
                {payoutCurlCommand}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AUTHENTICATION & SECURITY                        */}
      {/* ======================================================== */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white rounded-b-lg rounded-t-none border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6 -mt-6">
            <div>
              <span className="inline-flex items-center text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 uppercase tracking-wider mb-2">
                Security Architecture
              </span>
              <h3 className="text-base font-semibold text-slate-900">Authentication &amp; Financial Safeguards</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Createlifafa Merchant Gateway enforces bank-grade security protocols, pessimistic float locking, and tamper-resistant double-entry accounting.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span>API Key &amp; SHA-256 Hashing</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your Client Secret is never stored in plaintext. We store irreversible SHA-256 cryptographic digests. Incoming requests are hashed in-memory and compared using constant-time verification.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>IP Whitelist Protection</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Configure your production server's outbound egress IP in the IP Whitelist tab. Unwhitelisted IP addresses are automatically blocked with HTTP 403 Forbidden before reaching the ledger.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>Pessimistic Float Reservation</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When a payout is dispatched, the required funds (principal + ₹2.50 fee) are immediately moved from Available to Locked Float. If banking rails confirm failure, funds are restored automatically.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>Merchant Ownership Isolation</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The gateway strictly validates that every queried Order ID belongs to the authenticated merchant. Inquiries for non-existent or other merchants' transactions safely return HTTP 404 without leaking data.
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-xs text-blue-900">
              <strong className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-700" />
                Integration Checklist
              </strong>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-800">
                <li>Generate your live API keys from the <strong>API Keys</strong> section.</li>
                <li>Add your production server's public IP to the <strong>IP Whitelist</strong> section.</li>
                <li>Ensure sufficient float balance in your merchant wallet prior to dispatching disbursements.</li>
                <li>Store your generated <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">order_id</code> in your database for seamless status reconciliation.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
