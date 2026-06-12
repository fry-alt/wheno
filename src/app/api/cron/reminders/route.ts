import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { dueReminders, markReminded } from "@/lib/reminders/queries";
import { getUserById } from "@/lib/users";
import { notifyUser } from "@/lib/telegram/notify";
import { normalizeTimezone } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const LEAD_MINUTES = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed: no secret configured ⇒ no access
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = new URL(request.url).searchParams.get("secret");
  return header === secret || query === secret;
}

async function handle(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date().toISOString();
  const due = await dueReminders(now, LEAD_MINUTES);
  const processed: string[] = [];
  let sent = 0;

  for (const e of due) {
    const user = await getUserById(e.user_id);
    if (user) {
      const when = formatInTimeZone(e.starts_at, normalizeTimezone(user.timezone), "d MMM, HH:mm", { locale: ru });
      try {
        await notifyUser(e.user_id, `⏰ Скоро: «${e.title}» — ${when}`);
        sent++;
      } catch {
        // Delivery failed — still mark so we don't retry/spam on the next tick.
      }
    }
    processed.push(e.id);
  }
  await markReminded(processed);
  return NextResponse.json({ due: due.length, sent });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
