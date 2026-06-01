import { DarkShell } from "@/components/dark-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { createGroupAction } from "@/lib/actions";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
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
  const { language } = await getUiPreferences();
  const copy = getTranslations(language);

  if (!user) {
    return (
      <DarkShell title={copy.createGroup.title} backHref="/groups">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
  }

  return (
    <DarkShell title={copy.createGroup.title} backHref="/groups">
      {error ? (
        <Card className="border-danger/35 bg-danger-soft text-sm text-danger">{error}</Card>
      ) : null}
      <Card>
        <form action={createGroupAction} className="space-y-4">
          <Input
            autoFocus
            id="name"
            label={copy.createGroup.nameLabel}
            name="name"
            placeholder={copy.createGroup.namePlaceholder}
            required
          />
          <FormSubmitButton
            label={copy.createGroup.submit}
            pendingLabel={copy.createGroup.pending}
          />
        </form>
      </Card>
    </DarkShell>
  );
}
