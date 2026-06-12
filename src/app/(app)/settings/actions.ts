"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  LANGUAGE_COOKIE_NAME,
  THEME_COOKIE_NAME,
  parseLanguagePref,
  parseThemePref,
} from "@/lib/preferences-shared";
import { getPreferenceCookieConfig } from "@/lib/preferences";

export async function updatePreferences(input: { theme?: string; language?: string }): Promise<void> {
  const store = await cookies();
  const cfg = getPreferenceCookieConfig();
  if (input.theme !== undefined) {
    store.set(THEME_COOKIE_NAME, parseThemePref(input.theme), cfg);
  }
  if (input.language !== undefined) {
    store.set(LANGUAGE_COOKIE_NAME, parseLanguagePref(input.language), cfg);
  }
  revalidatePath("/", "layout");
}
