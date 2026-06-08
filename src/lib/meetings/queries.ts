import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDisplayName } from "@/lib/utils";
import type {
  AwaitingPick,
  IncomingMeeting,
  MeetingProposal,
  MeetingStatus,
} from "./types";

const COLUMNS =
  "id, from_user_id, to_user_id, title, category, duration_min, window_from, window_to, part_of_day, status, starts_at, ends_at, created_at";

type NewProposal = {
  from_user_id: string;
  to_user_id: string;
  title: string;
  category: string;
  duration_min: number;
  window_from: string;
  window_to: string;
  part_of_day: string;
};

export async function createProposal(input: NewProposal): Promise<string> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .insert(input as unknown as Record<string, unknown>)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create proposal");
  return (data as { id: string }).id;
}

export async function getProposal(id: string): Promise<MeetingProposal | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MeetingProposal | null) ?? null;
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

export async function listIncomingMeetings(userId: string): Promise<IncomingMeeting[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .select(COLUMNS)
    .eq("to_user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MeetingProposal[];
  const users = await fetchUsers(rows.map((r) => r.from_user_id));
  return rows.map((r) => {
    const u = users.get(r.from_user_id);
    return {
      proposal_id: r.id,
      from_name: u ? getDisplayName(u) : "Кто-то",
      from_photo_url: u?.photo_url ?? null,
      title: r.title,
      duration_min: r.duration_min,
      window_from: r.window_from,
      window_to: r.window_to,
      part_of_day: r.part_of_day,
    };
  });
}

export async function listAwaitingPick(userId: string): Promise<AwaitingPick[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_proposals")
    .select(COLUMNS)
    .eq("from_user_id", userId)
    .eq("status", "accepted");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MeetingProposal[];
  const users = await fetchUsers(rows.map((r) => r.to_user_id));
  return rows.map((r) => {
    const u = users.get(r.to_user_id);
    return {
      proposal_id: r.id,
      to_name: u ? getDisplayName(u) : "Друг",
      to_photo_url: u?.photo_url ?? null,
      title: r.title,
      duration_min: r.duration_min,
    };
  });
}

/** Receiver-scoped transition from `pending`. Matches no row if not allowed. */
export async function setIncomingStatus(
  userId: string,
  proposalId: string,
  status: Extract<MeetingStatus, "accepted" | "declined">,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("meeting_proposals")
    .update({ status })
    .eq("id", proposalId)
    .eq("to_user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

/** Initiator-scoped: stamp the chosen slot and mark confirmed, from `accepted`. */
export async function confirmProposalSlot(
  userId: string,
  proposalId: string,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("meeting_proposals")
    .update({ status: "confirmed", starts_at: startsAt, ends_at: endsAt })
    .eq("id", proposalId)
    .eq("from_user_id", userId)
    .eq("status", "accepted");
  if (error) throw new Error(error.message);
}
