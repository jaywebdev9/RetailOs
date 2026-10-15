# Deployment

## Overview

| Component | Recommended target |
|-----------|-------------------|
| Frontend (`apps/web`) | Vercel |
| Backend (`apps/api`) | Railway / Render / Fly.io / AWS ECS |
| PostgreSQL | Managed (Neon, Railway, RDS, Supabase) |
| Redis | Managed (Upstash, Railway, ElastiCache) |
| Object storage | Cloudflare R2 / AWS S3 / MinIO |

## Environment variables (production)

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/retail_os?sslmode=require
REDIS_URL=redis://...
JWT_ACCESS_SECRET=<min-32-char-random>
JWT_REFRESH_SECRET=<min-32-char-random>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
API_PORT=3001
WEB_URL=https://your-app.vercel.app
API_URL=https://api.yourdomain.com
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=retail-os
SENTRY_DSN=...
```

Never commit production secrets. Use the host platform’s secret store.

## Database

```bash
npx prisma migrate deploy --schema=./prisma/schema.prisma
# Optional seed — development only
# npm run db:seed
```

### Backups

- Enable automated daily backups on the managed Postgres provider.
- Retention: at least 7–30 days.
- Document restore: restore snapshot → update `DATABASE_URL` → `prisma migrate deploy`.
- Test restore quarterly.

## Frontend (Vercel)

1. Root directory: `apps/web` (or monorepo with filter).
2. Build: `next build`
3. Env: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1`
4. Framework preset: Next.js

## Backend

1. Build: `npm run build -w @retail-os/api`
2. Start: `node apps/api/dist/main` (or workspace start)
3. Health check: `GET /api/v1/health`
4. Ensure `DATABASE_URL` and JWT secrets are set before start.

## CORS

Backend allows `WEB_URL`. Set it to the exact frontend origin in production.

## HTTPS

Terminate TLS at the load balancer / platform edge. Do not expose the API over plain HTTP in production.

## Checklist before go-live

- [ ] Strong JWT secrets rotated
- [ ] Managed Postgres with backups
- [ ] `prisma migrate deploy` succeeded
- [ ] Health endpoint green
- [ ] Auth register/login works
- [ ] One full sale + stock cycle tested
- [ ] Offline sale + sync tested on a real device
- [ ] Sentry (or equivalent) wired
- [ ] Rate limiting active on auth routes
- [ ] No demo seed data in production DB

## Scaling notes

This is a modular monolith. Scale the API horizontally behind a load balancer; keep a single Postgres primary. Redis is used for future job queues (BullMQ).
