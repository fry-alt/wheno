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

  if (!user) {
    return (
      <AppShell
        description="We'll connect your Telegram session, then load this group."
        title="Loading group"
      >
        <SessionBootstrap />
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
      description="Invite friends, add busy blocks, and start a meeting request when everyone is in."
      title={group.name}
      user={user}
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700">
              Invite code
            </p>
            <h3 className="mt-1 text-2xl font-semibold tracking-[0.08em] text-slate-900">
              {group.invite_code}
            </h3>
          </div>
          <CopyInviteButton inviteLink={inviteLink} />
        </div>
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          Share this link: <span className="font-medium text-slate-900">{inviteLink}</span>
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          className={buttonStyles({ fullWidth: true, variant: "secondary" })}
          href={`/availability/new?groupId=${group.id}`}
        >
          Add busy time
        </Link>
        {isOwner ? (
          <Link className={buttonStyles({ fullWidth: true })} href={`/groups/${group.id}/find-time`}>
            Find time
          </Link>
        ) : null}
      </div>

      <MemberList members={group.members} />

      {group.meeting_requests.length ? (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Meeting requests</h3>
            <span className="text-sm text-slate-500">{group.meeting_requests.length} total</span>
          </div>
          <div className="mt-4 space-y-3">
            {group.meeting_requests.map((meeting) => (
              <Link
                className="block rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                href={`/meetings/${meeting.id}`}
                key={meeting.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{meeting.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {meeting.date_from} to {meeting.date_to} · {meeting.duration_minutes} min
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {meeting.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          actionHref={isOwner ? `/groups/${group.id}/find-time` : undefined}
          actionLabel={isOwner ? "Create a meeting request" : undefined}
          description={
            isOwner
              ? "Once everyone has added a few busy times, ask wheno to suggest the best slots."
              : "The group owner can create a meeting request once everyone has shared availability."
          }
          title="No meeting requests yet"
        />
      )}

      <Link className={buttonStyles({ fullWidth: true, variant: "secondary" })} href="/">
        Back home
      </Link>
    </AppShell>
  );
}
