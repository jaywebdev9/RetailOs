import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Only the Retail OS owner (User.isPlatformAdmin) may use /admin/billing. Always checked in the database. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('Not allowed');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true, isActive: true },
    });
    if (!user?.isPlatformAdmin || !user.isActive) throw new ForbiddenException('Not allowed');
    return true;
  }
}
