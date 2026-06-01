import { formatInTimeZone } from "date-fns-tz";

import { transcribeVoice } from "@/lib/openai";
import { parseEvent } from "@/lib/events/parse";
import { deleteEventById } from "@/lib/events/queries";
import { categoryEmoji } from "@/lib/events/categories";
import { upsertTelegramUser } from "@/lib/users";
import { normalizeTimezone } from "@/lib/telegram";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { ParsedEvent } from "@/lib/events/types";
import type { AppUser } from "@/lib/types";

interface TgMessage {
  chat: { id: number };
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  text?: string;
  voice?: { file_id: string };
}

interface TgCallback {
  id: string;
  data?: string;
  from: { id: number };
  message?: { chat: { id: number }; message_id: number };
}

async function sendMessage(chatId: number, text: string, replyMarkup?: object): Promise<void> {
  const { getTelegramBotToken } = await import("@/lib/env");
  await fetch(`https://api.telegram.org/bot${getTelegramBotToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
  });
}

async function answerCallback(id: string): Promise<void> {
  const { getTelegramBotToken } = await import("@/lib/env");
  await fetch(`https://api.telegram.org/bot${getTelegramBotToken()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id }),
  });
}

async function resolveUser(from: NonNullable<TgMessage["from"]>): Promise<AppUser> {
  return upsertTelegramUser({
    telegramId: String(from.id),
    firstName: from.first_name ?? "User",
    lastName: from.last_name ?? null,
    username: from.username ?? null,
    photoUrl: null,
    timezone: normalizeTimezone(undefined),
  });
}

function card(eventId: string, parsed: ParsedEvent, timezone: string): { text: string; reply_markup: object } {
  const day = formatInTimeZone(parsed.starts_at, timezone, "d MMM");
  const start = formatInTimeZone(parsed.starts_at, timezone, "HH:mm");
  const end = formatInTimeZone(parsed.ends_at, timezone, "HH:mm");
  return {
    text: `✅ <b>${parsed.title}</b>\n${categoryEmoji(parsed.category)} ${day} · ${start}–${end} · ${parsed.is_fixed ? "фиксированное" : "гибкое"}`,
    reply_markup: { inline_keyboard: [[{ text: "🗑 Удалить", callback_data: `del:${eventId}` }]] },
  };
}

export async function handleBotMessage(message: TgMessage): Promise<void> {
  if (!message.from) return;
  const user = await resolveUser(message.from);

  let text = message.text?.trim() ?? "";
  if (message.voice) {
    try {
      text = (await transcribeVoice(message.voice.file_id)).trim();
    } catch {
      await sendMessage(message.chat.id, "Не расслышал, напиши текстом.");
      return;
    }
  }
  if (!text) {
    await sendMessage(message.chat.id, "Напиши что добавить — например: «завтра зал в 7 на час».");
    return;
  }

  let parsed: ParsedEvent;
  try {
    const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
    parsed = await parseEvent(text, { today, timezone: user.timezone });
  } catch {
    await sendMessage(message.chat.id, "Не понял событие. Попробуй иначе.");
    return;
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events")
    .insert({
      user_id: user.id,
      title: parsed.title,
      category: parsed.category,
      starts_at: parsed.starts_at,
      ends_at: parsed.ends_at,
      is_fixed: parsed.is_fixed,
      notes: parsed.notes,
      location: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    await sendMessage(message.chat.id, "Не удалось сохранить. Попробуй ещё раз.");
    return;
  }

  const built = card((data as { id: string }).id, parsed, user.timezone);
  await sendMessage(message.chat.id, built.text, built.reply_markup);
}

export async function handleCallbackQuery(cb: TgCallback): Promise<void> {
  if (!cb.data || !cb.message) {
    await answerCallback(cb.id);
    return;
  }
  const [action, eventId] = cb.data.split(":");
  if (action === "del" && eventId) {
    const user = await upsertTelegramUser({
      telegramId: String(cb.from.id),
      firstName: "User",
      lastName: null,
      username: null,
      photoUrl: null,
      timezone: normalizeTimezone(undefined),
    });
    try {
      await deleteEventById(user.id, eventId);
      await sendMessage(cb.message.chat.id, "🗑 Удалено.");
    } catch {
      await sendMessage(cb.message.chat.id, "Не удалось удалить.");
    }
  }
  await answerCallback(cb.id);
}
