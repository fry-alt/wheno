import { NextResponse } from "next/server";

import { getLocalizedErrorMessage } from "@/lib/i18n";
import type { Language } from "@/lib/preferences-shared";
import {
  SESSION_COOKIE_NAME,
  createSessionCookie,
  getSessionCookieConfig,
} from "@/lib/session";
import { resolveTelegramProfile } from "@/lib/telegram";
import { upsertTelegramUser } from "@/lib/users";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    initDataRaw?: string;
    timezone?: string;
    isTMA?: boolean;
    language?: Language;
  };

  try {
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
    const message = getLocalizedErrorMessage(error, body.language ?? "en", "session.openFailed");

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
