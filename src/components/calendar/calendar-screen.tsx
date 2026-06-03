"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { DayView } from "./day-view";
import { ScopeDialog } from "./scope-dialog";
import { CaptureSheet } from "@/components/capture/capture-sheet";
import { AdvisorSheet } from "@/components/advisor/advisor-sheet";
import type { EventInstance } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";
import type { RecurringEdit } from "@/components/capture/event-form";

export function CalendarScreen({
  events,
  dayNotes,
  monthStr,
  timezone,
  dayStart,
  dayEnd,
}: {
  events: EventInstance[];
  dayNotes: Note[];
  monthStr: string;
  timezone: string;
  dayStart: string;
  dayEnd: string;
}) {
  const [editing, setEditing] = useState<EventInstance | null>(null);
  const [recurringEdit, setRecurringEdit] = useState<RecurringEdit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [scopeFor, setScopeFor] = useState<EventInstance | null>(null);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  function openEditor(instance: EventInstance, scope: "one" | "all" | null) {
    setEditing(instance);
    setRecurringEdit(
      scope && instance.series_id && instance.occurrence_date
        ? { seriesId: instance.series_id, occurrenceDate: instance.occurrence_date, scope }
        : null,
    );
    setSheetOpen(true);
  }

  function onEventClick(instance: EventInstance) {
    if (instance.series_id) setScopeFor(instance);
    else openEditor(instance, null);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
    setRecurringEdit(null);
  }

  return (
    <>
      <DayView events={events} dayNotes={dayNotes} monthStr={monthStr} timezone={timezone} onEventClick={onEventClick} />

      <button onClick={() => setAdvisorOpen(true)} className="fixed bottom-44 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-2xl shadow-lg" aria-label="Найти время">✨</button>
      <button onClick={() => { setEditing(null); setRecurringEdit(null); setSheetOpen(true); }} className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg" aria-label="Добавить">+</button>

      {sheetOpen && (
        <CaptureSheet
          timezone={timezone}
          defaultDate={todayStr}
          editing={editing}
          recurringEdit={recurringEdit}
          onClose={closeSheet}
        />
      )}
      {advisorOpen && (
        <AdvisorSheet timezone={timezone} dayStart={dayStart} dayEnd={dayEnd} onClose={() => setAdvisorOpen(false)} />
      )}
      {scopeFor && (
        <ScopeDialog
          title="Это событие или вся серия?"
          onOne={() => { const i = scopeFor; setScopeFor(null); openEditor(i, "one"); }}
          onAll={() => { const i = scopeFor; setScopeFor(null); openEditor(i, "all"); }}
          onCancel={() => setScopeFor(null)}
        />
      )}
    </>
  );
}
