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

  if (!user) {
    return (
      <AppShell
        description="We'll connect your Telegram session, then load the meeting options."
        title="Loading meeting request"
      >
        <SessionBootstrap />
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
      description="Vote on the options you like, or lock in the final slot if you own the group."
      title={meeting.title}
      user={user}
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700">
              {meeting.group_name}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{meeting.title}</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {meeting.status}
          </span>
        </div>
        <p className="text-sm leading-6 text-slate-500">
          {formatDateWindow(meeting.date_from, meeting.date_to)} · {meeting.duration_minutes} min ·
          at least {meeting.min_participants} participant
          {meeting.min_participants === 1 ? "" : "s"}
        </p>
      </Card>

      {meeting.options.length ? (
        <div className="space-y-4">
          {meeting.options.map((option) => (
            <MeetingOptionCard
              isOwner={isOwner}
              isSelected={meeting.selected_option_id === option.id}
              key={option.id}
              meetingId={meeting.id}
              option={option}
              timezone={user.timezone}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          description="There are no candidate slots on this meeting request yet."
          title="No meeting options yet"
        />
      )}

      <Link
        className={buttonStyles({ fullWidth: true, variant: "secondary" })}
        href={`/groups/${meeting.group_id}`}
      >
        Back to group
      </Link>
    </AppShell>
  );
}
