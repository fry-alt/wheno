import { randomInt } from "node:crypto";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDisplayName } from "@/lib/utils";
import type { Friendship, FriendSummary, IncomingRequest } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");
}

export async function ensureInviteCodeForUser(userId: string): Promise<string> {
  const admin = getAdminSupabase();
  const { data } = await admin.from("users").select("invite_code").eq("id", userId).maybeSingle();
  const existing = (data as { invite_code: string | null } | null)?.invite_code;
  if (existing) return existing;
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode();
    const { error } = await admin.from("users").update({ invite_code: code }).eq("id", userId);
    if (!error) return code;
  }
  throw new Error("Could not generate invite code");
}

export async function findUserIdByInviteCode(code: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("users").select("id").eq("invite_code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function findFriendshipBetween(a: string, b: string): Promise<Friendship | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("friendships")
    .select("*")
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Friendship | null) ?? null;
}

export async function createPendingRequest(requesterId: string, addresseeId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "pending" });
  if (error) throw new Error(error.message);
}

export async function acceptRequest(userId: string, friendshipId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function declineRequest(userId: string, friendshipId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .eq("addressee_id", userId);
  if (error) throw new Error(error.message);
}

export async function removeFriendship(userId: string, friendshipId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw new Error(error.message);
}

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  telegram_id: string;
};

async function fetchUsers(ids: string[]): Promise<Map<string, UserRow>> {
  if (ids.length === 0) return new Map();
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("users")
    .select("id, first_name, last_name, username, photo_url, telegram_id")
    .in("id", ids);
  return new Map(((data ?? []) as UserRow[]).map((u) => [u.id, u]));
}

export async function listFriends(userId: string): Promise<FriendSummary[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("friendships")
    .select("*")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Friendship[];
  const otherIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  const users = await fetchUsers(otherIds);
  return rows.map((r) => {
    const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
    const u = users.get(otherId);
    return {
      user_id: otherId,
      name: u ? getDisplayName(u) : "Друг",
      username: u?.username ?? null,
      photo_url: u?.photo_url ?? null,
      friendship_id: r.id,
    };
  });
}

export async function listIncomingRequests(userId: string): Promise<IncomingRequest[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("friendships")
    .select("*")
    .eq("status", "pending")
    .eq("addressee_id", userId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Friendship[];
  const users = await fetchUsers(rows.map((r) => r.requester_id));
  return rows.map((r) => {
    const u = users.get(r.requester_id);
    return {
      friendship_id: r.id,
      from_user_id: r.requester_id,
      name: u ? getDisplayName(u) : "Кто-то",
      username: u?.username ?? null,
      photo_url: u?.photo_url ?? null,
    };
  });
}
