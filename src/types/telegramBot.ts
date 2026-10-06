// Type definitions for Telegram Bot Automation (Phase 1, Phase 2, & Phase 3)
// REAL DATA ONLY — Mirrors Supabase Schema and Telegram API responses

export type BotSlotStatus = 'AVAILABLE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface BotSlot {
  id: string;
  user_id: string;
  plan_price: number;
  plan_name: string;
  status: BotSlotStatus;
  created_at: string;
  updated_at: string;
}

export type BotConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED' | 'ERROR';
export type BotWebhookStatus = 'ACTIVE' | 'PENDING' | 'FAILED' | 'REMOVED';
export type BotLifecycleStatus = 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface TelegramBot {
  id: string;
  user_id: string;
  bot_slot_id: string;
  telegram_bot_id: number;
  telegram_username: string;
  telegram_display_name: string;
  telegram_first_name: string;
  telegram_can_join_groups: boolean;
  telegram_can_read_all_group_messages: boolean;
  status: BotLifecycleStatus;
  connection_status: BotConnectionStatus;
  webhook_status: BotWebhookStatus;
  webhook_url: string;
  last_verified_at: string;
  last_webhook_event_at: string | null;
  connected_at: string;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
  plan_price?: number;
  plan_name?: string;
  bot_slot?: {
    id: string;
    plan_price: number;
    plan_name: string;
    status: string;
  };
}

export type TelegramBotEventType =
  | 'BOT_CONNECT_ATTEMPT'
  | 'BOT_VERIFIED'
  | 'BOT_WEBHOOK_SET'
  | 'BOT_CONNECTION_FAILED'
  | 'BOT_DISCONNECT_ATTEMPT'
  | 'BOT_DISCONNECTED'
  | 'BOT_WEBHOOK_FAILED'
  | 'WEBHOOK_UPDATE';

export interface TelegramBotEvent {
  id: string;
  bot_id: string;
  event_type: TelegramBotEventType;
  telegram_update_id: number | null;
  raw_payload: Record<string, any>;
  created_at: string;
}

// ==============================================================================
// PHASE 2: REAL BOT USERS & WEBHOOK UPDATE ENGINE TYPES
// ==============================================================================

export type BotUserStatus = 'ACTIVE' | 'BLOCKED' | 'INACTIVE';

export interface BotUser {
  id: string;
  bot_id: string;
  telegram_bot_id: number;
  telegram_user_id: number;
  telegram_chat_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_bot: boolean;
  is_premium: boolean;
  first_seen_at: string;
  last_seen_at: string;
  last_message_at: string | null;
  start_count: number;
  start_param: string | null;
  status: BotUserStatus;
  created_at: string;
  updated_at: string;
}

export type BotEventProcessingStatus = 'PROCESSED' | 'IGNORED' | 'FAILED';

export interface BotEvent {
  id: string;
  bot_id: string;
  telegram_bot_id: number;
  update_id: number;
  event_type: string;
  telegram_user_id: number | null;
  telegram_chat_id: number | null;
  received_at: string;
  processed_at: string;
  processing_status: BotEventProcessingStatus;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BotUserStats {
  total_users: number;
  new_users_today: number;
  active_users_24h: number;
  messages_today: number;
  new_users_this_week: number;
}

export interface BotUserFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// ==============================================================================
// PHASE 3: COMMANDS, MENUS, AUTO-REPLIES & AUTOMATION TYPES
// ==============================================================================

export type CommandResponseType = 'TEXT' | 'PHOTO' | 'BUTTON_MENU' | 'INLINE_BUTTONS';

export interface BotMenuButton {
  id: string;
  text: string;
  type: 'URL' | 'CALLBACK' | 'COMMAND';
  value: string;
  action_type?: string;
}

export interface BotCommand {
  id: string;
  bot_id: string;
  command: string;
  description: string;
  response_type: CommandResponseType;
  response_text: string;
  buttons: BotMenuButton[][];
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BotCommandInput {
  command: string;
  description: string;
  response_type: CommandResponseType;
  response_text: string;
  buttons?: BotMenuButton[][];
  enabled?: boolean;
  sort_order?: number;
}

export type MenuType = 'INLINE' | 'REPLY_KEYBOARD';

export interface BotMenu {
  id: string;
  bot_id: string;
  title: string;
  message_text: string;
  menu_type: MenuType;
  buttons: BotMenuButton[][];
  is_main_menu: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotMenuInput {
  title: string;
  message_text: string;
  menu_type: MenuType;
  buttons: BotMenuButton[][];
  is_main_menu?: boolean;
}

export type AutoReplyTriggerType = 'EXACT_TEXT' | 'CONTAINS_TEXT' | 'STARTS_WITH' | 'COMMAND';

export interface BotAutoReply {
  id: string;
  bot_id: string;
  name: string;
  trigger_type: AutoReplyTriggerType;
  trigger_value: string;
  response_type: CommandResponseType;
  response_text: string;
  buttons: BotMenuButton[][];
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotAutoReplyInput {
  name: string;
  trigger_type: AutoReplyTriggerType;
  trigger_value: string;
  response_type: CommandResponseType;
  response_text: string;
  buttons?: BotMenuButton[][];
  priority?: number;
  enabled?: boolean;
}

export type WorkflowTriggerType = 'COMMAND' | 'KEYWORD' | 'BUTTON_CLICK' | 'NEW_USER';
export type WorkflowActionType = 'SEND_MESSAGE' | 'SHOW_MENU' | 'RUN_COMMAND';

export interface BotWorkflow {
  id: string;
  bot_id: string;
  name: string;
  description: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_value: string;
  action_type: WorkflowActionType;
  action_payload: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotWorkflowInput {
  name: string;
  description?: string;
  trigger_type: WorkflowTriggerType;
  trigger_value: string;
  action_type: WorkflowActionType;
  action_payload?: Record<string, any>;
  enabled?: boolean;
}

export interface BotAutomationExecution {
  id: string;
  bot_id: string;
  telegram_bot_id: number;
  update_id: number | null;
  telegram_user_id: number | null;
  telegram_chat_id: number | null;
  trigger_type: string;
  trigger_value: string | null;
  action_type: string;
  execution_status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BotPlanTier {
  price: 99 | 299 | 499 | 999 | 1999;
  name: string;
  tagline: string;
  badge?: string;
  features: string[];
}

export const CANONICAL_BOT_PLANS: BotPlanTier[] = [
  {
    price: 99,
    name: 'Starter Bot Slot',
    tagline: 'Ideal for 1 community channel or personal group',
    features: [
      '1 Telegram Bot connection entitlement',
      'Instant BotFather webhook linking',
      'Real-time webhook event monitor',
      'Secure token encryption at rest',
    ],
  },
  {
    price: 299,
    name: 'Growth Bot Slot',
    tagline: 'Growing creators & community managers',
    badge: 'Popular',
    features: [
      '1 Dedicated Bot connection entitlement',
      'High-speed webhook delivery',
      'Live ping & health monitoring',
      'Real-time audit log stream',
    ],
  },
  {
    price: 499,
    name: 'Pro Bot Slot',
    tagline: 'Multi-group channels and high traffic',
    features: [
      '1 Dedicated Bot connection entitlement',
      'Priority webhook queue',
      'Detailed real-time event analytics',
      'Group & channel message listener',
    ],
  },
  {
    price: 999,
    name: 'Business Bot Slot',
    tagline: 'Power organizations & high-volume merchants',
    features: [
      '1 Enterprise-grade bot slot',
      'Ultra low-latency webhook pipe',
      'Full connection health diagnostic',
      'Dedicated audit event tracking',
    ],
  },
  {
    price: 1999,
    name: 'Enterprise Bot Slot',
    tagline: 'Maximum throughput and uptime assurance',
    badge: 'VIP',
    features: [
      '1 Top-tier enterprise slot',
      'Immediate priority webhook routing',
      'Continuous uptime verification',
      '24/7 Priority support & monitoring',
    ],
  },
];

// ==============================================================================
// PHASE 4: BROADCASTS, CAMPAIGNS & REFERRALS TYPES
// ==============================================================================

export type BroadcastStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export type BroadcastAudience =
  | 'ALL_ACTIVE_USERS'
  | 'ACTIVE_24H'
  | 'ACTIVE_7D'
  | 'NEW_USERS'
  | 'CUSTOM_SELECTED_USERS';

export interface BotBroadcast {
  id: string;
  bot_id: string;
  title: string;
  message_text: string;
  photo_url: string | null;
  buttons: BotMenuButton[][];
  target_audience: BroadcastAudience;
  custom_user_ids: string[] | null;
  status: BroadcastStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotBroadcastInput {
  title: string;
  message_text: string;
  photo_url?: string | null;
  buttons?: BotMenuButton[][];
  target_audience: BroadcastAudience;
  custom_user_ids?: string[] | null;
  scheduled_at?: string | null;
}

export interface BotBroadcastRecipient {
  id: string;
  broadcast_id: string;
  bot_id: string;
  bot_user_id: string;
  telegram_user_id: number;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'SKIPPED';
  attempts: number;
  telegram_message_id: number | null;
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export interface BotCampaign {
  id: string;
  bot_id: string;
  name: string;
  description: string | null;
  message_text: string;
  buttons: BotMenuButton[][];
  target_audience: string;
  status: CampaignStatus;
  start_at: string;
  end_at: string;
  total_participants: number;
  created_at: string;
  updated_at: string;
}

export interface BotCampaignInput {
  name: string;
  description?: string;
  message_text: string;
  buttons?: BotMenuButton[][];
  target_audience?: string;
  start_at: string;
  end_at: string;
}

export interface BotCampaignParticipant {
  id: string;
  campaign_id: string;
  bot_id: string;
  bot_user_id: string;
  telegram_user_id: number;
  status: 'JOINED' | 'COMPLETED' | 'DISQUALIFIED';
  metadata: Record<string, any>;
  joined_at: string;
  completed_at: string | null;
}

export interface BotReferralSettings {
  id: string;
  bot_id: string;
  reward_enabled: boolean;
  reward_amount: number;
  reward_currency: string;
  qualification_requirement: 'JOIN_ONLY' | 'ACTIVE_3_DAYS' | 'MANUAL_VERIFY';
  welcome_bonus_amount: number;
  created_at: string;
  updated_at: string;
}

export interface BotReferralCode {
  id: string;
  bot_id: string;
  bot_user_id: string;
  code: string;
  total_clicks: number;
  total_referrals: number;
  total_qualified: number;
  created_at: string;
}

export interface BotReferral {
  id: string;
  bot_id: string;
  referrer_bot_user_id: string;
  referred_bot_user_id: string;
  referral_code: string;
  status: 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'REJECTED';
  qualified_at: string | null;
  created_at: string;
  referrer?: { first_name?: string; username?: string };
  referred?: { first_name?: string; username?: string };
}

export interface BotReferralReward {
  id: string;
  bot_id: string;
  referral_id: string;
  referrer_bot_user_id: string;
  reward_amount: number;
  reward_currency: string;
  status: 'PENDING' | 'ELIGIBLE' | 'REWARDED' | 'REJECTED' | 'CANCELLED';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotReferralLeaderboardEntry {
  rank: number;
  bot_user_id: string;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  total_referrals: number;
  total_qualified: number;
}

// ==============================================================================
// PHASE 6: ENTERPRISE TELEGRAM BOT AUTOMATION TYPES
// ==============================================================================

export type EnterpriseStaffRole =
  | 'OWNER'
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MODERATOR'
  | 'ANALYST'
  | 'SUPPORT';

export type EnterpriseTriggerType =
  | 'USER_REGISTERED'
  | 'USER_STARTED_BOT'
  | 'MESSAGE_RECEIVED'
  | 'COMMAND_USED'
  | 'BUTTON_CLICKED'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'REFERRAL_CREATED'
  | 'REFERRAL_COMPLETED'
  | 'REWARD_ELIGIBLE'
  | 'USER_INACTIVE'
  | 'SCHEDULED_TIME'
  | 'CAMPAIGN_EVENT'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  | 'CUSTOM_WEBHOOK';

export type EnterpriseActionType =
  | 'SEND_MESSAGE'
  | 'SEND_PHOTO'
  | 'SEND_BUTTON'
  | 'SHOW_MENU'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'WAIT'
  | 'RUN_COMMAND'
  | 'START_WORKFLOW'
  | 'STOP_WORKFLOW'
  | 'SEND_NOTIFICATION'
  | 'CREATE_REFERRAL_EVENT'
  | 'MARK_REWARD_ELIGIBLE'
  | 'CALL_WEBHOOK';

export type WorkflowNodeType = 'TRIGGER' | 'CONDITION' | 'ACTION' | 'DELAY' | 'BRANCH' | 'END';

export interface WorkflowNode {
  id?: string;
  workflow_id?: string;
  bot_id?: string;
  node_key: string;
  node_type: WorkflowNodeType;
  title: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id?: string;
  workflow_id?: string;
  bot_id?: string;
  source_node_key: string;
  target_node_key: string;
  condition_branch?: 'YES' | 'NO' | 'DEFAULT' | 'CUSTOM';
}

export interface WorkflowJob {
  id: string;
  bot_id: string;
  workflow_id: string;
  node_id?: string;
  bot_user_id: string;
  telegram_chat_id: number;
  execution_id: string;
  step_index: number;
  status: 'QUEUED' | 'RUNNING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  scheduled_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  attempt_count: number;
  max_retries: number;
  next_attempt_at?: string | null;
  last_error?: string | null;
  context_data: Record<string, any>;
  created_at: string;
  workflow?: { name: string };
  bot_user?: { first_name?: string; username?: string };
}

export interface BotNotificationRule {
  id: string;
  bot_id: string;
  name: string;
  event_type:
    | 'AUTOMATION_FAILURE'
    | 'TELEGRAM_RATE_LIMIT'
    | 'REFERRAL_MILESTONE'
    | 'FRAUD_DETECTED'
    | 'WEBHOOK_FAILURE'
    | 'SECURITY_ALERT'
    | 'DAILY_REPORT';
  channel: 'TELEGRAM_ADMIN' | 'IN_APP' | 'WEBHOOK';
  target_recipient: string;
  template: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotScheduledReport {
  id: string;
  bot_id: string;
  title: string;
  report_type:
    | 'DAILY_SUMMARY'
    | 'WEEKLY_GROWTH'
    | 'REFERRALS_AUDIT'
    | 'CAMPAIGN_PERFORMANCE'
    | 'AUTOMATION_HEALTH';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  target_chat_id?: number | null;
  last_generated_at?: string | null;
  last_report_data?: Record<string, any> | null;
  status: 'ACTIVE' | 'PAUSED';
  created_at: string;
}

export interface BotIntegration {
  id: string;
  bot_id: string;
  name: string;
  url: string;
  http_method: 'POST' | 'PUT' | 'GET';
  headers: Record<string, string>;
  event_types: string[];
  secret_token?: string | null;
  is_active: boolean;
  failure_count: number;
  last_triggered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotIntegrationEvent {
  id: string;
  bot_id: string;
  integration_id: string;
  event_type: string;
  payload: Record<string, any>;
  status_code?: number | null;
  response_body?: string | null;
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  error_message?: string | null;
  attempt_count: number;
  created_at: string;
}

export interface EnterpriseCommandCenterMetrics {
  is_entitled: boolean;
  plan_price: number;
  total_workflows: number;
  active_workflows: number;
  executions_today: number;
  successful_executions: number;
  failed_executions: number;
  queued_jobs: number;
  automation_success_rate: number;
  integrations_count: number;
  audit_events_count: number;
  message?: string;
}

