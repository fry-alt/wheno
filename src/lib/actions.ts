"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import {
  createBusyBlockForUser,
  createGroupForUser,
  createMeetingRequestWithOptions,
  joinGroupByInviteCode,
  saveVoteForOption,
  selectMeetingOptionForOwner,
} from "@/lib/db/queries";
import type { PreferredTime, VoteValue } from "@/lib/types";
import { createErrorRedirect } from "@/lib/utils";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getPositiveInteger(formData: FormData, key: string) {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) ? value : 0;
}

function redirectWithError(pathname: string, params: Record<string, string | undefined>) {
  redirect(createErrorRedirect(pathname, params));
}

export async function createGroupAction(formData: FormData) {
  const user = await requireCurrentUser();
  const name = getString(formData, "name");

  try {
    const groupId = await createGroupForUser(user.id, name);
    revalidatePath("/");
    redirect(`/groups/${groupId}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "We could not create your group yet.";

    redirectWithError("/groups/new", { error: message });
  }
}

export async function joinGroupAction(formData: FormData) {
  const user = await requireCurrentUser();
  const inviteCode = getString(formData, "inviteCode");

  try {
    const groupId = await joinGroupByInviteCode(user.id, inviteCode);
    revalidatePath("/");
    redirect(`/groups/${groupId}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "We could not join that group yet.";

    redirectWithError("/join", {
      code: inviteCode.toUpperCase(),
      error: message,
    });
  }
}

export async function createBusyBlockAction(formData: FormData) {
  const user = await requireCurrentUser();
  const groupId = getString(formData, "groupId");
  const returnPath = groupId ? `/groups/${groupId}` : "/";

  try {
    await createBusyBlockForUser({
      userId: user.id,
      title: getString(formData, "title"),
      date: getString(formData, "date"),
      startTime: getString(formData, "startTime"),
      endTime: getString(formData, "endTime"),
      timezone: user.timezone,
    });

    revalidatePath(returnPath);
    redirect(returnPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "We could not save that busy block yet.";

    redirectWithError("/availability/new", {
      groupId,
      error: message,
    });
  }
}

export async function createMeetingRequestAction(formData: FormData) {
  const user = await requireCurrentUser();
  const groupId = getString(formData, "groupId");
  const durationMinutes = getPositiveInteger(formData, "durationMinutes");
  const minParticipants = getPositiveInteger(formData, "minParticipants");

  try {
    const meetingId = await createMeetingRequestWithOptions({
      groupId,
      userId: user.id,
      title: getString(formData, "title"),
      dateFrom: getString(formData, "dateFrom"),
      dateTo: getString(formData, "dateTo"),
      durationMinutes,
      preferredTime: getString(formData, "preferredTime") as PreferredTime,
      minParticipants,
      timezone: user.timezone,
    });

    revalidatePath(`/groups/${groupId}`);
    redirect(`/meetings/${meetingId}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We could not create the meeting request yet.";

    redirectWithError(`/groups/${groupId}/find-time`, { error: message });
  }
}

export async function voteMeetingOptionAction(formData: FormData) {
  const user = await requireCurrentUser();
  const meetingId = getString(formData, "meetingId");

  try {
    await saveVoteForOption({
      meetingId,
      optionId: getString(formData, "optionId"),
      userId: user.id,
      vote: getString(formData, "vote") as VoteValue,
    });

    revalidatePath(`/meetings/${meetingId}`);
    redirect(`/meetings/${meetingId}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "We could not save your vote yet.";

    redirectWithError(`/meetings/${meetingId}`, { error: message });
  }
}

export async function selectMeetingOptionAction(formData: FormData) {
  const user = await requireCurrentUser();
  const meetingId = getString(formData, "meetingId");

  try {
    await selectMeetingOptionForOwner({
      meetingId,
      optionId: getString(formData, "optionId"),
      userId: user.id,
    });

    revalidatePath(`/meetings/${meetingId}`);
    redirect(`/meetings/${meetingId}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We could not select that meeting time yet.";

    redirectWithError(`/meetings/${meetingId}`, { error: message });
  }
}
