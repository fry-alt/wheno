"use client";

import { formatInTimeZone } from "date-fns-tz";

import { categoryEmoji } from "@/lib/events/categories";
import type { CalendarEvent } from "@/lib/events/types";

export function EventRow({
  event,
  timezone,
  onClick,
}: {
  event: CalendarEvent;
  timezone: string;
  onClick: () => void;
}) {
  const start = formatInTimeZone(event.starts_at, timezone, "HH:mm");
  const end = formatInTimeZone(event.ends_at, timezone, "HH:mm");

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-3 text-left"
    >
      <span
        className="h-9 w-1 flex-shrink-0 rounded-full"
        style={
          event.is_fixed
            ? { background: "#3b82f6" }
            : { background: "transparent", borderLeft: "2px dashed #555", borderRadius: 0 }
        }
      />
      <span className="text-lg">{categoryEmoji(event.category)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{event.title}</span>
        <span className="block text-xs text-[#777]">
          {start}–{end}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </button>
  );
}
