"use client";

import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import { deleteNoteAction } from "@/lib/notes/actions";
import type { Note } from "@/lib/notes/types";

export function DayNotes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <p className="text-xs text-[#555]">Пока нет заметок на конкретные дни.</p>;
  }
  return (
    <div className="space-y-1.5">
      {notes.map((n) => (
        <div key={n.id} className="flex items-start gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
          <span className="flex-shrink-0 text-xs font-semibold text-[#3b82f6]">
            {n.date ? format(parseISO(n.date), "d MMM", { locale: ru }) : ""}
          </span>
          <span className="min-w-0 flex-1 text-sm text-white">{n.content}</span>
          <button onClick={() => deleteNoteAction(n.id)} className="text-xs text-[#555]" aria-label="Удалить">✕</button>
        </div>
      ))}
    </div>
  );
}
