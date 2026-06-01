"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { toUtcDateFromLocalParts } from "@/lib/datetime";
import { insertEvent, updateEventById, deleteEventById } from "./queries";
import type { Category, ParsedEvent } from "./types";

export interface EventFormInput {
  title: string;
  category: Category;
  date: string;       // yyyy-MM-dd (user local)
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  is_fixed: boolean;
  notes?: string | null;
  location?: string | null;
}

export async function createEventAction(input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  const startsAt = toUtcDateFromLocalParts(input.date, input.start_time, user.timezone);
  const endsAt = toUtcDateFromLocalParts(input.date, input.end_time, user.timezone);
  await insertEvent({
    user_id: user.id,
    title: input.title.trim(),
    category: input.category,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
  });
  revalidatePath("/calendar");
}

export async function updateEventAction(id: string, input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  const startsAt = toUtcDateFromLocalParts(input.date, input.start_time, user.timezone);
  const endsAt = toUtcDateFromLocalParts(input.date, input.end_time, user.timezone);
  await updateEventById(user.id, id, {
    title: input.title.trim(),
    category: input.category,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
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

/** Create from an already-parsed natural-language event (times are ISO UTC). */
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
  });
  revalidatePath("/calendar");
}
