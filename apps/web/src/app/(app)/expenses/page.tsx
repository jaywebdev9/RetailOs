'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

type Category = { id: string; name: string };
type Expense = {
  id: string;
  amount: string | number;
  description?: string;
  expenseDate: string;
  category: { name: string };
};

export default function ExpensesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ categoryId: '', amount: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = async () => {
    if (!businessId) return;
    try {
      const [eRes, cRes] = await Promise.all([
        api.get('/expenses', { headers: { 'x-business-id': businessId } }),
        api.get('/expenses/categories', { headers: { 'x-business-id': businessId } }),
      ]);
      setItems(eRes.data || []);
      setCategories(cRes.data || []);
      if (cRes.data?.[0]) setForm((f) => ({ ...f, categoryId: cRes.data[0].id }));
    } catch {
      setError('Failed to load expenses');
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
      await api.post(
        '/expenses',
        { categoryId: form.categoryId, amount: Number(form.amount), description: form.description || undefined },
        { headers: { 'x-business-id': businessId } },
      );
      setShowForm(false);
      setForm((f) => ({ ...f, amount: '', description: '' }));
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Create failed');
    }
  };

  const total = items.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
            <h1 className="text-lg font-semibold">Expenses</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white">
            {showForm ? 'Cancel' : 'Add expense'}
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <div className="mb-4 text-sm text-slate-600">Total listed: <strong>{total.toLocaleString()} TZS</strong></div>
        {showForm && (
          <form onSubmit={create} className="mb-6 bg-white rounded-xl border p-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input required type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white">Save</button>
          </form>
        )}
        {loading ? <p className="text-slate-500">Loading…</p> : items.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">No expenses recorded.</div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{new Date(x.expenseDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{x.category?.name}</td>
                    <td className="px-4 py-3 text-slate-500">{x.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{Number(x.amount).toLocaleString()}</td>
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
