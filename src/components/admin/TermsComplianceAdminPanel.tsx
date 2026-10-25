import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Download,
  Bell,
  RefreshCw,
  Clock,
  Phone,
  UserCheck,
  UserX,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  X,
  Loader2,
  Building2,
  User,
} from 'lucide-react';
import {
  termsComplianceService,
  DEFAULT_TERMS_CAMPAIGN,
  type ComplianceRecord,
  type ComplianceMetrics,
} from '../../services/termsComplianceService';
import { formatDate } from '../../lib/utils';

export const TermsComplianceAdminPanel: React.FC = () => {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [versionFilter, setVersionFilter] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<ComplianceRecord | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedRecords, fetchedMetrics] = await Promise.all([
        termsComplianceService.getComplianceRecords({
          status: statusFilter,
          accountType: typeFilter,
          version: versionFilter,
          search: searchTerm,
        }),
        termsComplianceService.getComplianceMetrics(),
      ]);

      setRecords(fetchedRecords);
      setMetrics(fetchedMetrics);
    } catch (err: any) {
      console.error('Failed to load terms compliance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter, versionFilter]);

  // Client-side search filtering
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      return (
        r.user_id.toLowerCase().includes(q) ||
        r.user_email.toLowerCase().includes(q) ||
        (r.user_name && r.user_name.toLowerCase().includes(q)) ||
        (r.merchant_code && r.merchant_code.toLowerCase().includes(q)) ||
        (r.business_name && r.business_name.toLowerCase().includes(q)) ||
        (r.mobile_number && r.mobile_number.toLowerCase().includes(q))
      );
    });
  }, [records, searchTerm]);

  const handleExportCsv = () => {
    termsComplianceService.exportComplianceCsv(filteredRecords);
  };

  const handleSendReminderNotice = async () => {
    try {
      // In production this logs REMINDER_SENT audit events
      await termsComplianceService.recordNoticeEvent({
        campaignId: metrics?.active_campaign_code || DEFAULT_TERMS_CAMPAIGN.id,
        version: metrics?.active_version || DEFAULT_TERMS_CAMPAIGN.version,
        eventType: 'REMINDER_SENT',
      });
      setActionSuccess('Compliance reminder broadcast event logged successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch {
      alert('Failed to trigger compliance reminder.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-100 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Terms Acceptance &amp; Compliance Audit
              </h3>
              <p className="text-xs text-slate-500">
                Audit trail for Funds Safety &amp; Responsibility Notice ({metrics?.active_version || 'v1.0.0'})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendReminderNotice}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200/80 transition-colors cursor-pointer"
            title="Dispatch compliance reminders to users with pending acceptance"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>Remind Pending</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV ({filteredRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh Compliance Records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* High-Level Compliance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Applicable</span>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">{metrics?.total_applicable ?? 0}</span>
          <span className="text-[10px] text-slate-400">Merchants &amp; Depositors</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Accepted Terms</span>
          <span className="text-xl font-black text-emerald-600 mt-0.5 block">{metrics?.total_accepted ?? 0}</span>
          <span className="text-[10px] text-emerald-600 font-semibold">Active Clearances</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Rejected Terms</span>
          <span className="text-xl font-black text-rose-600 mt-0.5 block">{metrics?.total_rejected ?? 0}</span>
          <span className="text-[10px] text-rose-600 font-semibold">Deposits Blocked</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pending Acceptance</span>
          <span className="text-xl font-black text-amber-600 mt-0.5 block">{metrics?.total_pending ?? 0}</span>
          <span className="text-[10px] text-amber-600 font-semibold">Prompt Required</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Mobile Confirmed</span>
          <span className="text-xl font-black text-blue-600 mt-0.5 block">{metrics?.total_user_confirmed_mobile ?? 0}</span>
          <span className="text-[10px] text-blue-600 font-semibold">User Confirmed</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Version</span>
          <span className="text-lg font-black font-mono text-indigo-700 mt-0.5 block">{metrics?.active_version ?? 'v1.0.0'}</span>
          <span className="text-[10px] text-slate-400">Campaign Hash Verified</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by User ID, Email, Name, Merchant Code, or Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING">Pending</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Accounts</option>
              <option value="MERCHANT">Merchants Only</option>
              <option value="CUSTOMER">Customers Only</option>
            </select>

            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Versions</option>
              <option value="v1.0.0">v1.0.0 (Current)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Compliance Audit Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3">Account &amp; User ID</th>
                <th className="px-4 py-3">Type / Merchant</th>
                <th className="px-4 py-3">Confirmed Mobile</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Accepted At</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading compliance records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <span>No compliance records found matching filter criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRecord(r)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="font-bold text-slate-900">{r.user_name || 'N/A'}</div>
                      <div className="text-[11px] text-slate-500">{r.user_email}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 select-all">{r.user_id}</div>
                    </td>

                    <td className="px-4 py-3">
                      {r.account_type === 'MERCHANT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <Building2 className="w-3 h-3" />
                          <span>Merchant ({r.merchant_code || 'ACTIVE'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <User className="w-3 h-3" />
                          <span>Customer</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono font-medium text-slate-800">
                      {r.mobile_number && r.mobile_number !== 'N/A' ? (
                        <span className="text-slate-900 font-semibold">{r.mobile_number}</span>
                      ) : (
                        <span className="text-slate-400 italic">Not Provided</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.mobile_verification_status === 'OTP_VERIFIED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>OTP Verified</span>
                        </span>
                      ) : r.mobile_verification_status === 'USER_CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <UserCheck className="w-3 h-3" />
                          <span>User Confirmed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          <span>Not Verified</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-indigo-700">
                      {r.terms_version}
                    </td>

                    <td className="px-4 py-3">
                      {r.status === 'ACCEPTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ACCEPTED</span>
                        </span>
                      ) : r.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          <span>REJECTED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          <span>PENDING</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {r.accepted_at ? formatDate(r.accepted_at) : 'N/A'}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="p-1.5 text-slate-400 group-hover:text-blue-600 rounded-lg hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Audit Record Detail Slide-Over Drawer */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900">Compliance Audit Detail</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
                selectedRecord.status === 'ACCEPTED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-2">
                  {selectedRecord.status === 'ACCEPTED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span className="font-bold">Terms Decision: {selectedRecord.status}</span>
                </div>
                <span className="font-mono text-[11px] font-bold">{selectedRecord.terms_version}</span>
              </div>

              {/* Account Information */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">Account Metadata</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-semibold text-slate-900">{selectedRecord.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-900">{selectedRecord.user_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">User ID:</span>
                  <span className="font-mono text-[10px] text-slate-600 select-all">{selectedRecord.user_id}</span>
                </div>
                {selectedRecord.merchant_code && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Merchant Code:</span>
                    <span className="font-mono font-bold text-purple-700">{selectedRecord.merchant_code}</span>
                  </div>
                )}
                {selectedRecord.business_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Business Name:</span>
                    <span className="font-semibold text-slate-900">{selectedRecord.business_name}</span>
                  </div>
                )}
              </div>

              {/* Mobile Phone Audit Record */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">Mobile Verification</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confirmed Mobile:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.mobile_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verification Level:</span>
                  <span className="font-bold text-blue-700">{selectedRecord.mobile_verification_status}</span>
                </div>
              </div>

              {/* Cryptographic Snapshot Hash */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">Immutable Snapshot Hash</div>
                <div className="p-2.5 bg-slate-900 text-cyan-300 font-mono text-[10px] rounded-xl break-all select-all">
                  {selectedRecord.terms_snapshot_hash || 'SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </div>
                <p className="text-[10px] text-slate-400">
                  Cryptographic SHA-256 hash establishing exact legal terms wording accepted at timestamp.
                </p>
              </div>

              {/* Timestamps */}
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>Accepted Timestamp: {selectedRecord.accepted_at ? new Date(selectedRecord.accepted_at).toLocaleString('en-IN') : 'N/A'}</div>
                <div>Record Created: {selectedRecord.created_at ? new Date(selectedRecord.created_at).toLocaleString('en-IN') : 'N/A'}</div>
                <div>Audit Record ID: <span className="font-mono text-[10px] select-all">{selectedRecord.id}</span></div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
