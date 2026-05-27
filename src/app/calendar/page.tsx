import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";

import { AppShell } from "@/components/app-shell";
import { PersonalCalendar } from "@/components/personal-calendar";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getBusyBlocksForUserInRange } from "@/lib/db/queries";
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
  const blocks = await getBusyBlocksForUserInRange({
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Link className={buttonStyles({ fullWidth: true })} href="/availability/new">
          {copy.calendar.addBusyTime}
        </Link>
        <Link className={buttonStyles({ fullWidth: true, variant: "secondary" })} href="/">
          {copy.common.backHome}
        </Link>
      </div>

      <PersonalCalendar
        blocks={blocks}
        copy={copy.calendar}
        language={language}
        timezone={user.timezone}
        weekStart={weekStart}
      />
    </AppShell>
  );
}
