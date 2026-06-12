import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { getCurrentUser } from "@/lib/auth";
import { getEventsInRange } from "@/lib/events/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { planSchedule } from "@/lib/events/voice-plan";
import { normalizeVoicePlan } from "@/lib/events/voice-plan-normalize";
import { checkRateLimit } from "@/lib/rate-limit";
import type { EventContextItem } from "@/lib/events/voice-plan-types";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(user.id))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
    const endDay = format(addDays(new Date(`${today}T00:00:00`), 30), "yyyy-MM-dd");
    const { start, end } = getDateRangeUtc(today, endDay, user.timezone);
    const events = await getEventsInRange(user.id, start, end, user.timezone);

    const ctxEvents: EventContextItem[] = events.map((e) => ({
      id: e.id,
      recurring: e.series_id != null,
      date: formatInTimeZone(e.starts_at, user.timezone, "yyyy-MM-dd"),
      start: formatInTimeZone(e.starts_at, user.timezone, "HH:mm"),
      title: e.title,
      category: e.category,
    }));

    const raw = await planSchedule(text.trim(), { today, timezone: user.timezone, events: ctxEvents });
    const actions = normalizeVoicePlan(raw, { events: ctxEvents, today, timezone: user.timezone });
    return NextResponse.json({ actions });
  } catch {
    return NextResponse.json({ error: "plan_failed" }, { status: 422 });
  }
}
