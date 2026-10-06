import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  UserPlus,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Loader2,
  Sparkles,
  FileText,
  Key,
  Eye,
} from 'lucide-react';
import { TelegramBot } from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { FeatureLockOverlay } from '../gating/FeatureLockOverlay';
import { hasBotFeature, BOT_PLANS, BotPlanPrice } from '../../../utils/botFeatureEntitlements';

interface BotAdminControlsProps {
  bot: TelegramBot;
  planPrice: number;
  onOpenPlanComparison: () => void;
}

export interface BotAdminRecord {
  id: string;
  bot_id: string;
  email: string;
  role: 'ADMIN' | 'MODERATOR' | 'ANALYST';
  permissions: string[];
  created_at: string;
}

export const BotAdminControls: React.FC<BotAdminControlsProps> = ({
  bot,
  planPrice,
  onOpenPlanComparison,
}) => {
  const hasMultipleAdmins = hasBotFeature(planPrice, 'bot.multiple_admins');
  const hasAuditLogs = hasBotFeature(planPrice, 'bot.audit_logs');
  const plan = BOT_PLANS[planPrice as BotPlanPrice] || BOT_PLANS[99];

  const [admins, setAdmins] = useState<BotAdminRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ADMINS' | 'AUDIT'>('ADMINS');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invite Admin Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MODERATOR' | 'ANALYST'>('MODERATOR');
  const [permissions, setPermissions] = useState<string[]>(['VIEW_USERS', 'VIEW_ANALYTICS']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!hasMultipleAdmins) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [adminList, logs] = await Promise.all([
        telegramBotService.getBotAdmins(bot.id),
        hasAuditLogs ? telegramBotService.getBotAuditLogs(bot.id, 50) : Promise.resolve([]),
      ]);
      setAdmins(adminList);
      setAuditLogs(logs);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load bot administrative controls');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id, hasMultipleAdmins, hasAuditLogs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If plan is strictly < 499, display plan lock overlay
  if (!hasMultipleAdmins) {
    return (
      <FeatureLockOverlay
        currentPlanPrice={planPrice}
        featureKey="bot.multiple_admins"
        onOpenPlanComparison={onOpenPlanComparison}
      />
    );
  }

  const handleOpenInvite = () => {
    setEmail('');
    setRole('MODERATOR');
    setPermissions(['VIEW_USERS', 'VIEW_ANALYTICS']);
    setFormError(null);
    setIsInviteOpen(true);
  };

  const handleTogglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await telegramBotService.createBotAdmin(bot.id, {
        email: email.trim().toLowerCase(),
        role,
        permissions,
      });

      if (res?.ok) {
        setIsInviteOpen(false);
        loadData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to invite administrator');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!window.confirm('Remove this administrator from this bot?')) return;
    try {
      await telegramBotService.deleteBotAdmin(adminId);
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove admin');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Bot Administration & Staff
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${plan.badgeColor}`}
            >
              {plan.badge}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-based permissions, staff invitations, and operational audit history
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setActiveTab('ADMINS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ADMINS'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'hover:text-slate-900'
              }`}
            >
              Admins ({admins.length}/{plan.limits.maxAdmins})
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'AUDIT'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Logs</span>
            </button>
          </div>

          <button
            onClick={handleOpenInvite}
            disabled={admins.length >= plan.limits.maxAdmins}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Admin</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: ADMINS LIST */}
      {activeTab === 'ADMINS' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
              Loading administrators...
            </div>
          ) : admins.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-xs text-slate-700">No additional staff invited yet</div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Invite co-moderators or analysts to collaborate on managing this bot without sharing root credentials.
              </p>
              <button
                onClick={handleOpenInvite}
                className="mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite First Admin</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {admins.map((adm) => (
                <div
                  key={adm.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 truncate">
                        {adm.email}
                      </span>
                      <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-200">
                        {adm.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      {adm.permissions.map((p) => (
                        <span
                          key={p}
                          className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      Added {new Date(adm.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDeleteAdmin(adm.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div>
          {hasAuditLogs ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Enterprise Staff Audit Stream
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Tamper-Resistant</span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No staff actions recorded in the audit log yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Target</th>
                        <th className="py-3 px-4">Actor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {log.action}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {log.target_type}: {log.target_id || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {log.actor_email || 'Owner'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* LOCKED TEASER FOR ENTERPRISE AUDIT LOGS */
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-xs text-slate-800">
                  Detailed Operational Audit Logs Locked
                </h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                  Detailed system and staff audit logs are exclusively available on Enterprise (₹1,999).
                </p>
              </div>
              <button
                onClick={onOpenPlanComparison}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View Enterprise Plan →
              </button>
            </div>
          )}
        </div>
      )}

      {/* INVITE ADMIN MODAL */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-sky-100 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h4 className="font-black text-sm text-slate-900">Add Staff Member</h4>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Staff Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Role & Responsibility</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MODERATOR">Moderator (Users & Broadcasts)</option>
                  <option value="ANALYST">Analyst (Read-Only Telemetry)</option>
                  <option value="ADMIN">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="font-bold text-slate-700 block">Permissions</label>
                <div className="space-y-1.5">
                  {[
                    { key: 'VIEW_USERS', label: 'View Subscriber Directory' },
                    { key: 'VIEW_ANALYTICS', label: 'View Performance Analytics' },
                    { key: 'MANAGE_BROADCASTS', label: 'Create & Send Broadcasts' },
                    { key: 'MANAGE_COMMANDS', label: 'Manage Commands & Menus' },
                  ].map((p) => (
                    <label
                      key={p.key}
                      className="flex items-center gap-2 font-medium text-slate-600 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={permissions.includes(p.key)}
                        onChange={() => handleTogglePermission(p.key)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold rounded-xl shadow-md shadow-blue-500/20 active:scale-98 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add Member</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
