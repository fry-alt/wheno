# Smart Calendar — Recurring Events

**Date:** 2026-06-02
**Status:** Design approved, ready for implementation plan
**Builds on:** Layers 1 (calendar + notes) and 2 (AI advisor), both shipped.

---

## Overview

Add repeating events — daily, weekly (by weekday), monthly, yearly — so users can model things like "work every day 09:00–18:00" or "birthday every year". A single DB row stores the recurrence rule; instances are expanded on read for whatever date range the calendar (or advisor) needs. Editing/deleting offers "only this occurrence" or "the whole series". Recurrence can be set in the manual form and parsed from natural language (app + bot).

**Stack (unchanged):** Next.js 15 App Router · React 19 · TypeScript · Supabase · OpenAI (`gpt-4o-mini`) · date-fns/date-fns-tz · Tailwind v4 · Vitest.

---

## Goals

1. Create repeating events (daily / weekly-by-weekday / monthly / yearly) with an end of forever, until-a-date, or after N occurrences.
2. Store one row per series; never materialize thousands of rows.
3. Show every occurrence on the calendar within the viewed range; the advisor treats occurrences as busy automatically.
4. Edit/delete either a single occurrence or the whole series.
5. Set recurrence from the manual form and from natural language (text/voice, app and bot).

---

## Data Model

Two nullable columns added to `events` (one-off events keep both `null` and behave exactly as today):

```sql
alter table public.events
  add column if not exists recurrence     jsonb,
  add column if not exists excluded_dates jsonb not null default '[]'::jsonb;
```

**`recurrence`** (`null` = one-off). When set:
```jsonc
{
  "freq": "daily" | "weekly" | "monthly" | "yearly",
  "weekdays": [1, 3, 5] | null,   // weekly only: 1=Mon … 7=Sun
  "until": "2026-12-31" | null,   // last allowed occurrence date (local)
  "count": 10 | null              // max occurrences; both null = forever
}
```

**`excluded_dates`** — JSON array of `yyyy-MM-dd` strings the series skips (set when an occurrence is deleted or overridden). Defaults to `[]`.

**Anchor:** `starts_at`/`ends_at` define the first occurrence's date and the local time-of-day + duration. Expansion applies that time-of-day to every generated occurrence date. `weekly` with `weekdays` may produce its first instance on/after the anchor date among the selected weekdays.

**Interval is fixed at 1** (every day / every week / every month / every year). "Every N" is out of scope (YAGNI).

---

## Types

```ts
// src/lib/events/types.ts (additions)
export interface Recurrence {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  weekdays: number[] | null; // 1..7 (Mon..Sun), weekly only
  until: string | null;      // yyyy-MM-dd
  count: number | null;
}

// CalendarEvent gains:
//   recurrence: Recurrence | null;
//   excluded_dates: string[];

export interface EventInstance extends CalendarEvent {
  series_id: string | null;       // parent series id; null for one-off rows
  occurrence_date: string | null; // yyyy-MM-dd of this instance (recurring only)
}
```

A one-off event expands to a single `EventInstance` with `series_id = null`, `occurrence_date = null`. A recurring row expands to one `EventInstance` per occurrence, each carrying `series_id = <row id>` and its `occurrence_date`. React key for instances: `series_id ? \`${series_id}:${occurrence_date}\` : id`.

---

## Expansion (`src/lib/events/recurrence.ts` — pure core)

`expandEvents(rows: CalendarEvent[], rangeStart: Date, rangeEnd: Date, timezone: string): EventInstance[]`

For each row:
- **One-off** (`recurrence === null`): include as a single instance if `starts_at` is within `[rangeStart, rangeEnd)`.
- **Recurring**: derive the anchor local date and local `HH:mm` start/end from `starts_at`/`ends_at` via `formatInTimeZone`. Walk occurrence dates from the anchor forward:
  - `daily`: every date.
  - `weekly`: dates whose weekday (Mon=1..Sun=7) is in `weekdays` (default: the anchor's weekday if `weekdays` is null).
  - `monthly`: same day-of-month as the anchor (skip months without that day, e.g. no 31st).
  - `yearly`: same month+day as the anchor (Feb 29 → skip non-leap years).
  - Stop when the date exceeds `min(rangeEnd, until)` or when `count` occurrences have been emitted (count is measured from the anchor, not from the range).
  - Skip dates in `excluded_dates`.
  - For each kept date in `[rangeStart, rangeEnd)`: build an instance with `starts_at`/`ends_at` recomputed via `toUtcDateFromLocalParts(date, HH:mm, timezone)`.

To bound work for "forever" series, iterate occurrence dates but never beyond `rangeEnd` (and a hard safety cap, e.g. 1000 iterations).

This function is deterministic and unit-tested.

---

## Query changes (`src/lib/events/queries.ts`)

`getEventsInRange(userId, startAt, endAt)` now returns `EventInstance[]`:
1. Fetch one-off rows with `starts_at` in `[startAt, endAt)` (the current query, plus `recurrence is null`).
2. Fetch all recurring rows for the user (`recurrence is not null`) — these are few; no range filter (a yearly birthday's anchor may be years in the past).
3. `expandEvents([...oneOffs, ...recurring], startAt, endAt, timezone)` → instances in range, sorted by `starts_at`.

`getEventsInRange` gains a `timezone` parameter (callers: calendar page, advisor route — both already have `user.timezone`).

New series helpers:
- `getEventById(userId, id)` — fetch a single row (for series edit/override).
- `addExcludedDate(userId, seriesId, date)` — append to `excluded_dates`.
- `updateSeries(userId, seriesId, patch)` — update a recurring row (incl. `recurrence`).
- `deleteEventById` (exists) — used for whole-series delete.
- `insertEvent` (exists) — used for one-off overrides.

---

## Edit/Delete scope

Tapping a **one-off** instance → the existing edit form (no scope dialog).

Tapping a **recurring** instance → a small scope dialog ("Только это" / "Вся серия") gates the action:

- **Delete · only this** → `deleteOccurrenceAction(seriesId, occurrence_date)` → `addExcludedDate`.
- **Delete · whole series** → `deleteSeriesAction(seriesId)` → `deleteEventById`.
- **Edit · only this** → `editOccurrenceAction(seriesId, occurrence_date, input)` → `addExcludedDate` + `insertEvent` (a non-recurring override on that date).
- **Edit · whole series** → `updateSeriesAction(seriesId, input)` → `updateSeries` (title/category/time-of-day/recurrence). Editing the time updates all future occurrences (anchor time-of-day changes).

Server actions live in `src/lib/events/actions.ts`; all use `requireCurrentUser` and `revalidatePath("/calendar")`.

---

## Input

### Manual form (`event-form.tsx`)

Add a "Повторять" control:
- Selector: Нет / Каждый день / По дням недели / Каждый месяц / Каждый год.
- When "По дням недели": weekday chips `Пн Вт Ср Чт Пт Сб Вс` (multi-select, 1..7).
- When any recurrence: optional end — "до даты" (`<input type="date">`) or "N раз" (`<input type="number">`). Empty = forever.
- "Нет" → `recurrence = null` (one-off, unchanged behavior).

When editing a series ("whole series" path), the form is prefilled from the row's recurrence.

### Natural language (`parse.ts` + bot)

`ParsedEvent` gains `recurrence: Recurrence | null`. The parse tool schema gets recurrence fields; the system prompt instructs the model:
- "работа каждый день с 9 до 18" → `{ freq: "daily" }`
- "зал по пн ср пт" → `{ freq: "weekly", weekdays: [1,3,5] }`
- "др Ани 15 марта" → `{ freq: "yearly" }`
- no repetition mentioned → `recurrence: null`

The confirm card shows "🔁 повторяется ежедневно / по будням / каждый год" when recurrence is present. Accepting creates a recurring row. The bot path reuses the same parser; a recurring event created from the bot shows the recurrence line in its card.

---

## UI markers

- `event-row.tsx`: a 🔁 glyph next to the time range when the instance belongs to a series (`series_id !== null`).
- `scope-dialog.tsx` (new): a compact bottom dialog with "Только это" / "Вся серия" / "Отмена", used before edit and before delete of a recurring instance.

---

## Files

### Create
| File | Responsibility |
|---|---|
| `src/lib/events/recurrence.ts` | `expandEvents` + occurrence-date generation |
| `src/lib/events/recurrence.test.ts` | unit tests for expansion |
| `src/components/calendar/scope-dialog.tsx` | "only this / whole series" chooser |

### Modify
| File | Change |
|---|---|
| `supabase/schema.sql` | `events` += `recurrence`, `excluded_dates` (+ manual `ALTER`) |
| `src/lib/events/types.ts` | `Recurrence`, `EventInstance`; `CalendarEvent` += `recurrence`, `excluded_dates` |
| `src/lib/events/queries.ts` | `getEventsInRange` → expand instances (+ `timezone` param); `getEventById`, `addExcludedDate`, `updateSeries` |
| `src/lib/events/actions.ts` | `deleteOccurrenceAction`, `deleteSeriesAction`, `updateSeriesAction`, `editOccurrenceAction`; create handles `recurrence` |
| `src/lib/events/parse.ts` | `ParsedEvent` += `recurrence`; tool schema + prompt |
| `src/components/capture/event-form.tsx` | "Повторять" selector + weekdays + end condition |
| `src/components/capture/confirm-card.tsx` | show recurrence line |
| `src/components/calendar/day-view.tsx` | scope dialog wiring for recurring instances |
| `src/components/calendar/event-row.tsx` | 🔁 marker |
| `src/components/calendar/calendar-screen.tsx` | thread instance type / edit handlers |
| `src/app/(app)/calendar/page.tsx` | pass `timezone` to `getEventsInRange` |
| `src/app/api/find-slots/route.ts` | pass `timezone` to `getEventsInRange` |
| `src/lib/bot/handler.ts` | recurrence flows through `createParsedEvent`-style insert |

### Reuse (unchanged)
`toUtcDateFromLocalParts`, `getDateRangeUtc`, `insertEvent`, `categoryEmoji`, the Layer 2 advisor (works unchanged because `getEventsInRange` now yields expanded instances).

---

## Error Handling

- Invalid recurrence (e.g. weekly with empty weekdays) → treat as the anchor's weekday; never produce zero-weekday infinite loops.
- `count`/`until` both present → stop at whichever comes first.
- Expansion is capped (≤ 1000 iterations per series) to bound "forever" series.
- Override insert failure or exclude failure → inline error; nothing closes until success.
- Editing a series' time keeps the anchor date; only the time-of-day changes.

---

## Testing

- `recurrence.test.ts` (core): daily within a week; weekly on specific weekdays; monthly same day-of-month (and a month that lacks the day → skipped); yearly birthday (and Feb-29 skip); `until` boundary (inclusive); `count` limit measured from anchor; `excluded_dates` skipped; one-off passthrough; timezone correctness via `Europe/Moscow` (local `09:00` → `06:00:00.000Z`); a "forever" daily series bounded by the query range.
- `parse.test.ts`: extend with recurrence cases (daily, weekly weekdays, yearly, none) using the mocked OpenAI client.
- UI, actions, queries (DB) verified via `npx tsc --noEmit` and `npx next build`.

---

## Out of Scope

- "Every N" intervals (every 2 weeks, etc.).
- "This and future occurrences" edit scope (only "this" / "whole series").
- Per-occurrence time shifts beyond the override mechanism (override is a plain one-off event).
- Reminders for recurrences.
- Nth-weekday-of-month ("third Tuesday").
