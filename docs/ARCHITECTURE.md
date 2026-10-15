# Architecture

## Overview

Modular monolith with clear domain boundaries.

```
Browser (Next.js + Dexie offline)
        │
        ▼
   NestJS API (/api/v1)
        │
   ┌────┼────┬────────┬──────────┐
   ▼    ▼    ▼        ▼          ▼
Postgres Redis BullMQ  Object Storage
```

## Repository layout

```
retail-os/
├── apps/
│   ├── api/                 # NestJS backend
│   │   └── src/
│   │       ├── config/      # Environment configuration
│   │       ├── common/      # Shared guards, filters, decorators (as needed)
│   │       ├── database/    # Prisma module & service
│   │       ├── modules/     # Domain modules
│   │       │   ├── auth/
│   │       │   ├── users/
│   │       │   ├── businesses/
│   │       │   ├── products/
│   │       │   └── inventory/
│   │       ├── main.ts
│   │       └── app.module.ts
│   └── web/                 # Next.js frontend
│       └── src/
│           ├── app/         # App Router pages
│           ├── components/  # Shared UI
│           ├── features/    # Feature-owned code (future)
│           ├── lib/         # Infrastructure (API client, etc.)
│           ├── hooks/
│           ├── stores/
│           └── types/
├── packages/                # Shared packages (created when genuinely needed)
├── prisma/                  # Schema, migrations, seed
├── docs/
├── docker-compose.yml
└── package.json
```

## Multi-tenancy

Every business-owned record carries `businessId`.  
Service layer always filters by the authenticated user's active business membership.

## Inventory

Source of truth = `inventory_transactions` ledger.  
Current stock = `SUM(quantity)` for a product.  
No denormalized `stock` column that can drift.

## Money

All monetary values use `Decimal(19,4)`.  
Never use JavaScript `number` for currency calculations.

## Offline POS

1. Sale created with client-generated UUID (`clientTransactionId`).
2. Stored in IndexedDB queue.
3. On reconnect, POST with same ID.
4. Server is idempotent on `(businessId, clientTransactionId)`.

## Auth

- Access JWT (15 min)
- Refresh token (7 days, rotated, hashed in DB)
- RBAC via Role → Permission

## Dependency rules

**Backend**
```
Controller → Service → Prisma (DatabaseModule)
Module A may import only the public Module/Service of Module B
No deep imports into another module's internals
```

**Frontend**
```
Page / Feature → hooks / services → lib/api
No business rules inside pure UI components
```

**Shared packages**
```
apps → packages   (allowed)
packages → apps   (forbidden)
```

## Extension points (not implemented yet)

- Multi-branch
- WhatsApp / SMS notifications
- Fiscal / TRA integration
- Subscription billing
- Mobile native apps
