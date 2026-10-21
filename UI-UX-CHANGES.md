# Retail OS UI v3

## Fixes
- Primary color restored to **teal** (`#0f766e`)
- **Home page scroll fixed**: document scroll enabled; bottom nav no longer traps content
- Chart bars use fixed pixel heights (always visible)
- Navigation: light sidebar + bottom tabs with teal active state
- Notification bell kept
- Buttons on list pages back to teal

## Note on "Failed to load data"
Those messages come from **API responses** (network, auth, business id, or backend), not from this UI layer. UI still shows empty/error states correctly.

## Apply
```bash
unzip -o retail-os-ui-v3.zip
git add apps/web UI-UX-CHANGES.md
git commit -m "UI v3: teal brand, fix dashboard scroll, clean navigation"
git push origin main
```
