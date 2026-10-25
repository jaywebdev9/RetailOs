import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_SUBSCRIPTION_KEY } from './skip-subscription.decorator';
import { SubscriptionStateService } from './subscription-state.service';
import { PrismaService } from '../../database/prisma.service';
import { computeAccess } from '../../common/subscription-state';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const OFFLINE_SYNC_WINDOW_DAYS = 7;

/**
 * Global guard. It only needs the x-business-id header, so it works before login is checked
 * (login itself is done later by the controllers' own guards).
 *
 *  - full access (trial / paid / 3-day grace)  → everything allowed
 *  - expired                                    → read-only: GET/exports allowed, writes get HTTP 402
 *  - exception: sales made OFFLINE before the plan ended may still sync for 7 days
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly state: SubscriptionStateService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const header = req.headers['x-business-id'];
    const businessId = Array.isArray(header) ? header[0] : header;
    if (!businessId || !UUID.test(businessId)) return true; // not a business-scoped call

    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { isActive: true },
    });
    if (biz && !biz.isActive) {
      throw new HttpException(
        {
          statusCode: 403,
          code: 'BUSINESS_SUSPENDED',
          message: 'This shop has been suspended. Contact support.',
        },
        403,
      );
    }

    const sub = await this.state.get(businessId);
    if (!sub) return true; // unknown business: the normal guards will reject it

    const info = computeAccess(sub);
    res.setHeader('X-Subscription-State', info.state);
    if (info.access === 'FULL') return true;

    // ── read-only mode
    if (READ_METHODS.has(req.method)) return true;

    if (req.method === 'POST' && /\/sales\/?$/.test(req.path || '')) {
      const claimed = req.body?.offlineCreatedAt ? new Date(req.body.offlineCreatedAt) : null;
      if (claimed && !isNaN(claimed.getTime())) {
        const now = Date.now();
        const madeBeforeLock = claimed.getTime() <= info.graceEndsAt.getTime();
        const notInFuture = claimed.getTime() <= now + 5 * 60_000;
        const recent = now - claimed.getTime() <= OFFLINE_SYNC_WINDOW_DAYS * 86400000;
        if (madeBeforeLock && notInFuture && recent) return true;
      }
    }

    throw new HttpException(
      {
        statusCode: 402,
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has ended. You can still view and export your data. Renew to continue selling.',
      },
      402,
    );
  }
}
