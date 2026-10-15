import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMembership(businessId: string, userId: string) {
    const membership = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenException('No access to this business');
    }
    return membership;
  }

  async create(businessId: string, userId: string, dto: CreateProductDto) {
    await this.assertMembership(businessId, userId);

    if (dto.sku) {
      const existing = await this.prisma.product.findUnique({
        where: { businessId_sku: { businessId, sku: dto.sku } },
      });
      if (existing) throw new ConflictException('SKU already exists');
    }

    if (dto.barcode) {
      const existing = await this.prisma.product.findUnique({
        where: { businessId_barcode: { businessId, barcode: dto.barcode } },
      });
      if (existing) throw new ConflictException('Barcode already exists');
    }

    return this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        categoryId: dto.categoryId,
        unitId: dto.unitId,
        description: dto.description,
        costPrice: new Prisma.Decimal(dto.costPrice),
        sellingPrice: new Prisma.Decimal(dto.sellingPrice),
        minimumSellingPrice: dto.minimumSellingPrice
          ? new Prisma.Decimal(dto.minimumSellingPrice)
          : null,
        wholesalePrice:
          dto.wholesalePrice != null ? new Prisma.Decimal(dto.wholesalePrice) : null,
        wholesaleMinQty:
          dto.wholesaleMinQty != null ? new Prisma.Decimal(dto.wholesaleMinQty) : null,
        reorderLevel: new Prisma.Decimal(dto.reorderLevel ?? 0),
        reorderQuantity: new Prisma.Decimal(dto.reorderQuantity ?? 0),
        trackInventory: dto.trackInventory ?? true,
        allowNegativeStock: dto.allowNegativeStock ?? false,
      },
      include: {
        category: true,
        unit: true,
        packs: { where: { isActive: true } },
      },
    });
  }

  async findAll(
    businessId: string,
    userId: string,
    opts: { search?: string; status?: string; page?: number; limit?: number } = {},
  ) {
    await this.assertMembership(businessId, userId);

    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      businessId,
      status: (opts.status as any) || 'ACTIVE',
    };

    if (opts.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { sku: { contains: opts.search, mode: 'insensitive' } },
        { barcode: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, unit: true, packs: { where: { isActive: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Attach current stock from ledger
    const productIds = items.map((p) => p.id);
    const stockAgg = await this.prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: { businessId, productId: { in: productIds } },
      _sum: { quantity: true },
    });
    const stockMap = new Map(
      stockAgg.map((s) => [s.productId, s._sum.quantity?.toNumber() ?? 0]),
    );

    return {
      items: items.map((p) => ({
        ...p,
        currentStock: stockMap.get(p.id) ?? 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(businessId: string, userId: string, productId: string) {
    await this.assertMembership(businessId, userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
      include: { category: true, unit: true, packs: { where: { isActive: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');

    const stock = await this.prisma.inventoryTransaction.aggregate({
      where: { businessId, productId },
      _sum: { quantity: true },
    });

    return {
      ...product,
      currentStock: stock._sum.quantity?.toNumber() ?? 0,
    };
  }

  async getStockMovements(
    businessId: string,
    userId: string,
    productId: string,
    opts: { page?: number; limit?: number } = {},
  ) {
    await this.assertMembership(businessId, userId);

    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where: { businessId, productId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.inventoryTransaction.count({
        where: { businessId, productId },
      }),
    ]);

    return { items, total, page, limit };
  }

  async update(businessId: string, userId: string, productId: string, dto: import('./dto/update-product.dto').UpdateProductDto) {
    await this.assertMembership(businessId, userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await this.prisma.product.findUnique({
        where: { businessId_sku: { businessId, sku: dto.sku } },
      });
      if (existing) throw new ConflictException('SKU already exists');
    }

    if (dto.barcode && dto.barcode !== product.barcode) {
      const existing = await this.prisma.product.findUnique({
        where: { businessId_barcode: { businessId, barcode: dto.barcode } },
      });
      if (existing) throw new ConflictException('Barcode already exists');
    }

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.costPrice !== undefined) data.costPrice = new Prisma.Decimal(dto.costPrice);
    if (dto.sellingPrice !== undefined) data.sellingPrice = new Prisma.Decimal(dto.sellingPrice);
    if (dto.minimumSellingPrice !== undefined) {
      data.minimumSellingPrice = new Prisma.Decimal(dto.minimumSellingPrice);
    }
    if (dto.wholesalePrice !== undefined) {
      data.wholesalePrice = dto.wholesalePrice === null ? null : new Prisma.Decimal(dto.wholesalePrice);
    }
    if (dto.wholesaleMinQty !== undefined) {
      data.wholesaleMinQty = dto.wholesaleMinQty === null ? null : new Prisma.Decimal(dto.wholesaleMinQty);
    }
    if (dto.reorderLevel !== undefined) data.reorderLevel = new Prisma.Decimal(dto.reorderLevel);
    if (dto.reorderQuantity !== undefined) data.reorderQuantity = new Prisma.Decimal(dto.reorderQuantity);
    if (dto.trackInventory !== undefined) data.trackInventory = dto.trackInventory;
    if (dto.allowNegativeStock !== undefined) data.allowNegativeStock = dto.allowNegativeStock;
    if (dto.status !== undefined) data.status = dto.status as any;
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.unitId !== undefined) {
      data.unit = dto.unitId ? { connect: { id: dto.unitId } } : { disconnect: true };
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data,
      include: { category: true, unit: true, packs: { where: { isActive: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'PRODUCT_UPDATE',
        entityType: 'Product',
        entityId: productId,
        oldValues: { name: product.name, status: product.status },
        newValues: dto as any,
      },
    });

    return updated;
  }

  async archive(businessId: string, userId: string, productId: string) {
    return this.update(businessId, userId, productId, { status: 'ARCHIVED' as any });
  }

  async restore(businessId: string, userId: string, productId: string) {
    return this.update(businessId, userId, productId, { status: 'ACTIVE' as any });
  }

  /**
   * CSV import — expects header row:
   * name,sku,barcode,costPrice,sellingPrice,reorderLevel
   */
  async importCsv(businessId: string, userId: string, csvContent: string) {
    await this.assertMembership(businessId, userId);

    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must include a header and at least one data row');
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const required = ['name', 'costprice', 'sellingprice'];
    for (const r of required) {
      if (!header.includes(r)) {
        throw new BadRequestException(`Missing required column: ${r}`);
      }
    }

    const idx = (col: string) => header.indexOf(col);
    const results: { row: number; status: 'created' | 'error'; message?: string; name?: string }[] = [];
    let created = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      try {
        const name = cols[idx('name')];
        const costPrice = Number(cols[idx('costprice')]);
        const sellingPrice = Number(cols[idx('sellingprice')]);
        if (!name || Number.isNaN(costPrice) || Number.isNaN(sellingPrice)) {
          throw new Error('Invalid name or prices');
        }
        const sku = idx('sku') >= 0 ? cols[idx('sku')] || undefined : undefined;
        const barcode = idx('barcode') >= 0 ? cols[idx('barcode')] || undefined : undefined;
        const reorderLevel =
          idx('reorderlevel') >= 0 ? Number(cols[idx('reorderlevel')]) || 0 : 0;

        await this.create(businessId, userId, {
          name,
          sku,
          barcode,
          costPrice,
          sellingPrice,
          reorderLevel,
        });
        created++;
        results.push({ row: i + 1, status: 'created', name });
      } catch (err: any) {
        results.push({
          row: i + 1,
          status: 'error',
          message: err.message || 'Failed',
        });
      }
    }

    return { created, failed: results.filter((r) => r.status === 'error').length, results };
  }

  async addPack(
    businessId: string,
    userId: string,
    productId: string,
    dto: import('./dto/product-pack.dto').CreateProductPackDto,
  ) {
    await this.assertMembership(businessId, userId);
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.productPack.findUnique({
      where: { productId_name: { productId, name: dto.name } },
    });
    if (existing && existing.isActive) throw new ConflictException('A pack with this name already exists');

    const data = {
      factor: new Prisma.Decimal(dto.factor),
      retailPrice: dto.retailPrice != null ? new Prisma.Decimal(dto.retailPrice) : null,
      wholesalePrice: dto.wholesalePrice != null ? new Prisma.Decimal(dto.wholesalePrice) : null,
      barcode: dto.barcode,
      isActive: true,
    };
    // Re-adding a removed pack revives it (keeps old sales/purchases pointing at the same row)
    const pack = existing
      ? await this.prisma.productPack.update({ where: { id: existing.id }, data })
      : await this.prisma.productPack.create({
          data: { businessId, productId, name: dto.name, ...data },
        });

    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'PRODUCT_PACK_ADD',
        entityType: 'ProductPack',
        entityId: pack.id,
        newValues: { productId, name: dto.name, factor: dto.factor },
      },
    });
    return pack;
  }

  async removePack(businessId: string, userId: string, productId: string, packId: string) {
    await this.assertMembership(businessId, userId);
    const pack = await this.prisma.productPack.findFirst({
      where: { id: packId, productId, businessId },
    });
    if (!pack) throw new NotFoundException('Pack not found');
    return this.prisma.productPack.update({ where: { id: packId }, data: { isActive: false } });
  }
}
