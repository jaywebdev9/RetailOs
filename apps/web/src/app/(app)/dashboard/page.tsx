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
};

type DashboardData = {
  today: { sales: number; grossProfit: number; transactions: number };
  alerts: { lowStock: number; customerDebt: number; supplierDebt: number };
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
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
      }).format(new Date()),
    [locale],
  );

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'there';

  /* Simple demo bar heights for revenue chart (visual only) */
  const barHeights = [40, 55, 35, 70, 50, 85, 60, 75, 45, 90, 65, 80];

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--background)] p-4">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-12 rounded-2xl bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="Dashboard"
      subtitle={`${todayLabel} · Welcome, ${displayName}`}
      narrow
    >
      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total revenue"
          value={formatMoney(data?.today?.sales ?? 0)}
          trend="+8.2%"
          trendUp
          hint="Today"
          icon={<ShoppingCart size={16} />}
        />
        <KpiCard
          label="Orders"
          value={String(data?.today?.transactions ?? 0)}
          trend="+4.1%"
          trendUp
          hint="Today"
          icon={<ClipboardList size={16} />}
        />
        <KpiCard
          label="Low stock"
          value={String(data?.alerts?.lowStock ?? 0)}
          trend={data?.alerts?.lowStock ? 'Alert' : 'OK'}
          trendUp={!data?.alerts?.lowStock}
          hint="Items"
          icon={<Package size={16} />}
        />
        <KpiCard
          label="Gross profit"
          value={formatMoney(data?.today?.grossProfit ?? 0)}
          trend="+2.5%"
          trendUp
          hint="Today"
          icon={<Activity size={16} />}
        />
      </section>

      {/* Charts row */}
      <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Monthly revenue bars */}
        <div className="card p-4 sm:p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Monthly revenue</h2>
              <p className="text-[11px] text-slate-400">Past 12 months performance</p>
            </div>
          </div>
          <div className="flex h-40 items-end gap-1.5 sm:gap-2">
            {barHeights.map((h, i) => (
              <div key={MONTHS[i]} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="chart-bar w-full max-w-[28px]"
                  style={{ height: `${h}%` }}
                  title={MONTHS[i]}
                />
                <span className="text-[9px] font-medium text-slate-400 sm:text-[10px]">
                  {MONTHS[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory trend line placeholder */}
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Inventory trends</h2>
            <p className="text-[11px] text-slate-400">Stock movement overview</p>
          </div>
          <div className="relative h-40">
            <svg viewBox="0 0 300 120" className="h-full w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,90 C40,70 60,100 100,55 C140,20 160,50 200,40 C240,30 270,55 300,35 L300,120 L0,120 Z"
                fill="url(#areaGrad)"
              />
              <path
                d="M0,90 C40,70 60,100 100,55 C140,20 160,50 200,40 C240,30 270,55 300,35"
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="mt-2 flex gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> In stock
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Sold
            </span>
          </div>
        </div>
      </section>

      {/* Needs attention */}
      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Needs attention</h2>
            <p className="text-[11px] text-slate-400">Alerts & low stock</p>
          </div>
        </div>
        {alertRows.length === 0 ? (
          <EmptyState
            title="All clear"
            description="No active alerts. Stock and debts look healthy."
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {alertRows.slice(0, 6).map((a) => (
                <div key={a.id} className="card flex items-start gap-3 p-3.5">
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
                      <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="card hidden overflow-hidden md:block">
              <div className="table-scroll">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Alert</th>
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertRows.slice(0, 8).map((a) => (
                      <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-5 py-3.5 font-medium text-slate-800">{a.title}</td>
                        <td className="px-4 py-3.5">
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
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{a.body || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-4">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { href: '/pos', label: 'New sale', detail: 'Checkout', icon: ShoppingCart },
            { href: '/products', label: 'Products', detail: 'Catalog', icon: Package },
            { href: '/purchases', label: 'Purchase', detail: 'Restock', icon: ClipboardList },
            { href: '/customers', label: 'Customers', detail: 'Balances', icon: Users },
            { href: '/cash', label: 'Cash book', detail: 'Movements', icon: Banknote },
            { href: '/reports', label: 'Reports', detail: 'Insights', icon: ChartNoAxesCombined },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="card group flex min-h-[100px] flex-col p-3.5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <Icon size={18} />
                </span>
                <span className="mt-2.5 text-xs font-bold text-slate-800">{action.label}</span>
                <span className="text-[10px] text-slate-400">{action.detail}</span>
                <ArrowRight
                  size={14}
                  className="mt-auto hidden self-end text-slate-300 group-hover:text-orange-500 sm:block"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
