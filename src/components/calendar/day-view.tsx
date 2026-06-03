"use client";

import { useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";

import { MonthGrid } from "./month-grid";
import { EventRow } from "./event-row";
import { addDayNoteAction } from "@/lib/notes/actions";
import type { EventInstance } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function DayView({
  events,
  dayNotes,
  timezone,
  monthStr,
  onEventClick,
}: {
  events: EventInstance[];
  dayNotes: Note[];
  timezone: string;
  monthStr: string;
  onEventClick: (event: EventInstance) => void;
}) {
  const router = useRouter();
  const monthDate = parseISO(`${monthStr}-01`);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const currentMonthStr = formatInTimeZone(new Date(), timezone, "yyyy-MM");

  const [selectedDate, setSelectedDate] = useState(
    monthStr === currentMonthStr ? todayStr : format(startOfMonth(monthDate), "yyyy-MM-dd"),
  );

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd"));
    return set;
  }, [events, timezone]);

  const dayEvents = useMemo(
    () => events.filter((e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === selectedDate),
    [events, timezone, selectedDate],
  );

  const selectedNote = useMemo(
    () => dayNotes.find((n) => n.date === selectedDate) ?? null,
    [dayNotes, selectedDate],
  );
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

  function navigateMonth(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(monthDate, 1) : subMonths(monthDate, 1);
    router.push(`/calendar?month=${format(next, "yyyy-MM")}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigateMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white" aria-label="Предыдущий месяц">‹</button>
        <span className="text-base font-bold text-white">{MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()}</span>
        <button onClick={() => navigateMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white" aria-label="Следующий месяц">›</button>
      </div>

      <MonthGrid monthDate={monthDate} selectedDate={selectedDate} daysWithEvents={daysWithEvents} onSelect={setSelectedDate} />

      <div className="mx-4 my-2 border-t border-[#1a1a1a]" />

      <div className="px-4 pb-3">
        {selectedNote ? (
          <p className="rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs text-[#bbb]">📌 {selectedNote.content}</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveDayNote(); }}
              placeholder="＋ заметка дня"
              className="flex-1 rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs text-white placeholder-[#555] outline-none"
            />
            {noteDraft.trim() && (
              <button onClick={saveDayNote} disabled={savingNote} className="rounded-xl bg-white px-3 text-xs font-semibold text-black disabled:opacity-50">ОК</button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4">
        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-white">Свободный день</p>
            <p className="mt-1 text-xs text-[#555]">Нажми ➕ чтобы добавить</p>
          </div>
        ) : (
          dayEvents.map((e) => <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />)
        )}
      </div>
    </div>
  );
}
