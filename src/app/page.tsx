import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getGroupsForUser } from "@/lib/db/queries";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = decodeSearchMessage(readSearchParam(params.error));
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppShell
        description="We'll connect your Telegram profile, then load your groups."
        title="Find the best time together"
      >
        {error ? (
          <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
        ) : null}
        <SessionBootstrap />
      </AppShell>
    );
  }

  const groups = await getGroupsForUser(user.id);

  return (
    <AppShell
      description="Create a group, share the invite, add busy times, and let wheno suggest the best slots."
      title="Your groups"
      user={user}
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link className={buttonStyles({ fullWidth: true })} href="/groups/new">
          Create group
        </Link>
        <Link
          className={buttonStyles({ fullWidth: true, variant: "secondary" })}
          href="/join"
        >
          Join group
        </Link>
      </div>

      {groups.length ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard group={group} key={group.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          actionHref="/groups/new"
          actionLabel="Create your first group"
          description="Start with one friend group, then invite everyone with a short code."
          title="No groups yet"
        />
      )}
    </AppShell>
  );
}
