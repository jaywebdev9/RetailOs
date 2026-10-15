/**
 * Default plans, created automatically the first time plans are read.
 * These prices are PLACEHOLDERS: change them on the /admin/billing page (no code change needed).
 */
export const DEFAULT_PLANS = [
  { code: 'MONTHLY', name: 'Monthly', months: 1, priceTzs: 15000, sortOrder: 1 },
  { code: 'HALF_YEAR', name: '6 months', months: 6, priceTzs: 80000, sortOrder: 2 },
  { code: 'YEARLY', name: 'Yearly', months: 12, priceTzs: 150000, sortOrder: 3 },
] as const;

export const PAYMENT_METHODS = ['MPESA', 'TIGO', 'AIRTEL', 'HALOPESA', 'BANK', 'OTHER'] as const;
export type SubscriptionPaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MAX_PENDING_PAYMENTS = 3;

export const SETTING_INSTRUCTIONS = 'billing.paymentInstructions';
export const SETTING_SUPPORT_PHONE = 'billing.supportPhone';
