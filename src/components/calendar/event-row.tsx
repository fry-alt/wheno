"use client";

import { formatInTimeZone } from "date-fns-tz";

import { categoryEmoji, categoryColor } from "@/lib/events/categories";
import type { EventInstance } from "@/lib/events/types";

export function EventRow({
  event,
  timezone,
  onClick,
}: {
  event: EventInstance;
  timezone: string;
  onClick: () => void;
}) {
  const start = formatInTimeZone(event.starts_at, timezone, "HH:mm");
  const end = formatInTimeZone(event.ends_at, timezone, "HH:mm");
  const color = categoryColor(event.category);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition active:scale-[0.99] active:bg-card-strong"
    >
      <span
        className="h-9 w-1.5 flex-shrink-0 rounded-full"
        style={{
          background: event.is_fixed ? color : "transparent",
          border: event.is_fixed ? undefined : `1.5px solid ${color}`,
        }}
      />
      <span className="text-lg">{categoryEmoji(event.category)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{event.title}</span>
        <span className="block text-xs text-muted">
          <span className="tabular-nums">{start}–{end}</span>
          {event.series_id ? " · 🔁" : ""}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </button>
  );
}
