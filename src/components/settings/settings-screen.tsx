"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Segmented } from "@/components/ui/segmented";
import { SectionLabel } from "@/components/ui/section-label";
import { haptic } from "@/lib/haptics";
import { updatePreferences } from "@/app/(app)/settings/actions";
import type { LanguagePref, ThemePref } from "@/lib/preferences-shared";

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "Система" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];

const LANG_OPTIONS: { value: LanguagePref; label: string }[] = [
  { value: "system", label: "Система" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export function SettingsScreen({
  themePref,
  languagePref,
  isAdmin = false,
}: {
  themePref: ThemePref;
  languagePref: LanguagePref;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [theme, setTheme] = useState<ThemePref>(themePref);
  const [language, setLanguage] = useState<LanguagePref>(languagePref);

  function pickTheme(value: ThemePref) {
    haptic.selection();
    setTheme(value);
    start(async () => {
      await updatePreferences({ theme: value });
      router.refresh();
    });
  }

  function pickLanguage(value: LanguagePref) {
    haptic.selection();
    setLanguage(value);
    start(async () => {
      await updatePreferences({ language: value });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-8 animate-[fadeRise_300ms_ease-out]">
      <h1 className="text-2xl font-bold text-foreground">Настройки</h1>

      <section className="flex flex-col gap-2">
        <SectionLabel>Тема</SectionLabel>
        <Segmented options={THEME_OPTIONS} value={theme} onChange={pickTheme} />
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Язык</SectionLabel>
        <Segmented options={LANG_OPTIONS} value={language} onChange={pickLanguage} />
        <p className="text-xs text-muted">
          Большая часть интерфейса пока на русском — переключатель влияет на язык приложения и
          системные сообщения.
        </p>
      </section>

      {isAdmin && (
        <Link href="/admin" className="rounded-xl border border-border bg-card py-3 text-center text-sm font-semibold text-foreground transition active:scale-[0.99]">
          📊 Админка
        </Link>
      )}
    </div>
  );
}
