import type { ReactNode } from "react";
import Link from "next/link";

export function DarkShell({
  title,
  backHref,
  action,
  children,
}: {
  title: string;
  backHref?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl font-light text-white"
            >
              ‹
            </Link>
          ) : null}
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        {action ?? null}
      </header>
      <main className="space-y-3 px-4 pb-8 pt-2">{children}</main>
    </div>
  );
}
