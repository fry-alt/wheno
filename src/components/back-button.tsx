"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Shows the native Telegram back button (top of the Mini App) on a sub-page and
 * navigates to `href` when tapped. Hidden again on unmount, so top-level tabs
 * never show it. No-op outside Telegram.
 */
export function BackButton({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;
    const handler = () => router.push(href);
    bb.onClick?.(handler);
    bb.show?.();
    return () => {
      bb.offClick?.(handler);
      bb.hide?.();
    };
  }, [router, href]);

  return null;
}
