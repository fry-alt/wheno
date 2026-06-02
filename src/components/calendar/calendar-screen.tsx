"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { DayView } from "./day-view";
import { CaptureSheet } from "@/components/capture/capture-sheet";
import { AdvisorSheet } from "@/components/advisor/advisor-sheet";
import type { CalendarEvent } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";

export function CalendarScreen({
  events,
  dayNotes,
  monthStr,
  timezone,
  dayStart,
  dayEnd,
}: {
  events: CalendarEvent[];
  dayNotes: Note[];
  monthStr: string;
  timezone: string;
  dayStart: string;
  dayEnd: string;
}) {
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  return (
    <>
      <DayView
        events={events}
        dayNotes={dayNotes}
        monthStr={monthStr}
        timezone={timezone}
        onEventClick={(e) => { setEditing(e); setSheetOpen(true); }}
      />
      <button
        onClick={() => setAdvisorOpen(true)}
        className="fixed bottom-44 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-2xl shadow-lg"
        aria-label="Найти время"
      >
        ✨
      </button>
      <button
        onClick={() => { setEditing(null); setSheetOpen(true); }}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg"
        aria-label="Добавить"
      >
        +
      </button>
      {sheetOpen && (
        <CaptureSheet
          timezone={timezone}
          defaultDate={todayStr}
          editing={editing}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
      {advisorOpen && (
        <AdvisorSheet
          timezone={timezone}
          dayStart={dayStart}
          dayEnd={dayEnd}
          onClose={() => setAdvisorOpen(false)}
        />
      )}
    </>
  );
}
