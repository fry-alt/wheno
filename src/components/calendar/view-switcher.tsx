"use client";

import { Segmented } from "@/components/ui/segmented";
import type { CalendarView } from "@/lib/calendar/views";

const OPTIONS = [
  { value: "month" as const, label: "Месяц" },
  { value: "week" as const, label: "Неделя" },
  { value: "year" as const, label: "Год" },
];

export function ViewSwitcher({ value, onChange }: { value: CalendarView; onChange: (v: CalendarView) => void }) {
  return (
    <div className="flex justify-center px-4 pt-4">
      <Segmented options={OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}
