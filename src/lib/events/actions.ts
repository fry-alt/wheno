"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { toUtcDateFromLocalParts } from "@/lib/datetime";
import {
  insertEvent,
  updateEventById,
  deleteEventById,
  addExcludedDate,
  updateSeries,
} from "./queries";
import type { Category, ParsedEvent, Recurrence } from "./types";

export interface EventFormInput {
  title: string;
  category: Category;
  date: string;       // yyyy-MM-dd (user local)
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  is_fixed: boolean;
  notes?: string | null;
  location?: string | null;
  recurrence?: Recurrence | null;
}

function localToUtc(date: string, time: string, tz: string): string {
  return toUtcDateFromLocalParts(date, time, tz).toISOString();
}

export async function createEventAction(input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  await insertEvent({
    user_id: user.id,
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
    recurrence: input.recurrence ?? null,
    excluded_dates: [],
  });
  revalidatePath("/calendar");
}

export async function updateEventAction(id: string, input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  await updateEventById(user.id, id, {
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
  });
  revalidatePath("/calendar");
}

export async function deleteEventAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  await deleteEventById(user.id, id);
  revalidatePath("/calendar");
}

export async function createParsedEventAction(parsed: ParsedEvent): Promise<void> {
  const user = await requireCurrentUser();
  await insertEvent({
    user_id: user.id,
    title: parsed.title.trim(),
    category: parsed.category,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    is_fixed: parsed.is_fixed,
    notes: parsed.notes?.trim() || null,
    location: null,
    recurrence: parsed.recurrence ?? null,
    excluded_dates: [],
  });
  revalidatePath("/calendar");
}

// ── Recurring-series scope actions ───────────────────────────────────────────

export async function deleteOccurrenceAction(seriesId: string, date: string): Promise<void> {
  const user = await requireCurrentUser();
  await addExcludedDate(user.id, seriesId, date);
  revalidatePath("/calendar");
}

export async function deleteSeriesAction(seriesId: string): Promise<void> {
  const user = await requireCurrentUser();
  await deleteEventById(user.id, seriesId);
  revalidatePath("/calendar");
}

export async function updateSeriesAction(seriesId: string, input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  await updateSeries(user.id, seriesId, {
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
    recurrence: input.recurrence ?? null,
  });
  revalidatePath("/calendar");
}

/** Edit one occurrence: exclude it from the series, then create a one-off override. */
export async function editOccurrenceAction(
  seriesId: string,
  date: string,
  input: EventFormInput,
): Promise<void> {
  const user = await requireCurrentUser();
  await addExcludedDate(user.id, seriesId, date);
  await insertEvent({
    user_id: user.id,
    title: input.title.trim(),
    category: input.category,
    starts_at: localToUtc(input.date, input.start_time, user.timezone),
    ends_at: localToUtc(input.date, input.end_time, user.timezone),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
    recurrence: null,
    excluded_dates: [],
  });
  revalidatePath("/calendar");
}
