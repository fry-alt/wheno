import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";

export default async function NotFound() {
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  return (
    <AppShell
      description={copy.notFound.description}
      language={language}
      theme={theme}
      title={copy.notFound.title}
    >
      <EmptyState
        actionHref="/"
        actionLabel={copy.common.backHome}
        description={copy.notFound.emptyDescription}
        title={copy.notFound.emptyTitle}
      />
    </AppShell>
  );
}
