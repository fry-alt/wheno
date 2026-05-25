import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getUserById } from "@/lib/db/queries";
import { getTranslations } from "@/lib/i18n";
import { getUiPreferences } from "@/lib/preferences";
import { SESSION_COOKIE_NAME, parseSessionCookie } from "@/lib/session";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return parseSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return getUserById(session.userId);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    const { language } = await getUiPreferences();
    const copy = getTranslations(language);

    redirect(`/?error=${encodeURIComponent(copy.errors["auth.openFromTelegramAgain"]())}`);
  }

  return user;
}
