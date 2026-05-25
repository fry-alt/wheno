"use client";

import { useEffect, useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLocalizedErrorMessage, getTranslations } from "@/lib/i18n";
import type { Language, Theme } from "@/lib/preferences-shared";

function getDocumentPreferences(): { language: Language; theme: Theme } {
  if (typeof document === "undefined") {
    return {
      language: "en" as Language,
      theme: "light" as Theme,
    };
  }

  return {
    language: document.documentElement.lang === "ru" ? "ru" : "en",
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  };
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const preferences = useMemo(() => getDocumentPreferences(), []);
  const copy = getTranslations(preferences.language);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={preferences.language}>
      <body>
        <AppShell
          description={copy.errorPage.description}
          language={preferences.language}
          theme={preferences.theme}
          title={copy.errorPage.title}
        >
          <Card className="space-y-4 text-center">
            <p className="text-sm leading-7 text-muted">
              {getLocalizedErrorMessage(error, preferences.language)}
            </p>
            <Button fullWidth onClick={reset}>
              {copy.common.tryAgain}
            </Button>
          </Card>
        </AppShell>
      </body>
    </html>
  );
}
