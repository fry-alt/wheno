import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBusyBlockAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = decodeSearchMessage(readSearchParam(params.error));
  const groupId = readSearchParam(params.groupId) ?? "";
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppShell
        description="We need your Telegram session before we can save availability."
        title="Add busy time"
      >
        <SessionBootstrap />
      </AppShell>
    );
  }

  return (
    <AppShell
      description="Add a block you already know you can't make."
      title="Add busy time"
      user={user}
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      <Card>
        <form action={createBusyBlockAction} className="space-y-4">
          <input name="groupId" type="hidden" value={groupId} />
          <Input
            autoFocus
            id="title"
            label="Title"
            name="title"
            placeholder="Work call"
            required
          />
          <Input id="date" label="Date" name="date" required type="date" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="startTime" label="Start time" name="startTime" required type="time" />
            <Input id="endTime" label="End time" name="endTime" required type="time" />
          </div>
          <FormSubmitButton label="Save busy block" pendingLabel="Saving..." />
        </form>
      </Card>

      <Link
        className={buttonStyles({ fullWidth: true, variant: "secondary" })}
        href={groupId ? `/groups/${groupId}` : "/"}
      >
        Cancel
      </Link>
    </AppShell>
  );
}
