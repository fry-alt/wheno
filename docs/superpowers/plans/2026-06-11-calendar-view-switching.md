# Calendar View Switching (month/week/year) + Refined dark — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. UI styling tasks go through the **frontend-design** skill and are validated with real screenshots (run/verify skills).

**Goal:** Add week and year calendar views with a segmented view switcher, and restyle the calendar (+ bottom nav) to a production-grade "Refined dark" language built on real design tokens.

**Architecture:** URL-driven (`?view=` + `?date=`). The server page parses the view + anchor, computes the fetch range via a pure `getViewRange` helper (skips the query for year), and passes data to `CalendarScreen`, which owns the `selectedDate` anchor and renders the active view. Pure date/color helpers are TDD'd with Vitest; UI is built on shared primitives + tokens and validated visually.

**Tech Stack:** Next.js 16 (App Router, `force-dynamic`), React 19, TypeScript, Tailwind v4 (`@theme inline` tokens in `globals.css`), date-fns / date-fns-tz, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-calendar-view-switching-design.md`

---

## File structure

**New:**
- `src/lib/calendar/views.ts` — `CalendarView` type, `getViewRange`, `buildWeek`. Pure.
- `src/lib/calendar/views.test.ts` — unit tests.
- `src/components/ui/surface.tsx` — layered card surface primitive.
- `src/components/ui/section-label.tsx` — uppercase tracked micro-label.
- `src/components/ui/icon-button.tsx` — round tap-target (‹ › ✕).
- `src/components/ui/segmented.tsx` — segmented control.
- `src/components/calendar/week-view.tsx` — 7-day agenda.
- `src/components/calendar/year-view.tsx` — 12 mini-months.
- `src/components/calendar/view-switcher.tsx` — wraps `Segmented`, pushes `?view=`.

**Modified:**
- `src/lib/events/categories.ts` (+ `.test.ts`) — add `CATEGORY_COLOR`.
- `src/app/globals.css` — Refined dark token values + new tokens.
- `src/components/calendar/event-row.tsx` — category color bar, tabular time.
- `src/components/calendar/month-grid.tsx` — restyle full mode + `compact` mode.
- `src/components/calendar/day-view.tsx` → **rename** `month-view.tsx` — restyle + new prop model.
- `src/components/calendar/calendar-screen.tsx` — owns anchor, renders switcher + active view.
- `src/app/(app)/calendar/page.tsx` — parse `view`+`date`, `getViewRange`, conditional fetch.
- `src/components/bottom-nav.tsx` — restyle to tokens.
- `src/app/(app)/layout.tsx` — background token.

**Conventions:** Russian labels are hardcoded in components (existing pattern). Do not edit `src/lib/i18n.ts` (the `check:i18n` script only guards it against mojibake). Per-task verification: `npm test` for logic, `npx tsc --noEmit` + `npm run lint` for components; final `npm run build` + screenshots.

---

## Task 1: `CATEGORY_COLOR` map

**Files:**
- Modify: `src/lib/events/categories.ts`
- Test: `src/lib/events/categories.test.ts`

- [ ] **Step 1: Extend the existing test** — add to the `describe("categories", …)` block in `categories.test.ts`:

```ts
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_DEFAULT_FIXED, CATEGORY_LABEL_RU, CATEGORY_COLOR, categoryEmoji, categoryColor } from "./categories";

it("every category has a hex color", () => {
  for (const c of CATEGORIES) {
    expect(CATEGORY_COLOR[c], `color for ${c}`).toMatch(/^#[0-9a-fA-F]{6}$/);
  }
});

it("categoryColor falls back to the 'other' color for unknown", () => {
  expect(categoryColor("nonsense")).toBe(CATEGORY_COLOR.other);
  expect(categoryColor("gym")).toBe(CATEGORY_COLOR.gym);
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- categories`
Expected: FAIL — `CATEGORY_COLOR`/`categoryColor` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/events/categories.ts`:

```ts
export const CATEGORY_COLOR: Record<Category, string> = {
  study: "#8b5cf6",   // violet
  work: "#3b82f6",    // blue
  meeting: "#6366f1", // indigo
  gym: "#ef4444",     // red
  run: "#22c55e",     // green
  meal: "#f59e0b",    // amber
  coffee: "#d97706",  // dark amber
  social: "#ec4899",  // pink
  rest: "#14b8a6",    // teal
  errand: "#eab308",  // yellow
  other: "#94a3b8",   // slate
};

export function categoryColor(c: string): string {
  return CATEGORY_COLOR[c as Category] ?? CATEGORY_COLOR.other;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- categories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/categories.ts src/lib/events/categories.test.ts
git commit -m "feat: per-category colors for calendar UI"
```

---

## Task 2: View helpers — `CalendarView`, `getViewRange`, `buildWeek`

**Files:**
- Create: `src/lib/calendar/views.ts`
- Test: `src/lib/calendar/views.test.ts`

`getViewRange` returns inclusive day-string bounds (`yyyy-MM-dd`) the page converts to UTC via `getDateRangeUtc`; `null` for year. `buildWeek` returns the 7 Mon–Sun days of the week containing the anchor.

- [ ] **Step 1: Write the failing test** — `src/lib/calendar/views.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseISO } from "date-fns";
import { getViewRange, buildWeek } from "./views";

describe("getViewRange", () => {
  it("month → first..last of the anchor's month", () => {
    expect(getViewRange("month", "2026-06-15")).toEqual({ dateFrom: "2026-06-01", dateTo: "2026-06-30" });
  });
  it("week → Mon..Sun containing the anchor", () => {
    // 2026-06-11 is a Thursday; week is Mon 2026-06-08 .. Sun 2026-06-14
    expect(getViewRange("week", "2026-06-11")).toEqual({ dateFrom: "2026-06-08", dateTo: "2026-06-14" });
  });
  it("week spanning two months", () => {
    // 2026-07-01 is a Wednesday; week is Mon 2026-06-29 .. Sun 2026-07-05
    expect(getViewRange("week", "2026-07-01")).toEqual({ dateFrom: "2026-06-29", dateTo: "2026-07-05" });
  });
  it("week spanning two years", () => {
    // 2026-12-31 is a Thursday; week is Mon 2026-12-28 .. Sun 2027-01-03
    expect(getViewRange("week", "2026-12-31")).toEqual({ dateFrom: "2026-12-28", dateTo: "2027-01-03" });
  });
  it("year → null (no events fetched)", () => {
    expect(getViewRange("year", "2026-06-11")).toBeNull();
  });
});

describe("buildWeek", () => {
  it("returns 7 days Mon..Sun", () => {
    const days = buildWeek(parseISO("2026-06-11"));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
    expect(days[0].getDate()).toBe(8);
    expect(days[6].getDate()).toBe(14);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- views`
Expected: FAIL — `./views` not found.

- [ ] **Step 3: Implement** — `src/lib/calendar/views.ts`:

```ts
import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export type CalendarView = "month" | "week" | "year";

export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "year"];

export function isCalendarView(v: string | undefined): v is CalendarView {
  return v === "month" || v === "week" || v === "year";
}

/** Inclusive day-string bounds for the fetch range; null for year (no events). */
export function getViewRange(
  view: CalendarView,
  anchorISO: string,
): { dateFrom: string; dateTo: string } | null {
  if (view === "year") return null;
  const anchor = parseISO(anchorISO);
  const start = view === "week" ? startOfWeek(anchor, { weekStartsOn: 1 }) : startOfMonth(anchor);
  const end = view === "week" ? endOfWeek(anchor, { weekStartsOn: 1 }) : endOfMonth(anchor);
  return { dateFrom: format(start, "yyyy-MM-dd"), dateTo: format(end, "yyyy-MM-dd") };
}

/** The 7 Mon..Sun days of the week containing `anchor`. */
export function buildWeek(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- views`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/views.ts src/lib/calendar/views.test.ts
git commit -m "feat: getViewRange + buildWeek calendar helpers"
```

---

## Task 3: Refined dark design tokens

**Files:** Modify `src/app/globals.css`

Tune the dark fallback + internal token mappings to the Refined dark palette and add `--text-faint`, `--accent-glow`. Light (Telegram) mappings stay as-is. Final hex values may be nudged during the visual pass.

- [ ] **Step 1: Update `:root[data-theme="dark"]` block** — replace the dark fallback values with:

```css
:root[data-theme="dark"] {
  --tg-bg:           #0c0c0e;
  --tg-secondary-bg: #161618;
  --tg-text:         #f5f5f7;
  --tg-hint:         #8a8a92;
  --tg-link:         #5b7cfa;
  --tg-button:       #5b7cfa;
  --tg-button-text:  #ffffff;
  --tg-accent:       #5b7cfa;
  --tg-section-bg:   #161618;
  --tg-subtitle:     #8a8a92;
  --tg-destructive:  #ff453a;
  --tg-header-bg:    #0c0c0e;
}
```

- [ ] **Step 2: Add internal tokens** — in the `:root { … }` internal-tokens block, add after `--glow-start`:

```css
  --card-strong:  color-mix(in srgb, var(--tg-section-bg) 100%, #ffffff 6%);
  --text-faint:   color-mix(in srgb, var(--tg-subtitle) 60%, transparent);
  --accent-glow:  color-mix(in srgb, var(--tg-button) 35%, transparent);
  --border:       color-mix(in srgb, #ffffff 8%, transparent);
```

(Note: `--card-strong` and `--border` already exist — replace those existing lines rather than duplicating. `--card-strong` currently maps to `--tg-bg`; the new value lifts elevated surfaces slightly above the card.)

- [ ] **Step 3: Expose new tokens to Tailwind** — in `@theme inline { … }` add:

```css
  --color-text-faint:   var(--text-faint);
  --color-accent-glow:  var(--accent-glow);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds (CSS compiles; no class errors).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: Refined dark token palette + faint/glow tokens"
```

---

## Task 4: Shared UI primitives

**Files:** Create `src/components/ui/{surface,section-label,icon-button,segmented}.tsx`

Presentational, token-based, prop-driven. Use `clsx` (already a dependency) for class merging.

- [ ] **Step 1: `surface.tsx`**

```tsx
import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Surface({
  children,
  elevated = false,
  className,
}: {
  children: ReactNode;
  elevated?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border",
        elevated ? "bg-card-strong shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_rgba(0,0,0,0.35)]" : "bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `section-label.tsx`**

```tsx
import { clsx } from "clsx";
import type { ReactNode } from "react";

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("text-[10px] font-semibold uppercase tracking-[0.12em] text-muted", className)}>
      {children}
    </p>
  );
}
```

- [ ] **Step 3: `icon-button.tsx`**

```tsx
import { clsx } from "clsx";
import type { ReactNode } from "react";

export function IconButton({
  children,
  onClick,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground/80",
        "transition active:scale-95 active:bg-card-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: `segmented.tsx`** — generic single-select segmented control:

```tsx
"use client";

import { clsx } from "clsx";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={clsx(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition",
              active
                ? "bg-card-strong text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                : "text-muted active:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui
git commit -m "feat: Refined dark UI primitives (Surface, SectionLabel, IconButton, Segmented)"
```

---

## Task 5: Restyle `EventRow` (category bar + tabular time)

**Files:** Modify `src/components/calendar/event-row.tsx`

- [ ] **Step 1: Rewrite** the component body: left bar uses `categoryColor(event.category)` (solid when `is_fixed`, translucent/outlined when flexible); time uses `tabular-nums`; surface uses tokens.

```tsx
"use client";

import { formatInTimeZone } from "date-fns-tz";

import { categoryEmoji, categoryColor } from "@/lib/events/categories";
import type { EventInstance } from "@/lib/events/types";

export function EventRow({
  event,
  timezone,
  onClick,
}: {
  event: EventInstance;
  timezone: string;
  onClick: () => void;
}) {
  const start = formatInTimeZone(event.starts_at, timezone, "HH:mm");
  const end = formatInTimeZone(event.ends_at, timezone, "HH:mm");
  const color = categoryColor(event.category);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition active:scale-[0.99] active:bg-card-strong"
    >
      <span
        className="h-9 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: event.is_fixed ? color : "transparent", border: event.is_fixed ? undefined : `1.5px solid ${color}` }}
      />
      <span className="text-lg">{categoryEmoji(event.category)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{event.title}</span>
        <span className="block text-xs text-muted">
          <span className="tabular-nums">{start}–{end}</span>
          {event.series_id ? " · 🔁" : ""}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npm run lint`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/event-row.tsx
git commit -m "feat: restyle EventRow with category color bar + tabular time"
```

---

## Task 6: Restyle `MonthGrid` + add `compact` mode

**Files:** Modify `src/components/calendar/month-grid.tsx`

Full mode: today = accent pill, selected = filled pill, weekend/out-of-month = `text-faint`, event marker = dot. `compact` mode (for year mini-months): smaller cells, no event dots, no weekday header, non-interactive day cells; today still marked.

- [ ] **Step 1: Rewrite** `month-grid.tsx` adding an optional `compact` prop and token-based styling:

```tsx
"use client";

import { format, isToday, isWeekend } from "date-fns";
import { clsx } from "clsx";

import { buildMonthGrid } from "@/lib/calendar/grid";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function MonthGrid({
  monthDate,
  selectedDate,
  daysWithEvents,
  onSelect,
  compact = false,
}: {
  monthDate: Date;
  selectedDate?: string;
  daysWithEvents?: Set<string>;
  onSelect?: (dateStr: string) => void;
  compact?: boolean;
}) {
  const grid = buildMonthGrid(monthDate);

  return (
    <div>
      {!compact && (
        <div className="grid grid-cols-7 px-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
              {d}
            </div>
          ))}
        </div>
      )}
      <div className={clsx("grid grid-cols-7", compact ? "gap-y-0.5" : "px-2 pb-2")}>
        {grid.map(({ date, inMonth }) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const selected = !compact && dateStr === selectedDate;
          const today = isToday(date);
          const weekend = isWeekend(date);
          const cell = (
            <span
              className={clsx(
                "flex items-center justify-center rounded-full font-semibold tabular-nums",
                compact ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-sm",
              )}
              style={{
                background: selected ? "var(--color-foreground)" : today ? "var(--color-accent-soft)" : "transparent",
                color: selected
                  ? "var(--color-background)"
                  : today
                    ? "var(--color-accent)"
                    : inMonth
                      ? weekend ? "var(--color-muted)" : "var(--color-foreground)"
                      : "var(--color-text-faint)",
                boxShadow: today && !selected ? "0 0 0 1px var(--color-accent) inset" : undefined,
              }}
            >
              {format(date, "d")}
            </span>
          );
          return compact || !onSelect ? (
            <span key={dateStr} className="flex flex-col items-center py-0.5">{cell}</span>
          ) : (
            <button key={dateStr} onClick={() => onSelect(dateStr)} className="flex flex-col items-center gap-0.5 py-1">
              {cell}
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: daysWithEvents?.has(dateStr) ? (selected ? "var(--color-background)" : "var(--color-muted)") : "transparent" }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npm run lint`. Expected: clean (note: callers still pass the same props; new props are optional).

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/month-grid.tsx
git commit -m "feat: restyle MonthGrid + compact mode for year mini-months"
```

---

## Task 7: Migrate to URL view model + rename/restyle month view

This is the core refactor. `CalendarScreen` becomes the owner of the `selectedDate` anchor and navigation; `DayView` is renamed to `MonthView` and turned presentational; `page.tsx` parses `view`+`date` and fetches by `getViewRange`. After this task: app works on the new URL model with the month view only (week/year not yet reachable), Refined dark.

**Files:**
- Rename: `src/components/calendar/day-view.tsx` → `src/components/calendar/month-view.tsx`
- Modify: `src/components/calendar/calendar-screen.tsx`
- Modify: `src/app/(app)/calendar/page.tsx`

- [ ] **Step 1: `git mv`**

```bash
git mv src/components/calendar/day-view.tsx src/components/calendar/month-view.tsx
```

- [ ] **Step 2: Rewrite `month-view.tsx`** as a presentational month view driven by props (no internal month nav / no router):

```tsx
"use client";

import { useState } from "react";
import { format, parseISO, startOfMonth } from "date-fns";
import { useRouter } from "next/navigation";

import { MonthGrid } from "./month-grid";
import { EventRow } from "./event-row";
import { IconButton } from "@/components/ui/icon-button";
import { addDayNoteAction } from "@/lib/notes/actions";
import type { EventInstance } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function MonthView({
  events,
  dayNotes,
  timezone,
  anchorMonth,           // "yyyy-MM"
  selectedDate,
  daysWithEvents,
  dayEvents,
  onSelectDate,
  onNavigateMonth,
  onEventClick,
}: {
  events: EventInstance[];
  dayNotes: Note[];
  timezone: string;
  anchorMonth: string;
  selectedDate: string;
  daysWithEvents: Set<string>;
  dayEvents: EventInstance[];
  onSelectDate: (dateStr: string) => void;
  onNavigateMonth: (dir: 1 | -1) => void;
  onEventClick: (event: EventInstance) => void;
}) {
  const router = useRouter();
  const monthDate = parseISO(`${anchorMonth}-01`);
  const selectedNote = dayNotes.find((n) => n.date === selectedDate) ?? null;
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function saveDayNote() {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    try {
      await addDayNoteAction(noteDraft, selectedDate);
      setNoteDraft("");
      router.refresh();
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <IconButton onClick={() => onNavigateMonth(-1)} ariaLabel="Предыдущий месяц">‹</IconButton>
        <span className="text-base font-bold text-foreground">
          {MONTH_NAMES[monthDate.getMonth()]} <span className="tabular-nums">{monthDate.getFullYear()}</span>
        </span>
        <IconButton onClick={() => onNavigateMonth(1)} ariaLabel="Следующий месяц">›</IconButton>
      </div>

      <MonthGrid monthDate={monthDate} selectedDate={selectedDate} daysWithEvents={daysWithEvents} onSelect={onSelectDate} />

      <div className="mx-4 my-2 border-t border-border" />

      <div className="px-4 pb-3">
        {selectedNote ? (
          <p className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted">📌 {selectedNote.content}</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveDayNote(); }}
              placeholder="＋ заметка дня"
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground placeholder-muted outline-none"
            />
            {noteDraft.trim() && (
              <button onClick={saveDayNote} disabled={savingNote} className="rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground disabled:opacity-50">ОК</button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4">
        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">Свободный день</p>
            <p className="mt-1 text-xs text-muted">Нажми ➕ чтобы добавить</p>
          </div>
        ) : (
          dayEvents.map((e) => <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />)
        )}
      </div>
    </div>
  );
}

export { startOfMonth }; // (no-op re-export guard removed during cleanup if unused)
```

> Note for implementer: drop the trailing `export { startOfMonth }` line — it's only a reminder that `startOfMonth`/`format` may be unused now; remove unused imports to satisfy lint.

- [ ] **Step 3: Rewrite `calendar-screen.tsx`** to own the anchor + day bucketing and feed `MonthView`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";

import { MonthView } from "./month-view";
import { ScopeDialog } from "./scope-dialog";
import { CaptureSheet } from "@/components/capture/capture-sheet";
import { AdvisorSheet } from "@/components/advisor/advisor-sheet";
import type { CalendarView } from "@/lib/calendar/views";
import type { EventInstance } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";
import type { RecurringEdit } from "@/components/capture/event-form";

export function CalendarScreen({
  view,
  anchor,
  events,
  dayNotes,
  timezone,
  dayStart,
  dayEnd,
}: {
  view: CalendarView;
  anchor: string; // yyyy-MM-dd
  events: EventInstance[];
  dayNotes: Note[];
  timezone: string;
  dayStart: string;
  dayEnd: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(anchor);
  const [editing, setEditing] = useState<EventInstance | null>(null);
  const [recurringEdit, setRecurringEdit] = useState<RecurringEdit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [scopeFor, setScopeFor] = useState<EventInstance | null>(null);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd"));
    return set;
  }, [events, timezone]);

  const dayEvents = useMemo(
    () => events.filter((e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === selectedDate),
    [events, timezone, selectedDate],
  );

  function pushView(nextView: CalendarView, nextDate: string) {
    router.push(`/calendar?view=${nextView}&date=${nextDate}`);
  }

  function navigateMonth(dir: 1 | -1) {
    const base = parseISO(`${anchor.slice(0, 7)}-01`);
    const next = dir === 1 ? addMonths(base, 1) : subMonths(base, 1);
    pushView("month", format(next, "yyyy-MM-01"));
  }

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
    if (instance.series_id) setScopeFor(instance);
    else openEditor(instance, null);
  }
  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
    setRecurringEdit(null);
  }

  return (
    <>
      <MonthView
        events={events}
        dayNotes={dayNotes}
        timezone={timezone}
        anchorMonth={anchor.slice(0, 7)}
        selectedDate={selectedDate}
        daysWithEvents={daysWithEvents}
        dayEvents={dayEvents}
        onSelectDate={setSelectedDate}
        onNavigateMonth={navigateMonth}
        onEventClick={onEventClick}
      />

      <button onClick={() => setAdvisorOpen(true)} className="fixed bottom-44 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-card-strong text-2xl shadow-lg" aria-label="Найти время">✨</button>
      <button onClick={() => { setEditing(null); setRecurringEdit(null); setSheetOpen(true); }} className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground shadow-lg" aria-label="Добавить">+</button>

      {sheetOpen && (
        <CaptureSheet timezone={timezone} defaultDate={selectedDate || todayStr} editing={editing} recurringEdit={recurringEdit} onClose={closeSheet} />
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

> `view` and `pushView` are unused until Task 10 wires the switcher — add a `// eslint-disable-next-line @typescript-eslint/no-unused-vars` only if lint fails; otherwise reference `view` in Task 10. To keep lint green now, temporarily render nothing based on `view` but keep the param (see Step 5).

- [ ] **Step 4: Rewrite `page.tsx`** to parse `view`+`date` and fetch by range:

```tsx
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getEventsInRange } from "@/lib/events/queries";
import { getDayNotes } from "@/lib/notes/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { getUiPreferences } from "@/lib/preferences";
import { getViewRange, isCalendarView, type CalendarView } from "@/lib/calendar/views";
import { readSearchParam } from "@/lib/utils";
import { formatInTimeZone } from "date-fns-tz";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent text-xl font-bold text-accent-foreground">w</span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const viewParam = readSearchParam(params.view);
  const view: CalendarView = isCalendarView(viewParam) ? viewParam : "month";

  // anchor: ?date=YYYY-MM-DD, legacy ?month=YYYY-MM → first of month, else today.
  const dateParam = readSearchParam(params.date);
  const monthParam = readSearchParam(params.month);
  const anchor =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? `${monthParam}-01`
        : formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");

  const range = getViewRange(view, anchor);
  const [events, dayNotes] = await Promise.all([
    range
      ? getEventsInRange(user.id, ...rangeToUtc(range, user.timezone))
      : Promise.resolve([]),
    view === "year" ? Promise.resolve([]) : getDayNotes(user.id),
  ]);

  return (
    <CalendarScreen
      view={view}
      anchor={anchor}
      events={events}
      dayNotes={dayNotes}
      timezone={user.timezone}
      dayStart={user.day_start || "08:00"}
      dayEnd={user.day_end || "22:00"}
    />
  );
}

function rangeToUtc(range: { dateFrom: string; dateTo: string }, tz: string): [Date, Date] {
  const { start, end } = getDateRangeUtc(range.dateFrom, range.dateTo, tz);
  return [start, end];
}
```

> Confirm `getEventsInRange(userId, start, end, tz)` accepts `Date` for start/end (it did in the original page). If it expects strings, pass `start.toISOString()`.

- [ ] **Step 5: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean. If `view`/`pushView` are flagged unused, leave a short comment referencing Task 10, or render `{view !== "month" && null}` placeholder. Do NOT add week/year rendering yet.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: URL view model (?view&date); rename DayView→MonthView; restyle month"
```

---

## Task 8: `WeekView` component (7-day agenda)

**Files:** Create `src/components/calendar/week-view.tsx`

Renders the 7 Mon–Sun days (`buildWeek`) as sections; each lists its `EventRow`s or "Свободно". Today's section is highlighted. Header shows the week range with ‹ › nav.

- [ ] **Step 1: Create** `week-view.tsx`:

```tsx
"use client";

import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { EventRow } from "./event-row";
import { IconButton } from "@/components/ui/icon-button";
import { buildWeek } from "@/lib/calendar/views";
import type { EventInstance } from "@/lib/events/types";

const WEEKDAY_FULL = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_GEN = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function WeekView({
  anchor,            // yyyy-MM-dd
  events,
  timezone,
  todayStr,
  onNavigateWeek,
  onEventClick,
}: {
  anchor: string;
  events: EventInstance[];
  timezone: string;
  todayStr: string;
  onNavigateWeek: (dir: 1 | -1) => void;
  onEventClick: (event: EventInstance) => void;
}) {
  const days = buildWeek(new Date(`${anchor}T00:00:00`));
  const first = days[0];
  const last = days[6];
  const rangeLabel = `${first.getDate()} ${MONTH_GEN[first.getMonth()]} – ${last.getDate()} ${MONTH_GEN[last.getMonth()]}`;

  const byDay = new Map<string, EventInstance[]>();
  for (const e of events) {
    const key = formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd");
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(e);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <IconButton onClick={() => onNavigateWeek(-1)} ariaLabel="Предыдущая неделя">‹</IconButton>
        <span className="text-base font-bold text-foreground tabular-nums">{rangeLabel}</span>
        <IconButton onClick={() => onNavigateWeek(1)} ariaLabel="Следующая неделя">›</IconButton>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayStr;
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className={isToday ? "text-sm font-bold text-accent" : "text-sm font-bold text-foreground"}>
                  {WEEKDAY_FULL[day.getDay()]} <span className="tabular-nums">{day.getDate()}</span>
                </span>
                {isToday && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">сегодня</span>}
              </div>
              {dayEvents.length === 0 ? (
                <p className="pl-1 text-xs text-text-faint">Свободно</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dayEvents.map((e) => <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

> The `byDay` one-liner is dense; the implementer may expand it to a clear `if (!byDay.has(key)) byDay.set(key, [])` form.

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npm run lint`. Expected: clean (component unused for now).

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/week-view.tsx
git commit -m "feat: WeekView 7-day agenda"
```

---

## Task 9: `YearView` component (12 mini-months)

**Files:** Create `src/components/calendar/year-view.tsx`

3-column grid of 12 `MonthGrid` (compact). Tap a month → `onSelectMonth("yyyy-MM")`. Current month gets an accent ring. Header shows the year with ‹ › nav.

- [ ] **Step 1: Create** `year-view.tsx`:

```tsx
"use client";

import { clsx } from "clsx";

import { MonthGrid } from "./month-grid";
import { IconButton } from "@/components/ui/icon-button";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function YearView({
  year,
  currentMonth,       // "yyyy-MM" of today
  onSelectMonth,
  onNavigateYear,
}: {
  year: number;
  currentMonth: string;
  onSelectMonth: (monthStr: string) => void;
  onNavigateYear: (dir: 1 | -1) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <IconButton onClick={() => onNavigateYear(-1)} ariaLabel="Предыдущий год">‹</IconButton>
        <span className="text-base font-bold text-foreground tabular-nums">{year}</span>
        <IconButton onClick={() => onNavigateYear(1)} ariaLabel="Следующий год">›</IconButton>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 pb-4">
        {MONTH_NAMES.map((name, i) => {
          const monthStr = `${year}-${String(i + 1).padStart(2, "0")}`;
          const isCurrent = monthStr === currentMonth;
          return (
            <button
              key={monthStr}
              onClick={() => onSelectMonth(monthStr)}
              className={clsx(
                "rounded-2xl border bg-card p-2 text-left transition active:scale-[0.98]",
                isCurrent ? "border-accent" : "border-border",
              )}
            >
              <p className={clsx("mb-1 px-1 text-xs font-semibold", isCurrent ? "text-accent" : "text-foreground")}>{name}</p>
              <MonthGrid monthDate={new Date(year, i, 1)} compact />
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npm run lint`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/year-view.tsx
git commit -m "feat: YearView 12 mini-months navigation grid"
```

---

## Task 10: `ViewSwitcher` + wire all three views into `CalendarScreen`

**Files:**
- Create: `src/components/calendar/view-switcher.tsx`
- Modify: `src/components/calendar/calendar-screen.tsx`

- [ ] **Step 1: Create** `view-switcher.tsx`:

```tsx
"use client";

import { Segmented } from "@/components/ui/segmented";
import type { CalendarView } from "@/lib/calendar/views";

const OPTIONS = [
  { value: "month" as const, label: "Месяц" },
  { value: "week" as const, label: "Неделя" },
  { value: "year" as const, label: "Год" },
];

export function ViewSwitcher({ value, onChange }: { value: CalendarView; onChange: (v: CalendarView) => void }) {
  return (
    <div className="flex justify-center px-4 pt-4">
      <Segmented options={OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}
```

- [ ] **Step 2: Wire into `calendar-screen.tsx`** — add imports, navigation handlers, render switcher + active view. Add:

```tsx
import { addWeeks, addYears, subWeeks, subYears } from "date-fns";
import { WeekView } from "./week-view";
import { YearView } from "./year-view";
import { ViewSwitcher } from "./view-switcher";
```

Add handlers inside the component:

```tsx
function switchView(next: CalendarView) {
  pushView(next, selectedDate);
}
function navigateWeek(dir: 1 | -1) {
  const base = parseISO(anchor);
  const next = dir === 1 ? addWeeks(base, 1) : subWeeks(base, 1);
  pushView("week", format(next, "yyyy-MM-dd"));
}
function navigateYear(dir: 1 | -1) {
  const base = parseISO(anchor);
  const next = dir === 1 ? addYears(base, 1) : subYears(base, 1);
  pushView("year", format(next, "yyyy-MM-dd"));
}
function selectMonth(monthStr: string) {
  pushView("month", `${monthStr}-01`);
}
const currentMonthStr = formatInTimeZone(new Date(), timezone, "yyyy-MM");
```

Replace the `<MonthView … />` render with:

```tsx
<ViewSwitcher value={view} onChange={switchView} />

{view === "month" && (
  <MonthView
    events={events}
    dayNotes={dayNotes}
    timezone={timezone}
    anchorMonth={anchor.slice(0, 7)}
    selectedDate={selectedDate}
    daysWithEvents={daysWithEvents}
    dayEvents={dayEvents}
    onSelectDate={setSelectedDate}
    onNavigateMonth={navigateMonth}
    onEventClick={onEventClick}
  />
)}
{view === "week" && (
  <WeekView
    anchor={anchor}
    events={events}
    timezone={timezone}
    todayStr={todayStr}
    onNavigateWeek={navigateWeek}
    onEventClick={onEventClick}
  />
)}
{view === "year" && (
  <YearView
    year={Number(anchor.slice(0, 4))}
    currentMonth={currentMonthStr}
    onSelectMonth={selectMonth}
    onNavigateYear={navigateYear}
  />
)}
```

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean; `view`/`pushView` now used.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar
git commit -m "feat: view switcher wiring month/week/year"
```

---

## Task 11: Restyle bottom nav + layout background

**Files:**
- Modify: `src/components/bottom-nav.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: `layout.tsx`** — replace `bg-[#0f0f0f]` with the token and keep padding:

```tsx
<div className="min-h-screen bg-background pb-20 text-foreground">
```

- [ ] **Step 2: `bottom-nav.tsx`** — token surfaces + active accent. Replace the `<nav>` styling and active color logic:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const TABS = [
  { href: "/calendar", emoji: "📅", label: "Календарь" },
  { href: "/friends", emoji: "👥", label: "Друзья" },
  { href: "/notes", emoji: "📝", label: "Заметки" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/90 px-6 py-2 backdrop-blur">
      {TABS.map(({ href, emoji, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx("flex flex-col items-center gap-0.5 text-[10px] transition", active ? "text-foreground" : "text-muted")}
          >
            <span className="text-lg">{emoji}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/bottom-nav.tsx "src/app/(app)/layout.tsx"
git commit -m "feat: restyle bottom nav + layout to tokens"
```

---

## Task 12: Visual polish + full verification

**Files:** any calendar/ui files, as needed for polish.

- [ ] **Step 1: Run the full unit suite** — `npm test`. Expected: all pass (categories, views, grid, plus existing).
- [ ] **Step 2: i18n + lint + build** — `npm run check:i18n && npm run lint && npm run build`. Expected: all clean.
- [ ] **Step 3: Visual pass via frontend-design** — invoke the **frontend-design** skill; run the app (run/verify skills) and screenshot each view (month/week/year, today highlighting, switching, an event-dense day, an empty day). Tune token hex, spacing, and category colors against the Refined dark target. Confirm Telegram dark theme renders correctly.
- [ ] **Step 4: Manual acceptance checklist:**
  - Switch month↔week↔year preserves the anchor (week shows the selected day's week; year shows the anchor's year).
  - Tapping a month in year view opens that month.
  - Prev/next works in all three views; events load for the correct range; year loads no events.
  - Legacy `/calendar?month=YYYY-MM` still lands on that month.
  - Adding/editing events and day notes still works from month view.
- [ ] **Step 5: Final commit (if polish changes were made)**

```bash
git add -A
git commit -m "polish: Refined dark calendar visual pass"
```

---

## Self-review notes
- **Spec coverage:** views (T7–T10), switcher (T10), URL model (T7), tokens (T3), primitives (T4), category colors (T1), week=agenda events-only (T8), year=nav no-fetch (T9, page T7), rename (T7), bottom nav (T11), helpers+tests (T1–T2), visual validation (T12). All covered.
- **Type consistency:** `CalendarView` from `views.ts` used in page + screen + switcher; `MonthView`/`WeekView`/`YearView` prop names match their call sites in T10; `getViewRange`→`rangeToUtc`→`getEventsInRange` chain typed in T7.
- **Deferred:** view-transition animations (separate backlog item); friends/notes/capture/advisor full restyle.
