export type Theme = "light" | "dark";
export type Language = "en" | "ru";
export type ThemePref = "system" | Theme;
export type LanguagePref = "system" | Language;

export const THEME_COOKIE_NAME = "wheno_theme";
export const LANGUAGE_COOKIE_NAME = "wheno_language";
// Client-written hints carrying the Telegram system theme / language.
export const SYS_THEME_COOKIE_NAME = "wheno_sys_theme";
export const SYS_LANG_COOKIE_NAME = "wheno_sys_lang";

export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_LANGUAGE: Language = "en";

// ── Stored preferences (cookie → pref). Default is "system". ──────────────────
export function parseThemePref(value?: string | null): ThemePref {
  return value === "light" || value === "dark" ? value : "system";
}

export function parseLanguagePref(value?: string | null): LanguagePref {
  return value === "en" || value === "ru" ? value : "system";
}

// ── Client hint cookies (Telegram system values). Invalid → null. ─────────────
export function parseSysTheme(value?: string | null): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function parseSysLanguage(value?: string | null): Language | null {
  return value === "en" || value === "ru" ? value : null;
}

// ── Resolution: pref + system hint → concrete value. ──────────────────────────
export function resolveTheme(pref: ThemePref, hint: Theme | null): Theme {
  return pref === "system" ? hint ?? DEFAULT_THEME : pref;
}

export function resolveLanguage(pref: LanguagePref, hint: Language | null): Language {
  return pref === "system" ? hint ?? DEFAULT_LANGUAGE : pref;
}

export function isTheme(value: string): value is Theme {
  return value === "light" || value === "dark";
}

export function isLanguage(value: string): value is Language {
  return value === "en" || value === "ru";
}
