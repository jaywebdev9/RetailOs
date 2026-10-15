import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseDto, ReceivePurchaseDto } from './dto/create-purchase.dto';
import { Prisma, PurchaseStatus } from '@prisma/client';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const m = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!m) throw new ForbiddenException('No access to this business');
  }

  private async nextPurchaseNumber(businessId: string): Promise<string> {
    const count = await this.prisma.purchase.count({ where: { businessId } });
    return `PO-${String(count + 1).padStart(6, '0')}`;
  }

  async create(businessId: string, userId: string, dto: CreatePurchaseDto) {
    await this.assertMembership(businessId, userId);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Products and packs must belong to this business
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const productCount = await this.prisma.product.count({
      where: { id: { in: productIds }, businessId },
    });
    if (productCount !== productIds.length) {
      throw new BadRequestException('One or more products not found');
    }
    const packIds = [...new Set(dto.items.map((i) => i.packId).filter(Boolean) as string[])];
    const packs = packIds.length
      ? await this.prisma.productPack.findMany({
          where: { id: { in: packIds }, businessId, isActive: true },
        })
      : [];
    if (packs.length !== packIds.length) throw new BadRequestException('Invalid pack');
    const packMap = new Map(packs.map((p) => [p.id, p]));

    let subtotal = new Prisma.Decimal(0);
    const items = dto.items.map((i) => {
      const pack = i.packId ? packMap.get(i.packId) : undefined;
      if (i.packId && (!pack || pack.productId !== i.productId)) {
        throw new BadRequestException('Pack does not belong to the product');
      }
      // Stock is always kept in base units; cost is stored per base unit
      const enteredQty = new Prisma.Decimal(i.quantityOrdered);
      const enteredCost = new Prisma.Decimal(i.unitCost);
      const qty = pack ? enteredQty.mul(pack.factor) : enteredQty;
      const cost = pack ? enteredCost.div(pack.factor).toDecimalPlaces(4) : enteredCost;
      const total = enteredQty.mul(enteredCost);
      subtotal = subtotal.add(total);
      return {
        productId: i.productId,
        quantityOrdered: qty,
        quantityReceived: new Prisma.Decimal(0),
        unitCost: cost,
        total,
        packName: pack?.name,
        packQuantity: pack ? enteredQty : undefined,
      };
    });

    const purchase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          businessId,
          supplierId: dto.supplierId,
          purchaseNumber: await this.nextPurchaseNumber(businessId),
          status: PurchaseStatus.ORDERED,
          subtotal,
          total: subtotal,
          notes: dto.notes,
          createdById: userId,
          items: { create: items },
        },
        include: { items: true, supplier: true },
      });

      // NOTE: the supplier debt is booked when stock is RECEIVED, not when it is ordered.

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'PURCHASE_CREATE',
          entityType: 'Purchase',
          entityId: created.id,
          newValues: { purchaseNumber: created.purchaseNumber, total: subtotal.toString() },
        },
      });

      return created;
    });

    return purchase;
  }

  async receive(businessId: string, userId: string, purchaseId: string, dto: ReceivePurchaseDto) {
    await this.assertMembership(businessId, userId);

    const purchase = await this.prisma.purchase.findFirst({
      where: { id: purchaseId, businessId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status === 'CANCELLED' || purchase.status === 'RECEIVED') {
      throw new BadRequestException(`Cannot receive stock for status ${purchase.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      let receivedValue = new Prisma.Decimal(0);
      for (const recv of dto.items) {
        const item = purchase.items.find((i) => i.id === recv.purchaseItemId);
        if (!item) throw new BadRequestException(`Item ${recv.purchaseItemId} not on this purchase`);

        const already = item.quantityReceived;
        const ordered = item.quantityOrdered;
        const incoming = new Prisma.Decimal(recv.quantityReceived);
        const newReceived = already.add(incoming);

        if (newReceived.gt(ordered)) {
          throw new BadRequestException(
            `Cannot receive more than ordered for item ${item.id}`,
          );
        }

        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { quantityReceived: newReceived },
        });

        // Weighted average cost: (oldQty × oldAvg + newQty × newCost) / (oldQty + newQty)
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { costPrice: true, trackInventory: true },
        });
        const stockAgg = await tx.inventoryTransaction.aggregate({
          where: { businessId, productId: item.productId },
          _sum: { quantity: true },
        });
        const oldQty = stockAgg._sum.quantity ?? new Prisma.Decimal(0);
        const oldAvg = product?.costPrice ?? new Prisma.Decimal(0);
        const newAvg = oldQty.gt(0)
          ? oldQty.mul(oldAvg).add(incoming.mul(item.unitCost)).div(oldQty.add(incoming))
          : item.unitCost;

        // Inventory ledger: stock in
        await tx.inventoryTransaction.create({
          data: {
            businessId,
            productId: item.productId,
            quantity: incoming,
            type: 'PURCHASE_RECEIVED',
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            unitCost: item.unitCost,
            userId,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: newAvg.toDecimalPlaces(4) },
        });

        receivedValue = receivedValue.add(incoming.mul(item.unitCost));
      }

      // Recalculate overall status
      const updatedItems = await tx.purchaseItem.findMany({
        where: { purchaseId },
      });
      const allReceived = updatedItems.every((i) =>
        i.quantityReceived.gte(i.quantityOrdered),
      );
      const anyReceived = updatedItems.some((i) => i.quantityReceived.gt(0));

      const newStatus = allReceived
        ? PurchaseStatus.RECEIVED
        : anyReceived
          ? PurchaseStatus.PARTIALLY_RECEIVED
          : purchase.status;

      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: newStatus },
      });

      const receipt = await tx.purchaseReceipt.create({
        data: {
          purchaseId,
          receivedById: userId,
          notes: `Received ${dto.items.length} line(s)`,
        },
      });

      // Supplier ledger: we owe more for what was actually received
      if (receivedValue.gt(0)) {
        await tx.supplierTransaction.create({
          data: {
            businessId,
            supplierId: purchase.supplierId,
            type: 'PURCHASE',
            amount: receivedValue,
            referenceType: 'PURCHASE_RECEIPT',
            referenceId: receipt.id,
            notes: purchase.purchaseNumber,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'PURCHASE_RECEIVE',
          entityType: 'Purchase',
          entityId: purchaseId,
          newValues: { status: newStatus, items: dto.items },
        },
      });
    });

    return this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { items: { include: { product: true } }, supplier: true, receipts: true },
    });
  }

  async findAll(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);
    return this.prisma.purchase.findMany({
      where: { businessId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(businessId: string, userId: string, id: string) {
    await this.assertMembership(businessId, userId);
    const p = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: {
        items: { include: { product: true } },
        supplier: true,
        receipts: true,
      },
    });
    if (!p) throw new NotFoundException('Purchase not found');
    return p;
  }
}
