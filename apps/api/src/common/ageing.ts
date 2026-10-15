import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export const DEFAULT_TERMS_DAYS = 30; // used when a credit sale has no due date

export type InvoiceAgeing = {
  referenceId: string | null;
  amount: number;
  outstanding: number;
  dueDate: string;
  daysOverdue: number;
};

export type CustomerAgeing = {
  customerId: string;
  name: string;
  phone: string | null;
  balance: number;
  overdueAmount: number;
  daysOverdue: number; // of the oldest unpaid overdue invoice
  current: number; // not yet due
  d1_30: number;
  d31_60: number;
  d60plus: number;
  invoices: InvoiceAgeing[]; // unpaid ones only
};

const DAY = 86400000;

/**
 * Customer ageing with FIFO payment allocation:
 * every payment / return credit is applied to the OLDEST unpaid invoice first.
 * Voided sales are ignored (their VOID entry cancels the invoice itself).
 */
export async function computeAgeing(
  prisma: PrismaService,
  businessId: string,
  opts: { customerId?: string; now?: Date } = {},
): Promise<CustomerAgeing[]> {
  const now = opts.now ?? new Date();

  const txns = await prisma.customerTransaction.findMany({
    where: { businessId, ...(opts.customerId ? { customerId: opts.customerId } : {}) },
    include: { customer: { select: { name: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const byCustomer = new Map<string, typeof txns>();
  for (const t of txns) {
    const list = byCustomer.get(t.customerId) ?? [];
    list.push(t);
    byCustomer.set(t.customerId, list);
  }

  const result: CustomerAgeing[] = [];

  for (const [customerId, list] of byCustomer) {
    const voided = new Set(
      list.filter((t) => t.type === 'VOID' && t.referenceId).map((t) => t.referenceId!),
    );

    const debits = list.filter(
      (t) => t.amount.gt(0) && !(t.referenceId && voided.has(t.referenceId)),
    );
    let credit = list
      .filter((t) => t.amount.lt(0) && t.type !== 'VOID')
      .reduce((s, t) => s.add(t.amount.neg()), new Prisma.Decimal(0));

    const balance = list.reduce((s, t) => s.add(t.amount), new Prisma.Decimal(0));

    const row: CustomerAgeing = {
      customerId,
      name: list[0].customer.name,
      phone: list[0].customer.phone,
      balance: balance.toNumber(),
      overdueAmount: 0,
      daysOverdue: 0,
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d60plus: 0,
      invoices: [],
    };

    for (const d of debits) {
      let outstanding = d.amount;
      if (credit.gt(0)) {
        const applied = credit.lt(outstanding) ? credit : outstanding;
        outstanding = outstanding.sub(applied);
        credit = credit.sub(applied);
      }
      if (outstanding.lte(0)) continue;

      const due = d.dueDate ?? new Date(d.createdAt.getTime() + DEFAULT_TERMS_DAYS * DAY);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / DAY);
      const out = outstanding.toNumber();

      row.invoices.push({
        referenceId: d.referenceId,
        amount: d.amount.toNumber(),
        outstanding: out,
        dueDate: due.toISOString(),
        daysOverdue: Math.max(daysOverdue, 0),
      });

      if (daysOverdue <= 0) row.current += out;
      else {
        row.overdueAmount += out;
        row.daysOverdue = Math.max(row.daysOverdue, daysOverdue);
        if (daysOverdue <= 30) row.d1_30 += out;
        else if (daysOverdue <= 60) row.d31_60 += out;
        else row.d60plus += out;
      }
    }

    result.push(row);
  }

  return result;
}
