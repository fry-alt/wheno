import { getAdminSupabase } from "@/lib/supabase/admin";

export interface DueReminder {
  id: string;
  user_id: string;
  title: string;
  starts_at: string;
}

/** One-off (non-recurring) events starting within the lead window that haven't been pinged. */
export async function dueReminders(nowIso: string, withinMinutes: number): Promise<DueReminder[]> {
  const admin = getAdminSupabase();
  const cutoff = new Date(new Date(nowIso).getTime() + withinMinutes * 60_000).toISOString();
  const { data, error } = await admin
    .from("events")
    .select("id, user_id, title, starts_at")
    .is("recurrence", null)
    .is("reminded_at", null)
    .gt("starts_at", nowIso)
    .lte("starts_at", cutoff)
    .order("starts_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as DueReminder[];
}

export async function markReminded(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("events")
    .update({ reminded_at: new Date().toISOString() })
    .in("id", eventIds);
  if (error) throw new Error(error.message);
}
