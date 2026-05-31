import { getTelegramBotToken } from "@/lib/env";

export async function sendTelegramMessage(
  telegramId: string,
  text: string,
): Promise<void> {
  // Numeric Telegram IDs work; the dev-user fallback id is a string that won't
  // match a real account, so we skip it silently.
  if (!telegramId || telegramId === "dev-user") {
    return;
  }

  const token = getTelegramBotToken();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    // Non-critical: log but don't throw — failing to notify shouldn't roll back the slot selection.
    console.error(
      `Telegram sendMessage failed for ${telegramId}: ${res.status}`,
      await res.text().catch(() => ""),
    );
  }
}

export async function notifyParticipants(
  participants: Array<{ telegram_id: string }>,
  message: string,
): Promise<void> {
  await Promise.allSettled(
    participants.map((p) => sendTelegramMessage(p.telegram_id, message)),
  );
}
