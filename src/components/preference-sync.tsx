"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  SYS_THEME_COOKIE_NAME,
  SYS_LANG_COOKIE_NAME,
  type LanguagePref,
  type ThemePref,
} from "@/lib/preferences-shared";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Bridges the Telegram system theme/language into hint cookies so the server can
 * resolve a "system" preference. Applies the theme instantly (no flash); only
 * forces a refresh when a "system" language actually needs new server strings.
 */
export function PreferenceSync({
  themePref,
  languagePref,
}: {
  themePref: ThemePref;
  languagePref: LanguagePref;
}) {
  const router = useRouter();

  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    const scheme = wa?.colorScheme;
    const sysTheme = scheme === "light" || scheme === "dark" ? scheme : null;
    const langCode = wa?.initDataUnsafe?.user?.language_code?.toLowerCase();
    const sysLang = langCode ? (langCode.startsWith("ru") ? "ru" : "en") : null;

    let needRefresh = false;

    if (sysTheme) {
      if (readCookie(SYS_THEME_COOKIE_NAME) !== sysTheme) writeCookie(SYS_THEME_COOKIE_NAME, sysTheme);
      if (themePref === "system" && document.documentElement.dataset.theme !== sysTheme) {
        document.documentElement.dataset.theme = sysTheme; // apply immediately, no flash
      }
    }

    if (sysLang) {
      if (readCookie(SYS_LANG_COOKIE_NAME) !== sysLang) writeCookie(SYS_LANG_COOKIE_NAME, sysLang);
      if (languagePref === "system" && document.documentElement.lang !== sysLang) {
        needRefresh = true; // server-rendered strings depend on the language
      }
    }

    if (needRefresh) router.refresh();
  }, [router, themePref, languagePref]);

  return null;
}
