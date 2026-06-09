import { getAppUrl } from "@/lib/env";
import { getUserById } from "@/lib/users";
import { sendTelegramMessage } from "./send";

/** Escape the three characters that matter for Telegram parse_mode "HTML". */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const friendRequestMsg = (name: string) =>
  `👋 <b>${escapeHtml(name)}</b> хочет добавить вас в друзья`;
export const friendAcceptedMsg = (name: string) =>
  `✅ <b>${escapeHtml(name)}</b> принял ваш запрос в друзья`;
export const meetingProposedMsg = (name: string, title: string) =>
  `📅 <b>${escapeHtml(name)}</b> предлагает встречу: «${escapeHtml(title)}»`;
export const meetingAcceptedMsg = (name: string, title: string) =>
  `✅ <b>${escapeHtml(name)}</b> принял встречу «${escapeHtml(title)}» — выберите время`;
export const meetingConfirmedMsg = (other: string, title: string, when: string) =>
  `🤝 «${escapeHtml(title)}» с ${escapeHtml(other)} — ${when}`;

/** Inline "Открыть" button → Mini App on the Friends screen. web_app needs HTTPS. */
export function openButton(): object | undefined {
  const url = `${getAppUrl()}/friends`;
  return url.startsWith("https://")
    ? { inline_keyboard: [[{ text: "Открыть", web_app: { url } }]] }
    : undefined;
}

/**
 * Best-effort DM to a user. Resolves their telegram_id, attaches the Open button,
 * and swallows every error so callers never need a try/catch and the originating
 * action is never affected by a delivery failure.
 */
export async function notifyUser(
  userId: string,
  text: string,
  withOpenButton = true,
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user?.telegram_id) return;
    await sendTelegramMessage(user.telegram_id, text, withOpenButton ? openButton() : undefined);
  } catch (err) {
    console.error("notifyUser failed", err);
  }
}
