'use client';

import { useEffect, useState } from 'react';

export function PwaRegister() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setCanInstall(false);
  };

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-teal-200 bg-white p-3 shadow-lg lg:bottom-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white">
          R
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Install Retail OS</p>
          <p className="text-xs text-slate-500">Add to home screen for faster access</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => setCanInstall(false)}
          className="shrink-0 text-xs text-slate-400"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
