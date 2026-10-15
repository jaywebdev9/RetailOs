'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

type Supplier = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  outstandingBalance?: number;
};

export default function SuppliersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [payFor, setPayFor] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [payAmount, setPayAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = async () => {
    if (!businessId) return;
    try {
      const res = await api.get('/suppliers', { headers: { 'x-business-id': businessId } });
      const list = res.data || [];
      // Enrich with balances
      const enriched = await Promise.all(
        list.map(async (s: Supplier) => {
          try {
            const d = await api.get(`/suppliers/${s.id}`, { headers: { 'x-business-id': businessId } });
            return { ...s, outstandingBalance: d.data.outstandingBalance ?? 0 };
          } catch {
            return { ...s, outstandingBalance: 0 };
          }
        }),
      );
      setItems(enriched);
    } catch {
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    load();
  }, [router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    try {
      await api.post('/suppliers', form, { headers: { 'x-business-id': businessId } });
      setShowForm(false);
      setForm({ name: '', phone: '', email: '' });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Create failed');
    }
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !payFor) return;
    try {
      await api.post(
        `/suppliers/${payFor.id}/payments`,
        { amount: Number(payAmount) },
        { headers: { 'x-business-id': businessId } },
      );
      setMessage(`Payment recorded for ${payFor.name}`);
      setPayFor(null);
      setPayAmount('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Payment failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
            <h1 className="text-lg font-semibold">Suppliers</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            {showForm ? 'Cancel' : 'Add supplier'}
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {message && <div className="mb-4 rounded-lg bg-teal-50 text-teal-700 text-sm px-3 py-2">{message}</div>}
        {showForm && (
          <form onSubmit={create} className="mb-6 bg-white rounded-xl border p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">Save</button>
          </form>
        )}
        {payFor && (
          <form onSubmit={pay} className="mb-6 bg-white rounded-xl border p-5 flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-sm font-medium mb-1">Pay {payFor.name}</p>
              <p className="text-xs text-slate-500 mb-2">Outstanding: {(payFor.outstandingBalance ?? 0).toLocaleString()} TZS</p>
              <input required type="number" placeholder="Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="rounded-lg border px-3 py-2 text-sm w-40" />
            </div>
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">Record payment</button>
            <button type="button" onClick={() => setPayFor(null)} className="text-sm text-slate-500">Cancel</button>
          </form>
        )}
        {loading ? <p className="text-slate-500">Loading…</p> : items.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">No suppliers yet.</div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Balance owed</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.phone || '—'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${(s.outstandingBalance ?? 0) > 0 ? 'text-red-600' : ''}`}>
                      {(s.outstandingBalance ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(s.outstandingBalance ?? 0) > 0 && (
                        <button onClick={() => setPayFor(s)} className="text-teal-700 text-xs font-medium hover:underline">
                          Pay
                        </button>
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
