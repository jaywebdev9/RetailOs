export const GRACE_DAYS = 3; // full access continues this long after a plan/trial ends
export const TRIAL_DAYS = 14;
const DAY = 86400000;

export type AccessState = 'TRIALING' | 'ACTIVE' | 'GRACE' | 'EXPIRED';

export type SubscriptionDates = {
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date;
};

export type AccessInfo = {
  state: AccessState;
  /** FULL = everything works. READ_ONLY = view and export only. */
  access: 'FULL' | 'READ_ONLY';
  endsAt: Date; // when the trial / paid period ends
  graceEndsAt: Date;
  /** Whole days until endsAt (0 or negative once it has ended). */
  daysLeft: number;
};

/**
 * The one place that decides what a business may do. Pure function of dates: it does not
 * depend on the hourly job having run, so access can never be stuck on a stale status.
 *
 *   before endsAt            TRIALING / ACTIVE   full access
 *   endsAt .. graceEndsAt    GRACE               full access + warning
 *   after graceEndsAt        EXPIRED             read-only (view + export, no new records)
 */
export function computeAccess(sub: SubscriptionDates, now: Date = new Date()): AccessInfo {
  const endsAt = sub.currentPeriodEnd ?? sub.trialEndsAt;
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY);

  if (now < endsAt) {
    return {
      state: sub.currentPeriodEnd ? 'ACTIVE' : 'TRIALING',
      access: 'FULL',
      endsAt,
      graceEndsAt: sub.graceEndsAt,
      daysLeft,
    };
  }
  if (now < sub.graceEndsAt) {
    return { state: 'GRACE', access: 'FULL', endsAt, graceEndsAt: sub.graceEndsAt, daysLeft };
  }
  return { state: 'EXPIRED', access: 'READ_ONLY', endsAt, graceEndsAt: sub.graceEndsAt, daysLeft };
}

/** Calendar-month addition that never overflows (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const r = new Date(date.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

/** Reminder bucket for the hourly job, or null when nothing is due yet. */
export function reminderKind(info: AccessInfo): 'D7' | 'D3' | 'D1' | 'EXPIRED' | null {
  if (info.daysLeft <= 0) return 'EXPIRED';
  if (info.daysLeft <= 1) return 'D1';
  if (info.daysLeft <= 3) return 'D3';
  if (info.daysLeft <= 7) return 'D7';
  return null;
}
