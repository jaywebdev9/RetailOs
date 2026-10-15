import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { Prisma, PaymentStatus, SaleStatus } from '@prisma/client';
import { logger } from '../../common/logger';
import { recordCash, isCashMethod } from '../../common/cash-ledger';
import { computeSalesFigures } from '../../common/profit';
import { resolvePackPrice, resolveUnitPrice } from '../../common/pricing';

const TX_OPTIONS = { maxWait: 10000, timeout: 20000 };

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── helpers ─────────────────────────

  private async getMembership(businessId: string, userId: string) {
    const membership = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!membership) throw new ForbiddenException('No access to this business');
    return membership;
  }

  private can(
    membership: Awaited<ReturnType<SalesService['getMembership']>>,
    code: string,
  ) {
    return (
      membership.isOwner ||
      membership.role.permissions.some((rp) => rp.permission.code === code)
    );
  }

  /** Serialises sales/returns/voids per business: safe stock checks and receipt numbers. */
  private async lockBusiness(tx: Prisma.TransactionClient, businessId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId + ':sales'}))`;
  }

  private async nextReceiptNumber(
    tx: Prisma.TransactionClient,
    businessId: string,
  ): Promise<string> {
    const today = new Date();
    const prefix = `R${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await tx.sale.count({
      where: { businessId, receiptNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private readonly saleInclude = Prisma.validator<Prisma.SaleInclude>()({
    items: { include: { product: true } },
    payments: { include: { paymentMethod: true } },
    customer: true,
  });

  /** Cash that really stayed in the drawer for a sale (cash tendered − change given). */
  private netCashOfSale(
    total: Prisma.Decimal,
    payments: { amount: Prisma.Decimal; paymentMethod: { code: string } }[],
  ): Prisma.Decimal {
    const paid = payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
    const cashTendered = payments
      .filter((p) => p.paymentMethod.code === 'CASH')
      .reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
    const change = paid.gt(total) ? paid.sub(total) : new Prisma.Decimal(0);
    const net = cashTendered.sub(change);
    return net.gt(0) ? net : new Prisma.Decimal(0);
  }

  // ───────────────────────── create sale ─────────────────────────

  async create(businessId: string, cashierId: string, dto: CreateSaleDto) {
    const membership = await this.getMembership(businessId, cashierId);
    const canOverridePrice = this.can(membership, 'sales.override_price');

    // Idempotency: offline resync returns the existing sale
    if (dto.clientTransactionId) {
      const existing = await this.prisma.sale.findUnique({
        where: {
          businessId_clientTransactionId: {
            businessId,
            clientTransactionId: dto.clientTransactionId,
          },
        },
        include: this.saleInclude,
      });
      if (existing) return existing;
    }

    // Products
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId, status: 'ACTIVE' },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or inactive');
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Customer must belong to this business
    let customer: {
      id: string;
      creditLimit: Prisma.Decimal;
      customerType: 'RETAIL' | 'WHOLESALE';
      paymentTermsDays: number;
    } | null = null;
    if (dto.customerId) {
      customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, businessId },
        select: { id: true, creditLimit: true, customerType: true, paymentTermsDays: true },
      });
      if (!customer) throw new BadRequestException('Customer not found');
    }

    // Packs (carton, sack...) used in this sale
    const packIds = [...new Set(dto.items.map((i) => i.packId).filter(Boolean) as string[])];
    const packs = packIds.length
      ? await this.prisma.productPack.findMany({
          where: { id: { in: packIds }, businessId, isActive: true },
        })
      : [];
    if (packs.length !== packIds.length) throw new BadRequestException('Invalid pack');
    const packMap = new Map(packs.map((p) => [p.id, p]));

    // Payment methods must belong to this business
    const methodIds = [...new Set(dto.payments.map((p) => p.paymentMethodId))];
    const methods = await this.prisma.paymentMethod.findMany({
      where: { id: { in: methodIds }, businessId, isActive: true },
    });
    if (methods.length !== methodIds.length) {
      throw new BadRequestException('Invalid payment method');
    }
    const methodMap = new Map(methods.map((m) => [m.id, m]));

    // Totals + price rules
    let subtotal = new Prisma.Decimal(0);
    const itemRows: {
      productId: string;
      quantity: Prisma.Decimal;
      sellingPrice: Prisma.Decimal;
      costPriceAtSale: Prisma.Decimal;
      discount: Prisma.Decimal;
      total: Prisma.Decimal;
      packName?: string;
      packQuantity?: Prisma.Decimal;
    }[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      const pack = item.packId ? packMap.get(item.packId) : undefined;
      if (item.packId && (!pack || pack.productId !== product.id)) {
        throw new BadRequestException(`Pack does not belong to ${product.name}`);
      }

      // `quantity` is in packs when a pack is used; stock is always in base units
      const enteredQty = new Prisma.Decimal(item.quantity);
      const qty = pack ? enteredQty.mul(pack.factor) : enteredQty;

      // Price: what the cashier typed, otherwise server rule (retail / wholesale / quantity break)
      const enteredPrice =
        item.sellingPrice != null
          ? new Prisma.Decimal(item.sellingPrice)
          : pack
            ? resolvePackPrice(product, pack, customer?.customerType, qty)
            : resolveUnitPrice(product, customer?.customerType, qty);
      const disc = new Prisma.Decimal(item.discount ?? 0);
      // line total is computed from the price the customer saw (no rounding drift per base unit)
      const lineTotal = enteredQty.mul(enteredPrice).sub(disc);
      const price = pack ? enteredPrice.div(pack.factor).toDecimalPlaces(4) : enteredPrice;

      if (lineTotal.lt(0)) {
        throw new BadRequestException('Line total cannot be negative');
      }

      // Minimum selling price (after line discount) needs a special permission to break
      if (product.minimumSellingPrice && !canOverridePrice) {
        const effectiveUnit = lineTotal.div(qty);
        if (effectiveUnit.lt(product.minimumSellingPrice)) {
          throw new ForbiddenException(
            `${product.name} cannot be sold below ${product.minimumSellingPrice.toString()}. Ask the owner or manager.`,
          );
        }
      }

      subtotal = subtotal.add(lineTotal);
      itemRows.push({
        productId: product.id,
        quantity: qty,
        sellingPrice: price,
        costPriceAtSale: product.costPrice, // freeze historical cost
        discount: disc,
        total: lineTotal,
        packName: pack?.name,
        packQuantity: pack ? enteredQty : undefined,
      });
    }

    const headerDiscount = new Prisma.Decimal(dto.discount ?? 0);
    const total = subtotal.sub(headerDiscount);
    if (total.lt(0)) throw new BadRequestException('Sale total cannot be negative');

    // Real money received. A "CREDIT" method means "put it on the customer's account".
    const realPayments = dto.payments.filter(
      (p) => methodMap.get(p.paymentMethodId)!.code !== 'CREDIT',
    );
    const paymentSum = realPayments.reduce(
      (sum, p) => sum.add(new Prisma.Decimal(p.amount)),
      new Prisma.Decimal(0),
    );

    let paymentStatus: PaymentStatus = PaymentStatus.PAID;
    let creditAmount = new Prisma.Decimal(0);
    if (paymentSum.lt(total)) {
      creditAmount = total.sub(paymentSum);
      paymentStatus = paymentSum.gt(0) ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT;
      if (!customer) {
        throw new BadRequestException('Customer is required for credit sales');
      }
    }

    // Due date for the unpaid part: explicit, else customer's payment terms, else none
    let dueDate: Date | undefined;
    if (creditAmount.gt(0)) {
      if (dto.dueDate) dueDate = new Date(dto.dueDate);
      else if (customer && customer.paymentTermsDays > 0) {
        dueDate = new Date(Date.now() + customer.paymentTermsDays * 86400000);
      }
    }

    try {
      const sale = await this.prisma.$transaction(async (tx) => {
        await this.lockBusiness(tx, businessId);

        // Stock check (inside the lock → no overselling by concurrent cashiers)
        const needed = new Map<string, Prisma.Decimal>();
        for (const row of itemRows) {
          needed.set(
            row.productId,
            (needed.get(row.productId) ?? new Prisma.Decimal(0)).add(row.quantity),
          );
        }
        for (const [productId, qty] of needed) {
          const product = productMap.get(productId)!;
          if (!product.trackInventory || product.allowNegativeStock) continue;
          const agg = await tx.inventoryTransaction.aggregate({
            where: { businessId, productId },
            _sum: { quantity: true },
          });
          const current = agg._sum.quantity ?? new Prisma.Decimal(0);
          if (current.lt(qty)) {
            throw new BadRequestException(
              `Insufficient stock for ${product.name}. Available: ${current.toString()}`,
            );
          }
        }

        // Credit limit (0 = no limit configured)
        if (creditAmount.gt(0) && customer && customer.creditLimit.gt(0)) {
          const bal = await tx.customerTransaction.aggregate({
            where: { businessId, customerId: customer.id },
            _sum: { amount: true },
          });
          const owed = bal._sum.amount ?? new Prisma.Decimal(0);
          if (owed.add(creditAmount).gt(customer.creditLimit)) {
            throw new BadRequestException(
              `Credit limit exceeded. Limit ${customer.creditLimit.toString()}, already owes ${owed.toString()}.`,
            );
          }
        }

        const receiptNumber = await this.nextReceiptNumber(tx, businessId);

        const created = await tx.sale.create({
          data: {
            businessId,
            receiptNumber,
            cashierId,
            customerId: dto.customerId,
            subtotal,
            discount: headerDiscount,
            tax: new Prisma.Decimal(0),
            total,
            status: SaleStatus.COMPLETED,
            paymentStatus,
            clientTransactionId: dto.clientTransactionId,
            notes: dto.notes,
            items: { create: itemRows },
            payments: {
              create: realPayments.map((p) => ({
                paymentMethodId: p.paymentMethodId,
                amount: new Prisma.Decimal(p.amount),
                reference: p.reference,
              })),
            },
          },
          include: this.saleInclude,
        });

        // Inventory ledger (negative = out)
        for (const row of itemRows) {
          const product = productMap.get(row.productId)!;
          if (!product.trackInventory) continue;
          await tx.inventoryTransaction.create({
            data: {
              businessId,
              productId: row.productId,
              quantity: row.quantity.neg(),
              type: 'SALE',
              referenceType: 'SALE',
              referenceId: created.id,
              unitCost: row.costPriceAtSale,
              userId: cashierId,
            },
          });
        }

        // Customer credit ledger
        if (creditAmount.gt(0) && customer) {
          await tx.customerTransaction.create({
            data: {
              businessId,
              customerId: customer.id,
              type: 'INVOICE',
              amount: creditAmount,
              referenceType: 'SALE',
              referenceId: created.id,
              dueDate,
            },
          });
        }

        // Cash drawer
        const netCash = this.netCashOfSale(total, created.payments);
        await recordCash(tx, businessId, {
          type: 'SALE_CASH',
          amount: netCash,
          referenceType: 'SALE',
          referenceId: created.id,
        });

        await tx.auditLog.create({
          data: {
            businessId,
            userId: cashierId,
            action: 'SALE_CREATE',
            entityType: 'Sale',
            entityId: created.id,
            newValues: { receiptNumber, total: total.toString(), paymentStatus },
          },
        });

        return created;
      }, TX_OPTIONS);

      logger.info('Sale created', {
        businessId,
        saleId: sale.id,
        receiptNumber: sale.receiptNumber,
        total: sale.total.toString(),
        cashierId,
      });
      return sale;
    } catch (err: any) {
      // Two devices syncing the same offline sale at the same moment
      if (err?.code === 'P2002' && dto.clientTransactionId) {
        const existing = await this.prisma.sale.findUnique({
          where: {
            businessId_clientTransactionId: {
              businessId,
              clientTransactionId: dto.clientTransactionId,
            },
          },
          include: this.saleInclude,
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  // ───────────────────────── void sale ─────────────────────────

  async voidSale(businessId: string, userId: string, saleId: string, dto: VoidSaleDto) {
    await this.getMembership(businessId, userId);

    return this.prisma.$transaction(async (tx) => {
      await this.lockBusiness(tx, businessId);

      const sale = await tx.sale.findFirst({
        where: { id: saleId, businessId },
        include: { items: true, payments: { include: { paymentMethod: true } } },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === 'VOIDED') throw new BadRequestException('Sale is already voided');
      if (sale.status !== 'COMPLETED') {
        throw new BadRequestException(
          'This sale already has returns. Process the remaining items as returns instead of voiding.',
        );
      }

      // 1. Put stock back
      const out = await tx.inventoryTransaction.findMany({
        where: { businessId, referenceType: 'SALE', referenceId: sale.id, type: 'SALE' },
      });
      for (const t of out) {
        await tx.inventoryTransaction.create({
          data: {
            businessId,
            productId: t.productId,
            quantity: t.quantity.neg(),
            type: 'SALE_VOID',
            referenceType: 'SALE_VOID',
            referenceId: sale.id,
            unitCost: t.unitCost,
            userId,
            reason: dto.reason,
          },
        });
      }

      // 2. Cancel the customer's debt for this sale
      const invoices = await tx.customerTransaction.findMany({
        where: { businessId, referenceType: 'SALE', referenceId: sale.id, type: 'INVOICE' },
      });
      for (const inv of invoices) {
        await tx.customerTransaction.create({
          data: {
            businessId,
            customerId: inv.customerId,
            type: 'VOID',
            amount: inv.amount.neg(),
            referenceType: 'SALE_VOID',
            referenceId: sale.id,
            notes: dto.reason,
          },
        });
      }

      // 3. Take the cash back out of the drawer
      await recordCash(tx, businessId, {
        type: 'CASH_OUT',
        amount: this.netCashOfSale(sale.total, sale.payments),
        referenceType: 'SALE_VOID',
        referenceId: sale.id,
        notes: `Void ${sale.receiptNumber}`,
      });

      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedById: userId,
          voidReason: dto.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'SALE_VOID',
          entityType: 'Sale',
          entityId: sale.id,
          oldValues: { status: sale.status },
          newValues: { status: 'VOIDED', reason: dto.reason },
        },
      });

      return updated;
    }, TX_OPTIONS);
  }

  // ───────────────────────── queries ─────────────────────────

  async findAll(
    businessId: string,
    userId: string,
    opts: { page?: number; limit?: number; from?: string; to?: string } = {},
  ) {
    await this.getMembership(businessId, userId);
    const page = Number(opts.page) || 1;
    const limit = Math.min(Number(opts.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = { businessId };
    if (opts.from || opts.to) {
      where.createdAt = {};
      if (opts.from) where.createdAt.gte = new Date(opts.from);
      if (opts.to) where.createdAt.lte = new Date(opts.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          payments: { include: { paymentMethod: true } },
          customer: { select: { id: true, name: true, phone: true } },
          cashier: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(businessId: string, userId: string, saleId: string) {
    await this.getMembership(businessId, userId);
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: {
        items: { include: { product: true } },
        payments: { include: { paymentMethod: true } },
        customer: true,
        cashier: { select: { id: true, firstName: true, lastName: true } },
        returns: { include: { items: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async todaySummary(businessId: string, userId: string) {
    await this.getMembership(businessId, userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const { revenue, cogs, transactions } = await computeSalesFigures(
      this.prisma,
      businessId,
      start,
      end,
    );

    return {
      date: start.toISOString().slice(0, 10),
      transactions,
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      grossProfit: revenue.sub(cogs).toNumber(),
    };
  }

  // ───────────────────────── returns ─────────────────────────

  async createReturn(businessId: string, userId: string, dto: CreateReturnDto) {
    await this.getMembership(businessId, userId);

    return this.prisma.$transaction(async (tx) => {
      await this.lockBusiness(tx, businessId);

      const sale = await tx.sale.findFirst({
        where: { id: dto.saleId, businessId },
        include: { items: true, payments: true },
      });
      if (!sale) throw new NotFoundException('Original sale not found');
      if (sale.status === 'VOIDED') {
        throw new BadRequestException('Cannot return a voided sale');
      }
      if (sale.status === 'FULLY_RETURNED') {
        throw new BadRequestException('This sale was already fully returned');
      }

      // What was already returned on this sale (per sale item)
      const previousItems = await tx.saleReturnItem.findMany({
        where: { saleReturn: { saleId: sale.id } },
      });
      const returnedSoFar = new Map<string, Prisma.Decimal>();
      for (const r of previousItems) {
        if (!r.saleItemId) continue;
        returnedSoFar.set(
          r.saleItemId,
          (returnedSoFar.get(r.saleItemId) ?? new Prisma.Decimal(0)).add(r.quantity),
        );
      }
      const prevRefunds = await tx.saleReturn.aggregate({
        where: { saleId: sale.id },
        _sum: { totalRefund: true },
      });
      const refundedBefore = prevRefunds._sum.totalRefund ?? new Prisma.Decimal(0);

      // Refund is computed on the server from what the customer really paid per unit
      // (line discount and the sale-level discount are both respected).
      const factor = sale.subtotal.gt(0) ? sale.total.div(sale.subtotal) : new Prisma.Decimal(1);

      const lines: {
        saleItemId: string;
        productId: string;
        quantity: Prisma.Decimal;
        refundAmount: Prisma.Decimal;
        unitCost: Prisma.Decimal;
      }[] = [];
      let totalRefund = new Prisma.Decimal(0);
      const seen = new Set<string>();

      for (const item of dto.items) {
        if (seen.has(item.saleItemId)) {
          throw new BadRequestException('Each sale item can appear only once per return');
        }
        seen.add(item.saleItemId);

        const original = sale.items.find((i) => i.id === item.saleItemId);
        if (!original) {
          throw new BadRequestException(`Sale item ${item.saleItemId} not found on this sale`);
        }
        const qty = new Prisma.Decimal(item.quantity);
        const already = returnedSoFar.get(original.id) ?? new Prisma.Decimal(0);
        if (already.add(qty).gt(original.quantity)) {
          throw new BadRequestException(
            `Return quantity exceeds what is left to return (${original.quantity.sub(already).toString()})`,
          );
        }

        const refund = original.total
          .div(original.quantity)
          .mul(qty)
          .mul(factor)
          .toDecimalPlaces(4);
        totalRefund = totalRefund.add(refund);
        lines.push({
          saleItemId: original.id,
          productId: original.productId,
          quantity: qty,
          refundAmount: refund,
          unitCost: original.costPriceAtSale,
        });
      }

      // Never refund more than the sale total (rounding safety)
      const maxRefund = sale.total.sub(refundedBefore);
      if (totalRefund.gt(maxRefund)) totalRefund = maxRefund;

      // Split refund: first cancel unpaid customer debt, the rest goes back as money.
      const paid = sale.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
      const unpaid = sale.total.gt(paid) ? sale.total.sub(paid) : new Prisma.Decimal(0);
      const reversedBefore = refundedBefore.lt(unpaid) ? refundedBefore : unpaid;
      const reversibleLeft = unpaid.sub(reversedBefore);
      const creditReversed = totalRefund.lt(reversibleLeft) ? totalRefund : reversibleLeft;
      const cashRefunded = totalRefund.sub(creditReversed);

      const returnNumber = `RET-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;

      const saleReturn = await tx.saleReturn.create({
        data: {
          businessId,
          saleId: sale.id,
          returnNumber,
          reason: dto.reason,
          totalRefund,
          creditReversed,
          cashRefunded,
          createdById: userId,
          items: {
            create: lines.map((l) => ({
              saleItemId: l.saleItemId,
              productId: l.productId,
              quantity: l.quantity,
              refundAmount: l.refundAmount,
            })),
          },
        },
        include: { items: true },
      });

      // Restock (only for tracked products)
      const products = await tx.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) }, businessId },
        select: { id: true, trackInventory: true },
      });
      const trackMap = new Map(products.map((p) => [p.id, p.trackInventory]));
      for (const l of lines) {
        if (!trackMap.get(l.productId)) continue;
        await tx.inventoryTransaction.create({
          data: {
            businessId,
            productId: l.productId,
            quantity: l.quantity,
            type: 'SALE_RETURN',
            referenceType: 'SALE_RETURN',
            referenceId: saleReturn.id,
            unitCost: l.unitCost,
            userId,
            reason: dto.reason,
          },
        });
      }

      // Customer debt reduced
      if (creditReversed.gt(0) && sale.customerId) {
        await tx.customerTransaction.create({
          data: {
            businessId,
            customerId: sale.customerId,
            type: 'RETURN',
            amount: creditReversed.neg(),
            referenceType: 'SALE_RETURN',
            referenceId: saleReturn.id,
            notes: dto.reason,
          },
        });
      }

      // Money handed back (cash drawer only if refunded in cash)
      if (cashRefunded.gt(0) && (await isCashMethod(tx, businessId, dto.refundPaymentMethodId))) {
        await recordCash(tx, businessId, {
          type: 'CASH_OUT',
          amount: cashRefunded,
          referenceType: 'SALE_RETURN',
          referenceId: saleReturn.id,
          notes: `Refund ${returnNumber}`,
        });
      }

      // Sale status: fully returned only when every item is fully returned
      const fullyReturned = sale.items.every((i) => {
        const done = (returnedSoFar.get(i.id) ?? new Prisma.Decimal(0)).add(
          lines.find((l) => l.saleItemId === i.id)?.quantity ?? new Prisma.Decimal(0),
        );
        return done.gte(i.quantity);
      });
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: fullyReturned ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED',
          ...(fullyReturned ? { paymentStatus: 'REFUNDED' as PaymentStatus } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'SALE_RETURN',
          entityType: 'SaleReturn',
          entityId: saleReturn.id,
          newValues: {
            returnNumber,
            totalRefund: totalRefund.toString(),
            creditReversed: creditReversed.toString(),
            cashRefunded: cashRefunded.toString(),
          },
        },
      });

      return saleReturn;
    }, TX_OPTIONS);
  }
}
