'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  queueSale,
  syncPendingSales,
  getPendingCount,
  getRejectedSales,
  dismissRejectedSale,
  startAutoSync,
  cacheCatalog,
  loadCachedCatalog,
} from '@/lib/offline/sync';
import { printReceipt } from '@/lib/receipt';
import { priceFor, PricedPack, CustomerType } from '@/lib/pricing';
import type { OfflineSale } from '@/lib/offline/db';
import { useI18n } from '@/i18n';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  sellingPrice: string | number;
  wholesalePrice?: string | number | null;
  wholesaleMinQty?: string | number | null;
  currentStock: number;
  packs?: PricedPack[];
};

type Customer = {
  id: string;
  name: string;
  phone?: string;
  customerType?: CustomerType;
  outstandingBalance?: number;
};

type PaymentMethod = { id: string; name: string; code: string };

type CartLine = {
  lineId: string;
  product: Product;
  packId: string | null; // null = base unit
  quantity: number; // in packs when packId is set
  manualPrice?: number; // cashier typed a price
};

const newLineId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `l-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function PosPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState(''); // '' = pays the full total
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [rejected, setRejected] = useState<OfflineSale[]>([]);

  const customer = customers.find((c) => c.id === customerId) || null;
  const customerType: CustomerType | undefined = customer?.customerType;

  // ───────── connectivity + auto sync
  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const stop = startAutoSync(10000);
    const refreshQueue = () => {
      getPendingCount().then(setPendingSync);
      getRejectedSales().then(setRejected);
    };
    refreshQueue();
    const qTimer = setInterval(refreshQueue, 8000);
    return () => {
      clearInterval(qTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      stop();
    };
  }, []);

  // ───────── load catalog: network first (and refresh local copy), local copy when offline
  const applyCatalog = useCallback(
    (data: { products: Product[]; customers: Customer[]; paymentMethods: PaymentMethod[] }) => {
      setAllProducts(data.products);
      setProducts(data.products.slice(0, 40));
      setCustomers(data.customers);
      setPaymentMethods(data.paymentMethods);
      setSelectedPaymentId((cur) => {
        if (cur) return cur;
        const cash = data.paymentMethods.find((m) => m.code === 'CASH');
        return cash?.id || data.paymentMethods[0]?.id || '';
      });
    },
    [],
  );

  const loadCatalog = useCallback(
    async (bid: string) => {
      if (navigator.onLine) {
        const ok = await cacheCatalog(bid);
        if (!ok) setError('Could not refresh products. Using the saved copy.');
      }
      const cached = await loadCachedCatalog(bid);
      if (cached.products.length === 0 && !navigator.onLine) {
        setError('No saved products yet. Open the POS once with internet first.');
      }
      applyCatalog(cached as any);
    },
    [applyCatalog],
  );

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const bid = localStorage.getItem('businessId');
    if (!token) { router.push('/login'); return; }
    if (!bid) { router.push('/dashboard'); return; }
    setBusinessId(bid);
    loadCatalog(bid);
    const timer = setInterval(() => navigator.onLine && loadCatalog(bid), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [router, loadCatalog]);

  // ───────── search (always local: fast and works offline)
  const runSearch = useCallback(
    (q: string) => {
      const term = q.trim().toLowerCase();
      if (!term) { setProducts(allProducts.slice(0, 40)); return []; }
      const hits = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.barcode?.toLowerCase().includes(term),
      );
      setProducts(hits.slice(0, 40));
      return hits;
    },
    [allProducts],
  );

  useEffect(() => { runSearch(search); }, [search, runSearch]);

  // ───────── cart
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id && l.packId === null);
      if (existing) {
        return prev.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { lineId: newLineId(), product, packId: null, quantity: 1 }];
    });
  };

  // Enter = add the exact barcode/SKU match, or the only result (scanner friendly)
  const onSearchEnter = () => {
    const term = search.trim().toLowerCase();
    const hits = runSearch(search);
    const exact = hits.find((p) => p.barcode?.toLowerCase() === term || p.sku?.toLowerCase() === term);
    const pick = exact || (hits.length === 1 ? hits[0] : null);
    if (pick) { addToCart(pick); setSearch(''); }
  };

  const updateLine = (lineId: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)));

  const setQty = (lineId: string, qty: number) => {
    if (!(qty > 0)) setCart((prev) => prev.filter((l) => l.lineId !== lineId));
    else updateLine(lineId, { quantity: qty });
  };

  const packOf = (l: CartLine) => l.product.packs?.find((k) => k.id === l.packId) || null;

  // price shown to the customer; re-prices automatically when customer / qty / pack change
  const unitPriceOf = (l: CartLine) =>
    l.manualPrice != null ? l.manualPrice : priceFor(l.product, packOf(l), customerType, l.quantity);

  const total = useMemo(
    () => cart.reduce((sum, l) => sum + l.quantity * unitPriceOf(l), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, customerType],
  );

  const paid = amountPaid === '' ? total : Number(amountPaid) || 0;
  const onCredit = paid < total ? total - paid : 0;
  const change = paid > total ? paid - total : 0;

  // ───────── checkout
  const completeSale = async () => {
    if (!businessId || cart.length === 0 || !selectedPaymentId) return;
    if (onCredit > 0 && !customerId) {
      setError('Choose a customer to sell on credit (or enter the full amount paid).');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    const clientTransactionId = newLineId();
    const payload = {
      items: cart.map((l) => ({
        productId: l.product.id,
        packId: l.packId || undefined,
        quantity: l.quantity,
        sellingPrice: unitPriceOf(l), // exactly what the customer saw (important when offline)
        discount: 0,
      })),
      payments: [{ paymentMethodId: selectedPaymentId, amount: paid }],
      customerId: customerId || undefined,
      clientTransactionId,
    };

    const finish = async () => {
      setCart([]);
      setAmountPaid('');
      setPendingSync(await getPendingCount());
    };

    try {
      if (!navigator.onLine) {
        await queueSale(businessId, payload);
        setMessage('Sale saved offline — will sync when online');
        setLastReceipt(clientTransactionId.slice(0, 8));
        setLastSaleId(null);
        await finish();
        return;
      }

      const { data: sale } = await api.post('/sales', payload, {
        headers: { 'x-business-id': businessId },
      });
      setLastReceipt(sale.receiptNumber);
      setLastSaleId(sale.id);
      setMessage(`Sale complete — ${sale.receiptNumber}${change > 0 ? ` · Change ${change.toLocaleString()}` : ''}`);
      await finish();
      loadCatalog(businessId); // refresh stock numbers + customer balances
    } catch (err: any) {
      if (!err.response) {
        // network dropped mid-request: keep the sale safely on this device
        await queueSale(businessId, payload);
        setMessage('Network error — sale queued offline');
        await finish();
      } else {
        const msg = err.response?.data?.message;
        if (err.response?.status === 402) {
          setError('Your plan has ended, so selling is paused. Open Billing to renew.');
        } else {
          setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Sale failed');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    const result = await syncPendingSales();
    setPendingSync(await getPendingCount());
    setRejected(await getRejectedSales());
    setMessage(`Synced ${result.synced}, retry later ${result.failed}, rejected ${result.rejected}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Dashboard</Link>
          <h1 className="text-lg font-semibold">{t('pos')}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {pendingSync > 0 && (
            <button onClick={handleSync} className="rounded bg-amber-100 text-amber-800 px-2 py-1">
              {pendingSync} pending sync
            </button>
          )}
          <span className={online ? 'text-teal-600 font-medium' : 'text-red-600 font-medium'}>
            {online ? t('online') : t('offline')}
          </span>
        </div>
      </header>

      {rejected.length > 0 && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-2">
            <p className="font-medium">
              {rejected.length} offline sale(s) were refused by the server. Check them against your records:
            </p>
            {rejected.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 bg-white rounded px-3 py-2">
                <span>
                  {new Date(r.createdAt).toLocaleString()} ·{' '}
                  {(r.payload?.items || []).length} item(s) · {r.error}
                </span>
                <button
                  className="text-xs underline whitespace-nowrap"
                  onClick={async () => {
                    await dismissRejectedSale(r.id);
                    setRejected(await getRejectedSales());
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full gap-4 p-4">
        {/* ── products */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex gap-2 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
              placeholder={t('searchProducts')}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              autoFocus
            />
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {products.map((p) => {
              const hasWholesale = p.wholesalePrice != null;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-teal-50 flex justify-between items-center text-sm"
                >
                  <span>
                    <span className="font-medium">{p.name}</span>
                    {p.sku && <span className="text-slate-400 ml-2 text-xs">{p.sku}</span>}
                    {p.packs && p.packs.length > 0 && (
                      <span className="ml-2 text-xs text-slate-400">{p.packs.map((k) => k.name).join(' / ')}</span>
                    )}
                  </span>
                  <span className="text-slate-700 text-right">
                    {priceFor(p, null, customerType, 1).toLocaleString()}
                    {hasWholesale && customerType !== 'WHOLESALE' && (
                      <span className="text-xs text-slate-400"> · W {Number(p.wholesalePrice).toLocaleString()}</span>
                    )}
                    <span className="text-xs text-slate-500"> · stock {p.currentStock}</span>
                  </span>
                </button>
              );
            })}
            {products.length === 0 && (
              <p className="text-sm text-slate-400 py-8 text-center">
                {allProducts.length === 0
                  ? 'No products yet. Add products, or open the POS once with internet.'
                  : 'No product matches your search.'}
              </p>
            )}
          </div>
        </div>

        {/* ── cart */}
        <div className="w-full lg:w-[28rem] bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.customerType === 'WHOLESALE' ? ' (wholesale)' : ''}
                  {c.outstandingBalance ? ` · owes ${Number(c.outstandingBalance).toLocaleString()}` : ''}
                </option>
              ))}
            </select>
          </div>

          <h2 className="font-medium mb-2">{t('cart')}</h2>
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[38vh]">
            {cart.map((l) => {
              const packs = l.product.packs || [];
              const price = unitPriceOf(l);
              return (
                <div key={l.lineId} className="text-sm border-b border-slate-100 pb-2">
                  <div className="flex justify-between">
                    <p className="font-medium">{l.product.name}</p>
                    <p className="font-medium">{(l.quantity * price).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {packs.length > 0 && (
                      <select
                        value={l.packId || ''}
                        onChange={(e) => updateLine(l.lineId, { packId: e.target.value || null, manualPrice: undefined })}
                        className="rounded border border-slate-300 px-1 py-1 text-xs"
                      >
                        <option value="">Unit</option>
                        {packs.map((k) => (
                          <option key={k.id} value={k.id}>{k.name} ({Number(k.factor)})</option>
                        ))}
                      </select>
                    )}
                    <button onClick={() => setQty(l.lineId, l.quantity - 1)} className="w-7 h-7 rounded border text-center">−</button>
                    <input
                      type="number"
                      value={l.quantity}
                      onChange={(e) => setQty(l.lineId, Number(e.target.value))}
                      className="w-14 rounded border border-slate-300 px-1 py-1 text-center text-sm"
                    />
                    <button onClick={() => setQty(l.lineId, l.quantity + 1)} className="w-7 h-7 rounded border text-center">+</button>
                    <span className="text-slate-400">×</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => updateLine(l.lineId, { manualPrice: Number(e.target.value) })}
                      className="w-24 rounded border border-slate-300 px-1 py-1 text-right text-sm"
                      title="Price per unit/pack. Change it to give a special price."
                    />
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && <p className="text-sm text-slate-400 text-center py-6">{t('emptyCart')}</p>}
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('paymentMethod')}</label>
                <select
                  value={selectedPaymentId}
                  onChange={(e) => setSelectedPaymentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Amount paid</label>
                <input
                  type="number"
                  value={amountPaid}
                  placeholder={String(total)}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-between text-lg font-semibold">
              <span>{t('total')}</span>
              <span>{total.toLocaleString()} TZS</span>
            </div>
            {change > 0 && <p className="text-sm text-slate-600">Change to give: <b>{change.toLocaleString()}</b></p>}
            {onCredit > 0 && (
              <p className="text-sm text-amber-700">
                {onCredit.toLocaleString()} goes on {customer ? `${customer.name}'s account` : 'credit — choose a customer'}
              </p>
            )}

            {error && <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}
            {message && (
              <div className="text-sm text-teal-700 bg-teal-50 rounded px-3 py-2">
                {message}
                {lastReceipt && <span className="block text-xs mt-1">Ref: {lastReceipt}</span>}
                {lastSaleId && businessId && (
                  <span className="flex gap-3 mt-1">
                    <button type="button" className="text-xs underline text-teal-800" onClick={() => printReceipt(lastSaleId, businessId)}>
                      {t('printReceipt')}
                    </button>
                    <Link href={`/invoice/${lastSaleId}`} target="_blank" className="text-xs underline text-teal-800">
                      Invoice / delivery note
                    </Link>
                  </span>
                )}
              </div>
            )}

            <button
              disabled={cart.length === 0 || loading || !selectedPaymentId}
              onClick={completeSale}
              className="w-full rounded-lg bg-teal-700 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {loading ? t('loading') : online ? t('completeSale') : t('saveOffline')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
