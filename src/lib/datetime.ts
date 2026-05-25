import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { normalizeTimezone } from "@/lib/telegram";

export function toUtcDateFromLocalParts(
  date: string,
  time: string,
  timezone: string,
) {
  return fromZonedTime(`${date}T${time}:00`, normalizeTimezone(timezone));
}

export function getDateRangeUtc(
  dateFrom: string,
  dateTo: string,
  timezone: string,
) {
  const normalizedTimezone = normalizeTimezone(timezone);
  const start = toUtcDateFromLocalParts(dateFrom, "00:00", normalizedTimezone);
  const nextDate = format(addDays(parseISO(dateTo), 1), "yyyy-MM-dd");
  const end = toUtcDateFromLocalParts(nextDate, "00:00", normalizedTimezone);

  return { start, end };
}

export function formatSlotDateTime(startAt: string, endAt: string, timezone: string) {
  const normalizedTimezone = normalizeTimezone(timezone);

  return {
    date: formatInTimeZone(startAt, normalizedTimezone, "EEE, MMM d"),
    time: `${formatInTimeZone(startAt, normalizedTimezone, "HH:mm")} - ${formatInTimeZone(
      endAt,
      normalizedTimezone,
      "HH:mm",
    )}`,
  };
}

export function formatDateWindow(dateFrom: string, dateTo: string) {
  const start = parseISO(dateFrom);
  const end = parseISO(dateTo);

  if (dateFrom === dateTo) {
    return format(start, "MMM d");
  }

  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
}
