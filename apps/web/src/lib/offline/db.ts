import Dexie, { Table } from 'dexie';

export interface OfflineSale {
  id: string; // clientTransactionId
  businessId: string;
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'rejected';
  error?: string;
  createdAt: number;
  syncedAt?: number;
}

export interface CachedProduct {
  id: string;
  businessId: string;
  name: string;
  sku?: string;
  barcode?: string;
  [key: string]: any;
}

export interface CachedCustomer {
  id: string;
  businessId: string;
  name: string;
  [key: string]: any;
}

export interface CachedPaymentMethod {
  id: string;
  businessId: string;
  name: string;
  code: string;
  [key: string]: any;
}

export interface OfflineMeta {
  key: string;
  value: string;
}

class RetailOfflineDB extends Dexie {
  sales!: Table<OfflineSale, string>;
  meta!: Table<OfflineMeta, string>;
  products!: Table<CachedProduct, string>;
  customers!: Table<CachedCustomer, string>;
  paymentMethods!: Table<CachedPaymentMethod, string>;

  constructor() {
    super('RetailOSOffline');
    this.version(1).stores({
      sales: 'id, businessId, status, createdAt',
      meta: 'key',
    });
    // v2: local copy of the catalog so the POS keeps working after a reload with no internet
    this.version(2).stores({
      sales: 'id, businessId, status, createdAt',
      meta: 'key',
      products: 'id, businessId, name, sku, barcode',
      customers: 'id, businessId, name',
      paymentMethods: 'id, businessId',
    });
  }
}

export const offlineDb = new RetailOfflineDB();
