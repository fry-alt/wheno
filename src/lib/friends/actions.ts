"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import {
  ensureInviteCodeForUser,
  findUserIdByInviteCode,
  findFriendshipBetween,
  createPendingRequest,
  acceptRequest,
  declineRequest,
  removeFriendship,
  getFriendshipById,
} from "./queries";
import { getDisplayName } from "@/lib/utils";
import { isBlockedEitherWay } from "@/lib/safety/queries";
import { notifyUser, friendRequestMsg, friendAcceptedMsg } from "@/lib/telegram/notify";

export async function ensureInviteCode(): Promise<string> {
  const user = await requireCurrentUser();
  return ensureInviteCodeForUser(user.id);
}

export type SendRequestResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "not_found" | "self" | "exists" };

export async function sendFriendRequest(code: string): Promise<SendRequestResult> {
  const user = await requireCurrentUser();
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, reason: "empty" };

  const targetId = await findUserIdByInviteCode(trimmed);
  if (!targetId) return { ok: false, reason: "not_found" };
  if (targetId === user.id) return { ok: false, reason: "self" };

  const existing = await findFriendshipBetween(user.id, targetId);
  if (existing) return { ok: false, reason: "exists" };

  // I enter a friend's code → I'm the requester, they accept/decline.
  await createPendingRequest(user.id, targetId);
  await notifyUser(targetId, friendRequestMsg(getDisplayName(user)));
  revalidatePath("/friends");
  return { ok: true };
}

export async function sendFriendRequestById(targetId: string): Promise<{ ok: boolean; reason?: string }> {
  const user = await requireCurrentUser();
  if (targetId === user.id) return { ok: false, reason: "self" };
  if (await isBlockedEitherWay(user.id, targetId)) return { ok: false, reason: "blocked" };
  const existing = await findFriendshipBetween(user.id, targetId);
  if (existing) return { ok: false, reason: "exists" };

  await createPendingRequest(user.id, targetId);
  await notifyUser(targetId, friendRequestMsg(getDisplayName(user)));
  revalidatePath("/friends");
  return { ok: true };
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const user = await requireCurrentUser();
  await acceptRequest(user.id, friendshipId);
  const friendship = await getFriendshipById(friendshipId);
  if (friendship) {
    await notifyUser(friendship.requester_id, friendAcceptedMsg(getDisplayName(user)));
  }
  revalidatePath("/friends");
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const user = await requireCurrentUser();
  await declineRequest(user.id, friendshipId);
  revalidatePath("/friends");
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const user = await requireCurrentUser();
  await removeFriendship(user.id, friendshipId);
  revalidatePath("/friends");
}
