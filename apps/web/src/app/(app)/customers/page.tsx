'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

type Customer = {
  id: string;
  name: string;
  phone?: string;
  outstandingBalance: number;
  creditLimit: string | number;
  customerType: 'RETAIL' | 'WHOLESALE';
  paymentTermsDays: number;
};

type Overdue = {
  customerId: string;
  name: string;
  phone: string | null;
  balance: number;
  overdueAmount: number;
  daysOverdue: number;
  d1_30: number;
  d31_60: number;
  d60plus: number;
};

const money = (n: number) => Math.round(n).toLocaleString();

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [tab, setTab] = useState<'all' | 'overdue'>('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', creditLimit: '0', customerType: 'RETAIL', paymentTermsDays: '0',
  });
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;
  const hdr = { headers: { 'x-business-id': businessId! } };

  const fail = (err: any, fallback: string) => {
    const msg = err.response?.data?.message;
    setError(Array.isArray(msg) ? msg.join(', ') : msg || fallback);
  };

  const load = async () => {
    if (!businessId) return;
    try {
      const [all, od] = await Promise.all([
        api.get('/customers', hdr),
        api.get('/customers/overdue', hdr).catch(() => ({ data: [] })),
      ]);
      setCustomers(all.data || []);
      setOverdue(od.data || []);
    } catch {
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setError(null);
    try {
      await api.post('/customers', {
        name: form.name,
        phone: form.phone || undefined,
        creditLimit: Number(form.creditLimit) || 0,
        customerType: form.customerType,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
      }, hdr);
      setShowForm(false);
      setForm({ name: '', phone: '', creditLimit: '0', customerType: 'RETAIL', paymentTermsDays: '0' });
      await load();
    } catch (err) { fail(err, 'Create failed'); }
  };

  const recordPayment = async (customerId: string) => {
    const amount = Number(payAmount);
    if (!(amount > 0)) return;
    setError(null);
    try {
      await api.post(`/customers/${customerId}/payments`, { amount }, hdr);
      setPayFor(null);
      setPayAmount('');
      await load();
    } catch (err) { fail(err, 'Could not record payment'); }
  };

  const changeType = async (c: Customer, customerType: string) => {
    setError(null);
    try {
      await api.patch(`/customers/${c.id}`, { customerType }, hdr);
      await load();
    } catch (err) { fail(err, 'Update failed'); }
  };

  const totalOverdue = overdue.reduce((s, o) => s + o.overdueAmount, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
            <h1 className="text-lg font-semibold">Customers</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white">
            {showForm ? 'Cancel' : 'Add customer'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        {showForm && (
          <form onSubmit={create} className="mb-6 bg-white rounded-xl border p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <input required placeholder="Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <input placeholder="Phone" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <select value={form.customerType}
              onChange={(e) => setForm({ ...form, customerType: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
              <option value="RETAIL">Retail customer</option>
              <option value="WHOLESALE">Wholesale customer</option>
            </select>
            <input type="number" placeholder="Credit limit (0 = none set)" value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <input type="number" placeholder="Pays within (days)" value={form.paymentTermsDays}
              onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white">Save</button>
          </form>
        )}

        <div className="mb-4 flex gap-2 text-sm">
          <button onClick={() => setTab('all')}
            className={`rounded-full px-4 py-1.5 ${tab === 'all' ? 'bg-slate-800 text-white' : 'bg-white border'}`}>
            All customers
          </button>
          <button onClick={() => setTab('overdue')}
            className={`rounded-full px-4 py-1.5 ${tab === 'overdue' ? 'bg-red-600 text-white' : 'bg-white border'}`}>
            Overdue ({overdue.length}){totalOverdue > 0 && ` · ${money(totalOverdue)}`}
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : tab === 'overdue' ? (
          overdue.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-slate-500">Nobody is overdue. 🎉</div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Overdue</th>
                    <th className="px-4 py-3 text-right">1–30 d</th>
                    <th className="px-4 py-3 text-right">31–60 d</th>
                    <th className="px-4 py-3 text-right">60+ d</th>
                    <th className="px-4 py-3 text-right">Oldest</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((o) => (
                    <tr key={o.customerId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">
                        {o.name}
                        {o.phone && <span className="block text-xs text-slate-400">{o.phone}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{money(o.overdueAmount)}</td>
                      <td className="px-4 py-3 text-right">{o.d1_30 ? money(o.d1_30) : '—'}</td>
                      <td className="px-4 py-3 text-right">{o.d31_60 ? money(o.d31_60) : '—'}</td>
                      <td className="px-4 py-3 text-right">{o.d60plus ? money(o.d60plus) : '—'}</td>
                      <td className="px-4 py-3 text-right">{o.daysOverdue} days</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/customers/${o.customerId}/statement`} className="text-teal-700 text-xs underline mr-3">Statement</Link>
                        {o.phone && (
                          <a
                            href={`https://wa.me/${o.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Hello ${o.name}, a friendly reminder: you have an overdue balance of ${money(o.overdueAmount)} TZS. Please pay when you can. Thank you.`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-green-700 underline"
                          >
                            WhatsApp
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">No customers yet.</div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Balance owed</th>
                  <th className="px-4 py-3 text-right">Credit limit</th>
                  <th className="px-4 py-3 text-right">Terms</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">
                      {c.name}
                      {c.phone && <span className="block text-xs text-slate-400">{c.phone}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select value={c.customerType} onChange={(e) => changeType(c, e.target.value)}
                        className="rounded border px-2 py-1 text-xs">
                        <option value="RETAIL">Retail</option>
                        <option value="WHOLESALE">Wholesale</option>
                      </select>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${c.outstandingBalance > 0 ? 'text-red-600' : ''}`}>
                      {money(c.outstandingBalance)}
                    </td>
                    <td className="px-4 py-3 text-right">{Number(c.creditLimit) > 0 ? money(Number(c.creditLimit)) : '—'}</td>
                    <td className="px-4 py-3 text-right">{c.paymentTermsDays ? `${c.paymentTermsDays} d` : '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {payFor === c.id ? (
                        <span className="inline-flex gap-1">
                          <input type="number" autoFocus value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="Amount" className="w-24 rounded border px-2 py-1 text-xs" />
                          <button onClick={() => recordPayment(c.id)} className="rounded bg-orange-500 text-white px-2 text-xs">Save</button>
                          <button onClick={() => setPayFor(null)} className="text-xs text-slate-500">✕</button>
                        </span>
                      ) : (
                        <>
                          {c.outstandingBalance > 0 && (
                            <button onClick={() => { setPayFor(c.id); setPayAmount(''); }} className="text-xs text-teal-700 underline mr-3">
                              Receive payment
                            </button>
                          )}
                          <Link href={`/customers/${c.id}/statement`} className="text-xs text-slate-600 underline">Statement</Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
