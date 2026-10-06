// ==============================================================================
// Centralized Bot Feature Entitlements Registry (Phase 5)
// Authoritative mapping of bot slot plan prices to features & limits
// SOURCE OF TRUTH: bot_slots.plan_price
// ==============================================================================

export type BotPlanPrice = 99 | 299 | 499 | 999 | 1999;

export type BotTier = 'STARTER' | 'BASIC' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export type BotFeatureKey =
  // ₹99 Starter
  | 'bot.basic'
  | 'bot.setup'
  | 'bot.start_command'
  | 'bot.user_directory'
  | 'bot.status_metrics'
  // ₹299 Basic
  | 'bot.commands'
  | 'bot.menus'
  | 'bot.auto_replies'
  | 'bot.broadcast'
  | 'bot.scheduled_broadcast'
  | 'bot.basic_referrals'
  | 'bot.basic_analytics'
  | 'bot.data_export'
  // ₹499 Pro
  | 'bot.campaigns'
  | 'bot.scheduled_campaigns'
  | 'bot.targeted_broadcast'
  | 'bot.user_segmentation'
  | 'bot.advanced_referrals'
  | 'bot.advanced_analytics'
  | 'bot.multiple_admins'
  | 'bot.fraud_controls'
  // ₹999 Business
  | 'bot.campaign_sequences'
  | 'bot.user_tags'
  | 'bot.advanced_audience'
  | 'bot.commission_rules'
  | 'bot.api_webhooks'
  | 'bot.business_branding'
  // ₹1,999 Enterprise
  | 'bot.enterprise_workflows'
  | 'bot.enterprise_automation'
  | 'bot.workflow_builder'
  | 'bot.custom_journeys'
  | 'bot.conditional_automation'
  | 'bot.delayed_actions'
  | 'bot.behavior_triggers'
  | 'bot.advanced_event_triggers'
  | 'bot.automation_variables'
  | 'bot.automation_branching'
  | 'bot.automation_logs'
  | 'bot.enterprise_referrals'
  | 'bot.enterprise_rewards'
  | 'bot.notification_engine'
  | 'bot.automated_reports'
  | 'bot.api'
  | 'bot.webhooks'
  | 'bot.custom_integrations'
  | 'bot.audit_logs'
  | 'bot.enterprise_staff';

export interface BotPlanDefinition {
  price: BotPlanPrice;
  tier: BotTier;
  name: string;
  badge: string;
  badgeColor: string;
  tagline: string;
  limits: {
    maxAdmins: number;
    maxCommands: number;
    maxDailyBroadcasts: number;
    maxActiveCampaigns: number;
    hasApiAccess: boolean;
    hasAuditLogs: boolean;
  };
}

export const BOT_PLANS: Record<BotPlanPrice, BotPlanDefinition> = {
  99: {
    price: 99,
    tier: 'STARTER',
    name: 'Starter Bot Slot',
    badge: 'STARTER ₹99',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    tagline: 'Essential bot connectivity & subscriber directory',
    limits: {
      maxAdmins: 1,
      maxCommands: 0,
      maxDailyBroadcasts: 0,
      maxActiveCampaigns: 0,
      hasApiAccess: false,
      hasAuditLogs: false,
    },
  },
  299: {
    price: 299,
    tier: 'BASIC',
    name: 'Basic Bot Slot',
    badge: 'BASIC ₹299',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    tagline: 'Custom commands, interactive menus, auto-replies & broadcasts',
    limits: {
      maxAdmins: 1,
      maxCommands: 8,
      maxDailyBroadcasts: 1000,
      maxActiveCampaigns: 0,
      hasApiAccess: false,
      hasAuditLogs: false,
    },
  },
  499: {
    price: 499,
    tier: 'PRO',
    name: 'Pro Bot Slot',
    badge: 'PRO ₹499',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    tagline: 'Campaign builder, targeted broadcasts & multi-admin controls',
    limits: {
      maxAdmins: 3,
      maxCommands: 15,
      maxDailyBroadcasts: 5000,
      maxActiveCampaigns: 5,
      hasApiAccess: false,
      hasAuditLogs: false,
    },
  },
  999: {
    price: 999,
    tier: 'BUSINESS',
    name: 'Business Bot Slot',
    badge: 'BUSINESS ₹999',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    tagline: 'Audience tagging, webhook integrations & business branding',
    limits: {
      maxAdmins: 10,
      maxCommands: 30,
      maxDailyBroadcasts: 20000,
      maxActiveCampaigns: 10,
      hasApiAccess: true,
      hasAuditLogs: false,
    },
  },
  1999: {
    price: 1999,
    tier: 'ENTERPRISE',
    name: 'Enterprise Bot Slot',
    badge: 'ENTERPRISE ₹1,999',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
    tagline: 'Full automation journeys, staff architecture & detailed audit logs',
    limits: {
      maxAdmins: 999,
      maxCommands: 50,
      maxDailyBroadcasts: 50000,
      maxActiveCampaigns: 25,
      hasApiAccess: true,
      hasAuditLogs: true,
    },
  },
};

export const FEATURE_ENTITLEMENT_MAP: Record<
  BotFeatureKey,
  {
    minPrice: BotPlanPrice;
    name: string;
    description: string;
    category: 'CORE' | 'AUTOMATION' | 'ENGAGEMENT' | 'ADMIN' | 'ENTERPRISE';
  }
> = {
  // ₹99 Starter
  'bot.basic': {
    minPrice: 99,
    name: 'Telegram Bot Setup',
    description: 'Connect BotFather token & register webhook',
    category: 'CORE',
  },
  'bot.setup': {
    minPrice: 99,
    name: 'Bot Connection',
    description: 'Instant secure webhook linking and health pings',
    category: 'CORE',
  },
  'bot.start_command': {
    minPrice: 99,
    name: 'Core /start Handling',
    description: 'Default greeting and subscriber account registration',
    category: 'CORE',
  },
  'bot.user_directory': {
    minPrice: 99,
    name: 'User Directory',
    description: 'View verified subscribers, Telegram IDs and timestamps',
    category: 'CORE',
  },
  'bot.status_metrics': {
    minPrice: 99,
    name: 'Basic Status Metrics',
    description: 'Total user counts and connection health status',
    category: 'CORE',
  },

  // ₹299 Basic
  'bot.commands': {
    minPrice: 299,
    name: 'Custom Commands',
    description: 'Create and edit custom bot commands (/offers, /support, etc.)',
    category: 'AUTOMATION',
  },
  'bot.menus': {
    minPrice: 299,
    name: 'Interactive Menu Builder',
    description: 'Visual inline & reply keyboard designer with preview',
    category: 'AUTOMATION',
  },
  'bot.auto_replies': {
    minPrice: 299,
    name: 'Keyword Auto-Replies',
    description: 'Priority-based automatic keyword trigger responses',
    category: 'AUTOMATION',
  },
  'bot.broadcast': {
    minPrice: 299,
    name: 'Message Broadcasts',
    description: 'Deliver announcements with buttons to your subscribers',
    category: 'ENGAGEMENT',
  },
  'bot.scheduled_broadcast': {
    minPrice: 299,
    name: 'Scheduled Broadcasts',
    description: 'Schedule broadcasts for automated future delivery',
    category: 'ENGAGEMENT',
  },
  'bot.basic_referrals': {
    minPrice: 299,
    name: 'Referral Engine & Leaderboard',
    description: 'Unique /ref deep links, attribution & ranked leaderboard',
    category: 'ENGAGEMENT',
  },
  'bot.basic_analytics': {
    minPrice: 299,
    name: 'Basic Analytics',
    description: 'Subscriber growth trends and broadcast delivery telemetry',
    category: 'CORE',
  },
  'bot.data_export': {
    minPrice: 299,
    name: 'User Data Export',
    description: 'Export verified subscriber lists to CSV format',
    category: 'CORE',
  },

  // ₹499 Pro
  'bot.campaigns': {
    minPrice: 499,
    name: 'Campaign Builder',
    description: 'Create time-bound promotions with participant logging',
    category: 'ENGAGEMENT',
  },
  'bot.scheduled_campaigns': {
    minPrice: 499,
    name: 'Campaign Scheduling',
    description: 'Automatic start and expiration enforcement for promotions',
    category: 'ENGAGEMENT',
  },
  'bot.targeted_broadcast': {
    minPrice: 499,
    name: 'Targeted Broadcasts',
    description: 'Audience filtering by 24h active, 7d active, or new users',
    category: 'ENGAGEMENT',
  },
  'bot.user_segmentation': {
    minPrice: 499,
    name: 'Audience Segmentation',
    description: 'Filter and segment users by activity and engagement history',
    category: 'ENGAGEMENT',
  },
  'bot.advanced_referrals': {
    minPrice: 499,
    name: 'Advanced Referral Controls',
    description: 'Milestone tracking and custom reward rule configurations',
    category: 'ENGAGEMENT',
  },
  'bot.advanced_analytics': {
    minPrice: 499,
    name: 'Advanced Analytics Dashboard',
    description: 'Multi-metric engagement, conversion and retention trends',
    category: 'CORE',
  },
  'bot.multiple_admins': {
    minPrice: 499,
    name: 'Multiple Bot Admins',
    description: 'Invite co-admins and moderators with role permissions',
    category: 'ADMIN',
  },
  'bot.fraud_controls': {
    minPrice: 499,
    name: 'Anti-Spam & Fraud Controls',
    description: 'Duplicate referral rejections and suspicious activity locks',
    category: 'ADMIN',
  },

  // ₹999 Business
  'bot.campaign_sequences': {
    minPrice: 999,
    name: 'Campaign Sequences',
    description: 'Multi-stage promotional funnels and drip sequences',
    category: 'ENGAGEMENT',
  },
  'bot.user_tags': {
    minPrice: 999,
    name: 'User Tagging & Groups',
    description: 'Create custom tags to organize and target subscriber segments',
    category: 'ENGAGEMENT',
  },
  'bot.advanced_audience': {
    minPrice: 999,
    name: 'Advanced Audience Targeting',
    description: 'Cross-segment broadcast targeting by custom user tags',
    category: 'ENGAGEMENT',
  },
  'bot.commission_rules': {
    minPrice: 999,
    name: 'Commission & Reward Tiers',
    description: 'Configurable multi-tier referral compensation rules',
    category: 'ENGAGEMENT',
  },
  'bot.api_webhooks': {
    minPrice: 999,
    name: 'API & Outbound Webhooks',
    description: 'Integrate external services and trigger webhooks on events',
    category: 'ENTERPRISE',
  },
  'bot.business_branding': {
    minPrice: 999,
    name: 'Business Branding',
    description: 'Custom bot signatures and branded interaction layouts',
    category: 'ENTERPRISE',
  },

  // ₹1,999 Enterprise
  'bot.enterprise_workflows': {
    minPrice: 1999,
    name: 'Custom Workflow Journeys',
    description: 'Complex multi-step conditional automation flows',
    category: 'ENTERPRISE',
  },
  'bot.enterprise_automation': {
    minPrice: 1999,
    name: 'Enterprise Automation Engine',
    description: 'Autonomous server-side event pipeline & workflow processing',
    category: 'ENTERPRISE',
  },
  'bot.workflow_builder': {
    minPrice: 1999,
    name: 'Visual Workflow Builder',
    description: 'Drag-and-drop node canvas for triggers, conditions & actions',
    category: 'ENTERPRISE',
  },
  'bot.custom_journeys': {
    minPrice: 1999,
    name: 'Custom User Journeys',
    description: 'Multi-stage subscriber onboarding and retention funnels',
    category: 'ENTERPRISE',
  },
  'bot.conditional_automation': {
    minPrice: 1999,
    name: 'Conditional Branching',
    description: 'Server-side IF/ELSE rule evaluations on user attributes & tags',
    category: 'ENTERPRISE',
  },
  'bot.delayed_actions': {
    minPrice: 1999,
    name: 'Delayed Action Engine',
    description: 'Persistent server-side scheduling for time-delayed steps',
    category: 'ENTERPRISE',
  },
  'bot.behavior_triggers': {
    minPrice: 1999,
    name: 'Behavioral Triggers',
    description: 'React to inactivity, button clicks, and engagement patterns',
    category: 'ENTERPRISE',
  },
  'bot.advanced_event_triggers': {
    minPrice: 1999,
    name: 'Advanced Event Triggers',
    description: 'Deep trigger integration with referrals, tags & campaigns',
    category: 'ENTERPRISE',
  },
  'bot.automation_variables': {
    minPrice: 1999,
    name: 'Automation Variables',
    description: 'Safe dynamic personalization tokens in messages and actions',
    category: 'ENTERPRISE',
  },
  'bot.automation_branching': {
    minPrice: 1999,
    name: 'Automation Flow Branching',
    description: 'Multi-path decision trees with loop protection guards',
    category: 'ENTERPRISE',
  },
  'bot.automation_logs': {
    minPrice: 1999,
    name: 'Automation Execution Logs',
    description: 'Comprehensive step-by-step execution history and telemetry',
    category: 'ENTERPRISE',
  },
  'bot.enterprise_referrals': {
    minPrice: 1999,
    name: 'Enterprise Referral Automation',
    description: 'Multi-tier referral milestones and automated progression',
    category: 'ENGAGEMENT',
  },
  'bot.enterprise_rewards': {
    minPrice: 1999,
    name: 'Reward Eligibility Rules',
    description: 'Automated verification and eligibility event triggers',
    category: 'ENGAGEMENT',
  },
  'bot.notification_engine': {
    minPrice: 1999,
    name: 'Notification Automation Engine',
    description: 'Multi-channel system, fraud, and workflow failure alerts',
    category: 'ADMIN',
  },
  'bot.automated_reports': {
    minPrice: 1999,
    name: 'Scheduled Automated Reports',
    description: 'Daily, weekly, and monthly metric digests delivered to Telegram',
    category: 'CORE',
  },
  'bot.api': {
    minPrice: 1999,
    name: 'Enterprise REST API',
    description: 'Authenticated programmatic control over bot resources',
    category: 'ENTERPRISE',
  },
  'bot.webhooks': {
    minPrice: 1999,
    name: 'Custom Outbound Webhooks',
    description: 'HTTPS webhook event dispatches with retry & HMAC validation',
    category: 'ENTERPRISE',
  },
  'bot.custom_integrations': {
    minPrice: 1999,
    name: 'Custom Enterprise Integrations',
    description: 'Custom API webhooks, automated reports and priority routing',
    category: 'ENTERPRISE',
  },
  'bot.audit_logs': {
    minPrice: 1999,
    name: 'Detailed Operational Audit Logs',
    description: 'Tamper-resistant audit trail of all staff and system actions',
    category: 'ADMIN',
  },
  'bot.enterprise_staff': {
    minPrice: 1999,
    name: 'Enterprise Staff Architecture',
    description: '6-tier RBAC (Owner, Super Admin, Admin, Moderator, Analyst, Support)',
    category: 'ADMIN',
  },
};

/**
 * Safe variable replacement helper for bot messages and notifications.
 * Pure regex-based substitution with ZERO eval or dynamic code execution.
 */
export function substituteAutomationVariables(
  template: string,
  context: {
    first_name?: string;
    username?: string;
    telegram_id?: string | number;
    bot_name?: string;
    referral_count?: number;
    campaign_name?: string;
    tag_count?: number;
    [key: string]: any;
  }
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key in context && context[key] !== undefined && context[key] !== null) {
      return String(context[key]);
    }
    return match;
  });
}

/**
 * Check if a bot with a given slot price is entitled to a specific feature
 */
export function hasBotFeature(planPrice: number, featureKey: BotFeatureKey): boolean {
  const feature = FEATURE_ENTITLEMENT_MAP[featureKey];
  if (!feature) return false;
  return Number(planPrice) >= feature.minPrice;
}

/**
 * Get the minimum required plan definition for a specific feature key
 */
export function getRequiredPlanForFeature(featureKey: BotFeatureKey): BotPlanDefinition {
  const feature = FEATURE_ENTITLEMENT_MAP[featureKey];
  const minPrice = feature ? feature.minPrice : 1999;
  return BOT_PLANS[minPrice] || BOT_PLANS[1999];
}

/**
 * Resolve Tier from numeric price
 */
export function getTierFromPrice(price: number): BotTier {
  const cleanPrice = Number(price);
  if (cleanPrice >= 1999) return 'ENTERPRISE';
  if (cleanPrice >= 999) return 'BUSINESS';
  if (cleanPrice >= 499) return 'PRO';
  if (cleanPrice >= 299) return 'BASIC';
  return 'STARTER';
}
