import { Prisma } from '@prisma/client';
import { GRACE_DAYS, TRIAL_DAYS, addDays } from './subscription-state';

type Tx = Prisma.TransactionClient;

const last9 = (phone?: string | null) => (phone ? phone.replace(/\D/g, '').slice(-9) : '');

/**
 * Creates the business's subscription row and, when allowed, starts the 14-day free trial.
 *
 * One free trial per person: it is refused when the user already used a trial, or when another
 * business with the same phone number already had one (stops "new account, same shop" abuse).
 * A refused trial still creates a row, already expired, so the shop must pick a plan.
 *
 * `force` is for businesses that existed before billing was added: they always get a trial.
 */
export async function createSubscriptionForBusiness(
  tx: Tx,
  opts: { businessId: string; userId?: string | null; businessPhone?: string | null; force?: boolean },
) {
  const now = new Date();
  let eligible = true;

  if (!opts.force) {
    const user = opts.userId
      ? await tx.user.findUnique({
          where: { id: opts.userId },
          select: { trialUsedAt: true, phone: true },
        })
      : null;
    if (user?.trialUsedAt) eligible = false;

    if (eligible) {
      const phones = [last9(opts.businessPhone), last9(user?.phone)].filter((p) => p.length >= 7);
      for (const p of phones) {
        const dup = await tx.business.findFirst({
          where: {
            id: { not: opts.businessId },
            phone: { contains: p },
            subscription: { is: { hadTrial: true } },
          },
          select: { id: true },
        });
        if (dup) {
          eligible = false;
          break;
        }
      }
    }
  }

  const trialEndsAt = eligible ? addDays(now, TRIAL_DAYS) : now;
  const sub = await tx.subscription.create({
    data: {
      businessId: opts.businessId,
      status: eligible ? 'TRIALING' : 'EXPIRED',
      hadTrial: eligible,
      trialEndsAt,
      graceEndsAt: eligible ? addDays(trialEndsAt, GRACE_DAYS) : now,
    },
  });

  if (eligible && opts.userId && !opts.force) {
    await tx.user.update({ where: { id: opts.userId }, data: { trialUsedAt: now } });
  }
  return sub;
}
