import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

/**
 * Checks that the authenticated user has the required permission codes
 * for the business in x-business-id header.
 *
 * Usage:
 *   @RequirePermissions('sales.create')
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const businessId = request.headers['x-business-id'];

    if (!userId || !businessId) {
      throw new ForbiddenException('Business context required');
    }

    const membership = await this.prisma.businessMember.findFirst({
      where: { userId, businessId, isActive: true },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('No access to this business');
    }

    // Owner bypass
    if (membership.isOwner) return true;

    const codes = new Set(
      membership.role.permissions.map((rp) => rp.permission.code),
    );
    const missing = required.filter((p) => !codes.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permissions: ${missing.join(', ')}`);
    }
    return true;
  }
}
