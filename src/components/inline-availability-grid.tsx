"use client";

import { useOptimistic, useTransition } from "react";

import { toggleInlineBusyCellAction } from "@/lib/actions";
import type { HalfDay, InlineBusyCell } from "@/lib/db/queries";
import type { Language } from "@/lib/preferences-shared";
import { cn } from "@/lib/utils";

type GridCopy = {
  myAvailabilityTitle: string;
  myAvailabilityHint: string;
  gridMorning: string;
  gridAfternoon: string;
  gridEvening: string;
  availabilityWeekdays?: string[];
};

const HALF_DAYS: HalfDay[] = ["morning", "afternoon", "evening"];

const DAY_ORDER_EN = [0, 1, 2, 3, 4, 5, 6];
const DAY_ORDER_RU = [1, 2, 3, 4, 5, 6, 0];

const EN_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const RU_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function cellKey(date: string, period: HalfDay) {
  return `${date}:${period}`;
}

export function InlineAvailabilityGrid({
  weekStart,
  groupId,
  initialCells,
  copy,
  language,
}: {
  weekStart: string;
  groupId: string;
  initialCells: InlineBusyCell[];
  copy: GridCopy;
  language: Language;
}) {
  const [, startTransition] = useTransition();
  const [optimisticCells, toggleOptimistic] = useOptimistic(
    initialCells,
    (current, toggle: InlineBusyCell) => {
      const exists = current.some(
        (c) => c.date === toggle.date && c.period === toggle.period,
      );
      return exists
        ? current.filter((c) => !(c.date === toggle.date && c.period === toggle.period))
        : [...current, toggle];
    },
  );

  const periodLabels: Record<HalfDay, string> = {
    morning:   copy.gridMorning,
    afternoon: copy.gridAfternoon,
    evening:   copy.gridEvening,
  };

  // Build day columns for the current week
  const dayOrder = language === "ru" ? DAY_ORDER_RU : DAY_ORDER_EN;
  const shortLabels = language === "ru" ? RU_SHORT : EN_SHORT;

  // weekStart is "yyyy-MM-dd" for Sunday or Monday depending on locale.
  // We parse it and get each day of the week to map to real dates.
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  // Map weekday index (0=Sun…6=Sat) to the actual date in this week
  const weekdayToDate = new Map<number, string>();
  for (const dateStr of weekDates) {
    const day = new Date(`${dateStr}T00:00:00`).getDay();
    weekdayToDate.set(day, dateStr);
  }

  function handleToggle(date: string, period: HalfDay) {
    const cell: InlineBusyCell = { date, period };

    startTransition(async () => {
      toggleOptimistic(cell);

      const fd = new FormData();
      fd.set("date", date);
      fd.set("period", period);
      fd.set("groupId", groupId);
      fd.set("weekStart", weekStart);

      await toggleInlineBusyCellAction(fd);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-foreground">{copy.myAvailabilityTitle}</p>
        <p className="text-xs text-muted">{copy.myAvailabilityHint}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-center text-xs">
          <thead>
            <tr>
              {/* Period label column */}
              <th className="w-16" />
              {dayOrder.map((dayIdx) => {
                const date = weekdayToDate.get(dayIdx);
                const isToday =
                  date === new Date().toISOString().slice(0, 10);
                return (
                  <th
                    key={dayIdx}
                    className={cn(
                      "pb-1 font-semibold",
                      isToday ? "text-accent" : "text-muted",
                    )}
                  >
                    {shortLabels[dayIdx]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HALF_DAYS.map((period, rowIdx) => (
              <tr key={period}>
                <td className="py-0.5 pr-2 text-left text-[0.7rem] font-medium text-muted">
                  {periodLabels[period]}
                </td>
                {dayOrder.map((dayIdx) => {
                  const date = weekdayToDate.get(dayIdx);
                  const isBusy =
                    date !== undefined &&
                    optimisticCells.some(
                      (c) => c.date === date && c.period === period,
                    );
                  const isFirst = rowIdx === 0;
                  const isLast  = rowIdx === HALF_DAYS.length - 1;

                  return (
                    <td key={`${cellKey(date ?? "", period)}-${dayIdx}`} className="p-0.5">
                      {date !== undefined ? (
                        <button
                          aria-label={`${shortLabels[dayIdx]} ${periodLabels[period]}`}
                          aria-pressed={isBusy}
                          className={cn(
                            "h-8 w-full transition-colors",
                            isFirst && "rounded-t-lg",
                            isLast  && "rounded-b-lg",
                            isBusy
                              ? "bg-accent/20 ring-1 ring-accent/40"
                              : "bg-card-muted ring-1 ring-border/50 hover:bg-card-strong",
                          )}
                          onClick={() => handleToggle(date, period)}
                          type="button"
                        />
                      ) : (
                        <div className="h-8 w-full rounded bg-card-muted opacity-30" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
