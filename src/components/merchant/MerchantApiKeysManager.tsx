import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Clock,
  RotateCcw,
  Trash2,
  Lock,
  ArrowDown,
  RefreshCw,
  Eye,
  EyeOff,
  History,
  CheckCircle2,
} from 'lucide-react';
import type { MerchantApiKey } from '../../types/merchant';
import { merchantGatewayService } from '../../services/merchantGatewayService';
import { formatDate } from '../../lib/utils';

interface MerchantApiKeysManagerProps {
  merchantId: string;
  keys: MerchantApiKey[];
  onRefresh: () => void;
}

export const MerchantApiKeysManager: React.FC<MerchantApiKeysManagerProps> = ({
  merchantId,
  keys: initialKeys,
  onRefresh,
}) => {
  const [localKeys, setLocalKeys] = useState<MerchantApiKey[]>(initialKeys || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Modals
  const [isWarningModalOpen, setIsWarningModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSecretModalOpen, setIsSecretModalOpen] = useState<boolean>(false);

  const [newKeyName, setNewKeyName] = useState<string>('Primary API Key');
  const [generatedSecret, setGeneratedSecret] = useState<{ clientId: string; clientSecret: string } | null>(null);

  // Copy feedback states
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedActiveKey, setCopiedActiveKey] = useState<boolean>(false);
  const [showFullKey, setShowFullKey] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with props whenever initialKeys changes
  useEffect(() => {
    if (initialKeys && initialKeys.length > 0) {
      setLocalKeys(initialKeys);
    }
  }, [initialKeys]);

  // Fetch authoritative state directly from database
  const fetchAuthoritativeKeys = useCallback(async () => {
    if (!merchantId) return;
    try {
      setLoading(true);
      const fetched = await merchantGatewayService.getMerchantApiKeys(merchantId);
      setLocalKeys(fetched || []);
    } catch (err) {
      console.error('Error fetching authoritative merchant API keys:', err);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  // Initial fetch on mount or when merchantId changes
  useEffect(() => {
    fetchAuthoritativeKeys();
  }, [fetchAuthoritativeKeys]);

  const activeKey = localKeys.find((k) => k.is_active);
  const revokedKeys = localKeys.filter((k) => !k.is_active);

  // Handle clicking "Generate New Key" button
  const handleGenerateClick = () => {
    setErrorMsg(null);
    if (activeKey) {
      // If an active key exists, show the animated warning confirmation modal
      setIsWarningModalOpen(true);
    } else {
      // If no active key exists, open the creation modal
      setIsCreateModalOpen(true);
    }
  };

  // Perform secure key generation / rotation
  const executeKeyGeneration = async (keyName: string) => {
    setErrorMsg(null);
    try {
      setGenerating(true);
      const res = await merchantGatewayService.generateApiKey({
        merchantId,
        keyName: keyName.trim() || 'Primary API Key',
      });

      setGeneratedSecret({
        clientId: res.clientId,
        clientSecret: res.clientSecret,
      });

      setIsWarningModalOpen(false);
      setIsCreateModalOpen(false);
      setIsSecretModalOpen(true);

      // Immediately refresh authoritative local keys and parent state
      await fetchAuthoritativeKeys();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate API Key');
    } finally {
      setGenerating(false);
    }
  };

  // Handle manual revocation
  const handleRevoke = async (keyId: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Applications using it will immediately stop working.')) {
      return;
    }

    try {
      setRevokingId(keyId);
      setErrorMsg(null);
      await merchantGatewayService.revokeApiKey(keyId, merchantId);
      await fetchAuthoritativeKeys();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke API Key');
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'id' | 'active') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedActiveKey(true);
      setTimeout(() => setCopiedActiveKey(false), 2000);
    }
  };

  const maskClientId = (clientId: string) => {
    if (!clientId) return '';
    if (clientId.length <= 15) return clientId;
    const prefix = clientId.substring(0, 8);
    const suffix = clientId.substring(clientId.length - 4);
    return `${prefix}••••••••••••${suffix}`;
  };

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">API Credentials</h4>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">
              Single-Active-Key Architecture
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Authenticate automated payout requests and status reconciliations from your backend
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchAuthoritativeKeys()}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            title="Refresh API Credentials"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={handleGenerateClick}
            disabled={generating}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate New Key</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. ACTIVE API KEY DISPLAY CARD                           */}
      {/* ======================================================== */}
      {activeKey ? (
        <div className="bg-white border-2 border-emerald-500/40 rounded-xl p-5 shadow-xs relative overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{activeKey.key_name}</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              ID: {activeKey.id.substring(0, 8)}...
            </span>
          </div>

          {/* Key Box */}
          <div className="bg-slate-900 text-slate-100 rounded-lg p-3.5 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">API Key / Client ID</span>
              <button
                onClick={() => setShowFullKey(!showFullKey)}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {showFullKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showFullKey ? 'Mask' : 'Reveal'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-emerald-400 font-semibold text-xs sm:text-sm tracking-wide break-all select-all">
                {showFullKey ? activeKey.client_id : maskClientId(activeKey.client_id)}
              </span>

              <button
                onClick={() => copyToClipboard(activeKey.client_id, 'active')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-colors cursor-pointer shrink-0"
                title="Copy API Key"
              >
                {copiedActiveKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedActiveKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Timestamps & Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Created At</span>
              <span className="text-slate-800 font-medium">{formatDate(activeKey.created_at)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Last Authenticated</span>
              <span className="text-slate-800 font-medium">
                {activeKey.last_used_at ? formatDate(activeKey.last_used_at) : 'Never'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(activeKey.client_id, 'active')}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors cursor-pointer"
              >
                {copiedActiveKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedActiveKey ? 'Key Copied!' : 'Copy Key'}</span>
              </button>

              <button
                onClick={() => handleRevoke(activeKey.id)}
                disabled={revokingId === activeKey.id}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{revokingId === activeKey.id ? 'Revoking...' : 'Revoke Key'}</span>
              </button>
            </div>

            <button
              onClick={handleGenerateClick}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rotate / Generate New Key</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-slate-800">No Active API Key</h5>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Generate an API Key to integrate the Createlifafa Merchant Gateway into your custom ERP, mobile app, or backend service.
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate API Key</span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. REVOKED KEYS HISTORY (AUDIT TRAIL)                   */}
      {/* ======================================================== */}
      {revokedKeys.length > 0 && (
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <History className="w-4 h-4 text-slate-400" />
            <span>Revoked Key History ({revokedKeys.length})</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Key Name</th>
                  <th className="p-2.5">Client ID</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Created</th>
                  <th className="p-2.5">Last Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {revokedKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-sans font-medium text-slate-800">{k.key_name}</td>
                    <td className="p-2.5 text-slate-500">{maskClientId(k.client_id)}</td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        REVOKED
                      </span>
                    </td>
                    <td className="p-2.5 text-[11px] text-slate-500">{formatDate(k.created_at)}</td>
                    <td className="p-2.5 text-[11px] text-slate-500">
                      {k.last_used_at ? formatDate(k.last_used_at) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ANIMATED WARNING MODAL BEFORE KEY ROTATION            */}
      {/* ======================================================== */}
      {isWarningModalOpen && activeKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 border border-slate-200 transform transition-all duration-300 scale-100 animate-in fade-in zoom-in-95 space-y-5">
            {/* Warning Icon with Glow Pulse */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center mx-auto text-amber-600 shadow-md ring-8 ring-amber-50 animate-pulse">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">⚠️ Generate New API Key?</h3>
              <p className="text-xs text-slate-600 leading-relaxed px-1">
                Generating a new API key will <strong>immediately revoke</strong> your current active API key. Any application, ERP, website, or backend currently using the old key will stop working until you update it with the new key.
              </p>
            </div>

            {/* Current Key Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Key</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
              <div className="font-mono text-xs text-slate-800 font-semibold break-all">
                {maskClientId(activeKey.client_id)}
              </div>
            </div>

            {/* Transition Flow Animation */}
            <div className="space-y-2 text-center text-xs">
              <div className="p-2.5 bg-amber-50/80 border border-amber-300 rounded-lg text-amber-900 font-semibold flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-600" />
                <span>OLD KEY WILL BE REVOKED</span>
              </div>

              <div className="flex justify-center text-slate-400 py-0.5">
                <ArrowDown className="w-4 h-4 animate-bounce text-slate-500" />
              </div>

              <div className="p-2.5 bg-emerald-50/80 border border-emerald-300 rounded-lg text-emerald-900 font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>NEW KEY WILL BECOME ACTIVE</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsWarningModalOpen(false)}
                disabled={generating}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => executeKeyGeneration('Rotated API Key')}
                disabled={generating}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rotating Key...</span>
                  </>
                ) : (
                  <span>Yes, Generate New Key</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. CREATION MODAL (WHEN NO KEY EXISTS)                   */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5 border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Create Merchant API Key</h4>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Key Identifier / Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Primary Production Backend"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeKeyGeneration(newKeyName)}
                disabled={generating}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ONE-TIME SECRET DISPLAY MODAL                         */}
      {/* ======================================================== */}
      {isSecretModalOpen && generatedSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-slate-900">Save Your API Client Secret</h4>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
              <strong>CRITICAL SECURITY NOTICE:</strong> This secret will <strong>NEVER</strong> be displayed again. Store it immediately in your backend configuration or environment secrets.
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Client ID (API Key)</span>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 mt-1">
                  <span className="select-all font-semibold break-all mr-2">{generatedSecret.clientId}</span>
                  <button
                    onClick={() => copyToClipboard(generatedSecret.clientId, 'id')}
                    className="text-blue-600 hover:text-blue-800 p-1 cursor-pointer shrink-0"
                    title="Copy Client ID"
                  >
                    {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Client Secret</span>
                <div className="flex items-center justify-between p-2.5 bg-slate-900 text-emerald-400 border border-slate-800 rounded-lg font-mono text-xs mt-1">
                  <span className="select-all font-semibold break-all mr-2">{generatedSecret.clientSecret}</span>
                  <button
                    onClick={() => copyToClipboard(generatedSecret.clientSecret, 'secret')}
                    className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer shrink-0"
                    title="Copy Client Secret"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setIsSecretModalOpen(false);
                fetchAuthoritativeKeys();
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer mt-2"
            >
              I Have Securely Saved the Secret
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
