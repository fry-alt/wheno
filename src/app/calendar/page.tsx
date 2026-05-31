import { addDays, format, parseISO } from "date-fns";

import { AppShell } from "@/components/app-shell";
import { PersonalCalendar } from "@/components/personal-calendar";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarEventsForUserInRange } from "@/lib/db/queries";
import { getDateRangeUtc, getLocalDateValue } from "@/lib/datetime";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <AppShell
        description={copy.calendar.splashDescription}
        language={language}
        theme={theme}
        title={copy.calendar.title}
      >
        <SessionBootstrap language={language} />
      </AppShell>
    );
  }

  const weekStart = getLocalDateValue(user.timezone);
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const { start, end } = getDateRangeUtc(weekStart, weekEnd, user.timezone);

  const events = await getCalendarEventsForUserInRange({
    userId: user.id,
    startAt: start,
    endAt: end,
  });

  return (
    <AppShell
      description={copy.calendar.description}
      language={language}
      theme={theme}
      title={copy.calendar.title}
      user={user}
    >
      <PersonalCalendar events={events} timezone={user.timezone} weekStart={weekStart} />
    </AppShell>
  );
}
