import React, { useState } from 'react';
import { Key, Plus, Copy, Check, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
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
  keys,
  onRefresh,
}) => {
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      setGenerating(true);
      const res = await merchantGatewayService.generateApiKey({
        merchantId,
        keyName: newKeyName || 'Primary API Key',
      });
      setGeneratedSecret(res);
      setNewKeyName('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate API Key');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, isSecret = false) => {
    navigator.clipboard.writeText(text);
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">API Credentials</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Use these credentials to authenticate automated payout requests from your backend
          </p>
        </div>
        <button
          onClick={() => {
            setGeneratedSecret(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Generate New Key</span>
        </button>
      </div>

      {keys.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
          <Key className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">No API Keys Generated</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Generate an API Key to integrate the payout gateway into your ERP or custom backend.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">{k.key_name}</span>
                  {k.is_active ? (
                    <span className="inline-flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5 shrink-0" />
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 select-all">{k.client_id}</span>
                  <button
                    onClick={() => copyToClipboard(k.client_id)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded hover:bg-slate-100 transition-colors"
                    title="Copy Client ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 sm:text-right font-mono">
                <div>Created: {formatDate(k.created_at)}</div>
                {k.last_used_at && <div>Last used: {formatDate(k.last_used_at)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-lg p-5 border border-slate-200">
            {!generatedSecret ? (
              <form onSubmit={handleGenerate} className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">Create API Key</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Key Name / Identifier
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Production Backend or EC2 Worker"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">{errorMsg}</div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-2 rounded-md transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {generating ? 'Generating...' : 'Generate Key'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-semibold text-slate-900">Save Your Client Secret</h4>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900">
                  This secret will <strong>NEVER</strong> be displayed again. Store it securely in your backend environment configuration.
                </div>

                <div className="space-y-2.5">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Client ID</span>
                    <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-md font-mono text-xs text-slate-800 mt-0.5">
                      <span className="select-all">{generatedSecret.clientId}</span>
                      <button
                        onClick={() => copyToClipboard(generatedSecret.clientId)}
                        className="text-blue-600 hover:text-blue-800 p-1 cursor-pointer"
                        title="Copy Client ID"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Client Secret</span>
                    <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-md font-mono text-xs text-slate-800 mt-0.5">
                      <span className="truncate mr-2 select-all">{generatedSecret.clientSecret}</span>
                      <button
                        onClick={() => copyToClipboard(generatedSecret.clientSecret, true)}
                        className="text-blue-600 hover:text-blue-800 p-1 cursor-pointer shrink-0"
                        title="Copy Secret"
                      >
                        {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-md shadow-xs transition-colors cursor-pointer"
                >
                  I Have Saved the Secret
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
