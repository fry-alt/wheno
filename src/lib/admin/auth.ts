import { getCurrentUser } from "@/lib/auth";

/** Admin = current user's Telegram id is in the ADMIN_TELEGRAM_IDS allowlist (env). */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const ids = (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(user.telegram_id));
}
