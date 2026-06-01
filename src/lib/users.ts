import { getAdminSupabase } from "@/lib/supabase/admin";
import { appError } from "@/lib/i18n";
import type { AppUser, TelegramProfile } from "@/lib/types";

export async function getUserById(userId: string): Promise<AppUser | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw appError("user.loadProfileFailed");
  return (data as AppUser | null) ?? null;
}

export async function upsertTelegramUser(profile: TelegramProfile): Promise<AppUser> {
  const admin = getAdminSupabase();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("users")
    .upsert(
      {
        telegram_id: profile.telegramId,
        first_name: profile.firstName,
        last_name: profile.lastName,
        username: profile.username,
        photo_url: profile.photoUrl,
        timezone: profile.timezone,
        updated_at: now,
      },
      { onConflict: "telegram_id" },
    )
    .select("*")
    .single();
  if (error) throw appError("session.saveTelegramProfileFailed");
  return data as AppUser;
}
