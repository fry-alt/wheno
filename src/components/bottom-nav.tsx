"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const tab = (href: string) => pathname.startsWith(href);
  const cls = (active: boolean) => ({ color: active ? "#fff" : "#555" });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#1a1a1a] bg-[#0f0f0f] px-6 py-2">
      <Link href="/calendar" className="flex flex-col items-center gap-0.5 text-[10px]" style={cls(tab("/calendar"))}>
        <span className="text-lg">📅</span>
        Календарь
      </Link>
      <Link href="/friends" className="flex flex-col items-center gap-0.5 text-[10px]" style={cls(tab("/friends"))}>
        <span className="text-lg">👥</span>
        Друзья
      </Link>
      <Link href="/notes" className="flex flex-col items-center gap-0.5 text-[10px]" style={cls(tab("/notes"))}>
        <span className="text-lg">📝</span>
        Заметки
      </Link>
    </nav>
  );
}
