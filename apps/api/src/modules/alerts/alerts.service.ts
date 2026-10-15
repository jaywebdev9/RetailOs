import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { computeAgeing } from '../../common/ageing';
import { computeAccess } from '../../common/subscription-state';

type Wanted = {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  referenceType: string;
  referenceId: string;
};

const LOOKBACK_DAYS = 30;
const COVER_DAYS_WARNING = 7; // warn when stock will run out within a week

/**
 * Smart alerts, generated on demand (no scheduler needed):
 *  - OUT_OF_STOCK     stock is 0 or below
 *  - LOW_STOCK        stock at or below reorder level
 *  - STOCKOUT_RISK    at the recent sales speed, stock runs out in < 7 days
 *  - OVERDUE_CREDIT   customer has overdue debt
 * Alerts are created once, updated while the problem lasts, and auto-resolved when fixed.
 */
@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
  }

  private async wanted(businessId: string): Promise<Wanted[]> {
    const out: Wanted[] = [];

    // ── stock alerts
    const products = await this.prisma.product.findMany({
      where: { businessId, status: 'ACTIVE', trackInventory: true },
      select: { id: true, name: true, reorderLevel: true, reorderQuantity: true },
    });
    if (products.length) {
      const ids = products.map((p) => p.id);
      const stockAgg = await this.prisma.inventoryTransaction.groupBy({
        by: ['productId'],
        where: { businessId, productId: { in: ids } },
        _sum: { quantity: true },
      });
      const stock = new Map(stockAgg.map((s) => [s.productId, s._sum.quantity?.toNumber() ?? 0]));

      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
      const soldAgg = await this.prisma.inventoryTransaction.groupBy({
        by: ['productId'],
        where: { businessId, productId: { in: ids }, type: 'SALE', createdAt: { gte: since } },
        _sum: { quantity: true },
      });
      const soldPerDay = new Map(
        soldAgg.map((s) => [s.productId, Math.abs(s._sum.quantity?.toNumber() ?? 0) / LOOKBACK_DAYS]),
      );

      for (const p of products) {
        const current = stock.get(p.id) ?? 0;
        const level = p.reorderLevel.toNumber();
        const perDay = soldPerDay.get(p.id) ?? 0;
        const daysLeft = perDay > 0 ? current / perDay : Infinity;
        const suggested = Math.max(
          p.reorderQuantity.toNumber(),
          Math.ceil(perDay * 14 - Math.max(current, 0)),
        );

        if (current <= 0) {
          out.push({
            type: 'OUT_OF_STOCK',
            severity: 'CRITICAL',
            title: `${p.name} is out of stock`,
            body: suggested > 0 ? `Suggested order: ${suggested}` : 'Restock needed',
            referenceType: 'PRODUCT',
            referenceId: p.id,
          });
        } else if (current <= level) {
          out.push({
            type: 'LOW_STOCK',
            severity: 'WARNING',
            title: `${p.name} is low (${current} left)`,
            body: `Reorder level ${level}.${suggested > 0 ? ` Suggested order: ${suggested}` : ''}`,
            referenceType: 'PRODUCT',
            referenceId: p.id,
          });
        } else if (daysLeft < COVER_DAYS_WARNING) {
          out.push({
            type: 'STOCKOUT_RISK',
            severity: 'WARNING',
            title: `${p.name} may run out in ~${Math.max(Math.floor(daysLeft), 1)} day(s)`,
            body: `Selling about ${perDay.toFixed(1)}/day, ${current} left.${suggested > 0 ? ` Suggested order: ${suggested}` : ''}`,
            referenceType: 'PRODUCT',
            referenceId: p.id,
          });
        }
      }
    }

    // ── overdue customer credit
    const ageing = await computeAgeing(this.prisma, businessId);
    for (const c of ageing) {
      if (c.overdueAmount <= 0) continue;
      out.push({
        type: 'OVERDUE_CREDIT',
        severity: c.daysOverdue > 30 ? 'CRITICAL' : 'WARNING',
        title: `${c.name} owes ${Math.round(c.overdueAmount).toLocaleString()} overdue`,
        body: `Oldest unpaid invoice is ${c.daysOverdue} day(s) overdue.${c.phone ? ` Phone: ${c.phone}` : ''}`,
        referenceType: 'CUSTOMER',
        referenceId: c.customerId,
      });
    }

    // ── subscription reminder (7 days before, grace, expired)
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (sub) {
      const info = computeAccess(sub);
      const paid = !!sub.currentPeriodEnd;
      const what = paid ? 'Your plan' : 'Your free trial';
      if (info.state === 'EXPIRED') {
        out.push({
          type: 'SUBSCRIPTION',
          severity: 'CRITICAL',
          title: `${what} has ended - selling is paused`,
          body: 'You can still view and export your data. Renew to continue selling.',
          referenceType: 'SUBSCRIPTION',
          referenceId: sub.id,
        });
      } else if (info.state === 'GRACE') {
        out.push({
          type: 'SUBSCRIPTION',
          severity: 'CRITICAL',
          title: `${what} has ended`,
          body: 'Renew now. Selling will pause soon.',
          referenceType: 'SUBSCRIPTION',
          referenceId: sub.id,
        });
      } else if (info.daysLeft <= 7) {
        out.push({
          type: 'SUBSCRIPTION',
          severity: info.daysLeft <= 1 ? 'CRITICAL' : 'WARNING',
          title: `${what} ends in ${info.daysLeft} day(s)`,
          body: 'Choose a plan on the Billing page to keep selling.',
          referenceType: 'SUBSCRIPTION',
          referenceId: sub.id,
        });
      }
    }

    return out;
  }

  /** Re-evaluate everything, sync the Alert table, return open alerts (worst first). */
  async refresh(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);

    const wanted = await this.wanted(businessId);
    const key = (t: string, id: string | null) => `${t}:${id}`;
    const wantedMap = new Map(wanted.map((w) => [key(w.type, w.referenceId), w]));

    const open = await this.prisma.alert.findMany({ where: { businessId, isResolved: false } });
    const openMap = new Map(open.map((a) => [key(a.type, a.referenceId), a]));

    // create or update
    for (const [k, w] of wantedMap) {
      const existing = openMap.get(k);
      if (!existing) {
        await this.prisma.alert.create({ data: { businessId, ...w } });
      } else if (
        existing.title !== w.title ||
        existing.body !== w.body ||
        existing.severity !== w.severity
      ) {
        await this.prisma.alert.update({
          where: { id: existing.id },
          data: { title: w.title, body: w.body, severity: w.severity },
        });
      }
    }

    // auto-resolve fixed problems
    const fixed = open.filter((a) => !wantedMap.has(key(a.type, a.referenceId)));
    if (fixed.length) {
      await this.prisma.alert.updateMany({
        where: { id: { in: fixed.map((a) => a.id) } },
        data: { isResolved: true, resolvedAt: new Date() },
      });
    }

    const rank = { CRITICAL: 0, WARNING: 1, INFO: 2 } as Record<string, number>;
    const list = await this.prisma.alert.findMany({
      where: { businessId, isResolved: false },
      orderBy: { createdAt: 'desc' },
    });
    return list.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
  }
}
