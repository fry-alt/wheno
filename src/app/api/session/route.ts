import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  createSessionCookie,
  getSessionCookieConfig,
} from "@/lib/session";
import { resolveTelegramProfile } from "@/lib/telegram";
import { upsertTelegramUser } from "@/lib/db/queries";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initDataRaw?: string;
      timezone?: string;
      isTMA?: boolean;
    };

    const profile = resolveTelegramProfile({
      initDataRaw: body.initDataRaw,
      isTMA: body.isTMA,
      timezone: body.timezone,
    });
    const user = await upsertTelegramUser(profile);
    const response = NextResponse.json({
      user: {
        id: user.id,
        firstName: user.first_name,
        username: user.username,
      },
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSessionCookie({
        userId: user.id,
        telegramId: user.telegram_id,
        timezone: user.timezone,
      }),
      getSessionCookieConfig(),
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We could not open your wheno session yet.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
