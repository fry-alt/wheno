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
    <div className="flex flex-wrap gap-2">
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
    <div className="flex items-center gap-2 rounded-full border border-white/14 bg-white/8 p-1 pr-2 text-background">
      <p className="px-2 text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-white/55">
        {label}
      </p>
      <div className="flex gap-1">{children}</div>
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
        "h-9 rounded-full px-3 text-sm font-semibold transition",
        active
          ? "bg-white text-slate-950 shadow-[0_16px_28px_-20px_rgba(255,255,255,0.7)]"
          : "bg-transparent text-white/68 hover:bg-white/10 hover:text-white",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
