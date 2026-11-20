'use client';

import { useEffect, useRef } from 'react';

type Props = {
  title: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  tone?: 'danger' | 'primary';
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
};

export function ConfirmDialog({
  title,
  confirmLabel,
  busyLabel,
  busy,
  tone = 'primary',
  error,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus(); // safest default: focus Cancel, not the destructive button
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 space-y-3">
        <h2 id="confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        <div className="text-sm text-slate-600 space-y-2">{children}</div>
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              tone === 'danger' ? 'bg-red-600' : 'bg-teal-700'
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
