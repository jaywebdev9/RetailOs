'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';

export type BillingStatus = {
  state: 'TRIALING' | 'ACTIVE' | 'GRACE' | 'EXPIRED';
  access: 'FULL' | 'READ_ONLY';
  daysLeft: number;
  endsAt: string;
  isOwner: boolean;
};

/**
 * Shown on every page of the app:
 *  - free trial / plan running out → slim notice with days left
 *  - grace → red warning
 *  - expired → read-only notice with Renew and Export my data
 */
export function SubscriptionBanner() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [status, setStatus] = useState<BillingStatus | null>(null);

  const load = useCallback(() => {
    const bid = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;
    if (!bid || !localStorage.getItem('accessToken')) return;
    api
      .get('/billing/status', { headers: { 'x-business-id': bid } })
      .then((r) => setStatus(r.data))
      .catch(() => {}); // offline or not a member: show nothing
  }, []);

  useEffect(() => {
    load();
  }, [pathname, load]);

  useEffect(() => {
    window.addEventListener('subscription-expired', load);
    return () => window.removeEventListener('subscription-expired', load);
  }, [load]);

  if (!status || pathname?.startsWith('/admin')) return null;

  const days = Math.max(status.daysLeft, 0);
  let tone = '';
  let text = '';
  let showExport = false;

  if (status.state === 'EXPIRED') {
    tone = 'bg-red-600 text-white';
    text = t('bill_expiredMsg');
    showExport = true;
  } else if (status.state === 'GRACE') {
    tone = 'bg-red-100 text-red-800';
    text = t('bill_graceMsg');
  } else if (status.state === 'TRIALING') {
    tone = days <= 3 ? 'bg-amber-100 text-amber-900' : 'bg-teal-50 text-teal-900';
    text = `${days} ${t('bill_trialLeft')}`;
  } else if (status.daysLeft <= 7) {
    tone = 'bg-amber-100 text-amber-900';
    text = `${days} ${t('bill_planLeft')}`;
  } else {
    return null; // paid and healthy: stay out of the way
  }

  return (
    <div
      className={`print:hidden flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-2.5 text-center text-xs font-medium sm:px-4 sm:text-sm ${tone}`}
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
    >
      <span className="font-medium">{text}</span>
      {pathname !== '/billing' && (
        <Link href="/billing" className="underline font-semibold underline-offset-2">
          {status.state === 'TRIALING' ? t('bill_choosePlan') : t('bill_renew')}
        </Link>
      )}
      {showExport && (
        <Link href="/reports" className="underline underline-offset-2">
          {t('bill_exportData')}
        </Link>
      )}
    </div>
  );
}
