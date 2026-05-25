export type Theme = "light" | "dark";
export type Language = "en" | "ru";

export const THEME_COOKIE_NAME = "wheno_theme";
export const LANGUAGE_COOKIE_NAME = "wheno_language";
export const DEFAULT_THEME: Theme = "light";
export const DEFAULT_LANGUAGE: Language = "en";

export function parseTheme(value?: string | null): Theme {
  return value === "dark" ? "dark" : DEFAULT_THEME;
}

export function parseLanguage(value?: string | null): Language {
  return value === "ru" ? "ru" : DEFAULT_LANGUAGE;
}

export function isTheme(value: string): value is Theme {
  return value === "light" || value === "dark";
}

export function isLanguage(value: string): value is Language {
  return value === "en" || value === "ru";
}
