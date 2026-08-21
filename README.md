# HRIS Potensi Creative — Next.js + Prisma + Postgres

Full-stack HRIS for a live-streaming agency: scheduling, payroll, QC monitoring,
LMS (interactive video lessons), data migration, Telegram notifications + one-tap
absensi, and multi-tenant RBAC.

## Getting Started (local dev)

Requires a Postgres DB. A `docker-compose.yml` provides Postgres 16 on port `5434`:

```bash
docker compose up -d          # start Postgres
cp .env.example .env.local    # configure DATABASE_URL
npm install
npx prisma migrate dev        # apply migrations
npx prisma db seed            # demo data (tenants, roles, users, PIN 1234)
npm run dev                   # http://localhost:3000
```

Demo login: one of the seeded users (e.g. `admin@potensicreative.test` / PIN `1234`),
or use the 1-click role buttons on the login page.

## Deployment to Supabase

See **[SUPABASE.md](./SUPABASE.md)** for the full, step-by-step guide. In short:

```bash
DATABASE_URL=postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
npx prisma migrate deploy     # push all migrations to Supabase
npm run build
npm start
```

## Key npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | local dev server |
| `npm run build` / `npm start` | production build / server |
| `npm run test` | vitest unit tests |
| `npm run db:migrate` | create + apply a dev migration |
| `npm run db:deploy` | apply committed migrations (prod/Supabase) |
| `npm run db:seed` | seed demo data |
