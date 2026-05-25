"use client";

import { startTransition, useState, type ReactNode } from "react";
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
    themeLabel: string;
    languageLabel: string;
    themeLight: string;
    themeDark: string;
    languageEnglish: string;
    languageRussian: string;
  };
}) {
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState(theme);
  const [activeLanguage, setActiveLanguage] = useState(language);

  function refreshShell() {
    startTransition(() => {
      router.refresh();
    });
  }

  function setTheme(nextTheme: Theme) {
    if (nextTheme === activeTheme) {
      return;
    }

    setActiveTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    writePreference(THEME_COOKIE_NAME, nextTheme);
    refreshShell();
  }

  function setLanguage(nextLanguage: Language) {
    if (nextLanguage === activeLanguage) {
      return;
    }

    setActiveLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage;
    writePreference(LANGUAGE_COOKIE_NAME, nextLanguage);
    refreshShell();
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PreferenceGroup label={labels.themeLabel}>
        <PreferenceButton
          active={activeTheme === "light"}
          label={labels.themeLight}
          onClick={() => setTheme("light")}
        />
        <PreferenceButton
          active={activeTheme === "dark"}
          label={labels.themeDark}
          onClick={() => setTheme("dark")}
        />
      </PreferenceGroup>

      <PreferenceGroup label={labels.languageLabel}>
        <PreferenceButton
          active={activeLanguage === "en"}
          label={labels.languageEnglish}
          onClick={() => setLanguage("en")}
        />
        <PreferenceButton
          active={activeLanguage === "ru"}
          label={labels.languageRussian}
          onClick={() => setLanguage("ru")}
        />
      </PreferenceGroup>
    </div>
  );
}

function PreferenceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-card-muted/80 p-2">
      <p className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function PreferenceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "h-10 rounded-2xl px-3 text-sm font-semibold transition",
        active
          ? "bg-foreground text-background shadow-[0_18px_40px_-24px_rgba(8,20,39,0.75)]"
          : "bg-transparent text-muted hover:bg-background/70 hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
