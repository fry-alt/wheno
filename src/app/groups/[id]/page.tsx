import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { EmptyState } from "@/components/empty-state";
import { MemberList } from "@/components/member-list";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getGroupDetailForUser } from "@/lib/db/queries";
import { formatDateWindow } from "@/lib/datetime";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
import { buildInviteLink, decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GroupDetailPage({
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
        description={copy.group.splashDescription}
        language={language}
        theme={theme}
        title={copy.group.loadingTitle}
      >
        <SessionBootstrap language={language} />
      </AppShell>
    );
  }

  const group = await getGroupDetailForUser(id, user.id);

  if (!group) {
    notFound();
  }

  const isOwner = group.owner_id === user.id;
  const inviteLink = buildInviteLink(group.invite_code);

  return (
    <AppShell
      description={copy.group.description}
      language={language}
      theme={theme}
      title={group.name}
      user={user}
    >
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
              {copy.common.inviteCode}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[0.22em] text-foreground">
              {group.invite_code}
            </h3>
          </div>
          <CopyInviteButton
            inviteLink={inviteLink}
            labels={{
              defaultLabel: copy.common.copyInviteLink,
              copiedLabel: copy.common.linkCopied,
              unavailableLabel: copy.common.copyUnavailable,
              shareLabel: copy.common.shareLink,
            }}
          />
        </div>
        <p className="rounded-[22px] border border-border/60 bg-card-muted px-4 py-3 text-sm leading-7 text-muted">
          {copy.common.shareThisLink}:{" "}
          <span className="break-all font-medium text-foreground">{inviteLink}</span>
        </p>
      </Card>

      <div className={`grid gap-3 ${isOwner ? "sm:grid-cols-2" : ""}`}>
        <Link
          className={buttonStyles({ fullWidth: true, variant: "secondary" })}
          href={`/availability/new?groupId=${group.id}`}
        >
          {copy.group.addBusyTime}
        </Link>
        {isOwner ? (
          <Link className={buttonStyles({ fullWidth: true })} href={`/groups/${group.id}/find-time`}>
            {copy.group.findTime}
          </Link>
        ) : null}
      </div>

      <MemberList language={language} members={group.members} />

      {group.meeting_requests.length ? (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              {copy.group.meetingRequestsTitle}
            </h3>
            <span className="text-sm text-muted">
              {group.meeting_requests.length} {copy.common.total}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {group.meeting_requests.map((meeting) => (
              <Link
                className="block rounded-[24px] border border-border/60 bg-card-muted px-4 py-4 transition duration-200 hover:bg-card-strong"
                href={`/meetings/${meeting.id}`}
                key={meeting.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{meeting.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {formatDateWindow(meeting.date_from, meeting.date_to, language)} ·{" "}
                      {meeting.duration_minutes} {copy.common.minuteShort}
                    </p>
                  </div>
                  <span className="rounded-full bg-card-strong px-3 py-1 text-xs font-semibold text-muted ring-1 ring-border/80">
                    {meeting.status === "selected" ? copy.common.selected : copy.common.open}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          actionHref={isOwner ? `/groups/${group.id}/find-time` : undefined}
          actionLabel={isOwner ? copy.group.createMeetingRequest : undefined}
          description={
            isOwner
              ? copy.group.noMeetingsOwnerDescription
              : copy.group.noMeetingsMemberDescription
          }
          title={copy.group.noMeetingsTitle}
        />
      )}

      <Link className={buttonStyles({ fullWidth: true, variant: "secondary" })} href="/">
        {copy.common.backHome}
      </Link>
    </AppShell>
  );
}
