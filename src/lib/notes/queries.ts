import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Note } from "./types";

const COLUMNS = "id, user_id, content, date, done, created_at";

export async function getTasks(userId: string): Promise<Note[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("notes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .is("date", null)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Note[];
}

export async function getDayNotes(userId: string): Promise<Note[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("notes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .not("date", "is", null)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Note[];
}

export async function getNoteForDate(userId: string, date: string): Promise<Note | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("notes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Note | null) ?? null;
}

export async function insertNote(note: {
  user_id: string;
  content: string;
  date: string | null;
}): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notes").insert(note);
  if (error) throw new Error(error.message);
}

export async function setNoteDone(userId: string, id: string, done: boolean): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notes").update({ done }).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteNoteById(userId: string, id: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notes").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
