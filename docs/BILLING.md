# Subscriptions (Phase 3)

## What owners get
- **14-day free trial** starts automatically when a business is created. Full access.
- Plans: **Monthly**, **6 months**, **Yearly**. Prices are placeholders: change them on `/admin/billing`
  (defaults are created on first use: 15,000 / 80,000 / 150,000 TZS).
- Paying early never loses days: a new period starts where the current one ends.
  Paying after it ended starts a new period today.

## What happens when time runs out
| Time | State | What works |
|---|---|---|
| before the end date | TRIALING / ACTIVE | everything |
| 3 days after the end | GRACE | everything + red warning |
| after that | EXPIRED | **read-only**: view everything, export CSV, open Billing. New sales/records get HTTP 402 `SUBSCRIPTION_EXPIRED` |

Data is never deleted or locked away. Sales made **offline** before the lock can still sync for up to 7 days.
Access is calculated from the dates (`common/subscription-state.ts`), so it does not depend on the hourly job.

## How payment works today (manual, no gateway fees)
1. Owner opens **Billing**, picks a plan, sees your payment instructions.
2. Owner pays your mobile-money number and enters the **transaction ID** from the SMS.
3. You open **/admin/billing**, check your mobile-money account, press **Confirm** (or Reject with a reason).
4. The plan is extended immediately. The same transaction ID can never be used twice.

## One-time setup
1. Register your own account in the app.
2. Put your email in `.env`: `PLATFORM_ADMIN_EMAIL=you@example.com` and run `npx prisma db seed`
   (or in SQL: `UPDATE users SET "isPlatformAdmin" = true WHERE email = 'you@example.com';`).
3. Open `/admin/billing`, set the prices and **"How owners pay you"** (your number and name).

## Free trial abuse protection
One trial per person (`User.trialUsedAt`) and per phone number (a new business with the phone of a business
that already had a trial starts expired). Existing businesses from before billing get one trial when first used.
You can add days for support: `/admin/billing` → **+ free days**.

## Reminders
An hourly job (`billing.jobs.ts`) sends each reminder once: 7, 3 and 1 days before the end, and on expiry.
In-app reminders appear on the dashboard alerts and the banner. Outgoing SMS/WhatsApp is a hook:
`BillingNotifier` in `notifier.ts` only logs today. Implement `send()` with your SMS provider and register it
for `BILLING_NOTIFIER` in `billing.module.ts`. Set `BILLING_JOBS=off` to disable the job.

## Adding a real payment gateway later
Implement `PaymentProvider` (`payment-provider.ts`) for Selcom / ClickPesa / Flutterwave, add a webhook route that
verifies the signature, then call `AdminBillingService.confirmPayment(paymentId, 'SYSTEM')`. Nothing else changes.

## Env vars
`PLATFORM_ADMIN_EMAIL` (seed), `BILLING_PAY_INSTRUCTIONS`, `BILLING_SUPPORT_PHONE` (fallbacks if not set in the admin page),
`BILLING_JOBS=off` (optional).
