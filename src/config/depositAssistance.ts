/**
 * Temporary Production Deposit Assistance Configuration
 *
 * Provides a centralized feature toggle and configuration for the
 * "Deposit via Admin + Telegram Support" information box.
 * To disable or remove this temporary feature, set `enabled: false`.
 */

export const DEPOSIT_ASSISTANCE_CONFIG = {
  // Master feature switch (temporary production feature)
  enabled: true,

  // Official Support Telegram destination
  telegramUrl: 'https://t.me/createlifafa_support',
  telegramHandle: '@createlifafa_support',

  // UI Headings & Copy
  badgeText: 'Admin Deposit Assistance',
  title: 'Temporary Deposit Assistance',
  message:
    'Deposits are currently being assisted by our admin team. Contact official support on Telegram for deposit assistance.',
  buttonText: 'Contact Support on Telegram',
  securityNote:
    'Please share your registered account details and deposit reference with support. Never share your password, OTP, or payment PIN.',

  // Merchant-specific note
  merchantMessage:
    'Merchant gateway float deposits are currently being assisted directly by our admin clearing team. Contact official support on Telegram for instant float verification and manual clearance.',
  merchantSecurityNote:
    'Please share your Merchant ID and deposit UTR reference with support. Never share your secret API keys or payment PIN.',

  // Session storage key for dismiss state
  dismissStorageKey: 'createlifafa_deposit_admin_assistance_dismissed',
} as const;
