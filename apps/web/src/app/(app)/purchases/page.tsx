'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AppShell, EmptyState, StatusBadge } from '@/components/AppShell';
import { Plus, X } from 'lucide-react';

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; costPrice: string | number };
type Purchase = {
  id: string;
  purchaseNumber: string;
  status: string;
  total: string | number;
  supplier: { name: string };
  items: { id: string; productId: string; quantityOrdered: string; quantityReceived: string; unitCost: string }[];
  createdAt: string;
};

const fmt = (n: string | number) => Number(n).toLocaleString();

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('100');
  const [unitCost, setUnitCost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = async () => {
    if (!businessId) return;
    try {
      const [pRes, sRes, prodRes] = await Promise.all([
        api.get('/purchases', { headers: { 'x-business-id': businessId } }),
        api.get('/suppliers', { headers: { 'x-business-id': businessId } }),
        api.get('/products', { headers: { 'x-business-id': businessId }, params: { limit: 100 } }),
      ]);
      setPurchases(pRes.data || []);
      setSuppliers(sRes.data || []);
      setProducts(prodRes.data.items || []);
      if (sRes.data?.[0]) setSupplierId(sRes.data[0].id);
      if (prodRes.data.items?.[0]) {
        setProductId(prodRes.data.items[0].id);
        setUnitCost(String(prodRes.data.items[0].costPrice));
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    load();
  }, [router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !supplierId || !productId) return;
    setError(null);
    try {
      await api.post(
        '/purchases',
        {
          supplierId,
          items: [{ productId, quantityOrdered: Number(qty), unitCost: Number(unitCost) }],
        },
        { headers: { 'x-business-id': businessId } },
      );
      setShowForm(false);
      setMessage('Purchase created');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Create failed');
    }
  };

  const receiveAll = async (purchase: Purchase) => {
    if (!businessId) return;
    setError(null);
    try {
      const items = purchase.items
        .filter((i) => Number(i.quantityReceived) < Number(i.quantityOrdered))
        .map((i) => ({
          purchaseItemId: i.id,
          quantityReceived: Number(i.quantityOrdered) - Number(i.quantityReceived),
        }));
      if (items.length === 0) {
        setMessage('Nothing left to receive');
        return;
      }
      await api.post(
        `/purchases/${purchase.id}/receive`,
        { items },
        { headers: { 'x-business-id': businessId } },
      );
      setMessage('Stock received');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Receive failed');
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowForm(!showForm)}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-orange-500 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 sm:min-h-0 sm:px-3.5 sm:text-sm"
    >
      {showForm ? <X size={15} /> : <Plus size={15} />}
      <span>{showForm ? 'Cancel' : 'New purchase'}</span>
    </button>
  );

  return (
    <AppShell title="Purchases" breadcrumb="Manage business" actions={headerActions}>
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-800 ring-1 ring-orange-100">
          {message}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={create}
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
        >
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
            {suppliers.length === 0 && <option value="">No suppliers</option>}
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const prod = products.find((p) => p.id === e.target.value);
              if (prod) setUnitCost(String(prod.costPrice));
            }}
            className={inputClass}
          >
            {products.length === 0 && <option value="">No products</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Unit cost"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Create
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          description="Create a supplier and product first, then record a purchase order."
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
            >
              New purchase
            </button>
          }
        />
      ) : (
        <>
          {/* Mobile cards — full details visible */}
          <div className="space-y-3 md:hidden">
            {purchases.map((p) => {
              const canReceive = p.status !== 'RECEIVED' && p.status !== 'CANCELLED';
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-slate-500">{p.purchaseNumber}</p>
                      <h3 className="mt-1 truncate text-sm font-bold text-slate-900">
                        {p.supplier?.name || '—'}
                      </h3>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total</p>
                      <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                        {fmt(p.total)}
                      </p>
                    </div>
                    {canReceive && (
                      <button
                        type="button"
                        onClick={() => receiveAll(p)}
                        className="rounded-xl bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-800 ring-1 ring-orange-100 hover:bg-orange-100"
                      >
                        Receive stock
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:block">
            <div className="table-scroll">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Number</th>
                    <th className="px-4 py-3.5">Supplier</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Total</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.map((p) => {
                    const canReceive = p.status !== 'RECEIVED' && p.status !== 'CANCELLED';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">
                          {p.purchaseNumber}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          {p.supplier?.name || '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-slate-800">
                          {fmt(p.total)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {canReceive && (
                            <button
                              type="button"
                              onClick={() => receiveAll(p)}
                              className="text-xs font-semibold text-teal-700 hover:underline"
                            >
                              Receive stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
