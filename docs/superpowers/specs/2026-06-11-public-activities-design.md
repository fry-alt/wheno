# Public Activities + Discovery Feed + Join — design (social pivot, cycle 2)

**Date:** 2026-06-11
**Status:** approved (brainstorm)
**Part of:** the activity-first social pivot. Sub-project 2 of ~5 (Profiles ✓ → **Activities + feed + join** → AI matching → Places → Trust & safety). Cycle 1 (profiles) shipped 2026-06-11.

## Goal

The core social loop: a user hosts a public activity (🎾 tennis Sat 10:00, up to 6 people); others discover it in a feed, see whether it fits their free time, and join with one tap. Joining materializes the activity into the joiner's calendar, so wheno's free/busy engine and AI advisor automatically account for it. The host is notified. Activity types reuse the profile interest tags, setting up cycle 3 (matching).

This cycle includes the minimum trust controls for a stranger-meeting product: **report** and **block**.

## Decisions (brainstorm)

| Question | Decision |
|---|---|
| Calendar integration | Join/host **materializes a calendar event** (`event` per participant, linked via `activity_participants.event_id`). No new column on `events`. |
| Activity type | Reuse `INTEREST_TAGS` slugs (+ custom), via `interestLabel`. |
| Join model | **Open join** (no host approval). |
| Feed reach | **All public** activities visible to everyone; `friends`-only visible to the host's friends. |
| Safety | **Report + block**, from day one. |
| Navigation | New **5th bottom-nav tab 🤸** → `/activities`. |
| Host as participant | Host is participant row #1 (counts toward capacity, materialized on host calendar). |

## Scope

**In scope:** create activity; discovery feed (`/activities`) with Лента/Мои tabs + type filter + "✓ свободен" badge; activity detail (`/activities/[id]`) with participant list; join / leave / cancel; host notification on join, participant notification on cancel; report activity; block user. Refined-dark UI on existing primitives.

**Out of scope (later cycles):** editing an activity, interest-based ranking/matching (cycle 3), maps/places API, chat/comments, recurring activities, a moderation panel, friends-of-friends ranking.

## Data model (new in `supabase/schema.sql`)

```sql
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  type        text not null,              -- interest slug or custom string
  description text,
  place       text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  capacity    int,                        -- null = unlimited
  visibility  text not null default 'public',  -- 'public' | 'friends'
  status      text not null default 'open',    -- 'open' | 'cancelled'
  created_at  timestamptz not null default now(),
  constraint activities_time_order check (ends_at > starts_at)
);
create index if not exists activities_starts_idx on public.activities(starts_at);
alter table public.activities enable row level security;

create table if not exists public.activity_participants (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  event_id    uuid,                       -- materialized calendar event for this participant
  joined_at   timestamptz not null default now(),
  unique (activity_id, user_id)
);
create index if not exists activity_participants_user_idx on public.activity_participants(user_id);
alter table public.activity_participants enable row level security;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;

create table if not exists public.activity_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);
alter table public.activity_reports enable row level security;
```

Materialized events: a participant's calendar event is a normal `events` row (`is_fixed=true`, `category='social'`, `title`=activity title, `location`=place, `starts_at`/`ends_at` from the activity). Its id is stored in `activity_participants.event_id`. Because free/busy reads `events`, joined activities count as busy with no extra work. Leaving/cancelling deletes the event(s) by id.

## Screens & flows

**`/activities` (tab 🤸)** — `ActivitiesScreen`:
- Tabs **Лента** (discover) / **Мои** (hosting or joined).
- Type filter chips (interest tags present among upcoming activities).
- Each `ActivityCard`: type emoji+label, when, place, host avatar+name, `N/M идут`, "✓ свободен" badge (free-fit), primary button reflecting state. Card → detail.
- FAB **＋** → `ActivityForm` in a `BottomSheet`: title, type (interest picker, single), description, place, date + start time + end time, capacity (optional), visibility (public/friends).

**`/activities/[id]`** — `ActivityDetail`:
- Full info + `ParticipantList` (avatars).
- Button: **Иду** / **Выйти** / **Мест нет** / **Ты хост** / **Отменена** / **Прошло**.
- Host: **Отменить**. Non-host: **Пожаловаться**, **Заблокировать хоста**.

**Feed query rules:** upcoming (`starts_at >= now`), `status='open'`; `visibility='public'` OR (`visibility='friends'` AND host is the viewer's friend); exclude activities whose host the viewer blocked or who blocked the viewer. Sort by `starts_at` asc.

**Join rules (`canJoin`):** not the host, not already a participant, capacity not full, activity open and not past, viewer not blocked by host. On join: insert participant + insert the materialized event, store `event_id`; `notifyUser(host, …)`.

**Leave:** delete the participant row and its materialized event.
**Cancel (host):** set `status='cancelled'`, delete all materialized events, `notifyUser` each non-host participant.
**Block:** insert `user_blocks(viewer, host)`; thereafter the blocked user's activities are hidden from the viewer's feed and the viewer cannot join them, and vice-versa.
**Report:** insert `activity_reports` row (moderation surface is a later cycle).

## Architecture

- `src/lib/activities/types.ts` — `Activity`, `ActivityParticipant`, `ActivityCardData`, `ActivityButtonState`, `Visibility`, `ActivityStatus`.
- `src/lib/activities/state.ts` (+ test) — **pure**: `activityButtonState(...)`, `canJoin(...)`, `isFreeDuring(events, start, end)`, `isFull(count, capacity)`.
- `src/lib/activities/queries.ts` — feed list, get-one, participants, counts, insert/delete, free-check (reads `events`).
- `src/lib/activities/actions.ts` — `createActivityAction`, `joinActivityAction`, `leaveActivityAction`, `cancelActivityAction`, `reportActivityAction`, `blockUserAction`. Each `requireCurrentUser` + admin client; reuse `insertEvent`, `deleteEventById`, `notifyUser`. `revalidatePath("/activities")` (+ `/calendar` when materializing).
- `src/lib/safety/queries.ts` — `isBlockedEitherWay`, `insertBlock`, `insertReport`, `blockedUserIds(userId)`.
- `src/components/activities/` — `ActivitiesScreen`, `ActivityCard`, `ActivityForm`, `ActivityDetail`, `ParticipantList`.
- Routes: `src/app/(app)/activities/page.tsx`, `src/app/(app)/activities/[id]/page.tsx`.
- `src/components/bottom-nav.tsx` — add `{ href: "/activities", emoji: "🤸", label: "Движ" }` (label short to fit 5 tabs).

Reuse: `BottomSheet`, `Surface`, `SectionLabel`, tokens; `interestLabel`/`INTEREST_TAGS`; `insertEvent`/`deleteEventById`; `notifyUser`; `getInitials`.

## Testing (TDD on pure logic, Vitest)

- `isFull(count, capacity)` — capacity null → never full; count≥capacity → full.
- `isFreeDuring(events, start, end)` — true only if no event overlaps `[start,end)`.
- `canJoin(ctx)` → `{ ok }` or `{ ok:false, reason }` for host / already-joined / full / past / cancelled / blocked.
- `activityButtonState(ctx)` → `host | joined | full | past | cancelled | join`.

Queries/actions/components verified via `tsc`/`lint`/`build` + live screenshots.

## Notifications
Reuse `notifyUser(userId, text)`. Join → notify host ("X идёт на «…»"). Cancel → notify each non-host participant. Messages hardcoded RU (project convention).

## Deploy gotcha (manual, no auto-migration)
Create the four tables (`activities`, `activity_participants`, `user_blocks`, `activity_reports`) from `supabase/schema.sql` in the Supabase SQL editor before this works in prod. (No new Storage needed.)

## Risks
- **Stranger safety:** report+block is the floor, not a full system; real moderation, rate-limits, and abuse handling are the dedicated Trust & Safety cycle. Public photos/profile already noted from cycle 1.
- **Materialized-event drift:** editing an activity is out of scope, so materialized events can't get out of sync this cycle; cancel/leave clean them up. When edit lands later, it must re-sync events.
- **Feed with no geo:** "all public" can mix far-away activities; city/geo filtering is a later cycle. City from profile may be shown but is not filtered on yet.
