import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SubmitPaymentDto } from './dto/billing.dto';
import { SubscriptionStateService } from './subscription-state.service';
import { computeAccess } from '../../common/subscription-state';
import {
  DEFAULT_PLANS,
  MAX_PENDING_PAYMENTS,
  SETTING_INSTRUCTIONS,
  SETTING_SUPPORT_PHONE,
} from './billing.constants';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: SubscriptionStateService,
  ) {}

  private async membership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
    return m;
  }

  /** Plans are created from the defaults the first time anybody asks for them. */
  async ensurePlans() {
    const count = await this.prisma.plan.count();
    if (count === 0) {
      for (const p of DEFAULT_PLANS) {
        await this.prisma.plan.upsert({
          where: { code: p.code },
          create: { ...p, priceTzs: new Prisma.Decimal(p.priceTzs) },
          update: {},
        });
      }
    }
  }

  async setting(key: string, fallback = ''): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  }

  /** What an owner sees on the billing page before paying. */
  async listPlans() {
    await this.ensurePlans();
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const monthly = plans.find((p) => p.months === 1);

    return {
      plans: plans.map((p) => {
        const price = p.priceTzs.toNumber();
        const full = monthly ? monthly.priceTzs.toNumber() * p.months : price;
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          months: p.months,
          priceTzs: price,
          perMonthTzs: Math.round(price / p.months),
          savingsPercent: full > price ? Math.round(((full - price) / full) * 100) : 0,
        };
      }),
      paymentInstructions: await this.setting(
        SETTING_INSTRUCTIONS,
        process.env.BILLING_PAY_INSTRUCTIONS || '',
      ),
      supportPhone: await this.setting(SETTING_SUPPORT_PHONE, process.env.BILLING_SUPPORT_PHONE || ''),
    };
  }

  async status(businessId: string, userId: string) {
    const member = await this.membership(businessId, userId);
    const sub = await this.state.get(businessId);
    if (!sub) throw new NotFoundException('Business not found');

    const info = computeAccess(sub);
    const plan = sub.planId ? await this.prisma.plan.findUnique({ where: { id: sub.planId } }) : null;
    const pending = await this.prisma.subscriptionPayment.count({
      where: { businessId, status: 'PENDING' },
    });

    return {
      businessId,
      state: info.state, // TRIALING | ACTIVE | GRACE | EXPIRED
      access: info.access, // FULL | READ_ONLY
      daysLeft: info.daysLeft,
      endsAt: info.endsAt,
      graceEndsAt: info.graceEndsAt,
      plan: plan ? { code: plan.code, name: plan.name } : null,
      hadTrial: sub.hadTrial,
      pendingPayments: pending,
      isOwner: member.isOwner,
    };
  }

  async payments(businessId: string, userId: string) {
    await this.membership(businessId, userId);
    const rows = await this.prisma.subscriptionPayment.findMany({
      where: { businessId },
      include: { plan: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      plan: r.plan.name,
      amount: r.amount.toNumber(),
      method: r.method,
      reference: r.reference,
      status: r.status,
      rejectReason: r.rejectReason,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
    }));
  }

  /** Owner says "I paid" and gives the mobile-money reference. A human confirms it later. */
  async submitPayment(businessId: string, userId: string, dto: SubmitPaymentDto) {
    const member = await this.membership(businessId, userId);
    if (!member.isOwner) throw new ForbiddenException('Only the business owner can pay for the subscription');

    await this.ensurePlans();
    const plan = await this.prisma.plan.findFirst({ where: { code: dto.planCode, isActive: true } });
    if (!plan) throw new BadRequestException('Unknown plan');

    const pending = await this.prisma.subscriptionPayment.count({
      where: { businessId, status: 'PENDING' },
    });
    if (pending >= MAX_PENDING_PAYMENTS) {
      throw new BadRequestException('You already have payments waiting for confirmation. Please wait for them to be checked.');
    }

    const reference = dto.reference.trim().toUpperCase().replace(/\s+/g, '');
    try {
      const payment = await this.prisma.subscriptionPayment.create({
        data: {
          businessId,
          planId: plan.id,
          amount: plan.priceTzs, // price at the time of payment
          method: dto.method,
          reference,
          payerPhone: dto.payerPhone,
          submittedById: userId,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'BILLING_PAYMENT_SUBMIT',
          entityType: 'SubscriptionPayment',
          entityId: payment.id,
          newValues: { plan: plan.code, method: dto.method, reference },
        },
      });
      return { id: payment.id, status: payment.status, amount: payment.amount.toNumber(), plan: plan.name };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('This transaction reference was already submitted');
      }
      throw err;
    }
  }
}
