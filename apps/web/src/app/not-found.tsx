import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f6f8fb] px-6 text-center">
      <p className="text-5xl font-bold text-teal-700">404</p>
      <h1 className="mt-3 text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you are looking for does not exist or was moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
