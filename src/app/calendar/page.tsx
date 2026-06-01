import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { PersonalCalendar } from "@/components/personal-calendar";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarEventsForUserInRange } from "@/lib/db/queries";
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0f0f0f] p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#2481cc] text-xl font-bold text-white">
          w
        </span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const monthParam = readSearchParam(params.month);
  const monthStr =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : formatInTimeZone(new Date(), user.timezone, "yyyy-MM");

  const monthDate = parseISO(`${monthStr}-01`);
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const { start, end } = getDateRangeUtc(monthStart, monthEnd, user.timezone);

  const events = await getCalendarEventsForUserInRange({
    userId: user.id,
    startAt: start,
    endAt: end,
  });

  return (
    <PersonalCalendar events={events} monthStr={monthStr} timezone={user.timezone} />
  );
}
