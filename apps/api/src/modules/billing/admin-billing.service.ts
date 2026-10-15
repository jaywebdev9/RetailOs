import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionStateService } from './subscription-state.service';
import { BillingService } from './billing.service';
import { UpdateBillingSettingsDto, UpdatePlanDto } from './dto/billing.dto';
import {
  GRACE_DAYS,
  addDays,
  addMonths,
  computeAccess,
} from '../../common/subscription-state';
import { SETTING_INSTRUCTIONS, SETTING_SUPPORT_PHONE } from './billing.constants';

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: SubscriptionStateService,
    private readonly billing: BillingService,
  ) {}

  async payments(status?: string) {
    const rows = await this.prisma.subscriptionPayment.findMany({
      where: status ? { status: status as any } : {},
      include: {
        plan: { select: { name: true, code: true, months: true } },
        business: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      businessName: r.business.name,
      businessPhone: r.business.phone,
      plan: r.plan.name,
      months: r.plan.months,
      amount: r.amount.toNumber(),
      method: r.method,
      reference: r.reference,
      payerPhone: r.payerPhone,
      status: r.status,
      rejectReason: r.rejectReason,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Confirms a payment and extends the subscription.
   *  - still active (or still in trial)  → new period starts where the current one ends (no days are lost)
   *  - already ended                     → new period starts now
   * `reviewer` is the admin's user id, or 'SYSTEM' when a payment gateway webhook confirms it.
   */
  async confirmPayment(paymentId: string, reviewer: string) {
    const businessId = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.findUnique({
        where: { id: paymentId },
        include: { plan: true },
      });
      if (!payment) throw new NotFoundException('Payment not found');

      // Atomic "claim": two admins clicking at once cannot both extend the plan.
      const claimed = await tx.subscriptionPayment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          reviewedById: reviewer === 'SYSTEM' ? null : reviewer,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) throw new BadRequestException('This payment was already reviewed');

      const now = new Date();
      let sub = await tx.subscription.findUnique({ where: { businessId: payment.businessId } });
      if (!sub) {
        sub = await tx.subscription.create({
          data: {
            businessId: payment.businessId,
            trialEndsAt: now,
            graceEndsAt: now,
            status: 'EXPIRED',
          },
        });
      }

      const currentEnd = sub.currentPeriodEnd ?? sub.trialEndsAt;
      const base = currentEnd > now ? currentEnd : now;
      const periodEnd = addMonths(base, payment.plan.months);

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          planId: payment.planId,
          status: 'ACTIVE',
          currentPeriodStart: sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodStart : base,
          currentPeriodEnd: periodEnd,
          graceEndsAt: addDays(periodEnd, GRACE_DAYS),
        },
      });

      await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: { periodStart: base, periodEnd },
      });

      await tx.auditLog.create({
        data: {
          businessId: payment.businessId,
          userId: reviewer === 'SYSTEM' ? null : reviewer,
          action: 'BILLING_PAYMENT_CONFIRM',
          entityType: 'SubscriptionPayment',
          entityId: paymentId,
          newValues: { plan: payment.plan.code, periodEnd: periodEnd.toISOString() },
        },
      });

      // The "plan ends soon" alert is no longer true
      await tx.alert.updateMany({
        where: { businessId: payment.businessId, type: 'SUBSCRIPTION', isResolved: false },
        data: { isResolved: true, resolvedAt: new Date() },
      });

      return payment.businessId;
    });

    this.state.invalidate(businessId);
    return { ok: true, businessId };
  }

  async rejectPayment(paymentId: string, reviewer: string, reason: string) {
    const res = await this.prisma.subscriptionPayment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'REJECTED', rejectReason: reason, reviewedById: reviewer, reviewedAt: new Date() },
    });
    if (res.count === 0) throw new BadRequestException('Payment not found or already reviewed');
    await this.prisma.auditLog.create({
      data: {
        userId: reviewer,
        action: 'BILLING_PAYMENT_REJECT',
        entityType: 'SubscriptionPayment',
        entityId: paymentId,
        newValues: { reason },
      },
    });
    return { ok: true };
  }

  /** Free days for a business (support, goodwill, trial extension). Same rules as a payment. */
  async grantDays(businessId: string, adminId: string, days: number) {
    const sub = await this.state.get(businessId);
    if (!sub) throw new NotFoundException('Business not found');
    const now = new Date();
    const current = sub.currentPeriodEnd ?? sub.trialEndsAt;
    const base = current > now ? current : now;
    const end = addDays(base, days);

    if (sub.currentPeriodEnd) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { currentPeriodEnd: end, graceEndsAt: addDays(end, GRACE_DAYS), status: 'ACTIVE' },
      });
    } else {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { trialEndsAt: end, graceEndsAt: addDays(end, GRACE_DAYS), status: 'TRIALING', hadTrial: true },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId: adminId,
        action: 'BILLING_GRANT_DAYS',
        entityType: 'Subscription',
        entityId: sub.id,
        newValues: { days, endsAt: end.toISOString() },
      },
    });
    this.state.invalidate(businessId);
    return { ok: true, endsAt: end };
  }

  async businesses() {
    const rows = await this.prisma.business.findMany({
      include: {
        subscription: { include: { plan: { select: { name: true } } } },
        members: {
          where: { isOwner: true },
          take: 1,
          include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return rows.map((b) => {
      const info = b.subscription ? computeAccess(b.subscription) : null;
      const owner = b.members[0]?.user;
      return {
        id: b.id,
        name: b.name,
        createdAt: b.createdAt,
        ownerName: owner ? `${owner.firstName} ${owner.lastName ?? ''}`.trim() : '',
        ownerPhone: owner?.phone || b.phone,
        ownerEmail: owner?.email,
        state: info?.state ?? 'NO_SUBSCRIPTION',
        daysLeft: info?.daysLeft ?? null,
        endsAt: info?.endsAt ?? null,
        plan: b.subscription?.plan?.name ?? null,
      };
    });
  }

  async plans() {
    await this.billing.ensurePlans();
    const plans = await this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      months: p.months,
      priceTzs: p.priceTzs.toNumber(),
      isActive: p.isActive,
    }));
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.priceTzs !== undefined ? { priceTzs: dto.priceTzs } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return { id: updated.id, priceTzs: updated.priceTzs.toNumber(), isActive: updated.isActive };
  }

  async settings() {
    return {
      paymentInstructions: await this.billing.setting(SETTING_INSTRUCTIONS, process.env.BILLING_PAY_INSTRUCTIONS || ''),
      supportPhone: await this.billing.setting(SETTING_SUPPORT_PHONE, process.env.BILLING_SUPPORT_PHONE || ''),
    };
  }

  async updateSettings(dto: UpdateBillingSettingsDto) {
    const entries: [string, string | undefined][] = [
      [SETTING_INSTRUCTIONS, dto.paymentInstructions],
      [SETTING_SUPPORT_PHONE, dto.supportPhone],
    ];
    for (const [key, value] of entries) {
      if (value === undefined) continue;
      await this.prisma.platformSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    return this.settings();
  }
}
