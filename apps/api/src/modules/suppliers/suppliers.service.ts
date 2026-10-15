import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { Prisma } from '@prisma/client';
import { recordCash, isCashMethod } from '../../common/cash-ledger';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
  }

  async create(businessId: string, userId: string, dto: CreateSupplierDto) {
    await this.assertMembership(businessId, userId);
    return this.prisma.supplier.create({
      data: { businessId, ...dto },
    });
  }

  async findAll(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);
    return this.prisma.supplier.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(businessId: string, userId: string, id: string) {
    await this.assertMembership(businessId, userId);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
      include: {
        purchases: { orderBy: { createdAt: 'desc' }, take: 20 },
        payments: { orderBy: { paidAt: 'desc' }, take: 20 },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Outstanding balance from ledger
    const txnSum = await this.prisma.supplierTransaction.aggregate({
      where: { supplierId: id },
      _sum: { amount: true },
    });
    return {
      ...supplier,
      outstandingBalance: txnSum._sum.amount?.toNumber() ?? 0,
    };
  }

  async recordPayment(
    businessId: string,
    userId: string,
    supplierId: string,
    dto: import('./dto/supplier-payment.dto').SupplierPaymentDto,
  ) {
    await this.assertMembership(businessId, userId);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          businessId,
          supplierId,
          amount,
          paymentMethodId: dto.paymentMethodId,
          reference: dto.reference,
          notes: dto.notes,
          createdById: userId,
        },
      });

      await tx.supplierTransaction.create({
        data: {
          businessId,
          supplierId,
          type: 'PAYMENT',
          amount: amount.neg(),
          referenceType: 'SUPPLIER_PAYMENT',
          referenceId: payment.id,
          notes: dto.notes,
        },
      });

      if (await isCashMethod(tx, businessId, dto.paymentMethodId)) {
        await recordCash(tx, businessId, {
          type: 'SUPPLIER_PAYMENT',
          amount,
          referenceType: 'SUPPLIER_PAYMENT',
          referenceId: payment.id,
        });
      }

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'SUPPLIER_PAYMENT',
          entityType: 'SupplierPayment',
          entityId: payment.id,
          newValues: { supplierId, amount: amount.toString() },
        },
      });

      return payment;
    });
  }
}
