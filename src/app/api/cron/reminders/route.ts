import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { getPendingReminders, markReminderSent } from "@/lib/db/queries";
import { getCronSecret, getTelegramBotToken } from "@/lib/env";
import { normalizeTimezone } from "@/lib/telegram";

export async function GET(request: Request) {
  const secret = getCronSecret();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const reminders = await getPendingReminders();
  const token = getTelegramBotToken();

  let sentCount = 0;
  for (const reminder of reminders) {
    try {
      const tz = normalizeTimezone(reminder.user_timezone);
      const timeStr = formatInTimeZone(reminder.event_starts_at, tz, "HH:mm");
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: reminder.chat_id,
          text: `⏰ Напоминание: <b>${reminder.event_title}</b> в ${timeStr}`,
          parse_mode: "HTML",
        }),
      });
      if (!response.ok) throw new Error(`Telegram error: ${response.status}`);
      await markReminderSent(reminder.id);
      sentCount++;
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount });
}
