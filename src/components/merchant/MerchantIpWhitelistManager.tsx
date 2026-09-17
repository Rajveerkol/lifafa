import React, { useState } from 'react';
import { Shield, Plus, Trash2, Globe, AlertCircle } from 'lucide-react';
import type { MerchantIpWhitelist } from '../../types/merchant';
import { merchantGatewayService } from '../../services/merchantGatewayService';

interface MerchantIpWhitelistManagerProps {
  merchantId: string;
  whitelist: MerchantIpWhitelist[];
  onRefresh: () => void;
}

export const MerchantIpWhitelistManager: React.FC<MerchantIpWhitelistManagerProps> = ({
  merchantId,
  whitelist,
  onRefresh,
}) => {
  const [ipAddress, setIpAddress] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanIp = ipAddress.trim();
    if (!cleanIp) return;

    try {
      setLoading(true);
      await merchantGatewayService.addIpWhitelist({
        merchantId,
        ipAddress: cleanIp,
        description: description.trim() || undefined,
      });
      setIpAddress('');
      setDescription('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add IP address');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await merchantGatewayService.deleteIpWhitelist(id);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to remove IP:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-black text-slate-900">IP Whitelist Security</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Restricts API payout calls to only originating from authorized servers or IP addresses
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Add IP Form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          required
          placeholder="e.g. 192.168.1.1 or 35.180.20.10"
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
        <input
          type="text"
          placeholder="Server label (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="sm:w-48 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add IP</span>
        </button>
      </form>

      {/* Whitelist items */}
      {whitelist.length === 0 ? (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-[11px] text-amber-800">
          <strong>Notice:</strong> No IP whitelist configured. For production security, restrict API requests to your production server IP addresses.
        </div>
      ) : (
        <div className="space-y-2">
          {whitelist.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="text-xs font-mono font-bold text-slate-800">{item.ip_address}</span>
                  {item.description && (
                    <span className="text-[11px] text-slate-400 ml-2 font-normal">
                      ({item.description})
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(item.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Remove IP"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
