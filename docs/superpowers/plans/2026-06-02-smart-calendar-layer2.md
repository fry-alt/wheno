# Smart Calendar — Layer 2 (AI Schedule Advisor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI advisor that turns a natural-language request ("зал 3 раза на этой неделе утром") into a distributed plan of free-time slots the user can accept in one tap.

**Architecture:** `parseRequest` (OpenAI) converts text → structured `SlotRequest`; `findSlots` (pure, deterministic) finds free windows between existing events within the user's waking hours and distributes N occurrences across the requested window; an advisor bottom-sheet shows the plan as toggleable cards and a batch-create action writes the chosen events. Mini App only; no bot changes; never moves existing events.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase, OpenAI (`gpt-4o-mini`), date-fns/date-fns-tz, Vitest.

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `src/lib/advisor/types.ts` | `SlotRequest`, `ProposedSlot` |
| `src/lib/advisor/find-slots.ts` | pure slot-finding algorithm |
| `src/lib/advisor/find-slots.test.ts` | unit tests for the algorithm |
| `src/lib/advisor/parse-request.ts` | OpenAI NL → `SlotRequest` |
| `src/lib/advisor/parse-request.test.ts` | unit test (mocked OpenAI) |
| `src/lib/advisor/actions.ts` | `createPlanAction`, `updateDayHoursAction` |
| `src/app/api/find-slots/route.ts` | auth → parse + find → `{ slots, request }` |
| `src/components/advisor/advisor-sheet.tsx` | advisor UI |

### Modify
| File | Change |
|---|---|
| `supabase/schema.sql` | add `day_start`, `day_end` to `users` (+ manual `ALTER` on live DB) |
| `src/lib/types.ts` | `AppUser` += `day_start`, `day_end` |
| `src/app/(app)/calendar/page.tsx` | pass `dayStart`/`dayEnd` to `CalendarScreen` |
| `src/components/calendar/calendar-screen.tsx` | ✨ button + render advisor sheet |

### Reuse (unchanged)
`toUtcDateFromLocalParts`, `getDateRangeUtc` (datetime), `getEventsInRange`, `insertEvent` (events/queries), `getCurrentUser`, `requireCurrentUser` (auth), `Category`, `categoryEmoji`, `isCategory` (events), `getOpenAI` (openai).

---

## Task 1: DB columns + AppUser type (waking hours)

**Files:**
- Modify: `supabase/schema.sql`, `src/lib/types.ts`

- [ ] **Step 1: Add columns to `supabase/schema.sql`**

In the `create table if not exists public.users (...)` block, add two columns just before `created_at`:

```sql
  timezone    text not null default 'Europe/Amsterdam',
  day_start   time not null default '08:00',
  day_end     time not null default '22:00',
  created_at  timestamptz not null default now(),
```

(Leave the rest of the file unchanged.)

- [ ] **Step 2: Manual live-DB migration — SKIP during implementation**

This SQL must be run once in the Supabase SQL editor (the controller/user does this, not the implementer):

```sql
alter table public.users
  add column if not exists day_start time not null default '08:00',
  add column if not exists day_end   time not null default '22:00';
```

Do NOT attempt to run it — you have no Supabase access. The code compiles and unit-tests pass without it.

- [ ] **Step 3: Extend `AppUser` in `src/lib/types.ts`**

Add the two fields to the `AppUser` interface (after `timezone`):

```ts
export interface AppUser {
  id: string;
  telegram_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  timezone: string;
  day_start: string; // "HH:mm" or "HH:mm:ss" from Postgres time
  day_end: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors. (`getUserById`/`upsertTelegramUser` use `select("*")`, so the new columns flow through automatically; the upsert relies on DB defaults for the two new columns.)

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/lib/types.ts
git commit -m "feat: add waking-hours columns (day_start/day_end) to users"
```

---

## Task 2: Advisor types

**Files:**
- Create: `src/lib/advisor/types.ts`

- [ ] **Step 1: Create `src/lib/advisor/types.ts`**

```ts
import type { Category } from "@/lib/events/types";

export interface SlotRequest {
  title: string;
  category: Category;
  count: number;          // >= 1
  duration_min: number;   // > 0
  window: { from: string; to: string }; // yyyy-MM-dd inclusive
  part_of_day: "morning" | "afternoon" | "evening" | "any";
}

export interface ProposedSlot {
  date: string;       // yyyy-MM-dd (local)
  starts_at: string;  // ISO UTC
  ends_at: string;    // ISO UTC
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/advisor/types.ts
git commit -m "feat: advisor types (SlotRequest, ProposedSlot)"
```

---

## Task 3: `findSlots` algorithm (pure core, TDD)

**Files:**
- Create: `src/lib/advisor/find-slots.ts`, `src/lib/advisor/find-slots.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/advisor/find-slots.test.ts`

Uses `Europe/Moscow` (UTC+3, no DST in June) so UTC assertions are stable: local `08:00` → `05:00:00.000Z`.

```ts
import { describe, it, expect } from "vitest";
import { findSlots } from "./find-slots";
import type { SlotRequest } from "./types";
import type { CalendarEvent } from "@/lib/events/types";

const TZ = "Europe/Moscow";
const HOURS = { start: "08:00", end: "22:00" };

function req(overrides: Partial<SlotRequest> = {}): SlotRequest {
  return {
    title: "Зал",
    category: "gym",
    count: 3,
    duration_min: 60,
    window: { from: "2026-06-01", to: "2026-06-07" }, // Mon..Sun
    part_of_day: "any",
    ...overrides,
  };
}

function ev(date: string, start: string, end: string): CalendarEvent {
  return {
    id: `${date}-${start}`,
    user_id: "u",
    title: "busy",
    starts_at: `${date}T${start}:00+03:00`,
    ends_at: `${date}T${end}:00+03:00`,
    category: "work",
    is_fixed: true,
    notes: null,
    location: null,
    created_at: "",
    updated_at: "",
  };
}

describe("findSlots", () => {
  it("distributes count=3 evenly across a 7-day window (empty calendar)", () => {
    const slots = findSlots(req(), [], HOURS, TZ);
    expect(slots.map((s) => s.date)).toEqual(["2026-06-01", "2026-06-04", "2026-06-07"]);
    expect(slots[0].starts_at).toBe("2026-06-01T05:00:00.000Z"); // 08:00 MSK
    expect(slots[0].ends_at).toBe("2026-06-01T06:00:00.000Z");
  });

  it("pushes the start past a busy interval", () => {
    const slots = findSlots(req({ count: 1 }), [ev("2026-06-01", "08:00", "09:00")], HOURS, TZ);
    expect(slots[0].date).toBe("2026-06-01");
    expect(slots[0].starts_at).toBe("2026-06-01T06:00:00.000Z"); // 09:00 MSK
  });

  it("respects the morning window (before 12:00)", () => {
    const slots = findSlots(req({ count: 1, part_of_day: "morning" }), [], HOURS, TZ);
    expect(slots[0].starts_at).toBe("2026-06-01T05:00:00.000Z"); // 08:00 MSK
  });

  it("skips a fully-busy day and returns fewer than requested", () => {
    const busy = [ev("2026-06-02", "08:00", "22:00")];
    const slots = findSlots(req({ count: 7 }), busy, HOURS, TZ);
    expect(slots).toHaveLength(6);
    expect(slots.map((s) => s.date)).not.toContain("2026-06-02");
  });

  it("count=1 returns the first available day", () => {
    const slots = findSlots(req({ count: 1 }), [], HOURS, TZ);
    expect(slots).toHaveLength(1);
    expect(slots[0].date).toBe("2026-06-01");
  });

  it("returns nothing when the duration cannot fit the part-of-day window", () => {
    const slots = findSlots(req({ duration_min: 600, part_of_day: "morning" }), [], HOURS, TZ);
    expect(slots).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx vitest run src/lib/advisor/find-slots.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/advisor/find-slots.ts`**

```ts
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { toUtcDateFromLocalParts } from "@/lib/datetime";
import type { CalendarEvent } from "@/lib/events/types";
import type { ProposedSlot, SlotRequest } from "./types";

const GRID_MIN = 15;

function hhmmToMin(value: string): number {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function partWindow(
  part: SlotRequest["part_of_day"],
  dayStart: number,
  dayEnd: number,
): [number, number] {
  switch (part) {
    case "morning":
      return [dayStart, Math.min(12 * 60, dayEnd)];
    case "afternoon":
      return [Math.max(12 * 60, dayStart), Math.min(18 * 60, dayEnd)];
    case "evening":
      return [Math.max(18 * 60, dayStart), dayEnd];
    default:
      return [dayStart, dayEnd];
  }
}

export function findSlots(
  request: SlotRequest,
  busyEvents: CalendarEvent[],
  dayHours: { start: string; end: string },
  timezone: string,
): ProposedSlot[] {
  const dayStart = hhmmToMin(dayHours.start);
  const dayEnd = hhmmToMin(dayHours.end);
  const [winStart, winEnd] = partWindow(request.part_of_day, dayStart, dayEnd);
  const dur = request.duration_min;

  const days = eachDayOfInterval({
    start: parseISO(request.window.from),
    end: parseISO(request.window.to),
  });

  const candidates: { date: string; startMin: number }[] = [];

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");

    // Busy intervals (local minutes) for events that START on this date.
    const busy: Array<[number, number]> = [];
    for (const e of busyEvents) {
      if (formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") !== dateStr) continue;
      const s = hhmmToMin(formatInTimeZone(e.starts_at, timezone, "HH:mm"));
      let en = hhmmToMin(formatInTimeZone(e.ends_at, timezone, "HH:mm"));
      if (en <= s) en = dayEnd; // guard against cross-midnight ends
      busy.push([s, en]);
    }

    // Earliest free slot on the 15-min grid within the part-of-day window.
    let foundMin: number | null = null;
    for (let start = winStart; start + dur <= winEnd; start += GRID_MIN) {
      const end = start + dur;
      const overlaps = busy.some(([bs, be]) => start < be && end > bs);
      if (!overlaps) {
        foundMin = start;
        break;
      }
    }
    if (foundMin !== null) candidates.push({ date: dateStr, startMin: foundMin });
  }

  // Distribute `count` occurrences across the candidate days.
  const n = candidates.length;
  let chosen: { date: string; startMin: number }[];
  if (request.count <= 1) {
    chosen = candidates.slice(0, 1);
  } else if (n <= request.count) {
    chosen = candidates;
  } else {
    const idxs = new Set<number>();
    for (let i = 0; i < request.count; i++) {
      idxs.add(Math.round((i * (n - 1)) / (request.count - 1)));
    }
    chosen = [...idxs].sort((a, b) => a - b).map((i) => candidates[i]);
  }

  return chosen.map(({ date, startMin }) => ({
    date,
    starts_at: toUtcDateFromLocalParts(date, minToHHMM(startMin), timezone).toISOString(),
    ends_at: toUtcDateFromLocalParts(date, minToHHMM(startMin + dur), timezone).toISOString(),
  }));
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx vitest run src/lib/advisor/find-slots.test.ts`
Expected: PASS (6 tests).
Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/advisor/find-slots.ts src/lib/advisor/find-slots.test.ts
git commit -m "feat: deterministic slot-finding algorithm"
```

---

## Task 4: `parseRequest` (OpenAI NL → SlotRequest, TDD)

**Files:**
- Create: `src/lib/advisor/parse-request.ts`, `src/lib/advisor/parse-request.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/advisor/parse-request.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@/lib/openai", () => ({
  getOpenAI: () => ({ chat: { completions: { create: createMock } } }),
}));

import { parseRequest } from "./parse-request";

beforeEach(() => createMock.mockReset());

function toolResponse(args: Record<string, unknown>) {
  return {
    choices: [
      { message: { tool_calls: [{ function: { name: "plan_request", arguments: JSON.stringify(args) } }] } },
    ],
  };
}

describe("parseRequest", () => {
  it("maps a tool call into a SlotRequest", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Зал",
        category: "gym",
        count: 3,
        duration_min: 60,
        window_from: "2026-06-01",
        window_to: "2026-06-07",
        part_of_day: "morning",
      }),
    );
    const r = await parseRequest("зал 3 раза утром на час", { today: "2026-06-01", timezone: "Europe/Moscow" });
    expect(r.title).toBe("Зал");
    expect(r.category).toBe("gym");
    expect(r.count).toBe(3);
    expect(r.duration_min).toBe(60);
    expect(r.window).toEqual({ from: "2026-06-01", to: "2026-06-07" });
    expect(r.part_of_day).toBe("morning");
  });

  it("clamps count and duration, falls back unknown category to other", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "X",
        category: "banana",
        count: 99,
        duration_min: 5,
        window_from: "2026-06-01",
        window_to: "2026-06-07",
        part_of_day: "weird",
      }),
    );
    const r = await parseRequest("x", { today: "2026-06-01", timezone: "Europe/Moscow" });
    expect(r.category).toBe("other");
    expect(r.count).toBe(14);          // clamped to max
    expect(r.duration_min).toBe(15);   // clamped to min
    expect(r.part_of_day).toBe("any"); // invalid → any
  });

  it("throws when the model returns no tool call", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "?" } }] });
    await expect(parseRequest("x", { today: "2026-06-01", timezone: "Europe/Moscow" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx vitest run src/lib/advisor/parse-request.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/advisor/parse-request.ts`**

```ts
import type OpenAI from "openai";
import { addDays, format, parseISO } from "date-fns";

import { getOpenAI } from "@/lib/openai";
import { CATEGORIES, isCategory } from "@/lib/events/categories";
import type { SlotRequest } from "./types";

const PARTS = ["morning", "afternoon", "evening", "any"] as const;

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "plan_request",
    description: "Extract a scheduling request: what to schedule, how many times, how long, in which window and part of day.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short activity title" },
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        count: { type: "integer", description: "How many occurrences (default 1)" },
        duration_min: { type: "integer", description: "Duration of each in minutes (default 60)" },
        window_from: { type: "string", description: "Window start date yyyy-MM-dd" },
        window_to: { type: "string", description: "Window end date yyyy-MM-dd (inclusive)" },
        part_of_day: { type: "string", enum: ["morning", "afternoon", "evening", "any"] },
      },
      required: ["title", "category", "count", "duration_min", "window_from", "window_to", "part_of_day"],
    },
  },
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function validDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function parseRequest(
  text: string,
  ctx: { today: string; timezone: string },
): Promise<SlotRequest> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `Today is ${ctx.today}. The user's timezone is ${ctx.timezone}. ` +
          `Interpret the user's scheduling request. Resolve relative ranges ("на этой неделе" = Monday–Sunday of the current week) into window_from/window_to as yyyy-MM-dd. ` +
          `count defaults to 1, duration_min defaults to 60. ` +
          `Categories: ${CATEGORIES.join(", ")}. Pick part_of_day from morning/afternoon/evening/any.`,
      },
      { role: "user", content: text },
    ],
    tools: [TOOL],
    tool_choice: { type: "function", function: { name: "plan_request" } },
    max_tokens: 300,
  });

  const rawCall = response.choices[0]?.message.tool_calls?.[0];
  const call = rawCall as Extract<typeof rawCall, { type: "function" }> | undefined;
  if (!call || !("function" in call)) {
    throw new Error("Could not parse a scheduling request.");
  }

  const args = JSON.parse(call.function.arguments) as Record<string, unknown>;

  const defaultFrom = ctx.today;
  const defaultTo = format(addDays(parseISO(ctx.today), 6), "yyyy-MM-dd");
  const from = validDate(args.window_from) ? args.window_from : defaultFrom;
  let to = validDate(args.window_to) ? args.window_to : defaultTo;
  if (to < from) to = defaultTo;

  const part = PARTS.includes(args.part_of_day as (typeof PARTS)[number])
    ? (args.part_of_day as SlotRequest["part_of_day"])
    : "any";

  return {
    title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : "Событие",
    category: typeof args.category === "string" && isCategory(args.category) ? args.category : "other",
    count: clamp(Number(args.count), 1, 14),
    duration_min: clamp(Number(args.duration_min), 15, 600),
    window: { from, to },
    part_of_day: part,
  };
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx vitest run src/lib/advisor/parse-request.test.ts`
Expected: PASS (3 tests).
Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/advisor/parse-request.ts src/lib/advisor/parse-request.test.ts
git commit -m "feat: AI parse of scheduling requests"
```

---

## Task 5: Advisor server actions

**Files:**
- Create: `src/lib/advisor/actions.ts`

- [ ] **Step 1: Create `src/lib/advisor/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { insertEvent } from "@/lib/events/queries";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Category } from "@/lib/events/types";
import type { ProposedSlot } from "./types";

export async function createPlanAction(
  slots: ProposedSlot[],
  title: string,
  category: Category,
): Promise<void> {
  const user = await requireCurrentUser();
  for (const slot of slots) {
    await insertEvent({
      user_id: user.id,
      title: title.trim() || "Событие",
      category,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      is_fixed: false, // advisor places flexible activities
      notes: null,
      location: null,
    });
  }
  revalidatePath("/calendar");
}

export async function updateDayHoursAction(dayStart: string, dayEnd: string): Promise<void> {
  const user = await requireCurrentUser();
  if (dayStart >= dayEnd) throw new Error("Начало дня должно быть раньше конца");
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("users")
    .update({ day_start: dayStart, day_end: dayEnd })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/advisor/actions.ts
git commit -m "feat: advisor actions (create plan, update day hours)"
```

---

## Task 6: `/api/find-slots` route

**Files:**
- Create: `src/app/api/find-slots/route.ts`

- [ ] **Step 1: Create `src/app/api/find-slots/route.ts`**

```ts
import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";

import { getCurrentUser } from "@/lib/auth";
import { parseRequest } from "@/lib/advisor/parse-request";
import { findSlots } from "@/lib/advisor/find-slots";
import { getEventsInRange } from "@/lib/events/queries";
import { getDateRangeUtc } from "@/lib/datetime";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
    const req = await parseRequest(text.trim(), { today, timezone: user.timezone });

    const { start, end } = getDateRangeUtc(req.window.from, req.window.to, user.timezone);
    const events = await getEventsInRange(user.id, start, end);

    const slots = findSlots(
      req,
      events,
      { start: user.day_start || "08:00", end: user.day_end || "22:00" },
      user.timezone,
    );

    return NextResponse.json({
      slots,
      request: { title: req.title, category: req.category, count: req.count },
    });
  } catch {
    return NextResponse.json({ error: "parse_failed" }, { status: 422 });
  }
}
```

- [ ] **Step 2: Verify compile + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npx next build` → succeeds; route list includes `/api/find-slots`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/find-slots"
git commit -m "feat: find-slots API route"
```

---

## Task 7: Advisor sheet UI + ✨ entry point

**Files:**
- Create: `src/components/advisor/advisor-sheet.tsx`
- Modify: `src/app/(app)/calendar/page.tsx`, `src/components/calendar/calendar-screen.tsx`

- [ ] **Step 1: Create `src/components/advisor/advisor-sheet.tsx`**

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { categoryEmoji } from "@/lib/events/categories";
import { createPlanAction, updateDayHoursAction } from "@/lib/advisor/actions";
import type { Category } from "@/lib/events/types";
import type { ProposedSlot } from "@/lib/advisor/types";

interface PlanResult {
  slots: ProposedSlot[];
  request: { title: string; category: Category; count: number };
}

export function AdvisorSheet({
  timezone,
  dayStart,
  dayEnd,
  onClose,
}: {
  timezone: string;
  dayStart: string;
  dayEnd: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [start, setStart] = useState(dayStart.slice(0, 5));
  const [end, setEnd] = useState(dayEnd.slice(0, 5));
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function find() {
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const res = await fetch("/api/find-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as PlanResult;
      setResult(data);
      setSelected(new Set(data.slots.map((_, i) => i)));
    } catch {
      setError("Не понял запрос. Попробуй иначе.");
    } finally {
      setPending(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function saveHours(nextStart: string, nextEnd: string) {
    setStart(nextStart);
    setEnd(nextEnd);
    if (nextStart < nextEnd) {
      try {
        await updateDayHoursAction(nextStart, nextEnd);
      } catch {
        // non-blocking; hours persist on next valid change
      }
    }
  }

  async function addPlan() {
    if (!result) return;
    const slots = result.slots.filter((_, i) => selected.has(i));
    if (slots.length === 0) return;
    setAdding(true);
    try {
      await createPlanAction(slots, result.request.title, result.request.category);
      onClose();
    } catch {
      setError("Не удалось добавить");
      setAdding(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none";
  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#111] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">✨ Найти время</span>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2a2a] text-xs text-[#999]">✕</button>
        </div>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="зал 3 раза на неделе утром"
          className={`${inputCls} mb-3`}
        />

        <div className="mb-3 flex items-center gap-2 text-xs text-[#999]">
          <span>Активен</span>
          <input type="time" value={start} onChange={(e) => saveHours(e.target.value, end)} className="rounded-lg bg-[#1a1a1a] px-2 py-1 text-white outline-none" />
          <span>–</span>
          <input type="time" value={end} onChange={(e) => saveHours(start, e.target.value)} className="rounded-lg bg-[#1a1a1a] px-2 py-1 text-white outline-none" />
        </div>

        <button onClick={find} disabled={pending || !text.trim()} className="mb-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
          {pending ? "Ищу…" : "Найти"}
        </button>

        {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}

        {result && result.slots.length === 0 && (
          <p className="text-center text-xs text-[#777]">Свободных окон не нашёл — попробуй другой день или часы.</p>
        )}

        {result && result.slots.length > 0 && (
          <div className="flex flex-col gap-2">
            {result.request.count > result.slots.length && (
              <p className="text-xs text-amber-400">⚠️ нашёл только {result.slots.length} из {result.request.count}</p>
            )}
            {result.slots.map((slot, i) => {
              const on = selected.has(i);
              const day = formatInTimeZone(slot.starts_at, timezone, "EEE d MMM", { locale: ru });
              const s = formatInTimeZone(slot.starts_at, timezone, "HH:mm");
              const e = formatInTimeZone(slot.ends_at, timezone, "HH:mm");
              return (
                <button
                  key={slot.starts_at}
                  onClick={() => toggle(i)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-left"
                  style={{ background: on ? "#1a1a1a" : "#141414", opacity: on ? 1 : 0.5 }}
                >
                  <span className="text-base">{on ? "☑" : "☐"}</span>
                  <span className="text-lg">{categoryEmoji(result.request.category)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{result.request.title}</span>
                    <span className="block text-xs text-[#777]">{day} · {s}–{e}</span>
                  </span>
                </button>
              );
            })}
            <button onClick={addPlan} disabled={adding || selectedCount === 0} className="mt-2 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
              {adding ? "Добавляю…" : `Добавить план (${selectedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Pass day hours from the calendar page** — `src/app/(app)/calendar/page.tsx`

Change the final render line:

```tsx
  return <CalendarScreen events={events} dayNotes={dayNotes} monthStr={monthStr} timezone={user.timezone} />;
```

to:

```tsx
  return (
    <CalendarScreen
      events={events}
      dayNotes={dayNotes}
      monthStr={monthStr}
      timezone={user.timezone}
      dayStart={user.day_start || "08:00"}
      dayEnd={user.day_end || "22:00"}
    />
  );
```

- [ ] **Step 3: Wire the ✨ button + advisor sheet** — `src/components/calendar/calendar-screen.tsx`

Add the import near the other imports:

```tsx
import { AdvisorSheet } from "@/components/advisor/advisor-sheet";
```

Add `dayStart`/`dayEnd` to the props (signature) — replace the props block:

```tsx
export function CalendarScreen({
  events,
  dayNotes,
  monthStr,
  timezone,
  dayStart,
  dayEnd,
}: {
  events: CalendarEvent[];
  dayNotes: Note[];
  monthStr: string;
  timezone: string;
  dayStart: string;
  dayEnd: string;
}) {
```

Add advisor open state next to the existing state hooks:

```tsx
  const [advisorOpen, setAdvisorOpen] = useState(false);
```

Add the ✨ FAB just before the existing `+` FAB button, and render the sheet next to the capture sheet. Replace the JSX from the `+` button through the end of the component with:

```tsx
      <button
        onClick={() => setAdvisorOpen(true)}
        className="fixed bottom-44 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-2xl shadow-lg"
        aria-label="Найти время"
      >
        ✨
      </button>
      <button
        onClick={() => { setEditing(null); setSheetOpen(true); }}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg"
        aria-label="Добавить"
      >
        +
      </button>
      {sheetOpen && (
        <CaptureSheet
          timezone={timezone}
          defaultDate={todayStr}
          editing={editing}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
      {advisorOpen && (
        <AdvisorSheet
          timezone={timezone}
          dayStart={dayStart}
          dayEnd={dayEnd}
          onClose={() => setAdvisorOpen(false)}
        />
      )}
    </>
  );
}
```

(The two FABs stack: `+` at `bottom-24`, ✨ at `bottom-44`, both clear of the `bottom-0` nav.)

- [ ] **Step 4: Verify compile + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npx next build` → succeeds; routes include `/api/find-slots`, `/calendar`.

- [ ] **Step 5: Commit**

```bash
git add src/components/advisor "src/app/(app)/calendar/page.tsx" src/components/calendar/calendar-screen.tsx
git commit -m "feat: advisor sheet UI and entry point"
```

---

## Self-Review

**Spec coverage:**
- ✅ `parseRequest` (AI, understanding only) — Task 4
- ✅ `findSlots` (pure, deterministic, never overlaps, distributes) — Task 3
- ✅ Waking hours `day_start`/`day_end` on users + inline editor — Task 1, Task 7
- ✅ `/api/find-slots` (auth → parse → fetch events → find) — Task 6
- ✅ Advisor sheet: text input, hours editor, toggleable slot cards, "found fewer", empty state, batch create — Task 7
- ✅ ✨ entry point on calendar — Task 7
- ✅ Batch create as flexible one-off events via `insertEvent` — Task 5
- ✅ Mini-app only, no bot, no rescheduling — respected (no bot/handler changes)

**Type consistency:** `SlotRequest` (Task 2) is produced by `parseRequest` (Task 4) and consumed by `findSlots` (Task 3) — fields match (`count`, `duration_min`, `window.{from,to}`, `part_of_day`). `ProposedSlot` (Task 2) flows findSlots → route → AdvisorSheet → `createPlanAction` (Task 5). `AppUser.day_start/day_end` (Task 1) read in route (Task 6) and page (Task 7). `createPlanAction(slots, title, category)` signature matches the call in AdvisorSheet.

**Placeholders:** none — every step has complete code.

**Edge cases handled:** count=1 (no divide-by-zero); duration larger than window → no slots; fully-busy day skipped; fewer-than-requested surfaced in UI; invalid day hours rejected; parse failure → 422 → inline error.
