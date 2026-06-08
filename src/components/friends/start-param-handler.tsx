"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function readInviteCode(): string | null {
  const tgParam = (window as unknown as {
    Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } };
  }).Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (tgParam) return tgParam;
  const fromQuery = new URLSearchParams(window.location.search).get("invite");
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

export function StartParamHandler() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const code = readInviteCode();
    if (!code) return;
    void (async () => {
      try {
        await fetch("/api/friend-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
      } catch {
        // ignore — a stale/invalid link simply does nothing
      } finally {
        router.replace("/friends");
        router.refresh();
      }
    })();
  }, [router]);

  return null;
}
