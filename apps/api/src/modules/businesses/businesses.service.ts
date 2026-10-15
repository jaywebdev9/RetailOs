import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createSubscriptionForBusiness } from '../../common/trial';
import { PrismaService } from '../../database/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { BusinessType } from '@prisma/client';

const DEFAULT_PERMISSIONS = [
  { code: 'products.view', name: 'View products', module: 'products' },
  { code: 'products.create', name: 'Create products', module: 'products' },
  { code: 'products.update', name: 'Update products', module: 'products' },
  { code: 'inventory.view', name: 'View inventory', module: 'inventory' },
  { code: 'inventory.adjust', name: 'Adjust inventory', module: 'inventory' },
  { code: 'inventory.count', name: 'Perform stock counts', module: 'inventory' },
  { code: 'sales.view', name: 'View sales', module: 'sales' },
  { code: 'sales.create', name: 'Create sales', module: 'sales' },
  { code: 'sales.refund', name: 'Process refunds', module: 'sales' },
  { code: 'sales.void', name: 'Void sales', module: 'sales' },
  { code: 'sales.override_price', name: 'Sell below minimum price', module: 'sales' },
  { code: 'purchases.view', name: 'View purchases', module: 'purchases' },
  { code: 'purchases.create', name: 'Create purchases', module: 'purchases' },
  { code: 'purchases.receive', name: 'Receive stock', module: 'purchases' },
  { code: 'customers.view', name: 'View customers', module: 'customers' },
  { code: 'customers.create', name: 'Create customers', module: 'customers' },
  { code: 'customers.credit', name: 'Manage customer credit', module: 'customers' },
  { code: 'customers.payment', name: 'Record customer payments', module: 'customers' },
  { code: 'suppliers.view', name: 'View suppliers', module: 'suppliers' },
  { code: 'suppliers.create', name: 'Create suppliers', module: 'suppliers' },
  { code: 'suppliers.payment', name: 'Record supplier payments', module: 'suppliers' },
  { code: 'expenses.view', name: 'View expenses', module: 'expenses' },
  { code: 'expenses.create', name: 'Create expenses', module: 'expenses' },
  { code: 'reports.view', name: 'View reports', module: 'reports' },
  { code: 'finance.view', name: 'View finance', module: 'finance' },
  { code: 'users.manage', name: 'Manage users', module: 'users' },
  { code: 'settings.manage', name: 'Manage settings', module: 'settings' },
];

const SYSTEM_ROLES = [
  {
    name: 'Owner',
    description: 'Full access to all features',
    isSystem: true,
    permissions: DEFAULT_PERMISSIONS.map((p) => p.code),
  },
  {
    name: 'Manager',
    description: 'Operational control with most permissions',
    isSystem: true,
    permissions: DEFAULT_PERMISSIONS.filter(
      (p) => !['users.manage'].includes(p.code),
    ).map((p) => p.code),
  },
  {
    name: 'Cashier',
    description: 'POS and basic sales operations',
    isSystem: true,
    permissions: ['sales.view', 'sales.create', 'products.view', 'customers.view', 'customers.create'],
  },
  {
    name: 'Stock Keeper',
    description: 'Inventory receiving, counting and movements',
    isSystem: true,
    permissions: [
      'products.view',
      'inventory.view',
      'inventory.adjust',
      'inventory.count',
      'purchases.view',
      'purchases.receive',
    ],
  },
];

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBusinessDto) {
    // Ensure global permissions exist
    for (const perm of DEFAULT_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code: perm.code },
        create: perm,
        update: {},
      });
    }

    const business = await this.prisma.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          name: dto.name,
          businessType: dto.businessType as BusinessType,
          currency: dto.currency || 'TZS',
          timezone: dto.timezone || 'Africa/Dar_es_Salaam',
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
        },
      });

      // Create system roles
      const roleMap: Record<string, string> = {};
      for (const roleDef of SYSTEM_ROLES) {
        const role = await tx.role.create({
          data: {
            businessId: biz.id,
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
          },
        });
        roleMap[roleDef.name] = role.id;

        const perms = await tx.permission.findMany({
          where: { code: { in: roleDef.permissions } },
        });

        if (perms.length > 0) {
          await tx.rolePermission.createMany({
            data: perms.map((p) => ({
              roleId: role.id,
              permissionId: p.id,
            })),
          });
        }
      }

      // Add creator as Owner
      await tx.businessMember.create({
        data: {
          businessId: biz.id,
          userId,
          roleId: roleMap['Owner'],
          isOwner: true,
        },
      });

      // 14-day free trial (once per person)
      await createSubscriptionForBusiness(tx, {
        businessId: biz.id,
        userId,
        businessPhone: dto.phone,
      });

      // Default payment methods
      const paymentMethods = [
        { name: 'Cash', code: 'CASH', isSystem: true, sortOrder: 1 },
        { name: 'M-Pesa', code: 'MPESA', isSystem: true, sortOrder: 2 },
        { name: 'Airtel Money', code: 'AIRTEL', isSystem: true, sortOrder: 3 },
        { name: 'Tigo Pesa / Yas', code: 'TIGO', isSystem: true, sortOrder: 4 },
        { name: 'Bank Transfer', code: 'BANK', isSystem: true, sortOrder: 5 },
        { name: 'Credit', code: 'CREDIT', isSystem: true, sortOrder: 6 },
        { name: 'Other', code: 'OTHER', isSystem: true, sortOrder: 99 },
      ];

      await tx.paymentMethod.createMany({
        data: paymentMethods.map((pm) => ({
          businessId: biz.id,
          ...pm,
        })),
      });

      // Default expense categories
      const expenseCats = [
        'Rent',
        'Electricity',
        'Transport',
        'Salary',
        'Internet',
        'Packaging',
        'Maintenance',
        'Bank Charges',
        'Miscellaneous',
        'Other',
      ];

      await tx.expenseCategory.createMany({
        data: expenseCats.map((name) => ({
          businessId: biz.id,
          name,
          isSystem: true,
        })),
      });

      // Default units
      const units = [
        { name: 'Piece', symbol: 'pcs' },
        { name: 'Kilogram', symbol: 'kg' },
        { name: 'Liter', symbol: 'L' },
        { name: 'Pack', symbol: 'pk' },
        { name: 'Box', symbol: 'box' },
        { name: 'Dozen', symbol: 'dz' },
      ];

      await tx.unit.createMany({
        data: units.map((u) => ({
          businessId: biz.id,
          ...u,
        })),
      });

      return biz;
    });

    return business;
  }

  async findOne(businessId: string, userId: string) {
    const membership = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this business');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async listForUser(userId: string) {
    return this.prisma.businessMember.findMany({
      where: { userId, isActive: true },
      include: {
        business: true,
        role: true,
      },
    });
  }
}
