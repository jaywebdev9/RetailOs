/**
 * Product management: edit / archive / restore / list-by-status.
 *
 * Unit tests with an in-memory fake of PrismaService: NO database, NO network, no env vars needed.
 *
 * Run (from apps/api):
 *   npx jest --config ./test/jest-e2e.json products-management
 */
import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from '../src/modules/products/products.service';
import { ProductsController } from '../src/modules/products/products.controller';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../src/common/decorators/permissions.decorator';

const A = 'biz-a';
const B = 'biz-b';
const USER_A = 'user-a';
const USER_B = 'user-b';
const D = (n: number) => new Prisma.Decimal(n);

function baseProduct(over: Record<string, any> = {}) {
  return {
    id: 'p1',
    businessId: A,
    name: 'Sugar 1kg',
    sku: 'SUG-1',
    barcode: '111',
    description: 'White sugar',
    categoryId: null,
    unitId: null,
    costPrice: D(2300),
    sellingPrice: D(2800),
    minimumSellingPrice: D(2500),
    wholesalePrice: D(2600),
    wholesaleMinQty: D(10),
    reorderLevel: D(20),
    reorderQuantity: D(50),
    trackInventory: true,
    allowNegativeStock: false,
    status: 'ACTIVE',
    ...over,
  };
}

function match(rec: any, where: any): boolean {
  return Object.entries(where).every(([k, v]: [string, any]) => {
    if (k === 'NOT') return rec.id !== v.id;
    if (k === 'OR') {
      return v.some((cond: any) =>
        Object.entries(cond).every(([f, c]: [string, any]) =>
          String(rec[f] ?? '').toLowerCase().includes(String(c.contains).toLowerCase()),
        ),
      );
    }
    return rec[k] === v;
  });
}

function makeDb() {
  const state = {
    products: [
      baseProduct(),
      baseProduct({ id: 'p2', name: 'Rice 1kg', sku: 'RICE-1', barcode: '222' }),
      baseProduct({ id: 'p3', name: 'Old Soap', sku: 'SOAP-1', barcode: '333', status: 'ARCHIVED' }),
      baseProduct({ id: 'pb', businessId: B, name: 'B-only item', sku: 'B-1', barcode: '999' }),
    ] as any[],
    categories: [
      { id: 'cat-a', businessId: A, name: 'Food', isActive: true },
      { id: 'cat-b', businessId: B, name: 'Other biz', isActive: true },
    ],
    units: [
      { id: 'u-a', businessId: A, name: 'Piece', symbol: 'pcs', isActive: true },
      { id: 'u-b', businessId: B, name: 'Kg', symbol: 'kg', isActive: true },
    ],
    members: [
      { businessId: A, userId: USER_A, isActive: true },
      { businessId: B, userId: USER_B, isActive: true },
    ],
    // history that must survive archive / restore / edit
    inventoryTxns: [{ id: 't1', businessId: A, productId: 'p1', quantity: 100 }],
    saleItems: [{ id: 's1', productId: 'p1' }],
    purchaseItems: [{ id: 'pi1', productId: 'p1' }],
    audit: [] as any[],
    updates: [] as any[],
    failNextUpdateWith: null as any,
  };

  const prisma: any = {
    businessMember: {
      findFirst: async ({ where }: any) => state.members.find((m) => match(m, where)) ?? null,
    },
    product: {
      // return copies, like a real database client does (callers must not see later writes)
      findFirst: async ({ where }: any) => {
        const rec = state.products.find((p) => match(p, where));
        return rec ? { ...rec } : null;
      },
      findMany: async ({ where }: any) => state.products.filter((p) => match(p, where)),
      count: async ({ where }: any) => state.products.filter((p) => match(p, where)).length,
      update: async ({ where, data }: any) => {
        if (state.failNextUpdateWith) {
          const e = state.failNextUpdateWith;
          state.failNextUpdateWith = null;
          throw e;
        }
        state.updates.push(data);
        const rec = state.products.find((p) => p.id === where.id);
        for (const [k, v] of Object.entries<any>(data)) {
          if (k === 'category') rec.categoryId = v.connect ? v.connect.id : null;
          else if (k === 'unit') rec.unitId = v.connect ? v.connect.id : null;
          else rec[k] = v;
        }
        return { ...rec };
      },
      delete: async () => {
        throw new Error('product.delete must never be called');
      },
    },
    category: {
      findFirst: async ({ where }: any) => state.categories.find((c) => match(c, where)) ?? null,
      findMany: async ({ where }: any) => state.categories.filter((c) => match(c, where)),
    },
    unit: {
      findFirst: async ({ where }: any) => state.units.find((c) => match(c, where)) ?? null,
      findMany: async ({ where }: any) => state.units.filter((c) => match(c, where)),
    },
    inventoryTransaction: {
      groupBy: async () => [],
      deleteMany: async () => {
        throw new Error('inventory history must never be deleted');
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.audit.push(data);
        return data;
      },
    },
  };
  return { state, prisma };
}

describe('ProductsService - edit, archive, restore', () => {
  let db: ReturnType<typeof makeDb>;
  let svc: ProductsService;

  beforeEach(() => {
    db = makeDb();
    svc = new ProductsService(db.prisma);
  });

  // ───────────── update ─────────────
  describe('update', () => {
    it('changes only the fields that were sent', async () => {
      await svc.update(A, USER_A, 'p1', { sellingPrice: 3000 });
      const data = db.state.updates[0];
      expect(Object.keys(data)).toEqual(['sellingPrice']);
      expect(db.state.products[0].sellingPrice.toString()).toBe('3000');
      expect(db.state.products[0].costPrice.toString()).toBe('2300'); // untouched
      expect(db.state.products[0].name).toBe('Sugar 1kg');
    });

    it('keeps a legitimate 0 (does not turn it into null/empty)', async () => {
      await svc.update(A, USER_A, 'p1', { reorderLevel: 0, wholesaleMinQty: 0 });
      expect(db.state.products[0].reorderLevel.toString()).toBe('0');
      expect(db.state.products[0].wholesaleMinQty.toString()).toBe('0');
    });

    it('clears optional fields when null/blank is sent (min price, wholesale, text)', async () => {
      await svc.update(A, USER_A, 'p1', {
        minimumSellingPrice: null as any,
        wholesalePrice: null as any,
        wholesaleMinQty: null as any,
        barcode: '   ',
        description: '',
      });
      const p = db.state.products[0];
      expect(p.minimumSellingPrice).toBeNull();
      expect(p.wholesalePrice).toBeNull();
      expect(p.wholesaleMinQty).toBeNull();
      expect(p.barcode).toBeNull();
      expect(p.description).toBeNull();
    });

    it('rejects null for required numbers with a 400 and writes nothing', async () => {
      await expect(svc.update(A, USER_A, 'p1', { costPrice: null as any })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(svc.update(A, USER_A, 'p1', { sellingPrice: null as any })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.state.updates.length).toBe(0);
    });

    it('rejects a blank name', async () => {
      await expect(svc.update(A, USER_A, 'p1', { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
      expect(db.state.updates.length).toBe(0);
    });

    it('trims the name', async () => {
      await svc.update(A, USER_A, 'p1', { name: '  Sugar 2kg ' });
      expect(db.state.products[0].name).toBe('Sugar 2kg');
    });

    it('rejects a duplicate SKU of another active product', async () => {
      await expect(svc.update(A, USER_A, 'p1', { sku: 'RICE-1' })).rejects.toThrow('SKU already exists');
      expect(db.state.updates.length).toBe(0);
    });

    it('rejects a duplicate barcode and says when the owner is archived', async () => {
      await expect(svc.update(A, USER_A, 'p1', { barcode: '333' })).rejects.toThrow(
        'Barcode already exists (used by an archived product)',
      );
    });

    it('allows saving the product with its own SKU/barcode unchanged', async () => {
      await svc.update(A, USER_A, 'p1', { sku: 'SUG-1', barcode: '111', name: 'Sugar' });
      expect(db.state.products[0].name).toBe('Sugar');
    });

    it('turns a database unique-violation race (P2002) into a 409', async () => {
      db.state.failNextUpdateWith = Object.assign(new Error('unique'), { code: 'P2002' });
      await expect(svc.update(A, USER_A, 'p1', { sku: 'NEW-SKU' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('does not swallow other database errors', async () => {
      db.state.failNextUpdateWith = new Error('boom');
      await expect(svc.update(A, USER_A, 'p1', { name: 'X' })).rejects.toThrow('boom');
    });

    it('accepts a category and unit of the same business', async () => {
      await svc.update(A, USER_A, 'p1', { categoryId: 'cat-a', unitId: 'u-a' });
      expect(db.state.products[0].categoryId).toBe('cat-a');
      expect(db.state.products[0].unitId).toBe('u-a');
    });

    it("rejects another business's category or unit", async () => {
      await expect(svc.update(A, USER_A, 'p1', { categoryId: 'cat-b' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(svc.update(A, USER_A, 'p1', { unitId: 'u-b' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.state.updates.length).toBe(0);
    });

    it('writes an audit entry with the previous values of the changed fields', async () => {
      await svc.update(A, USER_A, 'p1', { sellingPrice: 3000 });
      const log = db.state.audit[0];
      expect(log.action).toBe('PRODUCT_UPDATE');
      expect(log.entityId).toBe('p1');
      expect(log.businessId).toBe(A);
      expect(log.oldValues.sellingPrice).toBe('2800');
    });

    it('never touches sales, purchases or stock history', async () => {
      await svc.update(A, USER_A, 'p1', { costPrice: 9999, sellingPrice: 12000 });
      expect(db.state.saleItems.length).toBe(1);
      expect(db.state.purchaseItems.length).toBe(1);
      expect(db.state.inventoryTxns.length).toBe(1);
      expect(Object.keys(db.state.updates[0]).sort()).toEqual(['costPrice', 'sellingPrice']);
    });
  });

  // ───────────── business isolation ─────────────
  describe('business isolation', () => {
    it("a user of business A cannot update business B's product", async () => {
      await expect(svc.update(A, USER_A, 'pb', { name: 'hacked' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.state.products.find((p) => p.id === 'pb')!.name).toBe('B-only item');
    });

    it("a user of business A cannot archive or restore business B's product", async () => {
      await expect(svc.archive(A, USER_A, 'pb')).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.restore(A, USER_A, 'pb')).rejects.toBeInstanceOf(NotFoundException);
      expect(db.state.products.find((p) => p.id === 'pb')!.status).toBe('ACTIVE');
    });

    it('a user who is not a member of the business is refused (even with a valid product id)', async () => {
      await expect(svc.update(B, USER_A, 'pb', { name: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.archive(B, USER_A, 'pb')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.findAll(B, USER_A, { status: 'ARCHIVED' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('a SKU used in another business is not a conflict', async () => {
      await svc.update(A, USER_A, 'p1', { sku: 'B-1' });
      expect(db.state.products[0].sku).toBe('B-1');
    });

    it('catalog options only list the caller business', async () => {
      const res = await svc.catalogOptions(A, USER_A);
      expect(res.categories.map((c: any) => c.id)).toEqual(['cat-a']);
      expect(res.units.map((u: any) => u.id)).toEqual(['u-a']);
      await expect(svc.catalogOptions(A, USER_B)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ───────────── archive / restore ─────────────
  describe('archive and restore', () => {
    it('archive sets status ARCHIVED, keeps the row and all history', async () => {
      const res = await svc.archive(A, USER_A, 'p1');
      expect(res.status).toBe('ARCHIVED');
      expect(db.state.products.some((p) => p.id === 'p1')).toBe(true);
      expect(db.state.inventoryTxns.length).toBe(1);
      expect(db.state.saleItems.length).toBe(1);
      expect(db.state.purchaseItems.length).toBe(1);
      expect(Object.keys(db.state.updates[0])).toEqual(['status']);
      expect(db.state.audit[0].oldValues.status).toBe('ACTIVE');
    });

    it('restore sets status ACTIVE again', async () => {
      const res = await svc.restore(A, USER_A, 'p3');
      expect(res.status).toBe('ACTIVE');
      expect(db.state.products.find((p) => p.id === 'p3')!.sku).toBe('SOAP-1'); // SKU intact
    });

    it('archive then restore round-trips', async () => {
      await svc.archive(A, USER_A, 'p2');
      expect((await svc.findAll(A, USER_A, {})).items.map((i: any) => i.id)).not.toContain('p2');
      await svc.restore(A, USER_A, 'p2');
      expect((await svc.findAll(A, USER_A, {})).items.map((i: any) => i.id)).toContain('p2');
    });

    it('an unknown product id is a 404', async () => {
      await expect(svc.archive(A, USER_A, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('there is no permanent-delete method on the service', () => {
      expect((svc as any).remove).toBeUndefined();
      expect((svc as any).delete).toBeUndefined();
    });
  });

  // ───────────── listing by status ─────────────
  describe('findAll status filter', () => {
    it('defaults to ACTIVE only (existing behaviour)', async () => {
      const res = await svc.findAll(A, USER_A, {});
      expect(res.items.map((i: any) => i.id).sort()).toEqual(['p1', 'p2']);
    });

    it('status=ARCHIVED returns only archived products of this business', async () => {
      const res = await svc.findAll(A, USER_A, { status: 'ARCHIVED' });
      expect(res.items.map((i: any) => i.id)).toEqual(['p3']);
      expect(res.total).toBe(1);
    });

    it('searches within archived products', async () => {
      const hit = await svc.findAll(A, USER_A, { status: 'ARCHIVED', search: 'soap' });
      expect(hit.items.length).toBe(1);
      const miss = await svc.findAll(A, USER_A, { status: 'ARCHIVED', search: 'sugar' });
      expect(miss.items.length).toBe(0);
    });

    it('rejects an unknown status with a 400', async () => {
      await expect(svc.findAll(A, USER_A, { status: 'DELETED' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});

// ───────────── permissions ─────────────
describe('permissions on product management endpoints', () => {

  const required = (name: string): string[] =>
    Reflect.getMetadata(PERMISSIONS_KEY, (ProductsController.prototype as any)[name]);

  it('update, archive and restore all require products.update', () => {
    expect(required('update')).toEqual(['products.update']);
    expect(required('archive')).toEqual(['products.update']);
    expect(required('restore')).toEqual(['products.update']);
  });

  const guardFor = (permissionCodes: string[], isOwner = false, active = true) => {
    const prisma: any = {
      businessMember: {
        findFirst: async () =>
          active
            ? {
                isOwner,
                role: { permissions: permissionCodes.map((code) => ({ permission: { code } })) },
              }
            : null,
      },
    };
    const reflector: any = { getAllAndOverride: () => ['products.update'] };
    return new PermissionsGuard(reflector, prisma);
  };
  const ctx = (headers: Record<string, string> = { 'x-business-id': A }) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { sub: USER_A }, headers }) }),
    }) as any;

  it('refuses a member whose role lacks products.update', async () => {
    await expect(guardFor(['products.view']).canActivate(ctx())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a member whose role has products.update', async () => {
    expect(await guardFor(['products.update']).canActivate(ctx())).toBe(true);
  });

  it('allows the business owner', async () => {
    expect(await guardFor([], true).canActivate(ctx())).toBe(true);
  });

  it('refuses a non-member and a request without x-business-id', async () => {
    await expect(guardFor([], false, false).canActivate(ctx())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guardFor(['products.update']).canActivate(ctx({}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
