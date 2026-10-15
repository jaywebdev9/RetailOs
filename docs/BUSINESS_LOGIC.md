# Business Logic

## Profit Engine

```
Revenue        = Completed sales − refunds
COGS           = Σ (quantity × costPriceAtSale) for sale items
Gross Profit   = Revenue − COGS
Operating Exp  = Expenses (excludes owner withdrawals)
Net Profit     = Gross Profit − Operating Expenses
```

## Inventory Valuation

Initial method: **Weighted Average Cost**.

When stock is received:

```
new_avg = (old_qty × old_avg + received_qty × received_cost) / (old_qty + received_qty)
```

Historical sales keep the `costPriceAtSale` frozen.

## Cash Session

```
Expected = Opening cash
         + Cash sales
         + Customer credit payments (cash)
         − Expenses (cash)
         − Supplier payments (cash)
         − Owner withdrawals
         ± Adjustments
```

Difference = Actual physical − Expected.

## Reorder Recommendation

```
Reorder Point = (Average Daily Sales × Supplier Lead Time) + Safety Stock
Recommended Qty = max(reorderQuantity, Reorder Point − currentStock)
```

## Offline Sale Idempotency

Client generates UUID → `clientTransactionId`.  
Server: `UNIQUE(businessId, clientTransactionId)`.  
Duplicate sync returns the existing sale.


## Returns (server-calculated)

```
refund per unit = line total ÷ line quantity × (sale total ÷ sale subtotal)   // respects both discounts
```

- The client never sends the refund amount; it is calculated from the original sale.
- Cumulative returns per sale item can never exceed the original quantity.
- A refund first cancels any unpaid customer debt on that sale; the rest is paid back
  (cash refunds reduce the cash drawer).
- Sale becomes `FULLY_RETURNED` only when every item is fully returned.

## Void sale

`POST /sales/:id/void` (permission `sales.void`) reverses stock, customer debt and drawer cash.
Only untouched (`COMPLETED`) sales can be voided; sales with returns must be returned instead.

## Cash drawer

Every cash movement writes a `CashTransaction` on the open session:
cash sales (cash tendered − change), customer payments, expenses, supplier payments,
cash refunds, voids, and manual CASH_IN / CASH_OUT / OWNER_WITHDRAWAL.
A payment or expense with no payment method counts as cash. Mobile money / bank / credit never touch the drawer.

## Credit

- A payment method with code `CREDIT` means "put on the customer's account".
- `creditLimit > 0` is enforced on credit sales (`0` = no limit set).

## Pricing guard

`minimumSellingPrice` is enforced after line discount. Selling below it needs `sales.override_price`.

## Supplier debt

Booked when stock is **received** (value of what actually arrived), not when it is ordered.


## Retail + wholesale pricing (Phase 2)

Each product has a retail price (`sellingPrice`) and an optional wholesale price (`wholesalePrice`), both per base unit.

| Situation | Price used |
|---|---|
| Customer type = WHOLESALE | wholesale price |
| Any customer buys `wholesaleMinQty` or more (base units) | wholesale price |
| Everyone else / walk-in | retail price |

- If a sale line has no `sellingPrice`, the **server** picks the price with this rule.
- The POS applies the same rule locally (`apps/web/src/lib/pricing.ts`) and always sends the price the customer saw,
  so offline sales keep the price shown on the screen. `minimumSellingPrice` still protects against bad prices.

## Packs (carton, sack, dozen)

`ProductPack` = name + factor (units per pack) + optional retail/wholesale pack price.
- Sales and purchases can use `packId`; `quantity` and price are then **per pack**.
- Stock, cost and COGS are always stored in **base units**. A line keeps `packName` / `packQuantity` for invoices.
- Pack price empty = base price × factor.

## Customer credit, due dates and statements

- Credit sale due date = `dueDate` in the request, else customer `paymentTermsDays`, else 30 days (ageing default).
- Payments and return credits are applied to the **oldest invoice first (FIFO)**, computed on the fly (`common/ageing.ts`).
- `GET /customers/overdue` – ageing buckets (not due, 1–30, 31–60, 60+ days late).
- `GET /customers/:id/statement?from&to` – every invoice/payment with running balance.

## Alerts

`GET /alerts` re-evaluates and syncs the Alert table (no scheduler needed):
OUT_OF_STOCK, LOW_STOCK (≤ reorder level), STOCKOUT_RISK (< 7 days of cover at the last 30 days' sales speed,
with a suggested order quantity) and OVERDUE_CREDIT. Fixed problems resolve themselves.

## Offline POS

The POS copies products, customers and payment methods into IndexedDB (refreshed when online, every 5 minutes).
It starts and sells with no internet. Queued sales sync in order; sales the server **refuses** (stock, credit limit, price)
move to a "rejected" list shown on the POS so a person decides, instead of retrying forever.

## Exports and documents

CSV (Excel-safe, formula-injection protected): `/reports/export/sales|stock|customer-debts`.
Printable A4 invoice and delivery note at `/invoice/:saleId` (use the browser's Save as PDF).
