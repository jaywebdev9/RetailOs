# Database Design

## Multi-tenancy

Every business-owned table includes `businessId UUID NOT NULL`.

Isolation is enforced in the service layer (never trust the client).

## Inventory Ledger

```
inventory_transactions
  id, businessId, productId, quantity, type, referenceType, referenceId,
  unitCost, userId, reason, createdAt
```

Current stock for a product:

```sql
SELECT COALESCE(SUM(quantity), 0)
FROM inventory_transactions
WHERE businessId = $1 AND productId = $2;
```

Types: PURCHASE_RECEIVED, SALE, SALE_RETURN, PURCHASE_RETURN,
DAMAGE, EXPIRED, LOSS, MANUAL_ADJUSTMENT, STOCK_COUNT_ADJUSTMENT, TRANSFER.

## Money

All monetary columns: `DECIMAL(19,4)`.

Never use `FLOAT` / `DOUBLE` / JavaScript `number` for currency math.

## Key uniqueness

- `(businessId, sku)` on products
- `(businessId, barcode)` on products
- `(businessId, receiptNumber)` on sales
- `(businessId, clientTransactionId)` on sales (offline idempotency)

## Soft deletes / archival

Products use `status = ARCHIVED` instead of hard delete.
Financial transactions are never deleted; use void / reversal.
