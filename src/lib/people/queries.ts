import { getAdminSupabase } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/profile/queries";
import { blockedUserIds } from "@/lib/safety/queries";
import { getDisplayName } from "@/lib/utils";
import { rankPeople, type PeopleCandidate, type PeopleMatch } from "./match";

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
};

async function fetchUsers(ids: string[]): Promise<Map<string, { name: string; photo_url: string | null }>> {
  const map = new Map<string, { name: string; photo_url: string | null }>();
  if (ids.length === 0) return map;
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("users")
    .select("id, first_name, last_name, username, photo_url")
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const u of (data ?? []) as UserRow[]) {
    map.set(u.id, { name: getDisplayName(u), photo_url: u.photo_url });
  }
  return map;
}

/** Friends + pending requests in either direction — people we shouldn't re-suggest. */
async function relatedUserIds(userId: string): Promise<Set<string>> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of (data ?? []) as { requester_id: string; addressee_id: string }[]) {
    set.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
  }
  return set;
}

export async function getPeopleMatches(
  userId: string,
): Promise<{ matches: PeopleMatch[]; hasInterests: boolean }> {
  const me = await getProfile(userId);
  if (me.interests.length === 0) return { matches: [], hasInterests: false };

  const admin = getAdminSupabase();
  const [related, blocked, profilesRes] = await Promise.all([
    relatedUserIds(userId),
    blockedUserIds(userId),
    admin.from("profiles").select("user_id, interests, city").limit(500),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const candidateProfiles = ((profilesRes.data ?? []) as { user_id: string; interests: string[] | null; city: string | null }[])
    .filter((p) => p.user_id !== userId && !related.has(p.user_id) && !blocked.has(p.user_id) && (p.interests?.length ?? 0) > 0);

  const users = await fetchUsers(candidateProfiles.map((p) => p.user_id));
  const candidates: PeopleCandidate[] = candidateProfiles.map((p) => ({
    user_id: p.user_id,
    name: users.get(p.user_id)?.name ?? "—",
    photo_url: users.get(p.user_id)?.photo_url ?? null,
    interests: p.interests ?? [],
    city: p.city,
  }));

  return { matches: rankPeople({ interests: me.interests, city: me.city }, candidates), hasInterests: true };
}
