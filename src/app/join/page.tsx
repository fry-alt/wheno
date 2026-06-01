// src/app/join/page.tsx
import { DarkShell } from "@/components/dark-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
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
  const { language } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <DarkShell title={copy.join.title} backHref="/groups">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
  }

  return (
    <DarkShell title={copy.join.title} backHref="/groups">
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
    </DarkShell>
  );
}
