import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { joinGroupAction } from "@/lib/actions";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
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
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <AppShell
        description={copy.join.splashDescription}
        language={language}
        theme={theme}
        title={copy.join.title}
      >
        <SessionBootstrap language={language} />
      </AppShell>
    );
  }

  return (
    <AppShell
      description={copy.join.description}
      language={language}
      theme={theme}
      title={copy.join.title}
      user={user}
    >
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}

      <Card>
        <form action={joinGroupAction} className="space-y-4">
          <Input
            autoComplete="off"
            autoFocus
            defaultValue={inviteCode.toUpperCase()}
            id="inviteCode"
            label={copy.join.codeLabel}
            name="inviteCode"
            placeholder={copy.join.codePlaceholder}
            required
          />
          <FormSubmitButton label={copy.join.submit} pendingLabel={copy.join.pending} />
        </form>
      </Card>

      <Link className={buttonStyles({ fullWidth: true, variant: "secondary" })} href="/">
        {copy.common.backHome}
      </Link>
    </AppShell>
  );
}
