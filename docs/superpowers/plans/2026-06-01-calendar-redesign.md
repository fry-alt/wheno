# Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild wheno as a calendar-first Telegram Mini App — monthly grid, drum-picker add form, and dark unified design across every page.

**Architecture:** `/calendar` becomes the entry point (home redirects there). `PersonalCalendar` owns the full screen including its own header and month navigation. All other pages swap `AppShell` for a new `DarkShell` component. `QuickAddSheet` gets drum pickers and activity chips with an auto-filled date.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, date-fns, date-fns-tz

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/dark-shell.tsx` | Create | Dark header shell for inner pages |
| `src/app/page.tsx` | Rewrite | Redirect `/` → `/calendar` |
| `src/app/groups/page.tsx` | Create | Groups list (moved from home) |
| `src/lib/actions.ts` | Modify | Fix `revalidatePath` after group create |
| `src/components/personal-calendar.tsx` | Rewrite | Month grid, navigation, day events |
| `src/app/calendar/page.tsx` | Rewrite | Month data fetch, remove AppShell |
| `src/components/quick-add-sheet.tsx` | Rewrite | Drum pickers, chips, `date` prop |
| `src/app/groups/new/page.tsx` | Modify | AppShell → DarkShell |
| `src/app/groups/[id]/page.tsx` | Modify | AppShell → DarkShell |
| `src/app/join/page.tsx` | Modify | AppShell → DarkShell |

---

## Task 1: DarkShell component

**Files:**
- Create: `src/components/dark-shell.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/dark-shell.tsx
import type { ReactNode } from "react";
import Link from "next/link";

export function DarkShell({
  title,
  backHref,
  action,
  children,
}: {
  title: string;
  backHref?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl font-light text-white"
            >
              ‹
            </Link>
          ) : null}
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        {action ?? null}
      </header>
      <main className="space-y-3 px-4 pb-8 pt-2">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dark-shell.tsx
git commit -m "feat: add DarkShell component for inner pages"
```

---

## Task 2: Home redirect + Groups list page

**Files:**
- Rewrite: `src/app/page.tsx`
- Create: `src/app/groups/page.tsx`
- Modify: `src/lib/actions.ts` lines ~42-54 (`createGroupAction`)

- [ ] **Step 1: Replace home page with redirect**

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/calendar");
}
```

- [ ] **Step 2: Create the groups list page**

```tsx
// src/app/groups/page.tsx
import Link from "next/link";

import { DarkShell } from "@/components/dark-shell";
import { GroupCard } from "@/components/group-card";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getGroupsForUser } from "@/lib/db/queries";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <DarkShell title="Группы" backHref="/calendar">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
  }

  const groups = await getGroupsForUser(user.id);

  return (
    <DarkShell
      title="Группы"
      backHref="/calendar"
      action={
        <Link
          href="/groups/new"
          className="flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-black"
        >
          + Создать
        </Link>
      }
    >
      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard group={group} key={group.id} language={language} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white">Нет групп</p>
          <p className="mt-1 text-xs text-[#555]">Создай группу или вступи по коду</p>
        </div>
      )}
      <Link
        href="/join"
        className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1a1a1a] text-sm font-semibold text-[#999]"
      >
        Вступить по коду
      </Link>
    </DarkShell>
  );
}
```

- [ ] **Step 3: Fix revalidatePath in createGroupAction**

In `src/lib/actions.ts`, find `createGroupAction` (around line 41) and change `revalidatePath("/")` to `revalidatePath("/groups")`:

```ts
// Before:
revalidatePath("/");
redirect(`/groups/${groupId}`);

// After:
revalidatePath("/groups");
redirect(`/groups/${groupId}`);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/groups/page.tsx src/lib/actions.ts
git commit -m "feat: redirect home to calendar, add groups list page"
```

---

## Task 3: PersonalCalendar — month grid rewrite

**Files:**
- Rewrite: `src/components/personal-calendar.tsx`

- [ ] **Step 1: Write the new component**

```tsx
// src/components/personal-calendar.tsx
"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isToday,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CalendarEventCard } from "@/components/calendar-event-card";
import { QuickAddSheet } from "@/components/quick-add-sheet";
import { ACTIVITY_GROUPS, computeWeekStats, filterEventsByTab } from "@/lib/calendar-utils";
import type { FilterTab } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/types";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const DOT_COLOR: Record<string, string> = {
  sport: "#22c55e",
  work: "#3b82f6",
  social: "#f59e0b",
};
const FILTER_LABELS: { tab: FilterTab; label: string }[] = [
  { tab: "all", label: "Все" },
  { tab: "sport", label: "Спорт" },
  { tab: "work", label: "Работа" },
  { tab: "social", label: "Социальное" },
];

function buildMonthGrid(monthDate: Date): { date: Date; inMonth: boolean }[] {
  const firstDay = startOfMonth(monthDate);
  const lastDay = endOfMonth(monthDate);
  const leadingCount = (getDay(firstDay) + 6) % 7;
  const lastDayIndex = (getDay(lastDay) + 6) % 7;
  const trailingCount = lastDayIndex === 6 ? 0 : 6 - lastDayIndex;
  const start = subDays(firstDay, leadingCount);
  const end = addDays(lastDay, trailingCount);
  return eachDayOfInterval({ start, end }).map((date) => ({
    date,
    inMonth: isSameMonth(date, monthDate),
  }));
}

function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function PersonalCalendar({
  events,
  timezone,
  monthStr,
}: {
  events: CalendarEvent[];
  timezone: string;
  monthStr: string;
}) {
  const router = useRouter();
  const monthDate = parseISO(`${monthStr}-01`);

  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const currentMonthStr = formatInTimeZone(new Date(), timezone, "yyyy-MM");

  const [selectedDate, setSelectedDate] = useState(
    monthStr === currentMonthStr
      ? todayStr
      : format(startOfMonth(monthDate), "yyyy-MM-dd"),
  );
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showAdd, setShowAdd] = useState(false);

  const gridDays = useMemo(() => buildMonthGrid(monthDate), [monthStr]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const e of events) {
      const d = formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd");
      if (!map[d]) map[d] = new Set();
      const group = ACTIVITY_GROUPS[e.activity_type ?? ""] ?? "other";
      map[d].add(group);
    }
    return map;
  }, [events, timezone]);

  const weekEvents = useMemo(() => {
    const d = parseISO(selectedDate);
    const wStart = startOfWeek(d, { weekStartsOn: 1 });
    const wEnd = endOfWeek(d, { weekStartsOn: 1 });
    return events.filter((e) => {
      const t = new Date(e.starts_at);
      return t >= wStart && t <= wEnd;
    });
  }, [events, selectedDate]);

  const stats = computeWeekStats(weekEvents);
  const statParts: string[] = [];
  if (stats.sport)
    statParts.push(`${stats.sport} ${pluralRu(stats.sport, "тренировка", "тренировки", "тренировок")}`);
  if (stats.work)
    statParts.push(`${stats.work} ${pluralRu(stats.work, "встреча", "встречи", "встреч")}`);
  if (stats.social)
    statParts.push(`${stats.social} ${pluralRu(stats.social, "событие", "события", "событий")}`);

  const dayEvents = events.filter(
    (e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === selectedDate,
  );
  const filteredEvents = filterEventsByTab(dayEvents, filter);

  function navigateMonth(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(monthDate, 1) : subMonths(monthDate, 1);
    router.push(`/calendar?month=${format(next, "yyyy-MM")}`);
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-1 pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#2481cc] text-sm font-bold text-white">
          w
        </span>
        <Link
          href="/groups"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-base"
          aria-label="Группы"
        >
          👥
        </Link>
      </header>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => navigateMonth(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white"
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <span className="text-base font-bold text-white">
          {MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()}
        </span>
        <button
          onClick={() => navigateMonth(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white"
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-2">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#555]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 px-2 pb-4">
        {gridDays.map(({ date, inMonth }) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const selected = dateStr === selectedDate;
          const today = isToday(date);
          const dots = eventsByDate[dateStr];
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                style={{
                  background: selected ? "#fff" : today ? "#2481cc22" : "transparent",
                  color: selected ? "#000" : inMonth ? "#fff" : "#333",
                  border: today && !selected ? "1px solid #2481cc55" : undefined,
                }}
              >
                {format(date, "d")}
              </span>
              <div className="flex h-1.5 gap-0.5">
                {dots
                  ? Array.from(dots)
                      .slice(0, 3)
                      .map((group) => (
                        <span
                          key={group}
                          className="h-1 w-1 rounded-full"
                          style={{ background: DOT_COLOR[group] ?? "#555" }}
                        />
                      ))
                  : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-[#1a1a1a]" />

      {/* Stats */}
      {statParts.length > 0 && (
        <p className="px-4 py-3 text-xs text-[#555]">{statParts.join(" · ")}</p>
      )}

      {/* Filter tabs */}
      <div
        className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-hide"
        style={{ paddingTop: statParts.length === 0 ? "0.75rem" : undefined }}
      >
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

      {/* Events list */}
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

      {showAdd && (
        <QuickAddSheet date={selectedDate} onClose={() => setShowAdd(false)} timezone={timezone} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

---

## Task 4: Calendar page — month data fetch

**Files:**
- Rewrite: `src/app/calendar/page.tsx`

- [ ] **Step 1: Write the new page**

```tsx
// src/app/calendar/page.tsx
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { PersonalCalendar } from "@/components/personal-calendar";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarEventsForUserInRange } from "@/lib/db/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { getUiPreferences } from "@/lib/preferences";
import { readSearchParam } from "@/lib/utils";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0f0f0f] p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#2481cc] text-xl font-bold text-white">
          w
        </span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const monthParam = readSearchParam(params?.month);
  const monthStr =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : formatInTimeZone(new Date(), user.timezone, "yyyy-MM");

  const monthDate = parseISO(`${monthStr}-01`);
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const { start, end } = getDateRangeUtc(monthStart, monthEnd, user.timezone);

  const events = await getCalendarEventsForUserInRange({
    userId: user.id,
    startAt: start,
    endAt: end,
  });

  return (
    <PersonalCalendar events={events} monthStr={monthStr} timezone={user.timezone} />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit Tasks 3 + 4**

```bash
git add src/components/personal-calendar.tsx src/app/calendar/page.tsx
git commit -m "feat: month grid calendar with navigation and day events"
```

---

## Task 5: QuickAddSheet — drum pickers and activity chips

**Files:**
- Rewrite: `src/components/quick-add-sheet.tsx`

- [ ] **Step 1: Write the new component**

```tsx
// src/components/quick-add-sheet.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import { createCalendarEventAction } from "@/lib/actions";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const ACTIVITY_CHIPS = [
  { value: "gym", label: "🏋️ Зал" },
  { value: "run", label: "🏃 Бег" },
  { value: "dinner", label: "🍽️ Ужин" },
  { value: "coffee", label: "☕ Кофе" },
  { value: "meeting", label: "💼 Встреча" },
  { value: "work", label: "💻 Работа" },
  { value: "other", label: "📌 Другое" },
];

function DrumPicker({
  values,
  defaultIndex,
  onChange,
}: {
  values: string[];
  defaultIndex: number;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = defaultIndex * 40;
    }
  }, []);

  function handleScroll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / 40);
      const clamped = Math.max(0, Math.min(idx, values.length - 1));
      onChange(values[clamped]);
    }, 80);
  }

  return (
    <div className="relative w-14">
      {/* Center highlight ring */}
      <div
        className="pointer-events-none absolute left-0 right-0 rounded-lg border border-[#3a3a3a]"
        style={{ top: 40, height: 40, zIndex: 2 }}
      />
      {/* Top fade */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: 0,
          height: 44,
          background: "linear-gradient(to bottom, #111 40%, transparent)",
          zIndex: 2,
        }}
      />
      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          bottom: 0,
          height: 44,
          background: "linear-gradient(to top, #111 40%, transparent)",
          zIndex: 2,
        }}
      />
      {/* Scrollable column */}
      <div
        ref={ref}
        onScroll={handleScroll}
        className="scrollbar-hide"
        style={{
          height: 120,
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ height: 40 }} />
        {values.map((v) => (
          <div
            key={v}
            style={{
              height: 40,
              scrollSnapAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="text-xl font-bold text-white">{v}</span>
          </div>
        ))}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

export function QuickAddSheet({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
  timezone: string;
}) {
  const [activeChip, setActiveChip] = useState("gym");
  const [title, setTitle] = useState("");
  const [startH, setStartH] = useState("07");
  const [startM, setStartM] = useState("00");
  const [endH, setEndH] = useState("08");
  const [endM, setEndM] = useState("00");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayDate = format(parseISO(date), "d MMMM, EEE", { locale: ru });
  const buttonLabel = `Добавить  ${startH}:${startM} – ${endH}:${endM}`;

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("Введи название");
      return;
    }
    const startVal = parseInt(startH) * 60 + parseInt(startM);
    const endVal = parseInt(endH) * 60 + parseInt(endM);
    if (endVal <= startVal) {
      setError("Конец должен быть позже начала");
      return;
    }
    setPending(true);
    try {
      await createCalendarEventAction({
        title: title.trim(),
        activity_type: activeChip,
        date,
        start_time: `${startH}:${startM}`,
        end_time: `${endH}:${endM}`,
      });
      onClose();
    } catch {
      setError("Не удалось сохранить. Попробуй ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#111] p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#999]">{displayDate}</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2a2a] text-xs text-[#999]"
          >
            ✕
          </button>
        </div>

        {/* Activity chips */}
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {ACTIVITY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setActiveChip(chip.value)}
              className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: activeChip === chip.value ? "#fff" : "#1a1a1a",
                color: activeChip === chip.value ? "#000" : "#888",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className="mb-5 w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none"
        />

        {/* Time pickers */}
        <div className="mb-2 flex items-start gap-4">
          {/* Start */}
          <div className="flex-1">
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#555]">
              Начало
            </p>
            <div className="flex items-center justify-center gap-1">
              <DrumPicker
                values={HOURS}
                defaultIndex={7}
                onChange={setStartH}
              />
              <span className="mb-1 text-xl font-bold text-[#555]">:</span>
              <DrumPicker
                values={MINUTES}
                defaultIndex={0}
                onChange={setStartM}
              />
            </div>
          </div>

          {/* Separator */}
          <div className="mt-10 text-[#333] text-lg font-light">—</div>

          {/* End */}
          <div className="flex-1">
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#555]">
              Конец
            </p>
            <div className="flex items-center justify-center gap-1">
              <DrumPicker
                values={HOURS}
                defaultIndex={8}
                onChange={setEndH}
              />
              <span className="mb-1 text-xl font-bold text-[#555]">:</span>
              <DrumPicker
                values={MINUTES}
                defaultIndex={0}
                onChange={setEndM}
              />
            </div>
          </div>
        </div>

        {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={pending}
          className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {pending ? "Добавляю..." : buttonLabel}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/quick-add-sheet.tsx
git commit -m "feat: drum picker time selector and activity chips in QuickAddSheet"
```

---

## Task 6: Inner pages — replace AppShell with DarkShell

**Files:**
- Modify: `src/app/groups/new/page.tsx`
- Modify: `src/app/groups/[id]/page.tsx`
- Modify: `src/app/join/page.tsx`

- [ ] **Step 1: Rewrite groups/new/page.tsx**

Replace the entire file content:

```tsx
// src/app/groups/new/page.tsx
import Link from "next/link";

import { DarkShell } from "@/components/dark-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { createGroupAction } from "@/lib/actions";
import { getUiPreferences } from "@/lib/preferences";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";
import { getTranslations } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CreateGroupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = decodeSearchMessage(readSearchParam(params.error));
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <DarkShell title={copy.createGroup.title} backHref="/groups">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
  }

  return (
    <DarkShell title={copy.createGroup.title} backHref="/groups">
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}
      <Card>
        <form action={createGroupAction} className="space-y-4">
          <Input
            autoFocus
            id="name"
            label={copy.createGroup.nameLabel}
            name="name"
            placeholder={copy.createGroup.namePlaceholder}
            required
          />
          <FormSubmitButton
            label={copy.createGroup.submit}
            pendingLabel={copy.createGroup.pending}
          />
        </form>
      </Card>
    </DarkShell>
  );
}
```

- [ ] **Step 2: Update groups/[id]/page.tsx — swap AppShell**

Open `src/app/groups/[id]/page.tsx`. Make the following two changes:

**Add import** (top of file, replace the `AppShell` import):
```tsx
// Remove:
import { AppShell } from "@/components/app-shell";
// Add:
import { DarkShell } from "@/components/dark-shell";
```

**Replace the authenticated return** — find the outer `<AppShell ...>` wrapper and replace it with `<DarkShell>`. There are two `AppShell` calls (authenticated and unauthenticated). Replace both:

Unauthenticated block (find and replace):
```tsx
// Before:
    return (
      <AppShell
        description={copy.group.splashDescription}
        language={language}
        theme={theme}
        title={copy.group.loadingTitle}
      >
        <SessionBootstrap language={language} />
      </AppShell>
    );

// After:
    return (
      <DarkShell title={copy.group.loadingTitle} backHref="/groups">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
```

Authenticated block (find and replace):
```tsx
// Before:
  return (
    <AppShell
      description={copy.group.description}
      language={language}
      theme={theme}
      title={group.name}
      user={user}
    >

// After:
  return (
    <DarkShell title={group.name} backHref="/groups">
```

Also replace the closing `</AppShell>` with `</DarkShell>`.

Remove unused imports `language`, `theme` variables if they are no longer used after removing AppShell (check if they're used elsewhere in the file first).

- [ ] **Step 3: Rewrite join/page.tsx**

Replace the entire file content:

```tsx
// src/app/join/page.tsx
import { DarkShell } from "@/components/dark-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { joinGroupAction } from "@/lib/actions";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = decodeSearchMessage(readSearchParam(params.error));
  const inviteCode = readSearchParam(params.code) ?? "";
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <DarkShell title={copy.join.title} backHref="/groups">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
  }

  return (
    <DarkShell title={copy.join.title} backHref="/groups">
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}
      <Card>
        <form action={joinGroupAction} className="space-y-4">
          <Input
            autoComplete="off"
            autoFocus
            defaultValue={inviteCode.toUpperCase()}
            id="inviteCode"
            label={copy.join.codeLabel}
            name="inviteCode"
            placeholder={copy.join.codePlaceholder}
            required
          />
          <FormSubmitButton label={copy.join.submit} pendingLabel={copy.join.pending} />
        </form>
      </Card>
    </DarkShell>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/groups/new/page.tsx src/app/groups/[id]/page.tsx src/app/join/page.tsx
git commit -m "feat: replace AppShell with DarkShell on groups and join pages"
```

---

## Self-Review Checklist

- **Spec coverage:** All sections covered:
  - ✅ Home → redirect to /calendar
  - ✅ Month grid with < > navigation
  - ✅ Dot indicators by activity group
  - ✅ Stats bar for selected week
  - ✅ Filter tabs
  - ✅ Day event list with existing CalendarEventCard
  - ✅ FAB → QuickAddSheet with `date` prop
  - ✅ Drum pickers for hours/minutes
  - ✅ Activity chips
  - ✅ DarkShell on all inner pages
  - ✅ Groups list page at `/groups`

- **Type consistency:**
  - `PersonalCalendar` props: `{ events: CalendarEvent[], timezone: string, monthStr: string }` — used consistently in Task 3 and Task 4
  - `QuickAddSheet` props: `{ date: string, onClose: () => void, timezone: string }` — used consistently in Task 3 (caller) and Task 5 (definition)
  - `DrumPicker` props: `{ values: string[], defaultIndex: number, onChange: (value: string) => void }` — internal to QuickAddSheet

- **Known edge case:** Groups/[id] page modification in Step 2 of Task 6 requires manual editing since the file is complex. Verify that `language` and `theme` variables are only removed from imports/destructuring if they are truly unused after the AppShell swap. The `getTranslations(language)` call is still needed for copy strings.
