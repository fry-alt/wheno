import { getTelegramBotToken } from "@/lib/env";

/** One Telegram `sendMessage` call. Throws on a non-OK response. */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${getTelegramBotToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage failed: ${res.status}`);
}
