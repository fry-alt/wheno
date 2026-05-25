# wheno

A Telegram Mini App that helps groups find the best time to meet.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Telegram Mini App
- `@telegram-apps/sdk-react`
- `date-fns`

## What this MVP includes

- Telegram Mini App bootstrap with `ready()` and expand behavior
- Telegram init data handling with a server-side validation helper
- Dev mode fallback outside Telegram with the fixed `dev-user` profile
- Group creation and joining by invite code
- Manual busy time entry
- Meeting request creation with top 5 suggested slots
- Voting on suggested slots
- Final slot selection by the group owner
- Supabase schema with RLS enabled and server-side data access only

## Architecture note

This MVP does not use Supabase Auth. Instead, it:

- reads Telegram Mini App data on the client
- validates and upserts the user on the server
- stores a signed app session cookie
- performs database reads and writes on the server with the service role key

That keeps the `SUPABASE_SERVICE_ROLE_KEY` off the client while still letting us ship the requested flow quickly.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local`.

3. Fill in the environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Create a Supabase project.

5. Run [`supabase/schema.sql`](/C:/wheno/supabase/schema.sql) in the Supabase SQL editor.

6. Start the app:

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000).

Outside Telegram, the app will use the dev fallback user:

- `telegram_id: dev-user`
- `first_name: Dev`
- `username: dev`

## Telegram bot setup

1. Create a bot in `@BotFather`.
2. Save the bot token and put it in `TELEGRAM_BOT_TOKEN`.
3. Configure your Mini App URL in `@BotFather`.
   Telegram's official Mini App docs describe menu button and main Mini App setup:
   - [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
   - [Mini Apps on Telegram](https://core.telegram.org/api/bots/webapps)
4. Use your public app URL for production, or a tunnel URL for local Telegram testing.

For local Telegram testing, set:

- `NEXT_PUBLIC_APP_URL=https://your-tunnel-url`

## Running inside Telegram

When opened inside Telegram, the app:

1. reads Telegram Mini App init data
2. posts it to `/api/session`
3. validates the init data server-side with `TELEGRAM_BOT_TOKEN`
4. creates or updates the user in Supabase
5. stores a signed session cookie

## Main routes

- `/` - home, session bootstrap, group list
- `/groups/new` - create group
- `/join` - join by invite code
- `/groups/[id]` - group details, invite info, members, meeting requests
- `/availability/new` - add manual busy block
- `/groups/[id]/find-time` - create meeting request and calculate slots
- `/meetings/[id]` - vote and select the final slot

## Scheduling logic

The scheduler lives in [`src/lib/scheduler.ts`](/C:/wheno/src/lib/scheduler.ts).

It:

- generates 30-minute candidate slots
- uses the requested date range and preferred time window
- checks overlaps against every member's busy blocks
- filters out slots below `min_participants`
- scores each slot
- returns the top 5 options

## Supabase notes

- RLS is enabled on all tables.
- `anon` and `authenticated` access is revoked for the MVP tables.
- The app currently uses server-side Supabase access only.
- The service role key is never sent to the client.

## Deployment to Vercel

1. Push the project to GitHub.
2. Import the repo into Vercel.
3. Add the same environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `NEXT_PUBLIC_APP_URL`
4. Deploy.
5. Update the Mini App URL in `@BotFather` to your deployed domain.

## Verification

Production build passes:

```bash
npm run build
```
