'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

type Session = {
  id: string;
  openingCash: string | number;
  expectedCash?: string | number;
  actualCash?: string | number;
  difference?: string | number;
  status: string;
  openedAt: string;
};

export default function CashPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [openingCash, setOpeningCash] = useState('50000');
  const [actualCash, setActualCash] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = async () => {
    if (!businessId) return;
    try {
      const res = await api.get('/cash/sessions/current', { headers: { 'x-business-id': businessId } });
      setSession(res.data || null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    load();
  }, [router]);

  const openSession = async () => {
    if (!businessId) return;
    setError(null);
    try {
      await api.post('/cash/sessions/open', { openingCash: Number(openingCash) }, {
        headers: { 'x-business-id': businessId },
      });
      setMessage('Cash session opened');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to open');
    }
  };

  const closeSession = async () => {
    if (!businessId || !session) return;
    setError(null);
    try {
      await api.post(
        `/cash/sessions/${session.id}/close`,
        { actualCash: Number(actualCash), differenceReason: reason || undefined },
        { headers: { 'x-business-id': businessId } },
      );
      setMessage('Cash session closed');
      setSession(null);
      setActualCash('');
      setReason('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to close');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Cash register</h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {message && <div className="mb-4 rounded-lg bg-teal-50 text-teal-700 text-sm px-3 py-2">{message}</div>}
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : session ? (
          <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
            <p className="text-sm text-slate-500">Session open since {new Date(session.openedAt).toLocaleString()}</p>
            <p className="text-lg">Opening cash: <strong>{Number(session.openingCash).toLocaleString()} TZS</strong></p>
            <div>
              <label className="block text-sm font-medium mb-1">Actual cash counted</label>
              <input type="number" value={actualCash} onChange={(e) => setActualCash(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Difference reason (if any)</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Optional unless there is a difference" />
            </div>
            <button onClick={closeSession} className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white">
              Close session
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
            <p className="text-slate-600 text-sm">No open cash session. Open one to start the day.</p>
            <div>
              <label className="block text-sm font-medium mb-1">Opening cash</label>
              <input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <button onClick={openSession} className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white">
              Open session
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
