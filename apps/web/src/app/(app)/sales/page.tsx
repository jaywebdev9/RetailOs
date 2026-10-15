'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

type Sale = {
  id: string;
  receiptNumber: string;
  total: string | number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  customer?: { name: string };
  cashier?: { firstName: string };
  items: { quantity: string; product: { name: string } }[];
};

export default function SalesHistoryPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = () => {
    if (!businessId) return;
    api
      .get('/sales', { headers: { 'x-business-id': businessId }, params: { limit: 50 } })
      .then((res) => setSales(res.data.items || []))
      .catch(() => setError('Failed to load sales'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, businessId]);

  const voidSale = async (sale: Sale) => {
    const reason = window.prompt(`Why void ${sale.receiptNumber}? (stock, debt and cash will be reversed)`);
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    try {
      await api.post(`/sales/${sale.id}/void`, { reason: reason.trim() }, {
        headers: { 'x-business-id': businessId! },
      });
      load();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not void sale');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
            <h1 className="text-lg font-semibold">Sales history</h1>
          </div>
          <Link href="/pos" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">Open POS</Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {loading ? <p className="text-slate-500">Loading…</p> : sales.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">No sales yet. Make your first sale from POS.</div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{s.receiptNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.items?.map((i) => `${i.product?.name} ×${i.quantity}`).join(', ')}
                    </td>
                    <td className="px-4 py-3"><span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">{s.status}</span></td>
                    <td className="px-4 py-3 text-right font-medium">{Number(s.total).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/invoice/${s.id}`} className="text-xs text-teal-700 hover:underline mr-3">Invoice</Link>
                      {s.status === 'COMPLETED' && (
                        <button onClick={() => voidSale(s)} className="text-xs text-red-600 hover:underline">Void</button>
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
