"use client";

import { format, isToday } from "date-fns";

import { buildMonthGrid } from "@/lib/calendar/grid";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function MonthGrid({
  monthDate,
  selectedDate,
  daysWithEvents,
  onSelect,
}: {
  monthDate: Date;
  selectedDate: string;
  daysWithEvents: Set<string>;
  onSelect: (dateStr: string) => void;
}) {
  const grid = buildMonthGrid(monthDate);

  return (
    <div>
      <div className="grid grid-cols-7 px-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#555]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 px-2 pb-2">
        {grid.map(({ date, inMonth }) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const selected = dateStr === selectedDate;
          const today = isToday(date);
          return (
            <button key={dateStr} onClick={() => onSelect(dateStr)} className="flex flex-col items-center gap-0.5 py-1">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                style={{
                  background: selected ? "#fff" : today ? "#3b82f622" : "transparent",
                  color: selected ? "#000" : inMonth ? "#fff" : "#333",
                  border: today && !selected ? "1px solid #3b82f655" : undefined,
                }}
              >
                {format(date, "d")}
              </span>
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: daysWithEvents.has(dateStr) ? (selected ? "#000" : "#555") : "transparent" }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
