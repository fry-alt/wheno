# Public Activities + Discovery Feed + Join — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Pure logic is TDD'd (Vitest); DB/actions/components verified via `tsc`/`lint`/`build` + live screenshots. The four tables are created manually in Supabase (deploy gotcha).

**Goal:** Ship the social loop — host a public activity, discover it in a feed with a "fits my free time" badge, join (materializing it into the calendar), with host notifications and report/block safety.

**Architecture:** Four new tables (`activities`, `activity_participants`, `user_blocks`, `activity_reports`). Joining inserts a normal `events` row (so free/busy "just works") and stores its id on the participant. Pure feed/join logic is TDD'd; server actions reuse `insertEvent`/`deleteEventById`/`notifyUser`. A `/activities` tab (feed + create) and `/activities/[id]` (detail) host the UX.

**Tech Stack:** Next.js 16 App Router (`force-dynamic`, server actions), React 19, Supabase admin client, date-fns / date-fns-tz, Vitest, Tailwind tokens.

**Spec:** `docs/superpowers/specs/2026-06-11-public-activities-design.md`

---

## File structure

**New:**
- `src/lib/activities/types.ts` — `Activity`, `Visibility`, `ActivityStatus`, `ActivityButtonState`, `ParticipantView`, `ActivityCardData`.
- `src/lib/activities/state.ts` (+ `.test.ts`) — pure: `isFull`, `isFreeDuring`, `canJoin`, `activityButtonState`.
- `src/lib/activities/queries.ts` — activity/participant DB + feed assembly + free-check.
- `src/lib/activities/actions.ts` — create/join/leave/cancel/report/block server actions.
- `src/lib/safety/queries.ts` — blocks + reports DB.
- `src/components/activities/{activities-screen,activity-card,activity-form,activity-detail,participant-list}.tsx`.
- `src/app/(app)/activities/page.tsx`, `src/app/(app)/activities/[id]/page.tsx`.

**Modified:**
- `supabase/schema.sql` — four tables.
- `src/components/bottom-nav.tsx` — 5th tab 🤸.

**Conventions:** Russian labels hardcoded. Don't touch `src/lib/i18n.ts`. Per-task verify: `npm test` (logic), `npx tsc --noEmit` + `npx eslint <files>` (rest), `npm run build` at checkpoints.

**Reused APIs (verified):** `insertEvent(NewEvent): Promise<string>` and `deleteEventById(userId, id)` from `@/lib/events/queries`; `notifyUser(userId, text)` from `@/lib/telegram/notify`; `toUtcDateFromLocalParts(date, time, tz)` from `@/lib/datetime`; `interestLabel`/`INTEREST_TAGS` from `@/lib/profile/interests`; friendships use `requester_id`/`addressee_id` + `status='accepted'`.

---

## Task 1: Activity types

**Files:** Create `src/lib/activities/types.ts`

- [ ] **Step 1: Implement**:

```ts
export type Visibility = "public" | "friends";
export type ActivityStatus = "open" | "cancelled";
export type ActivityButtonState = "host" | "joined" | "full" | "past" | "cancelled" | "join";

export interface Activity {
  id: string;
  host_id: string;
  title: string;
  type: string;          // interest slug or custom
  description: string | null;
  place: string | null;
  starts_at: string;     // ISO
  ends_at: string;       // ISO
  capacity: number | null;
  visibility: Visibility;
  status: ActivityStatus;
  created_at?: string;
}

export interface ParticipantView { user_id: string; name: string; photo_url: string | null }

export interface ActivityCardData {
  activity: Activity;
  hostName: string;
  hostPhoto: string | null;
  count: number;          // participants incl. host
  isHost: boolean;
  isParticipant: boolean;
  isFree: boolean;        // fits viewer's free time
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add src/lib/activities/types.ts
git commit -m "feat: activity types"
```

---

## Task 2: Pure feed/join logic (TDD)

**Files:** Create `src/lib/activities/state.ts`, `src/lib/activities/state.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/activities/state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isFull, isFreeDuring, canJoin, activityButtonState } from "./state";

describe("isFull", () => {
  it("null capacity is never full; otherwise count>=capacity", () => {
    expect(isFull(99, null)).toBe(false);
    expect(isFull(5, 6)).toBe(false);
    expect(isFull(6, 6)).toBe(true);
  });
});

describe("isFreeDuring", () => {
  const ev = [{ starts_at: "2026-06-12T10:00:00Z", ends_at: "2026-06-12T11:00:00Z" }];
  it("overlap → not free", () => {
    expect(isFreeDuring(ev, "2026-06-12T10:30:00Z", "2026-06-12T11:30:00Z")).toBe(false);
  });
  it("adjacent (touching) → free", () => {
    expect(isFreeDuring(ev, "2026-06-12T11:00:00Z", "2026-06-12T12:00:00Z")).toBe(true);
  });
  it("disjoint → free", () => {
    expect(isFreeDuring(ev, "2026-06-12T08:00:00Z", "2026-06-12T09:00:00Z")).toBe(true);
  });
});

const base = {
  isHost: false, isParticipant: false, count: 2, capacity: 6,
  status: "open" as const, startsAt: "2026-06-12T10:00:00Z", now: "2026-06-11T00:00:00Z", blocked: false,
};

describe("canJoin", () => {
  it("ok in the happy path", () => { expect(canJoin(base)).toEqual({ ok: true }); });
  it("blocks host/joined/full/past/cancelled/blocked with reasons", () => {
    expect(canJoin({ ...base, status: "cancelled" })).toEqual({ ok: false, reason: "cancelled" });
    expect(canJoin({ ...base, startsAt: "2026-06-10T10:00:00Z" })).toEqual({ ok: false, reason: "past" });
    expect(canJoin({ ...base, blocked: true })).toEqual({ ok: false, reason: "blocked" });
    expect(canJoin({ ...base, isHost: true })).toEqual({ ok: false, reason: "host" });
    expect(canJoin({ ...base, isParticipant: true })).toEqual({ ok: false, reason: "joined" });
    expect(canJoin({ ...base, count: 6 })).toEqual({ ok: false, reason: "full" });
  });
});

describe("activityButtonState", () => {
  const b = { isHost: false, isParticipant: false, count: 2, capacity: 6, status: "open" as const, startsAt: "2026-06-12T10:00:00Z", now: "2026-06-11T00:00:00Z" };
  it("derives the state", () => {
    expect(activityButtonState(b)).toBe("join");
    expect(activityButtonState({ ...b, status: "cancelled" })).toBe("cancelled");
    expect(activityButtonState({ ...b, isHost: true })).toBe("host");
    expect(activityButtonState({ ...b, isParticipant: true })).toBe("joined");
    expect(activityButtonState({ ...b, startsAt: "2026-06-10T10:00:00Z" })).toBe("past");
    expect(activityButtonState({ ...b, count: 6 })).toBe("full");
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- activities/state`. Expected: module not found.

- [ ] **Step 3: Implement** — `src/lib/activities/state.ts`:

```ts
import type { ActivityButtonState, ActivityStatus } from "./types";

export function isFull(count: number, capacity: number | null): boolean {
  return capacity != null && count >= capacity;
}

export interface Interval { starts_at: string; ends_at: string }

export function isFreeDuring(events: Interval[], start: string, end: string): boolean {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return !events.some((ev) => new Date(ev.starts_at).getTime() < e && new Date(ev.ends_at).getTime() > s);
}

export interface JoinCtx {
  isHost: boolean; isParticipant: boolean; count: number; capacity: number | null;
  status: ActivityStatus; startsAt: string; now: string; blocked: boolean;
}

export function canJoin(ctx: JoinCtx): { ok: true } | { ok: false; reason: string } {
  if (ctx.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (new Date(ctx.startsAt).getTime() <= new Date(ctx.now).getTime()) return { ok: false, reason: "past" };
  if (ctx.blocked) return { ok: false, reason: "blocked" };
  if (ctx.isHost) return { ok: false, reason: "host" };
  if (ctx.isParticipant) return { ok: false, reason: "joined" };
  if (isFull(ctx.count, ctx.capacity)) return { ok: false, reason: "full" };
  return { ok: true };
}

export interface ButtonCtx {
  isHost: boolean; isParticipant: boolean; count: number; capacity: number | null;
  status: ActivityStatus; startsAt: string; now: string;
}

export function activityButtonState(ctx: ButtonCtx): ActivityButtonState {
  if (ctx.status === "cancelled") return "cancelled";
  if (ctx.isHost) return "host";
  if (ctx.isParticipant) return "joined";
  if (new Date(ctx.startsAt).getTime() <= new Date(ctx.now).getTime()) return "past";
  if (isFull(ctx.count, ctx.capacity)) return "full";
  return "join";
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- activities/state`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activities/state.ts src/lib/activities/state.test.ts
git commit -m "feat: activity feed/join pure logic (TDD)"
```

---

## Task 3: Database schema

**Files:** Modify `supabase/schema.sql`

- [ ] **Step 1: Append** after the `profile_photos` block:

```sql
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  type        text not null,
  description text,
  place       text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  capacity    int,
  visibility  text not null default 'public',
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  constraint activities_time_order check (ends_at > starts_at)
);
create index if not exists activities_starts_idx on public.activities(starts_at);
alter table public.activities enable row level security;

create table if not exists public.activity_participants (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  event_id    uuid,
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

- [ ] **Step 2: Sanity** — `npm run build`. Expected: succeeds.
- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: activities, participants, blocks, reports tables"
```

---

## Task 4: Safety queries (blocks + reports)

**Files:** Create `src/lib/safety/queries.ts`

- [ ] **Step 1: Implement**:

```ts
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function blockedUserIds(userId: string): Promise<Set<string>> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of (data ?? []) as { blocker_id: string; blocked_id: string }[]) {
    set.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
  }
  return set;
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("user_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function insertBlock(blockerId: string, blockedId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("user_blocks").upsert(
    { blocker_id: blockerId, blocked_id: blockedId },
    { onConflict: "blocker_id,blocked_id" },
  );
  if (error) throw new Error(error.message);
}

export async function insertReport(reporterId: string, activityId: string, reason: string | null): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("activity_reports").insert({ reporter_id: reporterId, activity_id: activityId, reason });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/lib/safety/queries.ts`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add src/lib/safety/queries.ts
git commit -m "feat: safety queries (blocks + reports)"
```

---

## Task 5: Activity queries + feed assembly

**Files:** Create `src/lib/activities/queries.ts`

- [ ] **Step 1: Implement**:

```ts
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isFreeDuring } from "./state";
import { blockedUserIds } from "@/lib/safety/queries";
import type { Activity, ActivityCardData, ParticipantView, Visibility } from "./types";

const COLS = "id, host_id, title, type, description, place, starts_at, ends_at, capacity, visibility, status, created_at";

function displayName(u: { first_name: string | null; last_name: string | null; username: string | null }): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "—";
}

async function fetchUsers(ids: string[]): Promise<Map<string, { name: string; photo_url: string | null }>> {
  const map = new Map<string, { name: string; photo_url: string | null }>();
  if (ids.length === 0) return map;
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("users").select("id, first_name, last_name, username, photo_url").in("id", ids);
  if (error) throw new Error(error.message);
  for (const u of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; username: string | null; photo_url: string | null }[]) {
    map.set(u.id, { name: displayName(u), photo_url: u.photo_url });
  }
  return map;
}

async function friendIds(userId: string): Promise<Set<string>> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of (data ?? []) as { requester_id: string; addressee_id: string }[]) {
    set.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
  }
  return set;
}

export async function getActivity(id: string): Promise<Activity | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activities").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Activity | null) ?? null;
}

export async function createActivity(input: Omit<Activity, "id" | "status" | "created_at">): Promise<string> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activities").insert(input).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  return (data as { id: string }).id;
}

export async function cancelActivity(id: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("activities").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function participantRows(activityId: string): Promise<{ user_id: string; event_id: string | null }[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activity_participants").select("user_id, event_id").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as { user_id: string; event_id: string | null }[];
}

export async function participantViews(activityId: string): Promise<ParticipantView[]> {
  const rows = await participantRows(activityId);
  const users = await fetchUsers(rows.map((r) => r.user_id));
  return rows.map((r) => ({ user_id: r.user_id, name: users.get(r.user_id)?.name ?? "—", photo_url: users.get(r.user_id)?.photo_url ?? null }));
}

export async function insertParticipant(activityId: string, userId: string, eventId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("activity_participants").insert({ activity_id: activityId, user_id: userId, event_id: eventId });
  if (error) throw new Error(error.message);
}

export async function removeParticipant(activityId: string, userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activity_participants").select("event_id").eq("activity_id", activityId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const eventId = (data as { event_id: string | null } | null)?.event_id ?? null;
  const { error: delErr } = await admin.from("activity_participants").delete().eq("activity_id", activityId).eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
  return eventId;
}

async function userEventsInRange(userId: string, startIso: string, endIso: string): Promise<{ starts_at: string; ends_at: string }[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events").select("starts_at, ends_at").eq("user_id", userId)
    .lt("starts_at", endIso).gt("ends_at", startIso);
  if (error) throw new Error(error.message);
  return (data ?? []) as { starts_at: string; ends_at: string }[];
}

async function buildCards(userId: string, activities: Activity[], blocked: Set<string>): Promise<ActivityCardData[]> {
  const visible = activities.filter((a) => !blocked.has(a.host_id));
  if (visible.length === 0) return [];
  const ids = visible.map((a) => a.id);
  const hostIds = [...new Set(visible.map((a) => a.host_id))];

  const admin = getAdminSupabase();
  const { data: parts, error } = await admin.from("activity_participants").select("activity_id, user_id").in("activity_id", ids);
  if (error) throw new Error(error.message);
  const countByActivity = new Map<string, number>();
  const mine = new Set<string>();
  for (const p of (parts ?? []) as { activity_id: string; user_id: string }[]) {
    countByActivity.set(p.activity_id, (countByActivity.get(p.activity_id) ?? 0) + 1);
    if (p.user_id === userId) mine.add(p.activity_id);
  }

  const hosts = await fetchUsers(hostIds);
  const starts = visible.map((a) => a.starts_at).sort();
  const ends = visible.map((a) => a.ends_at).sort();
  const myEvents = await userEventsInRange(userId, starts[0], ends[ends.length - 1]);

  return visible.map((a) => ({
    activity: a,
    hostName: hosts.get(a.host_id)?.name ?? "—",
    hostPhoto: hosts.get(a.host_id)?.photo_url ?? null,
    count: countByActivity.get(a.id) ?? 0,
    isHost: a.host_id === userId,
    isParticipant: mine.has(a.id),
    isFree: isFreeDuring(myEvents, a.starts_at, a.ends_at),
  }));
}

export async function getFeed(userId: string, nowIso: string): Promise<ActivityCardData[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activities").select(COLS)
    .gte("starts_at", nowIso).eq("status", "open").order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Activity[];
  const friends = await friendIds(userId);
  const blocked = await blockedUserIds(userId);
  const reachable = all.filter((a) => a.visibility === "public" || a.host_id === userId || friends.has(a.host_id));
  return buildCards(userId, reachable, blocked);
}

export async function getMine(userId: string, nowIso: string): Promise<ActivityCardData[]> {
  const admin = getAdminSupabase();
  const { data: hosted, error: e1 } = await admin.from("activities").select(COLS)
    .eq("host_id", userId).gte("starts_at", nowIso).order("starts_at", { ascending: true });
  if (e1) throw new Error(e1.message);
  const { data: pRows, error: e2 } = await admin.from("activity_participants").select("activity_id").eq("user_id", userId);
  if (e2) throw new Error(e2.message);
  const joinedIds = [...new Set(((pRows ?? []) as { activity_id: string }[]).map((r) => r.activity_id))];
  let joined: Activity[] = [];
  if (joinedIds.length > 0) {
    const { data, error } = await admin.from("activities").select(COLS).in("id", joinedIds).gte("starts_at", nowIso);
    if (error) throw new Error(error.message);
    joined = (data ?? []) as Activity[];
  }
  const byId = new Map<string, Activity>();
  for (const a of [...((hosted ?? []) as Activity[]), ...joined]) byId.set(a.id, a);
  const merged = [...byId.values()].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  return buildCards(userId, merged, new Set());
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/lib/activities/queries.ts`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add src/lib/activities/queries.ts
git commit -m "feat: activity queries + feed assembly"
```

---

## Task 6: Server actions

**Files:** Create `src/lib/activities/actions.ts`

- [ ] **Step 1: Implement**:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { toUtcDateFromLocalParts } from "@/lib/datetime";
import { insertEvent, deleteEventById } from "@/lib/events/queries";
import { notifyUser } from "@/lib/telegram/notify";
import { canJoin } from "./state";
import {
  createActivity, getActivity, cancelActivity,
  participantRows, insertParticipant, removeParticipant,
} from "./queries";
import { isBlockedEitherWay, insertBlock, insertReport } from "@/lib/safety/queries";
import type { Visibility } from "./types";

export async function createActivityAction(input: {
  title: string; type: string; description?: string; place?: string;
  date: string; startTime: string; endTime: string; capacity?: number | null; visibility?: Visibility;
}): Promise<{ ok: boolean; id?: string }> {
  const user = await requireCurrentUser();
  if (!input.title.trim() || !input.type || !input.date || !input.startTime || !input.endTime) return { ok: false };
  const starts_at = toUtcDateFromLocalParts(input.date, input.startTime, user.timezone).toISOString();
  const ends_at = toUtcDateFromLocalParts(input.date, input.endTime, user.timezone).toISOString();
  if (ends_at <= starts_at) return { ok: false };

  const activityId = await createActivity({
    host_id: user.id, title: input.title.trim(), type: input.type,
    description: input.description?.trim() || null, place: input.place?.trim() || null,
    starts_at, ends_at, capacity: input.capacity ?? null, visibility: input.visibility ?? "public",
  });
  const eventId = await insertEvent({
    user_id: user.id, title: input.title.trim(), starts_at, ends_at,
    category: "social", is_fixed: true, notes: null, location: input.place?.trim() || null,
  });
  await insertParticipant(activityId, user.id, eventId);
  revalidatePath("/activities");
  revalidatePath("/calendar");
  return { ok: true, id: activityId };
}

export async function joinActivityAction(activityId: string): Promise<{ ok: boolean; reason?: string }> {
  const user = await requireCurrentUser();
  const activity = await getActivity(activityId);
  if (!activity) return { ok: false, reason: "missing" };
  const rows = await participantRows(activityId);
  const blocked = await isBlockedEitherWay(user.id, activity.host_id);
  const check = canJoin({
    isHost: activity.host_id === user.id,
    isParticipant: rows.some((r) => r.user_id === user.id),
    count: rows.length, capacity: activity.capacity, status: activity.status,
    startsAt: activity.starts_at, now: new Date().toISOString(), blocked,
  });
  if (!check.ok) return { ok: false, reason: check.reason };

  const eventId = await insertEvent({
    user_id: user.id, title: activity.title, starts_at: activity.starts_at, ends_at: activity.ends_at,
    category: "social", is_fixed: true, notes: null, location: activity.place,
  });
  await insertParticipant(activityId, user.id, eventId);
  await notifyUser(activity.host_id, `🤸 Кто-то идёт на «${activity.title}»`);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/calendar");
  return { ok: true };
}

export async function leaveActivityAction(activityId: string): Promise<void> {
  const user = await requireCurrentUser();
  const eventId = await removeParticipant(activityId, user.id);
  if (eventId) await deleteEventById(user.id, eventId);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/calendar");
}

export async function cancelActivityAction(activityId: string): Promise<void> {
  const user = await requireCurrentUser();
  const activity = await getActivity(activityId);
  if (!activity || activity.host_id !== user.id) return;
  const rows = await participantRows(activityId);
  await cancelActivity(activityId);
  for (const r of rows) {
    if (r.event_id) await deleteEventById(r.user_id, r.event_id);
    if (r.user_id !== user.id) await notifyUser(r.user_id, `❌ Активность «${activity.title}» отменена`);
  }
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/calendar");
}

export async function reportActivityAction(activityId: string, reason: string): Promise<void> {
  const user = await requireCurrentUser();
  await insertReport(user.id, activityId, reason.trim() || null);
}

export async function blockUserAction(blockedId: string): Promise<void> {
  const user = await requireCurrentUser();
  if (blockedId !== user.id) await insertBlock(user.id, blockedId);
  revalidatePath("/activities");
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/lib/activities/actions.ts`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add src/lib/activities/actions.ts
git commit -m "feat: activity server actions (create/join/leave/cancel/report/block)"
```

---

## Task 7: Components

**Files:** Create `src/components/activities/{activity-card,activity-form,participant-list,activity-detail,activities-screen}.tsx`

- [ ] **Step 1: `activity-card.tsx`**:

```tsx
"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { interestLabel } from "@/lib/profile/interests";
import { getInitials } from "@/lib/utils";
import type { ActivityCardData } from "@/lib/activities/types";

export function ActivityCard({ data, timezone }: { data: ActivityCardData; timezone: string }) {
  const a = data.activity;
  const when = formatInTimeZone(a.starts_at, timezone, "EEE d MMM, HH:mm", { locale: ru });
  const cap = a.capacity != null ? `${data.count}/${a.capacity}` : `${data.count}`;
  return (
    <Link href={`/activities/${a.id}`} className="block rounded-2xl border border-border bg-card px-4 py-3 transition active:scale-[0.99]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{interestLabel(a.type)}</span>
        {data.isFree && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">✓ свободен</span>}
      </div>
      <p className="mt-0.5 text-sm font-bold text-foreground">{a.title}</p>
      <p className="text-xs text-muted tabular-nums">{when}{a.place ? ` · ${a.place}` : ""}</p>
      <div className="mt-2 flex items-center gap-2">
        {data.hostPhoto ? (
          <img src={data.hostPhoto} alt="" className="h-5 w-5 rounded-full object-cover" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card-strong text-[8px] font-semibold text-foreground">{getInitials(data.hostName)}</span>
        )}
        <span className="text-xs text-muted">{data.hostName} · {cap} идут</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: `activity-form.tsx`**:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { INTEREST_TAGS } from "@/lib/profile/interests";
import { createActivityAction } from "@/lib/activities/actions";
import type { Visibility } from "@/lib/activities/types";

export function ActivityForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("running");
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [capacity, setCapacity] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [error, setError] = useState<string | null>(null);

  const inputCls = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none";

  function submit() {
    if (!title.trim() || !date) { setError("Заполни название и дату"); return; }
    start(async () => {
      const res = await createActivityAction({
        title, type, place, description, date, startTime, endTime,
        capacity: capacity ? Number(capacity) : null, visibility,
      });
      if (!res.ok || !res.id) { setError("Не получилось"); return; }
      router.push(`/activities/${res.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Новая активность</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название (теннис на корте)" className={inputCls} />
      <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
        {INTEREST_TAGS.map((t) => <option key={t.slug} value={t.slug}>{t.emoji} {t.label}</option>)}
      </select>
      <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Место" className={inputCls} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание (необязательно)" rows={2} className={inputCls} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      <div className="flex gap-2">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} flex-1`} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputCls} flex-1`} />
      </div>
      <div className="flex gap-2">
        <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Лимит (опц.)" className={`${inputCls} flex-1`} />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={`${inputCls} flex-1`}>
          <option value="public">Открытая</option>
          <option value="friends">Только друзья</option>
        </select>
      </div>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted">Отмена</button>
        <button onClick={submit} disabled={pending} className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          {pending ? "Создаю…" : "Создать"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `participant-list.tsx`**:

```tsx
import { getInitials } from "@/lib/utils";
import type { ParticipantView } from "@/lib/activities/types";

export function ParticipantList({ participants }: { participants: ParticipantView[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {participants.map((p) => (
        <div key={p.user_id} className="flex flex-col items-center gap-1">
          {p.photo_url ? (
            <img src={p.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card-strong text-xs font-semibold text-foreground">{getInitials(p.name)}</span>
          )}
          <span className="max-w-14 truncate text-[10px] text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `activity-detail.tsx`**:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { ParticipantList } from "./participant-list";
import { interestLabel } from "@/lib/profile/interests";
import { joinActivityAction, leaveActivityAction, cancelActivityAction, reportActivityAction, blockUserAction } from "@/lib/activities/actions";
import type { Activity, ActivityButtonState, ParticipantView } from "@/lib/activities/types";

const REASON: Record<string, string> = { full: "Мест нет", past: "Уже прошло", cancelled: "Отменена", host: "", joined: "", missing: "Не найдено", blocked: "Недоступно" };

export function ActivityDetail({
  activity, participants, state, isHost, timezone,
}: {
  activity: Activity; participants: ParticipantView[]; state: ActivityButtonState; isHost: boolean; timezone: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const when = formatInTimeZone(activity.starts_at, timezone, "EEEE d MMMM, HH:mm", { locale: ru });

  function act(fn: () => Promise<unknown>) { start(async () => { await fn(); router.refresh(); }); }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8">
      <div>
        <p className="text-sm font-semibold text-muted">{interestLabel(activity.type)}</p>
        <h1 className="text-2xl font-bold text-foreground">{activity.title}</h1>
        <p className="mt-1 text-sm text-muted tabular-nums">{when}{activity.place ? ` · ${activity.place}` : ""}</p>
      </div>
      {activity.description && <p className="text-sm text-foreground">{activity.description}</p>}

      <section className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Участники · {participants.length}{activity.capacity != null ? `/${activity.capacity}` : ""}</p>
        <ParticipantList participants={participants} />
      </section>

      {state === "join" && <button onClick={() => act(async () => { const r = await joinActivityAction(activity.id); if (!r.ok) setMsg(REASON[r.reason ?? ""] ?? "Не получилось"); })} disabled={pending} className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">Иду</button>}
      {state === "joined" && <button onClick={() => act(() => leaveActivityAction(activity.id))} disabled={pending} className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground">Выйти</button>}
      {state === "full" && <p className="rounded-xl border border-border bg-card py-3 text-center text-sm text-muted">Мест нет</p>}
      {state === "past" && <p className="rounded-xl border border-border bg-card py-3 text-center text-sm text-muted">Уже прошло</p>}
      {state === "cancelled" && <p className="rounded-xl border border-border bg-card py-3 text-center text-sm text-danger">Отменена</p>}
      {isHost && state !== "cancelled" && <button onClick={() => act(() => cancelActivityAction(activity.id))} disabled={pending} className="rounded-xl border border-danger/40 py-3 text-sm font-semibold text-danger">Отменить активность</button>}

      {!isHost && (
        <div className="flex gap-2">
          <button onClick={() => act(async () => { await reportActivityAction(activity.id, ""); setMsg("Жалоба отправлена"); })} className="flex-1 rounded-xl border border-border bg-card py-2 text-xs text-muted">Пожаловаться</button>
          <button onClick={() => act(async () => { await blockUserAction(activity.host_id); router.push("/activities"); })} className="flex-1 rounded-xl border border-border bg-card py-2 text-xs text-muted">Заблокировать хоста</button>
        </div>
      )}
      {msg && <p className="text-center text-xs text-muted">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 5: `activities-screen.tsx`**:

```tsx
"use client";

import { useState } from "react";
import { clsx } from "clsx";

import { ActivityCard } from "./activity-card";
import { ActivityForm } from "./activity-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { ActivityCardData } from "@/lib/activities/types";

export function ActivitiesScreen({
  feed, mine, timezone,
}: {
  feed: ActivityCardData[]; mine: ActivityCardData[]; timezone: string;
}) {
  const [tab, setTab] = useState<"feed" | "mine">("feed");
  const [creating, setCreating] = useState(false);
  const list = tab === "feed" ? feed : mine;

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="mb-4 flex gap-2">
        {(["feed", "mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("rounded-full px-4 py-1.5 text-sm font-semibold transition", tab === t ? "bg-card-strong text-foreground" : "text-muted")}>
            {t === "feed" ? "Лента" : "Мои"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">{tab === "feed" ? "Пока нет активностей" : "Ты ещё никуда не идёшь"}</p>
          <p className="mt-1 text-xs text-muted">Создай первую — нажми ➕</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((d) => <ActivityCard key={d.activity.id} data={d} timezone={timezone} />)}
        </div>
      )}

      <button onClick={() => setCreating(true)} className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground shadow-lg transition active:scale-95" aria-label="Создать">＋</button>

      {creating && (
        <BottomSheet onClose={() => setCreating(false)}>
          <ActivityForm onClose={() => setCreating(false)} />
        </BottomSheet>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/components/activities`. Expected: clean (pre-existing `<img>` warnings allowed).
- [ ] **Step 7: Commit**

```bash
git add src/components/activities
git commit -m "feat: activity components (card, form, detail, participants, screen)"
```

---

## Task 8: Routes + nav

**Files:** Create `src/app/(app)/activities/page.tsx`, `src/app/(app)/activities/[id]/page.tsx`; Modify `src/components/bottom-nav.tsx`

- [ ] **Step 1: Feed route** — `src/app/(app)/activities/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { ActivitiesScreen } from "@/components/activities/activities-screen";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, getMine } from "@/lib/activities/queries";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const now = new Date().toISOString();
  const [feed, mine] = await Promise.all([getFeed(user.id, now), getMine(user.id, now)]);
  return <ActivitiesScreen feed={feed} mine={mine} timezone={user.timezone} />;
}
```

- [ ] **Step 2: Detail route** — `src/app/(app)/activities/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";

import { ActivityDetail } from "@/components/activities/activity-detail";
import { getCurrentUser } from "@/lib/auth";
import { getActivity, participantRows, participantViews } from "@/lib/activities/queries";
import { activityButtonState } from "@/lib/activities/state";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const activity = await getActivity(id);
  if (!activity) notFound();

  const [rows, participants] = await Promise.all([participantRows(id), participantViews(id)]);
  const isHost = activity.host_id === user.id;
  const state = activityButtonState({
    isHost,
    isParticipant: rows.some((r) => r.user_id === user.id),
    count: rows.length,
    capacity: activity.capacity,
    status: activity.status,
    startsAt: activity.starts_at,
    now: new Date().toISOString(),
  });

  return <ActivityDetail activity={activity} participants={participants} state={state} isHost={isHost} timezone={user.timezone} />;
}
```

- [ ] **Step 3: Nav** — in `src/components/bottom-nav.tsx`, add to the `TABS` array after Профиль:

```tsx
  { href: "/activities", emoji: "🤸", label: "Движ" },
```

- [ ] **Step 4: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean; `/activities` and `/activities/[id]` appear.
- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/activities" src/components/bottom-nav.tsx
git commit -m "feat: /activities feed + detail routes + nav tab"
```

---

## Task 9: Verification + deploy gotcha

- [ ] **Step 1: Unit suite** — `npm test`. Expected: all pass (adds `activities/state` suite to existing 74).
- [ ] **Step 2: i18n + lint + build** — `npm run check:i18n && npm run lint && npm run build`. Expected: clean.
- [ ] **Step 3: Supabase setup (manual, required before prod works):** run the four `activities`/`activity_participants`/`user_blocks`/`activity_reports` table SQL from `supabase/schema.sql` in the Supabase SQL editor.
- [ ] **Step 4: Visual/behaviour pass** — run/verify on a real session: create an activity (it appears in your calendar + Мои); from a second user, see it in Лента with "✓ свободен", join (host gets a Telegram notification, it lands in joiner's calendar); leave; host cancels (participant notified, calendar event removed); report + block (blocked host's activities disappear from feed).
- [ ] **Step 5: Update backlog memory** — note cycle 2 shipped + the four-table manual setup gotcha; next social cycle is AI matching (cycle 3).
- [ ] **Step 6: Final commit (if polish)**

```bash
git add -A
git commit -m "polish: activities visual pass"
```

---

## Self-review notes
- **Spec coverage:** tables (T3), pure logic (T2), safety queries (T4), feed/free-fit/blocks (T5), create/join/leave/cancel/report/block + materialization + notify (T6), card/form/detail/participants/screen (T7), routes + 🤸 tab (T8), deploy gotcha (T9). All covered.
- **Type consistency:** `Activity`/`ActivityCardData`/`ParticipantView`/`ActivityButtonState`/`Visibility` from `types.ts` used identically across state, queries, actions, components, pages. `canJoin`/`activityButtonState` ctx shapes match call sites in actions (T6) and detail page (T8). `removeParticipant` returns `event_id` consumed by `leaveActivityAction`. Materialized event uses verified `NewEvent` fields.
- **Reuse:** `insertEvent`/`deleteEventById`, `notifyUser`, `toUtcDateFromLocalParts`, `interestLabel`/`INTEREST_TAGS`, `BottomSheet`, tokens — no duplication.
- **Deferred:** activity editing, interest-based matching/ranking (cycle 3), maps/geo filter, chat, recurring activities, moderation panel.
```
