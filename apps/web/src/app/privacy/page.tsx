import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm leading-6 text-slate-700">
      <Link href="/" className="text-teal-700">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-4">
        Retail OS processes business data (products, sales, customers) that you enter to
        provide inventory and POS features. Data is scoped to your business account.
      </p>
      <p className="mt-3">
        We do not sell your data. Access is controlled by authentication and business
        membership. Contact support for data export or deletion requests.
      </p>
      <p className="mt-3 text-slate-500">Last updated: October 2026</p>
    </div>
  );
}
