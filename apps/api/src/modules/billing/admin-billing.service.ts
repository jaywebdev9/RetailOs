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
import {
  SETTING_INSTRUCTIONS,
  SETTING_SUPPORT_PHONE,
  SETTING_MAINTENANCE,
  SETTING_MAINTENANCE_MSG,
} from './billing.constants';

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
        phone: b.phone,
        businessType: b.businessType,
        isActive: b.isActive,
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
    const maint = await this.billing.setting(SETTING_MAINTENANCE, 'false');
    return {
      paymentInstructions: await this.billing.setting(
        SETTING_INSTRUCTIONS,
        process.env.BILLING_PAY_INSTRUCTIONS || '',
      ),
      supportPhone: await this.billing.setting(
        SETTING_SUPPORT_PHONE,
        process.env.BILLING_SUPPORT_PHONE || '',
      ),
      maintenanceMode: maint === 'true' || maint === '1',
      maintenanceMessage: await this.billing.setting(
        SETTING_MAINTENANCE_MSG,
        'We are performing maintenance. Please try again shortly.',
      ),
    };
  }

  async updateSettings(dto: UpdateBillingSettingsDto) {
    const entries: [string, string | undefined][] = [
      [SETTING_INSTRUCTIONS, dto.paymentInstructions],
      [SETTING_SUPPORT_PHONE, dto.supportPhone],
    ];
    if (dto.maintenanceMode !== undefined) {
      entries.push([SETTING_MAINTENANCE, dto.maintenanceMode ? 'true' : 'false']);
    }
    if (dto.maintenanceMessage !== undefined) {
      entries.push([SETTING_MAINTENANCE_MSG, dto.maintenanceMessage]);
    }
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

  async setBusinessActive(businessId: string, adminId: string, isActive: boolean) {
    const b = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!b) throw new NotFoundException('Business not found');
    await this.prisma.business.update({
      where: { id: businessId },
      data: { isActive },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId: adminId,
        action: isActive ? 'BUSINESS_ACTIVATE' : 'BUSINESS_SUSPEND',
        entityType: 'Business',
        entityId: businessId,
        oldValues: { isActive: b.isActive },
        newValues: { isActive },
      },
    });
    this.state.invalidate(businessId);
    return { ok: true, isActive };
  }

  async forceExpire(businessId: string, adminId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const now = new Date();
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'EXPIRED',
        currentPeriodEnd: now,
        trialEndsAt: sub.trialEndsAt > now ? now : sub.trialEndsAt,
        graceEndsAt: now,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId: adminId,
        action: 'BILLING_FORCE_EXPIRE',
        entityType: 'Subscription',
        entityId: sub.id,
        newValues: { status: 'EXPIRED' },
      },
    });
    this.state.invalidate(businessId);
    return { ok: true };
  }

  async businessDetail(businessId: string) {
    const b = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscription: { include: { plan: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                isActive: true,
              },
            },
            role: { select: { name: true } },
          },
        },
      },
    });
    if (!b) throw new NotFoundException('Business not found');
    const info = b.subscription ? computeAccess(b.subscription) : null;
    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { businessId },
      include: { plan: { select: { name: true, months: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      id: b.id,
      name: b.name,
      phone: b.phone,
      email: b.email,
      address: b.address,
      businessType: b.businessType,
      isActive: b.isActive,
      createdAt: b.createdAt,
      subscription: info
        ? {
            state: info.state,
            daysLeft: info.daysLeft,
            endsAt: info.endsAt,
            plan: b.subscription?.plan?.name ?? null,
          }
        : null,
      members: b.members.map((m) => ({
        id: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName ?? ''}`.trim(),
        phone: m.user.phone,
        email: m.user.email,
        role: m.role?.name,
        isOwner: m.isOwner,
        isActive: m.user.isActive && m.isActive,
      })),
      payments: payments.map((r) => ({
        id: r.id,
        plan: r.plan.name,
        months: r.plan.months,
        amount: r.amount.toNumber(),
        method: r.method,
        reference: r.reference,
        status: r.status,
        rejectReason: r.rejectReason,
        createdAt: r.createdAt,
      })),
    };
  }

  async summary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      pending,
      confirmedMonth,
      confirmedAll,
      businesses,
      activeBiz,
      suspended,
      trialing,
      expired,
    ] = await Promise.all([
      this.prisma.subscriptionPayment.count({ where: { status: 'PENDING' } }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: 'CONFIRMED', createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.business.count(),
      this.prisma.business.count({ where: { isActive: true } }),
      this.prisma.business.count({ where: { isActive: false } }),
      this.prisma.subscription.count({ where: { status: 'TRIALING' } }),
      this.prisma.subscription.count({ where: { status: 'EXPIRED' } }),
    ]);
    return {
      pendingPayments: pending,
      revenueThisMonth: confirmedMonth._sum.amount?.toNumber() ?? 0,
      paymentsThisMonth: confirmedMonth._count,
      revenueAllTime: confirmedAll._sum.amount?.toNumber() ?? 0,
      paymentsAllTime: confirmedAll._count,
      totalBusinesses: businesses,
      activeBusinesses: activeBiz,
      suspendedBusinesses: suspended,
      trialingSubscriptions: trialing,
      expiredSubscriptions: expired,
    };
  }

  async auditLogs(limit = 100) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'BILLING_PAYMENT_CONFIRM',
            'BILLING_PAYMENT_REJECT',
            'BILLING_GRANT_DAYS',
            'BILLING_FORCE_EXPIRE',
            'BUSINESS_SUSPEND',
            'BUSINESS_ACTIVATE',
            'PLATFORM_ADMIN_GRANT',
            'PLATFORM_ADMIN_REVOKE',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        business: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      businessName: r.business?.name ?? null,
      actor: r.user
        ? `${r.user.firstName} ${r.user.lastName ?? ''}`.trim()
        : r.userId === null
          ? 'SYSTEM'
          : '—',
      newValues: r.newValues,
      oldValues: r.oldValues,
      createdAt: r.createdAt,
    }));
  }

  async listPlatformAdmins() {
    const users = await this.prisma.user.findMany({
      where: { isPlatformAdmin: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName ?? ''}`.trim(),
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  }

  async searchUsers(q: string) {
    const query = (q || '').trim();
    if (query.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isPlatformAdmin: true,
        isActive: true,
      },
      take: 20,
    });
    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName ?? ''}`.trim(),
      email: u.email,
      phone: u.phone,
      isPlatformAdmin: u.isPlatformAdmin,
      isActive: u.isActive,
    }));
  }

  async setPlatformAdmin(userId: string, adminId: string, isPlatformAdmin: boolean) {
    if (userId === adminId && !isPlatformAdmin) {
      throw new BadRequestException('You cannot remove your own platform admin access');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isPlatformAdmin },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: isPlatformAdmin ? 'PLATFORM_ADMIN_GRANT' : 'PLATFORM_ADMIN_REVOKE',
        entityType: 'User',
        entityId: userId,
        newValues: { isPlatformAdmin, target: user.email || user.phone },
      },
    });
    return { ok: true, isPlatformAdmin };
  }

  async setUserActive(userId: string, adminId: string, isActive: boolean) {
    if (userId === adminId && !isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
        entityType: 'User',
        entityId: userId,
        newValues: { isActive },
      },
    });
    return { ok: true, isActive };
  }
}
