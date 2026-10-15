'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

type CountItem = {
  id: string;
  productId: string;
  expectedQuantity: string | number;
  physicalQuantity?: string | number;
  product: { name: string; sku?: string };
};

type StockCount = {
  id: string;
  status: string;
  items: CountItem[];
};

export default function StockCountPage() {
  const router = useRouter();
  const [count, setCount] = useState<StockCount | null>(null);
  const [physical, setPhysical] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = async () => {
    if (!businessId) return;
    try {
      const res = await api.get('/inventory/stock-counts/active', {
        headers: { 'x-business-id': businessId },
      });
      setCount(res.data || null);
      if (res.data?.items) {
        const init: Record<string, string> = {};
        res.data.items.forEach((i: CountItem) => {
          init[i.productId] = String(i.expectedQuantity);
        });
        setPhysical(init);
      }
    } catch {
      setCount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    load();
  }, [router]);

  const start = async () => {
    if (!businessId) return;
    setError(null);
    try {
      const res = await api.post('/inventory/stock-counts', {}, {
        headers: { 'x-business-id': businessId },
      });
      setCount(res.data);
      const init: Record<string, string> = {};
      res.data.items?.forEach((i: CountItem) => {
        init[i.productId] = String(i.expectedQuantity);
      });
      setPhysical(init);
      setMessage('Stock count started');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start');
    }
  };

  const complete = async () => {
    if (!businessId || !count) return;
    setError(null);
    try {
      const items = count.items.map((i) => ({
        productId: i.productId,
        physicalQuantity: Number(physical[i.productId] ?? i.expectedQuantity),
        reason: reasons[i.productId] || undefined,
      }));
      await api.post(`/inventory/stock-counts/${count.id}/complete`, { items }, {
        headers: { 'x-business-id': businessId },
      });
      setMessage('Stock count completed — adjustments applied');
      setCount(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
            <h1 className="text-lg font-semibold">Stock count</h1>
          </div>
          {!count && (
            <button onClick={start} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
              Start stock count
            </button>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {message && <div className="mb-4 rounded-lg bg-teal-50 text-teal-700 text-sm px-3 py-2">{message}</div>}
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !count ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
            No active stock count. Start one to compare system vs physical stock.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Expected</th>
                    <th className="px-4 py-3 text-right">Physical</th>
                    <th className="px-4 py-3">Reason (if variance)</th>
                  </tr>
                </thead>
                <tbody>
                  {count.items.map((i) => {
                    const exp = Number(i.expectedQuantity);
                    const phy = Number(physical[i.productId] ?? exp);
                    const diff = phy - exp;
                    return (
                      <tr key={i.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">{i.product?.name}</td>
                        <td className="px-4 py-3 text-right">{exp}</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            value={physical[i.productId] ?? ''}
                            onChange={(e) => setPhysical({ ...physical, [i.productId]: e.target.value })}
                            className="w-24 rounded border px-2 py-1 text-right text-sm"
                          />
                          {diff !== 0 && (
                            <span className={`ml-2 text-xs ${diff < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {diff !== 0 && (
                            <input
                              placeholder="missing / damaged / counting error…"
                              value={reasons[i.productId] || ''}
                              onChange={(e) => setReasons({ ...reasons, [i.productId]: e.target.value })}
                              className="w-full rounded border px-2 py-1 text-sm"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={complete} className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-medium text-white">
              Complete count & apply adjustments
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
