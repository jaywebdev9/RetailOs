# Security

## Authentication
- Passwords hashed with bcrypt (cost 12)
- JWT access tokens (short-lived, default 15m)
- Refresh tokens stored hashed (SHA-256), rotated on use, revocable
- Rate limiting via Nest Throttler on API

## Authorization
- Multi-tenant isolation by `businessId` on every business-owned query
- Membership check before data access
- RBAC: `PermissionsGuard` + `@RequirePermissions('module.action')`
- Owner role bypasses permission checks
- Apply `PermissionsGuard` on mutating endpoints as they are hardened

## Data protection
- No plaintext passwords or refresh tokens in DB
- Money as Decimal — no float arithmetic
- Validation pipes whitelist DTOs
- CORS restricted to `WEB_URL`
- Structured errors — no stack traces to clients in production

## Secrets
- JWT secrets, DB credentials, S3 keys via environment only
- Never commit `.env`
- Rotate secrets if leaked

## Audit
- Sensitive actions write `audit_logs` (who, what, when, entity)
- Financial history is not hard-deleted (void/reversal patterns)

## Production checklist
- [ ] Strong unique JWT secrets
- [ ] HTTPS only
- [ ] Managed DB with restricted network access
- [ ] Automated backups tested
- [ ] Sentry or equivalent error tracking
- [ ] Auth rate limits verified

## Permission coverage (mutating endpoints)

| Permission | Endpoint |
|------------|----------|
| sales.create | POST /sales |
| sales.refund | POST /sales/returns |
| products.create | POST /products |
| inventory.adjust | POST /inventory/adjust |
| inventory.count | POST /inventory/stock-counts* |
| purchases.create | POST /purchases |
| purchases.receive | POST /purchases/:id/receive |
| suppliers.create | POST /suppliers |
| suppliers.payment | POST /suppliers/:id/payments |
| customers.create | POST /customers |
| customers.payment | POST /customers/:id/payments |
| expenses.create | POST /expenses |
| finance.view | POST /cash/sessions/* |

Owner role bypasses all permission checks.
Read endpoints currently require authentication + business membership only.
