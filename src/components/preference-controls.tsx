"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  LANGUAGE_COOKIE_NAME,
  THEME_COOKIE_NAME,
  type Language,
  type Theme,
} from "@/lib/preferences-shared";

function writePreference(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function PreferenceControls({
  language,
  theme,
  labels,
}: {
  language: Language;
  theme: Theme;
  labels: {
    themeLight: string;
    themeDark: string;
    languageEnglish: string;
    languageRussian: string;
  };
}) {
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState(theme);
  const [activeLanguage, setActiveLanguage] = useState(language);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function setTheme(next: Theme) {
    if (next === activeTheme) return;
    setActiveTheme(next);
    document.documentElement.dataset.theme = next;
    writePreference(THEME_COOKIE_NAME, next);
    refresh();
  }

  function setLanguage(next: Language) {
    if (next === activeLanguage) return;
    setActiveLanguage(next);
    document.documentElement.lang = next;
    writePreference(LANGUAGE_COOKIE_NAME, next);
    refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {/* Language toggle */}
      <div className="flex overflow-hidden rounded-lg border border-border/70 bg-card-muted text-xs font-semibold">
        <ToggleButton active={activeLanguage === "en"} onClick={() => setLanguage("en")}>
          {labels.languageEnglish}
        </ToggleButton>
        <ToggleButton active={activeLanguage === "ru"} onClick={() => setLanguage("ru")}>
          {labels.languageRussian}
        </ToggleButton>
      </div>

      {/* Theme toggle */}
      <div className="flex overflow-hidden rounded-lg border border-border/70 bg-card-muted text-xs font-semibold">
        <ToggleButton active={activeTheme === "light"} onClick={() => setTheme("light")}>
          ☀
        </ToggleButton>
        <ToggleButton active={activeTheme === "dark"} onClick={() => setTheme("dark")}>
          ☾
        </ToggleButton>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "h-7 px-2.5 transition",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted hover:bg-card-strong hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
