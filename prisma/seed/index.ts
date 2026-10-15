/**
 * Development seed only — never run against production with real data.
 * Creates a demo owner, business, products, supplier for local testing.
 */
import { PrismaClient, BusinessType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding development data...');

  const passwordHash = await bcrypt.hash('DemoPass123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@retailos.local' },
    update: {},
    create: {
      email: 'demo@retailos.local',
      phone: '+255700000001',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Owner',
      isEmailVerified: true,
    },
  });

  // Permissions
  const permCodes = [
    'products.view', 'products.create', 'products.update',
    'inventory.view', 'inventory.adjust', 'inventory.count',
    'sales.view', 'sales.create', 'sales.refund', 'sales.void', 'sales.override_price',
    'purchases.view', 'purchases.create', 'purchases.receive',
    'customers.view', 'customers.create', 'customers.credit', 'customers.payment',
    'suppliers.view', 'suppliers.create', 'suppliers.payment',
    'expenses.view', 'expenses.create',
    'reports.view', 'finance.view',
    'users.manage', 'settings.manage',
  ];

  for (const code of permCodes) {
    const [module] = code.split('.');
    await prisma.permission.upsert({
      where: { code },
      create: { code, name: code, module },
      update: {},
    });
  }

  let business = await prisma.business.findFirst({
    where: { name: 'Demo Mama Shop' },
  });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'Demo Mama Shop',
        businessType: BusinessType.GROCERY,
        currency: 'TZS',
        timezone: 'Africa/Dar_es_Salaam',
        phone: '+255700000001',
      },
    });

    const ownerRole = await prisma.role.create({
      data: {
        businessId: business.id,
        name: 'Owner',
        description: 'Full access',
        isSystem: true,
      },
    });

    const allPerms = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: allPerms.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })),
    });

    await prisma.businessMember.create({
      data: {
        businessId: business.id,
        userId: user.id,
        roleId: ownerRole.id,
        isOwner: true,
      },
    });

    // Payment methods
    const pms = [
      { name: 'Cash', code: 'CASH', sortOrder: 1 },
      { name: 'M-Pesa', code: 'MPESA', sortOrder: 2 },
      { name: 'Airtel Money', code: 'AIRTEL', sortOrder: 3 },
      { name: 'Credit', code: 'CREDIT', sortOrder: 6 },
    ];
    await prisma.paymentMethod.createMany({
      data: pms.map((pm) => ({ businessId: business!.id, ...pm, isSystem: true })),
    });

    // Expense categories
    for (const name of ['Rent', 'Electricity', 'Transport', 'Salary', 'Other']) {
      await prisma.expenseCategory.create({
        data: { businessId: business.id, name, isSystem: true },
      });
    }

    // Units
    for (const u of [
      { name: 'Piece', symbol: 'pcs' },
      { name: 'Kilogram', symbol: 'kg' },
    ]) {
      await prisma.unit.create({ data: { businessId: business.id, ...u } });
    }

    const unit = await prisma.unit.findFirst({ where: { businessId: business.id } });

    // Products
    const products = [
      { name: 'Sugar 1kg', sku: 'SUG-1KG', costPrice: 2300, sellingPrice: 2800, reorderLevel: 20 },
      { name: 'Rice 1kg', sku: 'RICE-1KG', costPrice: 1800, sellingPrice: 2200, reorderLevel: 30 },
      { name: 'Cooking Oil 1L', sku: 'OIL-1L', costPrice: 4500, sellingPrice: 5500, reorderLevel: 15 },
      { name: 'Soap Bar', sku: 'SOAP-01', costPrice: 800, sellingPrice: 1200, reorderLevel: 50 },
    ];

    for (const p of products) {
      await prisma.product.create({
        data: {
          businessId: business.id,
          name: p.name,
          sku: p.sku,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          reorderLevel: p.reorderLevel,
          unitId: unit?.id,
        },
      });
    }

    // Supplier
    await prisma.supplier.create({
      data: {
        businessId: business.id,
        name: 'Kilimanjaro Distributors',
        phone: '+255711111111',
      },
    });

    console.log('✅ Demo business created');
  } else {
    console.log('ℹ️  Demo business already exists');
  }

  // Platform owner: the account that confirms subscription payments (set PLATFORM_ADMIN_EMAIL in .env)
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (adminEmail) {
    const res = await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { isPlatformAdmin: true },
    });
    console.log(res.count ? `✅ ${adminEmail} is now platform admin` : `ℹ️  No user with email ${adminEmail} yet (register first, then re-run the seed)`);
  }

  console.log('');
  console.log('Login credentials:');
  console.log('  Email:    demo@retailos.local');
  console.log('  Password: DemoPass123!');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
