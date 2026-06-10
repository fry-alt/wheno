"use client";

import { format, isToday, isWeekend } from "date-fns";
import { clsx } from "clsx";

import { buildMonthGrid } from "@/lib/calendar/grid";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function MonthGrid({
  monthDate,
  selectedDate,
  daysWithEvents,
  onSelect,
  compact = false,
}: {
  monthDate: Date;
  selectedDate?: string;
  daysWithEvents?: Set<string>;
  onSelect?: (dateStr: string) => void;
  compact?: boolean;
}) {
  const grid = buildMonthGrid(monthDate);

  return (
    <div>
      {!compact && (
        <div className="grid grid-cols-7 px-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
              {d}
            </div>
          ))}
        </div>
      )}
      <div className={clsx("grid grid-cols-7", compact ? "gap-y-0.5" : "px-2 pb-2")}>
        {grid.map(({ date, inMonth }) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const selected = !compact && dateStr === selectedDate;
          const today = isToday(date);
          const weekend = isWeekend(date);
          const cell = (
            <span
              className={clsx(
                "flex items-center justify-center rounded-full font-semibold tabular-nums",
                compact ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-sm",
              )}
              style={{
                background: selected
                  ? "var(--color-foreground)"
                  : today
                    ? "var(--color-accent-soft)"
                    : "transparent",
                color: selected
                  ? "var(--color-background)"
                  : today
                    ? "var(--color-accent)"
                    : inMonth
                      ? weekend
                        ? "var(--color-muted)"
                        : "var(--color-foreground)"
                      : "var(--color-text-faint)",
                boxShadow: today && !selected ? "0 0 0 1px var(--color-accent) inset" : undefined,
              }}
            >
              {format(date, "d")}
            </span>
          );
          return compact || !onSelect ? (
            <span key={dateStr} className="flex flex-col items-center py-0.5">
              {cell}
            </span>
          ) : (
            <button key={dateStr} onClick={() => onSelect(dateStr)} className="flex flex-col items-center gap-0.5 py-1">
              {cell}
              <span
                className="h-1 w-1 rounded-full"
                style={{
                  background: daysWithEvents?.has(dateStr)
                    ? selected
                      ? "var(--color-background)"
                      : "var(--color-muted)"
                    : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
