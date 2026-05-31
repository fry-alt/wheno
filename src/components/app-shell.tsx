import type { ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { PreferenceControls } from "@/components/preference-controls";
import { getTranslations } from "@/lib/i18n";
import type { Language, Theme } from "@/lib/preferences-shared";
import type { AppUser } from "@/lib/types";
import { getDisplayName } from "@/lib/utils";

export function AppShell({
  title,
  description,
  language,
  theme,
  user,
  children,
}: {
  title: string;
  description?: string;
  language: Language;
  theme: Theme;
  user?: AppUser | null;
  children: ReactNode;
}) {
  const copy = getTranslations(language);
  const userLabel = user ? getDisplayName(user) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-accent-foreground">
            w
          </span>
          <span className="text-base font-semibold text-foreground">wheno</span>
        </div>

        <div className="flex items-center gap-2">
          <PreferenceControls labels={copy.shell} language={language} theme={theme} />
          {user && userLabel ? (
            <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card-muted px-2 py-1">
              <Avatar label={userLabel} size="xs" src={user.photo_url} />
              <span className="max-w-[7rem] truncate text-xs font-medium text-muted">
                {userLabel}
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto w-full max-w-xl px-4 pb-8 pt-5">
        <div className="mb-5 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>

        <div className="space-y-3">{children}</div>
      </main>
    </div>
  );
}
