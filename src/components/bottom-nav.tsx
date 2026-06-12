"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const TABS = [
  { href: "/calendar", emoji: "📅", label: "Календарь" },
  { href: "/friends", emoji: "👥", label: "Друзья" },
  { href: "/activities", emoji: "📍", label: "События" },
  { href: "/profile", emoji: "👤", label: "Профиль" },
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
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative flex flex-col items-center gap-0.5 text-[10px] transition-colors duration-200 active:scale-95",
              active ? "text-accent" : "text-muted",
            )}
          >
            <span
              className={clsx(
                "text-lg transition-transform duration-200 ease-out",
                active ? "-translate-y-0.5 scale-110" : "scale-100",
              )}
            >
              {emoji}
            </span>
            {label}
            <span
              className={clsx(
                "absolute -bottom-1 h-1 w-1 rounded-full bg-accent transition-all duration-200",
                active ? "scale-100 opacity-100" : "scale-0 opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
