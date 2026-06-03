import { addDays, addMonths, addYears, format, getDate, getDay, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { toUtcDateFromLocalParts } from "@/lib/datetime";
import type { CalendarEvent, EventInstance } from "./types";

const MAX_ITER = 1200;

function mondayWeekday(date: Date): number {
  const d = getDay(date); // 0=Sun..6=Sat
  return d === 0 ? 7 : d;
}

export function expandEvents(
  rows: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string,
): EventInstance[] {
  const out: EventInstance[] = [];
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  for (const row of rows) {
    if (!row.recurrence) {
      const startUtc = new Date(row.starts_at);
      const t = startUtc.getTime();
      if (t >= startMs && t < endMs) {
        out.push({
          ...row,
          starts_at: startUtc.toISOString(),
          ends_at: new Date(row.ends_at).toISOString(),
          series_id: null,
          occurrence_date: null,
        });
      }
      continue;
    }

    const rec = row.recurrence;
    const anchorDateStr = formatInTimeZone(row.starts_at, timezone, "yyyy-MM-dd");
    const startHHMM = formatInTimeZone(row.starts_at, timezone, "HH:mm");
    const endHHMM = formatInTimeZone(row.ends_at, timezone, "HH:mm");
    const excluded = new Set(row.excluded_dates ?? []);
    const anchor = parseISO(anchorDateStr);
    const anchorDom = getDate(anchor);
    const weekdays =
      rec.freq === "weekly"
        ? rec.weekdays && rec.weekdays.length > 0
          ? rec.weekdays
          : [mondayWeekday(anchor)]
        : null;

    let emitted = 0;

    const emit = (dateStr: string): boolean => {
      if (!excluded.has(dateStr)) {
        const startUtc = toUtcDateFromLocalParts(dateStr, startHHMM, timezone);
        const sMs = startUtc.getTime();
        if (sMs >= endMs) return false;
        if (sMs >= startMs) {
          const endUtc = toUtcDateFromLocalParts(dateStr, endHHMM, timezone);
          out.push({
            ...row,
            starts_at: startUtc.toISOString(),
            ends_at: endUtc.toISOString(),
            series_id: row.id,
            occurrence_date: dateStr,
          });
        }
      }
      return true;
    };

    if (rec.freq === "daily" || rec.freq === "weekly") {
      let cursor = anchor;
      for (let i = 0; i < MAX_ITER; i++) {
        const dateStr = format(cursor, "yyyy-MM-dd");
        if (rec.until && dateStr > rec.until) break;
        if (rec.count != null && emitted >= rec.count) break;
        const matches = rec.freq === "daily" || weekdays!.includes(mondayWeekday(cursor));
        if (matches) {
          emitted += 1;
          const cont = emit(dateStr);
          if (!cont && rec.count == null) break;
        }
        cursor = addDays(cursor, 1);
      }
    } else {
      for (let i = 0; i < MAX_ITER; i++) {
        const cursor = rec.freq === "monthly" ? addMonths(anchor, i) : addYears(anchor, i);
        const dateStr = format(cursor, "yyyy-MM-dd");
        if (rec.until && dateStr > rec.until) break;
        if (rec.count != null && emitted >= rec.count) break;
        if (getDate(cursor) === anchorDom) {
          emitted += 1;
          const cont = emit(dateStr);
          if (!cont && rec.count == null) break;
        }
      }
    }
  }

  out.sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0));
  return out;
}
