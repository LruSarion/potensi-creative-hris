# Deploying to Supabase (PostgreSQL)

This app uses **Prisma 7 + `@prisma/adapter-pg`** over a standard `DATABASE_URL`.
Supabase provides a Postgres database that is fully compatible — no code changes
needed. You only need to point `DATABASE_URL` at Supabase and run the migrations.

> Local dev uses a Docker Postgres 16 (`docker-compose.yml`) on port `5434`.
> Supabase also runs Postgres 15/16/17, so migrations are identical.

---

## 1. Create a Supabase project

1. Go to https://supabase.com → **New project**.
2. Note your **Project URL** and **Database Password**.

---

## 2. Get the connection string

In the Supabase dashboard: **Project Settings → Database → Connection string**.

You have two options:

| Mode | Connection string | Use when |
|------|-------------------|----------|
| **Transaction pooler** (port `6543`) | `postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true` | Serverless/edge runtime — recommended for production |
| **Direct** (port `5432`) | `postgresql://postgres.<ref>:<pass>@db.<ref>.supabase.co:5432/postgres` | Local CLI / long-lived servers |

The app uses `@prisma/adapter-pg`, which works with **both**. For production
hosting (Vercel/Netlify/Node), use the **transaction pooler** URL.

---

## 3. Configure environment variables

Copy `.env.example` and fill in your Supabase URL:

```bash
cp .env.example .env.local
```

```bash
# .env.local  (or your host's env)
DATABASE_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true

# REQUIRED in production (Auth.js)
AUTH_SECRET=<run: npx auth secret>

# Set these to match your deployment:
CRON_SECRET=<random long string>
NEXT_PUBLIC_APP_URL=https://your-app.example.com
```

Optional, only if you use those features: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`WEBHOOK_SECRET`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`.

---

## 4. Apply migrations to Supabase

From your machine, with the Supabase `DATABASE_URL` in the environment:

```bash
# Push all committed migrations to Supabase (non-interactive, safe for prod)
npx prisma migrate deploy

# Regenerate the Prisma client (run after migrations if needed)
npx prisma generate
```

> `db:deploy` and `db:generate` are also in `package.json`.

---

## 5. Seed the database (optional, demo data)

Only for a fresh/demo database. This creates tenants, roles, tiering, and demo
users (PIN `1234`):

```bash
npx prisma db seed        # uses DATABASE_URL from env
# or: npm run db:seed:prod
```

---

## 6. Run the app

```bash
npm run build
npm start                 # production server
```

---

## 7. Cron jobs (payout, telegram-poll, billing, ...)

Jobs are triggered by `POST /api/jobs/run?job=<name>` (gated by `CRON_SECRET`)
and `POST /api/telegram/poll` (dev/telegram). On a host like Vercel, schedule
them with cron triggers:

```
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-app.example.com/api/jobs/run?job=payout-run
```

Common jobs: `payout-run`, `billing-close`, `lms-reminders`, `qc-assign`,
`report-refresh`, `incident-escalate`, `telegram-poll`.

---

## 8. Telegram bot webhook (production)

Once deployed, register the webhook so Telegram pushes updates directly
(no polling needed):

```
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.example.com/api/telegram/webhook"
```

The bot token can be set in the Admin UI (Super Admin → Admin → Notifikasi
Telegram) instead of env. Both work.

---

## Notes & caveats

- **RLS / Supabase Auth**: This app manages its own users via the `users` table
  and NextAuth; it does **not** use Supabase Auth/RLS. Keep RLS disabled for the
  relevant tables, or grant the app's DB role full access.
- **Extensions**: The schema/migrations use **no** Postgres extensions, so no
  `CREATE EXTENSION` permissions are needed.
- **Schema drift**: Always run `npx prisma migrate deploy` after pulling newer
  code, and keep `prisma/schema.prisma` as the source of truth.
- **Connection limits**: The transaction pooler (6543) is best for serverless.
  If you use the direct connection (5432) from many serverless instances, you
  may hit connection limits.
