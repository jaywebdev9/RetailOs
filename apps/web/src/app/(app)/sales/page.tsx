'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { AppShell, EmptyState, StatusBadge } from '@/components/AppShell';

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

const fmt = (n: string | number) => Number(n).toLocaleString();

export default function SalesHistoryPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const businessId =
    typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = () => {
    if (!businessId) return;
    setLoading(true);
    api
      .get('/sales', {
        headers: { 'x-business-id': businessId },
        params: { limit: 50 },
      })
      .then((res) => setSales(res.data.items || []))
      .catch(() => setError('Failed to load sales'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, businessId]);

  const voidSale = async (sale: Sale) => {
    const reason = window.prompt(
      `Why void ${sale.receiptNumber}? (stock, debt and cash will be reversed)`,
    );
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    try {
      await api.post(
        `/sales/${sale.id}/void`,
        { reason: reason.trim() },
        { headers: { 'x-business-id': businessId! } },
      );
      load();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not void sale');
    }
  };

  const headerActions = (
    <Link
      href="/pos"
      className="inline-flex items-center rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 sm:text-sm"
    >
      Open POS
    </Link>
  );

  return (
    <AppShell title="Sales history" breadcrumb="Manage business" actions={headerActions}>
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          title="No sales yet"
          description="Make your first sale from the POS."
          action={
            <Link
              href="/pos"
              className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Open POS
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile cards — full details, no cut-off */}
          <div className="space-y-3 md:hidden">
            {sales.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-slate-500">
                      {s.receiptNumber}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {s.items
                        ?.map((i) => `${i.product?.name} ×${i.quantity}`)
                        .join(', ') || '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Total
                    </p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                      {fmt(s.total)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/invoice/${s.id}`}
                      className="text-xs font-semibold text-teal-700"
                    >
                      Invoice
                    </Link>
                    {s.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => voidSale(s)}
                        className="text-xs font-semibold text-rose-600"
                      >
                        Void
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:block">
            <div className="table-scroll">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Receipt</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Items</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Total</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">
                        {s.receiptNumber}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3.5 text-slate-600">
                        {s.items
                          ?.map((i) => `${i.product?.name} ×${i.quantity}`)
                          .join(', ')}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        {fmt(s.total)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/invoice/${s.id}`}
                          className="mr-3 text-xs font-semibold text-teal-700 hover:underline"
                        >
                          Invoice
                        </Link>
                        {s.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => voidSale(s)}
                            className="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
