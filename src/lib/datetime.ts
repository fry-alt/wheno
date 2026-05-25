import { addDays, format, parseISO } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { Language } from "@/lib/preferences-shared";
import { normalizeTimezone } from "@/lib/telegram";

function getLocale(language: Language) {
  return language === "ru" ? ru : enUS;
}

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

export function getLocalDateValue(timezone: string, offsetDays = 0) {
  return formatInTimeZone(
    addDays(new Date(), offsetDays),
    normalizeTimezone(timezone),
    "yyyy-MM-dd",
  );
}

export function formatSlotDateTime(
  startAt: string,
  endAt: string,
  timezone: string,
  language: Language,
) {
  const normalizedTimezone = normalizeTimezone(timezone);
  const locale = getLocale(language);

  return {
    date: formatInTimeZone(startAt, normalizedTimezone, "EEE, MMM d", { locale }),
    time: `${formatInTimeZone(startAt, normalizedTimezone, "HH:mm")} - ${formatInTimeZone(
      endAt,
      normalizedTimezone,
      "HH:mm",
    )}`,
  };
}

export function formatDateWindow(dateFrom: string, dateTo: string, language: Language) {
  const start = parseISO(dateFrom);
  const end = parseISO(dateTo);
  const locale = getLocale(language);

  if (dateFrom === dateTo) {
    return format(start, "MMM d", { locale });
  }

  return `${format(start, "MMM d", { locale })} - ${format(end, "MMM d", { locale })}`;
}
