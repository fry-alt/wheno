# Calendar view switching (month / week / year) — design

**Date:** 2026-06-11
**Status:** approved (brainstorm)
**Feature:** Add week and year views to the calendar, a view switcher, and a "Refined dark" visual upgrade that establishes a production-grade design language.

## Goal

Today the calendar has exactly one view: a month grid (mini-calendar date-picker) plus an agenda of the selected day, in `day-view.tsx`. The user wants:

1. **View switching** — month ↔ week ↔ year.
2. **Production-grade visual quality** — the current UI hardcodes ad-hoc dark hex (`#0f0f0f`, `#1a1a1a`, `#555`…) and reads like an "AI prototype". Elevate it to a cohesive, premium look ("Refined dark").

Both are delivered together: the new views are built on a real design-token foundation and shared UI primitives, so the result looks like a real product, not a flat prototype.

## Scope

In scope:
- Three views: **month**, **week**, **year**, plus a **segmented view switcher**.
- A **design-token foundation** (extend `globals.css`) and a small set of **shared UI primitives** (`src/components/ui/`).
- Restyle the **bottom navigation** to the new language (chosen scope: "calendar + shared tokens/primitives + bottom nav").

Explicitly out of scope (deferred):
- Full restyle of friends / notes / capture / advisor screens. They keep their current hardcoded styles for now; they sit on the same shared layout/tokens and will be converged later. A minor visual mismatch between the polished calendar and those screens is accepted.
- **View-transition animations** (sliding between month/week/year, list reveals) — that is a separate backlog item ("Animations"). Tasteful **tap/active states** and a single CSS transition on the segmented thumb are allowed; no broader motion system here.
- Year view does **not** show event-density dots (decided: navigation only).
- Week view is **read-only** (events only, no day-note editing, no add-from-week).

## Decisions (locked during brainstorm)

| Question | Decision |
|---|---|
| Week view layout | Vertical 7-day **agenda list** (each day = section with its events; "Свободно" if empty). Reuses `EventRow`. |
| Year view layout | **12 mini-months** navigation grid (3×4). Tap a month → month view. No event loading. |
| View switcher | **Segmented control** `[Месяц · Неделя · Год]` at the top. |
| State / URL | **URL-driven**: `?view=` + `?date=` anchor. |
| Week view extras | **Events only** (no note icons). |
| `day-view.tsx` | **Rename → `month-view.tsx`** (current name is misleading; it is the month view). |
| Visual language | **Refined dark** (premium utility — layered charcoal surfaces, hairline borders, one vibrant accent, tabular numerals, today pill, category color bars). |
| Visual scope | Calendar + shared tokens/primitives + bottom nav. |

## Architecture — state & data flow

URL-driven, extending the existing `?month=` model.

URL params:
- `view` = `month` | `week` | `year` (default `month`; invalid → `month`).
- `date` = `YYYY-MM-DD` anchor (default: today in the user's timezone; invalid → today). Legacy `?month=YYYY-MM` is still accepted and treated as `date=YYYY-MM-01`, `view=month`.

Server (`src/app/(app)/calendar/page.tsx`):

```
URL ?view&date  →  page.tsx (server, force-dynamic)
   ├─ parse view (enum) + anchor (YYYY-MM-DD, tz-aware default; legacy month= fallback)
   ├─ range = getViewRange(view, anchor, tz)        // {startUtc,endUtc} | null
   ├─ events   = range ? getEventsInRange(user.id, start, end, tz) : []   // year → skip query
   ├─ dayNotes = view === "year" ? [] : getDayNotes(user.id)              // year needs none
   └─ → CalendarScreen({ view, anchor, events, dayNotes, timezone, dayStart, dayEnd })
```

`getViewRange(view, anchorISO, tz)`:
- `month` → start/end of anchor's month (as today).
- `week`  → start/end of the Mon–Sun week containing anchor.
- `year`  → `null` (no events fetched).

Range → UTC conversion reuses the existing `getDateRangeUtc(startDay, endDay, tz)` helper.

### Client anchor

`CalendarScreen` (client) holds a single `selectedDate` anchor in state, seeded from the URL `date`. Rules:
- Selecting a different day **within the currently loaded month/week** is client-side only (instant, no refetch) — preserves current month-view behavior.
- Crossing a fetch boundary triggers `router.push` with a new `view`/`date`:
  - prev/next month, prev/next week, prev/next year;
  - switching view via the segmented control (push `?view=<target>&date=<selectedDate>` so context is preserved — e.g. month→week shows the week of the selected day);
  - tapping a month in year view (push `?view=month&date=YYYY-MM-01`).

This keeps `selectedDate` truthful for view switching while avoiding a server round-trip on every in-month day tap.

## Components

| File | Change | Purpose |
|---|---|---|
| `src/components/calendar/calendar-screen.tsx` | edit | Owns `selectedDate`, editing/sheet/advisor state, FABs (unchanged). Renders `ViewSwitcher` + the active view by `view`. |
| `src/components/calendar/view-switcher.tsx` | **new** | Segmented control; tap → push `?view=X&date=<selectedDate>`. Built on `Segmented` primitive. |
| `src/components/calendar/month-view.tsx` | **rename** from `day-view.tsx` | Month grid + selected-day agenda + day-note. Restyled to Refined dark. Month nav updates anchor. |
| `src/components/calendar/week-view.tsx` | **new** | `‹ 9–15 июня ›` header + vertical 7-day agenda (reuses `EventRow`; "Свободно" for empty days; current day subtly highlighted). Tap event → `onEventClick`. ‹›/today nav. |
| `src/components/calendar/year-view.tsx` | **new** | `‹ 2026 ›` header + 3×4 mini-months (read-only mini grid; today dot, current-month ring). Tap month → push month view. ‹› = ±year. |
| `src/components/calendar/month-grid.tsx` | edit | Add a `compact`/`readOnly` mode for the year mini-months (smaller cells, no event dots, no per-day onSelect). Restyle the full mode (today pill, weekend de-emphasis, category-colored dots ≤3). |
| `src/components/calendar/event-row.tsx` | edit | Left bar uses the **category color** (solid for fixed, subtle/outlined for flexible); times use tabular-nums. |
| `src/components/bottom-nav.tsx` | edit | Restyle to tokens (active pill/indicator, token colors). |
| `src/app/(app)/layout.tsx` | edit | Background → `bg-background` token. |

### Shared UI primitives — `src/components/ui/`

Small, presentational, reusable (used by calendar now; adoptable elsewhere later):

- `segmented.tsx` — `Segmented<T>({ options, value, onChange })`: a track with an active thumb (`surface-2` + hairline + subtle shadow; single CSS transition allowed).
- `icon-button.tsx` — round tap-target for ‹ › ✕ (token bg, active state).
- `section-label.tsx` — uppercase, tracked, `text-muted` micro-label.
- `surface.tsx` — layered card surface (`bg-card` + hairline `border-border`, `rounded-2xl`); optional `elevated` (surface-2 + soft shadow).

These wrap Tailwind token classes; they do not introduce a component framework. Keep each focused and prop-driven.

## Visual design — "Refined dark"

### Token foundation (`src/app/globals.css`)

The semantic-token system already exists (`--card`, `--accent`, `--muted`, `--border`, `--accent-soft`, `--success`, `--glow-start`) and is wired to Tailwind via `@theme inline` — but nothing uses it. We adopt and tune it. The app is dark-first; tune the `:root[data-theme="dark"]` fallback + internal token mappings to a deliberate Refined-dark palette. Telegram light-theme mappings stay intact (the tokens still resolve from `--tg-*`); we only sharpen the dark fallback and add the few new tokens below.

Starting palette (final values tuned during implementation against real screenshots):

```
background (app)   #0c0c0e   deep near-black, slightly cool
card / surface-1   #161618   primary card
surface-2          #1e1e22   elevated / active segment / today
border (hairline)  rgba(255,255,255,0.07)
text               #f5f5f7
text-muted         #8a8a92
text-faint         #5a5a62   weekend / out-of-month / disabled
accent             #5b7cfa   refined blue-indigo
accent-soft        rgba(91,124,250,0.14)
accent-glow        var(--glow-start)  (subtle, for today/accent emphasis)
success            #34c759   (exists)
```

New tokens to add: `--surface-2` (→ `--color-card-strong` already exists; map it), `--text-faint`, `--accent-glow`. Category colors (below) live as a TS map, not CSS tokens.

### Category colors

Add `CATEGORY_COLOR: Record<Category, string>` to `src/lib/events/categories.ts` (alongside `CATEGORY_EMOJI`), one hue per category for the 11 categories (`study, work, meeting, gym, run, meal, coffee, social, rest, errand, other`). Used for event left-bars and month-grid day dots. Unit-tested for completeness (every category has a color), mirroring `categories.test.ts`.

### Typography
- Period title (month name / year / week range): ~20–22px, weight 700, tight tracking.
- Section / weekday micro-labels: 10–11px, uppercase, `tracking-wider`, `text-muted`.
- Dates & times: **IBM Plex Mono, `tabular-nums`** (already loaded) so digits align.
- Event title 14px semibold; meta 12px `text-muted`.

### Depth & detail
- Layered surfaces (background → card → surface-2) + hairline borders instead of flat `#1a1a1a`.
- **Today**: accent pill in grids; current-day section highlighted in week view.
- **Selected day**: filled (accent or white) pill.
- **Weekend / out-of-month**: `text-faint`.
- **Events**: category-colored left bar; fixed = solid, flexible = subtle/outlined.
- Soft shadow only on elevated/active elements; restrained overall.
- Tap states: subtle opacity/scale on buttons and rows.

### Layout mockups (reference)

Month (refined version of current):
```
┌─────────────────────────────┐
│ ┌──────┐                     │
│ │Месяц │ Неделя   Год        │   segmented (active = surface-2)
│ └──────┘                     │
│   ‹     Июнь 2026     ›      │   title 700, mono year
│  ПН ВТ СР ЧТ ПТ СБ ВС        │   muted micro-labels
│  ...  [12]  ...   (today pill)│
│  ── note card (selected day) │
│  ▌🏋 09:00–10:00  Зал         │   category bar + tabular time
└─────────────────────────────┘
```

Week (7-day agenda):
```
│   ‹     9–15 июня     ›      │
│ ПН 9                         │   section header (today highlighted)
│  ▌🏋 09:00 Зал                │
│ ВТ 10                        │
│  ▌💼 14:00 Созвон             │
│ СР 11        Свободно        │   muted
│ …                            │
```

Year (12 mini-months):
```
│   ‹       2026        ›      │
│  Янв      Фев     Мар        │
│  ▦mini    ▦mini   ▦mini      │   current month = accent ring, today dot
│  Апр      Май    [Июн]       │
│  …                           │
```

## Helpers & tests

`src/lib/calendar/`:
- `buildWeek(anchor: Date): Date[]` — 7 days Mon–Sun (`startOfWeek`, `weekStartsOn: 1`). **New + unit tests.**
- `getViewRange(view, anchorISO, tz): { startUtc: string; endUtc: string } | null` — fetch range per view; `null` for year. **New + unit tests** (month bounds, week spanning two months / two years, year → null, tz edge).
- `buildMonthGrid` — unchanged.

Pure helpers are TDD'd (Vitest, as `grid.test.ts` / `categories.test.ts`). Components are validated visually via the run/verify skills (screenshots of the real Mini App).

## Implementation approach

- UI work goes through the **frontend-design** skill to hit production quality; the visual result is validated with real screenshots, iterating on token values and spacing.
- Header labels ("Месяц/Неделя/Год", month names, "Свободно") follow the existing i18n mechanism; `npm run check:i18n` must pass.
- Build the token/primitive foundation first, then month-view refactor (rename + restyle), then week, then year, then switcher wiring, then bottom-nav.

## Risks
- **Token change blast radius:** other screens hardcode hex and don't use tokens, so changing tokens won't break them; only calendar + bottom-nav + layout bg are affected. Minor black-shade mismatch with un-migrated screens is accepted.
- **Round-trip on boundary nav:** prev/next month/week and view switch do a server round-trip (as month nav does today). Acceptable and consistent with `force-dynamic`.
- **Visual quality is subjective:** mitigated by choosing a direction up front (Refined dark) and validating with screenshots during implementation.
