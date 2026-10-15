import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Prisma } from '@prisma/client';
import { recordCash, isCashMethod } from '../../common/cash-ledger';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
  }

  async create(businessId: string, userId: string, dto: CreateExpenseDto) {
    await this.assertMembership(businessId, userId);
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: dto.categoryId, businessId },
    });
    if (!category) throw new NotFoundException('Expense category not found');

    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          businessId,
          categoryId: dto.categoryId,
          amount: new Prisma.Decimal(dto.amount),
          paymentMethodId: dto.paymentMethodId,
          description: dto.description,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
          createdById: userId,
        },
        include: { category: true },
      });

      // Paid from the drawer → expected cash goes down
      if (await isCashMethod(tx, businessId, dto.paymentMethodId)) {
        await recordCash(tx, businessId, {
          type: 'EXPENSE',
          amount: created.amount,
          referenceType: 'EXPENSE',
          referenceId: created.id,
          notes: category.name,
        });
      }

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'EXPENSE_CREATE',
          entityType: 'Expense',
          entityId: created.id,
          newValues: { amount: dto.amount, category: category.name },
        },
      });

      return created;
    });

    return expense;
  }

  async findAll(businessId: string, userId: string, opts: { from?: string; to?: string } = {}) {
    await this.assertMembership(businessId, userId);
    const where: Prisma.ExpenseWhereInput = { businessId };
    if (opts.from || opts.to) {
      where.expenseDate = {};
      if (opts.from) where.expenseDate.gte = new Date(opts.from);
      if (opts.to) where.expenseDate.lte = new Date(opts.to);
    }
    return this.prisma.expense.findMany({
      where,
      include: { category: true },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async categories(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);
    return this.prisma.expenseCategory.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }
}
