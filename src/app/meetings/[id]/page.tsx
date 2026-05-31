import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MeetingOptionCard } from "@/components/meeting-option-card";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getMeetingDetailForUser } from "@/lib/db/queries";
import { formatDateWindow } from "@/lib/datetime";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, rawSearchParams] = await Promise.all([params, searchParams]);
  const error = decodeSearchMessage(readSearchParam(rawSearchParams.error));
  const user = await getCurrentUser();
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <AppShell
        description={copy.meeting.splashDescription}
        language={language}
        theme={theme}
        title={copy.meeting.loadingTitle}
      >
        <SessionBootstrap language={language} />
      </AppShell>
    );
  }

  const meeting = await getMeetingDetailForUser(id, user.id);

  if (!meeting) {
    notFound();
  }

  const isOwner = meeting.group_owner_id === user.id;

  return (
    <AppShell
      description={copy.meeting.description}
      language={language}
      theme={theme}
      title={meeting.title}
      user={user}
    >
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}

      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
              {meeting.group_name}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{meeting.title}</h3>
          </div>
          <span className="rounded-full bg-card-muted px-3 py-1 text-xs font-semibold text-muted">
            {meeting.status === "selected" ? copy.common.selected : copy.common.open}
          </span>
        </div>
        <p className="text-sm leading-7 text-muted">
          {copy.meeting.summary(
            formatDateWindow(meeting.date_from, meeting.date_to, language),
            meeting.duration_minutes,
            meeting.min_participants,
          )}
        </p>
      </Card>

      {meeting.options.length ? (
        <div className="space-y-4">
          {meeting.options.map((option) => (
            <MeetingOptionCard
              isOwner={isOwner}
              isSelected={meeting.selected_option_id === option.id}
              key={option.id}
              language={language}
              meetingId={meeting.id}
              option={option}
              timezone={user.timezone}
              totalMembers={meeting.member_count}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          description={copy.meeting.noOptionsDescription}
          title={copy.meeting.noOptionsTitle}
        />
      )}

      <Link
        className={buttonStyles({ fullWidth: true, variant: "secondary" })}
        href={`/groups/${meeting.group_id}`}
      >
        {copy.common.backToGroup}
      </Link>
    </AppShell>
  );
}
