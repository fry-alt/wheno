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
    <div className="relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-5 sm:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top,_var(--glow-start),_transparent_70%)]" />

      <main className="relative mx-auto w-full max-w-xl">
        <section className="rounded-[30px] bg-foreground px-5 py-5 text-background shadow-[0_28px_60px_-38px_rgba(8,20,39,0.8)]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-white/45">
                  {copy.shell.productLabel}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/10 text-xl font-semibold text-white ring-1 ring-white/12">
                    w
                  </div>
                  <div>
                    <p className="text-[1.95rem] font-semibold tracking-[-0.06em] text-white">
                      wheno
                    </p>
                    <p className="text-sm leading-6 text-white/62">{copy.shell.productDescription}</p>
                  </div>
                </div>
              </div>

              {user && userLabel ? (
                <div className="rounded-full border border-white/12 bg-white/7 px-2.5 py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar label={userLabel} size="sm" src={user.photo_url} />
                    <div className="min-w-0">
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-white/42">
                        {copy.shell.signedInAs}
                      </p>
                      <p className="max-w-[8.5rem] truncate text-sm font-semibold text-white">
                        {userLabel}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <PreferenceControls labels={copy.shell} language={language} theme={theme} />
          </div>
        </section>

        <header className="space-y-2 px-1 pb-1 pt-5">
          <h1 className="max-w-[13ch] text-[2rem] font-semibold leading-[0.98] tracking-[-0.06em] text-foreground sm:text-[2.2rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-[34rem] text-sm leading-7 text-muted sm:text-[0.97rem]">
              {description}
            </p>
          ) : null}
        </header>

        <div className="space-y-4">{children}</div>
      </main>
    </div>
  );
}
