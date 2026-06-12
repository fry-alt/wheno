import { getAdminSupabase } from "@/lib/supabase/admin";

export interface AdminStats {
  usersTotal: number;
  usersNew24h: number;
  usersNew7d: number;
  dau: number;
  wau: number;
  eventsTotal: number;
  events7d: number;
  activitiesTotal: number;
  activities7d: number;
  participations: number;
  friendsAccepted: number;
  requestsPending: number;
  meetings: number;
  reports: number;
  blocks: number;
}

type CountResult = PromiseLike<{ count: number | null; error: { message: string } | null }>;

async function cnt(qb: CountResult): Promise<number> {
  const { count, error } = await qb;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getAdminStats(): Promise<AdminStats> {
  const admin = getAdminSupabase();
  const now = Date.now();
  const d1 = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const head = (table: string) => admin.from(table).select("*", { count: "exact", head: true });

  const [
    usersTotal, usersNew24h, usersNew7d, dau, wau,
    eventsTotal, events7d, activitiesTotal, activities7d, participations,
    friendsAccepted, requestsPending, meetings, reports, blocks,
  ] = await Promise.all([
    cnt(head("users")),
    cnt(head("users").gte("created_at", d1)),
    cnt(head("users").gte("created_at", d7)),
    cnt(head("users").gte("updated_at", d1)),
    cnt(head("users").gte("updated_at", d7)),
    cnt(head("events")),
    cnt(head("events").gte("created_at", d7)),
    cnt(head("activities")),
    cnt(head("activities").gte("created_at", d7)),
    cnt(head("activity_participants")),
    cnt(head("friendships").eq("status", "accepted")),
    cnt(head("friendships").eq("status", "pending")),
    cnt(head("meeting_proposals")),
    cnt(head("activity_reports")),
    cnt(head("user_blocks")),
  ]);

  return {
    usersTotal, usersNew24h, usersNew7d, dau, wau,
    eventsTotal, events7d, activitiesTotal, activities7d, participations,
    friendsAccepted, requestsPending, meetings, reports, blocks,
  };
}
