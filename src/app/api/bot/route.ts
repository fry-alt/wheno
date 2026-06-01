import { NextResponse } from "next/server";

import { handleBotMessage, handleCallbackQuery } from "@/lib/bot/handler";
import { getTelegramWebhookSecret } from "@/lib/env";

export async function POST(request: Request) {
  const secret = getTelegramWebhookSecret();
  if (secret) {
    const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const update = (await request.json()) as {
      message?: Parameters<typeof handleBotMessage>[0];
      callback_query?: Parameters<typeof handleCallbackQuery>[0];
    };
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.message) {
      await handleBotMessage(update.message);
    }
  } catch (err) {
    console.error("Bot handler error:", err);
  }

  return NextResponse.json({ ok: true });
}
