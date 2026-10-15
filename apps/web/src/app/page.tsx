import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Retail OS
          </h1>
          <p className="mt-3 text-slate-600">
            Complete business operating system for shops across Tanzania and beyond.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-6 py-3 text-sm font-medium text-white shadow hover:bg-teal-800 transition"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            Create account
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          Stock · Sales · Purchases · Credit · Profit · Alerts
        </p>
      </div>
    </div>
  );
}
