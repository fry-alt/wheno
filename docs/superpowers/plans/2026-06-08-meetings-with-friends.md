# Meetings with Friends (Layer 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a friend's profile, propose a meeting; once the friend accepts, the AI suggests times free for both, the initiator picks one, and the event is written into both calendars.

**Architecture:** A `meeting_proposals` table holds a small state machine (`pending → accepted → confirmed`, plus `declined`). Mutual free slots reuse the existing single-user `findSlots` engine by merging both users' busy events into one list and intersecting their working hours. All mutations go through the service-role admin client, scoped to the acting participant and gated on an `accepted` friendship.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase, `date-fns` / `date-fns-tz`, Vitest.

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `src/lib/meetings/types.ts` | `MeetingStatus`, `MeetingProposal`, `IncomingMeeting`, `AwaitingPick`, `MeetingFormInput` |
| `src/lib/meetings/find-mutual-slots.ts` | `intersectDayHours` (pure) + `findMutualSlots` (fetch both calendars → `findSlots`) |
| `src/lib/meetings/find-mutual-slots.test.ts` | unit test for `intersectDayHours` |
| `src/lib/meetings/queries.ts` | proposal CRUD, incoming/awaiting lists, status transitions |
| `src/lib/meetings/actions.ts` | `proposeMeeting`, `accept/declineMeeting`, `getMeetingSlots`, `confirmMeeting` |
| `src/components/friends/meeting-form.tsx` | client form to propose a meeting |
| `src/components/friends/meetings-section.tsx` | client section: incoming invites + awaiting-pick with slot chooser |
| `src/app/(app)/friends/[id]/page.tsx` | friend profile: busy grid + propose form |
| `src/components/friends/busy-grid.tsx` | 7-day busy-only grid (client) |

### Modify
| File | Change |
|---|---|
| `supabase/schema.sql` | append `meeting_proposals` table |
| `src/lib/friends/queries.ts` | add `assertFriends`, `getFriendBusy`, `getFriendSummary` |
| `src/components/friends/friends-screen.tsx` | render `<MeetingsSection>`; link friend rows to `/friends/{id}` |
| `src/app/(app)/friends/page.tsx` | fetch + pass incoming/awaiting meeting lists |

---

## Task 1: Schema + meeting types

**Files:**
- Modify: `supabase/schema.sql`
- Create: `src/lib/meetings/types.ts`

- [ ] **Step 1: Append the table to `supabase/schema.sql`** (at end of file):

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

- [ ] **Step 2: Manual live-DB migration — SKIP during implementation.** The controller runs the same SQL above in the Supabase SQL editor once. You have no DB access; do not attempt it.

- [ ] **Step 3: Create `src/lib/meetings/types.ts`**:

```ts
import type { Category } from "@/lib/events/types";

export type MeetingStatus = "pending" | "accepted" | "confirmed" | "declined";
export type PartOfDay = "morning" | "afternoon" | "evening" | "any";

export interface MeetingProposal {
  id: string;
  from_user_id: string;
  to_user_id: string;
  title: string;
  category: Category;
  duration_min: number;
  window_from: string; // yyyy-MM-dd
  window_to: string;   // yyyy-MM-dd
  part_of_day: PartOfDay;
  status: MeetingStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface MeetingFormInput {
  title: string;
  duration_min: number;
  window_from: string; // yyyy-MM-dd
  window_to: string;   // yyyy-MM-dd
  part_of_day: PartOfDay;
}

export interface IncomingMeeting {
  proposal_id: string;
  from_name: string;
  from_photo_url: string | null;
  title: string;
  duration_min: number;
  window_from: string;
  window_to: string;
  part_of_day: PartOfDay;
}

export interface AwaitingPick {
  proposal_id: string;
  to_name: string;
  to_photo_url: string | null;
  title: string;
  duration_min: number;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/lib/meetings/types.ts
git commit -m "feat: meeting_proposals schema and meeting types"
```

---

## Task 2: Mutual-slot finder (TDD for hour intersection)

**Files:**
- Create: `src/lib/meetings/find-mutual-slots.ts`
- Test: `src/lib/meetings/find-mutual-slots.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/meetings/find-mutual-slots.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { intersectDayHours } from "./find-mutual-slots";

describe("intersectDayHours", () => {
  it("returns the overlapping window of two day-hour ranges", () => {
    expect(intersectDayHours("08:00", "22:00", "09:00", "18:00")).toEqual({
      start: "09:00",
      end: "18:00",
    });
  });

  it("clamps to the tighter bound on each side", () => {
    expect(intersectDayHours("07:00", "20:00", "10:00", "23:00")).toEqual({
      start: "10:00",
      end: "20:00",
    });
  });

  it("returns null when the windows do not overlap", () => {
    expect(intersectDayHours("08:00", "12:00", "13:00", "18:00")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run src/lib/meetings/find-mutual-slots.test.ts`
Expected: FAIL (module not found / `intersectDayHours` is not a function).

- [ ] **Step 3: Create `src/lib/meetings/find-mutual-slots.ts`**:

```ts
import { getDateRangeUtc } from "@/lib/datetime";
import { getEventsInRange } from "@/lib/events/queries";
import { findSlots } from "@/lib/advisor/find-slots";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { CalendarEvent } from "@/lib/events/types";
import type { ProposedSlot, SlotRequest } from "@/lib/advisor/types";

/** Overlap of two "HH:mm" day-hour windows, or null if they don't overlap. */
export function intersectDayHours(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start >= end) return null;
  return { start, end };
}

type DayPrefs = { day_start: string; day_end: string; timezone: string };

async function getDayPrefs(userId: string): Promise<DayPrefs> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("users")
    .select("day_start, day_end, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = (data as DayPrefs | null) ?? null;
  return {
    day_start: row?.day_start ?? "08:00",
    day_end: row?.day_end ?? "22:00",
    timezone: row?.timezone ?? "Europe/Amsterdam",
  };
}

/**
 * Find slots free for BOTH users within the request window.
 * v1: assumes a shared timezone — search runs in the initiator's timezone
 * and the intersection of both working-hour windows.
 */
export async function findMutualSlots(
  initiatorId: string,
  friendId: string,
  request: SlotRequest,
): Promise<ProposedSlot[]> {
  const [me, friend] = await Promise.all([getDayPrefs(initiatorId), getDayPrefs(friendId)]);
  const hours = intersectDayHours(me.day_start, me.day_end, friend.day_start, friend.day_end);
  if (!hours) return [];

  const { start, end } = getDateRangeUtc(request.window.from, request.window.to, me.timezone);
  const [myEvents, friendEvents] = await Promise.all([
    getEventsInRange(initiatorId, start, end, me.timezone),
    getEventsInRange(friendId, start, end, me.timezone),
  ]);
  const busy = [...myEvents, ...friendEvents] as CalendarEvent[];

  return findSlots(request, busy, hours, me.timezone);
}
```

- [ ] **Step 4: Run — verify PASS**

Run: `npx vitest run src/lib/meetings/find-mutual-slots.test.ts`
Expected: PASS (3 tests).
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meetings/find-mutual-slots.ts src/lib/meetings/find-mutual-slots.test.ts
git commit -m "feat: mutual-slot finder reusing single-user slot engine"
```

---

## Task 3: Friends-query additions (assert, busy, summary)

**Files:**
- Modify: `src/lib/friends/queries.ts`

- [ ] **Step 1: Add three functions to the end of `src/lib/friends/queries.ts`**:

```ts
export async function assertFriends(a: string, b: string): Promise<void> {
  const friendship = await findFriendshipBetween(a, b);
  if (!friendship || friendship.status !== "accepted") {
    throw new Error("Вы не друзья");
  }
}

export async function getFriendSummary(
  userId: string,
  friendId: string,
): Promise<FriendSummary | null> {
  const friendship = await findFriendshipBetween(userId, friendId);
  if (!friendship || friendship.status !== "accepted") return null;
  const users = await fetchUsers([friendId]);
  const u = users.get(friendId);
  return {
    user_id: friendId,
    name: u ? getDisplayName(u) : "Друг",
    username: u?.username ?? null,
    photo_url: u?.photo_url ?? null,
    friendship_id: friendship.id,
  };
}

/** Busy intervals only (no titles/notes) for the friend's next 7 days. */
export async function getFriendBusy(
  userId: string,
  friendId: string,
): Promise<{ starts_at: string; ends_at: string }[]> {
  await assertFriends(userId, friendId);
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("users")
    .select("timezone")
    .eq("id", friendId)
    .maybeSingle();
  const timezone = (data as { timezone: string | null } | null)?.timezone ?? "Europe/Amsterdam";
  const from = getLocalDateValue(timezone, 0);
  const to = getLocalDateValue(timezone, 6);
  const { start, end } = getDateRangeUtc(from, to, timezone);
  const events = await getEventsInRange(friendId, start, end, timezone);
  return events.map((e) => ({ starts_at: e.starts_at, ends_at: e.ends_at }));
}
```

- [ ] **Step 2: Add the needed imports** at the top of `src/lib/friends/queries.ts` (the file already imports `getAdminSupabase`, `getDisplayName`, and its `./types`; add these):

```ts
import { getDateRangeUtc, getLocalDateValue } from "@/lib/datetime";
import { getEventsInRange } from "@/lib/events/queries";
```

Note: `fetchUsers`, `findFriendshipBetween`, and `FriendSummary` already exist in this file — reuse them, do not redefine.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all pass (no behavior change to existing tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/friends/queries.ts
git commit -m "feat: friend assert, busy intervals, and single-friend summary"
```

---

## Task 4: Meeting queries (CRUD + lists + transitions)

**Files:**
- Create: `src/lib/meetings/queries.ts`

- [ ] **Step 1: Create `src/lib/meetings/queries.ts`**:

```ts
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDisplayName } from "@/lib/utils";
import type {
  AwaitingPick,
  IncomingMeeting,
  MeetingProposal,
  MeetingStatus,
} from "./types";

const COLUMNS =
  "id, from_user_id, to_user_id, title, category, duration_min, window_from, window_to, part_of_day, status, starts_at, ends_at, created_at";

type NewProposal = {
  from_user_id: string;
  to_user_id: string;
  title: string;
  category: string;
  duration_min: number;
  window_from: string;
  window_to: string;
  part_of_day: string;
};

export async function createProposal(input: NewProposal): Promise<string> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .insert(input as unknown as Record<string, unknown>)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create proposal");
  return (data as { id: string }).id;
}

export async function getProposal(id: string): Promise<MeetingProposal | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MeetingProposal | null) ?? null;
}

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  telegram_id: string;
};

async function fetchUsers(ids: string[]): Promise<Map<string, UserRow>> {
  if (ids.length === 0) return new Map();
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("users")
    .select("id, first_name, last_name, username, photo_url, telegram_id")
    .in("id", ids);
  return new Map(((data ?? []) as UserRow[]).map((u) => [u.id, u]));
}

export async function listIncomingMeetings(userId: string): Promise<IncomingMeeting[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .select(COLUMNS)
    .eq("to_user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MeetingProposal[];
  const users = await fetchUsers(rows.map((r) => r.from_user_id));
  return rows.map((r) => {
    const u = users.get(r.from_user_id);
    return {
      proposal_id: r.id,
      from_name: u ? getDisplayName(u) : "Кто-то",
      from_photo_url: u?.photo_url ?? null,
      title: r.title,
      duration_min: r.duration_min,
      window_from: r.window_from,
      window_to: r.window_to,
      part_of_day: r.part_of_day,
    };
  });
}

export async function listAwaitingPick(userId: string): Promise<AwaitingPick[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .select(COLUMNS)
    .eq("from_user_id", userId)
    .eq("status", "accepted");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MeetingProposal[];
  const users = await fetchUsers(rows.map((r) => r.to_user_id));
  return rows.map((r) => {
    const u = users.get(r.to_user_id);
    return {
      proposal_id: r.id,
      to_name: u ? getDisplayName(u) : "Друг",
      to_photo_url: u?.photo_url ?? null,
      title: r.title,
      duration_min: r.duration_min,
    };
  });
}

/** Receiver-scoped transition from `pending`. Matches no row if not allowed. */
export async function setIncomingStatus(
  userId: string,
  proposalId: string,
  status: Extract<MeetingStatus, "accepted" | "declined">,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("meeting_proposals")
    .update({ status })
    .eq("id", proposalId)
    .eq("to_user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

/** Initiator-scoped: stamp the chosen slot and mark confirmed, from `accepted`. */
export async function confirmProposalSlot(
  userId: string,
  proposalId: string,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("meeting_proposals")
    .update({ status: "confirmed", starts_at: startsAt, ends_at: endsAt })
    .eq("id", proposalId)
    .eq("from_user_id", userId)
    .eq("status", "accepted");
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/meetings/queries.ts
git commit -m "feat: meeting proposal queries (create, lists, transitions)"
```

---

## Task 5: Meeting server actions

**Files:**
- Create: `src/lib/meetings/actions.ts`

- [ ] **Step 1: Create `src/lib/meetings/actions.ts`**:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { assertFriends } from "@/lib/friends/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { getEventsInRange, insertEvent } from "@/lib/events/queries";
import { getUserById } from "@/lib/users";
import { getDisplayName } from "@/lib/utils";
import { findMutualSlots } from "./find-mutual-slots";
import {
  confirmProposalSlot,
  createProposal,
  getProposal,
  setIncomingStatus,
} from "./queries";
import type { MeetingFormInput } from "./types";
import type { ProposedSlot, SlotRequest } from "@/lib/advisor/types";

const MAX_CANDIDATES = 5;

export async function proposeMeeting(friendId: string, form: MeetingFormInput): Promise<void> {
  const user = await requireCurrentUser();
  if (friendId === user.id) throw new Error("Нельзя пригласить самого себя");
  await assertFriends(user.id, friendId);

  const title = form.title.trim() || "Встреча";
  if (form.duration_min <= 0) throw new Error("Длительность должна быть больше нуля");
  if (form.window_from > form.window_to) throw new Error("Период указан неверно");

  await createProposal({
    from_user_id: user.id,
    to_user_id: friendId,
    title,
    category: "meeting",
    duration_min: form.duration_min,
    window_from: form.window_from,
    window_to: form.window_to,
    part_of_day: form.part_of_day,
  });
  revalidatePath("/friends");
}

export async function acceptMeeting(proposalId: string): Promise<void> {
  const user = await requireCurrentUser();
  await setIncomingStatus(user.id, proposalId, "accepted");
  revalidatePath("/friends");
}

export async function declineMeeting(proposalId: string): Promise<void> {
  const user = await requireCurrentUser();
  await setIncomingStatus(user.id, proposalId, "declined");
  revalidatePath("/friends");
}

export async function getMeetingSlots(proposalId: string): Promise<ProposedSlot[]> {
  const user = await requireCurrentUser();
  const proposal = await getProposal(proposalId);
  if (!proposal || proposal.from_user_id !== user.id || proposal.status !== "accepted") {
    throw new Error("Встреча недоступна");
  }
  const request: SlotRequest = {
    title: proposal.title,
    category: proposal.category,
    count: MAX_CANDIDATES,
    duration_min: proposal.duration_min,
    window: { from: proposal.window_from, to: proposal.window_to },
    part_of_day: proposal.part_of_day,
  };
  return findMutualSlots(user.id, proposal.to_user_id, request);
}

function overlaps(events: { starts_at: string; ends_at: string }[], startMs: number, endMs: number) {
  return events.some((e) => {
    const s = new Date(e.starts_at).getTime();
    const en = new Date(e.ends_at).getTime();
    return startMs < en && endMs > s;
  });
}

export async function confirmMeeting(proposalId: string, slot: ProposedSlot): Promise<void> {
  const user = await requireCurrentUser();
  const proposal = await getProposal(proposalId);
  if (!proposal || proposal.from_user_id !== user.id || proposal.status !== "accepted") {
    throw new Error("Встреча недоступна");
  }
  const friendId = proposal.to_user_id;

  // Re-verify the slot is still free for BOTH (availability may have changed).
  const me = await getUserById(user.id);
  const timezone = me?.timezone ?? "Europe/Amsterdam";
  const { start, end } = getDateRangeUtc(slot.date, slot.date, timezone);
  const [myEvents, friendEvents] = await Promise.all([
    getEventsInRange(user.id, start, end, timezone),
    getEventsInRange(friendId, start, end, timezone),
  ]);
  const startMs = new Date(slot.starts_at).getTime();
  const endMs = new Date(slot.ends_at).getTime();
  if (overlaps(myEvents, startMs, endMs) || overlaps(friendEvents, startMs, endMs)) {
    throw new Error("Это время уже занято — выбери другое");
  }

  const friend = await getUserById(friendId);
  const friendName = friend ? getDisplayName(friend) : "другом";
  const myName = me ? getDisplayName(me) : "другом";

  await insertEvent({
    user_id: user.id,
    title: proposal.title,
    category: "meeting",
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    is_fixed: true,
    notes: `Встреча с ${friendName}`,
    location: null,
  });
  await insertEvent({
    user_id: friendId,
    title: proposal.title,
    category: "meeting",
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    is_fixed: true,
    notes: `Встреча с ${myName}`,
    location: null,
  });

  await confirmProposalSlot(user.id, proposalId, slot.starts_at, slot.ends_at);
  revalidatePath("/calendar");
  revalidatePath("/friends");
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. (`getUserById` returns the `AppUser` row with `timezone`; if its type lacks `timezone`, the `?? "Europe/Amsterdam"` fallback handles `undefined`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/meetings/actions.ts
git commit -m "feat: meeting actions (propose, accept/decline, slots, confirm)"
```

---

## Task 6: Friend profile page + busy grid + meeting form

**Files:**
- Create: `src/components/friends/busy-grid.tsx`
- Create: `src/components/friends/meeting-form.tsx`
- Create: `src/app/(app)/friends/[id]/page.tsx`

- [ ] **Step 1: Create `src/components/friends/busy-grid.tsx`**:

```tsx
"use client";

import { formatInTimeZone } from "date-fns-tz";

export function BusyGrid({
  busy,
  timezone,
}: {
  busy: { starts_at: string; ends_at: string }[];
  timezone: string;
}) {
  // Group busy intervals by local day (next 7 days).
  const days: { date: string; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = formatInTimeZone(d, timezone, "yyyy-MM-dd");
    const label = formatInTimeZone(d, timezone, "EEE d");
    days.push({ date, label });
  }

  const byDay = new Map<string, { from: string; to: string }[]>();
  for (const b of busy) {
    const date = formatInTimeZone(b.starts_at, timezone, "yyyy-MM-dd");
    const from = formatInTimeZone(b.starts_at, timezone, "HH:mm");
    const to = formatInTimeZone(b.ends_at, timezone, "HH:mm");
    const list = byDay.get(date) ?? [];
    list.push({ from, to });
    byDay.set(date, list);
  }

  return (
    <div className="space-y-2">
      {days.map((d) => {
        const blocks = (byDay.get(d.date) ?? []).sort((a, b) => a.from.localeCompare(b.from));
        return (
          <div key={d.date} className="flex items-start gap-3">
            <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold uppercase text-[#555]">{d.label}</span>
            {blocks.length === 0 ? (
              <span className="text-xs text-[#3a9f6a]">свободен весь день</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {blocks.map((b, i) => (
                  <span key={i} className="rounded-md bg-[#2a2a2a] px-2 py-0.5 text-xs text-[#999]">
                    {b.from}–{b.to}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/friends/meeting-form.tsx`**:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { proposeMeeting } from "@/lib/meetings/actions";
import type { PartOfDay } from "@/lib/meetings/types";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MeetingForm({ friendId }: { friendId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(60);
  const [from, setFrom] = useState(todayPlus(0));
  const [to, setTo] = useState(todayPlus(6));
  const [part, setPart] = useState<PartOfDay>("any");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending) return;
    startTransition(async () => {
      try {
        await proposeMeeting(friendId, {
          title,
          duration_min: duration,
          window_from: from,
          window_to: to,
          part_of_day: part,
        });
        setMsg("Приглашение отправлено");
        setTitle("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Не получилось");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
      >
        Предложить встречу
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-[#1a1a1a] px-4 py-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название (напр. Кофе)"
        className="w-full rounded-xl bg-[#0f0f0f] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#555]"
      />
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-[#999]">
          Длительность
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full rounded-xl bg-[#0f0f0f] px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value={30}>30 мин</option>
            <option value={60}>1 час</option>
            <option value={90}>1.5 часа</option>
            <option value={120}>2 часа</option>
          </select>
        </label>
        <label className="flex-1 text-xs text-[#999]">
          Время дня
          <select
            value={part}
            onChange={(e) => setPart(e.target.value as PartOfDay)}
            className="mt-1 w-full rounded-xl bg-[#0f0f0f] px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="any">Любое</option>
            <option value="morning">Утро</option>
            <option value="afternoon">День</option>
            <option value="evening">Вечер</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-[#999]">
          С
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl bg-[#0f0f0f] px-3 py-2.5 text-sm text-white outline-none" />
        </label>
        <label className="flex-1 text-xs text-[#999]">
          По
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl bg-[#0f0f0f] px-3 py-2.5 text-sm text-white outline-none" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={pending} className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
          Отправить
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl bg-[#2a2a2a] px-4 py-2.5 text-sm text-[#999]">
          Отмена
        </button>
      </div>
      {msg && <p className="text-xs text-[#999]">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/friends/[id]/page.tsx`**:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { BusyGrid } from "@/components/friends/busy-grid";
import { MeetingForm } from "@/components/friends/meeting-form";
import { getCurrentUser } from "@/lib/auth";
import { getFriendBusy, getFriendSummary } from "@/lib/friends/queries";
import { getInitials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FriendProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const friend = await getFriendSummary(user.id, id);
  if (!friend) notFound();

  const busy = await getFriendBusy(user.id, id);
  const timezone = user.timezone ?? "Europe/Amsterdam";

  return (
    <div className="px-4 pt-5">
      <Link href="/friends" className="mb-4 inline-block text-sm text-[#555]">← Друзья</Link>

      <div className="mb-5 flex items-center gap-3">
        {friend.photo_url ? (
          <img src={friend.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2a2a2a] text-lg font-semibold text-white">
            {getInitials(friend.name)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">{friend.name}</h1>
          {friend.username && <p className="truncate text-sm text-[#555]">@{friend.username}</p>}
        </div>
      </div>

      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Занятость · 7 дней</p>
        <BusyGrid busy={busy} timezone={timezone} />
      </section>

      <MeetingForm friendId={friend.user_id} />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx next build`
Expected: succeeds; route list includes `/friends/[id]`.

- [ ] **Step 5: Commit**

```bash
git add src/components/friends/busy-grid.tsx src/components/friends/meeting-form.tsx "src/app/(app)/friends/[id]"
git commit -m "feat: friend profile with busy grid and meeting proposal form"
```

---

## Task 7: Meetings section on the Friends screen + page wiring

**Files:**
- Create: `src/components/friends/meetings-section.tsx`
- Modify: `src/components/friends/friends-screen.tsx`
- Modify: `src/app/(app)/friends/page.tsx`

- [ ] **Step 1: Create `src/components/friends/meetings-section.tsx`**:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { acceptMeeting, declineMeeting, getMeetingSlots, confirmMeeting } from "@/lib/meetings/actions";
import type { AwaitingPick, IncomingMeeting } from "@/lib/meetings/types";
import type { ProposedSlot } from "@/lib/advisor/types";

function fmt(slot: ProposedSlot): string {
  const d = new Date(slot.starts_at);
  const e = new Date(slot.ends_at);
  const date = d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  const t = (x: Date) => x.toTimeString().slice(0, 5);
  return `${date}, ${t(d)}–${t(e)}`;
}

export function MeetingsSection({
  incoming,
  awaiting,
}: {
  incoming: IncomingMeeting[];
  awaiting: AwaitingPick[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  const [slots, setSlots] = useState<ProposedSlot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  if (incoming.length === 0 && awaiting.length === 0) return null;

  function act(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  function loadSlots(proposalId: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        const result = await getMeetingSlots(proposalId);
        setSlots(result);
        setSlotsFor(proposalId);
        if (result.length === 0) setMsg("Нет общих свободных окон — измените период");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  function pick(proposalId: string, slot: ProposedSlot) {
    startTransition(async () => {
      try {
        await confirmMeeting(proposalId, slot);
        setSlotsFor(null);
        setSlots([]);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Ошибка");
      }
    });
  }

  return (
    <section className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Встречи</p>
      <div className="space-y-2">
        {incoming.map((m) => (
          <div key={m.proposal_id} className="rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <p className="text-sm text-white">{m.from_name}: «{m.title}»</p>
            <p className="mb-2 text-xs text-[#555]">{m.duration_min} мин · {m.window_from} – {m.window_to}</p>
            <div className="flex gap-2">
              <button disabled={pending} onClick={() => act(() => acceptMeeting(m.proposal_id))} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Принять</button>
              <button disabled={pending} onClick={() => act(() => declineMeeting(m.proposal_id))} className="rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-xs text-[#999] disabled:opacity-50">Отклонить</button>
            </div>
          </div>
        ))}

        {awaiting.map((m) => (
          <div key={m.proposal_id} className="rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <p className="text-sm text-white">«{m.title}» с {m.to_name}</p>
            <p className="mb-2 text-xs text-[#3a9f6a]">принято — выбери время</p>
            {slotsFor === m.proposal_id ? (
              <div className="space-y-1.5">
                {slots.map((s, i) => (
                  <button key={i} disabled={pending} onClick={() => pick(m.proposal_id, s)} className="block w-full rounded-lg bg-[#2a2a2a] px-3 py-2 text-left text-xs text-white disabled:opacity-50">
                    {fmt(s)}
                  </button>
                ))}
              </div>
            ) : (
              <button disabled={pending} onClick={() => loadSlots(m.proposal_id)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Выбрать время</button>
            )}
          </div>
        ))}
      </div>
      {msg && <p className="mt-2 text-xs text-[#999]">{msg}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Wire `MeetingsSection` into `src/components/friends/friends-screen.tsx`.**

Add the import near the other imports:
```tsx
import { MeetingsSection } from "@/components/friends/meetings-section";
import type { AwaitingPick, IncomingMeeting } from "@/lib/meetings/types";
```

Extend the component props (the current signature is `{ friends, requests, myCode }`):
```tsx
export function FriendsScreen({
  friends,
  requests,
  myCode,
  incomingMeetings,
  awaitingPicks,
}: {
  friends: FriendSummary[];
  requests: IncomingRequest[];
  myCode: string;
  incomingMeetings: IncomingMeeting[];
  awaitingPicks: AwaitingPick[];
}) {
```

Render the section just above the existing `{requests.length > 0 && (...)}` block:
```tsx
      <MeetingsSection incoming={incomingMeetings} awaiting={awaitingPicks} />
```

Make each friend row a link to the profile. Replace the friend-row `<div ...>` opening tag and its closing `</div>` in the friends list with an anchor wrapper — concretely, change the friend `.map` body to:
```tsx
              <Link
                key={f.friendship_id}
                href={`/friends/${f.user_id}`}
                className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5"
              >
                <Avatar name={f.name} src={f.photo_url} />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                <button
                  onClick={(e) => { e.preventDefault(); startTransition(async () => { await removeFriend(f.friendship_id); router.refresh(); }); }}
                  className="text-xs text-[#555]"
                  aria-label="Удалить"
                >
                  ✕
                </button>
              </Link>
```
And add the Link import at the top:
```tsx
import Link from "next/link";
```

- [ ] **Step 3: Wire the page — `src/app/(app)/friends/page.tsx`.**

Add imports:
```tsx
import { listIncomingMeetings, listAwaitingPick } from "@/lib/meetings/queries";
```

Extend the parallel fetch and the render. Replace the existing `Promise.all([...])` + `return <FriendsScreen .../>` with:
```tsx
  const [friends, requests, myCode, incomingMeetings, awaitingPicks] = await Promise.all([
    listFriends(user.id),
    listIncomingRequests(user.id),
    ensureInviteCodeForUser(user.id),
    listIncomingMeetings(user.id),
    listAwaitingPick(user.id),
  ]);

  return (
    <FriendsScreen
      friends={friends}
      requests={requests}
      myCode={myCode}
      incomingMeetings={incomingMeetings}
      awaitingPicks={awaitingPicks}
    />
  );
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all pass.
Run: `npx next build`
Expected: succeeds; routes include `/friends`, `/friends/[id]`.

- [ ] **Step 5: Commit**

```bash
git add src/components/friends/meetings-section.tsx src/components/friends/friends-screen.tsx "src/app/(app)/friends/page.tsx"
git commit -m "feat: meetings section on friends screen with slot picker"
```

---

## Self-Review

**Spec coverage:**
- ✅ Friend busyness profile (busy-only, 7 days) — Task 3 (`getFriendBusy`), Task 6 (`BusyGrid`, profile page).
- ✅ Propose a meeting — Task 6 (`MeetingForm`), Task 5 (`proposeMeeting`).
- ✅ Receiver accept/decline — Task 5 (`acceptMeeting`/`declineMeeting`), Task 7 (incoming cards).
- ✅ AI finds free-for-both slots — Task 2 (`findMutualSlots` reusing `findSlots`, `count = 5`).
- ✅ Initiator picks final → both calendars — Task 5 (`getMeetingSlots`, `confirmMeeting` with two `insertEvent`), Task 7 (slot picker).
- ✅ State machine `pending → accepted → confirmed` + `declined` — Task 1 (schema), Task 4 (transitions).
- ✅ Privacy + friendship gating + fresh-availability re-check — Task 3 (`assertFriends`, intervals only), Task 5 (re-verify before insert).

**Placeholders:** none — every step has complete code. (Task 5 Step 2 explicitly removes the only scaffolding lines.)

**Type consistency:** `MeetingProposal`/`MeetingFormInput`/`IncomingMeeting`/`AwaitingPick`/`PartOfDay`/`MeetingStatus` defined in Task 1, consumed by queries (4), actions (5), components (6, 7). `findMutualSlots(initiatorId, friendId, request)` (Task 2) called by `getMeetingSlots` (Task 5). `SlotRequest`/`ProposedSlot` are the existing advisor types. `getFriendSummary` returns the existing `FriendSummary` shape (Task 3) used by the profile page (Task 6). `proposeMeeting(friendId, form)` (Task 5) matches the `MeetingForm` call (Task 6). The Friends page passes `incomingMeetings`/`awaitingPicks` (Task 7 Step 3) matching the extended `FriendsScreen` props (Task 7 Step 2).

**Edge cases covered:** self-proposal rejected (action + DB check); non-friends rejected (`assertFriends`); status guards make repeated accept/decline/confirm no-ops; empty mutual hours or no slot → "нет общих свободных окон"; slot taken between compute and confirm → friendly error, no double-book; busy intervals never leak titles.
