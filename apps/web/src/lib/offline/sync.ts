import { api } from '@/lib/api';
import { offlineDb, OfflineSale } from './db';

export async function queueSale(
  businessId: string,
  payload: any,
): Promise<string> {
  const id =
    payload.clientTransactionId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `offline-${Date.now()}`);

  const record: OfflineSale = {
    id,
    businessId,
    payload: {
      ...payload,
      clientTransactionId: id,
      // lets the server accept this sale after the plan expired, if it was really made before
      offlineCreatedAt: payload.offlineCreatedAt || new Date().toISOString(),
    },
    status: 'pending',
    createdAt: Date.now(),
  };

  await offlineDb.sales.put(record);
  return id;
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.sales.where('status').anyOf(['pending', 'failed', 'syncing']).count();
}

/** Sales the server refused (e.g. not enough stock, credit limit). Need a human decision. */
export async function getRejectedSales(): Promise<OfflineSale[]> {
  return offlineDb.sales.where('status').equals('rejected').toArray();
}

export async function dismissRejectedSale(id: string): Promise<void> {
  await offlineDb.sales.delete(id);
}

let syncing = false;

export async function syncPendingSales(): Promise<{
  synced: number;
  failed: number;
  rejected: number;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0, rejected: 0 };
  }
  if (syncing) return { synced: 0, failed: 0, rejected: 0 };
  syncing = true;

  let synced = 0;
  let failed = 0;
  let rejected = 0;

  try {
    // A tab closed mid-request leaves "syncing" rows behind: retry them (safe, sales are idempotent).
    const pending = await offlineDb.sales
      .where('status')
      .anyOf(['pending', 'failed', 'syncing'])
      .sortBy('createdAt');

    for (const sale of pending) {
      await offlineDb.sales.update(sale.id, { status: 'syncing' });
      try {
        await api.post('/sales', sale.payload, {
          headers: { 'x-business-id': sale.businessId },
        });
        await offlineDb.sales.update(sale.id, { status: 'synced', syncedAt: Date.now(), error: undefined });
        synced++;
      } catch (err: any) {
        const code = err.response?.status as number | undefined;
        if (code === 409) {
          // already on the server (idempotent resend)
          await offlineDb.sales.update(sale.id, { status: 'synced', syncedAt: Date.now() });
          synced++;
        } else if (code && code >= 400 && code < 500 && code !== 408 && code !== 429 && code !== 401 && code !== 402) {
          // The server understood and said no. Retrying will never help.
          // (402 = plan expired: NOT here, it is retried and goes through after renewal.)
          const msg = err.response?.data?.message;
          await offlineDb.sales.update(sale.id, {
            status: 'rejected',
            error: Array.isArray(msg) ? msg.join(', ') : msg || 'Rejected by server',
          });
          rejected++;
        } else {
          // no network / server down / expired login: try again later
          await offlineDb.sales.update(sale.id, {
            status: 'failed',
            error: err.response?.data?.message || err.message || 'Sync failed',
          });
          failed++;
        }
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed, rejected };
}

export function startAutoSync(intervalMs = 15000) {
  if (typeof window === 'undefined') return () => {};

  const run = () => {
    if (navigator.onLine) {
      syncPendingSales().catch(() => {});
    }
  };

  window.addEventListener('online', run);
  const timer = setInterval(run, intervalMs);
  run();

  return () => {
    window.removeEventListener('online', run);
    clearInterval(timer);
  };
}

/**
 * Download products, customers and payment methods into IndexedDB so the POS can
 * start and sell with no internet. Call it whenever the POS opens while online.
 */
export async function cacheCatalog(businessId: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const headers = { 'x-business-id': businessId };
  try {
    const products: any[] = [];
    for (let page = 1; page <= 50; page++) {
      const res = await api.get('/products', { headers, params: { page, limit: 100 } });
      products.push(...(res.data.items || []));
      if (page >= (res.data.totalPages || 1)) break;
    }
    const [customersRes, methodsRes] = await Promise.all([
      api.get('/customers', { headers }),
      api.get('/payment-methods', { headers }),
    ]);

    await offlineDb.transaction(
      'rw',
      [offlineDb.products, offlineDb.customers, offlineDb.paymentMethods, offlineDb.meta],
      async () => {
        await offlineDb.products.where('businessId').equals(businessId).delete();
        await offlineDb.customers.where('businessId').equals(businessId).delete();
        await offlineDb.paymentMethods.where('businessId').equals(businessId).delete();
        await offlineDb.products.bulkPut(products.map((p) => ({ ...p, businessId })));
        await offlineDb.customers.bulkPut((customersRes.data || []).map((c: any) => ({ ...c, businessId })));
        await offlineDb.paymentMethods.bulkPut((methodsRes.data || []).map((m: any) => ({ ...m, businessId })));
        await offlineDb.meta.put({ key: `catalogCachedAt:${businessId}`, value: String(Date.now()) });
      },
    );
    return true;
  } catch {
    return false; // keep whatever copy we already have
  }
}

export async function loadCachedCatalog(businessId: string) {
  const [products, customers, paymentMethods] = await Promise.all([
    offlineDb.products.where('businessId').equals(businessId).toArray(),
    offlineDb.customers.where('businessId').equals(businessId).toArray(),
    offlineDb.paymentMethods.where('businessId').equals(businessId).toArray(),
  ]);
  return { products, customers, paymentMethods };
}
