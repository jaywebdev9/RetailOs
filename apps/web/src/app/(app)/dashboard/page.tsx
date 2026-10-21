'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowRight, Banknote, ChartNoAxesCombined,
  ClipboardList, Package, ShoppingCart, Users,
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
  referenceType: string | null;
  referenceId: string | null;
};

type DashboardData = {
  today: { sales: number; grossProfit: number; transactions: number };
  alerts: { lowStock: number; customerDebt: number; supplierDebt: number };
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertRows, setAlertRows] = useState<AlertRow[]>([]);
  const { locale } = useI18n();

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
          setBusinessId(bid);
          localStorage.setItem('businessId', bid);
          const dash = await api.get('/reports/dashboard', {
            headers: { 'x-business-id': bid },
          });
          setData(dash.data);
          api
            .get('/alerts', { headers: { 'x-business-id': bid } })
            .then((r) => setAlertRows(r.data || []))
            .catch(() => {});
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
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
    }).format(n);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date()),
    [locale],
  );

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'there';

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--background)] p-4 sm:p-6">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-14 rounded-2xl bg-white" />
          <div className="h-10 w-48 rounded-xl bg-slate-200 sm:w-64" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-white sm:h-32" />
            ))}
          </div>
          <div className="h-40 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="Overview"
      subtitle={`${todayLabel} · Welcome back, ${displayName}`}
      breadcrumb="Workspace"
      narrow
    >
      {/* KPI grid — 2 cols mobile, 4 desktop; never overflows */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Today's sales"
          value={formatMoney(data?.today?.sales ?? 0)}
          hint={`${data?.today?.transactions ?? 0} transactions`}
          icon={<ShoppingCart size={18} />}
          tone="teal"
        />
        <KpiCard
          label="Gross profit"
          value={formatMoney(data?.today?.grossProfit ?? 0)}
          hint="Today"
          icon={<Activity size={18} />}
          tone="emerald"
        />
        <KpiCard
          label="Low stock"
          value={String(data?.alerts?.lowStock ?? 0)}
          hint="Items below reorder"
          icon={<Package size={18} />}
          tone="amber"
        />
        <KpiCard
          label="Open debts"
          value={String(
            (data?.alerts?.customerDebt ?? 0) + (data?.alerts?.supplierDebt ?? 0),
          )}
          hint="Customers & suppliers"
          icon={<AlertTriangle size={18} />}
          tone="rose"
        />
      </section>

      {/* Alerts */}
      <section className="mt-6 sm:mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Alerts</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Things that need your attention
            </p>
          </div>
        </div>
        {alertRows.length === 0 ? (
          <EmptyState
            title="All clear"
            description="No active alerts. Stock levels and debts look healthy."
          />
        ) : (
          <div className="mobile-list">
            {alertRows.slice(0, 8).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    a.severity === 'CRITICAL'
                      ? 'bg-rose-50 text-rose-600'
                      : a.severity === 'WARNING'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-sky-50 text-sky-600'
                  }`}
                >
                  <AlertTriangle size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
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
                    <p className="mt-1 text-xs leading-5 text-slate-500">{a.body}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-6 sm:mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Quick actions</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Jump into everyday tasks
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            {
              href: '/pos',
              label: 'New sale',
              detail: 'Checkout customer',
              icon: ShoppingCart,
              tone: 'teal',
            },
            {
              href: '/products',
              label: 'Products',
              detail: 'Catalog & prices',
              icon: Package,
              tone: 'blue',
            },
            {
              href: '/purchases',
              label: 'Purchase',
              detail: 'Restock inventory',
              icon: ClipboardList,
              tone: 'violet',
            },
            {
              href: '/customers',
              label: 'Customers',
              detail: 'Profiles & balances',
              icon: Users,
              tone: 'amber',
            },
            {
              href: '/cash',
              label: 'Cash book',
              detail: 'Cash movements',
              icon: Banknote,
              tone: 'emerald',
            },
            {
              href: '/reports',
              label: 'Reports',
              detail: 'Business insights',
              icon: ChartNoAxesCombined,
              tone: 'rose',
            },
          ].map((action) => {
            const Icon = action.icon;
            const tones: Record<string, string> = {
              teal: 'bg-teal-50 text-teal-700',
              blue: 'bg-blue-50 text-blue-700',
              violet: 'bg-violet-50 text-violet-700',
              amber: 'bg-amber-50 text-amber-700',
              emerald: 'bg-emerald-50 text-emerald-700',
              rose: 'bg-rose-50 text-rose-700',
            };
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex min-h-[110px] flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:min-h-[122px] sm:p-4"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[action.tone]}`}
                >
                  <Icon size={18} />
                </span>
                <span className="mt-3 text-xs font-bold text-slate-800">
                  {action.label}
                </span>
                <span className="mt-1 text-[10px] leading-4 text-slate-500">
                  {action.detail}
                </span>
                <ArrowRight
                  size={14}
                  className="mt-auto hidden self-end text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700 sm:block"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200/80 py-5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>Retail OS · Business management workspace</span>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Workspace ready
          </span>
          <Link href="/billing" className="hover:text-slate-600">
            Plan & billing
          </Link>
        </div>
      </footer>
    </AppShell>
  );
}
