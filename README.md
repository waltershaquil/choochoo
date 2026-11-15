# Choochoo

A hypertrophy-focused workout tracker: Next.js on Vercel, Postgres on Supabase.

- **Dashboard** – weekly summary (workouts, sets, volume) and sets per muscle group.
- **Diary** – every workout by day; tap one to edit its exercises, weights and reps, even after it is finished.
- **Exercises** – ~140 exercises grouped by the muscle they hit, with search, custom exercises and per-exercise history.
- **Favourites** – saved workouts you can log in one tap, then adjust.

## Deploy on Vercel

1. Import this repository in Vercel.
2. Add the database secret under **Settings → Environment Variables** (see `.env.example`):
   - `DATABASE_URL` – the **Transaction pooler** connection string from Supabase (**Connect** button), with your password filled in.
     Use the pooler string rather than `db.<ref>.supabase.co`: that direct host is IPv6-only and Vercel functions are IPv4-only.
   - or `SUPABASE_DB_PASSWORD` plus `SUPABASE_POOLER_HOST` (for example `aws-0-eu-west-1.pooler.supabase.com`).
   - optional `CRON_SECRET` – any random string; protects the keep-alive endpoint.
3. Deploy. Tables and the exercise library are created automatically on the first request.

## Keep-alive

`vercel.json` schedules a daily Vercel Cron call to `/api/keepalive`, which runs a small query so the Supabase
project is never paused for inactivity.

## Run locally

```bash
npm install
npm run dev
```

With no database variables set, local dev uses an embedded Postgres stored in `./.pglite`.
