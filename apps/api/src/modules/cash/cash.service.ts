import {
  Injectable, ForbiddenException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OpenCashSessionDto, CloseCashSessionDto } from './dto/cash-session.dto';
import { Prisma } from '@prisma/client';
import { CASH_IN_TYPES } from '../../common/cash-ledger';
import { CashMovementDto } from './dto/cash-session.dto';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
  }

  async open(businessId: string, userId: string, dto: OpenCashSessionDto) {
    await this.assertMembership(businessId, userId);

    const existing = await this.prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' },
    });
    if (existing) {
      throw new BadRequestException('A cash session is already open');
    }

    return this.prisma.cashSession.create({
      data: {
        businessId,
        openedById: userId,
        openingCash: new Prisma.Decimal(dto.openingCash),
        status: 'OPEN',
      },
    });
  }

  async close(businessId: string, userId: string, sessionId: string, dto: CloseCashSessionDto) {
    await this.assertMembership(businessId, userId);

    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, businessId, status: 'OPEN' },
      include: { transactions: true },
    });
    if (!session) throw new NotFoundException('Open cash session not found');

    // Calculate expected
    let expected = session.openingCash;
    for (const t of session.transactions) {
      if (CASH_IN_TYPES.includes(t.type)) {
        expected = expected.add(t.amount);
      } else {
        expected = expected.sub(t.amount);
      }
    }

    const actual = new Prisma.Decimal(dto.actualCash);
    const difference = actual.sub(expected);

    if (!difference.eq(0) && !dto.differenceReason) {
      throw new BadRequestException('Difference reason is required when cash does not match');
    }

    return this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedById: userId,
        closedAt: new Date(),
        expectedCash: expected,
        actualCash: actual,
        difference,
        differenceReason: dto.differenceReason,
      },
    });
  }

  async current(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);
    return this.prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' },
      include: { transactions: true },
    });
  }

  /** Manual drawer movement: money added, taken out, or owner withdrawal. */
  async addMovement(businessId: string, userId: string, dto: CashMovementDto) {
    await this.assertMembership(businessId, userId);
    const session = await this.prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' },
    });
    if (!session) throw new BadRequestException('Open a cash session first');

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashTransaction.create({
        data: {
          cashSessionId: session.id,
          type: dto.type,
          amount: new Prisma.Decimal(dto.amount),
          referenceType: 'MANUAL',
          notes: dto.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'CASH_MOVEMENT',
          entityType: 'CashTransaction',
          entityId: movement.id,
          newValues: { type: dto.type, amount: String(dto.amount), notes: dto.notes },
        },
      });
      return movement;
    });
  }
}
