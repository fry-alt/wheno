import { getAdminSupabase } from "@/lib/supabase/admin";
import { getEventsInRange } from "@/lib/events/queries";
import { isFreeDuring } from "./state";
import { blockedUserIds } from "@/lib/safety/queries";
import type { Activity, ActivityCardData, ParticipantView } from "./types";

const DAY_MS = 86_400_000;

const COLS = "id, host_id, title, type, description, place, lat, lng, starts_at, ends_at, capacity, visibility, status, created_at";

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

async function buildCards(
  userId: string,
  activities: Activity[],
  blocked: Set<string>,
  timezone: string,
): Promise<ActivityCardData[]> {
  const visible = activities.filter((a) => !blocked.has(a.host_id));
  if (visible.length === 0) return [];
  const ids = visible.map((a) => a.id);
  const hostIds = [...new Set(visible.map((a) => a.host_id))];

  const admin = getAdminSupabase();
  const starts = visible.map((a) => a.starts_at).sort();
  const ends = visible.map((a) => a.ends_at).sort();
  // Expand recurring events too (raw `events` rows miss recurring occurrences),
  // and widen the start a day back so an event beginning just before the window
  // but overlapping an activity still counts as busy.
  const fetchStart = new Date(new Date(starts[0]).getTime() - DAY_MS);
  const fetchEnd = new Date(ends[ends.length - 1]);

  // These three reads are independent — run them in one round trip.
  const [partsRes, hosts, myEvents] = await Promise.all([
    admin.from("activity_participants").select("activity_id, user_id").in("activity_id", ids),
    fetchUsers(hostIds),
    getEventsInRange(userId, fetchStart, fetchEnd, timezone),
  ]);
  if (partsRes.error) throw new Error(partsRes.error.message);
  const countByActivity = new Map<string, number>();
  const mine = new Set<string>();
  for (const p of (partsRes.data ?? []) as { activity_id: string; user_id: string }[]) {
    countByActivity.set(p.activity_id, (countByActivity.get(p.activity_id) ?? 0) + 1);
    if (p.user_id === userId) mine.add(p.activity_id);
  }

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

export async function getFeed(userId: string, nowIso: string, timezone: string): Promise<ActivityCardData[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("activities").select(COLS)
    .gte("starts_at", nowIso).eq("status", "open").order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Activity[];
  const [friends, blocked] = await Promise.all([friendIds(userId), blockedUserIds(userId)]);
  const reachable = all.filter((a) => a.visibility === "public" || a.host_id === userId || friends.has(a.host_id));
  return buildCards(userId, reachable, blocked, timezone);
}

export async function getMine(userId: string, nowIso: string, timezone: string): Promise<ActivityCardData[]> {
  const admin = getAdminSupabase();
  const [hostedRes, pRowsRes] = await Promise.all([
    admin.from("activities").select(COLS)
      .eq("host_id", userId).gte("starts_at", nowIso).order("starts_at", { ascending: true }),
    admin.from("activity_participants").select("activity_id").eq("user_id", userId),
  ]);
  if (hostedRes.error) throw new Error(hostedRes.error.message);
  if (pRowsRes.error) throw new Error(pRowsRes.error.message);
  const hosted = hostedRes.data;
  const joinedIds = [...new Set(((pRowsRes.data ?? []) as { activity_id: string }[]).map((r) => r.activity_id))];
  let joined: Activity[] = [];
  if (joinedIds.length > 0) {
    const { data, error } = await admin.from("activities").select(COLS).in("id", joinedIds).gte("starts_at", nowIso);
    if (error) throw new Error(error.message);
    joined = (data ?? []) as Activity[];
  }
  const byId = new Map<string, Activity>();
  for (const a of [...((hosted ?? []) as Activity[]), ...joined]) byId.set(a.id, a);
  const merged = [...byId.values()].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  return buildCards(userId, merged, new Set(), timezone);
}
