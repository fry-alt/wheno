# Part 1: Mini App Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/calendar` with dark minimalist UI, week-strip navigation, weekly stats, activity filters, swipe-to-delete cards, and a quick-add FAB.

**Architecture:** New client components (`CalendarEventCard`, `QuickAddSheet`) handle interactivity. `PersonalCalendar` is rewritten as a client component shell. Pure utilities in `calendar-utils.ts` are tested with Vitest. Data comes from `calendar_events` (already populated by the bot).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase admin client, Vitest, date-fns, date-fns-tz

---

## File Map

**Create:**
- `src/lib/calendar-utils.ts` — `computeWeekStats`, `filterEventsByTab`, `getActivityEmoji`, `ACTIVITY_GROUPS`
- `src/lib/calendar-utils.test.ts` — Vitest tests for the above
- `src/components/calendar-event-card.tsx` — client, swipe-enabled dark card
- `src/components/quick-add-sheet.tsx` — client, bottom-sheet add form

**Modify:**
- `src/lib/types.ts` — add `CalendarEvent` type
- `src/lib/db/queries.ts` — add `getCalendarEventsForUserInRange`
- `src/lib/actions.ts` — add `createCalendarEventAction`, `deleteCalendarEventAction`
- `src/components/personal-calendar.tsx` — full rewrite
- `src/app/calendar/page.tsx` — use `getCalendarEventsForUserInRange`

---

## Task 1: CalendarEvent type + DB query

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db/queries.ts`

- [ ] **Step 1: Add CalendarEvent type to `src/lib/types.ts`**

At the bottom of the file, add:

```typescript
export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  activity_type: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  energy_after: "high" | "medium" | "low" | null;
  dress_code: "athletic" | "casual" | "smart" | "formal" | null;
  is_flexible: boolean;
  notes: string | null;
  source: string;
  created_at: string;
};
```

- [ ] **Step 2: Add import + query to `src/lib/db/queries.ts`**

Add `CalendarEvent` to the existing type imports block at the top:

```typescript
import type {
  // ... existing types ...
  CalendarEvent,
} from "@/lib/types";
```

Add at the bottom of the file:

```typescript
export async function getCalendarEventsForUserInRange({
  userId,
  startAt,
  endAt,
}: {
  userId: string;
  startAt: string;
  endAt: string;
}): Promise<CalendarEvent[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("calendar_events")
    .select("id, user_id, title, activity_type, starts_at, ends_at, location, energy_after, dress_code, is_flexible, notes, source, created_at")
    .eq("user_id", userId)
    .gte("starts_at", startAt)
    .lte("starts_at", endAt)
    .order("starts_at", { ascending: true });
  return (data ?? []) as CalendarEvent[];
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/db/queries.ts
git commit -m "feat: add CalendarEvent type and getCalendarEventsForUserInRange query"
```

---

## Task 2: Calendar utility functions + tests

**Files:**
- Create: `src/lib/calendar-utils.ts`
- Create: `src/lib/calendar-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/calendar-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeWeekStats, filterEventsByTab, getActivityEmoji } from "./calendar-utils";
import type { CalendarEvent } from "./types";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1", user_id: "u1", title: "Test", activity_type: null,
    starts_at: "2026-06-01T10:00:00Z", ends_at: "2026-06-01T11:00:00Z",
    location: null, energy_after: null, dress_code: null,
    is_flexible: true, notes: null, source: "ai", created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeWeekStats", () => {
  it("counts sport events", () => {
    const events = [makeEvent({ activity_type: "gym" }), makeEvent({ activity_type: "run" })];
    expect(computeWeekStats(events).sport).toBe(2);
  });
  it("counts social events", () => {
    const events = [makeEvent({ activity_type: "dinner" }), makeEvent({ activity_type: "coffee" })];
    expect(computeWeekStats(events).social).toBe(2);
  });
  it("counts work events", () => {
    expect(computeWeekStats([makeEvent({ activity_type: "meeting" })]).work).toBe(1);
  });
  it("ignores unknown activity_type", () => {
    const s = computeWeekStats([makeEvent({ activity_type: "other" })]);
    expect(s.sport + s.social + s.work).toBe(0);
  });
});

describe("filterEventsByTab", () => {
  const events = [
    makeEvent({ activity_type: "gym" }),
    makeEvent({ activity_type: "dinner" }),
    makeEvent({ activity_type: "meeting" }),
    makeEvent({ activity_type: "other" }),
  ];
  it("returns all for 'all'", () => expect(filterEventsByTab(events, "all")).toHaveLength(4));
  it("filters sport", () => expect(filterEventsByTab(events, "sport")).toHaveLength(1));
  it("filters social", () => expect(filterEventsByTab(events, "social")).toHaveLength(1));
  it("filters work", () => expect(filterEventsByTab(events, "work")).toHaveLength(1));
});

describe("getActivityEmoji", () => {
  it("returns emoji for known types", () => {
    expect(getActivityEmoji("gym")).toBe("🏋️");
    expect(getActivityEmoji("dinner")).toBe("🍽️");
    expect(getActivityEmoji("meeting")).toBe("💼");
  });
  it("returns default for unknown", () => {
    expect(getActivityEmoji(null)).toBe("📌");
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/lib/calendar-utils.test.ts
```
Expected: FAIL — `Cannot find module './calendar-utils'`

- [ ] **Step 3: Create `src/lib/calendar-utils.ts`**

```typescript
import type { CalendarEvent } from "./types";

export type ActivityGroup = "sport" | "social" | "work";
export type FilterTab = "all" | "sport" | "social" | "work";

export const ACTIVITY_GROUPS: Record<string, ActivityGroup> = {
  gym: "sport", run: "sport", swim: "sport", tennis: "sport",
  cycling: "sport", yoga: "sport", sport: "sport",
  dinner: "social", lunch: "social", coffee: "social", drinks: "social",
  bar: "social", party: "social", concert: "social", theatre: "social",
  cinema: "social", event: "social",
  work: "work", meeting: "work", conference: "work", call: "work",
};

const EMOJI_MAP: Record<string, string> = {
  gym: "🏋️", run: "🏃", swim: "🏊", tennis: "🎾", cycling: "🚴",
  yoga: "🧘", sport: "⚽", dinner: "🍽️", lunch: "🥗", coffee: "☕",
  drinks: "🍹", bar: "🍺", party: "🎉", concert: "🎵", theatre: "🎭",
  cinema: "🎬", event: "📅", work: "💻", meeting: "💼", conference: "🏛️",
  call: "📞", rest: "😴", sleep: "🛏️", travel: "✈️",
};

export function getActivityEmoji(type: string | null): string {
  return EMOJI_MAP[type ?? ""] ?? "📌";
}

export function computeWeekStats(events: CalendarEvent[]): Record<ActivityGroup, number> {
  const counts: Record<ActivityGroup, number> = { sport: 0, social: 0, work: 0 };
  for (const e of events) {
    const group = ACTIVITY_GROUPS[e.activity_type ?? ""];
    if (group) counts[group]++;
  }
  return counts;
}

export function filterEventsByTab(events: CalendarEvent[], tab: FilterTab): CalendarEvent[] {
  if (tab === "all") return events;
  return events.filter((e) => ACTIVITY_GROUPS[e.activity_type ?? ""] === tab);
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/lib/calendar-utils.test.ts
```
Expected: PASS — all 9 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-utils.ts src/lib/calendar-utils.test.ts
git commit -m "feat: add calendar utility functions with tests"
```

---

## Task 3: Server actions — create + delete event

**Files:**
- Modify: `src/lib/actions.ts`

- [ ] **Step 1: Add two actions to `src/lib/actions.ts`**

Add these imports to the existing import block (don't duplicate what's already there):

```typescript
import { fromZonedTime } from "date-fns-tz";
import { getAdminSupabase } from "@/lib/supabase/admin";
```

Add at the bottom of the file:

```typescript
export async function createCalendarEventAction(data: {
  title: string;
  activity_type: string;
  date: string;       // "yyyy-MM-dd"
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
}): Promise<void> {
  const user = await requireCurrentUser();
  const tz = normalizeTimezone(user.timezone);
  const starts_at = fromZonedTime(`${data.date}T${data.start_time}:00`, tz).toISOString();
  const ends_at = fromZonedTime(`${data.date}T${data.end_time}:00`, tz).toISOString();

  const admin = getAdminSupabase();
  await admin.from("calendar_events").insert({
    user_id: user.id,
    title: data.title,
    activity_type: data.activity_type,
    starts_at,
    ends_at,
    energy_after: "medium",
    dress_code: "casual",
    is_flexible: true,
    source: "manual",
  });

  revalidatePath("/calendar");
}

export async function deleteCalendarEventAction(eventId: string): Promise<void> {
  const user = await requireCurrentUser();
  const admin = getAdminSupabase();
  await admin
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id);
  revalidatePath("/calendar");
}
```

Note: `normalizeTimezone`, `revalidatePath`, `requireCurrentUser`, and `getAdminSupabase` are already imported — do not add duplicate imports.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat: add createCalendarEventAction and deleteCalendarEventAction"
```

---

## Task 4: CalendarEventCard component

**Files:**
- Create: `src/components/calendar-event-card.tsx`

- [ ] **Step 1: Create `src/components/calendar-event-card.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { deleteCalendarEventAction } from "@/lib/actions";
import { getActivityEmoji } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/types";

const SWIPE_REVEAL = 120;
const SWIPE_THRESHOLD = 60;

const ENERGY_COLOR: Record<string, string> = {
  high: "#22c55e", medium: "#f59e0b", low: "#ef4444",
};
const ENERGY_EMOJI: Record<string, string> = {
  high: "✨", medium: "⚡", low: "🔋",
};

export function CalendarEventCard({
  event,
  timezone,
}: {
  event: CalendarEvent;
  timezone: string;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  const startTime = formatInTimeZone(event.starts_at, timezone, "HH:mm");
  const endTime = formatInTimeZone(event.ends_at, timezone, "HH:mm");
  const emoji = getActivityEmoji(event.activity_type);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current || startX.current === null) return;
    const dx = startX.current - e.touches[0].clientX;
    setOffset(Math.max(0, Math.min(dx, SWIPE_REVEAL)));
  }

  function onTouchEnd() {
    dragging.current = false;
    startX.current = null;
    setOffset((prev) => (prev >= SWIPE_THRESHOLD ? SWIPE_REVEAL : 0));
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Revealed action buttons */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE_REVEAL }}>
        <button
          className="flex-1 bg-[#2a2a2a] text-sm"
          onClick={() => setOffset(0)}
        >
          ✏️
        </button>
        <button
          className="flex-1 bg-red-600 text-sm"
          onClick={async () => { await deleteCalendarEventAction(event.id); }}
        >
          🗑️
        </button>
      </div>

      {/* Card */}
      <div
        style={{
          transform: `translateX(-${offset}px)`,
          transition: dragging.current ? "none" : "transform 0.2s ease",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-4 py-3"
      >
        <span className="text-xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{event.title}</p>
          <p className="mt-0.5 text-xs text-[#666]">
            {startTime}–{endTime}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        {event.energy_after && (
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: `${ENERGY_COLOR[event.energy_after]}22`,
              color: ENERGY_COLOR[event.energy_after],
            }}
          >
            {ENERGY_EMOJI[event.energy_after]}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar-event-card.tsx
git commit -m "feat: add CalendarEventCard with swipe-to-delete"
```

---

## Task 5: QuickAddSheet component

**Files:**
- Create: `src/components/quick-add-sheet.tsx`

- [ ] **Step 1: Create `src/components/quick-add-sheet.tsx`**

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { createCalendarEventAction } from "@/lib/actions";

const ACTIVITY_TYPES = [
  { value: "gym", label: "🏋️ Зал" },
  { value: "run", label: "🏃 Пробежка" },
  { value: "dinner", label: "🍽️ Ужин" },
  { value: "coffee", label: "☕ Кофе" },
  { value: "meeting", label: "💼 Встреча" },
  { value: "work", label: "💻 Работа" },
  { value: "other", label: "📌 Другое" },
];

export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    await createCalendarEventAction({
      title: fd.get("title") as string,
      activity_type: fd.get("activity_type") as string,
      date: fd.get("date") as string,
      start_time: fd.get("start_time") as string,
      end_time: fd.get("end_time") as string,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#1a1a1a] p-6 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-5 text-base font-semibold text-white">Добавить событие</h3>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            required
            name="title"
            placeholder="Название"
            className="w-full rounded-xl bg-[#111] px-4 py-3 text-sm text-white placeholder-[#555] outline-none"
          />
          <select
            name="activity_type"
            defaultValue="other"
            className="w-full rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            required
            name="date"
            type="date"
            defaultValue={today}
            className="w-full rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
          />
          <div className="flex gap-3">
            <input
              required
              name="start_time"
              type="time"
              defaultValue="09:00"
              className="flex-1 rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
            />
            <input
              required
              name="end_time"
              type="time"
              defaultValue="10:00"
              className="flex-1 rounded-xl bg-[#111] px-4 py-3 text-sm text-white outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {pending ? "Добавляю..." : "Добавить"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/quick-add-sheet.tsx
git commit -m "feat: add QuickAddSheet bottom sheet component"
```

---

## Task 6: Rewrite PersonalCalendar

**Files:**
- Modify: `src/components/personal-calendar.tsx`

- [ ] **Step 1: Replace entire contents of `src/components/personal-calendar.tsx`**

```tsx
"use client";

import { useState } from "react";
import { addDays, format, isToday, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarEventCard } from "@/components/calendar-event-card";
import { QuickAddSheet } from "@/components/quick-add-sheet";
import { computeWeekStats, filterEventsByTab } from "@/lib/calendar-utils";
import type { FilterTab } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/types";

const FILTER_LABELS: { tab: FilterTab; label: string }[] = [
  { tab: "all", label: "Все" },
  { tab: "sport", label: "Спорт" },
  { tab: "work", label: "Работа" },
  { tab: "social", label: "Социальное" },
];

export function PersonalCalendar({
  events,
  timezone,
  weekStart,
}: {
  events: CalendarEvent[];
  timezone: string;
  weekStart: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(parseISO(weekStart), i));
  const todayIndex = days.findIndex((d) => isToday(d));
  const [selectedIndex, setSelectedIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showAdd, setShowAdd] = useState(false);

  const stats = computeWeekStats(events);

  const selectedDateStr = format(days[selectedIndex], "yyyy-MM-dd");
  const dayEvents = events.filter(
    (e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === selectedDateStr,
  );
  const filteredEvents = filterEventsByTab(dayEvents, filter);

  // e.g. "3 тренировки · 2 ужина"
  const statParts: string[] = [];
  if (stats.sport) statParts.push(`${stats.sport} ${pluralRu(stats.sport, "тренировка", "тренировки", "тренировок")}`);
  if (stats.social) statParts.push(`${stats.social} ${pluralRu(stats.social, "ужин", "ужина", "ужинов")}`);
  if (stats.work) statParts.push(`${stats.work} ${pluralRu(stats.work, "встреча", "встречи", "встреч")}`);

  return (
    <div className="relative min-h-screen bg-[#0f0f0f] pb-24">
      {/* Week strip */}
      <div className="flex gap-1 overflow-x-auto px-4 py-4 scrollbar-hide">
        {days.map((day, i) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const hasEvents = events.some(
            (e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === dayStr,
          );
          const selected = i === selectedIndex;
          return (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className="flex flex-shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2"
              style={{ background: selected ? "#fff" : "transparent" }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: selected ? "#666" : "#555" }}>
                {formatInTimeZone(
                  fromZonedTime(`${dayStr}T12:00:00`, timezone),
                  timezone,
                  "EEE",
                )}
              </span>
              <span className="text-base font-bold" style={{ color: selected ? "#000" : "#fff" }}>
                {format(day, "d")}
              </span>
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: hasEvents ? (selected ? "#000" : "#555") : "transparent" }}
              />
            </button>
          );
        })}
      </div>

      {/* Stats */}
      {statParts.length > 0 && (
        <p className="px-4 pb-3 text-xs text-[#555]">{statParts.join(" · ")}</p>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-hide">
        {FILTER_LABELS.map(({ tab, label }) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className="flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold"
            style={{
              background: filter === tab ? "#fff" : "#1a1a1a",
              color: filter === tab ? "#000" : "#666",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div className="flex flex-col gap-2 px-4">
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-white">Свободный день</p>
            <p className="mt-1 text-xs text-[#555]">Нажми + чтобы добавить событие</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <CalendarEventCard event={event} key={event.id} timezone={timezone} />
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg"
      >
        +
      </button>

      {showAdd && <QuickAddSheet onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/personal-calendar.tsx
git commit -m "feat: rewrite PersonalCalendar — dark theme, week strip, stats, filters, FAB"
```

---

## Task 7: Update calendar/page.tsx

**Files:**
- Modify: `src/app/calendar/page.tsx`

- [ ] **Step 1: Replace contents of `src/app/calendar/page.tsx`**

```tsx
import { addDays, format, parseISO } from "date-fns";

import { AppShell } from "@/components/app-shell";
import { PersonalCalendar } from "@/components/personal-calendar";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarEventsForUserInRange } from "@/lib/db/queries";
import { getDateRangeUtc, getLocalDateValue } from "@/lib/datetime";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <AppShell
        description={copy.calendar.splashDescription}
        language={language}
        theme={theme}
        title={copy.calendar.title}
      >
        <SessionBootstrap language={language} />
      </AppShell>
    );
  }

  const weekStart = getLocalDateValue(user.timezone);
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const { start, end } = getDateRangeUtc(weekStart, weekEnd, user.timezone);

  const events = await getCalendarEventsForUserInRange({
    userId: user.id,
    startAt: start,
    endAt: end,
  });

  return (
    <AppShell
      description={copy.calendar.description}
      language={language}
      theme={theme}
      title={copy.calendar.title}
      user={user}
    >
      <PersonalCalendar events={events} timezone={user.timezone} weekStart={weekStart} />
    </AppShell>
  );
}
```

- [ ] **Step 2: Build**

```bash
npx next build
```
Expected: successful build, no TypeScript errors

- [ ] **Step 3: Deploy**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat: update calendar page to use calendar_events"
git push origin main
```
Wait for Vercel build to succeed.

- [ ] **Step 4: Manual test in Telegram mini app**

Open the bot → open mini app → navigate to calendar:
- Dark background visible
- Week strip shows today highlighted in white
- Stats bar shows event counts
- Filter tabs switch event list
- FAB opens QuickAddSheet
- Swipe left on an event reveals delete (red) and edit buttons
- Adding via QuickAddSheet → event appears in list after save
