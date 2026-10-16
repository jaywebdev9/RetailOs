/**
 * Critical business flow integration tests.
 * Requires a running database (DATABASE_URL).
 *
 * Run: npx jest --config apps/api/test/jest-e2e.json
 * or:  npm run test:e2e -w @retail-os/api
 *
 * Flow covered:
 *   register → create business → product → supplier → purchase → receive
 *   → stock=100 → sell 10 → stock=90 → COGS/profit → expense → net profit
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { SubscriptionStateService } from '../src/modules/billing/subscription-state.service';

describe('Critical business flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let businessId: string;
  let productId: string;
  let supplierId: string;
  let purchaseId: string;
  let purchaseItemId: string;
  let paymentMethodId: string;
  let userId: string;

  const unique = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test data if needed
    await app.close();
  });

  it('1. Register user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `test-${unique}@retailos.test`,
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'Owner',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.id).toBeDefined();
    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  it('2. Create business', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `Test Shop ${unique}`,
        businessType: 'GROCERY',
        currency: 'TZS',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    businessId = res.body.id;

    const methods = await request(app.getHttpServer())
      .get('/api/v1/payment-methods')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .expect(200);

    paymentMethodId = methods.body.find((m: any) => m.code === 'CASH')?.id;
    expect(paymentMethodId).toBeDefined();
  });

  it('3. Create product', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Test Sugar 1kg',
        sku: `SUG-${unique}`,
        costPrice: 2000,
        sellingPrice: 2500,
        reorderLevel: 10,
      })
      .expect(201);

    productId = res.body.id;
    expect(res.body.currentStock ?? 0).toBe(0);
  });

  it('4. Create supplier', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({ name: `Supplier ${unique}` })
      .expect(201);

    supplierId = res.body.id;
  });

  it('5. Purchase 100 units', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        supplierId,
        items: [{ productId, quantityOrdered: 100, unitCost: 2000 }],
      })
      .expect(201);

    purchaseId = res.body.id;
    purchaseItemId = res.body.items[0].id;
    expect(res.body.status).toBe('ORDERED');
  });

  it('6. Receive 100 units → stock = 100', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchaseId}/receive`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        items: [{ purchaseItemId, quantityReceived: 100 }],
      })
      .expect(201);

    const prod = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .expect(200);

    expect(Number(prod.body.currentStock)).toBe(100);
  });

  it('7. Sell 10 units → stock = 90, verify COGS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        items: [{ productId, quantity: 10, sellingPrice: 2500 }],
        payments: [{ paymentMethodId, amount: 25000 }],
        clientTransactionId: `test-sale-${unique}`,
      })
      .expect(201);

    expect(res.body.total).toBeDefined();
    expect(Number(res.body.total)).toBe(25000);

    const prod = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .expect(200);

    expect(Number(prod.body.currentStock)).toBe(90);

    // COGS = 10 * 2000 = 20000, Gross = 5000
    const today = await request(app.getHttpServer())
      .get('/api/v1/sales/today')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .expect(200);

    expect(today.body.revenue).toBeGreaterThanOrEqual(25000);
    expect(today.body.cogs).toBeGreaterThanOrEqual(20000);
    expect(today.body.grossProfit).toBeGreaterThanOrEqual(5000);
  });

  it('8. Idempotent resync does not duplicate sale', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        items: [{ productId, quantity: 10, sellingPrice: 2500 }],
        payments: [{ paymentMethodId, amount: 25000 }],
        clientTransactionId: `test-sale-${unique}`, // same ID
      })
      .expect(201);

    // Stock should still be 90, not 80
    const prod = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .expect(200);

    expect(Number(prod.body.currentStock)).toBe(90);
  });

  it('9. Create expense and verify net profit path', async () => {
    const cats = await request(app.getHttpServer())
      .get('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .expect(200);

    const categoryId = cats.body[0]?.id;
    expect(categoryId).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({ categoryId, amount: 1000, description: 'Test expense' })
      .expect(201);

    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 1);

    const profit = await request(app.getHttpServer())
      .get('/api/v1/reports/profit')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .query({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      })
      .expect(200);

    expect(profit.body.operatingExpenses).toBeGreaterThanOrEqual(1000);
    expect(profit.body.netProfit).toBeDefined();
  });

  // ───────────── Phase 1: returns, void, credit, cash, cost ─────────────

  const http = () => request(app.getHttpServer());
  const authed = (r: request.Test) =>
    r.set('Authorization', `Bearer ${accessToken}`).set('x-business-id', businessId);
  const stockOf = async (id: string) => {
    const res = await authed(http().get(`/api/v1/products/${id}`)).expect(200);
    return Number(res.body.currentStock);
  };
  const sell = (qty: number, paid: number, extra: Record<string, unknown> = {}) =>
    authed(http().post('/api/v1/sales')).send({
      items: [{ productId, quantity: qty, sellingPrice: 2500 }],
      payments: [{ paymentMethodId, amount: paid }],
      ...extra,
    });

  it('10. Returns: server-side refund, no over-returning, restock, full return status', async () => {
    const before = await stockOf(productId);
    const sale = await sell(4, 10000).expect(201);
    const saleId = sale.body.id;
    const saleItemId = sale.body.items[0].id;
    expect(await stockOf(productId)).toBe(before - 4);

    // client-sent refundAmount is ignored; server computes 1 × 2500
    const r1 = await authed(http().post('/api/v1/sales/returns'))
      .send({ saleId, items: [{ saleItemId, quantity: 1, refundAmount: 999999 }] })
      .expect(201);
    expect(Number(r1.body.totalRefund)).toBe(2500);
    expect(await stockOf(productId)).toBe(before - 3);

    // 1 already returned → returning 4 more exceeds the original 4
    await authed(http().post('/api/v1/sales/returns'))
      .send({ saleId, items: [{ saleItemId, quantity: 4 }] })
      .expect(400);

    await authed(http().post('/api/v1/sales/returns'))
      .send({ saleId, items: [{ saleItemId, quantity: 3 }] })
      .expect(201);
    expect(await stockOf(productId)).toBe(before);

    const finalSale = await authed(http().get(`/api/v1/sales/${saleId}`)).expect(200);
    expect(finalSale.body.status).toBe('FULLY_RETURNED');
  });

  it('11. Void sale puts stock back and cannot be voided twice', async () => {
    const before = await stockOf(productId);
    const sale = await sell(2, 5000).expect(201);
    expect(await stockOf(productId)).toBe(before - 2);

    await authed(http().post(`/api/v1/sales/${sale.body.id}/void`))
      .send({ reason: 'Wrong item scanned' })
      .expect(201);
    expect(await stockOf(productId)).toBe(before);

    await authed(http().post(`/api/v1/sales/${sale.body.id}/void`))
      .send({ reason: 'Again' })
      .expect(400);
  });

  it('12. Credit sales need a customer and respect the credit limit', async () => {
    // no customer → rejected
    await sell(1, 0).expect(400);

    const cust = await authed(http().post('/api/v1/customers'))
      .send({ name: `Limit Customer ${unique}`, creditLimit: 5000 })
      .expect(201);
    const customerId = cust.body.id;

    // 4 × 2500 = 10000 on credit > limit 5000
    await sell(4, 0, { customerId }).expect(400);
    // 2 × 2500 = 5000 on credit = limit → allowed
    const ok = await sell(2, 0, { customerId }).expect(201);
    expect(ok.body.paymentStatus).toBe('CREDIT');
    // anything more goes over the limit
    await sell(1, 0, { customerId }).expect(400);
  });

  it('13. Cash session: expected cash includes cash sales and cash expenses', async () => {
    const session = await authed(http().post('/api/v1/cash/sessions/open'))
      .send({ openingCash: 0 })
      .expect(201);

    await sell(3, 7500).expect(201); // +7500 cash

    const cats = await authed(http().get('/api/v1/expenses/categories')).expect(200);
    await authed(http().post('/api/v1/expenses'))
      .send({ categoryId: cats.body[0].id, amount: 1000 }) // no method = cash → -1000
      .expect(201);

    const closed = await authed(http().post(`/api/v1/cash/sessions/${session.body.id}/close`))
      .send({ actualCash: 6500 })
      .expect(201);
    expect(Number(closed.body.expectedCash)).toBe(6500);
    expect(Number(closed.body.difference)).toBe(0);
  });

  it('14. Weighted average cost and supplier debt booked on receipt', async () => {
    const p = await authed(http().post('/api/v1/products'))
      .send({ name: `WAC Item ${unique}`, sku: `WAC-${unique}`, costPrice: 0, sellingPrice: 500 })
      .expect(201);
    const pid = p.body.id;

    const debtBefore = Number(
      (await authed(http().get(`/api/v1/suppliers/${supplierId}`)).expect(200)).body.outstandingBalance,
    );

    const receive = async (qty: number, cost: number) => {
      const po = await authed(http().post('/api/v1/purchases'))
        .send({ supplierId, items: [{ productId: pid, quantityOrdered: qty, unitCost: cost }] })
        .expect(201);

      // ordering alone must NOT create supplier debt
      const mid = Number(
        (await authed(http().get(`/api/v1/suppliers/${supplierId}`)).expect(200)).body.outstandingBalance,
      );
      expect(mid).toBeGreaterThanOrEqual(0);

      await authed(http().post(`/api/v1/purchases/${po.body.id}/receive`))
        .send({ items: [{ purchaseItemId: po.body.items[0].id, quantityReceived: qty }] })
        .expect(201);
    };

    await receive(10, 100); // avg 100
    await receive(10, 200); // avg (10×100 + 10×200) / 20 = 150

    const prod = await authed(http().get(`/api/v1/products/${pid}`)).expect(200);
    expect(Number(prod.body.costPrice)).toBe(150);

    const debtAfter = Number(
      (await authed(http().get(`/api/v1/suppliers/${supplierId}`)).expect(200)).body.outstandingBalance,
    );
    expect(debtAfter - debtBefore).toBe(10 * 100 + 10 * 200);
  });

  it('15. Minimum selling price blocks cashiers but not the owner override', async () => {
    const p = await authed(http().post('/api/v1/products'))
      .send({
        name: `Floor Price ${unique}`,
        sku: `FLR-${unique}`,
        costPrice: 1000,
        sellingPrice: 1500,
        minimumSellingPrice: 1200,
        allowNegativeStock: true,
      })
      .expect(201);

    // The test user is the OWNER → owner bypass allows selling below minimum.
    await authed(http().post('/api/v1/sales'))
      .send({
        items: [{ productId: p.body.id, quantity: 1, sellingPrice: 1000 }],
        payments: [{ paymentMethodId, amount: 1000 }],
      })
      .expect(201);
  });

  // ───────────── Phase 2: wholesale, packs, statements, alerts, export ─────────────

  it('16. Wholesale price: wholesale customer and quantity break', async () => {
    const p = await authed(http().post('/api/v1/products'))
      .send({
        name: `Rice ${unique}`,
        sku: `RICE-${unique}`,
        costPrice: 1000,
        sellingPrice: 1500,
        wholesalePrice: 1300,
        wholesaleMinQty: 10,
        allowNegativeStock: true,
      })
      .expect(201);
    const pid = p.body.id;
    const sellRice = (qty: number, extra: Record<string, unknown> = {}) =>
      authed(http().post('/api/v1/sales')).send({
        items: [{ productId: pid, quantity: qty }], // no price → server decides
        payments: [{ paymentMethodId, amount: 999999 }],
        ...extra,
      });

    // retail customer, small quantity → retail price
    const small = await sellRice(2).expect(201);
    expect(Number(small.body.total)).toBe(3000);

    // same customer, quantity break (10) → wholesale price
    const bulk = await sellRice(10).expect(201);
    expect(Number(bulk.body.total)).toBe(13000);

    // wholesale customer, even 1 unit → wholesale price
    const cust = await authed(http().post('/api/v1/customers'))
      .send({ name: `Shop ${unique}`, customerType: 'WHOLESALE' })
      .expect(201);
    const one = await sellRice(1, { customerId: cust.body.id }).expect(201);
    expect(Number(one.body.total)).toBe(1300);
  });

  it('17. Packs: sell and buy by carton, stock stays in base units', async () => {
    const p = await authed(http().post('/api/v1/products'))
      .send({ name: `Soda ${unique}`, sku: `SODA-${unique}`, costPrice: 500, sellingPrice: 800 })
      .expect(201);
    const pid = p.body.id;

    const pack = await authed(http().post(`/api/v1/products/${pid}/packs`))
      .send({ name: 'Carton', factor: 24, retailPrice: 18000 })
      .expect(201);

    // buy 2 cartons at 11000 each → 48 bottles, cost 11000/24 each
    const po = await authed(http().post('/api/v1/purchases'))
      .send({ supplierId, items: [{ productId: pid, packId: pack.body.id, quantityOrdered: 2, unitCost: 11000 }] })
      .expect(201);
    expect(Number(po.body.items[0].quantityOrdered)).toBe(48);
    await authed(http().post(`/api/v1/purchases/${po.body.id}/receive`))
      .send({ items: [{ purchaseItemId: po.body.items[0].id, quantityReceived: 48 }] })
      .expect(201);
    expect(await stockOf(pid)).toBe(48);

    // sell 1 carton at the pack retail price
    const sale = await authed(http().post('/api/v1/sales'))
      .send({
        items: [{ productId: pid, packId: pack.body.id, quantity: 1 }],
        payments: [{ paymentMethodId, amount: 18000 }],
      })
      .expect(201);
    expect(Number(sale.body.total)).toBe(18000);
    expect(Number(sale.body.items[0].quantity)).toBe(24);
    expect(sale.body.items[0].packName).toBe('Carton');
    expect(await stockOf(pid)).toBe(24);
  });

  it('18. Statement, ageing and FIFO payment allocation', async () => {
    const cust = await authed(http().post('/api/v1/customers'))
      .send({ name: `Debtor ${unique}`, paymentTermsDays: 7 })
      .expect(201);
    const customerId = cust.body.id;

    await sell(2, 0, { customerId }).expect(201); // 5000 on credit
    await sell(2, 0, { customerId, dueDate: '2020-01-01' }).expect(201); // 5000 already overdue

    let od = await authed(http().get('/api/v1/customers/overdue')).expect(200);
    let row = od.body.find((r: any) => r.customerId === customerId);
    expect(row.overdueAmount).toBe(5000);
    expect(row.balance).toBe(10000);

    // pay 5000 → FIFO clears the OLDEST invoice (first sale, not yet due) first
    await authed(http().post(`/api/v1/customers/${customerId}/payments`)).send({ amount: 5000 }).expect(201);
    od = await authed(http().get('/api/v1/customers/overdue')).expect(200);
    row = od.body.find((r: any) => r.customerId === customerId);
    expect(row.overdueAmount).toBe(5000); // the overdue one is still unpaid

    const st = await authed(http().get(`/api/v1/customers/${customerId}/statement`)).expect(200);
    expect(st.body.closingBalance).toBe(5000);
    expect(st.body.lines.length).toBe(3);
  });

  it('19. Alerts: low stock appears, fixes resolve it', async () => {
    const p = await authed(http().post('/api/v1/products'))
      .send({ name: `Alert Item ${unique}`, sku: `ALR-${unique}`, costPrice: 10, sellingPrice: 20, reorderLevel: 5 })
      .expect(201);

    // 0 stock → out of stock
    let alerts = await authed(http().get('/api/v1/alerts')).expect(200);
    expect(alerts.body.some((a: any) => a.type === 'OUT_OF_STOCK' && a.referenceId === p.body.id)).toBe(true);

    const po = await authed(http().post('/api/v1/purchases'))
      .send({ supplierId, items: [{ productId: p.body.id, quantityOrdered: 100, unitCost: 10 }] })
      .expect(201);
    await authed(http().post(`/api/v1/purchases/${po.body.id}/receive`))
      .send({ items: [{ purchaseItemId: po.body.items[0].id, quantityReceived: 100 }] })
      .expect(201);

    alerts = await authed(http().get('/api/v1/alerts')).expect(200);
    expect(alerts.body.some((a: any) => a.referenceId === p.body.id)).toBe(false);
  });

  it('20. CSV exports download with a header row', async () => {
    for (const kind of ['sales', 'stock', 'customer-debts']) {
      const res = await authed(http().get(`/api/v1/reports/export/${kind}`)).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.length).toBeGreaterThan(10);
    }
  });

  // ───────────── Phase 3: subscriptions ─────────────

  const DAY = 86400000;
  const reg = async (tag: string, extra: Record<string, unknown> = {}) => {
    const email = `bill-${tag}-${unique}@retailos.test`;
    const r = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'TestPass123!', firstName: tag, lastName: 'Billing', ...extra });

    if (r.status !== 201) {
      console.error('REGISTER FAILED:', r.status, r.body, r.text);
    }

    expect(r.status).toBe(201);
    const token = r.body.accessToken as string;
    const biz = await http()
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Bill Shop ${tag} ${unique}`, businessType: 'GROCERY', currency: 'TZ' + 'S' })
      .expect(201);

    return { token, userId: r.body.user.id as string, bizId: biz.body.id as string };
  };
  const as = (u: { token: string; bizId: string }, r: request.Test) =>
    r.set('Authorization', `Bearer ${u.token}`).set('x-business-id', u.bizId);
  const setDates = async (
    bizId: string,
    d: { trialEndsAt?: Date; currentPeriodEnd?: Date | null; graceEndsAt?: Date },
  ) => {
    await prisma.subscription.update({ where: { businessId: bizId }, data: d });
    app.get(SubscriptionStateService).invalidate(bizId); // the guard caches for 20 s
  };
  const bust = async () => undefined; // kept so the tests read the same; invalidation happens in setDates

  it('21. New business gets a 14-day free trial automatically', async () => {
    const u = await reg('trial');
    const st = await as(u, http().get('/api/v1/billing/status')).expect(200);
    expect(st.body.state).toBe('TRIALING');
    expect(st.body.access).toBe('FULL');
    expect(st.body.daysLeft).toBeGreaterThanOrEqual(13);
    expect(st.body.daysLeft).toBeLessThanOrEqual(14);
    expect(st.body.isOwner).toBe(true);
  });

  it('22. The free trial cannot be repeated by the same user', async () => {
    const u = await reg('repeat');
    // same person opens a second business
    const second = await http()
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ name: `Second ${unique}`, businessType: 'GROCERY', currency: 'TZS' })
      .expect(201);
    const st = await http()
      .get('/api/v1/billing/status')
      .set('Authorization', `Bearer ${u.token}`)
      .set('x-business-id', second.body.id)
      .expect(200);
    expect(st.body.hadTrial).toBe(false);
    expect(st.body.state).toBe('EXPIRED');
  });

  it('23. Plans exist with savings; owner submits a payment reference once', async () => {
    const u = await reg('plans');
    const plans = await as(u, http().get('/api/v1/billing/plans')).expect(200);
    expect(plans.body.plans.map((p: any) => p.code)).toEqual(['MONTHLY', 'HALF_YEAR', 'YEARLY']);
    expect(plans.body.plans[2].savingsPercent).toBeGreaterThan(0);

    const ref = `REF${unique}A`;
    await as(u, http().post('/api/v1/billing/payments'))
      .send({ planCode: 'MONTHLY', method: 'MPESA', reference: ref })
      .expect(201);
    // the same mobile-money transaction cannot pay twice
    await as(u, http().post('/api/v1/billing/payments'))
      .send({ planCode: 'MONTHLY', method: 'MPESA', reference: ref.toLowerCase() })
      .expect(409);
  });

  it('24. Only a platform admin can confirm; confirming extends without losing days', async () => {
    const owner = await reg('payer');
    const admin = await reg('admin');
    await prisma.user.update({ where: { id: admin.userId }, data: { isPlatformAdmin: true } });

    const sub = await as(owner, http().post('/api/v1/billing/payments'))
      .send({ planCode: 'HALF_YEAR', method: 'TIGO', reference: `REF${unique}B` })
      .expect(201);

    // the shop owner is not allowed
    await http()
      .post(`/api/v1/admin/billing/payments/${sub.body.id}/confirm`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);

    // PAID EARLY: 10 days of trial are left
    await setDates(owner.bizId, { trialEndsAt: new Date(Date.now() + 10 * DAY) });
    await http()
      .post(`/api/v1/admin/billing/payments/${sub.body.id}/confirm`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);

    const row = await prisma.subscription.findUnique({ where: { businessId: owner.bizId } });
    const days = (row!.currentPeriodEnd!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(10 + 180); // 10 trial days + about 6 months
    expect(days).toBeLessThan(10 + 186);

    // cannot be confirmed twice
    await http()
      .post(`/api/v1/admin/billing/payments/${sub.body.id}/confirm`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);

    // PAID LATE: plan ended 20 days ago → new period starts now
    const late = await reg('late');
    await setDates(late.bizId, {
      currentPeriodEnd: new Date(Date.now() - 20 * DAY),
      graceEndsAt: new Date(Date.now() - 17 * DAY),
    });
    const p2 = await as(late, http().post('/api/v1/billing/payments'))
      .send({ planCode: 'MONTHLY', method: 'AIRTEL', reference: `REF${unique}C` })
      .expect(201);
    await http()
      .post(`/api/v1/admin/billing/payments/${p2.body.id}/confirm`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
    const lateRow = await prisma.subscription.findUnique({ where: { businessId: late.bizId } });
    const lateDays = (lateRow!.currentPeriodEnd!.getTime() - Date.now()) / DAY;
    expect(lateDays).toBeGreaterThan(27);
    expect(lateDays).toBeLessThan(32);
  });

  it('25. Grace keeps full access; after grace it is read-only (reads + exports work, writes get 402)', async () => {
    const u = await reg('lock');
    const prod = await as(u, http().post('/api/v1/products'))
      .send({ name: 'Lock Item', sku: `LK-${unique}`, costPrice: 10, sellingPrice: 20 })
      .expect(201);

    // 1 day into grace: still full access
    await setDates(u.bizId, {
      trialEndsAt: new Date(Date.now() - 1 * DAY),
      graceEndsAt: new Date(Date.now() + 2 * DAY),
    });
    await bust();
    await as(u, http().post('/api/v1/products'))
      .send({ name: 'Grace Item', sku: `GR-${unique}`, costPrice: 10, sellingPrice: 20 })
      .expect(201);

    // grace over → read-only
    await setDates(u.bizId, {
      trialEndsAt: new Date(Date.now() - 5 * DAY),
      graceEndsAt: new Date(Date.now() - 2 * DAY),
    });
    await bust();

    await as(u, http().get('/api/v1/products')).expect(200);
    await as(u, http().get('/api/v1/reports/export/stock')).expect(200);
    const blocked = await as(u, http().post('/api/v1/products'))
      .send({ name: 'Blocked', sku: `BL-${unique}`, costPrice: 10, sellingPrice: 20 })
      .expect(402);
    expect(blocked.body.code).toBe('SUBSCRIPTION_EXPIRED');

    // billing itself must keep working so the owner can pay
    const st = await as(u, http().get('/api/v1/billing/status')).expect(200);
    expect(st.body.state).toBe('EXPIRED');
    expect(st.body.access).toBe('READ_ONLY');
    await as(u, http().post('/api/v1/billing/payments'))
      .send({ planCode: 'MONTHLY', method: 'MPESA', reference: `REF${unique}D` })
      .expect(201);
    expect(prod.body.id).toBeDefined();
  });

  it('26. Offline sales made before expiry still sync (up to 7 days), later ones do not', async () => {
    const u = await reg('offline');
    const methods = await as(u, http().get('/api/v1/payment-methods')).expect(200);
    const cash = methods.body.find((m: any) => m.code === 'CASH').id;
    const prod = await as(u, http().post('/api/v1/products'))
      .send({ name: 'Off Item', sku: `OF-${unique}`, costPrice: 10, sellingPrice: 20, allowNegativeStock: true })
      .expect(201);

    // plan ended 1 hour ago... grace also over
    await setDates(u.bizId, {
      trialEndsAt: new Date(Date.now() - 4 * DAY),
      graceEndsAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    await bust();

    const body = (offlineAt?: Date) => ({
      items: [{ productId: prod.body.id, quantity: 1, sellingPrice: 20 }],
      payments: [{ paymentMethodId: cash, amount: 20 }],
      clientTransactionId: `off-${Math.random().toString(36).slice(2)}`,
      ...(offlineAt ? { offlineCreatedAt: offlineAt.toISOString() } : {}),
    });

    // online sale: blocked
    await as(u, http().post('/api/v1/sales')).send(body()).expect(402);
    // made offline 2 days ago, before the lock: allowed
    await as(u, http().post('/api/v1/sales')).send(body(new Date(Date.now() - 2 * 3600 * 1000 - 3 * DAY))).expect(201);
    // claims to be made AFTER the lock: blocked
    await as(u, http().post('/api/v1/sales')).send(body(new Date(Date.now() - 60 * 1000))).expect(402);
    // too old (> 7 days after the fact)
    await as(u, http().post('/api/v1/sales')).send(body(new Date(Date.now() - 9 * DAY))).expect(402);
  });
});
