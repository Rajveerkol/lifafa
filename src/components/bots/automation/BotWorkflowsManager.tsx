import React, { useState, useEffect, useCallback } from 'react';
import {
  GitFork,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  X,
  History,
  Activity,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  TelegramBot,
  BotWorkflow,
  BotWorkflowInput,
  BotAutomationExecution,
  WorkflowTriggerType,
  WorkflowActionType,
} from '../../../types/telegramBot';
import { telegramBotService } from '../../../services/telegramBotService';

interface BotWorkflowsManagerProps {
  bot: TelegramBot;
}

const TRIGGER_TYPE_OPTIONS: { value: WorkflowTriggerType; label: string; desc: string }[] = [
  { value: 'NEW_USER', label: 'New User Joins', desc: 'When a new Telegram user sends their first message' },
  { value: 'COMMAND', label: 'Command Invocation', desc: 'When user sends specific /command' },
  { value: 'BUTTON_CLICK', label: 'Inline Button Callback', desc: 'When user presses an inline button' },
  { value: 'KEYWORD', label: 'Keyword Trigger', desc: 'When user message contains specified keyword' },
];

const ACTION_TYPE_OPTIONS: { value: WorkflowActionType; label: string; desc: string }[] = [
  { value: 'SHOW_MENU', label: 'Display Main Menu', desc: 'Sends the interactive main menu to user' },
  { value: 'SEND_MESSAGE', label: 'Send Custom Message', desc: 'Sends an automated text response' },
  { value: 'RUN_COMMAND', label: 'Execute Command', desc: 'Routes to an existing custom command' },
];

export const BotWorkflowsManager: React.FC<BotWorkflowsManagerProps> = ({ bot }) => {
  const [workflows, setWorkflows] = useState<BotWorkflow[]>([]);
  const [executions, setExecutions] = useState<BotAutomationExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab: Workflows vs Audit Log
  const [activeTab, setActiveTab] = useState<'WORKFLOWS' | 'AUDIT_LOG'>('WORKFLOWS');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>('NEW_USER');
  const [triggerValue, setTriggerValue] = useState('*');
  const [actionType, setActionType] = useState<WorkflowActionType>('SHOW_MENU');
  const [actionMessage, setActionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [wfList, execList] = await Promise.all([
        telegramBotService.getBotWorkflows(bot.id),
        telegramBotService.getBotAutomationExecutions(bot.id, 50),
      ]);
      setWorkflows(wfList);
      setExecutions(execList);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load workflows & automation logs');
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    loadData();
    const unsubWf = telegramBotService.subscribeToBotWorkflows(bot.id, () => loadData());
    const unsubExec = telegramBotService.subscribeToBotExecutions(bot.id, () => loadData());
    return () => {
      unsubWf();
      unsubExec();
    };
  }, [loadData, bot.id]);

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setTriggerType('NEW_USER');
    setTriggerValue('*');
    setActionType('SHOW_MENU');
    setActionMessage('Welcome to our community! Please choose an option:');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this automation workflow?')) return;
    try {
      await telegramBotService.deleteBotWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete workflow');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Workflow name is required');
      return;
    }

    if (!triggerValue.trim()) {
      setFormError('Trigger value is required (use * for all)');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: BotWorkflowInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: triggerType,
        trigger_value: triggerValue.trim(),
        action_type: actionType,
        action_payload:
          actionType === 'SEND_MESSAGE'
            ? { text: actionMessage.trim() }
            : actionType === 'RUN_COMMAND'
            ? { command: triggerValue.trim() }
            : {},
        enabled: true,
      };

      const created = await telegramBotService.createBotWorkflow(bot.id, input);
      setWorkflows((prev) => [created, ...prev]);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <GitFork className="w-5 h-5 text-blue-600" />
            <span>Automations & Workflow Engine</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Event triggers, multi-step actions, and real-time execution audit logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setActiveTab('WORKFLOWS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'WORKFLOWS'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'hover:text-slate-900'
              }`}
            >
              Workflows ({workflows.length})
            </button>
            <button
              onClick={() => setActiveTab('AUDIT_LOG')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'AUDIT_LOG'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit Log ({executions.length})</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Workflow</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab: Workflows */}
      {activeTab === 'WORKFLOWS' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
              Loading automation workflows...
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
              <GitFork className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-xs text-slate-700">No automation workflows configured</div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Trigger actions automatically on events like new member registration, button clicks, or custom commands.
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workflow</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{wf.name}</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
                        Active
                      </span>
                    </div>

                    {wf.description && (
                      <p className="text-xs text-slate-500 font-medium">{wf.description}</p>
                    )}

                    {/* Trigger -> Action Flow Visual */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Trigger</span>
                        <span className="font-mono font-bold text-blue-700 truncate block">
                          {wf.trigger_type} ({wf.trigger_value})
                        </span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                      <div className="space-y-0.5 min-w-0 text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Action</span>
                        <span className="font-mono font-bold text-cyan-700 truncate block">
                          {wf.action_type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      Created {new Date(wf.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit Log */}
      {activeTab === 'AUDIT_LOG' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">
                Recent Automation Executions ({executions.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Live updates recorded from Telegram webhook events
            </span>
          </div>

          {executions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-1">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-bold text-slate-700">No automation executions recorded yet</div>
              <p className="text-[11px] text-slate-400">
                Executions are recorded in real time whenever commands, menus, or auto-replies trigger from Telegram updates.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/70">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Telegram User</th>
                    <th className="py-3 px-4">Trigger</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {executions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(exec.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {exec.telegram_user_id ? (
                          <span className="text-blue-600 font-semibold">User #{exec.telegram_user_id}</span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-[11px] font-bold border border-blue-100">
                          {exec.trigger_type}
                          {exec.trigger_value ? ` (${exec.trigger_value})` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-800">
                        {exec.action_type}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {exec.execution_status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Success
                          </span>
                        ) : exec.execution_status === 'FAILED' ? (
                          <span
                            className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-red-200"
                            title={exec.error_message || 'Execution failed'}
                          >
                            <ShieldAlert className="w-3 h-3 text-red-600" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            Skipped
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE WORKFLOW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl border border-sky-100 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GitFork className="w-5 h-5 text-cyan-200" />
                <h3 className="font-extrabold text-base tracking-tight">Create Automation Workflow</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Workflow Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome Onboarding"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sends main menu when new user starts the bot"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Trigger Event</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TRIGGER_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Trigger Parameter (Use * for any)
                </label>
                <input
                  type="text"
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  placeholder="*"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Action to Perform</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTION_TYPE_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {actionType === 'SEND_MESSAGE' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Message Text</label>
                  <textarea
                    rows={3}
                    value={actionMessage}
                    onChange={(e) => setActionMessage(e.target.value)}
                    placeholder="Message to deliver..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-98 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Create Workflow</span>
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
