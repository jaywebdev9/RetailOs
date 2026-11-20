import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';

const PRODUCT_STATUSES = ['ACTIVE', 'ARCHIVED', 'DISCONTINUED'];

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

    // Default stays ACTIVE (unchanged). An unknown value is a clear 400, not a database error.
    if (opts.status && !PRODUCT_STATUSES.includes(opts.status)) {
      throw new BadRequestException('Invalid product status filter');
    }

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

  /** Categories and units of this business, for the product edit form. Read-only. */
  async catalogOptions(businessId: string, userId: string) {
    await this.assertMembership(businessId, userId);
    const [categories, units] = await Promise.all([
      this.prisma.category.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.unit.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, symbol: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { categories, units };
  }

  /** '' / whitespace / null clears an optional text field; undefined leaves it untouched. */
  private optionalText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private async assertUnique(
    businessId: string,
    productId: string,
    field: 'sku' | 'barcode',
    value: string,
  ) {
    const existing = await this.prisma.product.findFirst({
      where: { businessId, [field]: value, NOT: { id: productId } },
      select: { id: true, status: true },
    });
    if (existing) {
      const label = field === 'sku' ? 'SKU' : 'Barcode';
      throw new ConflictException(
        existing.status === 'ACTIVE'
          ? `${label} already exists`
          : `${label} already exists (used by an archived product)`,
      );
    }
  }

  async update(businessId: string, userId: string, productId: string, dto: UpdateProductDto) {
    await this.assertMembership(businessId, userId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // JSON can carry null even though the DTO types say optional: handle it explicitly
    // so a null never reaches `new Prisma.Decimal(null)` (which would be a 500).
    const raw = dto as Record<string, any>;
    const requiredFields = ['costPrice', 'sellingPrice', 'reorderLevel', 'reorderQuantity'];
    for (const f of requiredFields) {
      if (raw[f] === null) throw new BadRequestException(`${f} cannot be empty`);
    }
    for (const f of ['trackInventory', 'allowNegativeStock', 'status']) {
      if (raw[f] === null) throw new BadRequestException(`${f} cannot be empty`);
    }

    if (dto.name !== undefined) {
      if (raw.name === null || String(dto.name).trim() === '') {
        throw new BadRequestException('Product name cannot be empty');
      }
    }

    const sku = this.optionalText(dto.sku);
    const barcode = this.optionalText(dto.barcode);
    const description = this.optionalText(dto.description);

    if (sku && sku !== product.sku) {
      await this.assertUnique(businessId, productId, 'sku', sku);
    }
    if (barcode && barcode !== product.barcode) {
      await this.assertUnique(businessId, productId, 'barcode', barcode);
    }

    // Category / unit must belong to the same business (never trust a bare id from the client)
    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, businessId },
        select: { id: true },
      });
      if (!cat) throw new BadRequestException('Category not found');
    }
    if (dto.unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: { id: dto.unitId, businessId },
        select: { id: true },
      });
      if (!unit) throw new BadRequestException('Unit not found');
    }

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (sku !== undefined) data.sku = sku;
    if (barcode !== undefined) data.barcode = barcode;
    if (description !== undefined) data.description = description;
    if (dto.costPrice !== undefined) data.costPrice = new Prisma.Decimal(dto.costPrice);
    if (dto.sellingPrice !== undefined) data.sellingPrice = new Prisma.Decimal(dto.sellingPrice);
    if (dto.minimumSellingPrice !== undefined) {
      data.minimumSellingPrice =
        raw.minimumSellingPrice === null ? null : new Prisma.Decimal(dto.minimumSellingPrice);
    }
    if (dto.wholesalePrice !== undefined) {
      data.wholesalePrice = raw.wholesalePrice === null ? null : new Prisma.Decimal(dto.wholesalePrice);
    }
    if (dto.wholesaleMinQty !== undefined) {
      data.wholesaleMinQty = raw.wholesaleMinQty === null ? null : new Prisma.Decimal(dto.wholesaleMinQty);
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

    let updated;
    try {
      updated = await this.prisma.product.update({
        where: { id: productId },
        data,
        include: { category: true, unit: true, packs: { where: { isActive: true } } },
      });
    } catch (err: any) {
      // Two requests racing for the same SKU/barcode: the DB unique index is the last line of defence
      if (err?.code === 'P2002') {
        throw new ConflictException('SKU or barcode already exists');
      }
      throw err;
    }

    // Audit: previous values of exactly the fields that were sent (money fields as strings)
    const oldValues: Record<string, unknown> = { name: product.name, status: product.status };
    for (const key of Object.keys(raw)) {
      const before = (product as Record<string, any>)[key];
      if (before !== undefined) {
        oldValues[key] = before instanceof Prisma.Decimal ? before.toString() : before;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'PRODUCT_UPDATE',
        entityType: 'Product',
        entityId: productId,
        oldValues: oldValues as any,
        newValues: dto as any,
      },
    });

    return updated;
  }

  async delete(businessId: string, userId: string, productId: string) {
    await this.assertMembership(businessId, userId);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, businessId },
      });

      if (!product) throw new NotFoundException('Product not found');

      const [
        sales,
        purchases,
        movements,
        stockCounts,
        returns,
      ] = await Promise.all([
        tx.saleItem.count({ where: { productId } }),
        tx.purchaseItem.count({ where: { productId } }),
        tx.inventoryTransaction.count({ where: { businessId, productId } }),
        tx.stockCountItem.count({ where: { productId } }),
        tx.saleReturnItem.count({ where: { productId } }),
      ]);

      if (sales + purchases + movements + stockCounts + returns > 0) {
        throw new ConflictException(
          'This product has transaction history and cannot be permanently deleted. Archive it instead.',
        );
      }

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'PRODUCT_DELETE',
          entityType: 'Product',
          entityId: productId,
          oldValues: {
            name: product.name,
            sku: product.sku,
            status: product.status,
          },
        },
      });

      await tx.product.delete({
        where: { id: productId },
      });

      return { success: true, message: 'Product deleted successfully' };
    });
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
