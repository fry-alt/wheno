import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { getPendingReminders, markReminderSent } from "@/lib/db/queries";
import { getCronSecret, getTelegramBotToken } from "@/lib/env";

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

  for (const reminder of reminders) {
    try {
      const timeStr = formatInTimeZone(reminder.event_starts_at, "UTC", "HH:mm");
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: reminder.chat_id,
          text: `⏰ Напоминание: <b>${reminder.event_title}</b> в ${timeStr}`,
          parse_mode: "HTML",
        }),
      });
      await markReminderSent(reminder.id);
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent: reminders.length });
}
