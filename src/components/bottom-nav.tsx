"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const isCalendar = pathname.startsWith("/calendar");
  const isNotes = pathname.startsWith("/notes");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#1a1a1a] bg-[#0f0f0f] px-6 py-2">
      <Link href="/calendar" className="flex flex-col items-center gap-0.5 text-[10px]" style={{ color: isCalendar ? "#fff" : "#555" }}>
        <span className="text-lg">📅</span>
        Календарь
      </Link>
      <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-bold text-black" aria-label="Добавить">+</button>
      <Link href="/notes" className="flex flex-col items-center gap-0.5 text-[10px]" style={{ color: isNotes ? "#fff" : "#555" }}>
        <span className="text-lg">📝</span>
        Заметки
      </Link>
    </nav>
  );
}
