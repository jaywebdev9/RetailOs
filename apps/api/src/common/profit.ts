import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/**
 * Single source of truth for revenue / COGS in a period.
 *
 *   Revenue = sales made in period (excluding VOIDED) − refunds made in period
 *   COGS    = cost of items sold in period − cost of items returned in period
 *
 * Returned items use the cost frozen at the time of the original sale.
 */
export async function computeSalesFigures(
  prisma: PrismaService,
  businessId: string,
  from: Date,
  to: Date,
) {
  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      status: { not: 'VOIDED' },
      createdAt: { gte: from, lte: to },
    },
    include: { items: true },
  });

  const returns = await prisma.saleReturn.findMany({
    where: { businessId, createdAt: { gte: from, lte: to } },
    include: { items: true, sale: { include: { items: true } } },
  });

  let revenue = new Prisma.Decimal(0);
  let cogs = new Prisma.Decimal(0);

  for (const sale of sales) {
    revenue = revenue.add(sale.total);
    for (const item of sale.items) {
      cogs = cogs.add(item.quantity.mul(item.costPriceAtSale));
    }
  }

  for (const ret of returns) {
    // A void in the same period already removes the sale; skip returns on voided sales.
    if (ret.sale.status === 'VOIDED') continue;
    revenue = revenue.sub(ret.totalRefund);
    for (const ri of ret.items) {
      const original = ret.sale.items.find((i) => i.id === ri.saleItemId);
      if (original) cogs = cogs.sub(ri.quantity.mul(original.costPriceAtSale));
    }
  }

  return { revenue, cogs, transactions: sales.length };
}
