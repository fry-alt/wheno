import { getDateRangeUtc } from "@/lib/datetime";
import { getEventsInRange } from "@/lib/events/queries";
import { findSlots } from "@/lib/advisor/find-slots";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { CalendarEvent } from "@/lib/events/types";
import type { ProposedSlot, SlotRequest } from "@/lib/advisor/types";

/** Overlap of two "HH:mm" day-hour windows, or null if they don't overlap. */
export function intersectDayHours(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start >= end) return null;
  return { start, end };
}

type DayPrefs = { day_start: string; day_end: string; timezone: string };

async function getDayPrefs(userId: string): Promise<DayPrefs> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("users")
    .select("day_start, day_end, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = (data as DayPrefs | null) ?? null;
  return {
    day_start: row?.day_start ?? "08:00",
    day_end: row?.day_end ?? "22:00",
    timezone: row?.timezone ?? "Europe/Amsterdam",
  };
}

/**
 * Find slots free for BOTH users within the request window.
 * v1: assumes a shared timezone — search runs in the initiator's timezone
 * and the intersection of both working-hour windows.
 */
export async function findMutualSlots(
  initiatorId: string,
  friendId: string,
  request: SlotRequest,
): Promise<ProposedSlot[]> {
  const [me, friend] = await Promise.all([getDayPrefs(initiatorId), getDayPrefs(friendId)]);
  const hours = intersectDayHours(me.day_start, me.day_end, friend.day_start, friend.day_end);
  if (!hours) return [];

  const { start, end } = getDateRangeUtc(request.window.from, request.window.to, me.timezone);
  const [myEvents, friendEvents] = await Promise.all([
    getEventsInRange(initiatorId, start, end, me.timezone),
    getEventsInRange(friendId, start, end, me.timezone),
  ]);
  const busy = [...myEvents, ...friendEvents] as CalendarEvent[];

  return findSlots(request, busy, hours, me.timezone);
}
