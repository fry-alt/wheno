"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { insertNote, setNoteDone, deleteNoteById } from "./queries";

export async function addTaskAction(content: string): Promise<void> {
  const user = await requireCurrentUser();
  const trimmed = content.trim();
  if (!trimmed) return;
  await insertNote({ user_id: user.id, content: trimmed, date: null });
  revalidatePath("/notes");
}

export async function addDayNoteAction(content: string, date: string): Promise<void> {
  const user = await requireCurrentUser();
  const trimmed = content.trim();
  if (!trimmed) return;
  await insertNote({ user_id: user.id, content: trimmed, date });
  revalidatePath("/notes");
  revalidatePath("/calendar");
}

export async function toggleTaskAction(id: string, done: boolean): Promise<void> {
  const user = await requireCurrentUser();
  await setNoteDone(user.id, id, done);
  revalidatePath("/notes");
}

export async function deleteNoteAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  await deleteNoteById(user.id, id);
  revalidatePath("/notes");
  revalidatePath("/calendar");
}
