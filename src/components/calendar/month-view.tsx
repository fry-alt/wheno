"use client";

import { useState } from "react";
import { parseISO } from "date-fns";
import { useRouter } from "next/navigation";

import { MonthGrid } from "./month-grid";
import { EventRow } from "./event-row";
import { IconButton } from "@/components/ui/icon-button";
import { addDayNoteAction } from "@/lib/notes/actions";
import type { EventInstance } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function MonthView({
  dayNotes,
  timezone,
  anchorMonth,
  selectedDate,
  daysWithEvents,
  dayEvents,
  onSelectDate,
  onNavigateMonth,
  onEventClick,
}: {
  dayNotes: Note[];
  timezone: string;
  anchorMonth: string; // "yyyy-MM"
  selectedDate: string;
  daysWithEvents: Set<string>;
  dayEvents: EventInstance[];
  onSelectDate: (dateStr: string) => void;
  onNavigateMonth: (dir: 1 | -1) => void;
  onEventClick: (event: EventInstance) => void;
}) {
  const router = useRouter();
  const monthDate = parseISO(`${anchorMonth}-01`);
  const selectedNote = dayNotes.find((n) => n.date === selectedDate) ?? null;
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function saveDayNote() {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    try {
      await addDayNoteAction(noteDraft, selectedDate);
      setNoteDraft("");
      router.refresh();
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <IconButton onClick={() => onNavigateMonth(-1)} ariaLabel="Предыдущий месяц">‹</IconButton>
        <span className="text-base font-bold text-foreground">
          {MONTH_NAMES[monthDate.getMonth()]} <span className="tabular-nums">{monthDate.getFullYear()}</span>
        </span>
        <IconButton onClick={() => onNavigateMonth(1)} ariaLabel="Следующий месяц">›</IconButton>
      </div>

      <MonthGrid monthDate={monthDate} selectedDate={selectedDate} daysWithEvents={daysWithEvents} onSelect={onSelectDate} />

      <div className="mx-4 my-2 border-t border-border" />

      <div className="px-4 pb-3">
        {selectedNote ? (
          <p className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted">📌 {selectedNote.content}</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveDayNote(); }}
              placeholder="＋ заметка дня"
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground placeholder-muted outline-none"
            />
            {noteDraft.trim() && (
              <button onClick={saveDayNote} disabled={savingNote} className="rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground disabled:opacity-50">ОК</button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4">
        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">Свободный день</p>
            <p className="mt-1 text-xs text-muted">Нажми ➕ чтобы добавить</p>
          </div>
        ) : (
          dayEvents.map((e) => <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />)
        )}
      </div>
    </div>
  );
}
