import { getAdminSupabase } from "@/lib/supabase/admin";

export async function blockedUserIds(userId: string): Promise<Set<string>> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of (data ?? []) as { blocker_id: string; blocked_id: string }[]) {
    set.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
  }
  return set;
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("user_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function insertBlock(blockerId: string, blockedId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("user_blocks").upsert(
    { blocker_id: blockerId, blocked_id: blockedId },
    { onConflict: "blocker_id,blocked_id" },
  );
  if (error) throw new Error(error.message);
}

export async function insertReport(reporterId: string, activityId: string, reason: string | null): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("activity_reports").insert({ reporter_id: reporterId, activity_id: activityId, reason });
  if (error) throw new Error(error.message);
}
