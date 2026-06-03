# Recurring Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add daily/weekly/monthly/yearly recurring events — one DB row per series, expanded into instances on read — with "this occurrence vs whole series" edit/delete and natural-language + form input.

**Architecture:** A `recurrence` JSON rule and `excluded_dates` array live on each `events` row. A pure `expandEvents` function turns rows into `EventInstance[]` for a date range; `getEventsInRange` now returns instances, so the calendar and the advisor both see occurrences automatically. Edit/delete of a recurring instance either excludes one date (with an optional one-off override) or mutates/deletes the series row.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase, OpenAI (`gpt-4o-mini`), date-fns/date-fns-tz, Vitest.

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `src/lib/events/recurrence.ts` | `expandEvents` + occurrence generation |
| `src/lib/events/recurrence.test.ts` | unit tests for expansion |
| `src/components/calendar/scope-dialog.tsx` | "only this / whole series" chooser |

### Modify
`supabase/schema.sql` · `src/lib/events/types.ts` · `src/lib/events/queries.ts` · `src/lib/events/actions.ts` · `src/lib/events/parse.ts` · `src/lib/events/parse.test.ts` · `src/components/capture/event-form.tsx` · `src/components/capture/capture-sheet.tsx` · `src/components/capture/confirm-card.tsx` · `src/components/calendar/event-row.tsx` · `src/components/calendar/day-view.tsx` · `src/components/calendar/calendar-screen.tsx` · `src/app/(app)/calendar/page.tsx` · `src/app/api/find-slots/route.ts` · `src/lib/bot/handler.ts`

---

## Task 1: Schema + types

**Files:** Modify `supabase/schema.sql`, `src/lib/events/types.ts`, `src/lib/events/queries.ts`

- [ ] **Step 1: Add columns to `supabase/schema.sql`**

In the `create table if not exists public.events (...)` block, add two columns just before `created_at`:

```sql
  notes      text,
  location   text,
  recurrence     jsonb,
  excluded_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
```

- [ ] **Step 2: Manual live-DB migration — SKIP during implementation**

This is run once in the Supabase SQL editor by the controller/user (you have no Supabase access; code compiles without it):

```sql
alter table public.events
  add column if not exists recurrence     jsonb,
  add column if not exists excluded_dates jsonb not null default '[]'::jsonb;
```

- [ ] **Step 3: Extend `src/lib/events/types.ts`** — replace the whole file:

```ts
export type Category =
  | "study" | "work" | "meeting"
  | "gym" | "run" | "meal" | "coffee" | "social" | "rest" | "errand" | "other";

export interface Recurrence {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  weekdays: number[] | null; // 1..7 (Mon..Sun), weekly only
  until: string | null;      // yyyy-MM-dd
  count: number | null;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  category: Category;
  is_fixed: boolean;
  notes: string | null;
  location: string | null;
  recurrence: Recurrence | null;
  excluded_dates: string[];
  created_at: string;
  updated_at: string;
}

export interface EventInstance extends CalendarEvent {
  series_id: string | null;       // parent series id; null for one-off rows
  occurrence_date: string | null; // yyyy-MM-dd of this instance (recurring only)
}

export interface ParsedEvent {
  title: string;
  category: Category;
  starts_at: string; // ISO UTC
  ends_at: string;   // ISO UTC
  is_fixed: boolean;
  notes: string | null;
  recurrence: Recurrence | null;
}
```

- [ ] **Step 4: Update `COLUMNS` in `src/lib/events/queries.ts`** so reads include the new fields. Change the `COLUMNS` constant (line 4-5) to:

```ts
const COLUMNS =
  "id, user_id, title, starts_at, ends_at, category, is_fixed, notes, location, recurrence, excluded_dates, created_at, updated_at";
```

- [ ] **Step 5: Verify compile**

Run: `npx tsc --noEmit`
Expected: errors WILL appear in files that construct `CalendarEvent`/`ParsedEvent` without the new fields (parse.ts, actions.ts) and where `getEventsInRange` consumers expect the old shape. That's expected mid-refactor — they are fixed in later tasks. **For this task, only require that `types.ts`, `queries.ts`, and `schema.sql` are internally consistent.** If `tsc` errors are confined to `parse.ts`, `actions.ts`, `bot/handler.ts` (missing `recurrence`), proceed. If any error is inside `types.ts` or `queries.ts` themselves, fix it.

Actually, to keep the tree green, also do Step 6 now.

- [ ] **Step 6: Keep `parse.ts`, `actions.ts`, `bot/handler.ts` compiling** by adding `recurrence: null` to the objects they build:

In `src/lib/events/parse.ts`, the returned object (around line 69-76) — add `recurrence: null,`:
```ts
  return {
    title: args.title,
    category: isCategory(args.category) ? args.category : "other",
    starts_at: new Date(args.starts_at).toISOString(),
    ends_at: new Date(args.ends_at).toISOString(),
    is_fixed: Boolean(args.is_fixed),
    notes: args.notes ?? null,
    recurrence: null,
  };
```

`actions.ts` and `bot/handler.ts` build `NewEvent` (not `CalendarEvent`), and `NewEvent` does not yet require recurrence, so they still compile. No change needed there in this task.

- [ ] **Step 7: Verify compile**

Run: `npx tsc --noEmit` → expect no errors now.
Run: `npx vitest run` → existing tests still pass (parse.test.ts asserts fields that still exist; the new `recurrence: null` doesn't break assertions).

- [ ] **Step 8: Commit**

```bash
git add supabase/schema.sql src/lib/events/types.ts src/lib/events/queries.ts src/lib/events/parse.ts
git commit -m "feat: recurrence types and columns on events"
```

---

## Task 2: `expandEvents` (pure core, TDD)

**Files:** Create `src/lib/events/recurrence.ts`, `src/lib/events/recurrence.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/events/recurrence.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { expandEvents } from "./recurrence";
import type { CalendarEvent, Recurrence } from "./types";

const TZ = "Europe/Moscow"; // UTC+3, no DST in these dates

function row(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "s1",
    user_id: "u",
    title: "Зал",
    starts_at: "2026-06-01T09:00:00+03:00",
    ends_at: "2026-06-01T10:00:00+03:00",
    category: "gym",
    is_fixed: false,
    notes: null,
    location: null,
    recurrence: null,
    excluded_dates: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const R = (r: Partial<Recurrence>): Recurrence => ({ freq: "daily", weekdays: null, until: null, count: null, ...r });
const RANGE = [new Date("2026-06-01T00:00:00Z"), new Date("2026-06-08T00:00:00Z")] as const;

describe("expandEvents", () => {
  it("passes a one-off event through with null series_id", () => {
    const out = expandEvents([row()], RANGE[0], RANGE[1], TZ);
    expect(out).toHaveLength(1);
    expect(out[0].series_id).toBeNull();
    expect(out[0].occurrence_date).toBeNull();
    expect(out[0].starts_at).toBe("2026-06-01T06:00:00.000Z"); // 09:00 MSK
  });

  it("daily expands to one instance per day in range", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "daily" }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual([
      "2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07",
    ]);
    expect(out[0].series_id).toBe("s1");
    expect(out[0].starts_at).toBe("2026-06-01T06:00:00.000Z");
  });

  it("weekly honours selected weekdays (Mon/Wed/Fri)", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "weekly", weekdays: [1, 3, 5] }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-03", "2026-06-05"]);
  });

  it("monthly keeps the day-of-month and skips months without it", () => {
    const out = expandEvents(
      [row({ starts_at: "2026-01-31T09:00:00+03:00", ends_at: "2026-01-31T10:00:00+03:00", recurrence: R({ freq: "monthly" }) })],
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-05-01T00:00:00Z"),
      TZ,
    );
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-01-31", "2026-03-31"]); // Feb skipped
  });

  it("yearly birthday recurs once per year", () => {
    const out = expandEvents(
      [row({ title: "ДР", starts_at: "2024-03-15T09:00:00+03:00", ends_at: "2024-03-15T10:00:00+03:00", recurrence: R({ freq: "yearly" }) })],
      new Date("2026-01-01T00:00:00Z"),
      new Date("2027-01-01T00:00:00Z"),
      TZ,
    );
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-03-15"]);
  });

  it("respects until (inclusive)", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "daily", until: "2026-06-03" }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
  });

  it("respects count measured from the anchor", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "daily", count: 2 }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("skips excluded_dates", () => {
    const out = expandEvents([row({ excluded_dates: ["2026-06-02"], recurrence: R({ freq: "daily", count: 3 }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-03"]);
  });
});
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx vitest run src/lib/events/recurrence.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create `src/lib/events/recurrence.ts`**

```ts
import { addDays, addMonths, addYears, format, getDate, getDay, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { toUtcDateFromLocalParts } from "@/lib/datetime";
import type { CalendarEvent, EventInstance } from "./types";

const MAX_ITER = 1200;

function mondayWeekday(date: Date): number {
  const d = getDay(date); // 0=Sun..6=Sat
  return d === 0 ? 7 : d;
}

export function expandEvents(
  rows: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string,
): EventInstance[] {
  const out: EventInstance[] = [];
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  for (const row of rows) {
    if (!row.recurrence) {
      const t = new Date(row.starts_at).getTime();
      if (t >= startMs && t < endMs) {
        out.push({ ...row, series_id: null, occurrence_date: null });
      }
      continue;
    }

    const rec = row.recurrence;
    const anchorDateStr = formatInTimeZone(row.starts_at, timezone, "yyyy-MM-dd");
    const startHHMM = formatInTimeZone(row.starts_at, timezone, "HH:mm");
    const endHHMM = formatInTimeZone(row.ends_at, timezone, "HH:mm");
    const excluded = new Set(row.excluded_dates ?? []);
    const anchor = parseISO(anchorDateStr);
    const anchorDom = getDate(anchor);
    const weekdays =
      rec.freq === "weekly"
        ? rec.weekdays && rec.weekdays.length > 0
          ? rec.weekdays
          : [mondayWeekday(anchor)]
        : null;

    let emitted = 0;

    // Returns false when the candidate start is at/after rangeEnd (caller may stop).
    const emit = (dateStr: string): boolean => {
      if (!excluded.has(dateStr)) {
        const startUtc = toUtcDateFromLocalParts(dateStr, startHHMM, timezone);
        const sMs = startUtc.getTime();
        if (sMs >= endMs) return false;
        if (sMs >= startMs) {
          const endUtc = toUtcDateFromLocalParts(dateStr, endHHMM, timezone);
          out.push({
            ...row,
            starts_at: startUtc.toISOString(),
            ends_at: endUtc.toISOString(),
            series_id: row.id,
            occurrence_date: dateStr,
          });
        }
      }
      return true;
    };

    if (rec.freq === "daily" || rec.freq === "weekly") {
      let cursor = anchor;
      for (let i = 0; i < MAX_ITER; i++) {
        const dateStr = format(cursor, "yyyy-MM-dd");
        if (rec.until && dateStr > rec.until) break;
        if (rec.count != null && emitted >= rec.count) break;
        const matches = rec.freq === "daily" || weekdays!.includes(mondayWeekday(cursor));
        if (matches) {
          emitted += 1;
          const cont = emit(dateStr);
          if (!cont && rec.count == null) break;
        }
        cursor = addDays(cursor, 1);
      }
    } else {
      for (let i = 0; i < MAX_ITER; i++) {
        const cursor = rec.freq === "monthly" ? addMonths(anchor, i) : addYears(anchor, i);
        const dateStr = format(cursor, "yyyy-MM-dd");
        if (rec.until && dateStr > rec.until) break;
        if (rec.count != null && emitted >= rec.count) break;
        if (getDate(cursor) === anchorDom) {
          emitted += 1;
          const cont = emit(dateStr);
          if (!cont && rec.count == null) break;
        }
      }
    }
  }

  out.sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0));
  return out;
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx vitest run src/lib/events/recurrence.test.ts` → PASS (8 tests).
Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/recurrence.ts src/lib/events/recurrence.test.ts
git commit -m "feat: expandEvents recurrence expansion"
```

---

## Task 3: `getEventsInRange` → instances + series query helpers

**Files:** Modify `src/lib/events/queries.ts`, `src/app/(app)/calendar/page.tsx`, `src/app/api/find-slots/route.ts`

- [ ] **Step 1: Rewrite `getEventsInRange` and add helpers in `src/lib/events/queries.ts`**

Replace the `getEventsInRange` function (lines 7-22) with:

```ts
import { expandEvents } from "./recurrence";
import type { CalendarEvent, EventInstance, Recurrence } from "./types";

export async function getEventsInRange(
  userId: string,
  startAt: Date,
  endAt: Date,
  timezone: string,
): Promise<EventInstance[]> {
  const admin = getAdminSupabase();

  const [oneOff, recurring] = await Promise.all([
    admin
      .from("events")
      .select(COLUMNS)
      .eq("user_id", userId)
      .is("recurrence", null)
      .gte("starts_at", startAt.toISOString())
      .lt("starts_at", endAt.toISOString()),
    admin
      .from("events")
      .select(COLUMNS)
      .eq("user_id", userId)
      .not("recurrence", "is", null),
  ]);

  if (oneOff.error) throw new Error(oneOff.error.message);
  if (recurring.error) throw new Error(recurring.error.message);

  const rows = [...(oneOff.data ?? []), ...(recurring.data ?? [])] as CalendarEvent[];
  return expandEvents(rows, startAt, endAt, timezone);
}
```

(Update the top-of-file import line `import type { CalendarEvent } from "./types";` to `import type { CalendarEvent, EventInstance, Recurrence } from "./types";`, and add `import { expandEvents } from "./recurrence";` — do NOT duplicate the imports shown inline above; put them at the top of the file.)

- [ ] **Step 2: Extend `NewEvent` and add series helpers** — in the same file, update `NewEvent` to allow recurrence, and append helpers:

Change the `NewEvent` interface to add two optional fields:
```ts
export interface NewEvent {
  user_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  category: string;
  is_fixed: boolean;
  notes: string | null;
  location: string | null;
  recurrence?: Recurrence | null;
  excluded_dates?: string[];
}
```

Append these functions at the end of the file:

```ts
export async function getEventById(userId: string, id: string): Promise<CalendarEvent | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CalendarEvent | null) ?? null;
}

export async function addExcludedDate(userId: string, seriesId: string, date: string): Promise<void> {
  const series = await getEventById(userId, seriesId);
  if (!series) return;
  const next = Array.from(new Set([...(series.excluded_dates ?? []), date]));
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("events")
    .update({ excluded_dates: next } as unknown as Record<string, unknown>)
    .eq("id", seriesId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function updateSeries(
  userId: string,
  seriesId: string,
  patch: Partial<Omit<NewEvent, "user_id">>,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("events")
    .update({ ...patch, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>)
    .eq("id", seriesId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Update the two callers to pass `timezone`.**

`src/app/(app)/calendar/page.tsx` — find `getEventsInRange(user.id, start, end)` and change to `getEventsInRange(user.id, start, end, user.timezone)`.

`src/app/api/find-slots/route.ts` — find `getEventsInRange(user.id, start, end)` and change to `getEventsInRange(user.id, start, end, user.timezone)`.

- [ ] **Step 4: Verify compile + tests + build**

Run: `npx tsc --noEmit` → no errors. (`findSlots` accepts `EventInstance[]` because it only reads `starts_at`/`ends_at`; `DayView` props typed as `CalendarEvent[]` still accept `EventInstance[]`.)
Run: `npx vitest run` → all pass.
Run: `npx next build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/queries.ts "src/app/(app)/calendar/page.tsx" "src/app/api/find-slots/route.ts"
git commit -m "feat: getEventsInRange expands recurring instances; series query helpers"
```

---

## Task 4: Server actions for recurrence + scope

**Files:** Modify `src/lib/events/actions.ts`

- [ ] **Step 1: Replace `src/lib/events/actions.ts`** entirely:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { toUtcDateFromLocalParts } from "@/lib/datetime";
import {
  insertEvent,
  updateEventById,
  deleteEventById,
  addExcludedDate,
  updateSeries,
} from "./queries";
import type { Category, ParsedEvent, Recurrence } from "./types";

export interface EventFormInput {
  title: string;
  category: Category;
  date: string;       // yyyy-MM-dd (user local)
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  is_fixed: boolean;
  notes?: string | null;
  location?: string | null;
  recurrence?: Recurrence | null;
}

function localToUtc(date: string, time: string, tz: string): string {
  return toUtcDateFromLocalParts(date, time, tz).toISOString();
}

export async function createEventAction(input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  await insertEvent({
    user_id: user.id,
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
    recurrence: input.recurrence ?? null,
    excluded_dates: [],
  });
  revalidatePath("/calendar");
}

export async function updateEventAction(id: string, input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  await updateEventById(user.id, id, {
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
  });
  revalidatePath("/calendar");
}

export async function deleteEventAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  await deleteEventById(user.id, id);
  revalidatePath("/calendar");
}

export async function createParsedEventAction(parsed: ParsedEvent): Promise<void> {
  const user = await requireCurrentUser();
  await insertEvent({
    user_id: user.id,
    title: parsed.title.trim(),
    category: parsed.category,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    is_fixed: parsed.is_fixed,
    notes: parsed.notes?.trim() || null,
    location: null,
    recurrence: parsed.recurrence ?? null,
    excluded_dates: [],
  });
  revalidatePath("/calendar");
}

// ── Recurring-series scope actions ───────────────────────────────────────────

export async function deleteOccurrenceAction(seriesId: string, date: string): Promise<void> {
  const user = await requireCurrentUser();
  await addExcludedDate(user.id, seriesId, date);
  revalidatePath("/calendar");
}

export async function deleteSeriesAction(seriesId: string): Promise<void> {
  const user = await requireCurrentUser();
  await deleteEventById(user.id, seriesId);
  revalidatePath("/calendar");
}

export async function updateSeriesAction(seriesId: string, input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  await updateSeries(user.id, seriesId, {
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
    recurrence: input.recurrence ?? null,
  });
  revalidatePath("/calendar");
}

/** Edit one occurrence: exclude it from the series, then create a one-off override. */
export async function editOccurrenceAction(
  seriesId: string,
  date: string,
  input: EventFormInput,
): Promise<void> {
  const user = await requireCurrentUser();
  await addExcludedDate(user.id, seriesId, date);
  await insertEvent({
    user_id: user.id,
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
    recurrence: null,
    excluded_dates: [],
  });
  revalidatePath("/calendar");
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/events/actions.ts
git commit -m "feat: recurrence-aware event actions (series + occurrence scope)"
```

---

## Task 5: Natural-language recurrence parsing

**Files:** Modify `src/lib/events/parse.ts`, `src/lib/events/parse.test.ts`

- [ ] **Step 1: Add a failing test** — append to `src/lib/events/parse.test.ts` (inside the existing `describe`, add cases). First add this helper response shape if not present, then the tests:

```ts
  it("parses a daily recurrence", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Работа",
        category: "work",
        starts_at: "2026-06-03T09:00:00+03:00",
        ends_at: "2026-06-03T18:00:00+03:00",
        is_fixed: true,
        notes: null,
        recur_freq: "daily",
      }),
    );
    const r = await parseEvent("работа каждый день с 9 до 18", { today: "2026-06-03", timezone: "Europe/Moscow" });
    expect(r.recurrence).toEqual({ freq: "daily", weekdays: null, until: null, count: null });
  });

  it("parses weekly weekdays", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Зал",
        category: "gym",
        starts_at: "2026-06-01T18:00:00+03:00",
        ends_at: "2026-06-01T19:00:00+03:00",
        is_fixed: false,
        notes: null,
        recur_freq: "weekly",
        recur_weekdays: [1, 3, 5],
      }),
    );
    const r = await parseEvent("зал по пн ср пт", { today: "2026-06-01", timezone: "Europe/Moscow" });
    expect(r.recurrence).toEqual({ freq: "weekly", weekdays: [1, 3, 5], until: null, count: null });
  });

  it("leaves recurrence null when none is mentioned", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Кофе",
        category: "coffee",
        starts_at: "2026-06-03T15:00:00+03:00",
        ends_at: "2026-06-03T16:00:00+03:00",
        is_fixed: false,
        notes: null,
      }),
    );
    const r = await parseEvent("кофе в 15", { today: "2026-06-03", timezone: "Europe/Moscow" });
    expect(r.recurrence).toBeNull();
  });
```

- [ ] **Step 2: Run — verify the new tests FAIL**

Run: `npx vitest run src/lib/events/parse.test.ts` → the 3 new tests fail (recurrence is always null / fields missing).

- [ ] **Step 3: Update `src/lib/events/parse.ts`** — add recurrence to the tool schema, prompt, and mapping.

Replace the `TOOL` constant's `properties`/`required` to add recurrence fields:

```ts
      properties: {
        title: { type: "string", description: "Short event title" },
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        starts_at: { type: "string", description: "ISO 8601 with timezone offset" },
        ends_at: { type: "string", description: "ISO 8601 with timezone offset; default +1h" },
        is_fixed: { type: "boolean", description: "true for mandatory (study/work/meeting), false for flexible" },
        notes: { type: "string", nullable: true },
        recur_freq: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"], nullable: true, description: "Repetition frequency, or omit/null for a one-off event" },
        recur_weekdays: { type: "array", items: { type: "integer" }, nullable: true, description: "For weekly: weekdays 1=Mon..7=Sun" },
        recur_until: { type: "string", nullable: true, description: "Repeat until this date yyyy-MM-dd, or null" },
        recur_count: { type: "integer", nullable: true, description: "Repeat this many times, or null" },
      },
      required: ["title", "category", "starts_at", "ends_at", "is_fixed"],
```

Add a sentence to the system prompt content (after the "Mark study, work..." line):
```ts
          `If the user implies repetition, set recur_freq (daily/weekly/monthly/yearly) and, for weekly, recur_weekdays (1=Mon..7=Sun). "каждый день"→daily, "по пн ср пт"→weekly [1,3,5], "каждый месяц"→monthly, "день рождения"/"каждый год"→yearly. Otherwise leave recur_freq null.`,
```

Update the `args` type and the return to build recurrence:
```ts
  const args = JSON.parse(call.function.arguments) as {
    title: string;
    category: string;
    starts_at: string;
    ends_at: string;
    is_fixed: boolean;
    notes?: string | null;
    recur_freq?: "daily" | "weekly" | "monthly" | "yearly" | null;
    recur_weekdays?: number[] | null;
    recur_until?: string | null;
    recur_count?: number | null;
  };

  const recurrence =
    args.recur_freq
      ? {
          freq: args.recur_freq,
          weekdays: args.recur_freq === "weekly" && Array.isArray(args.recur_weekdays) && args.recur_weekdays.length > 0
            ? args.recur_weekdays
            : null,
          until: typeof args.recur_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.recur_until) ? args.recur_until : null,
          count: typeof args.recur_count === "number" && args.recur_count > 0 ? Math.round(args.recur_count) : null,
        }
      : null;

  return {
    title: args.title,
    category: isCategory(args.category) ? args.category : "other",
    starts_at: new Date(args.starts_at).toISOString(),
    ends_at: new Date(args.ends_at).toISOString(),
    is_fixed: Boolean(args.is_fixed),
    notes: args.notes ?? null,
    recurrence,
  };
```

Add the import of the `Recurrence` type if needed: `import type { ParsedEvent } from "./types";` already imports ParsedEvent; the inline object is structurally typed, no extra import required.

- [ ] **Step 4: Run — verify all parse tests PASS**

Run: `npx vitest run src/lib/events/parse.test.ts` → all pass (original 3 + new 3).
Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/parse.ts src/lib/events/parse.test.ts
git commit -m "feat: parse recurrence from natural language"
```

---

## Task 6: Recurrence in the manual form

**Files:** Modify `src/components/capture/event-form.tsx`

- [ ] **Step 1: Add recurrence UI + routing to `EventForm`.** Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
  editOccurrenceAction,
  updateSeriesAction,
  deleteOccurrenceAction,
  deleteSeriesAction,
  type EventFormInput,
} from "@/lib/events/actions";
import { CATEGORIES, CATEGORY_DEFAULT_FIXED, CATEGORY_EMOJI, CATEGORY_LABEL_RU } from "@/lib/events/categories";
import type { CalendarEvent, Category, ParsedEvent, Recurrence } from "@/lib/events/types";

type Freq = "none" | "daily" | "weekly" | "monthly" | "yearly";
const WEEKDAYS: { n: number; label: string }[] = [
  { n: 1, label: "Пн" }, { n: 2, label: "Вт" }, { n: 3, label: "Ср" }, { n: 4, label: "Чт" },
  { n: 5, label: "Пт" }, { n: 6, label: "Сб" }, { n: 7, label: "Вс" },
];

// When editing a recurring instance, the caller passes the scope so the form
// routes save/delete to the right series action.
export interface RecurringEdit {
  seriesId: string;
  occurrenceDate: string;
  scope: "one" | "all";
}

export function EventForm({
  timezone,
  initialDate,
  editing,
  prefill,
  recurringEdit,
  onDone,
}: {
  timezone: string;
  initialDate: string;
  editing?: CalendarEvent | null;
  prefill?: ParsedEvent | null;
  recurringEdit?: RecurringEdit | null;
  onDone: () => void;
}) {
  const source = editing ?? prefill ?? null;
  const srcStart = source ? formatInTimeZone(source.starts_at, timezone, "HH:mm") : "09:00";
  const srcEnd = source ? formatInTimeZone(source.ends_at, timezone, "HH:mm") : "10:00";
  const srcDate = source ? formatInTimeZone(source.starts_at, timezone, "yyyy-MM-dd") : initialDate;

  const seriesRec = recurringEdit?.scope === "all" ? source?.recurrence ?? null : null;

  const [title, setTitle] = useState(source?.title ?? "");
  const [category, setCategory] = useState<Category>((source?.category as Category) ?? "gym");
  const [date, setDate] = useState(srcDate);
  const [startTime, setStartTime] = useState(srcStart);
  const [endTime, setEndTime] = useState(srcEnd);
  const [isFixed, setIsFixed] = useState(source?.is_fixed ?? CATEGORY_DEFAULT_FIXED.gym);
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [freq, setFreq] = useState<Freq>(seriesRec?.freq ?? "none");
  const [weekdays, setWeekdays] = useState<number[]>(seriesRec?.weekdays ?? []);
  const [until, setUntil] = useState<string>(seriesRec?.until ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-occurrence edits ("only this") become a plain one-off; no recurrence picker.
  const showRecurrence = !recurringEdit || recurringEdit.scope === "all";

  function pickCategory(c: Category) {
    setCategory(c);
    if (!editing) setIsFixed(CATEGORY_DEFAULT_FIXED[c]);
  }

  function toggleWeekday(n: number) {
    setWeekdays((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));
  }

  function buildRecurrence(): Recurrence | null {
    if (!showRecurrence || freq === "none") return null;
    return {
      freq,
      weekdays: freq === "weekly" ? (weekdays.length > 0 ? weekdays : null) : null,
      until: until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null,
      count: null,
    };
  }

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Введи название");
    if (endTime <= startTime) return setError("Конец должен быть позже начала");
    const input: EventFormInput = {
      title, category, date, start_time: startTime, end_time: endTime,
      is_fixed: isFixed, notes, recurrence: buildRecurrence(),
    };
    setPending(true);
    try {
      if (recurringEdit?.scope === "all") await updateSeriesAction(recurringEdit.seriesId, input);
      else if (recurringEdit?.scope === "one") await editOccurrenceAction(recurringEdit.seriesId, recurringEdit.occurrenceDate, input);
      else if (editing) await updateEventAction(editing.id, input);
      else await createEventAction(input);
      onDone();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      if (recurringEdit?.scope === "all") await deleteSeriesAction(recurringEdit.seriesId);
      else if (recurringEdit?.scope === "one") await deleteOccurrenceAction(recurringEdit.seriesId, recurringEdit.occurrenceDate);
      else if (editing) await deleteEventAction(editing.id);
      onDone();
    } catch {
      setError("Не удалось удалить");
    } finally {
      setPending(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none";
  const canDelete = Boolean(editing) || Boolean(recurringEdit);
  const freqOptions: { v: Freq; label: string }[] = [
    { v: "none", label: "Нет" }, { v: "daily", label: "Каждый день" }, { v: "weekly", label: "По дням недели" },
    { v: "monthly", label: "Каждый месяц" }, { v: "yearly", label: "Каждый год" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" className={inputCls} />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => pickCategory(c)} className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: category === c ? "#fff" : "#1a1a1a", color: category === c ? "#000" : "#888" }}>
            {CATEGORY_EMOJI[c]} {CATEGORY_LABEL_RU[c]}
          </button>
        ))}
      </div>

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      <div className="flex gap-3">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} flex-1`} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputCls} flex-1`} />
      </div>

      <button onClick={() => setIsFixed((v) => !v)} className="flex items-center justify-between rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white">
        <span>{isFixed ? "Фиксированное" : "Гибкое"}</span>
        <span className="text-xs text-[#777]">{isFixed ? "нельзя двигать" : "ИИ может подвинуть"}</span>
      </button>

      {showRecurrence && (
        <div className="flex flex-col gap-2 rounded-xl bg-[#1a1a1a] p-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="flex-shrink-0 text-xs text-[#777]">Повторять</span>
            {freqOptions.map((o) => (
              <button key={o.v} onClick={() => setFreq(o.v)} className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: freq === o.v ? "#fff" : "#111", color: freq === o.v ? "#000" : "#888" }}>
                {o.label}
              </button>
            ))}
          </div>
          {freq === "weekly" && (
            <div className="flex gap-1">
              {WEEKDAYS.map((w) => (
                <button key={w.n} onClick={() => toggleWeekday(w.n)} className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: weekdays.includes(w.n) ? "#fff" : "#111", color: weekdays.includes(w.n) ? "#000" : "#888" }}>
                  {w.label}
                </button>
              ))}
            </div>
          )}
          {freq !== "none" && (
            <div className="flex items-center gap-2 text-xs text-[#777]">
              <span>До</span>
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-lg bg-[#111] px-2 py-1 text-white outline-none" />
              {until && <button onClick={() => setUntil("")} className="text-[#555]">сбросить</button>}
            </div>
          )}
        </div>
      )}

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Примечание" rows={2} className={inputCls} />

      {error && <p className="text-center text-xs text-red-400">{error}</p>}

      <button onClick={submit} disabled={pending} className="rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
        {pending ? "Сохраняю…" : editing || recurringEdit ? "Сохранить" : "Добавить"}
      </button>
      {canDelete && (
        <button onClick={remove} disabled={pending} className="rounded-xl bg-[#1a1a1a] py-3 text-sm font-semibold text-red-400 disabled:opacity-50">
          Удалить
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit` → expect an error in `capture-sheet.tsx` only if it needs the new prop; it doesn't (the prop is optional). Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/capture/event-form.tsx
git commit -m "feat: recurrence picker in event form + scope-aware save/delete"
```

---

## Task 7: Calendar wiring — 🔁 marker, scope dialog, edit routing, confirm card

**Files:** Create `src/components/calendar/scope-dialog.tsx`; modify `src/components/calendar/event-row.tsx`, `src/components/calendar/day-view.tsx`, `src/components/calendar/calendar-screen.tsx`, `src/components/capture/capture-sheet.tsx`, `src/components/capture/confirm-card.tsx`

- [ ] **Step 1: Create `src/components/calendar/scope-dialog.tsx`**

```tsx
"use client";

export function ScopeDialog({
  title,
  onOne,
  onAll,
  onCancel,
}: {
  title: string;
  onOne: () => void;
  onAll: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onCancel}>
      <div className="w-full rounded-t-2xl bg-[#111] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-center text-sm font-semibold text-white">{title}</p>
        <div className="flex flex-col gap-2">
          <button onClick={onOne} className="rounded-xl bg-[#1a1a1a] py-3 text-sm font-semibold text-white">Только это</button>
          <button onClick={onAll} className="rounded-xl bg-[#1a1a1a] py-3 text-sm font-semibold text-white">Вся серия</button>
          <button onClick={onCancel} className="rounded-xl py-3 text-sm text-[#777]">Отмена</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the 🔁 marker in `src/components/calendar/event-row.tsx`.**

Change the props type from `CalendarEvent` to `EventInstance` and render 🔁 when it's a series instance. Replace the import and the time line:

Import:
```tsx
import type { EventInstance } from "@/lib/events/types";
```
Props: change `event: CalendarEvent` to `event: EventInstance`.
In the time sub-line, append the marker:
```tsx
        <span className="block text-xs text-[#777]">
          {start}–{end}
          {event.series_id ? " · 🔁" : ""}
          {event.location ? ` · ${event.location}` : ""}
        </span>
```

- [ ] **Step 3: Pass instances through `day-view.tsx`.**

Change the `events`/`onEventClick` types to `EventInstance`. In `src/components/calendar/day-view.tsx`:
- Import: add `EventInstance` to the type import from `@/lib/events/types`.
- Props: `events: EventInstance[]` and `onEventClick: (event: EventInstance) => void`.
- `dayEvents` is already derived from `events`; no logic change.

- [ ] **Step 4: Wire scope dialog + recurring edit in `src/components/calendar/calendar-screen.tsx`.** Replace the file with:

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { DayView } from "./day-view";
import { ScopeDialog } from "./scope-dialog";
import { CaptureSheet } from "@/components/capture/capture-sheet";
import { AdvisorSheet } from "@/components/advisor/advisor-sheet";
import type { EventInstance } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";
import type { RecurringEdit } from "@/components/capture/event-form";

export function CalendarScreen({
  events,
  dayNotes,
  monthStr,
  timezone,
  dayStart,
  dayEnd,
}: {
  events: EventInstance[];
  dayNotes: Note[];
  monthStr: string;
  timezone: string;
  dayStart: string;
  dayEnd: string;
}) {
  const [editing, setEditing] = useState<EventInstance | null>(null);
  const [recurringEdit, setRecurringEdit] = useState<RecurringEdit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [scopeFor, setScopeFor] = useState<EventInstance | null>(null);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  function openEditor(instance: EventInstance, scope: "one" | "all" | null) {
    setEditing(instance);
    setRecurringEdit(
      scope && instance.series_id && instance.occurrence_date
        ? { seriesId: instance.series_id, occurrenceDate: instance.occurrence_date, scope }
        : null,
    );
    setSheetOpen(true);
  }

  function onEventClick(instance: EventInstance) {
    if (instance.series_id) setScopeFor(instance); // recurring → ask scope
    else openEditor(instance, null);               // one-off → edit directly
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
    setRecurringEdit(null);
  }

  return (
    <>
      <DayView events={events} dayNotes={dayNotes} monthStr={monthStr} timezone={timezone} onEventClick={onEventClick} />

      <button onClick={() => setAdvisorOpen(true)} className="fixed bottom-44 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-2xl shadow-lg" aria-label="Найти время">✨</button>
      <button onClick={() => { setEditing(null); setRecurringEdit(null); setSheetOpen(true); }} className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg" aria-label="Добавить">+</button>

      {sheetOpen && (
        <CaptureSheet
          timezone={timezone}
          defaultDate={todayStr}
          editing={editing}
          recurringEdit={recurringEdit}
          onClose={closeSheet}
        />
      )}
      {advisorOpen && (
        <AdvisorSheet timezone={timezone} dayStart={dayStart} dayEnd={dayEnd} onClose={() => setAdvisorOpen(false)} />
      )}
      {scopeFor && (
        <ScopeDialog
          title="Это событие или вся серия?"
          onOne={() => { const i = scopeFor; setScopeFor(null); openEditor(i, "one"); }}
          onAll={() => { const i = scopeFor; setScopeFor(null); openEditor(i, "all"); }}
          onCancel={() => setScopeFor(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 5: Pass `recurringEdit` through `src/components/capture/capture-sheet.tsx`.**

- Update the import to include `RecurringEdit` and `EventInstance`:
```tsx
import { EventForm, type RecurringEdit } from "./event-form";
import type { CalendarEvent, EventInstance, ParsedEvent } from "@/lib/events/types";
```
- Add `recurringEdit` to the props of `CaptureSheet`:
```tsx
export function CaptureSheet({
  timezone,
  defaultDate,
  editing,
  recurringEdit,
  onClose,
}: {
  timezone: string;
  defaultDate: string;
  editing?: CalendarEvent | null;
  recurringEdit?: RecurringEdit | null;
  onClose: () => void;
}) {
```
- Pass it to the manual `EventForm` render (the `mode === "manual"` branch) and the confirm→edit branch:
```tsx
        {mode === "manual" && (
          <EventForm timezone={timezone} initialDate={defaultDate} editing={editing} prefill={editing ? null : parsed} recurringEdit={recurringEdit} onDone={onClose} />
        )}
```

- [ ] **Step 6: Show recurrence on the confirm card** — `src/components/capture/confirm-card.tsx`.

Add a human label under the date line when `parsed.recurrence` is set. After the line that renders `{day}, {start}–{end} · …`, add:
```tsx
        {parsed.recurrence && (
          <p className="mt-1 text-xs text-[#3b82f6]">🔁 {recurrenceLabel(parsed.recurrence)}</p>
        )}
```
And add this helper above the component:
```tsx
import type { ParsedEvent } from "@/lib/events/types";

function recurrenceLabel(r: NonNullable<ParsedEvent["recurrence"]>): string {
  if (r.freq === "daily") return "каждый день";
  if (r.freq === "monthly") return "каждый месяц";
  if (r.freq === "yearly") return "каждый год";
  const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  return r.weekdays && r.weekdays.length > 0 ? `по ${r.weekdays.map((n) => names[n - 1]).join(" ")}` : "каждую неделю";
}
```
(If `confirm-card.tsx` already imports from `@/lib/events/types`, merge the import rather than duplicating.)

- [ ] **Step 7: Verify compile + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npx next build` → succeeds; routes unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/components/calendar/scope-dialog.tsx src/components/calendar/event-row.tsx src/components/calendar/day-view.tsx src/components/calendar/calendar-screen.tsx src/components/capture/capture-sheet.tsx src/components/capture/confirm-card.tsx
git commit -m "feat: recurring instance markers, scope dialog, edit routing, confirm label"
```

---

## Task 8: Bot recurrence + final verification

**Files:** Modify `src/lib/bot/handler.ts`

- [ ] **Step 1: Carry recurrence through the bot insert.** In `src/lib/bot/handler.ts`, the message handler builds the insert from `parsed`. Add `recurrence` and `excluded_dates` to that insert object so a recurring event created via the bot persists its rule. Find the `insertEvent({ ... })` call in `handleBotMessage` and add the two fields:

```ts
    eventId = await insertEvent({
      user_id: user.id,
      title: parsed.title,
      category: parsed.category,
      starts_at: parsed.starts_at,
      ends_at: parsed.ends_at,
      is_fixed: parsed.is_fixed,
      notes: parsed.notes,
      location: null,
      recurrence: parsed.recurrence ?? null,
      excluded_dates: [],
    });
```

- [ ] **Step 2: Show 🔁 in the bot card.** In the `card(...)` helper in `handler.ts`, append a recurrence note when present. Change its signature to accept the parsed event's recurrence and add a line. Locate `function card(eventId, parsed, timezone)` and update the text line to include recurrence:

```ts
  const recurNote = parsed.recurrence
    ? ` · 🔁 ${parsed.recurrence.freq === "daily" ? "каждый день" : parsed.recurrence.freq === "weekly" ? "еженедельно" : parsed.recurrence.freq === "monthly" ? "каждый месяц" : "каждый год"}`
    : "";
  return {
    text: `✅ <b>${parsed.title}</b>\n${categoryEmoji(parsed.category)} ${day} · ${start}–${end} · ${parsed.is_fixed ? "фиксированное" : "гибкое"}${recurNote}`,
    reply_markup: { inline_keyboard: [[{ text: "🗑 Удалить", callback_data: `del:${eventId}` }]] },
  };
```
(`parsed` is already passed to `card`; no signature change needed since it carries `recurrence`.)

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit` → no errors.
Run: `npx vitest run` → all pass (Layer-1/2 tests + recurrence 8 + parse 6).
Run: `npx next build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/handler.ts
git commit -m "feat: bot creates recurring events and shows recurrence"
```

---

## Self-Review

**Spec coverage:**
- ✅ Patterns daily/weekly-by-weekday/monthly/yearly — Task 2 (expand), Task 6 (form), Task 5 (NL)
- ✅ End: forever / until / count — Recurrence type (Task 1), expand honours both (Task 2), form sets until (Task 6), NL sets until/count (Task 5)
- ✅ One row per series, expand on read — Task 2 + Task 3
- ✅ Advisor sees occurrences automatically — Task 3 (getEventsInRange returns instances; route already feeds findSlots)
- ✅ Edit/delete this-vs-series + override mechanism — Task 4 (actions), Task 7 (scope dialog + routing)
- ✅ Input via form + NL (app + bot) — Task 6, Task 5, Task 8
- ✅ 🔁 marker — Task 7
- ✅ excluded_dates for skip/override — Task 1 (column), Task 4 (addExcludedDate)

**Type consistency:** `Recurrence`, `EventInstance` (Task 1) used by `expandEvents` (2), `getEventsInRange` (3), actions `EventFormInput.recurrence` (4), `ParsedEvent.recurrence` (5), `RecurringEdit` (6) consumed by calendar-screen + capture-sheet (7). `getEventsInRange` signature `(userId, start, end, timezone)` updated at both call sites (3). `insertEvent`'s `NewEvent` gains optional `recurrence`/`excluded_dates` (3), used by actions (4) and bot (8).

**Placeholders:** none — every step has complete code or an exact edit.

**Edge cases:** monthly/yearly day-of-month preserved (skip Feb for 31st, skip non-leap Feb 29); weekly defaults to anchor weekday if none selected; MAX_ITER caps forever-series; count counts matched occurrences (exclusions still count); per-occurrence edit becomes a plain one-off override.
