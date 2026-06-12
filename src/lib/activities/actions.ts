"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { toUtcDateFromLocalParts } from "@/lib/datetime";
import { insertEvent, deleteEventById, updateEventById } from "@/lib/events/queries";
import { notifyUser } from "@/lib/telegram/notify";
import { canJoin } from "./state";
import {
  createActivity, getActivity, cancelActivity, updateActivity,
  participantRows, insertParticipant, removeParticipant, joinActivityAtomic,
} from "./queries";
import { isBlockedEitherWay, insertBlock, insertReport } from "@/lib/safety/queries";
import type { Visibility } from "./types";

export async function createActivityAction(input: {
  title: string; type: string; description?: string; place?: string;
  lat?: number | null; lng?: number | null;
  date: string; startTime: string; endTime: string; capacity?: number | null; visibility?: Visibility;
}): Promise<{ ok: boolean; id?: string }> {
  const user = await requireCurrentUser();
  if (!input.title.trim() || !input.type || !input.date || !input.startTime || !input.endTime) return { ok: false };
  const starts_at = toUtcDateFromLocalParts(input.date, input.startTime, user.timezone).toISOString();
  const ends_at = toUtcDateFromLocalParts(input.date, input.endTime, user.timezone).toISOString();
  if (ends_at <= starts_at) return { ok: false };
  const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
  const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null;

  const activityId = await createActivity({
    host_id: user.id, title: input.title.trim(), type: input.type,
    description: input.description?.trim() || null, place: input.place?.trim() || null,
    lat, lng,
    starts_at, ends_at, capacity: input.capacity ?? null, visibility: input.visibility ?? "public",
  });
  const eventId = await insertEvent({
    user_id: user.id, title: input.title.trim(), starts_at, ends_at,
    category: "social", is_fixed: true, notes: null, location: input.place?.trim() || null,
  });
  await insertParticipant(activityId, user.id, eventId);
  revalidatePath("/activities");
  revalidatePath("/calendar");
  return { ok: true, id: activityId };
}

export async function updateActivityAction(activityId: string, input: {
  title: string; type: string; description?: string; place?: string;
  lat?: number | null; lng?: number | null;
  date: string; startTime: string; endTime: string; capacity?: number | null; visibility?: Visibility;
}): Promise<{ ok: boolean }> {
  const user = await requireCurrentUser();
  const activity = await getActivity(activityId);
  if (!activity || activity.host_id !== user.id) return { ok: false };
  if (!input.title.trim() || !input.type || !input.date || !input.startTime || !input.endTime) return { ok: false };
  const starts_at = toUtcDateFromLocalParts(input.date, input.startTime, user.timezone).toISOString();
  const ends_at = toUtcDateFromLocalParts(input.date, input.endTime, user.timezone).toISOString();
  if (ends_at <= starts_at) return { ok: false };
  const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
  const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null;
  const title = input.title.trim();
  const place = input.place?.trim() || null;

  await updateActivity(activityId, {
    title, type: input.type, description: input.description?.trim() || null, place, lat, lng,
    starts_at, ends_at, capacity: input.capacity ?? null, visibility: input.visibility ?? activity.visibility,
  });

  // Keep every participant's materialized calendar event in sync, and tell them.
  const rows = await participantRows(activityId);
  for (const r of rows) {
    if (r.event_id) await updateEventById(r.user_id, r.event_id, { title, starts_at, ends_at, location: place });
    if (r.user_id !== user.id) await notifyUser(r.user_id, `✏️ Активность «${title}» изменена`);
  }
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/calendar");
  return { ok: true };
}

export async function joinActivityAction(activityId: string): Promise<{ ok: boolean; reason?: string }> {
  const user = await requireCurrentUser();
  const activity = await getActivity(activityId);
  if (!activity) return { ok: false, reason: "missing" };
  const rows = await participantRows(activityId);
  const blocked = await isBlockedEitherWay(user.id, activity.host_id);
  const check = canJoin({
    isHost: activity.host_id === user.id,
    isParticipant: rows.some((r) => r.user_id === user.id),
    count: rows.length, capacity: activity.capacity, status: activity.status,
    startsAt: activity.starts_at, now: new Date().toISOString(), blocked,
  });
  if (!check.ok) return { ok: false, reason: check.reason };

  // Create the calendar event, then join atomically (capacity is re-checked under
  // a row lock). If the atomic join rejects — e.g. the last seat was taken in a
  // race — roll the event back so we never leave an orphan.
  const eventId = await insertEvent({
    user_id: user.id, title: activity.title, starts_at: activity.starts_at, ends_at: activity.ends_at,
    category: "social", is_fixed: true, notes: null, location: activity.place,
  });
  const result = await joinActivityAtomic(activityId, user.id, eventId);
  if (result !== "ok") {
    await deleteEventById(user.id, eventId);
    return { ok: false, reason: result };
  }
  await notifyUser(activity.host_id, `🤸 Кто-то идёт на «${activity.title}»`);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/calendar");
  return { ok: true };
}

export async function leaveActivityAction(activityId: string): Promise<void> {
  const user = await requireCurrentUser();
  const eventId = await removeParticipant(activityId, user.id);
  if (eventId) await deleteEventById(user.id, eventId);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/calendar");
}

export async function cancelActivityAction(activityId: string): Promise<void> {
  const user = await requireCurrentUser();
  const activity = await getActivity(activityId);
  if (!activity || activity.host_id !== user.id) return;
  const rows = await participantRows(activityId);
  await cancelActivity(activityId);
  for (const r of rows) {
    if (r.event_id) await deleteEventById(r.user_id, r.event_id);
    if (r.user_id !== user.id) await notifyUser(r.user_id, `❌ Активность «${activity.title}» отменена`);
  }
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/calendar");
}

export async function reportActivityAction(activityId: string, reason: string): Promise<void> {
  const user = await requireCurrentUser();
  await insertReport(user.id, activityId, reason.trim() || null);
}

export async function blockUserAction(blockedId: string): Promise<void> {
  const user = await requireCurrentUser();
  if (blockedId !== user.id) await insertBlock(user.id, blockedId);
  revalidatePath("/activities");
}
