"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { normalizeInterests } from "./interests";
import { canAddPhoto } from "./profile";
import { countPhotos, deletePhoto, insertPhoto, setMainPhoto, uploadPhotoObject, upsertProfile } from "./queries";
import type { Gender } from "./types";

const GENDERS: Gender[] = ["male", "female", "other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateProfileAction(input: {
  bio?: string; city?: string; birthdate?: string; gender?: string;
  show_age?: boolean; show_gender?: boolean; interests?: unknown;
}): Promise<void> {
  const user = await requireCurrentUser();
  const gender = GENDERS.includes(input.gender as Gender) ? (input.gender as Gender) : null;
  await upsertProfile(user.id, {
    bio: input.bio?.trim() || null,
    city: input.city?.trim() || null,
    birthdate: input.birthdate && DATE_RE.test(input.birthdate) ? input.birthdate : null,
    gender,
    show_age: input.show_age ?? true,
    show_gender: input.show_gender ?? true,
    interests: normalizeInterests(input.interests),
  });
  revalidatePath("/profile");
}

export async function uploadProfilePhotoAction(formData: FormData): Promise<{ ok: boolean; reason?: string }> {
  const user = await requireCurrentUser();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "empty" };
  if (file.size > 8 * 1024 * 1024) return { ok: false, reason: "too_large" };
  // Some mobile / Telegram pickers send an empty MIME type for valid images —
  // only reject when a non-image type is explicitly present.
  if (file.type && !file.type.startsWith("image/")) return { ok: false, reason: "not_image" };

  try {
    const count = await countPhotos(user.id);
    if (!canAddPhoto(count)) return { ok: false, reason: "limit" };
    const contentType = file.type || "image/jpeg";
    const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = await uploadPhotoObject(user.id, ext, await file.arrayBuffer(), contentType);
    await insertPhoto(user.id, path, count); // count == next position index
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    console.error("photo upload failed:", e);
    return { ok: false, reason: "failed" };
  }
}

export async function deleteProfilePhotoAction(photoId: string): Promise<void> {
  const user = await requireCurrentUser();
  await deletePhoto(user.id, photoId);
  revalidatePath("/profile");
}

export async function setMainPhotoAction(photoId: string): Promise<void> {
  const user = await requireCurrentUser();
  await setMainPhoto(user.id, photoId);
  revalidatePath("/profile");
}
