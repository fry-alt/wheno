import { formatInTimeZone } from "date-fns-tz";

import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getEventsInRange } from "@/lib/events/queries";
import { getDayNotes } from "@/lib/notes/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { getUiPreferences } from "@/lib/preferences";
import { getViewRange, isCalendarView, type CalendarView } from "@/lib/calendar/views";
import { readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent text-xl font-bold text-accent-foreground">w</span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const viewParam = readSearchParam(params.view);
  const view: CalendarView = isCalendarView(viewParam) ? viewParam : "month";

  // anchor: ?date=YYYY-MM-DD, legacy ?month=YYYY-MM → first of month, else today.
  const dateParam = readSearchParam(params.date);
  const monthParam = readSearchParam(params.month);
  const anchor =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? `${monthParam}-01`
        : formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");

  const range = getViewRange(view, anchor);
  const [events, dayNotes] = await Promise.all([
    range
      ? getEventsInRange(user.id, ...rangeToUtc(range, user.timezone), user.timezone)
      : Promise.resolve([]),
    view === "year" ? Promise.resolve([]) : getDayNotes(user.id),
  ]);

  return (
    <CalendarScreen
      view={view}
      anchor={anchor}
      events={events}
      dayNotes={dayNotes}
      timezone={user.timezone}
      dayStart={user.day_start || "08:00"}
      dayEnd={user.day_end || "22:00"}
    />
  );
}

function rangeToUtc(range: { dateFrom: string; dateTo: string }, tz: string): [Date, Date] {
  const { start, end } = getDateRangeUtc(range.dateFrom, range.dateTo, tz);
  return [start, end];
}
