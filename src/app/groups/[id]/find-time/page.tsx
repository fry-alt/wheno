import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createMeetingRequestAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getGroupDetailForUser } from "@/lib/db/queries";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FindTimePage({
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
        description="We'll connect your Telegram session, then load the scheduler."
        title="Find time"
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

  return (
    <AppShell
      description="Set a date range and let wheno suggest the strongest common slots."
      title={`Find time for ${group.name}`}
      user={user}
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      {!isOwner ? (
        <Card className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Only the group owner can create a meeting request for this group.
          </p>
          <Link
            className={buttonStyles({ fullWidth: true, variant: "secondary" })}
            href={`/groups/${group.id}`}
          >
            Back to group
          </Link>
        </Card>
      ) : (
        <>
          <Card className="space-y-2">
            <p className="text-sm text-slate-500">
              {group.members.length} member{group.members.length === 1 ? "" : "s"} available to consider.
            </p>
            <p className="text-sm text-slate-500">
              Minimum participants cannot be higher than {group.members.length}.
            </p>
          </Card>

          <Card>
            <form action={createMeetingRequestAction} className="space-y-4">
              <input name="groupId" type="hidden" value={group.id} />
              <Input
                autoFocus
                id="title"
                label="Meeting title"
                name="title"
                placeholder="Dinner next week"
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input id="dateFrom" label="From" name="dateFrom" required type="date" />
                <Input id="dateTo" label="To" name="dateTo" required type="date" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="durationMinutes"
                  label="Duration (minutes)"
                  min="30"
                  name="durationMinutes"
                  required
                  step="30"
                  type="number"
                />
                <Input
                  id="minParticipants"
                  label="Minimum participants"
                  max={String(group.members.length)}
                  min="1"
                  name="minParticipants"
                  required
                  type="number"
                />
              </div>
              <Select
                defaultValue="any"
                id="preferredTime"
                label="Preferred time of day"
                name="preferredTime"
              >
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </Select>
              <FormSubmitButton label="Find the best slots" pendingLabel="Calculating..." />
            </form>
          </Card>
        </>
      )}

      <Link
        className={buttonStyles({ fullWidth: true, variant: "secondary" })}
        href={`/groups/${group.id}`}
      >
        Back to group
      </Link>
    </AppShell>
  );
}
