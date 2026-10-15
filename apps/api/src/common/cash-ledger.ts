import { Prisma, CashTxnType } from '@prisma/client';

/**
 * Cash drawer helpers.
 *
 * Every operation that moves physical cash (cash sale, customer payment,
 * expense, supplier payment, refund, owner withdrawal) records a
 * CashTransaction on the currently OPEN cash session, so closing the session
 * can compare "expected" vs "actual" cash.
 *
 * Rules:
 *  - A payment with no payment method is treated as CASH (small-shop default).
 *  - Mobile money / bank / credit never touch the drawer.
 *  - If no session is open, nothing is recorded (drawer reconciliation is optional).
 */
export type Tx = Prisma.TransactionClient;

export async function isCashMethod(
  tx: Tx,
  businessId: string,
  paymentMethodId?: string | null,
): Promise<boolean> {
  if (!paymentMethodId) return true;
  const pm = await tx.paymentMethod.findFirst({
    where: { id: paymentMethodId, businessId },
    select: { code: true },
  });
  return pm?.code === 'CASH';
}

export async function recordCash(
  tx: Tx,
  businessId: string,
  input: {
    type: CashTxnType;
    amount: Prisma.Decimal | number | string;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  },
): Promise<void> {
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) return;

  const session = await tx.cashSession.findFirst({
    where: { businessId, status: 'OPEN' },
    select: { id: true },
  });
  if (!session) return;

  await tx.cashTransaction.create({
    data: {
      cashSessionId: session.id,
      type: input.type,
      amount,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes,
    },
  });
}

/** Cash types that INCREASE the drawer. Everything else decreases it. */
export const CASH_IN_TYPES: CashTxnType[] = ['SALE_CASH', 'CUSTOMER_PAYMENT', 'CASH_IN'];
