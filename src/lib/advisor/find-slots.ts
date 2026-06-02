import { eachDayOfInterval, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { toUtcDateFromLocalParts } from "@/lib/datetime";
import type { CalendarEvent } from "@/lib/events/types";
import type { ProposedSlot, SlotRequest } from "./types";

const GRID_MIN = 15;

function hhmmToMin(value: string): number {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function partWindow(
  part: SlotRequest["part_of_day"],
  dayStart: number,
  dayEnd: number,
): [number, number] {
  switch (part) {
    case "morning":
      return [dayStart, Math.min(12 * 60, dayEnd)];
    case "afternoon":
      return [Math.max(12 * 60, dayStart), Math.min(18 * 60, dayEnd)];
    case "evening":
      return [Math.max(18 * 60, dayStart), dayEnd];
    default:
      return [dayStart, dayEnd];
  }
}

export function findSlots(
  request: SlotRequest,
  busyEvents: CalendarEvent[],
  dayHours: { start: string; end: string },
  timezone: string,
): ProposedSlot[] {
  const dayStart = hhmmToMin(dayHours.start);
  const dayEnd = hhmmToMin(dayHours.end);
  const [winStart, winEnd] = partWindow(request.part_of_day, dayStart, dayEnd);
  const dur = request.duration_min;

  const days = eachDayOfInterval({
    start: parseISO(request.window.from),
    end: parseISO(request.window.to),
  });

  const candidates: { date: string; startMin: number }[] = [];

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");

    // Busy intervals (local minutes) for events that START on this date.
    const busy: Array<[number, number]> = [];
    for (const e of busyEvents) {
      if (formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") !== dateStr) continue;
      const s = hhmmToMin(formatInTimeZone(e.starts_at, timezone, "HH:mm"));
      let en = hhmmToMin(formatInTimeZone(e.ends_at, timezone, "HH:mm"));
      if (en <= s) en = dayEnd; // guard against cross-midnight ends
      busy.push([s, en]);
    }

    // Earliest free slot on the 15-min grid within the part-of-day window.
    let foundMin: number | null = null;
    for (let start = winStart; start + dur <= winEnd; start += GRID_MIN) {
      const end = start + dur;
      const overlaps = busy.some(([bs, be]) => start < be && end > bs);
      if (!overlaps) {
        foundMin = start;
        break;
      }
    }
    if (foundMin !== null) candidates.push({ date: dateStr, startMin: foundMin });
  }

  // Distribute `count` occurrences across the candidate days.
  const n = candidates.length;
  let chosen: { date: string; startMin: number }[];
  if (request.count <= 1) {
    chosen = candidates.slice(0, 1);
  } else if (n <= request.count) {
    chosen = candidates;
  } else {
    const idxs = new Set<number>();
    for (let i = 0; i < request.count; i++) {
      idxs.add(Math.round((i * (n - 1)) / (request.count - 1)));
    }
    chosen = [...idxs].sort((a, b) => a - b).map((i) => candidates[i]);
  }

  return chosen.map(({ date, startMin }) => ({
    date,
    starts_at: toUtcDateFromLocalParts(date, minToHHMM(startMin), timezone).toISOString(),
    ends_at: toUtcDateFromLocalParts(date, minToHHMM(startMin + dur), timezone).toISOString(),
  }));
}
