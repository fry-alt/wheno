"use client";

import { DayView } from "./day-view";
import type { CalendarEvent } from "@/lib/events/types";

export function CalendarScreen({
  events,
  monthStr,
  timezone,
}: {
  events: CalendarEvent[];
  monthStr: string;
  timezone: string;
}) {
  return (
    <DayView
      events={events}
      monthStr={monthStr}
      timezone={timezone}
      onEventClick={() => {}}
    />
  );
}
