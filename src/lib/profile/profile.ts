import type { ProfileWithPhotos, PublicProfile } from "./types";

export const PHOTO_LIMIT = 6;

export function ageFromBirthdate(birthdate: string, today: string | Date): number {
  const b = new Date(`${birthdate}T00:00:00Z`);
  const t = typeof today === "string" ? new Date(`${today}T00:00:00Z`) : today;
  let age = t.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    t.getUTCMonth() < b.getUTCMonth() ||
    (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function publicProfileProjection(profile: ProfileWithPhotos, today: string | Date): PublicProfile {
  return {
    user_id: profile.user_id,
    bio: profile.bio,
    city: profile.city,
    age: profile.show_age && profile.birthdate ? ageFromBirthdate(profile.birthdate, today) : null,
    gender: profile.show_gender ? profile.gender : null,
    interests: profile.interests,
    photos: profile.photos,
  };
}

export function canAddPhoto(currentCount: number): boolean {
  return currentCount < PHOTO_LIMIT;
}
