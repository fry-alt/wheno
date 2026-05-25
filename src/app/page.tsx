import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { GroupCard } from "@/components/group-card";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getGroupsForUser } from "@/lib/db/queries";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
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
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <AppShell
        description={copy.home.splashDescription}
        language={language}
        theme={theme}
        title={copy.home.splashTitle}
      >
        {error ? (
          <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
        ) : null}
        <SessionBootstrap language={language} />
      </AppShell>
    );
  }

  const groups = await getGroupsForUser(user.id);

  return (
    <AppShell
      description={copy.home.description}
      language={language}
      theme={theme}
      title={copy.home.title}
      user={user}
    >
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link className={buttonStyles({ fullWidth: true })} href="/groups/new">
          {copy.home.createGroup}
        </Link>
        <Link
          className={buttonStyles({ fullWidth: true, variant: "secondary" })}
          href="/join"
        >
          {copy.home.joinGroup}
        </Link>
      </div>

      {groups.length ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard group={group} key={group.id} language={language} />
          ))}
        </div>
      ) : (
        <EmptyState
          actionHref="/groups/new"
          actionLabel={copy.home.emptyAction}
          description={copy.home.emptyDescription}
          title={copy.home.emptyTitle}
        />
      )}
    </AppShell>
  );
}
