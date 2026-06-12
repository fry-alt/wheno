"use client";

import { formatInTimeZone } from "date-fns-tz";

export function BusyGrid({
  busy,
  timezone,
}: {
  busy: { starts_at: string; ends_at: string }[];
  timezone: string;
}) {
  // Group busy intervals by local day (next 7 days).
  const days: { date: string; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = formatInTimeZone(d, timezone, "yyyy-MM-dd");
    const label = formatInTimeZone(d, timezone, "EEE d");
    days.push({ date, label });
  }

  const byDay = new Map<string, { from: string; to: string }[]>();
  for (const b of busy) {
    const date = formatInTimeZone(b.starts_at, timezone, "yyyy-MM-dd");
    const from = formatInTimeZone(b.starts_at, timezone, "HH:mm");
    const to = formatInTimeZone(b.ends_at, timezone, "HH:mm");
    const list = byDay.get(date) ?? [];
    list.push({ from, to });
    byDay.set(date, list);
  }

  return (
    <div className="space-y-2">
      {days.map((d) => {
        const blocks = (byDay.get(d.date) ?? []).sort((a, b) => a.from.localeCompare(b.from));
        return (
          <div key={d.date} className="flex items-start gap-3">
            <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold uppercase text-muted">{d.label}</span>
            {blocks.length === 0 ? (
              <span className="text-xs text-success">свободен весь день</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {blocks.map((b, i) => (
                  <span key={i} className="rounded-md bg-card-strong px-2 py-0.5 text-xs text-muted">
                    {b.from}–{b.to}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
