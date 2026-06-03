import { getAdminSupabase } from "@/lib/supabase/admin";
import type { CalendarEvent } from "./types";

const COLUMNS =
  "id, user_id, title, starts_at, ends_at, category, is_fixed, notes, location, recurrence, excluded_dates, created_at, updated_at";

export async function getEventsInRange(
  userId: string,
  startAt: Date,
  endAt: Date,
): Promise<CalendarEvent[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events")
    .select(COLUMNS)
    .eq("user_id", userId)
    .gte("starts_at", startAt.toISOString())
    .lt("starts_at", endAt.toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarEvent[];
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
