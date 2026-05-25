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
import { getLocalDateValue } from "@/lib/datetime";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
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
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <AppShell
        description={copy.findTime.splashDescription}
        language={language}
        theme={theme}
        title={copy.findTime.title}
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

  return (
    <AppShell
      description={copy.findTime.description}
      language={language}
      theme={theme}
      title={`${copy.findTime.title}: ${group.name}`}
      user={user}
    >
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}

      {!isOwner ? (
        <Card className="space-y-4">
          <p className="text-sm leading-7 text-muted">{copy.findTime.ownerOnly}</p>
          <Link
            className={buttonStyles({ fullWidth: true, variant: "secondary" })}
            href={`/groups/${group.id}`}
          >
            {copy.common.backToGroup}
          </Link>
        </Card>
      ) : (
        <>
          <Card className="space-y-2">
            <p className="text-sm text-muted">{copy.findTime.membersAvailable(group.members.length)}</p>
            <p className="text-sm text-muted">{copy.findTime.membersLimit(group.members.length)}</p>
          </Card>

          <Card>
            <form action={createMeetingRequestAction} className="space-y-4">
              <input name="groupId" type="hidden" value={group.id} />
              <Input
                autoFocus
                id="title"
                label={copy.findTime.titleLabel}
                name="title"
                placeholder={copy.findTime.titlePlaceholder}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  defaultValue={getLocalDateValue(user.timezone)}
                  id="dateFrom"
                  label={copy.findTime.fromLabel}
                  name="dateFrom"
                  required
                  type="date"
                />
                <Input
                  defaultValue={getLocalDateValue(user.timezone, 7)}
                  id="dateTo"
                  label={copy.findTime.toLabel}
                  name="dateTo"
                  required
                  type="date"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  defaultValue="60"
                  id="durationMinutes"
                  label={copy.findTime.durationLabel}
                  min="30"
                  name="durationMinutes"
                  required
                  step="30"
                  type="number"
                />
                <Input
                  defaultValue={String(Math.min(Math.max(group.members.length, 1), 2))}
                  id="minParticipants"
                  label={copy.findTime.minParticipantsLabel}
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
                label={copy.findTime.preferredTimeLabel}
                name="preferredTime"
              >
                <option value="any">{copy.findTime.anyTime}</option>
                <option value="morning">{copy.findTime.morning}</option>
                <option value="afternoon">{copy.findTime.afternoon}</option>
                <option value="evening">{copy.findTime.evening}</option>
              </Select>
              <FormSubmitButton label={copy.findTime.submit} pendingLabel={copy.findTime.pending} />
            </form>
          </Card>
        </>
      )}

      <Link
        className={buttonStyles({ fullWidth: true, variant: "secondary" })}
        href={`/groups/${group.id}`}
      >
        {copy.common.backToGroup}
      </Link>
    </AppShell>
  );
}
