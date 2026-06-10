"use client";

import { clsx } from "clsx";

import { MonthGrid } from "./month-grid";
import { IconButton } from "@/components/ui/icon-button";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function YearView({
  year,
  currentMonth,
  onSelectMonth,
  onNavigateYear,
}: {
  year: number;
  currentMonth: string; // "yyyy-MM" of today
  onSelectMonth: (monthStr: string) => void;
  onNavigateYear: (dir: 1 | -1) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <IconButton onClick={() => onNavigateYear(-1)} ariaLabel="Предыдущий год">‹</IconButton>
        <span className="text-base font-bold text-foreground tabular-nums">{year}</span>
        <IconButton onClick={() => onNavigateYear(1)} ariaLabel="Следующий год">›</IconButton>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 pb-4">
        {MONTH_NAMES.map((name, i) => {
          const monthStr = `${year}-${String(i + 1).padStart(2, "0")}`;
          const isCurrent = monthStr === currentMonth;
          return (
            <button
              key={monthStr}
              onClick={() => onSelectMonth(monthStr)}
              className={clsx(
                "rounded-2xl border bg-card p-2 text-left transition active:scale-[0.98]",
                isCurrent ? "border-accent" : "border-border",
              )}
            >
              <p className={clsx("mb-1 px-1 text-xs font-semibold", isCurrent ? "text-accent" : "text-foreground")}>{name}</p>
              <MonthGrid monthDate={new Date(year, i, 1)} compact />
            </button>
          );
        })}
      </div>
    </div>
  );
}
