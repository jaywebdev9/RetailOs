'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { downloadCsv } from '@/lib/download';

type Profit = {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  transactions: number;
};

export default function ReportsPage() {
  const router = useRouter();
  const [profit, setProfit] = useState<Profit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    if (!businessId) return;

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    api
      .get('/reports/profit', {
        headers: { 'x-business-id': businessId },
        params: {
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
        },
      })
      .then((res) => setProfit(res.data))
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }, [router, businessId]);

  const exportCsv = async (kind: 'sales' | 'stock' | 'customer-debts') => {
    if (!businessId) return;
    setError(null);
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      await downloadCsv(
        `/reports/export/${kind}`,
        `${kind}.csv`,
        businessId,
        kind === 'sales' ? { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } : undefined,
      );
    } catch {
      setError('Export failed (you may not have permission)');
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Profit report</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 bg-white rounded-xl border p-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500 mr-2">Download for Excel:</span>
          <button onClick={() => exportCsv('sales')} className="rounded-lg border px-3 py-1.5 text-sm">Sales (30 days)</button>
          <button onClick={() => exportCsv('stock')} className="rounded-lg border px-3 py-1.5 text-sm">Stock &amp; value</button>
          <button onClick={() => exportCsv('customer-debts')} className="rounded-lg border px-3 py-1.5 text-sm">Customer debts</button>
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !profit ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">No data</div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
            <p className="text-sm text-slate-500">
              {profit.from} → {profit.to} · {profit.transactions} transactions
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Revenue</p>
                <p className="text-xl font-semibold">{fmt(profit.revenue)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">COGS</p>
                <p className="text-xl font-semibold">{fmt(profit.cogs)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Gross profit</p>
                <p className="text-xl font-semibold text-teal-700">{fmt(profit.grossProfit)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Operating expenses</p>
                <p className="text-xl font-semibold">{fmt(profit.operatingExpenses)}</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-slate-500">Net profit</p>
              <p className={`text-2xl font-bold ${profit.netProfit >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                {fmt(profit.netProfit)}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Net profit = Gross profit − Operating expenses. Owner withdrawals are not included in expenses.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
