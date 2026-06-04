"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import {
  ensureInviteCodeForUser,
  acceptRequest,
  declineRequest,
  removeFriendship,
} from "./queries";

export async function ensureInviteCode(): Promise<string> {
  const user = await requireCurrentUser();
  return ensureInviteCodeForUser(user.id);
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const user = await requireCurrentUser();
  await acceptRequest(user.id, friendshipId);
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
