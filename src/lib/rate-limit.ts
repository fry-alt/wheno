import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Per-user sliding-window limiter backed by Postgres (serverless-safe, no Redis).
 * Fails open: if the limiter itself errors we let the request through rather than
 * breaking the app — the goal is abuse/cost protection, not strict gatekeeping.
 */
export async function checkRateLimit(
  userId: string,
  limit = 20,
  windowSeconds = 60,
): Promise<boolean> {
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_user: userId,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate limit check failed:", error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("rate limit check threw:", e);
    return true;
  }
}
