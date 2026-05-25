import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { createGroupAction } from "@/lib/actions";
import { decodeSearchMessage, readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CreateGroupPage({
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
        description="We need your Telegram session before we can create a group."
        title="Create a group"
      >
        <SessionBootstrap />
      </AppShell>
    );
  }

  return (
    <AppShell
      description="Pick a short name your friends will recognize."
      title="Create a group"
      user={user}
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      <Card>
        <form action={createGroupAction} className="space-y-4">
          <Input
            autoFocus
            id="name"
            label="Group name"
            name="name"
            placeholder="Friday dinner crew"
            required
          />
          <FormSubmitButton label="Create" pendingLabel="Creating group..." />
        </form>
      </Card>

      <Link className={buttonStyles({ fullWidth: true, variant: "secondary" })} href="/">
        Back home
      </Link>
    </AppShell>
  );
}
