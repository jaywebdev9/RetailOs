'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Pay = {
  id: string;
  businessName: string;
  businessPhone?: string | null;
  plan: string;
  months: number;
  amount: number;
  method: string;
  reference: string;
  payerPhone?: string | null;
  status: string;
  rejectReason?: string | null;
  createdAt: string;
};

type Biz = {
  id: string;
  name: string;
  phone?: string | null;
  isActive: boolean;
  ownerName: string;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  state: string;
  daysLeft: number | null;
  endsAt: string | null;
  plan: string | null;
  createdAt: string;
  businessType?: string;
};

type PlanRow = {
  id: string;
  code: string;
  name: string;
  months: number;
  priceTzs: number;
  isActive: boolean;
};

type Summary = {
  pendingPayments: number;
  revenueThisMonth: number;
  paymentsThisMonth: number;
  revenueAllTime: number;
  paymentsAllTime: number;
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  trialingSubscriptions: number;
  expiredSubscriptions: number;
};

type AuditRow = {
  id: string;
  action: string;
  businessName: string | null;
  actor: string;
  createdAt: string;
};

type AdminUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
};

type SearchUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isPlatformAdmin: boolean;
  isActive: boolean;
};

const money = (n: number) => `TZS ${Math.round(n).toLocaleString('en-TZ')}`;

type Tab =
  | 'overview'
  | 'payments'
  | 'tenants'
  | 'plans'
  | 'admins'
  | 'settings'
  | 'audit';

export default function AdminBillingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [payFilter, setPayFilter] = useState<'PENDING' | 'CONFIRMED' | 'REJECTED' | ''>('PENDING');
  const [pending, setPending] = useState<Pay[]>([]);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userHits, setUserHits] = useState<SearchUser[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [instructions, setInstructions] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const fail = (err: any, fallback: string) => {
    const msg = err.response?.data?.message;
    setError(Array.isArray(msg) ? msg.join(', ') : msg || fallback);
  };

  const loadCore = async () => {
    try {
      const [s, p, b, pl, st] = await Promise.all([
        api.get('/admin/billing/summary'),
        api.get('/admin/billing/payments', { params: { status: 'PENDING' } }),
        api.get('/admin/billing/businesses'),
        api.get('/admin/billing/plans'),
        api.get('/admin/billing/settings'),
      ]);
      setSummary(s.data);
      setPending(p.data);
      setBusinesses(b.data);
      setPlans(pl.data);
      setPrices(Object.fromEntries(pl.data.map((x: PlanRow) => [x.id, String(x.priceTzs)])));
      setInstructions(st.data.paymentInstructions || '');
      setSupportPhone(st.data.supportPhone || '');
      setMaintenanceMode(!!st.data.maintenanceMode);
      setMaintenanceMessage(st.data.maintenanceMessage || '');
    } catch (err: any) {
      if (err.response?.status === 403) setForbidden(true);
      else fail(err, 'Could not load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async (status: string) => {
    try {
      const res = await api.get('/admin/billing/payments', {
        params: status ? { status } : {},
      });
      setPayments(res.data);
    } catch (err) {
      fail(err, 'Could not load payments');
    }
  };

  const loadAudit = async () => {
    try {
      const res = await api.get('/admin/billing/audit', { params: { limit: 100 } });
      setAudit(res.data);
    } catch (err) {
      fail(err, 'Could not load audit log');
    }
  };

  const loadAdmins = async () => {
    try {
      const res = await api.get('/admin/billing/admins');
      setAdmins(res.data);
    } catch (err) {
      fail(err, 'Could not load admins');
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    loadCore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'payments') loadPayments(payFilter);
    if (tab === 'audit') loadAudit();
    if (tab === 'admins') loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, payFilter]);

  const filteredBiz = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.ownerName || '').toLowerCase().includes(q) ||
        (b.ownerPhone || '').includes(q) ||
        (b.phone || '').includes(q),
    );
  }, [businesses, search]);

  const confirm = async (p: Pay) => {
    if (
      !window.confirm(
        `Confirm ${money(p.amount)} from ${p.businessName}?\nRef: ${p.reference}`,
      )
    )
      return;
    setError(null);
    try {
      await api.post(`/admin/billing/payments/${p.id}/confirm`);
      setNote(`Confirmed: ${p.businessName}`);
      await loadCore();
      if (tab === 'payments') await loadPayments(payFilter);
    } catch (err) {
      fail(err, 'Confirm failed');
    }
  };

  const reject = async (p: Pay) => {
    const reason = window.prompt('Reason (owner will see it):');
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    try {
      await api.post(`/admin/billing/payments/${p.id}/reject`, {
        reason: reason.trim(),
      });
      setNote('Payment rejected');
      await loadCore();
      if (tab === 'payments') await loadPayments(payFilter);
    } catch (err) {
      fail(err, 'Reject failed');
    }
  };

  const grant = async (b: Biz) => {
    const days = Number(window.prompt(`Free days for ${b.name}?`, '7'));
    if (!(days > 0)) return;
    setError(null);
    try {
      await api.post(`/admin/billing/businesses/${b.id}/grant-days`, { days });
      setNote(`Granted ${days} days`);
      await loadCore();
      if (detail?.id === b.id) openDetail(b.id);
    } catch (err) {
      fail(err, 'Could not add days');
    }
  };

  const toggleActive = async (b: Biz) => {
    const next = !b.isActive;
    if (
      !window.confirm(
        next
          ? `Activate ${b.name}?`
          : `Suspend ${b.name}? Shop cannot operate until re-activated.`,
      )
    )
      return;
    setError(null);
    try {
      await api.post(`/admin/billing/businesses/${b.id}/set-active`, {
        isActive: next,
      });
      setNote(next ? 'Shop activated' : 'Shop suspended');
      await loadCore();
    } catch (err) {
      fail(err, 'Could not update shop');
    }
  };

  const forceExpire = async (b: Biz) => {
    if (!window.confirm(`Force expire subscription for ${b.name}?`)) return;
    setError(null);
    try {
      await api.post(`/admin/billing/businesses/${b.id}/force-expire`);
      setNote('Subscription expired');
      await loadCore();
    } catch (err) {
      fail(err, 'Could not expire');
    }
  };

  const openDetail = async (id: string) => {
    setError(null);
    try {
      const res = await api.get(`/admin/billing/businesses/${id}`);
      setDetail(res.data);
    } catch (err) {
      fail(err, 'Could not load shop detail');
    }
  };

  const savePlan = async (id: string, isActive?: boolean) => {
    setError(null);
    try {
      await api.patch(`/admin/billing/plans/${id}`, {
        priceTzs: Number(prices[id]),
        ...(isActive !== undefined ? { isActive } : {}),
      });
      setNote('Plan saved');
      await loadCore();
    } catch (err) {
      fail(err, 'Could not save plan');
    }
  };

  const saveSettings = async () => {
    setError(null);
    try {
      await api.put('/admin/billing/settings', {
        paymentInstructions: instructions,
        supportPhone,
        maintenanceMode,
        maintenanceMessage,
      });
      setNote('Settings saved');
    } catch (err) {
      fail(err, 'Could not save');
    }
  };

  const searchUsers = async () => {
    if (userQuery.trim().length < 2) return;
    try {
      const res = await api.get('/admin/billing/users/search', {
        params: { q: userQuery.trim() },
      });
      setUserHits(res.data);
    } catch (err) {
      fail(err, 'Search failed');
    }
  };

  const setAdminFlag = async (userId: string, isPlatformAdmin: boolean) => {
    setError(null);
    try {
      await api.post(`/admin/billing/users/${userId}/platform-admin`, {
        isPlatformAdmin,
      });
      setNote(isPlatformAdmin ? 'Admin granted' : 'Admin revoked');
      await loadAdmins();
      await searchUsers();
    } catch (err) {
      fail(err, 'Could not update admin');
    }
  };

  const setUserActive = async (userId: string, isActive: boolean) => {
    setError(null);
    try {
      await api.post(`/admin/billing/users/${userId}/set-active`, { isActive });
      setNote(isActive ? 'User activated' : 'User deactivated');
      await loadAdmins();
      await searchUsers();
    } catch (err) {
      fail(err, 'Could not update user');
    }
  };

  const exportPaymentsCsv = () => {
    const rows = payments.map((p) =>
      [
        p.createdAt,
        p.status,
        `"${p.businessName}"`,
        p.plan,
        p.amount,
        p.method,
        p.reference,
        p.payerPhone || '',
      ].join(','),
    );
    const csv = ['date,status,business,plan,amount,method,reference,payer', ...rows].join(
      '\n',
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${payFilter || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (forbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-center text-slate-600">
        This page is only for the Retail OS platform owner.
      </div>
    );
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'payments', label: 'Payments', badge: summary?.pendingPayments },
    { id: 'tenants', label: 'Shops' },
    { id: 'plans', label: 'Plans' },
    { id: 'admins', label: 'Admins' },
    { id: 'settings', label: 'Settings' },
    { id: 'audit', label: 'Audit' },
  ];

  const stateBadge = (s: string) =>
    s === 'ACTIVE'
      ? 'bg-teal-100 text-teal-800'
      : s === 'TRIALING'
        ? 'bg-sky-100 text-sky-800'
        : s === 'GRACE'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-red-100 text-red-800';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <Link href="/dashboard" className="text-sm text-slate-500">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">Platform admin</h1>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setDetail(null);
              }}
              className={`relative shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
                tab === t.id
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}
        {note && (
          <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">{note}</div>
        )}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {tab === 'overview' && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Pending payments', value: String(summary.pendingPayments) },
                { label: 'Revenue this month', value: money(summary.revenueThisMonth) },
                { label: 'Revenue all time', value: money(summary.revenueAllTime) },
                {
                  label: 'Shops',
                  value: `${summary.activeBusinesses} / ${summary.totalBusinesses}`,
                },
                { label: 'Suspended', value: String(summary.suspendedBusinesses) },
                { label: 'On trial', value: String(summary.trialingSubscriptions) },
                { label: 'Expired plans', value: String(summary.expiredSubscriptions) },
                {
                  label: 'Payments (month)',
                  value: String(summary.paymentsThisMonth),
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {k.label}
                  </p>
                  <p className="mt-2 text-base font-semibold tabular-nums text-slate-900">
                    {k.value}
                  </p>
                </div>
              ))}
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">
                Pending payments ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <p className="text-sm text-slate-500">None pending.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pending.slice(0, 8).map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="font-medium">{p.businessName}</p>
                        <p className="text-xs text-slate-500">
                          {p.plan} · {money(p.amount)} · {p.method} · {p.reference}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirm(p)}
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => reject(p)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === 'payments' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['PENDING', 'CONFIRMED', 'REJECTED', ''] as const).map((s) => (
                <button
                  key={s || 'ALL'}
                  type="button"
                  onClick={() => setPayFilter(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    payFilter === s
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {s || 'ALL'}
                </button>
              ))}
              <button
                type="button"
                onClick={exportPaymentsCsv}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Ref</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{p.businessName}</td>
                      <td className="px-4 py-3 tabular-nums">{money(p.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                      <td className="px-4 py-3 text-xs">{p.status}</td>
                      <td className="px-4 py-3 text-right">
                        {p.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => confirm(p)}
                              className="mr-2 text-xs font-semibold text-teal-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => reject(p)}
                              className="text-xs font-semibold text-rose-600"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">No rows.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'tenants' && !detail && (
          <div className="space-y-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shop, owner, phone…"
              className="h-10 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 text-sm"
            />
            <div className="space-y-2">
              {filteredBiz.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => openDetail(b.id)}
                        className="text-left font-semibold text-slate-900 hover:text-teal-800"
                      >
                        {b.name}
                      </button>
                      <p className="text-xs text-slate-500">
                        {b.ownerName} · {b.ownerPhone || '—'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateBadge(b.state)}`}
                    >
                      {b.state}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {b.plan || 'No plan'} ·{' '}
                    {b.daysLeft != null ? `${b.daysLeft}d left` : '—'} ·{' '}
                    {b.isActive ? 'Active' : 'Suspended'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openDetail(b.id)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => grant(b)}
                      className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"
                    >
                      Grant days
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(b)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        b.isActive ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {b.isActive ? 'Suspend' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => forceExpire(b)}
                      className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
                    >
                      Force expire
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'tenants' && detail && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="text-sm text-slate-500"
            >
              ← Back to list
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{detail.name}</h2>
              <p className="text-sm text-slate-500">
                {detail.phone || '—'} · {detail.businessType} ·{' '}
                {detail.isActive ? 'Active' : 'Suspended'}
              </p>
              {detail.subscription && (
                <p className="mt-2 text-sm">
                  Plan: {detail.subscription.plan || '—'} · {detail.subscription.state} ·{' '}
                  {detail.subscription.daysLeft != null
                    ? `${detail.subscription.daysLeft} days left`
                    : ''}
                </p>
              )}
              <h3 className="mt-4 text-sm font-semibold">Team</h3>
              <ul className="mt-1 space-y-1 text-sm text-slate-600">
                {(detail.members || []).map((m: any) => (
                  <li key={m.id}>
                    {m.name} · {m.role}
                    {m.isOwner ? ' (owner)' : ''} · {m.phone || m.email || '—'}
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 text-sm font-semibold">Payments</h3>
              <ul className="mt-1 divide-y divide-slate-100 text-sm">
                {(detail.payments || []).map((p: any) => (
                  <li key={p.id} className="flex justify-between py-2">
                    <span>
                      {p.plan} · {p.status} · {p.reference}
                    </span>
                    <span className="tabular-nums">{money(p.amount)}</span>
                  </li>
                ))}
                {(detail.payments || []).length === 0 && (
                  <li className="py-2 text-slate-500">No payments</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {tab === 'plans' && (
          <div className="space-y-3">
            {plans.map((pl) => (
              <div
                key={pl.id}
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-[120px]">
                  <p className="font-semibold">{pl.name}</p>
                  <p className="text-xs text-slate-500">
                    {pl.code} · {pl.months} mo
                  </p>
                </div>
                <input
                  type="number"
                  value={prices[pl.id] ?? ''}
                  onChange={(e) =>
                    setPrices((prev) => ({ ...prev, [pl.id]: e.target.value }))
                  }
                  className="h-9 w-32 rounded-lg border border-slate-200 px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => savePlan(pl.id)}
                  className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => savePlan(pl.id, !pl.isActive)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"
                >
                  {pl.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'admins' && (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Platform admins</h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {admins.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-slate-500">
                        {a.email || a.phone || '—'}
                        {!a.isActive && ' · inactive'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminFlag(a.id, false)}
                      className="text-xs font-semibold text-rose-600"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
                {admins.length === 0 && (
                  <li className="py-2 text-sm text-slate-500">No admins listed.</li>
                )}
              </ul>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Find user</h2>
              <div className="mt-2 flex gap-2">
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Name, phone or email"
                  className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={searchUsers}
                  className="rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"
                >
                  Search
                </button>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {userHits.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-slate-500">
                        {u.email || u.phone || '—'}
                        {u.isPlatformAdmin && ' · admin'}
                        {!u.isActive && ' · inactive'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!u.isPlatformAdmin ? (
                        <button
                          type="button"
                          onClick={() => setAdminFlag(u.id, true)}
                          className="text-xs font-semibold text-teal-700"
                        >
                          Make admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAdminFlag(u.id, false)}
                          className="text-xs font-semibold text-rose-600"
                        >
                          Revoke admin
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setUserActive(u.id, !u.isActive)}
                        className="text-xs font-semibold text-slate-600"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {tab === 'settings' && (
          <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <label className="text-xs font-medium text-slate-500">Support phone</label>
              <input
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">
                Payment instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
              />
              Maintenance mode (flag stored for platform use)
            </label>
            <div>
              <label className="text-xs font-medium text-slate-500">
                Maintenance message
              </label>
              <input
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={saveSettings}
              className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Save settings
            </button>
          </div>
        )}

        {tab === 'audit' && (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {audit.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">
                      {a.action}
                    </span>
                    <span className="text-slate-600">{a.businessName || '—'}</span>
                    <span className="text-xs text-slate-400">by {a.actor}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
              {audit.length === 0 && (
                <li className="p-6 text-center text-sm text-slate-500">No actions yet.</li>
              )}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
