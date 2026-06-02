"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { insertEvent } from "@/lib/events/queries";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Category } from "@/lib/events/types";
import type { ProposedSlot } from "./types";

export async function createPlanAction(
  slots: ProposedSlot[],
  title: string,
  category: Category,
): Promise<void> {
  const user = await requireCurrentUser();
  for (const slot of slots) {
    await insertEvent({
      user_id: user.id,
      title: title.trim() || "Событие",
      category,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      is_fixed: false, // advisor places flexible activities
      notes: null,
      location: null,
    });
  }
  revalidatePath("/calendar");
}

export async function updateDayHoursAction(dayStart: string, dayEnd: string): Promise<void> {
  const user = await requireCurrentUser();
  if (dayStart >= dayEnd) throw new Error("Начало дня должно быть раньше конца");
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("users")
    .update({ day_start: dayStart, day_end: dayEnd })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
