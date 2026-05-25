import { cookies } from "next/headers";

import {
  LANGUAGE_COOKIE_NAME,
  THEME_COOKIE_NAME,
  parseLanguage,
  parseTheme,
} from "@/lib/preferences-shared";

export type { Language, Theme } from "@/lib/preferences-shared";

export async function getUiPreferences() {
  const cookieStore = await cookies();

  return {
    theme: parseTheme(cookieStore.get(THEME_COOKIE_NAME)?.value),
    language: parseLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value),
  };
}

export function getPreferenceCookieConfig() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 365,
  };
}
