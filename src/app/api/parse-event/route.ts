import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { parseEvent } from "@/lib/events/parse";
import { formatInTimeZone } from "date-fns-tz";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
    const parsed = await parseEvent(text.trim(), { today, timezone: user.timezone });
    return NextResponse.json({ parsed });
  } catch {
    return NextResponse.json({ error: "parse_failed" }, { status: 422 });
  }
}
