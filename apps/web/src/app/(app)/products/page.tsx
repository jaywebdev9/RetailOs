'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ProductActionsMenu } from '@/components/products/ProductActionsMenu';
import { ProductEditDialog } from '@/components/products/ProductEditDialog';
import { ConfirmDialog } from '@/components/products/ConfirmDialog';
import { ArchivedProducts } from '@/components/products/ArchivedProducts';
import { apiErrorMessage } from '@/components/products/productForm';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  categoryId?: string | null;
  unitId?: string | null;
  minimumSellingPrice?: string | number | null;
  reorderQuantity?: string | number | null;
  trackInventory?: boolean;
  allowNegativeStock?: boolean;
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
  const [csvText, setCsvText] = useState('name,sku,costPrice,sellingPrice,reorderLevel\nSugar 2kg,SUG-2KG,4500,5500,15');
  const [importResult, setImportResult] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [archiving, setArchiving] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const archiveLock = useRef(false);

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
      setForm({ name: '', sku: '', costPrice: '', sellingPrice: '', wholesalePrice: '', wholesaleMinQty: '', reorderLevel: '10' });
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
    if (editId === p.id) { setEditId(null); return; }
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
      await api.patch(`/products/${id}`, {
        wholesalePrice: priceForm.wholesalePrice ? Number(priceForm.wholesalePrice) : null,
        wholesaleMinQty: priceForm.wholesaleMinQty ? Number(priceForm.wholesaleMinQty) : null,
      }, hdr());
      await load();
    } catch (err) { fail(err, 'Could not save prices'); }
  };

  const addPack = async (id: string) => {
    setError(null);
    try {
      await api.post(`/products/${id}/packs`, {
        name: packForm.name.trim(),
        factor: Number(packForm.factor),
        retailPrice: packForm.retailPrice ? Number(packForm.retailPrice) : undefined,
        wholesalePrice: packForm.wholesalePrice ? Number(packForm.wholesalePrice) : undefined,
      }, hdr());
      setPackForm({ name: '', factor: '', retailPrice: '', wholesalePrice: '' });
      await load();
    } catch (err) { fail(err, 'Could not add pack'); }
  };

  const removePack = async (id: string, packId: string) => {
    setError(null);
    try {
      await api.delete(`/products/${id}/packs/${packId}`, hdr());
      await load();
    } catch (err) { fail(err, 'Could not remove pack'); }
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const confirmArchive = async () => {
    if (!archiving || !businessId || archiveLock.current) return;
    archiveLock.current = true;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await api.post(`/products/${archiving.id}/archive`, {}, hdr());
      const name = archiving.name;
      if (editId === archiving.id) setEditId(null);
      setArchiving(null);
      setNotice(`"${name}" was archived. You can restore it from the Archived tab.`);
      await load();
    } catch (err) {
      setArchiveError(apiErrorMessage(err, 'Could not archive the product'));
    } finally {
      archiveLock.current = false;
      setArchiveBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || !businessId || deleteBusy) return;

    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await api.delete(`/products/${deleting.id}`, hdr());

      const name = deleting.name;
      setDeleting(null);
      setNotice(`"${name}" was permanently deleted.`);
      await load();
    } catch (err) {
      setDeleteError(
        apiErrorMessage(
          err,
          'Could not delete product. Products with transaction history must be archived.',
        ),
      );
    } finally {
      setDeleteBusy(false);
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

  return (

    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-500">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold">Products</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowImport(!showImport); setShowForm(false); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {showImport ? 'Cancel' : 'Import CSV'}
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setShowImport(false); }}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
            >
              {showForm ? 'Cancel' : 'Add product'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {importResult && (
          <div className="mb-4 rounded-lg bg-teal-50 text-teal-700 text-sm px-3 py-2">{importResult}</div>
        )}

        {notice && (
          <div role="status" className="mb-4 rounded-lg bg-teal-50 text-teal-800 text-sm px-3 py-2 flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-teal-700 ml-3">×</button>
          </div>
        )}

        <div role="tablist" aria-label="Product lists" className="mb-4 flex gap-1 border-b border-slate-200">
          {(['active', 'archived'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setError(null); }}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
                tab === t ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'active' ? 'Active' : 'Archived'}
            </button>
          ))}
        </div>

        {showImport && (
          <div className="mb-6 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <p className="text-sm text-slate-600">
              CSV columns: <code className="text-xs bg-slate-100 px-1">name,sku,barcode,costPrice,sellingPrice,reorderLevel</code>
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
            <button
              type="button"
              disabled={saving}
              onClick={importCsv}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Importing…' : 'Import products'}
            </button>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={create}
            className="mb-6 bg-white rounded-xl border border-slate-200 p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
          >
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Cost price"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Selling price"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Wholesale price (optional)"
              value={form.wholesalePrice}
              onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Wholesale from qty (optional)"
              value={form.wholesaleMinQty}
              onChange={(e) => setForm({ ...form, wholesaleMinQty: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}

        {tab === 'archived' && businessId ? (
          <ArchivedProducts
            businessId={businessId}
            onRestored={(name) => {
              setNotice(`"${name}" was restored and is active again.`);
              load(); // keep the Active list fresh for when the user switches back
            }}
          />
        ) : loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            No products yet. Add your first product to start selling.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="md:hidden px-4 py-2 text-xs text-slate-500 bg-slate-50 border-b">
              Swipe left or right to view all product details →
            </div>
            <div className="w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[850px] md:min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Retail</th>
                  <th className="px-4 py-3 font-medium text-right">Wholesale</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {p.name}
                        {p.packs && p.packs.length > 0 && (
                          <span className="ml-2 text-xs text-slate-400">
                            {p.packs.map((k) => `${k.name}=${Number(k.factor)}`).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.sku || '—'}</td>
                      <td className="px-4 py-3 text-right">{Number(p.costPrice).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{Number(p.sellingPrice).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {p.wholesalePrice != null ? Number(p.wholesalePrice).toLocaleString() : '—'}
                        {p.wholesaleMinQty != null && (
                          <span className="block text-xs text-slate-400">from {Number(p.wholesaleMinQty)}</span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          p.currentStock <= Number(p.reorderLevel) ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {p.currentStock}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editId === p.id ? (
                          <button onClick={() => openEditor(p)} className="text-xs text-teal-700 hover:underline">
                            Close
                          </button>
                        ) : (
                          <ProductActionsMenu
                            productName={p.name}
                            onEdit={() => setEditing(p)}
                            onPricesAndPacks={() => openEditor(p)}
                            onArchive={() => { setArchiveError(null); setArchiving(p); }}
                            onDelete={() => { setDeleteError(null); setDeleting(p); }}
                          />
                        )}
                      </td>
                    </tr>
                    {editId === p.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Wholesale pricing (per base unit)</p>
                              <div className="flex gap-2">
                                <input type="number" placeholder="Wholesale price" value={priceForm.wholesalePrice}
                                  onChange={(e) => setPriceForm({ ...priceForm, wholesalePrice: e.target.value })}
                                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                <input type="number" placeholder="Also from qty…" value={priceForm.wholesaleMinQty}
                                  onChange={(e) => setPriceForm({ ...priceForm, wholesaleMinQty: e.target.value })}
                                  className="w-1/2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                              </div>
                              <p className="text-xs text-slate-500">
                                Wholesale customers always get this price. Anyone buying at least the quantity gets it too.
                              </p>
                              <button onClick={() => savePrices(p.id)}
                                className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm text-white">Save prices</button>
                            </div>

                            <div className="space-y-2">
                              <p className="text-sm font-medium">Packs (carton, sack, dozen…)</p>
                              {(p.packs ?? []).map((k) => (
                                <div key={k.id} className="flex items-center justify-between text-sm bg-white border rounded-lg px-3 py-1.5">
                                  <span>
                                    1 {k.name} = {Number(k.factor)} units
                                    {k.retailPrice != null && ` · retail ${Number(k.retailPrice).toLocaleString()}`}
                                    {k.wholesalePrice != null && ` · wholesale ${Number(k.wholesalePrice).toLocaleString()}`}
                                  </span>
                                  <button onClick={() => removePack(p.id, k.id)} className="text-xs text-red-600">Remove</button>
                                </div>
                              ))}
                              <div className="grid grid-cols-2 gap-2">
                                <input placeholder="Name (Carton)" value={packForm.name}
                                  onChange={(e) => setPackForm({ ...packForm, name: e.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                <input type="number" placeholder="Units in pack (24)" value={packForm.factor}
                                  onChange={(e) => setPackForm({ ...packForm, factor: e.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                <input type="number" placeholder="Retail price (optional)" value={packForm.retailPrice}
                                  onChange={(e) => setPackForm({ ...packForm, retailPrice: e.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                <input type="number" placeholder="Wholesale price (optional)" value={packForm.wholesalePrice}
                                  onChange={(e) => setPackForm({ ...packForm, wholesalePrice: e.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                              </div>
                              <button onClick={() => addPack(p.id)} disabled={!packForm.name.trim() || !packForm.factor}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50">Add pack</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>

      {editing && businessId && (
        <ProductEditDialog
          key={editing.id}
          product={editing}
          businessId={businessId}
          onClose={() => setEditing(null)}
          onSaved={async (name) => {
            setEditing(null);
            setNotice(`"${name}" was updated.`);
            await load();
          }}
        />
      )}

      {archiving && (
        <ConfirmDialog
          title="Archive this product?"
          confirmLabel="Archive product"
          busyLabel="Archiving…"
          tone="danger"
          busy={archiveBusy}
          error={archiveError}
          onConfirm={confirmArchive}
          onCancel={() => setArchiving(null)}
        >
          <p><strong>{archiving.name}</strong> will be archived.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>It will disappear from the active products list and can no longer be sold.</li>
            <li>Existing sales and purchase history will remain.</li>
            <li>Historical inventory transactions will not be deleted.</li>
            <li>You can restore it later from the Archived tab.</li>
          </ul>
        </ConfirmDialog>
      )}

      {deleting && (
        <ConfirmDialog
          title="Permanently delete this product?"
          confirmLabel="Delete permanently"
          busyLabel="Deleting…"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.name}</strong> will be permanently deleted.
          </p>
          <p>
            This action cannot be undone. Products with sales, purchases,
            returns, stock movements or stock-count history cannot be deleted.
            Archive those products instead.
          </p>
        </ConfirmDialog>
      )}

    </div>
  );
}
