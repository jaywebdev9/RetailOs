'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ConfirmDialog } from './ConfirmDialog';
import { apiErrorMessage } from './productForm';

type ArchivedProduct = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  costPrice: string | number;
  sellingPrice: string | number;
  currentStock: number;
  category?: { name: string } | null;
};

type Props = {
  businessId: string;
  onRestored: (name: string) => void;
};

const PAGE_SIZE = 25;

export function ArchivedProducts({ businessId, onRestored }: Props) {
  const [items, setItems] = useState<ArchivedProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<ArchivedProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const id = ++requestId.current; // ignore out-of-order responses while typing
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/products', {
        headers: { 'x-business-id': businessId },
        params: {
          status: 'ARCHIVED',
          search: debounced || undefined,
          page,
          limit: PAGE_SIZE,
        },
      });
      if (id !== requestId.current) return;
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(apiErrorMessage(err, 'Failed to load archived products'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [businessId, debounced, page]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmRestore = async () => {
    if (!restoring || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setDialogError(null);
    try {
      await api.post(`/products/${restoring.id}/restore`, {}, {
        headers: { 'x-business-id': businessId },
      });
      const name = restoring.name;
      setRestoring(null);
      onRestored(name);
      // if that was the last row on this page, step back one page
      if (items.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      setDialogError(apiErrorMessage(err, 'Could not restore the product'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search archived by name, SKU or barcode"
          aria-label="Search archived products"
          className="w-full sm:max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <p className="text-xs text-slate-500">
          Archived products are hidden from sales and the active list. Their history is kept.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline text-xs">Try again</button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : items.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
          {debounced
            ? 'No archived products match your search.'
            : 'No archived products. Products you archive will appear here.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Retail</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Cost</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {p.name}
                    <span className="ml-2 rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Archived
                    </span>
                    {p.category?.name && (
                      <span className="block text-xs font-normal text-slate-400">{p.category.name}</span>
                    )}
                    <span className="block sm:hidden text-xs font-normal text-slate-400">
                      {p.sku || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{p.sku || '—'}</td>
                  <td className="px-4 py-3 text-right">{Number(p.sellingPrice).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell">
                    {Number(p.costPrice).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell">{p.currentStock}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setDialogError(null);
                        setRestoring(p);
                      }}
                      aria-label={`Restore ${p.name}`}
                      className="rounded-lg border border-teal-700 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages} · {total} archived
          </span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {restoring && (
        <ConfirmDialog
          title="Restore this product?"
          confirmLabel="Restore product"
          busyLabel="Restoring…"
          busy={busy}
          error={dialogError}
          onConfirm={confirmRestore}
          onCancel={() => setRestoring(null)}
        >
          <p>
            <strong>{restoring.name}</strong> will become active again. It will appear in the
            Products list and can be sold and purchased.
          </p>
          <p>Its sales, purchase and stock history are unchanged.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
