# Fix: nest: not found on Render

## Cause
`@nestjs/cli` was only in devDependencies. Production install skips it → `nest: not found`.

## Fix
- `build`: `npx nest build`
- `@nestjs/cli` moved to dependencies

## Render Build Command (recommended)
```
npm install && npx prisma generate && npx prisma migrate deploy && npm run build -w @retail-os/api
```

## Start Command
```
node apps/api/dist/main
```
(or from apps/api: `node dist/main`)

Do NOT run seed on every deploy.
