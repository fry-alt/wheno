# Smart Calendar — Layer 2: AI Schedule Advisor

**Date:** 2026-06-02
**Status:** Design approved, ready for implementation plan
**Builds on:** Layer 1 (personal calendar + notes), already shipped.

---

## Overview

The AI advisor lets the user ask, in natural language, to fit flexible activities into the gaps between their existing events. The user types a request like «зал 3 раза на этой неделе по утрам, час»; the AI interprets it into a structured request; a deterministic algorithm finds free windows respecting the user's waking hours and proposes a distributed plan of slots; the user accepts (optionally deselecting some) and all chosen events are created.

**Character (from Layer 1):** advisor — the user asks, the AI proposes, the user always decides. Layer 2 never auto-schedules and never moves existing events.

**Scope:** Mini App only. No bot changes. No rescheduling of existing events.

**Stack (unchanged):** Next.js 15 App Router · React 19 · TypeScript · Supabase · OpenAI (`gpt-4o-mini`) · date-fns/date-fns-tz · Tailwind v4 · Vitest.

---

## Goals

1. From one natural-language request, propose a concrete plan of 2-3+ slots placed in real free time.
2. Never propose a slot that overlaps an existing event; never propose outside waking hours.
3. Distribute multiple occurrences across the requested window (not bunched on one day).
4. Let the user deselect individual slots and accept the rest in one tap.

---

## Architecture & Data Flow

```
User text: «зал 3 раза на этой неделе по утрам, час»
        ↓
parseRequest(text, {today, timezone})        — AI (OpenAI), interprets text only
        ↓  SlotRequest { title, category, count, duration_min, window, part_of_day }
        ↓
findSlots(request, busyEvents, dayHours, tz)  — pure function, no AI
        ↓  ProposedSlot[]  (≤ count, distributed)
        ↓
Advisor sheet shows slot cards (each toggleable)
        ↓
createPlanAction(selectedSlots)               — batch insert via insertEvent
        ↓  events appear on the calendar
```

Two cleanly separated modules:
- **`parseRequest`** — AI does *understanding only*. It never picks times. Output is a structured `SlotRequest`.
- **`findSlots`** — deterministic, no AI. Guarantees it never returns an occupied slot. Fully unit-testable.

---

## Module: `parseRequest` (AI)

`parseRequest(text: string, ctx: { today: string; timezone: string }): Promise<SlotRequest>`

OpenAI `gpt-4o-mini` with a single forced tool call (same pattern as Layer 1's `parseEvent`). System prompt receives `today` and `timezone`. The model resolves relative dates and fuzzy terms:

- «на этой неделе» → `window` = Monday–Sunday of the current week (date strings).
- «по утрам» → `part_of_day: "morning"`.
- «час» → `duration_min: 60`. Default 60 if unspecified.
- «3 раза» → `count: 3`. Default 1 if unspecified.
- title/category resolved like Layer 1 (categories list passed in; fallback `other`).

`SlotRequest`:
```ts
interface SlotRequest {
  title: string;
  category: Category;          // reuse Layer 1 Category
  count: number;               // ≥ 1
  duration_min: number;        // > 0
  window: { from: string; to: string }; // yyyy-MM-dd inclusive
  part_of_day: "morning" | "afternoon" | "evening" | "any";
}
```

Validation after parse: clamp `count` to [1, 14], `duration_min` to [15, 600]; if `window` missing/invalid, default to the next 7 days from `today`.

---

## Module: `findSlots` (pure algorithm — the core)

`findSlots(request: SlotRequest, busyEvents: CalendarEvent[], dayHours: { start: string; end: string }, timezone: string): ProposedSlot[]`

`ProposedSlot`:
```ts
interface ProposedSlot {
  date: string;       // yyyy-MM-dd (local)
  starts_at: string;  // ISO UTC
  ends_at: string;    // ISO UTC
}
```

Algorithm:

1. **Part-of-day window** (minutes-of-day), bounded by `dayHours`:
   - `morning` = `[dayStart, min(12:00, dayEnd))`
   - `afternoon` = `[max(12:00, dayStart), min(18:00, dayEnd))`
   - `evening` = `[max(18:00, dayStart), dayEnd)`
   - `any` = `[dayStart, dayEnd)`
   (All clamped to `dayHours`; if the resulting window is shorter than `duration_min`, that part-of-day yields no slot.)

2. **Per day** in `[window.from, window.to]`:
   - Collect that day's busy intervals: for each event, convert `starts_at`/`ends_at` to local minutes via `formatInTimeZone` on that date; keep intervals that fall on the date.
   - Find the **earliest** free sub-interval of length `duration_min` inside the part-of-day window that doesn't overlap any busy interval. Scan candidate starts on a 15-minute grid from the window start.
   - If found → candidate `{ date, startMin }`.

3. **Distribute**: from the list of candidate days (in date order), choose `count`:
   - If `count <= 1` → take the first candidate (single occurrence).
   - Else if `candidates.length <= count` → take all.
   - Else pick evenly spaced indices: `index_i = round(i * (n - 1) / (count - 1))` for `i` in `0..count-1`, dedup. This spreads sessions across the window rather than bunching early. (`count - 1` is never zero here because `count >= 2`.)

4. **Convert** each chosen `{ date, startMin }` to ISO via `toUtcDateFromLocalParts(date, "HH:mm", timezone)` for start and start+duration for end.

Returns up to `count` slots in date order. If fewer than `count`, the caller surfaces a "found only N of M" note.

**Design choice:** all existing events (fixed *and* flexible) are treated as busy. Layer 2 fills gaps; it does not move anything. (Rescheduling flexible events is explicitly out of scope.)

---

## Preferences: waking hours

Minimal — two per-user values:

- Add columns to `users`: `day_start time not null default '08:00'`, `day_end time not null default '22:00'`.
- `AppUser` type extended with `day_start: string`, `day_end: string` (`"HH:mm"` — Supabase returns `time` as a string; normalize to `HH:mm` by slicing if needed).
- Edited inline in the advisor sheet via a compact "Активен 08:00–22:00 ✎" control (two `<input type="time">`), persisted by `updateDayHoursAction`. No separate settings screen.

No energy/dress/break preferences — out of scope (YAGNI).

---

## UI

**Entry point:** a second floating button **✨** stacked above the existing `+` FAB on the calendar screen.

**Advisor sheet** (bottom sheet, dark, same visual language as the capture sheet):

```
Найти время                        [✕]
┌─────────────────────────────────────┐
│ зал 3 раза на неделе утром…         │   ← text input
└─────────────────────────────────────┘
Активен [08:00]–[22:00]                  ← two time inputs, saved on change
[            Найти            ]
─── План (after search) ───
☑ 🏋️ Зал · Пн 3 июня · 18:00–19:00
☑ 🏋️ Зал · Ср 5 июня · 18:00–19:00
☑ 🏋️ Зал · Пт 7 июня · 18:00–19:00
[      Добавить план (3)      ]
```

- Text input only (no voice in v1 — voice already exists for plain capture; YAGNI here).
- "Найти" → `POST /api/find-slots` → returns `{ slots, request }`.
- Each result is a card with a checkbox (default checked). The accept button label reflects the selected count.
- "Добавить план (N)" → `createPlanAction(selectedSlots, title, category)` → `revalidatePath("/calendar")` → close sheet.
- Fewer than requested: show "⚠️ нашёл только N из M".
- Empty result: "Свободных окон не нашёл — попробуй другой день или часы."
- Parse/most failures: inline error, sheet stays open.

---

## Files

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
| `src/lib/users.ts` | include new columns (select `*` already covers; ensure type) |
| `src/components/calendar/calendar-screen.tsx` | ✨ button + render advisor sheet |

### Reuse (unchanged)
`toUtcDateFromLocalParts`, `getEventsInRange`, `insertEvent`, `getCurrentUser`, `requireCurrentUser`, the Layer 1 `Category`/`categoryEmoji`, the `parseEvent` tool-call pattern.

---

## Data fetching for `/api/find-slots`

1. Auth-guard (`getCurrentUser`; 401 if none).
2. `parseRequest(text, { today, timezone })`.
3. Fetch existing events overlapping `request.window` via `getEventsInRange(user.id, startUtc, endUtc)` where the range is the window expanded to UTC via `getDateRangeUtc`.
4. `findSlots(request, events, { start: user.day_start, end: user.day_end }, user.timezone)`.
5. Return `{ slots, request: { title, category } }` (client needs title/category to create events and to render cards).
6. 422 on parse failure; `{ slots: [] }` with a note when nothing fits.

---

## Error Handling

- Parse failure → 422; sheet shows "Не понял запрос, попробуй иначе."
- No slots found → empty list + friendly note; sheet stays open.
- `createPlanAction` failure → inline error; nothing closes until success.
- Invalid day hours (start ≥ end) → `updateDayHoursAction` rejects; inline hint.
- All event creation goes through the owner-scoped `insertEvent`; `createPlanAction` uses `requireCurrentUser`.

---

## Testing

- `find-slots.test.ts` (the core): even distribution across a week; skipping fully-busy days; respecting part-of-day window; respecting `dayHours` bounds; "found fewer than requested"; no overlap with busy intervals; duration that doesn't fit a narrow window yields no slot.
- `parse-request.test.ts` (mocked OpenAI): a fixture request → asserts `count`, `duration_min`, `part_of_day`, and `window`; unknown category → `other`; throws on no tool call.
- UI, actions, and the route are verified via `npx tsc --noEmit` and `npx next build` (DB/network-dependent — not unit tested).

---

## Out of Scope (Layer 2)

- Rescheduling or moving existing (flexible) events.
- Voice input in the advisor (text only).
- Rich preferences (energy, dress, buffers between events).
- Recurring-event entities (the plan creates N independent one-off events).
- Bot access to the advisor.
- Conflict/energy warnings.
