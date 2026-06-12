import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";

import { getCurrentUser } from "@/lib/auth";
import { parseRequest } from "@/lib/advisor/parse-request";
import { findSlots } from "@/lib/advisor/find-slots";
import { getEventsInRange } from "@/lib/events/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(user.id))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
    const req = await parseRequest(text.trim(), { today, timezone: user.timezone });

    const { start, end } = getDateRangeUtc(req.window.from, req.window.to, user.timezone);
    const events = await getEventsInRange(user.id, start, end, user.timezone);

    const slots = findSlots(
      req,
      events,
      { start: user.day_start || "08:00", end: user.day_end || "22:00" },
      user.timezone,
    );

    return NextResponse.json({
      slots,
      request: { title: req.title, category: req.category, count: req.count },
    });
  } catch {
    return NextResponse.json({ error: "parse_failed" }, { status: 422 });
  }
}
