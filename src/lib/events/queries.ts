import { getAdminSupabase } from "@/lib/supabase/admin";
import { expandEvents } from "./recurrence";
import type { CalendarEvent, EventInstance, Recurrence } from "./types";

const COLUMNS =
  "id, user_id, title, starts_at, ends_at, category, is_fixed, notes, location, recurrence, excluded_dates, created_at, updated_at";

export async function getEventsInRange(
  userId: string,
  startAt: Date,
  endAt: Date,
  timezone: string,
): Promise<EventInstance[]> {
  const admin = getAdminSupabase();

  const [oneOff, recurring] = await Promise.all([
    admin
      .from("events")
      .select(COLUMNS)
      .eq("user_id", userId)
      .is("recurrence", null)
      .gte("starts_at", startAt.toISOString())
      .lt("starts_at", endAt.toISOString()),
    admin
      .from("events")
      .select(COLUMNS)
      .eq("user_id", userId)
      .not("recurrence", "is", null),
  ]);

  if (oneOff.error) throw new Error(oneOff.error.message);
  if (recurring.error) throw new Error(recurring.error.message);

  const rows = [...(oneOff.data ?? []), ...(recurring.data ?? [])] as CalendarEvent[];
  return expandEvents(rows, startAt, endAt, timezone);
}

export interface NewEvent {
  user_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  category: string;
  is_fixed: boolean;
  notes: string | null;
  location: string | null;
  recurrence?: Recurrence | null;
  excluded_dates?: string[];
}

export async function insertEvent(event: NewEvent): Promise<string> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events")
    .insert(event as unknown as Record<string, unknown>)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to insert event");
  return (data as { id: string }).id;
}

export async function updateEventById(
  userId: string,
  id: string,
  patch: Partial<Omit<NewEvent, "user_id">>,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("events")
    .update({ ...patch, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteEventById(userId: string, id: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("events").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getEventById(userId: string, id: string): Promise<CalendarEvent | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CalendarEvent | null) ?? null;
}

export async function addExcludedDate(userId: string, seriesId: string, date: string): Promise<void> {
  const series = await getEventById(userId, seriesId);
  if (!series) return;
  const next = Array.from(new Set([...(series.excluded_dates ?? []), date]));
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("events")
    .update({ excluded_dates: next } as unknown as Record<string, unknown>)
    .eq("id", seriesId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function updateSeries(
  userId: string,
  seriesId: string,
  patch: Partial<Omit<NewEvent, "user_id">>,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("events")
    .update({ ...patch, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>)
    .eq("id", seriesId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
