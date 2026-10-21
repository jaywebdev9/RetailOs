'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

type SaleItem = {
  id: string;
  productId: string;
  quantity: string | number;
  sellingPrice: string | number;
  total: string | number;
  product: { name: string };
};

type Sale = {
  id: string;
  receiptNumber: string;
  total: string | number;
  status: string;
  items: SaleItem[];
};

export default function ReturnsPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    if (!businessId) return;
    api
      .get('/sales', { headers: { 'x-business-id': businessId }, params: { limit: 30 } })
      .then((res) => setSales((res.data.items || []).filter((s: Sale) => s.status === 'COMPLETED' || s.status === 'PARTIALLY_RETURNED')))
      .catch(() => setError('Failed to load sales'))
      .finally(() => setLoading(false));
  }, [router, businessId]);

  const loadSale = async (id: string) => {
    if (!businessId) return;
    const res = await api.get(`/sales/${id}`, { headers: { 'x-business-id': businessId } });
    setSelected(res.data);
    const init: Record<string, string> = {};
    res.data.items?.forEach((i: SaleItem) => { init[i.id] = '0'; });
    setQty(init);
  };

  const submitReturn = async () => {
    if (!businessId || !selected) return;
    setError(null);
    const items = selected.items
      .filter((i) => Number(qty[i.id] || 0) > 0)
      .map((i) => {
        const q = Number(qty[i.id]);
        const unit = Number(i.sellingPrice);
        return {
          saleItemId: i.id,
          productId: i.productId,
          quantity: q,
          refundAmount: q * unit,
        };
      });
    if (items.length === 0) {
      setError('Select at least one item quantity to return');
      return;
    }
    try {
      await api.post(
        '/sales/returns',
        { saleId: selected.id, items, reason: reason || undefined },
        { headers: { 'x-business-id': businessId } },
      );
      setMessage('Return processed — stock restored');
      setSelected(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Return failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Sales returns</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {message && <div className="mb-4 rounded-lg bg-orange-50 text-teal-700 text-sm px-3 py-2">{message}</div>}

        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !selected ? (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{s.receiptNumber}</td>
                    <td className="px-4 py-3">{s.status}</td>
                    <td className="px-4 py-3 text-right">{Number(s.total).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => loadSale(s.id)} className="text-teal-700 text-xs font-medium hover:underline">
                        Return items
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No returnable sales</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-medium">Return — {selected.receiptNumber}</h2>
              <button onClick={() => setSelected(null)} className="text-sm text-slate-500">Back</button>
            </div>
            {selected.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                <div>
                  <p className="font-medium">{i.product?.name}</p>
                  <p className="text-slate-500">Sold: {i.quantity} @ {Number(i.sellingPrice).toLocaleString()}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={Number(i.quantity)}
                  value={qty[i.id] || '0'}
                  onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                  className="w-20 rounded border px-2 py-1 text-right"
                  placeholder="Qty"
                />
              </div>
            ))}
            <input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button onClick={submitReturn} className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white">
              Process return
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
