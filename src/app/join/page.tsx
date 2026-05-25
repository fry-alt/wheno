import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { joinGroupAction } from "@/lib/actions";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = decodeSearchMessage(readSearchParam(params.error));
  const inviteCode = readSearchParam(params.code) ?? "";
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppShell
        description="We'll connect your Telegram session, then you can join with a code."
        title="Join a group"
      >
        <SessionBootstrap />
      </AppShell>
    );
  }

  return (
    <AppShell
      description="Paste the invite code your friend shared with you."
      title="Join a group"
      user={user}
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      <Card>
        <form action={joinGroupAction} className="space-y-4">
          <Input
            autoComplete="off"
            autoFocus
            defaultValue={inviteCode.toUpperCase()}
            id="inviteCode"
            label="Invite code"
            name="inviteCode"
            placeholder="AB12CD"
            required
          />
          <FormSubmitButton label="Join" pendingLabel="Joining group..." />
        </form>
      </Card>

      <Link className={buttonStyles({ fullWidth: true, variant: "secondary" })} href="/">
        Back home
      </Link>
    </AppShell>
  );
}
