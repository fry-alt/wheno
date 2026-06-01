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
