"use client";

import { useState } from "react";

import { addTaskAction, toggleTaskAction, deleteNoteAction } from "@/lib/notes/actions";
import type { Note } from "@/lib/notes/types";

export function TaskList({ tasks }: { tasks: Note[] }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setPending(true);
    try {
      await addTaskAction(text);
      setText("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Новая задача"
          className="flex-1 rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none"
        />
        <button onClick={add} disabled={pending} className="rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-50">+</button>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <button onClick={() => toggleTaskAction(t.id, !t.done)} className="text-base" aria-label="Отметить">
              {t.done ? "☑" : "☐"}
            </button>
            <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-[#555] line-through" : "text-white"}`}>{t.content}</span>
            <button onClick={() => deleteNoteAction(t.id)} className="text-xs text-[#555]" aria-label="Удалить">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
