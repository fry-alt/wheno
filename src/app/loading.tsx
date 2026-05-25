import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";

export default async function Loading() {
  const { language, theme } = await getUiPreferences();
  const copy = getTranslations(language);

  return (
    <AppShell
      description={copy.loading.description}
      language={language}
      theme={theme}
      title={copy.loading.title}
    >
      <LoadingState description={copy.loading.description} title={copy.loading.title} />
    </AppShell>
  );
}
