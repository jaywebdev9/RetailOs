'use client';

import { useEffect, useState } from 'react';
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
  createdAt: string;
};

type Biz = {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone?: string | null;
  state: string;
  daysLeft: number | null;
  endsAt: string | null;
  plan: string | null;
};

type PlanRow = { id: string; code: string; name: string; months: number; priceTzs: number; isActive: boolean };

const money = (n: number) => Math.round(n).toLocaleString('en-TZ');

/** Platform owner only. Confirm mobile-money payments, see every shop's plan, edit prices. */
export default function AdminBillingPage() {
  const router = useRouter();
  const [pending, setPending] = useState<Pay[]>([]);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fail = (err: any, fallback: string) => {
    const msg = err.response?.data?.message;
    setError(Array.isArray(msg) ? msg.join(', ') : msg || fallback);
  };

  const load = async () => {
    try {
      const [p, b, pl, st] = await Promise.all([
        api.get('/admin/billing/payments', { params: { status: 'PENDING' } }),
        api.get('/admin/billing/businesses'),
        api.get('/admin/billing/plans'),
        api.get('/admin/billing/settings'),
      ]);
      setPending(p.data);
      setBusinesses(b.data);
      setPlans(pl.data);
      setPrices(Object.fromEntries(pl.data.map((x: PlanRow) => [x.id, String(x.priceTzs)])));
      setInstructions(st.data.paymentInstructions || '');
      setSupportPhone(st.data.supportPhone || '');
    } catch (err: any) {
      if (err.response?.status === 403) setForbidden(true);
      else fail(err, 'Could not load');
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async (p: Pay) => {
    if (!window.confirm(`Confirm ${money(p.amount)} TZS from ${p.businessName}?\nReference: ${p.reference}\nCheck it in your mobile-money account first.`)) return;
    setError(null);
    try {
      await api.post(`/admin/billing/payments/${p.id}/confirm`);
      setNote(`Confirmed: ${p.businessName} extended by ${p.months} month(s)`);
      await load();
    } catch (err) { fail(err, 'Confirm failed'); }
  };

  const reject = async (p: Pay) => {
    const reason = window.prompt('Reason for rejecting (the owner will see it):');
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    try {
      await api.post(`/admin/billing/payments/${p.id}/reject`, { reason: reason.trim() });
      await load();
    } catch (err) { fail(err, 'Reject failed'); }
  };

  const grant = async (b: Biz) => {
    const days = Number(window.prompt(`Give ${b.name} how many free days?`, '7'));
    if (!(days > 0)) return;
    setError(null);
    try {
      await api.post(`/admin/billing/businesses/${b.id}/grant-days`, { days });
      await load();
    } catch (err) { fail(err, 'Could not add days'); }
  };

  const savePlan = async (id: string, isActive?: boolean) => {
    setError(null);
    try {
      await api.patch(`/admin/billing/plans/${id}`, {
        priceTzs: Number(prices[id]),
        ...(isActive !== undefined ? { isActive } : {}),
      });
      setNote('Plan saved');
      await load();
    } catch (err) { fail(err, 'Could not save plan'); }
  };

  const saveSettings = async () => {
    setError(null);
    try {
      await api.put('/admin/billing/settings', { paymentInstructions: instructions, supportPhone });
      setNote('Payment instructions saved');
    } catch (err) { fail(err, 'Could not save'); }
  };

  if (forbidden) {
    return <div className="p-8 text-center text-slate-600">This page is only for the Retail OS owner.</div>;
  }

  const badge = (s: string) =>
    s === 'ACTIVE' ? 'bg-teal-100 text-teal-800'
    : s === 'TRIALING' ? 'bg-sky-100 text-sky-800'
    : s === 'GRACE' ? 'bg-amber-100 text-amber-800'
    : 'bg-red-100 text-red-800';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Billing admin</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {note && <div className="rounded-lg bg-teal-50 text-teal-800 text-sm px-3 py-2">{note}</div>}

        <section>
          <h2 className="font-semibold mb-2">Payments waiting ({pending.length})</h2>
          {pending.length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-center text-slate-500 text-sm">Nothing to confirm.</div>
          ) : (
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Shop</th><th className="px-4 py-2">Plan</th>
                    <th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Paid with</th>
                    <th className="px-4 py-2">Reference</th><th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{p.businessName}
                        <span className="block text-xs text-slate-400">{p.payerPhone || p.businessPhone || ''}</span>
                      </td>
                      <td className="px-4 py-2">{p.plan}</td>
                      <td className="px-4 py-2 text-right">{money(p.amount)}</td>
                      <td className="px-4 py-2">{p.method}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.reference}
                        <span className="block text-slate-400">{new Date(p.createdAt).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={() => confirm(p)} className="rounded bg-teal-700 text-white px-3 py-1 text-xs mr-2">Confirm</button>
                        <button onClick={() => reject(p)} className="rounded border border-red-300 text-red-600 px-3 py-1 text-xs">Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold">Plan prices (TZS)</h2>
            {plans.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-28">{p.name}</span>
                <input type="number" value={prices[p.id] ?? ''} onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })}
                  className="w-32 rounded border px-2 py-1" />
                <button onClick={() => savePlan(p.id)} className="rounded border px-2 py-1 text-xs">Save</button>
                <button onClick={() => savePlan(p.id, !p.isActive)} className="text-xs text-slate-500 underline">
                  {p.isActive ? 'Switch off' : 'Switch on'}
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500">Changing a price only affects new payments.</p>
          </div>

          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold">How owners pay you</h2>
            <textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder={'Send the amount to M-Pesa 0712 000 000 (Name).\nThen enter the transaction ID.'}
              className="w-full rounded border px-3 py-2 text-sm" />
            <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="Support phone / WhatsApp"
              className="w-full rounded border px-3 py-2 text-sm" />
            <button onClick={saveSettings} className="rounded bg-teal-700 text-white px-3 py-1.5 text-sm">Save</button>
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">All shops ({businesses.length})</h2>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Shop</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Plan</th><th className="px-4 py-2">Ends</th><th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{b.name}</td>
                    <td className="px-4 py-2">{b.ownerName}<span className="block text-xs text-slate-400">{b.ownerPhone}</span></td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${badge(b.state)}`}>{b.state}</span></td>
                    <td className="px-4 py-2">{b.plan || '—'}</td>
                    <td className="px-4 py-2">
                      {b.endsAt ? new Date(b.endsAt).toLocaleDateString() : '—'}
                      {b.daysLeft !== null && <span className="block text-xs text-slate-400">{b.daysLeft} day(s)</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => grant(b)} className="text-xs text-teal-700 underline">+ free days</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
