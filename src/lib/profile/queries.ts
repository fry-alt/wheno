import { randomUUID } from "node:crypto";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { publicProfileProjection } from "./profile";
import type { Gender, Profile, ProfilePhoto, ProfilePhotoView, ProfileWithPhotos, PublicProfile } from "./types";

const BUCKET = "profile-photos";

function emptyProfile(userId: string): Profile {
  return {
    user_id: userId, bio: null, city: null, birthdate: null, gender: null,
    show_age: true, show_gender: true, interests: [],
  };
}

function photoUrl(storagePath: string): string {
  const { data } = getAdminSupabase().storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function loadPhotos(userId: string): Promise<ProfilePhotoView[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profile_photos")
    .select("id, storage_path, position")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Pick<ProfilePhoto, "id" | "storage_path" | "position">[]).map((p) => ({
    id: p.id, url: photoUrl(p.storage_path), position: p.position,
  }));
}

export async function getProfile(userId: string): Promise<ProfileWithPhotos> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const profile = (data as Profile | null) ?? emptyProfile(userId);
  return { ...profile, photos: await loadPhotos(userId) };
}

export async function getPublicProfile(userId: string, today: string): Promise<PublicProfile> {
  return publicProfileProjection(await getProfile(userId), today);
}

export async function upsertProfile(
  userId: string,
  fields: {
    bio: string | null; city: string | null; birthdate: string | null;
    gender: Gender | null; show_age: boolean; show_gender: boolean; interests: string[];
  },
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function countPhotos(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  const { count, error } = await admin
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function insertPhoto(userId: string, storagePath: string, position: number): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("profile_photos").insert({ user_id: userId, storage_path: storagePath, position });
  if (error) throw new Error(error.message);
}

export async function uploadPhotoObject(userId: string, ext: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const admin = getAdminSupabase();
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function deletePhoto(userId: string, photoId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profile_photos").select("storage_path").eq("id", photoId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { storage_path: string } | null;
  if (!row) return;
  await admin.storage.from(BUCKET).remove([row.storage_path]);
  const { error: delErr } = await admin.from("profile_photos").delete().eq("id", photoId).eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
}

export async function setMainPhoto(userId: string, photoId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profile_photos").select("id, position").eq("user_id", userId).order("position", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; position: number }[];
  if (!rows.some((r) => r.id === photoId)) return;
  const reordered = [photoId, ...rows.filter((r) => r.id !== photoId).map((r) => r.id)];
  for (let i = 0; i < reordered.length; i++) {
    const { error: upErr } = await admin.from("profile_photos").update({ position: i }).eq("id", reordered[i]).eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);
  }
}
