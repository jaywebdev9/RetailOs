'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

type Item = {
  id: string;
  quantity: string | number;
  sellingPrice: string | number;
  total: string | number;
  packName?: string | null;
  packQuantity?: string | number | null;
  product: { name: string; sku?: string };
};

type Sale = {
  receiptNumber: string;
  createdAt: string;
  status: string;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  paymentStatus: string;
  items: Item[];
  payments: { amount: string | number; paymentMethod: { name: string } }[];
  customer?: { name: string; phone?: string; address?: string } | null;
  cashier?: { firstName: string; lastName?: string };
};

const fmt = (n: string | number) => Number(n).toLocaleString('en-TZ', { maximumFractionDigits: 2 });

/** Printable A4 invoice, or delivery note (?type=delivery → no prices, with signature boxes). */
export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qs = useSearchParams();
  const [sale, setSale] = useState<Sale | null>(null);
  const [bizName, setBizName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const delivery = qs.get('type') === 'delivery';

  useEffect(() => {
    const bid = localStorage.getItem('businessId');
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    if (!bid) return;
    api.get(`/sales/${id}`, { headers: { 'x-business-id': bid } })
      .then((r) => setSale(r.data))
      .catch(() => setError('Could not load this sale'));
    api.get('/users/me/businesses')
      .then((r) => {
        const m = (r.data || []).find((x: any) => x.business?.id === bid);
        if (m) setBizName(m.business.name);
      })
      .catch(() => {});
  }, [id, router]);

  const paid = sale ? sale.payments.reduce((s, p) => s + Number(p.amount), 0) : 0;
  const due = sale ? Math.max(Number(sale.total) - paid, 0) : 0;
  const qtyLabel = (i: Item) =>
    i.packName ? `${fmt(i.packQuantity ?? 0)} ${i.packName} (${fmt(i.quantity)} units)` : fmt(i.quantity);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden max-w-3xl mx-auto px-4 pt-4 flex gap-2">
        <button onClick={() => router.back()} className="text-sm text-slate-500 mr-auto">← Back</button>
        <button
          onClick={() => router.replace(`/invoice/${id}${delivery ? '' : '?type=delivery'}`)}
          className="rounded border px-3 py-1 text-sm bg-white"
        >
          Show {delivery ? 'invoice' : 'delivery note'}
        </button>
        <button onClick={() => window.print()} className="rounded bg-teal-700 text-white px-3 py-1 text-sm">
          Print / Save PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {!sale ? (
          !error && <p className="text-slate-500">Loading…</p>
        ) : (
          <div className="bg-white rounded-xl border p-8 print:border-0 print:p-0 text-sm">
            <div className="flex justify-between">
              <div>
                <h1 className="text-2xl font-bold">{delivery ? 'DELIVERY NOTE' : 'INVOICE'}</h1>
                <p className="text-slate-500">{bizName}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{sale.receiptNumber}</p>
                <p className="text-slate-500">{new Date(sale.createdAt).toLocaleDateString()}</p>
                {sale.status === 'VOIDED' && <p className="font-bold text-red-600">VOIDED</p>}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase text-slate-400">Customer</p>
              <p className="font-medium">{sale.customer?.name || 'Walk-in customer'}</p>
              {sale.customer?.phone && <p>{sale.customer.phone}</p>}
              {sale.customer?.address && <p>{sale.customer.address}</p>}
            </div>

            <table className="w-full mt-6">
              <thead className="text-left text-slate-500 border-b">
                <tr>
                  <th className="py-2">Item</th>
                  <th className="text-right">Qty</th>
                  {!delivery && <th className="text-right">Unit price</th>}
                  {!delivery && <th className="text-right">Amount</th>}
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i) => (
                  <tr key={i.id} className="border-b">
                    <td className="py-2">{i.product.name}</td>
                    <td className="text-right">{qtyLabel(i)}</td>
                    {!delivery && <td className="text-right">{fmt(i.sellingPrice)}</td>}
                    {!delivery && <td className="text-right">{fmt(i.total)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>

            {!delivery ? (
              <div className="mt-4 ml-auto w-64 space-y-1">
                {Number(sale.discount) > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
                )}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{fmt(sale.total)}</span></div>
                <div className="flex justify-between"><span>Paid</span><span>{fmt(paid)}</span></div>
                {due > 0 && (
                  <div className="flex justify-between font-semibold text-red-600"><span>Balance due</span><span>{fmt(due)}</span></div>
                )}
              </div>
            ) : (
              <div className="mt-16 grid grid-cols-2 gap-12 text-xs text-slate-500">
                <div className="border-t pt-1">Delivered by (name / signature)</div>
                <div className="border-t pt-1">Received by (name / signature)</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
