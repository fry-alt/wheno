import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getEventsInRange } from "@/lib/events/queries";
import { getDayNotes } from "@/lib/notes/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { getUiPreferences } from "@/lib/preferences";
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
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#3b82f6] text-xl font-bold text-white">w</span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const monthParam = readSearchParam(params.month);
  const monthStr = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : formatInTimeZone(new Date(), user.timezone, "yyyy-MM");

  const monthDate = parseISO(`${monthStr}-01`);
  const { start, end } = getDateRangeUtc(
    format(startOfMonth(monthDate), "yyyy-MM-dd"),
    format(endOfMonth(monthDate), "yyyy-MM-dd"),
    user.timezone,
  );
  const [events, dayNotes] = await Promise.all([
    getEventsInRange(user.id, start, end),
    getDayNotes(user.id),
  ]);

  return <CalendarScreen events={events} dayNotes={dayNotes} monthStr={monthStr} timezone={user.timezone} />;
}
