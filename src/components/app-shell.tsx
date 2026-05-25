import type { ReactNode } from "react";

import { PreferenceControls } from "@/components/preference-controls";
import { getTranslations } from "@/lib/i18n";
import type { Language, Theme } from "@/lib/preferences-shared";
import type { AppUser } from "@/lib/types";
import { getDisplayName, getInitials } from "@/lib/utils";

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
    <div className="relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-5 sm:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_var(--glow-start),_transparent_68%)]" />

      <main className="relative mx-auto w-full max-w-xl">
        <section className="overflow-hidden rounded-[34px] border border-border/70 bg-card-strong px-5 py-5 shadow-[0_36px_90px_-50px_rgba(8,20,39,0.7)] backdrop-blur">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_48%)]" />

          <div className="relative space-y-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-muted">
                    {copy.shell.productLabel}
                  </p>
                  <div className="inline-flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-foreground text-xl font-semibold text-background shadow-[0_20px_50px_-30px_rgba(8,20,39,0.8)]">
                      w
                    </div>
                    <div>
                      <p className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground">
                        wheno
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {copy.shell.productDescription}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <PreferenceControls
                labels={copy.shell}
                language={language}
                theme={theme}
              />
            </div>

            <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-44px_rgba(8,20,39,0.55)]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.05em] text-foreground">
                    {title}
                  </h1>
                  {description ? (
                    <p className="max-w-md text-sm leading-7 text-muted sm:text-[0.96rem]">
                      {description}
                    </p>
                  ) : null}
                </div>

                {user && userLabel ? (
                  <div className="shrink-0 rounded-[24px] border border-border/70 bg-card-muted px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div>
                        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-muted">
                          {copy.shell.signedInAs}
                        </p>
                        <p className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
                          {userLabel}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-foreground text-sm font-semibold text-background">
                        {getInitials(userLabel)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 space-y-4">{children}</div>
      </main>
    </div>
  );
}
