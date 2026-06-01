"use client";

import { useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";

import { MonthGrid } from "./month-grid";
import { EventRow } from "./event-row";
import type { CalendarEvent } from "@/lib/events/types";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function DayView({
  events,
  timezone,
  monthStr,
  onEventClick,
}: {
  events: CalendarEvent[];
  timezone: string;
  monthStr: string;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const router = useRouter();
  const monthDate = parseISO(`${monthStr}-01`);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const currentMonthStr = formatInTimeZone(new Date(), timezone, "yyyy-MM");

  const [selectedDate, setSelectedDate] = useState(
    monthStr === currentMonthStr ? todayStr : format(startOfMonth(monthDate), "yyyy-MM-dd"),
  );

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd"));
    return set;
  }, [events, timezone]);

  const dayEvents = useMemo(
    () => events.filter((e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === selectedDate),
    [events, timezone, selectedDate],
  );

  function navigateMonth(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(monthDate, 1) : subMonths(monthDate, 1);
    router.push(`/calendar?month=${format(next, "yyyy-MM")}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigateMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white" aria-label="Предыдущий месяц">‹</button>
        <span className="text-base font-bold text-white">{MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()}</span>
        <button onClick={() => navigateMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white" aria-label="Следующий месяц">›</button>
      </div>

      <MonthGrid monthDate={monthDate} selectedDate={selectedDate} daysWithEvents={daysWithEvents} onSelect={setSelectedDate} />

      <div className="mx-4 my-2 border-t border-[#1a1a1a]" />

      <div className="flex flex-col gap-2 px-4">
        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-white">Свободный день</p>
            <p className="mt-1 text-xs text-[#555]">Нажми ➕ чтобы добавить</p>
          </div>
        ) : (
          dayEvents.map((e) => <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />)
        )}
      </div>
    </div>
  );
}
