'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

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
    if (!localStorage.getItem('accessToken')) { router.push('/login'); return; }
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
      await api.post(`/purchases/${purchase.id}/receive`, { items }, {
        headers: { 'x-business-id': businessId },
      });
      setMessage('Stock received');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Receive failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-500">← Dashboard</Link>
            <h1 className="text-lg font-semibold">Purchases</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            {showForm ? 'Cancel' : 'New purchase'}
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        {message && <div className="mb-4 rounded-lg bg-teal-50 text-teal-700 text-sm px-3 py-2">{message}</div>}
        {showForm && (
          <form onSubmit={create} className="mb-6 bg-white rounded-xl border p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={productId} onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              if (p) setUnitCost(String(p.costPrice));
            }} className="rounded-lg border px-3 py-2 text-sm">
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
            <input type="number" placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">Create</button>
          </form>
        )}
        {loading ? <p className="text-slate-500">Loading…</p> : purchases.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">No purchases yet. Create a supplier and product first.</div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{p.purchaseNumber}</td>
                    <td className="px-4 py-3">{p.supplier?.name}</td>
                    <td className="px-4 py-3"><span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">{p.status}</span></td>
                    <td className="px-4 py-3 text-right">{Number(p.total).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {p.status !== 'RECEIVED' && p.status !== 'CANCELLED' && (
                        <button onClick={() => receiveAll(p)} className="text-teal-700 text-xs font-medium hover:underline">
                          Receive stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
