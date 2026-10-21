'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  ChartNoAxesCombined,
  ClipboardList,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';
import { AppShell, EmptyState, KpiCard, StatusBadge } from '@/components/AppShell';

type AlertRow = {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string | null;
};

type DashboardData = {
  today: { sales: number; grossProfit: number; transactions: number };
  alerts: { lowStock: number; customerDebt: number; supplierDebt: number };
};

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertRows, setAlertRows] = useState<AlertRow[]>([]);
  const { locale, t } = useI18n();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }
    (async () => {
      try {
        const [meRes, bizRes] = await Promise.all([
          api.get('/users/me'),
          api.get('/users/me/businesses'),
        ]);
        setUser(meRes.data);
        const memberships = bizRes.data;
        if (memberships?.length > 0) {
          const bid = memberships[0].business.id;
          localStorage.setItem('businessId', bid);
          const dash = await api.get('/reports/dashboard', {
            headers: { 'x-business-id': bid },
          });
          setData(dash.data);
          api
            .get('/alerts', { headers: { 'x-business-id': bid } })
            .then((r) => setAlertRows(Array.isArray(r.data) ? r.data : r.data?.items || []))
            .catch(() => {});
        }
      } catch {
        localStorage.removeItem('accessToken');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      maximumFractionDigits: 0,
    }).format(n || 0);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }).format(new Date()),
    [locale],
  );

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'there';

  /* Visual placeholder heights (px) so bars always render */
  const barPx = [28, 40, 24, 52, 36, 64, 44, 56, 32, 68, 48, 60];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] p-4">
        <div className="mx-auto max-w-5xl animate-pulse space-y-3">
          <div className="h-10 rounded-xl bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 rounded-xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title={t('dashboard')}
      subtitle={`${todayLabel} · ${t('welcome')}, ${displayName}`}
      narrow
    >
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t('todaySales')}
          value={formatMoney(data?.today?.sales ?? 0)}
          hint={`${data?.today?.transactions ?? 0} ${t('transactions')}`}
          icon={<ShoppingCart size={15} />}
        />
        <KpiCard
          label={t('grossProfit')}
          value={formatMoney(data?.today?.grossProfit ?? 0)}
          hint={t('date')}
          icon={<Activity size={15} />}
        />
        <KpiCard
          label={t('lowStock')}
          value={String(data?.alerts?.lowStock ?? 0)}
          hint={t('belowReorder')}
          icon={<Package size={15} />}
        />
        <KpiCard
          label={t('openDebts')}
          value={formatMoney(
            (data?.alerts?.customerDebt ?? 0) + (data?.alerts?.supplierDebt ?? 0),
          )}
          hint={t('customersSuppliers')}
          icon={<AlertTriangle size={15} />}
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('monthlyRevenue')}</h2>
          <p className="text-[11px] text-slate-400">{t('last12Months')}</p>
          <div className="mt-4 flex h-[120px] items-end gap-1.5">
            {barPx.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full max-w-[22px] rounded-t bg-teal-600/90"
                  style={{ height: h }}
                />
                <span className="text-[9px] text-slate-400">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">{t('inventoryTrend')}</h2>
          <p className="text-[11px] text-slate-400">{t('stockMovement')}</p>
          <div className="mt-3 h-[120px]">
            <svg viewBox="0 0 280 100" className="h-full w-full" preserveAspectRatio="none">
              <path
                d="M0,70 C35,55 55,80 90,45 C125,15 145,40 180,32 C215,24 245,48 280,28 L280,100 L0,100 Z"
                fill="#ccfbf1"
              />
              <path
                d="M0,70 C35,55 55,80 90,45 C125,15 145,40 180,32 C215,24 245,48 280,28"
                fill="none"
                stroke="#0f766e"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">{t('needsAttention')}</h2>
        {alertRows.length === 0 ? (
          <EmptyState
            title={t('allClear')}
            description={t('noAlerts')}
          />
        ) : (
          <div className="space-y-2">
            {alertRows.slice(0, 8).map((a) => (
              <div key={a.id} className="card flex items-start gap-3 p-3">
                <span
                  className={
                    a.severity === 'CRITICAL'
                      ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600'
                      : a.severity === 'WARNING'
                        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600'
                        : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600'
                  }
                >
                  <AlertTriangle size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{a.title}</p>
                    <StatusBadge
                      status={a.severity}
                      tone={
                        a.severity === 'CRITICAL'
                          ? 'danger'
                          : a.severity === 'WARNING'
                            ? 'warning'
                            : 'info'
                      }
                    />
                  </div>
                  {a.body && (
                    <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 pb-2">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">{t('quickActions')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: '/pos', label: 'New sale', icon: ShoppingCart },
            { href: '/products', label: 'Products', icon: Package },
            { href: '/purchases', label: 'Purchase', icon: ClipboardList },
            { href: '/customers', label: 'Customers', icon: Users },
            { href: '/cash', label: 'Cash', icon: Banknote },
            { href: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="card flex items-center gap-2.5 p-3 transition hover:border-teal-200 hover:bg-teal-50/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Icon size={16} />
                </span>
                <span className="text-xs font-semibold text-slate-800">{a.label}</span>
                <ArrowRight size={12} className="ml-auto text-slate-300" />
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
