"use client";

import { useState } from "react";
import { addDays, format, isToday, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
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
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: selected ? "#666" : "#555" }}
              >
                {format(day, "EEE")}
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

      {showAdd && <QuickAddSheet onClose={() => setShowAdd(false)} timezone={timezone} />}
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
