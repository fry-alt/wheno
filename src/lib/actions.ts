"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fromZonedTime } from "date-fns-tz";

import { requireCurrentUser } from "@/lib/auth";
import {
  createBusyBlockForUser,
  createWeeklyBusyBlocksForUser,
  createGroupForUser,
  createMeetingRequestWithOptions,
  getInlineBusyCells,
  joinGroupByInviteCode,
  saveVoteForOption,
  selectMeetingOptionForOwner,
  toggleInlineBusyCell,
  type HalfDay,
} from "@/lib/db/queries";
import { getLocalizedErrorMessage } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
import type { PreferredTime, VoteValue } from "@/lib/types";
import { normalizeTimezone } from "@/lib/telegram";
import { getAdminSupabase } from "@/lib/supabase/admin";
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
  const { language } = await getUiPreferences();
  const name = getString(formData, "name");

  try {
    const groupId = await createGroupForUser(user.id, name);
    revalidatePath("/groups");
    redirect(`/groups/${groupId}`);
  } catch (error) {
    const message = getLocalizedErrorMessage(error, language, "group.createFailed");

    redirectWithError("/groups/new", { error: message });
  }
}

export async function joinGroupAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { language } = await getUiPreferences();
  const inviteCode = getString(formData, "inviteCode");

  try {
    const groupId = await joinGroupByInviteCode(user.id, inviteCode);
    revalidatePath("/");
    redirect(`/groups/${groupId}`);
  } catch (error) {
    const message = getLocalizedErrorMessage(error, language, "group.joinFailed");

    redirectWithError("/join", {
      code: inviteCode.toUpperCase(),
      error: message,
    });
  }
}

export async function createBusyBlockAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { language } = await getUiPreferences();
  const groupId = getString(formData, "groupId");
  const mode = getString(formData, "mode");
  const returnPath = groupId ? `/groups/${groupId}` : "/";

  try {
    if (mode === "weekly") {
      await createWeeklyBusyBlocksForUser({
        userId: user.id,
        title: getString(formData, "title"),
        startDate: getString(formData, "startDate"),
        endDate: getString(formData, "endDate"),
        weekdays: formData
          .getAll("weekdays")
          .map((weekday) => Number(String(weekday)))
          .filter((weekday) => Number.isInteger(weekday)),
        startTime: getString(formData, "startTime"),
        endTime: getString(formData, "endTime"),
        timezone: user.timezone,
      });
    } else {
      await createBusyBlockForUser({
        userId: user.id,
        title: getString(formData, "title"),
        date: getString(formData, "date"),
        startTime: getString(formData, "startTime"),
        endTime: getString(formData, "endTime"),
        timezone: user.timezone,
      });
    }

    revalidatePath(returnPath);
    redirect(returnPath);
  } catch (error) {
    const message = getLocalizedErrorMessage(error, language, "busyBlock.saveFailed");

    redirectWithError("/availability/new", {
      groupId,
      error: message,
    });
  }
}

export async function createMeetingRequestAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { language } = await getUiPreferences();
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
    const message = getLocalizedErrorMessage(error, language, "meeting.createFailed");

    redirectWithError(`/groups/${groupId}/find-time`, { error: message });
  }
}

export async function voteMeetingOptionAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { language } = await getUiPreferences();
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
    const message = getLocalizedErrorMessage(error, language, "meeting.voteSaveFailed");

    redirectWithError(`/meetings/${meetingId}`, { error: message });
  }
}

export async function selectMeetingOptionAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { language } = await getUiPreferences();
  const meetingId = getString(formData, "meetingId");

  try {
    await selectMeetingOptionForOwner({
      meetingId,
      optionId: getString(formData, "optionId"),
      userId: user.id,
      language,
    });

    revalidatePath(`/meetings/${meetingId}`);
    redirect(`/meetings/${meetingId}`);
  } catch (error) {
    const message = getLocalizedErrorMessage(error, language, "meeting.selectFailed");

    redirectWithError(`/meetings/${meetingId}`, { error: message });
  }
}

export async function toggleInlineBusyCellAction(formData: FormData) {
  const user = await requireCurrentUser();
  const { language } = await getUiPreferences();
  const date   = getString(formData, "date");
  const period = getString(formData, "period") as HalfDay;
  const groupId = getString(formData, "groupId");

  try {
    const timezone = normalizeTimezone(user.timezone);
    const currentCells = await getInlineBusyCells(user.id, getString(formData, "weekStart"), timezone);

    await toggleInlineBusyCell(user.id, date, period, timezone, currentCells);

    revalidatePath(groupId ? `/groups/${groupId}` : "/calendar");
  } catch (error) {
    const message = getLocalizedErrorMessage(error, language, "busyBlock.toggleFailed");
    const groupId2 = getString(formData, "groupId");

    redirectWithError(groupId2 ? `/groups/${groupId2}` : "/calendar", { error: message });
  }
}

export async function createCalendarEventAction(data: {
  title: string;
  activity_type: string;
  date: string;       // "yyyy-MM-dd"
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
}): Promise<void> {
  const user = await requireCurrentUser();
  const tz = normalizeTimezone(user.timezone);
  const starts_at = fromZonedTime(`${data.date}T${data.start_time}:00`, tz).toISOString();
  const ends_at = fromZonedTime(`${data.date}T${data.end_time}:00`, tz).toISOString();

  const admin = getAdminSupabase();
  const { error: insertError } = await admin.from("calendar_events").insert({
    user_id: user.id,
    title: data.title,
    activity_type: data.activity_type,
    starts_at,
    ends_at,
    energy_after: "medium",
    dress_code: "casual",
    is_flexible: true,
    source: "manual",
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/calendar");
}

export async function deleteCalendarEventAction(eventId: string): Promise<void> {
  const user = await requireCurrentUser();
  const admin = getAdminSupabase();
  const { error: deleteError } = await admin
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id);
  if (deleteError) throw new Error(deleteError.message);
  revalidatePath("/calendar");
}
