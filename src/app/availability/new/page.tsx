import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBusyBlockAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getLocalDateValue } from "@/lib/datetime";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
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
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <AppShell
        description={copy.availability.splashDescription}
        language={language}
        theme={theme}
        title={copy.availability.title}
      >
        <SessionBootstrap language={language} />
      </AppShell>
    );
  }

  return (
    <AppShell
      description={copy.availability.description}
      language={language}
      theme={theme}
      title={copy.availability.title}
      user={user}
    >
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}

      <Card>
        <form action={createBusyBlockAction} className="space-y-4">
          <input name="groupId" type="hidden" value={groupId} />
          <Input
            autoFocus
            id="title"
            label={copy.availability.titleLabel}
            name="title"
            placeholder={copy.availability.titlePlaceholder}
            required
          />
          <Input
            defaultValue={getLocalDateValue(user.timezone)}
            id="date"
            label={copy.availability.dateLabel}
            name="date"
            required
            type="date"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              defaultValue="18:00"
              id="startTime"
              label={copy.availability.startLabel}
              name="startTime"
              required
              type="time"
            />
            <Input
              defaultValue="19:00"
              id="endTime"
              label={copy.availability.endLabel}
              name="endTime"
              required
              type="time"
            />
          </div>
          <FormSubmitButton
            label={copy.availability.submit}
            pendingLabel={copy.availability.pending}
          />
        </form>
      </Card>

      <Link
        className={buttonStyles({ fullWidth: true, variant: "secondary" })}
        href={groupId ? `/groups/${groupId}` : "/"}
      >
        {groupId ? copy.common.backToGroup : copy.common.cancel}
      </Link>
    </AppShell>
  );
}
