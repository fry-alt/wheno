"use client";

import { useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { deleteCalendarEventAction } from "@/lib/actions";
import { getActivityEmoji } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/types";

const SWIPE_REVEAL = 120;
const SWIPE_THRESHOLD = 60;

const ENERGY_COLOR: Record<string, string> = {
  high: "#22c55e", medium: "#f59e0b", low: "#ef4444",
};
const ENERGY_EMOJI: Record<string, string> = {
  high: "✨", medium: "⚡", low: "🔋",
};

export function CalendarEventCard({
  event,
  timezone,
}: {
  event: CalendarEvent;
  timezone: string;
}) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef<number | null>(null);

  const startTime = formatInTimeZone(event.starts_at, timezone, "HH:mm");
  const endTime = formatInTimeZone(event.ends_at, timezone, "HH:mm");
  const emoji = getActivityEmoji(event.activity_type);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = startX.current - e.touches[0].clientX;
    setOffset(Math.max(0, Math.min(dx, SWIPE_REVEAL)));
  }

  function onTouchEnd() {
    setIsDragging(false);
    startX.current = null;
    setOffset((prev) => (prev >= SWIPE_THRESHOLD ? SWIPE_REVEAL : 0));
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Revealed action buttons */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE_REVEAL }}>
        <button
          className="flex-1 bg-[#2a2a2a] text-sm"
          onClick={() => setOffset(0)}
        >
          ✏️
        </button>
        <button
          className="flex-1 bg-red-600 text-sm"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            try {
              await deleteCalendarEventAction(event.id);
            } catch {
              // error is swallowed — card will unmount on success via revalidatePath
            } finally {
              setDeleting(false);
            }
          }}
        >
          🗑️
        </button>
      </div>

      {/* Card */}
      <div
        style={{
          transform: `translateX(-${offset}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-4 py-3"
      >
        <span className="text-xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{event.title}</p>
          <p className="mt-0.5 text-xs text-[#666]">
            {startTime}–{endTime}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        {event.energy_after && (
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: `${ENERGY_COLOR[event.energy_after]}22`,
              color: ENERGY_COLOR[event.energy_after],
            }}
          >
            {ENERGY_EMOJI[event.energy_after]}
          </span>
        )}
      </div>
    </div>
  );
}
