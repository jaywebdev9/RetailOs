import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { computeSalesFigures } from '../../common/profit';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
  }

  async profitSummary(
    businessId: string,
    userId: string,
    from: string,
    to: string,
  ) {
    await this.assertMembership(businessId, userId);

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const { revenue, cogs, transactions } = await computeSalesFigures(
      this.prisma,
      businessId,
      fromDate,
      toDate,
    );

    const expenses = await this.prisma.expense.aggregate({
      where: {
        businessId,
        expenseDate: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
    });

    const operatingExpenses = expenses._sum.amount ?? new Prisma.Decimal(0);
    const grossProfit = revenue.sub(cogs);
    const netProfit = grossProfit.sub(operatingExpenses);

    return {
      from,
      to,
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      grossProfit: grossProfit.toNumber(),
      operatingExpenses: operatingExpenses.toNumber(),
      netProfit: netProfit.toNumber(),
      transactions,
    };
  }

  async dashboard(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const today = await computeSalesFigures(this.prisma, businessId, todayStart, todayEnd);
    const todayRevenue = today.revenue;
    const todayCogs = today.cogs;

    // Low stock count
    const products = await this.prisma.product.findMany({
      where: { businessId, status: 'ACTIVE', trackInventory: true },
      select: { id: true, reorderLevel: true },
    });
    let lowStockCount = 0;
    if (products.length > 0) {
      const stockAgg = await this.prisma.inventoryTransaction.groupBy({
        by: ['productId'],
        where: { businessId, productId: { in: products.map((p) => p.id) } },
        _sum: { quantity: true },
      });
      const stockMap = new Map(
        stockAgg.map((s) => [s.productId, s._sum.quantity?.toNumber() ?? 0]),
      );
      for (const p of products) {
        const current = stockMap.get(p.id) ?? 0;
        if (current <= p.reorderLevel.toNumber()) lowStockCount++;
      }
    }

    // Customer debt
    const customerDebt = await this.prisma.customerTransaction.aggregate({
      where: { businessId },
      _sum: { amount: true },
    });

    // Supplier debt
    const supplierDebt = await this.prisma.supplierTransaction.aggregate({
      where: { businessId },
      _sum: { amount: true },
    });

    return {
      today: {
        sales: todayRevenue.toNumber(),
        grossProfit: todayRevenue.sub(todayCogs).toNumber(),
        transactions: today.transactions,
      },
      alerts: {
        lowStock: lowStockCount,
        customerDebt: customerDebt._sum.amount?.toNumber() ?? 0,
        supplierDebt: supplierDebt._sum.amount?.toNumber() ?? 0,
      },
    };
  }
}
