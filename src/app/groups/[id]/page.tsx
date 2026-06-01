import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";

import { DarkShell } from "@/components/dark-shell";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { EmptyState } from "@/components/empty-state";
import { GroupAvailabilityCalendar } from "@/components/group-availability-calendar";
import { InlineAvailabilityGrid } from "@/components/inline-availability-grid";
import { MemberList } from "@/components/member-list";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import {
  getBusyBlocksForUsersInRange,
  getGroupDetailForUser,
  getInlineBusyCells,
} from "@/lib/db/queries";
import { formatDateWindow, getDateRangeUtc, getLocalDateValue } from "@/lib/datetime";
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
  const { language } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <DarkShell title={copy.group.loadingTitle} backHref="/groups">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
  }

  const group = await getGroupDetailForUser(id, user.id);

  if (!group) {
    notFound();
  }

  const isOwner = group.owner_id === user.id;
  const inviteLink = buildInviteLink(group.invite_code);
  const weekStart = getLocalDateValue(user.timezone);
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const { start, end } = getDateRangeUtc(weekStart, weekEnd, user.timezone);

  const [busyBlocks, inlineCells] = await Promise.all([
    getBusyBlocksForUsersInRange({
      userIds: group.members.map((m) => m.user_id),
      startAt: start,
      endAt: end,
    }),
    getInlineBusyCells(user.id, weekStart, user.timezone),
  ]);

  return (
    <DarkShell title={group.name} backHref="/groups">
      {error ? (
        <Card className="border-danger/40 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}

      {/* ── Invite card ── */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted">
              {copy.common.inviteCode}
            </p>
            <p className="mt-0.5 font-mono text-xl font-bold tracking-[0.25em] text-foreground">
              {group.invite_code}
            </p>
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
        <p className="rounded-xl bg-card-muted px-3 py-2 text-xs leading-relaxed text-muted">
          {copy.common.shareThisLink}:{" "}
          <span className="break-all font-medium text-foreground">{inviteLink}</span>
        </p>
      </Card>

      {/* ── Quick actions ── */}
      <div className={`grid gap-2 ${isOwner ? "grid-cols-2" : "grid-cols-1"}`}>
        {isOwner ? (
          <Link className={buttonStyles({ fullWidth: true })} href={`/groups/${group.id}/find-time`}>
            {copy.group.findTime}
          </Link>
        ) : null}
        <Link
          className={buttonStyles({ fullWidth: true, variant: "secondary" })}
          href={`/availability/new?groupId=${group.id}`}
        >
          {copy.group.addBusyTime}
        </Link>
      </div>

      {/* ── Members ── */}
      <MemberList language={language} members={group.members} />

      {/* ── My inline availability grid ── */}
      <Card>
        <InlineAvailabilityGrid
          copy={copy.group}
          groupId={group.id}
          initialCells={inlineCells}
          language={language}
          weekStart={weekStart}
        />
      </Card>

      {/* ── Group availability overview ── */}
      <GroupAvailabilityCalendar
        blocks={busyBlocks}
        copy={copy.group}
        language={language}
        members={group.members}
        timezone={user.timezone}
        weekStart={weekStart}
      />

      {/* ── Meeting requests ── */}
      {group.meeting_requests.length ? (
        <Card>
          <div className="flex items-center justify-between pb-3">
            <h3 className="font-semibold text-foreground">{copy.group.meetingRequestsTitle}</h3>
            <span className="text-xs text-muted">
              {group.meeting_requests.length} {copy.common.total}
            </span>
          </div>
          <div className="space-y-2">
            {group.meeting_requests.map((meeting) => (
              <Link
                className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card-muted px-3 py-3 transition-colors hover:bg-card-strong"
                href={`/meetings/${meeting.id}`}
                key={meeting.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{meeting.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateWindow(meeting.date_from, meeting.date_to, language)} ·{" "}
                    {meeting.duration_minutes} {copy.common.minuteShort}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${
                    meeting.status === "selected"
                      ? "bg-success-soft text-success"
                      : "bg-card-strong text-muted"
                  }`}
                >
                  {meeting.status === "selected" ? copy.common.selected : copy.common.open}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          actionHref={isOwner ? `/groups/${group.id}/find-time` : undefined}
          actionLabel={isOwner ? copy.group.createMeetingRequest : undefined}
          description={
            isOwner ? copy.group.noMeetingsOwnerDescription : copy.group.noMeetingsMemberDescription
          }
          title={copy.group.noMeetingsTitle}
        />
      )}

      <Link className={buttonStyles({ fullWidth: true, variant: "secondary" })} href="/">
        {copy.common.backHome}
      </Link>
    </DarkShell>
  );
}
