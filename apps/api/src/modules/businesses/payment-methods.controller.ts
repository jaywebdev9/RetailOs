import { Controller, Get, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Payment Methods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'x-business-id', required: true })
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List payment methods for business' })
  async list(@Req() req: any, @Headers() headers: Record<string, string>) {
    const businessId = headers['x-business-id'];
    const membership = await this.prisma.businessMember.findFirst({
      where: { businessId, userId: req.user.sub, isActive: true },
    });
    if (!membership) throw new ForbiddenException('No access');

    return this.prisma.paymentMethod.findMany({
      where: { businessId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
