import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCustomerDto, CustomerPaymentDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { computeAgeing } from '../../common/ageing';
import { Prisma } from '@prisma/client';
import { recordCash, isCashMethod } from '../../common/cash-ledger';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
  }

  async create(businessId: string, userId: string, dto: CreateCustomerDto) {
    await this.assertMembership(businessId, userId);
    return this.prisma.customer.create({
      data: {
        businessId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        notes: dto.notes,
        creditLimit: new Prisma.Decimal(dto.creditLimit ?? 0),
        customerType: dto.customerType ?? 'RETAIL',
        paymentTermsDays: dto.paymentTermsDays ?? 0,
      },
    });
  }

  async update(businessId: string, userId: string, id: string, dto: UpdateCustomerDto) {
    await this.assertMembership(businessId, userId);
    const existing = await this.prisma.customer.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Customer not found');

    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.creditLimit !== undefined) data.creditLimit = new Prisma.Decimal(dto.creditLimit);
    if (dto.customerType !== undefined) data.customerType = dto.customerType;
    if (dto.paymentTermsDays !== undefined) data.paymentTermsDays = dto.paymentTermsDays;

    const updated = await this.prisma.customer.update({ where: { id }, data });
    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'CUSTOMER_UPDATE',
        entityType: 'Customer',
        entityId: id,
        newValues: dto as any,
      },
    });
    return updated;
  }

  /** Customers who owe money, with FIFO ageing (current / 1-30 / 31-60 / 60+ days overdue). */
  async overdue(businessId: string, userId: string, onlyOverdue = true) {
    await this.assertMembership(businessId, userId);
    const rows = await computeAgeing(this.prisma, businessId);
    return rows
      .filter((r) => r.balance > 0 && (!onlyOverdue || r.overdueAmount > 0))
      .sort((a, b) => b.overdueAmount - a.overdueAmount);
  }

  /** Account statement: every invoice and payment with a running balance. */
  async statement(
    businessId: string,
    userId: string,
    id: string,
    opts: { from?: string; to?: string } = {},
  ) {
    await this.assertMembership(businessId, userId);
    const customer = await this.prisma.customer.findFirst({ where: { id, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;
    if (to) to.setHours(23, 59, 59, 999);

    const all = await this.prisma.customerTransaction.findMany({
      where: { businessId, customerId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Receipt numbers for invoice lines
    const saleIds = all
      .filter((t) => t.referenceType === 'SALE' || t.referenceType === 'SALE_VOID')
      .map((t) => t.referenceId!)
      .filter(Boolean);
    const sales = saleIds.length
      ? await this.prisma.sale.findMany({
          where: { id: { in: saleIds }, businessId },
          select: { id: true, receiptNumber: true },
        })
      : [];
    const receiptOf = new Map(sales.map((s) => [s.id, s.receiptNumber]));

    let running = new Prisma.Decimal(0);
    let opening = new Prisma.Decimal(0);
    const lines: {
      date: Date;
      type: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
      dueDate: Date | null;
    }[] = [];

    for (const t of all) {
      running = running.add(t.amount);
      if (from && t.createdAt < from) {
        opening = running;
        continue;
      }
      if (to && t.createdAt > to) continue;

      const receipt = t.referenceId ? receiptOf.get(t.referenceId) : undefined;
      lines.push({
        date: t.createdAt,
        type: t.type,
        description: [receipt ? `Sale ${receipt}` : t.type, t.notes].filter(Boolean).join(' - '),
        debit: t.amount.gt(0) ? t.amount.toNumber() : 0,
        credit: t.amount.lt(0) ? t.amount.neg().toNumber() : 0,
        balance: running.toNumber(),
        dueDate: t.dueDate,
      });
    }

    const closing = lines.length ? lines[lines.length - 1].balance : opening.toNumber();
    const ageing = (await computeAgeing(this.prisma, businessId, { customerId: id }))[0] ?? null;

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        creditLimit: customer.creditLimit.toNumber(),
        customerType: customer.customerType,
      },
      from: opts.from ?? null,
      to: opts.to ?? null,
      openingBalance: opening.toNumber(),
      closingBalance: closing,
      lines,
      ageing,
    };
  }

  async findAll(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);
    const customers = await this.prisma.customer.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    // Attach balances
    const result = [];
    for (const c of customers) {
      const sum = await this.prisma.customerTransaction.aggregate({
        where: { customerId: c.id },
        _sum: { amount: true },
      });
      result.push({
        ...c,
        outstandingBalance: sum._sum.amount?.toNumber() ?? 0,
      });
    }
    return result;
  }

  async findOne(businessId: string, userId: string, id: string) {
    await this.assertMembership(businessId, userId);
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId },
      include: {
        sales: { orderBy: { createdAt: 'desc' }, take: 20 },
        payments: { orderBy: { paidAt: 'desc' }, take: 20 },
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const sum = await this.prisma.customerTransaction.aggregate({
      where: { customerId: id },
      _sum: { amount: true },
    });
    return {
      ...customer,
      outstandingBalance: sum._sum.amount?.toNumber() ?? 0,
    };
  }

  async recordPayment(businessId: string, userId: string, customerId: string, dto: CustomerPaymentDto) {
    await this.assertMembership(businessId, userId);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.create({
        data: {
          businessId,
          customerId,
          amount,
          paymentMethodId: dto.paymentMethodId,
          reference: dto.reference,
          notes: dto.notes,
          createdById: userId,
        },
      });

      // Ledger: negative = reduces what customer owes
      await tx.customerTransaction.create({
        data: {
          businessId,
          customerId,
          type: 'PAYMENT',
          amount: amount.neg(),
          referenceType: 'CUSTOMER_PAYMENT',
          referenceId: payment.id,
          notes: dto.notes,
        },
      });

      if (await isCashMethod(tx, businessId, dto.paymentMethodId)) {
        await recordCash(tx, businessId, {
          type: 'CUSTOMER_PAYMENT',
          amount,
          referenceType: 'CUSTOMER_PAYMENT',
          referenceId: payment.id,
        });
      }

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'CUSTOMER_PAYMENT',
          entityType: 'CustomerPayment',
          entityId: payment.id,
          newValues: { customerId, amount: amount.toString() },
        },
      });

      return payment;
    });
  }
}
