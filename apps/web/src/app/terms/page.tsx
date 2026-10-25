import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-6 text-slate-700">
      <Link href="/" className="text-teal-700">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Terms of Service</h1>
      <p className="mt-4">
        By using Retail OS you agree to use the service for legitimate retail or wholesale
        operations, keep account credentials secure, and pay subscription fees when required.
      </p>
      <p className="mt-3">
        The service is provided as-is. We may suspend accounts that abuse the platform or
        violate applicable law. Subscription access follows the plan status shown in the app.
      </p>
      <p className="mt-3 text-slate-500">Last updated: October 2026</p>
    </div>
  );
}
