"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const TABS = [
  { href: "/calendar", emoji: "📅", label: "Календарь" },
  { href: "/friends", emoji: "👥", label: "Друзья" },
  { href: "/notes", emoji: "📝", label: "Заметки" },
  { href: "/profile", emoji: "👤", label: "Профиль" },
  { href: "/activities", emoji: "🤸", label: "Движ" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/90 px-6 py-2 backdrop-blur">
      {TABS.map(({ href, emoji, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx("flex flex-col items-center gap-0.5 text-[10px] transition", active ? "text-foreground" : "text-muted")}
          >
            <span className="text-lg">{emoji}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
