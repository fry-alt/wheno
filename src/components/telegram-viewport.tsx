"use client";

import { useEffect } from "react";

/**
 * Keeps the Telegram Mini App expanded and — crucially — disables Telegram's
 * vertical-swipe gesture so swipes scroll the page content instead of being
 * captured to minimise/close the app. The setting resets on a hard reload, so
 * this runs on every page (mounted in the root layout), not just at launch.
 */
export function TelegramViewport() {
  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;
    wa.ready?.();
    wa.expand?.();
    wa.disableVerticalSwipes?.();
  }, []);

  return null;
}
