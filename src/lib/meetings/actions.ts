"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { assertFriends } from "@/lib/friends/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { deleteEventById, getEventsInRange, insertEvent } from "@/lib/events/queries";
import { getUserById } from "@/lib/users";
import { getDisplayName } from "@/lib/utils";
import { findMutualSlots } from "./find-mutual-slots";
import {
  confirmProposalSlot,
  createProposal,
  getProposal,
  setIncomingStatus,
} from "./queries";
import type { MeetingFormInput } from "./types";
import type { ProposedSlot, SlotRequest } from "@/lib/advisor/types";

const MAX_CANDIDATES = 5;

export async function proposeMeeting(friendId: string, form: MeetingFormInput): Promise<void> {
  const user = await requireCurrentUser();
  if (friendId === user.id) throw new Error("Нельзя пригласить самого себя");
  await assertFriends(user.id, friendId);

  const title = form.title.trim() || "Встреча";
  if (form.duration_min <= 0) throw new Error("Длительность должна быть больше нуля");
  if (form.window_from > form.window_to) throw new Error("Период указан неверно");

  await createProposal({
    from_user_id: user.id,
    to_user_id: friendId,
    title,
    category: "meeting",
    duration_min: form.duration_min,
    window_from: form.window_from,
    window_to: form.window_to,
    part_of_day: form.part_of_day,
  });
  revalidatePath("/friends");
}

export async function acceptMeeting(proposalId: string): Promise<void> {
  const user = await requireCurrentUser();
  await setIncomingStatus(user.id, proposalId, "accepted");
  revalidatePath("/friends");
}

export async function declineMeeting(proposalId: string): Promise<void> {
  const user = await requireCurrentUser();
  await setIncomingStatus(user.id, proposalId, "declined");
  revalidatePath("/friends");
}

export async function getMeetingSlots(proposalId: string): Promise<ProposedSlot[]> {
  const user = await requireCurrentUser();
  const proposal = await getProposal(proposalId);
  if (!proposal || proposal.from_user_id !== user.id || proposal.status !== "accepted") {
    throw new Error("Встреча недоступна");
  }
  const request: SlotRequest = {
    title: proposal.title,
    category: proposal.category,
    count: MAX_CANDIDATES,
    duration_min: proposal.duration_min,
    window: { from: proposal.window_from, to: proposal.window_to },
    part_of_day: proposal.part_of_day,
  };
  return findMutualSlots(user.id, proposal.to_user_id, request);
}

function overlaps(events: { starts_at: string; ends_at: string }[], startMs: number, endMs: number) {
  return events.some((e) => {
    const s = new Date(e.starts_at).getTime();
    const en = new Date(e.ends_at).getTime();
    return startMs < en && endMs > s;
  });
}

export async function confirmMeeting(proposalId: string, slot: ProposedSlot): Promise<void> {
  const user = await requireCurrentUser();
  const proposal = await getProposal(proposalId);
  if (!proposal || proposal.from_user_id !== user.id || proposal.status !== "accepted") {
    throw new Error("Встреча недоступна");
  }
  const friendId = proposal.to_user_id;

  // Re-verify the slot is still free for BOTH (availability may have changed).
  // `user` already carries timezone + name (from requireCurrentUser → AppUser).
  const timezone = user.timezone ?? "Europe/Amsterdam";
  const { start, end } = getDateRangeUtc(slot.date, slot.date, timezone);
  const [myEvents, friendEvents] = await Promise.all([
    getEventsInRange(user.id, start, end, timezone),
    getEventsInRange(friendId, start, end, timezone),
  ]);
  const startMs = new Date(slot.starts_at).getTime();
  const endMs = new Date(slot.ends_at).getTime();
  if (overlaps(myEvents, startMs, endMs) || overlaps(friendEvents, startMs, endMs)) {
    throw new Error("Это время уже занято — выбери другое");
  }

  const friend = await getUserById(friendId);
  const friendName = friend ? getDisplayName(friend) : "другом";
  const myName = getDisplayName(user);

  // Insert into both calendars. If the friend's insert fails, roll back the
  // initiator's event so we never leave a half-booked meeting.
  const myEventId = await insertEvent({
    user_id: user.id,
    title: proposal.title,
    category: "meeting",
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    is_fixed: true,
    notes: `Встреча с ${friendName}`,
    location: null,
  });
  try {
    await insertEvent({
      user_id: friendId,
      title: proposal.title,
      category: "meeting",
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      is_fixed: true,
      notes: `Встреча с ${myName}`,
      location: null,
    });
  } catch (e) {
    await deleteEventById(user.id, myEventId);
    throw e;
  }

  await confirmProposalSlot(user.id, proposalId, slot.starts_at, slot.ends_at);
  revalidatePath("/calendar");
  revalidatePath("/friends");
}
