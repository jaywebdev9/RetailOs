# Retail OS — ALL session changes (one zip)

## Includes
1. Auth: show/hide password, forgot/reset, email verify, Google login, Resend/SMTP mail
2. Platform admin console at /admin/billing
3. EN/SW i18n, mobile language toggle, /help manual
4. PWA install (manifest, service worker, icons)
5. Dashboard motion (animated numbers + bars)
6. 404, privacy, terms pages
7. Prisma: AuthToken, googleId, optional passwordHash

## Apply
```bash
cd /storage/8AB4-1BED/retail-os
unzip -o retail-os-ALL-CHANGES.zip

cd apps/api
npm install
npx prisma migrate deploy
# or: npx prisma db push
cd ../..

git add -A
git commit -m "feat: auth, platform admin, PWA, i18n, motion (full session)"
git push origin main
```

Redeploy **API + Web**.

## Env
Vercel: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID
API: DATABASE_URL, JWT_ACCESS_SECRET, FRONTEND_URL, GOOGLE_CLIENT_ID, SMTP_*, MAIL_FROM
