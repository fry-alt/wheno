import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export type CalendarView = "month" | "week" | "year";

export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "year"];

export function isCalendarView(v: string | undefined): v is CalendarView {
  return v === "month" || v === "week" || v === "year";
}

/** Inclusive day-string bounds for the fetch range; null for year (no events). */
export function getViewRange(
  view: CalendarView,
  anchorISO: string,
): { dateFrom: string; dateTo: string } | null {
  if (view === "year") return null;
  const anchor = parseISO(anchorISO);
  const start = view === "week" ? startOfWeek(anchor, { weekStartsOn: 1 }) : startOfMonth(anchor);
  const end = view === "week" ? endOfWeek(anchor, { weekStartsOn: 1 }) : endOfMonth(anchor);
  return { dateFrom: format(start, "yyyy-MM-dd"), dateTo: format(end, "yyyy-MM-dd") };
}

/** The 7 Mon..Sun days of the week containing `anchor`. */
export function buildWeek(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
