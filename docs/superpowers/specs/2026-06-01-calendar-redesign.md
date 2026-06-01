# Calendar Redesign — Convenient Mini App

**Date:** 2026-06-01

---

## Overview

Full redesign of wheno as a personal-calendar-first Telegram Mini App. The calendar becomes the entry point and primary screen. Groups are secondary, accessible via a header icon. The add-event UX is rebuilt around a drum-picker time selector and activity chips to minimize taps.

---

## Goals

1. Open the app → see your calendar immediately (no intermediate home screen)
2. Add an event in as few taps as possible (2 fields, no date input, drum pickers for time)
3. Navigate freely across months and years
4. All pages share a unified dark aesthetic — no more white AppShell header

---

## Screen 1: `/calendar` (new main screen)

### Layout (top → bottom)

**Header bar**
- Left: `wheno` wordmark
- Center: current month + year (e.g. `Июнь 2026`)
- Right: `👥` icon → navigates to `/groups`

**Month grid**
- 7-column grid: `Пн Вт Ср Чт Пт Сб Вс`
- Each day cell: date number + up to 3 colored dots below (sport=green, work=blue, social=orange)
- Today: accent-colored circle around number
- Selected day: white circle around number
- Days outside current month: `color: #333`
- `<` / `>` buttons on the month header navigate prev/next month → `router.push('?month=YYYY-MM')` triggers server re-fetch

**Stats bar**
- One line below the grid: `3 тренировки · 2 встречи` — stats for the week containing the selected day
- Only non-zero categories shown
- Categories: sport (gym/run/swim/tennis/cycling/yoga/sport), work (work/meeting/conference/call), social (dinner/lunch/coffee/drinks/bar/party/concert/theatre/cinema)

**Filter tabs**
- `Все · Спорт · Работа · Социальное`
- Active tab: white pill; inactive: `#1a1a1a` pill

**Events list**
- Events for selected day, filtered by active tab, sorted by `starts_at`
- Each row: `CalendarEventCard` (existing — swipe to delete/edit)
- Empty state: dashed border card `Свободный день / Нажми + чтобы добавить`

**FAB**
- Fixed bottom-right: white circle `+`
- Opens `QuickAddSheet` with `date={selectedDate}`

### Data fetching

`/calendar?month=YYYY-MM` — server component fetches events for the full month:
- Start: first day of month 00:00 local time → UTC
- End: last day of month 23:59:59 local time → UTC
- Uses existing `getCalendarEventsForUserInRange`

Default (no `?month` param): current month.

### State (client)

`PersonalCalendar` manages:
- `currentMonth: Date` — derived from URL param or today
- `selectedDate: string` — YYYY-MM-DD, default = today (or first day of month if navigating away)
- `filter: FilterTab`
- `showAdd: boolean`

Month navigation: `router.push('/calendar?month=YYYY-MM')` — triggers server re-render with new month data.

---

## Screen 2: QuickAddSheet (rebuilt)

### Structure

```
╭──────────────────────────────────╮
│ Вт, 18 июня              [✕]    │  ← display only, not editable
│                                  │
│ 🏋️  🏃  🍽️  ☕  💼  💻  📌       │  ← horizontal scroll chips
│                                  │
│ ┌────────────────────────────┐   │
│ │  Название...               │   │
│ └────────────────────────────┘   │
│                                  │
│   Начало          Конец          │
│   ┌───┐ ┌───┐   ┌───┐ ┌───┐    │
│   │06 │ │45 │   │07 │ │45 │    │
│   │07 │ │00 │   │08 │ │00 │    │  ← center row = selected
│   │08 │ │15 │   │09 │ │15 │    │
│   └───┘ └───┘   └───┘ └───┘    │
│    ч     мин     ч     мин      │
│                                  │
│ ┌──────────────────────────────┐ │
│ │   Добавить  07:00 – 08:00   │ │
│ └──────────────────────────────┘ │
╰──────────────────────────────────╯
```

### Activity chips

`🏋️ Зал · 🏃 Бег · 🍽️ Ужин · ☕ Кофе · 💼 Встреча · 💻 Работа · 📌 Другое`

Horizontal scrollable row. Active chip: white background, black text. Inactive: `#1a1a1a`.

### Drum picker

- Pure CSS implementation — no libraries
- Container: `height: 120px; overflow-y: scroll; scroll-snap-type: y mandatory`
- Each item: `height: 40px; scroll-snap-align: center`
- 3 visible rows (prev, current, next)
- Center row highlighted with `background: #2a2a2a; border-radius: 8px`
- `onScrollEnd` → `Math.round(scrollTop / 40)` → read value (fallback: debounced `onScroll` with 80ms delay)
- Hours: 00–23; Minutes: 00, 15, 30, 45
- On mount: `scrollTo({ top: index * 40, behavior: 'instant' })`

### Props

```ts
QuickAddSheet({ onClose: () => void, timezone: string, date: string })
```

`date` (YYYY-MM-DD) is displayed as `Вт, 18 июня` and passed directly to `createCalendarEventAction`. No date input in the form.

### Validation

End time must be after start time. If not: shake animation + error text `Конец должен быть позже начала`.

---

## Screen 3: `/groups` (dark redesign)

- Uses `DarkShell` with `backHref="/calendar"` and action `+ Создать` → `/groups/new`
- Group cards: `#1a1a1a` background, same card structure as now
- `Вступить по коду` button at bottom

---

## Screen 4: `/groups/[id]`, `/groups/new`, `/join`

- Replace AppShell with a dark shell component `DarkShell`:
  - Header: `← {title}` on left, optional action on right
  - Background `#0f0f0f`
  - Content area with `px-4 py-5`
- Forms: inputs `bg-[#111] text-white placeholder-[#555]`, rounded-xl
- Buttons: primary = white bg + black text; secondary = `#1a1a1a` bg

---

## Routing change

`src/app/page.tsx` (home) → redirect to `/calendar`:

```ts
import { redirect } from 'next/navigation';
export default function HomePage() { redirect('/calendar'); }
```

---

## New shared component: `DarkShell`

```ts
DarkShell({ title: string, backHref?: string, action?: ReactNode, children: ReactNode })
```

Replaces `AppShell` on all inner pages. The calendar screen manages its own header inline (doesn't use DarkShell).

---

## Files changed

| File | Change |
|---|---|
| `src/app/page.tsx` | Redirect to `/calendar` |
| `src/app/calendar/page.tsx` | Accept `?month` param, fetch full month range |
| `src/components/personal-calendar.tsx` | Full rewrite: month grid, month navigation, selected day, stats for selected week |
| `src/components/quick-add-sheet.tsx` | Full rewrite: drum pickers, activity chips, `date` prop |
| `src/components/dark-shell.tsx` | New: shared dark header shell |
| `src/app/groups/page.tsx` | New page — move groups list logic from `src/app/page.tsx` here |
| `src/app/groups/new/page.tsx` | Replace AppShell with DarkShell |
| `src/app/groups/[id]/page.tsx` | Replace AppShell with DarkShell |
| `src/app/join/page.tsx` | Replace AppShell with DarkShell |

---

## What does NOT change

- `CalendarEventCard` — swipe, delete, energy badge — unchanged
- `createCalendarEventAction`, `deleteCalendarEventAction` — unchanged
- `getCalendarEventsForUserInRange` — unchanged (just called with month range)
- `GroupCard` inner structure — unchanged, just rendered inside DarkShell
- DB schema — no changes
- Auth flow — unchanged

---

## Implementation order

1. `DarkShell` component
2. Home redirect
3. `PersonalCalendar` — month grid + navigation
4. Calendar page — month data fetching
5. `QuickAddSheet` — drum pickers + chips
6. Groups, join, new-group pages — swap AppShell → DarkShell
