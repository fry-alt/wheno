"use client";

import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { EventRow } from "./event-row";
import { IconButton } from "@/components/ui/icon-button";
import { buildWeek } from "@/lib/calendar/views";
import type { EventInstance } from "@/lib/events/types";

const WEEKDAY = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_GEN = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function WeekView({
  anchor,
  events,
  timezone,
  todayStr,
  onNavigateWeek,
  onEventClick,
}: {
  anchor: string; // yyyy-MM-dd
  events: EventInstance[];
  timezone: string;
  todayStr: string;
  onNavigateWeek: (dir: 1 | -1) => void;
  onEventClick: (event: EventInstance) => void;
}) {
  const days = buildWeek(parseISO(anchor));
  const first = days[0];
  const last = days[6];
  const rangeLabel = `${first.getDate()} ${MONTH_GEN[first.getMonth()]} – ${last.getDate()} ${MONTH_GEN[last.getMonth()]}`;

  const byDay = new Map<string, EventInstance[]>();
  for (const e of events) {
    const key = formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd");
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
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
                  {WEEKDAY[day.getDay()]} <span className="tabular-nums">{day.getDate()}</span>
                </span>
                {isToday && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">сегодня</span>
                )}
              </div>
              {dayEvents.length === 0 ? (
                <p className="pl-1 text-xs text-text-faint">Свободно</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dayEvents.map((e) => (
                    <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
