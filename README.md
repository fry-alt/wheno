# wheno

A Telegram Mini App that helps groups find the best time to meet.

## Stack

- Next.js 16 App Router
- TypeScript (strict)
- Tailwind CSS v4
- Supabase (Postgres + RLS, no Supabase Auth)
- `@telegram-apps/sdk-react` + `@telegram-apps/init-data-node`
- `date-fns` / `date-fns-tz`
- Vitest (unit tests)

## Features

- Telegram Mini App bootstrap with `ready()` and viewport expand
- Server-side Telegram init data validation (HMAC-SHA256 via `init-data-node`)
- Signed session cookie (HMAC-SHA256, server-side expiry check)
- Group creation and joining by invite code
- Manual, quick-add, and weekly recurring busy time entry
- Meeting request creation with top-5 suggested slots
- Member voting on suggested slots
- Final slot selection by group owner
- Bilingual UI (English / Russian) with proper Russian pluralization

---

## Session and auth architecture

This project does **not** use Supabase Auth. Instead:

1. The client reads Telegram Mini App `initData` via `@telegram-apps/sdk`.
2. It posts the raw `initData` + browser timezone to `POST /api/session`.
3. The server validates `initData` using HMAC-SHA256 against `TELEGRAM_BOT_TOKEN`.
4. On success the server upserts the user in Supabase and sets a signed session cookie.
5. All subsequent server actions and page loads read the cookie, verify the HMAC signature and check the `issuedAt` timestamp, then load the user from Supabase using the service role key.

The `SUPABASE_SERVICE_ROLE_KEY` is **never** sent to the client — it exists only in server-side Next.js code.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (used only for client-side Supabase config; no direct DB access is made from the client) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — **server only**, never prefix with `NEXT_PUBLIC_` |
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from `@BotFather` — **server only** |
| `NEXT_PUBLIC_APP_URL` | ✅ | Full URL of the deployed app, e.g. `https://wheno.vercel.app` |

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in all five variables in `.env.local`.

### 3. Create the Supabase schema

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run the full contents of [`supabase/schema.sql`](./supabase/schema.sql).

The schema creates all tables, indexes, RLS policies, and revokes `anon`/`authenticated` access so only the service role can read or write data.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Testing outside Telegram (dev fallback)

When `NODE_ENV !== "production"` and no valid Telegram `initData` is present, the app authenticates with a fixed dev user:

| Field | Value |
|---|---|
| `telegram_id` | `dev-user` |
| `first_name` | `Dev` |
| `username` | `dev` |

**This fallback is disabled in production.** In production, requests without valid Telegram credentials return a `400` error from `/api/session`.

---

## Testing inside Telegram

1. Create a bot in `@BotFather` and save the token in `TELEGRAM_BOT_TOKEN`.
2. Use a tunnel (e.g. [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)) to expose your local server.
3. Set `NEXT_PUBLIC_APP_URL=https://your-tunnel-url` in `.env.local`.
4. Configure the Mini App URL in `@BotFather` to your tunnel URL.
5. Open the Mini App from Telegram — init data will be validated end-to-end.

---

## Running tests

```bash
npm test          # run all tests once
npm run test:watch  # watch mode
npm run check:i18n  # scan i18n.ts for mojibake encoding artifacts
```

---

## Main routes

| Route | Description |
|---|---|
| `/` | Home — session bootstrap, group list |
| `/groups/new` | Create a group |
| `/join` | Join by invite code |
| `/groups/[id]` | Group detail, invite code, member list, meeting requests |
| `/availability/new` | Add a busy block (quick / manual / weekly) |
| `/groups/[id]/find-time` | Create a meeting request and calculate slots |
| `/meetings/[id]` | Vote on options, select the final slot |
| `/calendar` | Personal busy-block calendar |

---

## Scheduling logic

The scheduler (`src/lib/scheduler.ts`):

- Generates 30-minute-step candidate slots within the requested window (08:00–22:00 local, or a narrower preferred-time window).
- Converts all boundaries through `date-fns-tz` using each member's stored IANA timezone.
- Checks each slot against every member's busy blocks using a standard overlap test (`busyStart < slotEnd && busyEnd > slotStart`).
- Filters out slots where the number of free members is below `min_participants`.
- Scores each slot: `freeCount × 10 + preferredTimeBonus(5) + weekendBonus(3) - latePenalty(5) - busyCount × 2`.
- Returns the top 5 options sorted by score descending, then by start time ascending on ties.

---

## Supabase notes

- RLS is enabled on all tables.
- `anon` and `authenticated` roles have **no** permissions — only the service role key can read or write.
- The service role key is only used in `src/lib/supabase/admin.ts`, which is imported exclusively in server-side code.

---

## Deployment to Vercel

1. Push the project to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add all five environment variables in the Vercel project settings.
4. Deploy.
5. Update the Mini App URL in `@BotFather` to your deployed domain.

---

## Production checklist

Before going live, verify the following:

- [ ] All five environment variables are set in the hosting environment.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `TELEGRAM_BOT_TOKEN` are **not** prefixed with `NEXT_PUBLIC_`.
- [ ] `NEXT_PUBLIC_APP_URL` matches the deployed domain exactly (no trailing slash).
- [ ] The Supabase schema has been applied (`supabase/schema.sql`).
- [ ] RLS is enabled on all tables and `anon`/`authenticated` access is revoked (the schema does this automatically).
- [ ] `npm run build` passes with no TypeScript or ESLint errors.
- [ ] `npm test` passes (8 scheduler unit tests).
- [ ] `npm run check:i18n` passes (no mojibake in translation strings).
- [ ] The Mini App URL in `@BotFather` matches `NEXT_PUBLIC_APP_URL`.
- [ ] The app has been opened inside Telegram to verify end-to-end init data validation.
- [ ] `NODE_ENV=production` is set (Vercel does this automatically).
