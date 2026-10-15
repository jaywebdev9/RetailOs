import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdjustStockDto, AdjustReason } from './dto/adjust-stock.dto';
import { InventoryTxnType, Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const membership = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!membership) throw new ForbiddenException('No access to this business');
    return membership;
  }

  async getCurrentStock(businessId: string, productId: string): Promise<number> {
    const result = await this.prisma.inventoryTransaction.aggregate({
      where: { businessId, productId },
      _sum: { quantity: true },
    });
    return result._sum.quantity?.toNumber() ?? 0;
  }

  async adjustStock(businessId: string, userId: string, dto: AdjustStockDto) {
    await this.assertMembership(businessId, userId);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (!product.trackInventory) {
      throw new BadRequestException('This product does not track inventory');
    }

    const typeMap: Record<AdjustReason, InventoryTxnType> = {
      DAMAGE: InventoryTxnType.DAMAGE,
      EXPIRED: InventoryTxnType.EXPIRED,
      LOSS: InventoryTxnType.LOSS,
      MANUAL_ADJUSTMENT: InventoryTxnType.MANUAL_ADJUSTMENT,
      COUNTING_ERROR: InventoryTxnType.MANUAL_ADJUSTMENT,
      OTHER: InventoryTxnType.MANUAL_ADJUSTMENT,
    };

    const txn = await this.prisma.inventoryTransaction.create({
      data: {
        businessId,
        productId: dto.productId,
        quantity: new Prisma.Decimal(dto.quantity),
        type: typeMap[dto.reason],
        referenceType: 'ADJUSTMENT',
        userId,
        reason: dto.reason,
        notes: dto.notes,
        unitCost: product.costPrice,
      },
    });

    // Audit
    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'INVENTORY_ADJUST',
        entityType: 'InventoryTransaction',
        entityId: txn.id,
        newValues: {
          productId: dto.productId,
          quantity: dto.quantity,
          reason: dto.reason,
        },
      },
    });

    const currentStock = await this.getCurrentStock(businessId, dto.productId);

    return {
      transaction: txn,
      currentStock,
    };
  }

  async getLowStock(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);

    // Get all active products with reorder levels
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        trackInventory: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderLevel: true,
        reorderQuantity: true,
        costPrice: true,
        sellingPrice: true,
      },
    });

    if (products.length === 0) return [];

    const stockAgg = await this.prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        businessId,
        productId: { in: products.map((p) => p.id) },
      },
      _sum: { quantity: true },
    });

    const stockMap = new Map(
      stockAgg.map((s) => [s.productId, s._sum.quantity?.toNumber() ?? 0]),
    );

    return products
      .map((p) => {
        const current = stockMap.get(p.id) ?? 0;
        const reorderLevel = p.reorderLevel.toNumber();
        return {
          ...p,
          currentStock: current,
          reorderLevel,
          isLow: current <= reorderLevel,
          suggestedOrder: p.reorderQuantity.toNumber(),
        };
      })
      .filter((p) => p.isLow)
      .sort((a, b) => a.currentStock - b.currentStock);
  }

  async startStockCount(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);

    const existing = await this.prisma.stockCount.findFirst({
      where: { businessId, status: 'IN_PROGRESS' },
    });
    if (existing) {
      throw new BadRequestException('A stock count is already in progress');
    }

    const products = await this.prisma.product.findMany({
      where: { businessId, status: 'ACTIVE', trackInventory: true },
      select: { id: true, name: true, sku: true },
    });

    const stockAgg = await this.prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        businessId,
        productId: { in: products.map((p) => p.id) },
      },
      _sum: { quantity: true },
    });
    const stockMap = new Map(
      stockAgg.map((s) => [s.productId, s._sum.quantity ?? new Prisma.Decimal(0)]),
    );

    const count = await this.prisma.stockCount.create({
      data: {
        businessId,
        startedById: userId,
        status: 'IN_PROGRESS',
        items: {
          create: products.map((p) => ({
            productId: p.id,
            expectedQuantity: stockMap.get(p.id) ?? new Prisma.Decimal(0),
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });

    return count;
  }

  async completeStockCount(
    businessId: string,
    userId: string,
    countId: string,
    dto: import('./dto/stock-count.dto').CompleteStockCountDto,
  ) {
    await this.assertMembership(businessId, userId);

    const count = await this.prisma.stockCount.findFirst({
      where: { id: countId, businessId, status: 'IN_PROGRESS' },
      include: { items: true },
    });
    if (!count) throw new NotFoundException('Active stock count not found');

    await this.prisma.$transaction(async (tx) => {
      for (const input of dto.items) {
        const item = count.items.find((i) => i.productId === input.productId);
        if (!item) continue;

        const physical = new Prisma.Decimal(input.physicalQuantity);
        const expected = item.expectedQuantity;
        const difference = physical.sub(expected);

        await tx.stockCountItem.update({
          where: { id: item.id },
          data: {
            physicalQuantity: physical,
            difference,
            reason: input.reason,
            notes: input.notes,
          },
        });

        if (!difference.eq(0)) {
          if (Math.abs(difference.toNumber()) >= 1 && !input.reason) {
            throw new BadRequestException(
              `Reason required for significant variance on product ${input.productId}`,
            );
          }

          await tx.inventoryTransaction.create({
            data: {
              businessId,
              productId: input.productId,
              quantity: difference,
              type: 'STOCK_COUNT_ADJUSTMENT',
              referenceType: 'STOCK_COUNT',
              referenceId: countId,
              userId,
              reason: input.reason || 'Stock count adjustment',
              notes: input.notes,
            },
          });
        }
      }

      await tx.stockCount.update({
        where: { id: countId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'STOCK_COUNT_COMPLETE',
          entityType: 'StockCount',
          entityId: countId,
        },
      });
    });

    return this.prisma.stockCount.findUnique({
      where: { id: countId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
  }

  async getActiveStockCount(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);
    return this.prisma.stockCount.findFirst({
      where: { businessId, status: 'IN_PROGRESS' },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
  }
}
