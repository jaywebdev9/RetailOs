'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';
import type { BillingStatus } from '@/components/SubscriptionBanner';

type Plan = {
  code: string;
  name: string;
  months: number;
  priceTzs: number;
  perMonthTzs: number;
  savingsPercent: number;
};

type Payment = {
  id: string;
  plan: string;
  amount: number;
  method: string;
  reference: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
};

const METHODS = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'TIGO', label: 'Tigo Pesa / Yas' },
  { value: 'AIRTEL', label: 'Airtel Money' },
  { value: 'HALOPESA', label: 'HaloPesa' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'OTHER', label: 'Other' },
];

const money = (n: number) => Math.round(n).toLocaleString('en-TZ');

export default function BillingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [instructions, setInstructions] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [method, setMethod] = useState('MPESA');
  const [reference, setReference] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bid = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = async () => {
    if (!bid) return;
    const headers = { 'x-business-id': bid };
    try {
      const [st, pl, pay] = await Promise.all([
        api.get('/billing/status', { headers }),
        api.get('/billing/plans', { headers }),
        api.get('/billing/payments', { headers }),
      ]);
      setStatus(st.data);
      setPlans(pl.data.plans);
      setInstructions(pl.data.paymentInstructions || '');
      setSupportPhone(pl.data.supportPhone || '');
      setPayments(pay.data);
      setSelected((cur) => cur || pl.data.plans.find((p: Plan) => p.months === 6)?.code || pl.data.plans[0]?.code || '');
    } catch {
      setError('Could not load billing');
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
    if (!bid) { router.push('/dashboard'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bid) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(
        '/billing/payments',
        { planCode: selected, method, reference, payerPhone: payerPhone || undefined },
        { headers: { 'x-business-id': bid } },
      );
      setReference('');
      setMessage(t('bill_submitted'));
      await load();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not send payment');
    } finally {
      setBusy(false);
    }
  };

  const chosen = plans.find((p) => p.code === selected);
  const statusLabel = (s: Payment['status']) =>
    s === 'PENDING' ? t('bill_pending') : s === 'CONFIRMED' ? t('bill_confirmed') : t('bill_rejected');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
          <h1 className="text-lg font-semibold">{t('bill_title')}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {message && <div className="rounded-lg bg-orange-50 text-orange-800 text-sm px-3 py-2">{message}</div>}

        {status && (
          <section className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              {status.state === 'TRIALING' ? t('bill_trialEnds') : t('bill_activeUntil')}
            </p>
            <p className="text-xl font-semibold">{new Date(status.endsAt).toLocaleDateString()}</p>
            <p className={`text-sm mt-1 ${status.access === 'READ_ONLY' ? 'text-red-600' : 'text-slate-600'}`}>
              {status.access === 'READ_ONLY' ? t('bill_expiredMsg') : `${Math.max(status.daysLeft, 0)} ${status.state === 'TRIALING' ? t('bill_trialLeft') : t('bill_planLeft')}`}
            </p>
          </section>
        )}

        <section>
          <h2 className="font-semibold mb-3">{t('bill_choosePlan')}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setSelected(p.code)}
                className={`text-left rounded-xl border p-4 bg-white transition ${
                  selected === p.code ? 'border-teal-600 ring-2 ring-teal-600' : 'hover:border-slate-400'
                }`}
              >
                <p className="font-medium">{p.name}</p>
                <p className="text-2xl font-bold mt-1">{money(p.priceTzs)} <span className="text-sm font-normal text-slate-500">TZS</span></p>
                {p.months > 1 && (
                  <p className="text-xs text-slate-500">{money(p.perMonthTzs)} {t('bill_perMonth')}</p>
                )}
                {p.savingsPercent > 0 && (
                  <span className="inline-block mt-2 rounded-full bg-teal-100 text-orange-800 text-xs px-2 py-0.5">
                    {t('bill_save')} {p.savingsPercent}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold">{t('bill_howToPay')}</h2>
          {instructions ? (
            <p className="text-sm whitespace-pre-line bg-slate-50 rounded-lg p-3">{instructions}</p>
          ) : (
            <p className="text-sm text-amber-700">{t('bill_noInstructions')}</p>
          )}
          {chosen && (
            <p className="text-sm">
              {t('bill_selected')}: <b>{chosen.name}</b> — <b>{money(chosen.priceTzs)} TZS</b>
            </p>
          )}
          <p className="text-sm text-slate-600">{t('bill_payStep')}</p>

          {status && !status.isOwner ? (
            <p className="text-sm text-amber-700">{t('bill_onlyOwner')}</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('bill_method')}</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('bill_reference')}</label>
                <input required minLength={4} value={reference} onChange={(e) => setReference(e.target.value)}
                  placeholder="QJK3H8D2LM" className="w-full rounded-lg border px-3 py-2 text-sm uppercase" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Phone (optional)</label>
                <input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <button type="submit" disabled={busy || !selected}
                className="sm:col-span-3 rounded-lg bg-orange-500 text-white py-2.5 text-sm font-medium disabled:opacity-50">
                {busy ? '…' : t('bill_submit')}
              </button>
            </form>
          )}
          {supportPhone && <p className="text-xs text-slate-500">Support: {supportPhone}</p>}
        </section>

        {payments.length > 0 && (
          <section className="bg-white rounded-xl border overflow-x-auto">
            <h2 className="font-semibold px-5 pt-4">{t('bill_history')}</h2>
            <table className="w-full text-sm mt-2">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-5 py-3">
                      {p.plan}
                      <span className="block text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString()} · {p.method} · {p.reference}</span>
                    </td>
                    <td className="px-5 py-3 text-right">{money(p.amount)}</td>
                    <td className={`px-5 py-3 text-right text-xs font-medium ${
                      p.status === 'CONFIRMED' ? 'text-teal-700' : p.status === 'REJECTED' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {statusLabel(p.status)}
                      {p.rejectReason && <span className="block text-slate-500 font-normal">{p.rejectReason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
