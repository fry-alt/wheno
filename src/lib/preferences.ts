import { cookies } from "next/headers";

import {
  LANGUAGE_COOKIE_NAME,
  THEME_COOKIE_NAME,
  SYS_THEME_COOKIE_NAME,
  SYS_LANG_COOKIE_NAME,
  parseLanguagePref,
  parseThemePref,
  parseSysTheme,
  parseSysLanguage,
  resolveTheme,
  resolveLanguage,
} from "@/lib/preferences-shared";

export type { Language, Theme, ThemePref, LanguagePref } from "@/lib/preferences-shared";

export async function getUiPreferences() {
  const cookieStore = await cookies();

  const themePref = parseThemePref(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const languagePref = parseLanguagePref(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value);
  const sysTheme = parseSysTheme(cookieStore.get(SYS_THEME_COOKIE_NAME)?.value);
  const sysLang = parseSysLanguage(cookieStore.get(SYS_LANG_COOKIE_NAME)?.value);

  return {
    themePref,
    languagePref,
    theme: resolveTheme(themePref, sysTheme),
    language: resolveLanguage(languagePref, sysLang),
  };
}

export function getPreferenceCookieConfig() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 365,
  };
}
