"use client";

import { useEffect, useState } from "react";
import {
  expandViewport,
  init,
  isTMA,
  miniApp,
  retrieveRawInitData,
} from "@telegram-apps/sdk";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/preferences-shared";

type Status = "loading" | "error";

function getTelegramInitDataRaw() {
  const webAppInitData = window.Telegram?.WebApp?.initData?.trim();

  if (webAppInitData) {
    return webAppInitData;
  }

  try {
    const sdkInitData = retrieveRawInitData()?.trim();

    if (sdkInitData) {
      return sdkInitData;
    }
  } catch {
    // Outside Telegram Mini Apps the SDK lookup can throw.
  }

  return undefined;
}

export function SessionBootstrap({ language }: { language: Language }) {
  const router = useRouter();
  const copy = getTranslations(language);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState(copy.session.checkingProfile);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!cancelled) {
        setStatus("loading");
        setMessage(copy.session.checkingProfile);
      }

      try {
        init();

        if (miniApp.mountSync.isAvailable()) {
          miniApp.mountSync();
        }

        if (miniApp.ready.isAvailable()) {
          miniApp.ready();
        }

        if (expandViewport.isAvailable()) {
          expandViewport();
        }
      } catch {
        // The SDK can throw outside Telegram. Dev fallback continues below.
      }

      try {
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
        const initDataRaw = getTelegramInitDataRaw();
        const launchedInMiniApp = isTMA();

        const response = await fetch("/api/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initDataRaw,
            timezone,
            isTMA: launchedInMiniApp,
            language,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;

          throw new Error(payload?.error || "We could not open your wheno session.");
        }

        if (!cancelled) {
          router.refresh();
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "We could not open your wheno session.",
          );
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [copy.session.checkingProfile, language, router]);

  if (status === "loading") {
    return <LoadingState description={message} title={copy.session.opening} />;
  }

  return (
    <Card className="space-y-4 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{copy.session.errorTitle}</h2>
        <p className="text-sm leading-7 text-muted">{message}</p>
      </div>
      <Button fullWidth onClick={() => window.location.reload()}>
        {copy.common.tryAgain}
      </Button>
    </Card>
  );
}
