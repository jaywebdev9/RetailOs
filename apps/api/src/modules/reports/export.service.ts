import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toCsv } from '../../common/csv';
import { computeAgeing } from '../../common/ageing';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(businessId: string, from?: string, to?: string) {
    const where: any = { businessId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
        customer: { select: { name: true } },
        cashier: { select: { firstName: true, lastName: true } },
        payments: { include: { paymentMethod: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20000,
    });

    const rows: (string | number | null)[][] = [];
    for (const s of sales) {
      const pay = s.payments.map((p) => `${p.paymentMethod.name} ${p.amount}`).join(' + ');
      for (const i of s.items) {
        rows.push([
          s.createdAt.toISOString().slice(0, 19).replace('T', ' '),
          s.receiptNumber,
          s.status,
          s.paymentStatus,
          s.customer?.name ?? '',
          `${s.cashier.firstName} ${s.cashier.lastName ?? ''}`.trim(),
          i.product.name,
          i.product.sku ?? '',
          i.packName ? `${i.packQuantity} ${i.packName}` : '',
          Number(i.quantity),
          Number(i.sellingPrice),
          Number(i.discount),
          Number(i.total),
          Number(i.quantity.mul(i.costPriceAtSale)),
          pay,
        ]);
      }
    }
    return toCsv(
      ['Date', 'Receipt', 'Status', 'Payment', 'Customer', 'Cashier', 'Product', 'SKU',
       'Pack', 'Qty (base)', 'Unit price', 'Discount', 'Line total', 'Line cost', 'Paid with'],
      rows,
    );
  }

  async stock(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: { category: true, unit: true },
      orderBy: { name: 'asc' },
    });
    const agg = await this.prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: { businessId },
      _sum: { quantity: true },
    });
    const stock = new Map(agg.map((a) => [a.productId, a._sum.quantity?.toNumber() ?? 0]));

    const rows = products.map((p) => {
      const qty = stock.get(p.id) ?? 0;
      return [
        p.name,
        p.sku ?? '',
        p.barcode ?? '',
        p.category?.name ?? '',
        p.unit?.name ?? '',
        qty,
        Number(p.costPrice),
        Number(p.sellingPrice),
        p.wholesalePrice ? Number(p.wholesalePrice) : '',
        Number(p.reorderLevel),
        Math.round(qty * Number(p.costPrice) * 100) / 100,
        p.trackInventory && qty <= Number(p.reorderLevel) ? 'YES' : '',
      ];
    });
    return toCsv(
      ['Product', 'SKU', 'Barcode', 'Category', 'Unit', 'In stock', 'Avg cost', 'Retail price',
       'Wholesale price', 'Reorder level', 'Stock value (cost)', 'Low stock'],
      rows,
    );
  }

  async customerDebts(businessId: string) {
    const rows = (await computeAgeing(this.prisma, businessId))
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .map((c) => [
        c.name, c.phone ?? '', c.balance, c.current, c.d1_30, c.d31_60, c.d60plus, c.daysOverdue,
      ]);
    return toCsv(
      ['Customer', 'Phone', 'Total owed', 'Not yet due', '1-30 days late', '31-60 days late',
       '60+ days late', 'Oldest overdue (days)'],
      rows,
    );
  }
}
