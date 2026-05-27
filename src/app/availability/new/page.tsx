import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { AvailabilityForm } from "@/components/availability-form";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

      <AvailabilityForm
        copy={copy.availability}
        defaultDate={getLocalDateValue(user.timezone)}
        defaultEndDate={getLocalDateValue(user.timezone, 28)}
        groupId={groupId}
        language={language}
      />

      <Link
        className={buttonStyles({ fullWidth: true, variant: "secondary" })}
        href={groupId ? `/groups/${groupId}` : "/"}
      >
        {groupId ? copy.common.backToGroup : copy.common.cancel}
      </Link>
    </AppShell>
  );
}
