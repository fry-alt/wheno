import type { ReactNode } from "react";

import type { AppUser } from "@/lib/types";
import { getDisplayName } from "@/lib/utils";

export function AppShell({
  title,
  description,
  user,
  children,
}: {
  title: string;
  description?: string;
  user?: AppUser | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_32%),linear-gradient(180deg,_#f7faff_0%,_#eef3fb_100%)] px-4 py-6 text-slate-900">
      <main className="mx-auto w-full max-w-lg">
        <div className="mb-5 rounded-[30px] bg-slate-950 px-5 py-4 text-white shadow-[0_28px_60px_-28px_rgba(15,23,42,0.8)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-200">telegram mini app</p>
              <h1 className="text-2xl font-semibold tracking-tight">wheno</h1>
            </div>
            {user ? (
              <div className="rounded-2xl bg-white/10 px-3 py-2 text-right text-xs">
                <p className="text-blue-100">signed in as</p>
                <p className="font-semibold text-white">{getDisplayName(user)}</p>
              </div>
            ) : null}
          </div>
        </div>

        <header className="mb-5 space-y-2 px-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
          {description ? (
            <p className="text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
        </header>

        <div className="space-y-4">{children}</div>
      </main>
    </div>
  );
}
