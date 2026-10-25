# Build fix: AppShell breadcrumb prop

## Error
```
Property 'breadcrumb' does not exist on type 'AppShellProps'
```
in products/page.tsx and purchases/page.tsx

## Fix
Optional `breadcrumb?: string` added back to AppShellProps (accepted, ignored for layout).

## Apply
```bash
cd /path/to/retail-os
unzip -o retail-os-ui-v3-fix.zip
git add apps/web/src/components/AppShell.tsx
git commit -m "fix: restore AppShell breadcrumb prop for TypeScript build"
git push origin main
```
