'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AppShell, EmptyState } from '@/components/AppShell';
import { Plus, Upload, X } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  costPrice: string | number;
  sellingPrice: string | number;
  currentStock: number;
  reorderLevel: string | number;
  status: string;
  wholesalePrice?: string | number | null;
  wholesaleMinQty?: string | number | null;
  packs?: Pack[];
};

type Pack = {
  id: string;
  name: string;
  factor: string | number;
  retailPrice?: string | number | null;
  wholesalePrice?: string | number | null;
};

const fmt = (n: string | number | null | undefined) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString();

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    costPrice: '',
    sellingPrice: '',
    wholesalePrice: '',
    wholesaleMinQty: '',
    reorderLevel: '10',
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({ wholesalePrice: '', wholesaleMinQty: '' });
  const [packForm, setPackForm] = useState({ name: '', factor: '', retailPrice: '', wholesalePrice: '' });
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState(
    'name,sku,costPrice,sellingPrice,reorderLevel\nSugar 2kg,SUG-2KG,4500,5500,15',
  );
  const [importResult, setImportResult] = useState<string | null>(null);

  const businessId =
    typeof window !== 'undefined' ? localStorage.getItem('businessId') : null;

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await api.get('/products', {
        headers: { 'x-business-id': businessId },
        params: { limit: 100 },
      });
      setProducts(res.data.items || []);
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    if (!businessId) {
      router.push('/dashboard');
      return;
    }
    load();
  }, [router, businessId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(
        '/products',
        {
          name: form.name,
          sku: form.sku || undefined,
          costPrice: Number(form.costPrice),
          sellingPrice: Number(form.sellingPrice),
          wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : undefined,
          wholesaleMinQty: form.wholesaleMinQty ? Number(form.wholesaleMinQty) : undefined,
          reorderLevel: Number(form.reorderLevel) || 0,
        },
        { headers: { 'x-business-id': businessId } },
      );
      setShowForm(false);
      setForm({
        name: '',
        sku: '',
        costPrice: '',
        sellingPrice: '',
        wholesalePrice: '',
        wholesaleMinQty: '',
        reorderLevel: '10',
      });
      await load();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const hdr = () => ({ headers: { 'x-business-id': businessId! } });
  const fail = (err: any, fallback: string) => {
    const msg = err.response?.data?.message;
    setError(Array.isArray(msg) ? msg.join(', ') : msg || fallback);
  };

  const openEditor = (p: Product) => {
    if (editId === p.id) {
      setEditId(null);
      return;
    }
    setEditId(p.id);
    setPriceForm({
      wholesalePrice: p.wholesalePrice != null ? String(Number(p.wholesalePrice)) : '',
      wholesaleMinQty: p.wholesaleMinQty != null ? String(Number(p.wholesaleMinQty)) : '',
    });
    setPackForm({ name: '', factor: '', retailPrice: '', wholesalePrice: '' });
  };

  const savePrices = async (id: string) => {
    setError(null);
    try {
      await api.patch(
        `/products/${id}`,
        {
          wholesalePrice: priceForm.wholesalePrice ? Number(priceForm.wholesalePrice) : null,
          wholesaleMinQty: priceForm.wholesaleMinQty ? Number(priceForm.wholesaleMinQty) : null,
        },
        hdr(),
      );
      await load();
    } catch (err) {
      fail(err, 'Could not save prices');
    }
  };

  const addPack = async (id: string) => {
    setError(null);
    try {
      await api.post(
        `/products/${id}/packs`,
        {
          name: packForm.name.trim(),
          factor: Number(packForm.factor),
          retailPrice: packForm.retailPrice ? Number(packForm.retailPrice) : undefined,
          wholesalePrice: packForm.wholesalePrice ? Number(packForm.wholesalePrice) : undefined,
        },
        hdr(),
      );
      setPackForm({ name: '', factor: '', retailPrice: '', wholesalePrice: '' });
      await load();
    } catch (err) {
      fail(err, 'Could not add pack');
    }
  };

  const removePack = async (id: string, packId: string) => {
    setError(null);
    try {
      await api.delete(`/products/${id}/packs/${packId}`, hdr());
      await load();
    } catch (err) {
      fail(err, 'Could not remove pack');
    }
  };

  const importCsv = async () => {
    if (!businessId) return;
    setSaving(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await api.post(
        '/products/import',
        { csv: csvText },
        { headers: { 'x-business-id': businessId } },
      );
      setImportResult(`Created ${res.data.created}, failed ${res.data.failed}`);
      setShowImport(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => {
          setShowImport(!showImport);
          setShowForm(false);
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:px-3.5 sm:text-sm"
      >
        <Upload size={15} className="shrink-0" />
        <span className="hidden sm:inline">{showImport ? 'Cancel' : 'Import CSV'}</span>
        <span className="sm:hidden">{showImport ? 'Cancel' : 'CSV'}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setShowForm(!showForm);
          setShowImport(false);
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-teal-700 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 sm:min-h-0 sm:px-3.5 sm:text-sm"
      >
        {showForm ? <X size={15} /> : <Plus size={15} />}
        <span>{showForm ? 'Cancel' : 'Add product'}</span>
      </button>
    </>
  );

  const PackEditor = ({ product }: { product: Product }) => (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <div>
        <p className="text-xs font-semibold text-slate-800">Wholesale pricing (per base unit)</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Wholesale customers always get this price. Anyone buying at least the quantity gets it too.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="number"
            placeholder="Wholesale price"
            value={priceForm.wholesalePrice}
            onChange={(e) => setPriceForm({ ...priceForm, wholesalePrice: e.target.value })}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Also from qty…"
            value={priceForm.wholesaleMinQty}
            onChange={(e) => setPriceForm({ ...priceForm, wholesaleMinQty: e.target.value })}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={() => savePrices(product.id)}
          className="mt-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
        >
          Save prices
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-800">Packs (carton, sack, dozen…)</p>
        {product.packs && product.packs.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {product.packs.map((pk) => (
              <li
                key={pk.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-slate-100"
              >
                <span className="font-medium text-slate-700">
                  {pk.name} × {Number(pk.factor)}
                  {pk.retailPrice != null && (
                    <span className="ml-2 text-slate-400">Retail {fmt(pk.retailPrice)}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removePack(product.id, pk.id)}
                  className="text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            placeholder="Name (Carton)"
            value={packForm.name}
            onChange={(e) => setPackForm({ ...packForm, name: e.target.value })}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Units in pack"
            value={packForm.factor}
            onChange={(e) => setPackForm({ ...packForm, factor: e.target.value })}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Retail price (opt.)"
            value={packForm.retailPrice}
            onChange={(e) => setPackForm({ ...packForm, retailPrice: e.target.value })}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Wholesale (opt.)"
            value={packForm.wholesalePrice}
            onChange={(e) => setPackForm({ ...packForm, wholesalePrice: e.target.value })}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={() => addPack(product.id)}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add pack
        </button>
      </div>
    </div>
  );

  return (
    <AppShell title="Products" breadcrumb="Workspace" actions={headerActions}>
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      )}
      {importResult && (
        <div className="mb-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800 ring-1 ring-teal-100">
          {importResult}
        </div>
      )}

      {showImport && (
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            CSV columns:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              name,sku,barcode,costPrice,sellingPrice,reorderLevel
            </code>
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <button
            type="button"
            disabled={saving}
            onClick={importCsv}
            className="mt-3 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Importing…' : 'Import products'}
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={create}
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          <input
            required
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className={inputClass}
          />
          <input
            required
            type="number"
            placeholder="Cost price"
            value={form.costPrice}
            onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            className={inputClass}
          />
          <input
            required
            type="number"
            placeholder="Selling price"
            value={form.sellingPrice}
            onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Wholesale price (optional)"
            value={form.wholesalePrice}
            onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Wholesale from qty (optional)"
            value={form.wholesaleMinQty}
            onChange={(e) => setForm({ ...form, wholesaleMinQty: e.target.value })}
            className={inputClass}
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add your first product to start selling and tracking stock."
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Add product
            </button>
          }
        />
      ) : (
        <>
          {/* Mobile card list — all details visible */}
          <div className="space-y-3 md:hidden">
            {products.map((p) => {
              const low =
                Number(p.currentStock) <= Number(p.reorderLevel || 0) && Number(p.reorderLevel) > 0;
              const isOpen = editId === p.id;
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-slate-900">{p.name}</h3>
                          {p.packs && p.packs.length > 0 && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              {p.packs[0].name}={Number(p.packs[0].factor)}
                            </span>
                          )}
                        </div>
                        {p.sku && (
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{p.sku}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums ${
                          low
                            ? 'bg-amber-50 text-amber-700'
                            : Number(p.currentStock) === 0
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {p.currentStock} in stock
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Cost
                        </p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">
                          {fmt(p.costPrice)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Retail
                        </p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">
                          {fmt(p.sellingPrice)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Wholesale
                        </p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-800">
                          {fmt(p.wholesalePrice)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditor(p)}
                      className="mt-3 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      {isOpen ? 'Close' : 'Prices & packs'}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-4 py-4">
                      <PackEditor product={p} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:block">
            <div className="table-scroll">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-4 py-3.5">SKU</th>
                    <th className="px-4 py-3.5 text-right">Cost</th>
                    <th className="px-4 py-3.5 text-right">Retail</th>
                    <th className="px-4 py-3.5 text-right">Wholesale</th>
                    <th className="px-4 py-3.5 text-right">Stock</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const low =
                      Number(p.currentStock) <= Number(p.reorderLevel || 0) &&
                      Number(p.reorderLevel) > 0;
                    const isOpen = editId === p.id;
                    return (
                      <Fragment key={p.id}>
                        <tr className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{p.name}</span>
                              {p.packs && p.packs.length > 0 && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                  {p.packs[0].name}={Number(p.packs[0].factor)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                            {p.sku || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                            {fmt(p.costPrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                            {fmt(p.sellingPrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                            {fmt(p.wholesalePrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span
                              className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${
                                low
                                  ? 'bg-amber-50 text-amber-700'
                                  : Number(p.currentStock) === 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'text-slate-800'
                              }`}
                            >
                              {p.currentStock}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => openEditor(p)}
                              className="text-xs font-semibold text-teal-700 hover:underline"
                            >
                              {isOpen ? 'Close' : 'Prices & packs'}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50/50 px-5 py-4">
                              <PackEditor product={p} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
