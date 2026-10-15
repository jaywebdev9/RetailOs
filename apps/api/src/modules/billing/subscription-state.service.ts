import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { createSubscriptionForBusiness } from '../../common/trial';

type SubRow = {
  id: string;
  businessId: string;
  planId: string | null;
  status: string;
  hadTrial: boolean;
  trialEndsAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date;
};

const TTL_MS = 20_000;

/**
 * Loads a business's subscription (cached for 20 s so the guard does not hit the database on
 * every request). Businesses created before billing existed get their trial lazily.
 */
@Injectable()
export class SubscriptionStateService {
  private cache = new Map<string, { sub: SubRow | null; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  invalidate(businessId: string) {
    this.cache.delete(businessId);
  }

  async get(businessId: string): Promise<SubRow | null> {
    const hit = this.cache.get(businessId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.sub;

    let sub: SubRow | null = await this.prisma.subscription.findUnique({ where: { businessId } });

    if (!sub) {
      const biz = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, phone: true },
      });
      if (biz) {
        try {
          sub = await this.prisma.$transaction((tx) =>
            createSubscriptionForBusiness(tx, {
              businessId,
              businessPhone: biz.phone,
              force: true, // existing shops get a fresh trial
            }),
          );
        } catch {
          // another request created it first
          sub = await this.prisma.subscription.findUnique({ where: { businessId } });
        }
      }
    }

    this.cache.set(businessId, { sub, at: Date.now() });
    return sub;
  }
}
