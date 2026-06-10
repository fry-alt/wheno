"use client";

import { useMemo, useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";

import { MonthView } from "./month-view";
import { ScopeDialog } from "./scope-dialog";
import { CaptureSheet } from "@/components/capture/capture-sheet";
import { AdvisorSheet } from "@/components/advisor/advisor-sheet";
import type { CalendarView } from "@/lib/calendar/views";
import type { EventInstance } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";
import type { RecurringEdit } from "@/components/capture/event-form";

export function CalendarScreen({
  view,
  anchor,
  events,
  dayNotes,
  timezone,
  dayStart,
  dayEnd,
}: {
  view: CalendarView;
  anchor: string; // yyyy-MM-dd
  events: EventInstance[];
  dayNotes: Note[];
  timezone: string;
  dayStart: string;
  dayEnd: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(anchor);
  const [editing, setEditing] = useState<EventInstance | null>(null);
  const [recurringEdit, setRecurringEdit] = useState<RecurringEdit | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [scopeFor, setScopeFor] = useState<EventInstance | null>(null);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd"));
    return set;
  }, [events, timezone]);

  const dayEvents = useMemo(
    () => events.filter((e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === selectedDate),
    [events, timezone, selectedDate],
  );

  function pushView(nextView: CalendarView, nextDate: string) {
    router.push(`/calendar?view=${nextView}&date=${nextDate}`);
  }

  function navigateMonth(dir: 1 | -1) {
    const base = parseISO(`${anchor.slice(0, 7)}-01`);
    const next = dir === 1 ? addMonths(base, 1) : subMonths(base, 1);
    pushView("month", format(next, "yyyy-MM-01"));
  }

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
      {view === "month" ? (
        <MonthView
          dayNotes={dayNotes}
          timezone={timezone}
          anchorMonth={anchor.slice(0, 7)}
          selectedDate={selectedDate}
          daysWithEvents={daysWithEvents}
          dayEvents={dayEvents}
          onSelectDate={setSelectedDate}
          onNavigateMonth={navigateMonth}
          onEventClick={onEventClick}
        />
      ) : (
        <div className="px-4 py-16 text-center text-sm text-muted">Скоро…</div>
      )}

      <button onClick={() => setAdvisorOpen(true)} className="fixed bottom-44 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-card-strong text-2xl shadow-lg" aria-label="Найти время">✨</button>
      <button onClick={() => { setEditing(null); setRecurringEdit(null); setSheetOpen(true); }} className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground shadow-lg" aria-label="Добавить">+</button>

      {sheetOpen && (
        <CaptureSheet timezone={timezone} defaultDate={selectedDate || todayStr} editing={editing} recurringEdit={recurringEdit} onClose={closeSheet} />
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
