import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { logger } from '../../common/logger';
import { computeAccess, reminderKind } from '../../common/subscription-state';
import { BILLING_NOTIFIER, BillingNotifier } from './notifier';

const HOUR = 3600_000;

const TEXT: Record<string, (name: string, days: number) => string> = {
  D7: (n, d) => `Retail OS: ${n}'s plan ends in ${d} days. Renew in the app to keep selling. / Mpango wa ${n} unaisha baada ya siku ${d}.`,
  D3: (n, d) => `Retail OS: only ${d} days left for ${n}. Renew now so you don't lose access. / Zimebaki siku ${d}, lipia sasa.`,
  D1: (n) => `Retail OS: ${n}'s plan ends tomorrow. Renew today. / Mpango unaisha kesho, lipia leo.`,
  EXPIRED: (n) => `Retail OS: ${n}'s plan has ended. You can still view your data, but selling is paused until you renew. / Mpango umeisha, lipia ili kuendelea kuuza.`,
};

/**
 * Hourly housekeeping (no extra scheduler package needed):
 *  1. keeps Subscription.status readable (TRIALING/ACTIVE/GRACE/EXPIRED)
 *  2. sends each reminder (7, 3, 1 days before the end, and on expiry) exactly once.
 * Access never depends on this job - the guard computes it from the dates.
 */
@Injectable()
export class BillingJobs implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private boot?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BILLING_NOTIFIER) private readonly notifier: BillingNotifier,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.BILLING_JOBS === 'off') return;
    this.boot = setTimeout(() => void this.tick(), 30_000);
    this.timer = setInterval(() => void this.tick(), HOUR);
    this.boot.unref();
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.boot) clearTimeout(this.boot);
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    try {
      const subs = await this.prisma.subscription.findMany({
        where: { business: { isActive: true } },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              phone: true,
              members: {
                where: { isOwner: true },
                take: 1,
                include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } },
              },
            },
          },
        },
        take: 5000,
      });

      for (const sub of subs) {
        const info = computeAccess(sub, now);

        if (sub.status !== info.state) {
          await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: info.state } });
        }

        const kind = reminderKind(info);
        if (!kind) continue;

        // One reminder per (subscription, kind, period). The unique key makes this safe on many servers.
        try {
          await this.prisma.subscriptionReminder.create({
            data: { subscriptionId: sub.id, kind, periodEnd: info.endsAt },
          });
        } catch (err: any) {
          if (err?.code === 'P2002') continue; // already sent
          throw err;
        }

        const owner = sub.business.members[0]?.user;
        await this.notifier.send({
          businessId: sub.business.id,
          businessName: sub.business.name,
          ownerName: owner ? `${owner.firstName} ${owner.lastName ?? ''}`.trim() : '',
          ownerPhone: owner?.phone || sub.business.phone,
          ownerEmail: owner?.email,
          kind,
          daysLeft: info.daysLeft,
          text: TEXT[kind](sub.business.name, Math.max(info.daysLeft, 0)),
        });
      }
    } catch (err: any) {
      logger.error('Billing job failed', { error: err?.message });
    }
  }
}
