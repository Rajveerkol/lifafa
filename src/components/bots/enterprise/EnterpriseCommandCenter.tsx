import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  GitFork,
  Play,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Sliders,
  Webhook,
  Bell,
  FileText,
  Shield,
  Eye,
  Lock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Terminal,
  Activity,
  Layers,
  ArrowRight,
  RefreshCw,
  Check,
  X,
  Share2,
} from 'lucide-react';
import {
  TelegramBot,
  WorkflowJob,
  BotNotificationRule,
  BotScheduledReport,
  BotIntegration,
  EnterpriseCommandCenterMetrics,
  BotWorkflow,
  WorkflowNode,
  WorkflowEdge,
} from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';
import { FeatureLockOverlay } from '../gating/FeatureLockOverlay';
import { BOT_PLANS, BotPlanPrice, hasBotFeature } from '../../../utils/botFeatureEntitlements';

interface EnterpriseCommandCenterProps {
  bot: TelegramBot;
  planPrice: number;
  onOpenPlanComparison: () => void;
}

export const EnterpriseCommandCenter: React.FC<EnterpriseCommandCenterProps> = ({
  bot,
  planPrice,
  onOpenPlanComparison,
}) => {
  // Plan check
  const isEnterprise = hasBotFeature(planPrice, 'bot.enterprise_automation');

  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'journeys' | 'jobs' | 'integrations' | 'notifications' | 'reports' | 'audit'
  >('overview');

  const [metrics, setMetrics] = useState<EnterpriseCommandCenterMetrics>({
    is_entitled: isEnterprise,
    plan_price: planPrice,
    total_workflows: 0,
    active_workflows: 0,
    executions_today: 0,
    successful_executions: 0,
    failed_executions: 0,
    queued_jobs: 0,
    automation_success_rate: 100,
    integrations_count: 0,
    audit_events_count: 0,
  });

  const [journeys, setJourneys] = useState<BotWorkflow[]>([]);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [integrations, setIntegrations] = useState<BotIntegration[]>([]);
  const [notificationRules, setNotificationRules] = useState<BotNotificationRule[]>([]);
  const [reports, setReports] = useState<BotScheduledReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Journey Builder Modal State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [journeyName, setJourneyName] = useState('');
  const [journeyDescription, setJourneyDescription] = useState('');
  const [journeyTrigger, setJourneyTrigger] = useState('USER_STARTED_BOT');
  const [journeyNodes, setJourneyNodes] = useState<WorkflowNode[]>([
    {
      node_key: 'trigger_1',
      node_type: 'TRIGGER',
      title: 'Bot /start Trigger',
      config: { trigger: 'USER_STARTED_BOT' },
    },
    {
      node_key: 'condition_1',
      node_type: 'CONDITION',
      title: 'Check Referral Count',
      config: { condition_type: 'REFERRAL_COUNT_GTE', target_value: 5 },
    },
    {
      node_key: 'action_1',
      node_type: 'ACTION',
      title: 'Send VIP Welcome Message',
      config: { action: 'SEND_MESSAGE', text: 'Welcome {{first_name}}! You are a VIP referrer with {{referral_count}} invites!' },
    },
  ]);
  const [journeyEdges, setJourneyEdges] = useState<WorkflowEdge[]>([
    { source_node_key: 'trigger_1', target_node_key: 'condition_1', condition_branch: 'DEFAULT' },
    { source_node_key: 'condition_1', target_node_key: 'action_1', condition_branch: 'YES' },
  ]);

  // Integration Modal State
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [intName, setIntName] = useState('');
  const [intUrl, setIntUrl] = useState('https://');
  const [intMethod, setIntMethod] = useState<'POST' | 'PUT'>('POST');
  const [intEvents, setIntEvents] = useState<string[]>(['USER_REGISTERED', 'REFERRAL_CREATED']);
  const [intSecret, setIntSecret] = useState('');

  // Notification Rule Modal State
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notifName, setNotifName] = useState('');
  const [notifType, setNotifType] = useState<any>('AUTOMATION_FAILURE');
  const [notifChannel, setNotifChannel] = useState<any>('TELEGRAM_ADMIN');
  const [notifRecipient, setNotifRecipient] = useState('');
  const [notifTemplate, setNotifTemplate] = useState('Alert: Automation step failed for user {{telegram_id}}');

  // Load all Enterprise data
  const loadEnterpriseData = useCallback(async () => {
    if (!isEnterprise) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [m, j, jb, ig, nr, rp, al] = await Promise.all([
        telegramBotService.getEnterpriseMetrics(bot.id),
        telegramBotService.getEnterpriseJourneys(bot.id),
        telegramBotService.getWorkflowJobs(bot.id, 25),
        telegramBotService.getBotIntegrations(bot.id),
        telegramBotService.getNotificationRules(bot.id),
        telegramBotService.getScheduledReports(bot.id),
        telegramBotService.getBotAuditLogs(bot.id, 20),
      ]);

      setMetrics(m);
      setJourneys(j);
      setJobs(jb);
      setIntegrations(ig);
      setNotificationRules(nr);
      setReports(rp);
      setAuditLogs(al);
    } catch (err: any) {
      console.warn('Enterprise data fetch warning:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [bot.id, isEnterprise]);

  useEffect(() => {
    loadEnterpriseData();
  }, [loadEnterpriseData]);

  // Trigger Immediate Worker Run
  const handleTriggerQueue = async () => {
    setIsProcessingQueue(true);
    setActionNotice(null);
    try {
      const res = await telegramBotService.triggerWorkflowWorker(bot.id);
      if (res.success) {
        setActionNotice(`Worker processed ${res.processed} pending jobs successfully`);
        loadEnterpriseData();
      } else {
        setActionNotice(res.error || 'Worker processed queue with notice');
      }
    } catch (err: any) {
      setActionNotice(err.message || 'Worker execution failed');
    } finally {
      setIsProcessingQueue(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // Save Journey
  const handleSaveJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journeyName.trim()) return;

    try {
      await telegramBotService.saveEnterpriseJourney(bot.id, {
        name: journeyName,
        description: journeyDescription,
        triggerType: journeyTrigger,
        triggerValue: 'EVENT_START',
        nodes: journeyNodes,
        edges: journeyEdges,
      });

      setIsBuilderOpen(false);
      setJourneyName('');
      setJourneyDescription('');
      loadEnterpriseData();
    } catch (err: any) {
      alert(err.message || 'Failed to save workflow journey');
    }
  };

  // Save Integration
  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intUrl.startsWith('https://')) {
      alert('Destination URL must start with https:// for security');
      return;
    }

    try {
      await telegramBotService.saveBotIntegration(bot.id, {
        name: intName,
        url: intUrl,
        http_method: intMethod,
        event_types: intEvents,
        secret_token: intSecret,
      });

      setIsIntegrationModalOpen(false);
      setIntName('');
      setIntUrl('https://');
      loadEnterpriseData();
    } catch (err: any) {
      alert(err.message || 'Failed to save integration');
    }
  };

  // Test Integration
  const handleTestIntegration = async (id: string) => {
    try {
      const res = await telegramBotService.testBotIntegration(bot.id, id);
      if (res.success) {
        alert(`Integration ping successful! Status: ${res.status_code} in ${res.duration_ms}ms`);
      } else {
        alert(`Integration ping test completed: ${JSON.stringify(res)}`);
      }
      loadEnterpriseData();
    } catch (err: any) {
      alert(`Test dispatch error: ${err.message}`);
    }
  };

  // Trigger Report
  const handleTriggerReport = async (reportType: string) => {
    try {
      const res = await telegramBotService.triggerGenerateReport(bot.id, reportType);
      alert(`Report generated snapshot: ${JSON.stringify(res)}`);
      loadEnterpriseData();
    } catch (err: any) {
      alert(`Report generation notice: ${err.message}`);
    }
  };

  // If user is on a non-Enterprise bot (< ₹1,999), show feature lock screen
  if (!isEnterprise) {
    return (
      <FeatureLockOverlay
        currentPlanPrice={planPrice}
        featureKey="bot.enterprise_automation"
        onOpenPlanComparison={onOpenPlanComparison}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Enterprise Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider border border-white/30 text-amber-100 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              <span>Enterprise Automation Command Center</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Autonomous Subscriber Journeys & Queue Engine
            </h2>
            <p className="text-xs text-amber-100 max-w-xl leading-relaxed">
              Multi-step visual flows, server-side delayed jobs, anti-loop rate guards, outbound webhook integrations, and tamper-resistant audit trail.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerQueue}
              disabled={isProcessingQueue}
              className="bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 text-amber-700 ${isProcessingQueue ? 'animate-spin' : ''}`} />
              <span>{isProcessingQueue ? 'Processing Queue...' : 'Trigger Worker Run'}</span>
            </button>

            <button
              onClick={() => setIsBuilderOpen(true)}
              className="bg-black/30 hover:bg-black/40 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl border border-white/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Journey</span>
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="mt-4 p-3 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold border border-white/30 text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-yellow-300 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* REAL TELEMETRY METRICS ROW (ZERO FAKE DATA) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Workflows</span>
            <GitFork className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{metrics.total_workflows}</div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">{metrics.active_workflows} active</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Executions Today</span>
            <Activity className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{metrics.executions_today}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">Real jobs run</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Success Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600">{metrics.automation_success_rate}%</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">{metrics.successful_executions} completed</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Queued / Waiting</span>
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="text-xl font-black text-cyan-600">{metrics.queued_jobs}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">Pending scheduler</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Webhooks</span>
            <Webhook className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-black text-purple-600">{metrics.integrations_count}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">Outbound endpoints</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Audit Records</span>
            <Shield className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-black text-slate-900">{metrics.audit_events_count}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">Immutable events</div>
        </div>
      </div>

      {/* Enterprise Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'overview' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('journeys')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'journeys' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Visual Journeys ({journeys.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('jobs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'jobs' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Queue & Job Telemetry ({jobs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('integrations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'integrations' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Webhook className="w-3.5 h-3.5" />
          <span>Webhooks & API ({integrations.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('notifications')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'notifications' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notification Engine ({notificationRules.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('reports')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'reports' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Automated Reports ({reports.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'audit' ? 'bg-white text-amber-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Enterprise Audit Trail</span>
        </button>
      </div>

      {/* SUB-TAB 1: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <GitFork className="w-4 h-4 text-amber-600" />
                <span>Active Automation Journeys</span>
              </h3>
              {journeys.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No automation journeys created yet. Click "Create Journey" to design your first subscriber flow.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {journeys.slice(0, 5).map((j) => (
                    <div key={j.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{j.name}</div>
                        <div className="text-[11px] text-slate-400">Trigger: {j.trigger_type}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${j.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {j.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">Supported Enterprise Triggers</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {['USER_STARTED_BOT', 'REFERRAL_COMPLETED', 'BUTTON_CLICKED', 'USER_INACTIVE', 'CAMPAIGN_EVENT', 'TAG_ADDED', 'SCHEDULED_TIME', 'CUSTOM_WEBHOOK'].map((t) => (
                  <div key={t} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-[10px] text-slate-700">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Variables Reference Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                <span>Safe Personalization Tokens</span>
              </h3>
              <p className="text-xs text-slate-500">
                These variables are dynamically resolved server-side without evaluating arbitrary user code:
              </p>
              <div className="space-y-2 text-xs font-mono">
                {[
                  { tag: '{{first_name}}', desc: "Subscriber's first name" },
                  { tag: '{{username}}', desc: 'Telegram @handle' },
                  { tag: '{{telegram_id}}', desc: 'Unique numeric Telegram ID' },
                  { tag: '{{bot_name}}', desc: 'Display name of this bot' },
                  { tag: '{{referral_count}}', desc: 'Verified referrals achieved' },
                  { tag: '{{campaign_name}}', desc: 'Active promotion name' },
                ].map((v) => (
                  <div key={v.tag} className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-blue-600">{v.tag}</span>
                    <span className="text-[10px] text-slate-400 font-sans">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: JOURNEYS LIST & BUILDER */}
      {activeSubTab === 'journeys' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900">Custom Automation Journeys</h3>
            <button
              onClick={() => setIsBuilderOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Visual Journey</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {journeys.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No journeys configured. Build custom multi-step automation journeys above.
              </div>
            ) : (
              journeys.map((j) => (
                <div key={j.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{j.name}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${j.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {j.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {j.description && <p className="text-xs text-slate-500">{j.description}</p>}
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Trigger: <b>{j.trigger_type}</b></span>
                      <span>Action: <b>{j.action_type}</b></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await telegramBotService.toggleEnterpriseJourney(j.id, !j.enabled);
                        loadEnterpriseData();
                      }}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50"
                    >
                      {j.enabled ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete workflow "${j.name}"?`)) {
                          await telegramBotService.deleteEnterpriseJourney(j.id);
                          loadEnterpriseData();
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      title="Delete Journey"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: JOBS TELEMETRY */}
      {activeSubTab === 'jobs' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900">Live Workflow Execution Queue</h3>
            <button
              onClick={loadEnterpriseData}
              className="p-1.5 text-slate-400 hover:text-slate-600"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Step</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Scheduled</th>
                  <th className="py-3 px-4">Last Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                      No jobs currently queued. Real executions will appear here.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono text-[10px] font-bold text-slate-700">
                        {job.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {job.workflow?.name || 'Automation Journey'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">#{job.step_index}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.status === 'FAILED'
                            ? 'bg-red-50 text-red-700'
                            : job.status === 'WAITING'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{job.attempt_count}/{job.max_retries}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-mono text-[11px] truncate max-w-xs">
                        {job.last_error || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: WEBHOOKS & API */}
      {activeSubTab === 'integrations' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Outbound Webhook Integrations</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatch verified subscriber events to external HTTPS endpoints with HMAC signatures.
              </p>
            </div>
            <button
              onClick={() => setIsIntegrationModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Endpoint</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {integrations.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No outbound webhooks configured. Add your first HTTPS endpoint above.
              </div>
            ) : (
              integrations.map((ig) => (
                <div key={ig.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-xs">{ig.name}</span>
                      <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        {ig.http_method}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-blue-600 truncate max-w-md">{ig.url}</div>
                    <div className="text-[10px] text-slate-400">Events: {ig.event_types.join(', ')}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestIntegration(ig.id)}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors"
                    >
                      Test Dispatch
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete integration "${ig.name}"?`)) {
                          await telegramBotService.deleteBotIntegration(ig.id);
                          loadEnterpriseData();
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: NOTIFICATIONS */}
      {activeSubTab === 'notifications' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900">Notification Rules</h3>
            <button
              onClick={() => setIsNotificationModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Alert Rule</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {notificationRules.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No notification rules configured. Add failure, rate limit, or fraud notification rules.
              </div>
            ) : (
              notificationRules.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{r.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Event: <b>{r.event_type}</b> • Channel: <b>{r.channel}</b>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await telegramBotService.deleteNotificationRule(r.id);
                      loadEnterpriseData();
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: SCHEDULED REPORTS */}
      {activeSubTab === 'reports' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Automated Intelligence Reports</h3>
          <p className="text-xs text-slate-500">
            Generate and schedule comprehensive audit digests derived from verified database telemetry.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { type: 'DAILY_SUMMARY', title: 'Daily Bot Digest', desc: 'New users, messages, broadcasts delivery summary.' },
              { type: 'WEEKLY_GROWTH', title: 'Weekly Growth Report', desc: 'Subscriber retention, campaign conversions, referral winners.' },
              { type: 'REFERRALS_AUDIT', title: 'Referral Milestones Audit', desc: 'Fraud verification and reward eligibility summary.' },
            ].map((rep) => (
              <div key={rep.type} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800">{rep.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">{rep.desc}</p>
                </div>
                <button
                  onClick={() => handleTriggerReport(rep.type)}
                  className="w-full bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] py-2 px-3 rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Generate Snapshot</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 7: AUDIT LOGS */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900">Enterprise Operational Audit Trail</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only tamper-resistant log of system actions, workflow updates, and security events.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {auditLogs.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No audit events recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50 flex items-start justify-between text-xs gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Target: {log.target_type} ({log.target_id || 'system'})
                      </span>
                    </div>
                    {log.details && (
                      <pre className="text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-x-auto max-w-xl">
                        {JSON.stringify(log.details)}
                      </pre>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CREATE JOURNEY MODAL */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GitFork className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-base text-slate-900">Design Autonomous Journey</h3>
              </div>
              <button onClick={() => setIsBuilderOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJourney} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Journey Name</label>
                <input
                  type="text"
                  required
                  value={journeyName}
                  onChange={(e) => setJourneyName(e.target.value)}
                  placeholder="e.g. VIP Subscriber Onboarding Funnel"
                  className="w-full py-2.5 px-3.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={journeyDescription}
                  onChange={(e) => setJourneyDescription(e.target.value)}
                  placeholder="e.g. Checks referral milestones and sends rewards"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Event Trigger</label>
                <select
                  value={journeyTrigger}
                  onChange={(e) => setJourneyTrigger(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                >
                  <option value="USER_STARTED_BOT">USER_STARTED_BOT (User sends /start)</option>
                  <option value="USER_REGISTERED">USER_REGISTERED (First-time subscriber)</option>
                  <option value="REFERRAL_COMPLETED">REFERRAL_COMPLETED (Qualified invite)</option>
                  <option value="BUTTON_CLICKED">BUTTON_CLICKED (Interactive menu callback)</option>
                  <option value="TAG_ADDED">TAG_ADDED (Subscriber tagged)</option>
                  <option value="USER_INACTIVE">USER_INACTIVE (Inactivity check)</option>
                </select>
              </div>

              {/* Journey Step Flow Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block">Journey Pipeline Flow Preview</label>
                <div className="space-y-2">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                    <span className="font-bold text-amber-800">1. Trigger: {journeyTrigger}</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded text-amber-700 font-bold">ENTRY</span>
                  </div>
                  <div className="text-center text-slate-300">↓</div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                    <span className="font-bold text-blue-800">2. Condition: Referral Milestone & Tag Validation</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded text-blue-700 font-bold">IF / ELSE</span>
                  </div>
                  <div className="text-center text-slate-300">↓</div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span className="font-bold text-emerald-800">3. Action: Personalize & Send Telegram Notification</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded text-emerald-700 font-bold">ACTION</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm"
                >
                  Save & Deploy Journey
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE WEBHOOK INTEGRATION MODAL */}
      {isIntegrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900">Add Outbound HTTPS Webhook</h3>
              <button onClick={() => setIsIntegrationModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIntegration} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Integration Name</label>
                <input
                  type="text"
                  required
                  value={intName}
                  onChange={(e) => setIntName(e.target.value)}
                  placeholder="e.g. CRM Sync Webhook"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Destination URL (HTTPS Only)</label>
                <input
                  type="url"
                  required
                  value={intUrl}
                  onChange={(e) => setIntUrl(e.target.value)}
                  placeholder="https://your-crm.com/api/telegram-webhook"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Secret Token (Optional Signature)</label>
                <input
                  type="password"
                  value={intSecret}
                  onChange={(e) => setIntSecret(e.target.value)}
                  placeholder="Shared secret for header verification"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsIntegrationModalOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold shadow-sm"
                >
                  Save Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NOTIFICATION MODAL */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900">Add Notification Rule</h3>
              <button onClick={() => setIsNotificationModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await telegramBotService.saveNotificationRule(bot.id, {
                  name: notifName,
                  event_type: notifType,
                  channel: notifChannel,
                  target_recipient: notifRecipient,
                  template: notifTemplate,
                });
                setIsNotificationModalOpen(false);
                setNotifName('');
                setNotifRecipient('');
                loadEnterpriseData();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={notifName}
                  onChange={(e) => setNotifName(e.target.value)}
                  placeholder="e.g. Alert Admin on Rate Limits"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Alert Event Type</label>
                <select
                  value={notifType}
                  onChange={(e) => setNotifType(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-bold"
                >
                  <option value="AUTOMATION_FAILURE">AUTOMATION_FAILURE (Step error)</option>
                  <option value="TELEGRAM_RATE_LIMIT">TELEGRAM_RATE_LIMIT (429 warning)</option>
                  <option value="FRAUD_DETECTED">FRAUD_DETECTED (Suspicious duplicate)</option>
                  <option value="DAILY_REPORT">DAILY_REPORT (Summary digest)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Recipient (Chat ID or Channel)</label>
                <input
                  type="text"
                  required
                  value={notifRecipient}
                  onChange={(e) => setNotifRecipient(e.target.value)}
                  placeholder="e.g. 123456789 or @admin_channel"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl outline-none font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNotificationModalOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm"
                >
                  Save Alert Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
