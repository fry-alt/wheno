"use client";

import { useEffect, useState } from "react";
import { expandViewport, init, isTMA, miniApp } from "@telegram-apps/sdk";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Status = "loading" | "error";

export function SessionBootstrap() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Checking your Telegram profile.");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
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
        const webApp = window.Telegram?.WebApp;
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";

        const response = await fetch("/api/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initDataRaw: webApp?.initData || undefined,
            timezone,
            isTMA: isTMA(),
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
  }, [router]);

  if (status === "loading") {
    return <LoadingState description={message} />;
  }

  return (
    <Card className="space-y-4 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">We couldn&apos;t open wheno yet</h2>
        <p className="text-sm leading-6 text-slate-500">{message}</p>
      </div>
      <Button fullWidth onClick={() => window.location.reload()}>
        Try again
      </Button>
    </Card>
  );
}
