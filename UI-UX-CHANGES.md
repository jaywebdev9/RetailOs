# Retail OS — Premium Responsive UI/UX Update

## Problem
On mobile devices, dashboards and list screens were getting cut off (content clipped / horizontal overflow). Desktop looked fine; phones and small tablets did not.

## Research summary (professional retail / POS / admin UX 2024–2026)
- **Mobile-first, then scale up** — design for touch and narrow viewports first.
- **Card lists on mobile, dense tables on desktop** — never force wide tables on phones.
- **Safe-area insets** — respect notch and home indicator (`env(safe-area-inset-*)`).
- **Touch targets ≥ 44px** on primary actions.
- **Clear hierarchy** — KPIs first, then alerts, then actions (one primary job per screen).
- **Consistent chrome** — single AppShell (sidebar + sticky header) instead of duplicated shells.
- **No horizontal page scroll** — only controlled horizontal scroll inside table containers.
- **100dvh** — use dynamic viewport height so mobile browser chrome does not clip content.

## What changed (UI/UX only)

### Design system (`apps/web/src/app/globals.css`)
- Premium design tokens (surfaces, brand teal, shadows, radii).
- Safe-area CSS variables and helpers (`.pb-safe`, `.pt-safe`).
- `.table-scroll` for horizontal table scroll without page overflow.
- `.mobile-list` for consistent card stacking.
- Touch-friendly base styles and focus-visible rings.
- `min-height: 100dvh` to avoid cut-off under mobile browser UI.

### Root layout (`apps/web/src/app/layout.tsx`)
- Proper `viewport` export: `device-width`, `viewportFit: 'cover'`, theme-color.
- Apple web-app capable meta for installable feel.

### AppShell (`apps/web/src/components/AppShell.tsx`)
- Safe-area padding on header and mobile drawer.
- Larger touch targets (menu, nav links, close).
- Sticky header with backdrop blur; content padded with `pb-safe`.
- New `KpiCard` component for consistent dashboard metrics.
- StatusBadge + EmptyState polished.

### Dashboard (`apps/web/src/app/(app)/dashboard/page.tsx`)
- **Removed duplicated full-page shell** (was a major cause of mobile cut-off and inconsistency).
- Now uses shared `AppShell`.
- Responsive KPI grid (2 cols → 4 cols).
- Alert cards and quick-action grid that never overflow.

### List pages (products, purchases, sales, customers, suppliers, expenses, returns, cash, stock-count, reports, billing)
- Table wrappers use `.table-scroll` so wide tables scroll horizontally *inside* the card, not the whole page.
- Primary action buttons given `min-h-10` on mobile for easier tapping.

### Helpers (`apps/web/src/components/ui/ResponsiveList.tsx`)
- `ResponsiveList`, `DataCard`, `DesktopTable` for future screens.

### Subscription banner
- Better wrapping and safe-area top padding so trial notice does not collide with notches.

## How to apply
Copy the `apps/web/...` paths from this zip over your existing `retail-os` project (same relative paths). No API or business-logic changes.

```bash
# from project root of retail-os
unzip -o retail-os-ui-ux-only.zip
# or merge the apps/web folder
```

Then rebuild / redeploy the web app.

## Devices covered by design
- Phones (320–430px): cards, no page horizontal scroll, safe areas.
- Tablets: hybrid.
- Desktop (≥1024px): sidebar + full tables.
