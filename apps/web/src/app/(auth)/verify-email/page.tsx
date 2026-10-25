'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('err');
      setMessage('Missing verification token');
      return;
    }
    api
      .post('/auth/verify-email', { token })
      .then((res) => {
        setStatus('ok');
        setMessage(res.data.message || 'Email verified');
      })
      .catch((err) => {
        setStatus('err');
        const m = err.response?.data?.message;
        setMessage(Array.isArray(m) ? m.join(', ') : m || 'Verification failed');
      });
  }, [token]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      {status === 'loading' && <p className="text-sm text-slate-500">Verifying…</p>}
      {status === 'ok' && <p className="text-sm text-teal-800">{message}</p>}
      {status === 'err' && <p className="text-sm text-red-600">{message}</p>}
      <Link href="/login" className="mt-4 inline-block text-sm font-medium text-teal-700">
        Continue to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-bold text-slate-900">Email verification</h1>
        <Suspense fallback={<p className="text-center text-sm text-slate-500">Loading…</p>}>
          <VerifyInner />
        </Suspense>
      </div>
    </div>
  );
}
