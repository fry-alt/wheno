# Meetings with Friends (Layer 3b) — Design

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Builds on:** Layer 3a Friends (friendships, invite codes, accept/decline)

## Goal

From a friend's profile a user can see that friend's busyness, propose a meeting, and — once the friend agrees — have the AI suggest times that are free for both. The initiator picks the final time, and the meeting is written into both calendars.

## Decisions (from brainstorming)

1. **Friend busyness display:** a 7-day grid showing only "busy" blocks — no event titles, notes, or categories. Privacy-first: the friend sees *when* you are busy, not *what* with.
2. **Confirmation flow:** receiver accepts → AI computes mutually-free slots → **initiator picks** the final slot → event created in both calendars.
3. **Timezones:** v1 assumes both users share one timezone. The search uses the initiator's timezone and the intersection of both users' working hours. Different timezones are out of scope for v1.

## Architecture

Reuse the existing single-user slot engine. `findSlots(request, busyEvents, dayHours, timezone)` already finds free slots given a list of busy events. For two people we **merge** both calendars into one busy list, intersect their working-hour windows, and call the same engine with `count = 5` to get several candidate slots. No new scheduling algorithm.

### State machine (`meeting_proposals.status`)

```
pending  → initiator sent the invite; waiting on the receiver
accepted → receiver agreed; waiting on the initiator to pick a time
confirmed→ initiator picked a slot; event created in both calendars
declined → receiver declined (terminal)
```

Slots are computed **live** when the initiator opens an `accepted` proposal (not stored at accept time), so availability is always fresh. The chosen `starts_at`/`ends_at` are persisted on the row at confirm time.

## Data Model

New table `meeting_proposals`:

```sql
create table if not exists public.meeting_proposals (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id   uuid not null references public.users(id) on delete cascade,
  title        text not null,
  category     text not null default 'meeting',
  duration_min int  not null,
  window_from  date not null,
  window_to    date not null,
  part_of_day  text not null default 'any',
  status       text not null default 'pending',
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index if not exists meeting_proposals_to_idx   on public.meeting_proposals(to_user_id);
create index if not exists meeting_proposals_from_idx on public.meeting_proposals(from_user_id);
alter table public.meeting_proposals enable row level security;
```

Migration is applied manually in the Supabase SQL editor (the controller has no programmatic DB access), matching the Layer 3a workflow.

## Components

### `src/lib/meetings/types.ts`
```ts
export type MeetingStatus = "pending" | "accepted" | "confirmed" | "declined";

export interface MeetingProposal {
  id: string;
  from_user_id: string;
  to_user_id: string;
  title: string;
  category: Category;
  duration_min: number;
  window_from: string; // yyyy-MM-dd
  window_to: string;   // yyyy-MM-dd
  part_of_day: "morning" | "afternoon" | "evening" | "any";
  status: MeetingStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface IncomingMeeting {            // I'm the receiver, status pending
  proposal_id: string;
  from_name: string;
  from_photo_url: string | null;
  title: string;
  duration_min: number;
  window_from: string;
  window_to: string;
  part_of_day: string;
}

export interface AwaitingPick {               // I'm the initiator, status accepted
  proposal_id: string;
  to_name: string;
  to_photo_url: string | null;
  title: string;
  duration_min: number;
}
```

### `src/lib/meetings/queries.ts`
- `createProposal(input)` — insert a `pending` row.
- `getProposal(id)` — single row by id.
- `listIncomingMeetings(userId)` — `to_user_id = userId AND status = 'pending'`, joined with sender info.
- `listAwaitingPick(userId)` — `from_user_id = userId AND status = 'accepted'`, joined with receiver info.
- `setProposalStatus(id, status)` — guarded transitions.
- `confirmProposalSlot(id, starts_at, ends_at)` — set status `confirmed` + slot.

All take the acting `userId` where a transition must be owner-scoped (receiver for accept/decline, initiator for confirm) and filter on it, mirroring the Layer 3a query style.

### `src/lib/meetings/find-mutual-slots.ts`
```ts
findMutualSlots(initiator, friendId, request): Promise<ProposedSlot[]>
```
- Fetch both users' day hours + timezone from `users`.
- `getEventsInRange()` for both across the window; concatenate into one busy list.
- Working window = `[max(day_start), min(day_end)]`; if empty, return `[]`.
- Call `findSlots(request, mergedBusy, mutualHours, initiatorTimezone)` with the request's `count` (default 5).

### `src/lib/meetings/actions.ts` (`"use server"`)
- `proposeMeeting(friendId, form)` — assert friends + not self + valid window/duration → `createProposal` → revalidate.
- `acceptMeeting(proposalId)` — receiver-scoped: `pending → accepted` → revalidate `/friends`.
- `declineMeeting(proposalId)` — receiver-scoped: `pending → declined` → revalidate `/friends`.
- `getMeetingSlots(proposalId)` — initiator-scoped, status `accepted`: build a `SlotRequest` from the row (`count = 5`) → `findMutualSlots`. Returns `ProposedSlot[]`.
- `confirmMeeting(proposalId, slot)` — initiator-scoped, status `accepted`: re-verify the slot is still free for **both** (re-fetch range, overlap check); on conflict throw a friendly error. Otherwise `insertEvent` for both users (`is_fixed: true`, `notes: "Встреча с {name}"`), then `confirmProposalSlot` → revalidate `/calendar` and `/friends`.

### `src/lib/friends/queries.ts` (additions)
- `assertFriends(a, b)` — throws if no `accepted` friendship between them. Reused by meeting actions.
- `getFriendBusy(userId, friendId)` — assert friends, then `getEventsInRange(friendId, today, today+7d)` mapped to `{ starts_at, ends_at }[]` only. No titles/notes/category leak.

## UI

### Friend profile — `src/app/(app)/friends/[id]/page.tsx`
- Server component: load friend summary (name/photo via accepted friendship) + `getFriendBusy`.
- Renders avatar, name, a 7-day busy grid (busy blocks only), and a "Предложить встречу" button that opens the meeting form.
- The friend rows on the Friends screen link here (`/friends/{user_id}`).

### Meeting form — `src/components/friends/meeting-form.tsx` (client)
Fields: title, duration (minutes), date window (from/to), part of day (morning/afternoon/evening/any). Calls `proposeMeeting`. Category defaults to `meeting`.

### Friends screen — `src/components/friends/friends-screen.tsx` (extend)
Add a **"Встречи"** section above friend requests:
- **Incoming** (`IncomingMeeting[]`): card with sender, title, window → "Принять" / "Отклонить".
- **Awaiting pick** (`AwaitingPick[]`): card with receiver, title → "Выбрать время" → calls `getMeetingSlots`, shows the returned slots as buttons → tapping one calls `confirmMeeting`.

The Friends page passes the two new lists alongside the existing friends/requests.

## Security & Edge Cases

- Every meeting action asserts an `accepted` friendship and that the caller is the correct participant for the transition.
- `confirmMeeting` re-checks both calendars at confirm time; a slot that became busy yields a friendly error rather than a double-booking.
- `getFriendBusy` returns intervals only — never event content.
- No self-proposals (`check (from_user_id <> to_user_id)` + action guard).
- Status guards make repeated calls idempotent (e.g., accepting an already-accepted proposal matches no `pending` row).
- Empty mutual working window or no free slot → the initiator sees "нет общих свободных окон" and can adjust the window.

## Out of Scope (v1)

- Cancelling or rescheduling a `confirmed` meeting.
- Push / Telegram notifications for new proposals.
- Cross-timezone scheduling.
- Group meetings (>2 participants).

## Spec Coverage Check

- ✅ Friend profile with busyness — `getFriendBusy` + profile page (busy-only grid).
- ✅ Propose a meeting — meeting form + `proposeMeeting`.
- ✅ Receiver accept/decline — `acceptMeeting` / `declineMeeting`.
- ✅ AI finds free-for-both time(s) — `findMutualSlots` reusing `findSlots`, `count = 5`.
- ✅ Initiator picks final, written to both calendars — `getMeetingSlots` + `confirmMeeting` (two `insertEvent`).
- ✅ Privacy, friendship checks, fresh-availability re-verification — Security section.
