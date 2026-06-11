import { getAdminSupabase } from "@/lib/supabase/admin";
import { isFreeDuring } from "./state";
import { blockedUserIds } from "@/lib/safety/queries";
import type { Activity, ActivityCardData, ParticipantView } from "./types";

const COLS = "id, host_id, title, type, description, place, starts_at, ends_at, capacity, visibility, status, created_at";

function displayName(u: { first_name: string | null; last_name: string | null; username: string | null }): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "—";
}

async function fetchUsers(ids: string[]): Promise<Map<string, { name: string; photo_url: string | null }>> {
  const map = new Map<string, { name: string; photo_url: string | null }>();
  if (ids.length === 0) return map;
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("users").select("id, first_name, last_name, username, photo_url").in("id", ids);
  if (error) throw new Error(error.message);
  for (const u of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; username: string | null; photo_url: string | null }[]) {
    map.set(u.id, { name: displayName(u), photo_url: u.photo_url });
  }
  return map;
}

async function friendIds(userId: string): Promise<Set<string>> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of (data ?? []) as { requester_id: string; addressee_id: string }[]) {
    set.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
  }
  return set;
}

export async function getActivity(id: string): Promise<Activity | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activities").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Activity | null) ?? null;
}

export async function createActivity(input: Omit<Activity, "id" | "status" | "created_at">): Promise<string> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activities").insert(input).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  return (data as { id: string }).id;
}

export async function cancelActivity(id: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("activities").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function participantRows(activityId: string): Promise<{ user_id: string; event_id: string | null }[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activity_participants").select("user_id, event_id").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as { user_id: string; event_id: string | null }[];
}

export async function participantViews(activityId: string): Promise<ParticipantView[]> {
  const rows = await participantRows(activityId);
  const users = await fetchUsers(rows.map((r) => r.user_id));
  return rows.map((r) => ({ user_id: r.user_id, name: users.get(r.user_id)?.name ?? "—", photo_url: users.get(r.user_id)?.photo_url ?? null }));
}

export async function insertParticipant(activityId: string, userId: string, eventId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("activity_participants").insert({ activity_id: activityId, user_id: userId, event_id: eventId });
  if (error) throw new Error(error.message);
}

export async function removeParticipant(activityId: string, userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activity_participants").select("event_id").eq("activity_id", activityId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const eventId = (data as { event_id: string | null } | null)?.event_id ?? null;
  const { error: delErr } = await admin.from("activity_participants").delete().eq("activity_id", activityId).eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
  return eventId;
}

async function userEventsInRange(userId: string, startIso: string, endIso: string): Promise<{ starts_at: string; ends_at: string }[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events").select("starts_at, ends_at").eq("user_id", userId)
    .lt("starts_at", endIso).gt("ends_at", startIso);
  if (error) throw new Error(error.message);
  return (data ?? []) as { starts_at: string; ends_at: string }[];
}

async function buildCards(userId: string, activities: Activity[], blocked: Set<string>): Promise<ActivityCardData[]> {
  const visible = activities.filter((a) => !blocked.has(a.host_id));
  if (visible.length === 0) return [];
  const ids = visible.map((a) => a.id);
  const hostIds = [...new Set(visible.map((a) => a.host_id))];

  const admin = getAdminSupabase();
  const { data: parts, error } = await admin.from("activity_participants").select("activity_id, user_id").in("activity_id", ids);
  if (error) throw new Error(error.message);
  const countByActivity = new Map<string, number>();
  const mine = new Set<string>();
  for (const p of (parts ?? []) as { activity_id: string; user_id: string }[]) {
    countByActivity.set(p.activity_id, (countByActivity.get(p.activity_id) ?? 0) + 1);
    if (p.user_id === userId) mine.add(p.activity_id);
  }

  const hosts = await fetchUsers(hostIds);
  const starts = visible.map((a) => a.starts_at).sort();
  const ends = visible.map((a) => a.ends_at).sort();
  const myEvents = await userEventsInRange(userId, starts[0], ends[ends.length - 1]);

  return visible.map((a) => ({
    activity: a,
    hostName: hosts.get(a.host_id)?.name ?? "—",
    hostPhoto: hosts.get(a.host_id)?.photo_url ?? null,
    count: countByActivity.get(a.id) ?? 0,
    isHost: a.host_id === userId,
    isParticipant: mine.has(a.id),
    isFree: isFreeDuring(myEvents, a.starts_at, a.ends_at),
  }));
}

export async function getFeed(userId: string, nowIso: string): Promise<ActivityCardData[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activities").select(COLS)
    .gte("starts_at", nowIso).eq("status", "open").order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Activity[];
  const friends = await friendIds(userId);
  const blocked = await blockedUserIds(userId);
  const reachable = all.filter((a) => a.visibility === "public" || a.host_id === userId || friends.has(a.host_id));
  return buildCards(userId, reachable, blocked);
}

export async function getMine(userId: string, nowIso: string): Promise<ActivityCardData[]> {
  const admin = getAdminSupabase();
  const { data: hosted, error: e1 } = await admin.from("activities").select(COLS)
    .eq("host_id", userId).gte("starts_at", nowIso).order("starts_at", { ascending: true });
  if (e1) throw new Error(e1.message);
  const { data: pRows, error: e2 } = await admin.from("activity_participants").select("activity_id").eq("user_id", userId);
  if (e2) throw new Error(e2.message);
  const joinedIds = [...new Set(((pRows ?? []) as { activity_id: string }[]).map((r) => r.activity_id))];
  let joined: Activity[] = [];
  if (joinedIds.length > 0) {
    const { data, error } = await admin.from("activities").select(COLS).in("id", joinedIds).gte("starts_at", nowIso);
    if (error) throw new Error(error.message);
    joined = (data ?? []) as Activity[];
  }
  const byId = new Map<string, Activity>();
  for (const a of [...((hosted ?? []) as Activity[]), ...joined]) byId.set(a.id, a);
  const merged = [...byId.values()].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  return buildCards(userId, merged, new Set());
}
