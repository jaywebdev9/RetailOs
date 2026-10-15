# Retail OS

**Production-grade Retail & Wholesale Business Operating System** for small and medium-sized shops.

Designed first for Tanzania / Africa, architected for global scale.

## What it solves

- Real-time stock visibility & stockout prevention
- Fast POS (online + offline)
- Purchasing & supplier balances
- Customer credit tracking
- Expense & cash management
- Accurate profit (Revenue − COGS − Expenses)
- Smart alerts & reorder recommendations
- Full audit trail

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Next.js 15, TypeScript, Tailwind, TanStack Query, Dexie |
| Backend    | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Auth       | JWT + rotating refresh tokens, RBAC |
| Infra      | Docker, S3-compatible storage       |

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### 1. Install

```bash
cd retail-os
cp .env.example .env
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

### 3. Database

```bash
npx prisma generate --schema=./prisma/schema.prisma
npx prisma migrate dev --name init --schema=./prisma/schema.prisma
```

### 4. Run apps

```bash
npm run dev:api   # http://localhost:3001  (Swagger: /api/docs)
npm run dev:web   # http://localhost:3000
```

## Project Structure

```
retail-os/
├── apps/
│   ├── api/          # NestJS – config, database, modules/*
│   └── web/          # Next.js – app, components, features, lib
├── packages/         # Shared code (when needed)
├── prisma/           # Schema + migrations + seed
├── docs/             # Architecture, database, business logic
└── docker-compose.yml
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries and dependency rules.

## Core Principles

1. **Inventory is a ledger** – stock is never a mutable column.
2. **Historical cost is frozen** at time of sale (COGS integrity).
3. **Tenant isolation** by `businessId` on every query.
4. **Offline-first POS** with idempotent sync.
5. **No fake data** in production dashboards.
6. **Money = Decimal**, never floating point.

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [DATABASE.md](docs/DATABASE.md)
- [BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md)

## License

Proprietary – All rights reserved.


## Current status

Working modular retail OS for single-location shops:

- Auth, onboarding, RBAC foundation
- Products, inventory ledger, stock counts
- POS (online + offline with sync)
- Purchases, suppliers, supplier payments
- Customers, credit, payments
- Expenses, cash sessions
- Sales returns, receipts
- Profit reports from real data
- EN / SW i18n foundation
- Seed data + critical-path e2e tests
- CI workflow (build + e2e against Postgres)

Phase 1 fixes done: returns/void, cash drawer ledger, credit limits, min price guard,
weighted average cost, supplier debt on receipt, race-safe checkout.
Phase 2 done: wholesale/retail prices, packs (carton/sack), customer types, due dates, statements,
overdue ageing, alerts, offline catalog, CSV exports, printable invoice + delivery note.
Phase 3 done: free trial, monthly/6-month/yearly plans, read-only mode after expiry, manual mobile-money
payment confirmation, admin page, reminders. See `docs/BILLING.md` (includes the one-time admin setup).
**After pulling these changes run:** `npx prisma migrate dev --name phase1_to_3 --schema=./prisma/schema.prisma`

Not yet production-hardened: full permission coverage on every endpoint, monitoring wiring, PDF receipts, CSV import polish.
