# Development Guide

## Prerequisites
- Node.js 20+
- Docker (Postgres, Redis, MinIO)

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma generate --schema=./prisma/schema.prisma
npx prisma migrate dev --name init --schema=./prisma/schema.prisma
npm run db:seed
```

## Run

```bash
npm run dev:api   # :3001  Swagger at /api/docs
npm run dev:web   # :3000
```

## Demo login (after seed)

```
Email:    demo@retailos.local
Password: DemoPass123!
```

## Critical business flow (manual)

1. Login with demo credentials (or register → onboarding)
2. Products → already seeded (Sugar, Rice, Oil, Soap)
3. Suppliers → Kilimanjaro Distributors seeded
4. Purchases → create PO → Receive stock
5. POS → sell → receipt available at `GET /sales/:id/receipt.html`
6. Dashboard → live sales & profit
7. Offline: disconnect network → POS sale → reconnect → auto-sync

## Tests

```bash
# Requires DATABASE_URL and running Postgres
npm run test:e2e
```

Covers: register → business → product → supplier → purchase → receive →
sell → stock check → COGS → idempotent resync → expense → net profit.

## Receipts

- JSON: `GET /api/v1/sales/:id/receipt`
- Printable HTML: `GET /api/v1/sales/:id/receipt.html` (auto-print)

## Module map

| Module     | Path                         |
|------------|------------------------------|
| Auth       | modules/auth                 |
| Users      | modules/users                |
| Businesses | modules/businesses           |
| Products   | modules/products             |
| Inventory  | modules/inventory            |
| Sales      | modules/sales                |
| Purchases  | modules/purchases            |
| Suppliers  | modules/suppliers            |
| Customers  | modules/customers            |
| Expenses   | modules/expenses             |
| Cash       | modules/cash                 |
| Reports    | modules/reports              |

## Offline POS

- Dexie DB: `RetailOSOffline`
- Queue: `lib/offline/sync.ts`
- Idempotency: `clientTransactionId` unique per business
