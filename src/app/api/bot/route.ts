import { NextResponse } from "next/server";

import { handleBotMessage } from "@/lib/bot-handler";
import { getTelegramWebhookSecret } from "@/lib/env";

export async function POST(request: Request) {
  // Verify webhook secret (set via Telegram setWebhook ?secret_token=...)
  const secret = getTelegramWebhookSecret();
  if (secret) {
    const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const update = (await request.json()) as Parameters<typeof handleBotMessage>[0];
    await handleBotMessage(update);
  } catch (err) {
    // Never return 5xx to Telegram — it will keep retrying
    console.error("Bot handler error:", err);
  }

  // Telegram expects 200 OK
  return NextResponse.json({ ok: true });
}
