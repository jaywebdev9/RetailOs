'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Line = {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  dueDate: string | null;
};

type Statement = {
  customer: { id: string; name: string; phone?: string; address?: string; creditLimit: number };
  openingBalance: number;
  closingBalance: number;
  lines: Line[];
  ageing: {
    current: number;
    d1_30: number;
    d31_60: number;
    d60plus: number;
    overdueAmount: number;
  } | null;
};

const fmt = (n: number) => n.toLocaleString('en-TZ', { maximumFractionDigits: 0 });

export default function StatementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [bizName, setBizName] = useState('');

  const load = () => {
    const bid = localStorage.getItem('businessId');
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    if (!bid) return;
    setError(null);
    api
      .get(`/customers/${id}/statement`, {
        headers: { 'x-business-id': bid },
        params: { from: from || undefined, to: to || undefined },
      })
      .then((r) => setData(r.data))
      .catch(() => setError('Could not load statement'));
    api
      .get('/users/me/businesses')
      .then((r) => {
        const m = (r.data || []).find((x: any) => x.business?.id === bid);
        if (m) setBizName(m.business.name);
      })
      .catch(() => {});
  };

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="print:hidden flex flex-wrap items-center gap-2 mb-4">
          <Link href="/customers" className="text-sm text-slate-500 mr-auto">← Customers</Link>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1 text-sm" />
          <button onClick={load} className="rounded border px-3 py-1 text-sm">Filter</button>
          <button onClick={() => window.print()} className="rounded bg-teal-700 text-white px-3 py-1 text-sm">Print / Save PDF</button>
        </div>

        {error && <div className="mb-4 rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {!data ? (
          !error && <p className="text-slate-500">Loading…</p>
        ) : (
          <div className="bg-white rounded-xl border p-6 print:border-0 print:p-0">
            <div className="flex justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold">Account statement</h1>
                {bizName && <p className="text-sm text-slate-500">{bizName}</p>}
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">{data.customer.name}</p>
                {data.customer.phone && <p>{data.customer.phone}</p>}
                {data.customer.address && <p>{data.customer.address}</p>}
                <p className="text-slate-500">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Description</th>
                  <th className="text-right">Charged</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.openingBalance !== 0 && (
                  <tr className="border-b text-slate-500">
                    <td className="py-2" colSpan={4}>Opening balance</td>
                    <td className="text-right">{fmt(data.openingBalance)}</td>
                  </tr>
                )}
                {data.lines.map((l, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 whitespace-nowrap">{new Date(l.date).toLocaleDateString()}</td>
                    <td>
                      {l.description}
                      {l.dueDate && <span className="block text-xs text-slate-400">due {new Date(l.dueDate).toLocaleDateString()}</span>}
                    </td>
                    <td className="text-right">{l.debit ? fmt(l.debit) : ''}</td>
                    <td className="text-right">{l.credit ? fmt(l.credit) : ''}</td>
                    <td className="text-right font-medium">{fmt(l.balance)}</td>
                  </tr>
                ))}
                {data.lines.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">No activity</td></tr>
                )}
              </tbody>
            </table>

            <div className="mt-4 flex justify-between items-end">
              {data.ageing ? (
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>Not yet due: {fmt(data.ageing.current)}</p>
                  <p>1–30 days late: {fmt(data.ageing.d1_30)}</p>
                  <p>31–60 days late: {fmt(data.ageing.d31_60)}</p>
                  <p>Over 60 days late: {fmt(data.ageing.d60plus)}</p>
                </div>
              ) : <span />}
              <div className="text-right">
                <p className="text-sm text-slate-500">Amount due</p>
                <p className="text-2xl font-bold">{fmt(data.closingBalance)} TZS</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
