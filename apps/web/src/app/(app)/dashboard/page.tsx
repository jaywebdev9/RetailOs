'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useI18n } from '@/i18n';

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

const NAV = [
  { href: '/pos', label: 'POS' },
  { href: '/products', label: 'Products' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/customers', label: 'Customers' },
  { href: '/sales', label: 'Sales' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/cash', label: 'Cash' },
  { href: '/stock-count', label: 'Stock count' },
  { href: '/reports', label: 'Reports' },
  { href: '/billing', label: 'Billing' },
  { href: '/returns', label: 'Returns' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertRows, setAlertRows] = useState<AlertRow[]>([]);
  const { locale, setLocale, t } = useI18n();

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Retail OS</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
              className="text-xs rounded-full border border-slate-300 px-2 py-0.5 text-slate-600"
            >
              {locale === 'en' ? 'SW' : 'EN'}
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                router.push('/login');
              }}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              {t('signOut')}
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-3 flex flex-wrap gap-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-xs font-medium rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 px-3 py-1"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {alertRows.length > 0 && (
          <section className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm">
            <h2 className="px-4 py-3 text-sm font-semibold border-b">
              Needs your attention ({alertRows.length})
            </h2>
            <ul className="divide-y max-h-72 overflow-y-auto">
              {alertRows.slice(0, 30).map((a) => (
                <li key={a.id} className="px-4 py-2 text-sm flex items-start gap-3">
                  <span
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      a.severity === 'CRITICAL' ? 'bg-red-600' : 'bg-amber-500'
                    }`}
                  />
                  <span className="flex-1">
                    <span className="font-medium">{a.title}</span>
                    {a.body && <span className="block text-xs text-slate-500">{a.body}</span>}
                  </span>
                  {a.referenceType === 'SUBSCRIPTION' && (
                    <Link href="/billing" className="text-xs text-teal-700 underline whitespace-nowrap">Renew</Link>
                  )}
                  {a.referenceType === 'CUSTOMER' && a.referenceId && (
                    <Link href={`/customers/${a.referenceId}/statement`} className="text-xs text-teal-700 underline whitespace-nowrap">
                      Statement
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('dashboard')}</h2>

        {!businessId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <p className="text-amber-800 mb-3">{t('noBusiness')}</p>
            <Link
              href="/onboarding"
              className="inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
            >
              Set up your business
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t('todaysSales')}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {data ? formatMoney(data.today.sales) : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t('todaysProfit')}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {data ? formatMoney(data.today.grossProfit) : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t('transactions')}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.today.transactions ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t('lowStock')}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.alerts.lowStock ?? '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-medium text-slate-900 mb-2">{t('customerDebt')}</h3>
            <p className="text-xl font-semibold text-slate-800">
              {data ? formatMoney(data.alerts.customerDebt) : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-medium text-slate-900 mb-2">{t('supplierDebt')}</h3>
            <p className="text-xl font-semibold text-slate-800">
              {data ? formatMoney(data.alerts.supplierDebt) : '—'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-medium text-slate-900 mb-3">{t('quickActions')}</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/pos" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              Open POS
            </Link>
            <Link href="/products" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Products
            </Link>
            <Link href="/purchases" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Purchases
            </Link>
            <Link href="/stock-count" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Stock count
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
