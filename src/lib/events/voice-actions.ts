"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { insertEvent, updateEventById, updateSeries, deleteEventById, addExcludedDate } from "./queries";
import { insertNote } from "@/lib/notes/queries";
import type { ParsedEvent, Recurrence } from "./types";
import type { VoiceAction } from "./voice-plan-types";

function insertParsed(userId: string, e: ParsedEvent, recurrence: Recurrence | null) {
  return insertEvent({
    user_id: userId,
    title: e.title.trim(),
    category: e.category,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    is_fixed: e.is_fixed,
    notes: e.notes?.trim() || null,
    location: null,
    recurrence,
    excluded_dates: [],
  });
}

export async function applyVoicePlanAction(
  actions: VoiceAction[],
): Promise<{ applied: number; failed: number }> {
  const user = await requireCurrentUser();
  let applied = 0;
  let failed = 0;
  let touchedNotes = false;

  for (const action of actions) {
    try {
      if (action.type === "create") {
        await insertParsed(user.id, action.event, action.event.recurrence ?? null);
      } else if (action.type === "note") {
        await insertNote({ user_id: user.id, content: action.text.trim(), date: action.date });
        touchedNotes = true;
      } else if (action.type === "edit") {
        const e = action.event;
        const patch = {
          title: e.title.trim(),
          category: e.category,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          is_fixed: e.is_fixed,
          notes: e.notes?.trim() || null,
        };
        if (action.recurring && action.scope === "one" && action.targetDate) {
          await addExcludedDate(user.id, action.targetId, action.targetDate);
          await insertParsed(user.id, e, null);
        } else if (action.recurring) {
          await updateSeries(user.id, action.targetId, { ...patch, recurrence: e.recurrence ?? null });
        } else {
          await updateEventById(user.id, action.targetId, patch);
        }
      } else {
        // delete
        if (action.recurring && action.scope === "one" && action.targetDate) {
          await addExcludedDate(user.id, action.targetId, action.targetDate);
        } else {
          await deleteEventById(user.id, action.targetId);
        }
      }
      applied += 1;
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/calendar");
  if (touchedNotes) revalidatePath("/notes");
  return { applied, failed };
}
