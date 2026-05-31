import { addDays, addMinutes, format, parseISO, setHours, setMinutes } from "date-fns";
import type OpenAI from "openai";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { processMessage, type CalendarContext, type ParsedEvent } from "@/lib/openai";
import { normalizeTimezone } from "@/lib/telegram";
import { upsertTelegramUser, createReminder } from "@/lib/db/queries";
import type { TelegramProfile } from "@/lib/types";

// ─── Telegram sender ──────────────────────────────────────────────────────────

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  const { getTelegramBotToken } = await import("@/lib/env");
  const token = getTelegramBotToken();

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

// ─── Event card builder ───────────────────────────────────────────────────────

function buildEventCard(
  eventId: string,
  title: string,
  localDate: string,
  startTime: string,
  endTime: string,
  energyAfter: string,
  dressCode: string,
  lang: "ru" | "en",
): { text: string; reply_markup: object } {
  const energyEmoji: Record<string, string> = { low: "🔋", medium: "⚡", high: "✨" };
  const dressEmoji: Record<string, string> = { athletic: "👟", casual: "👕", smart: "👔", formal: "🎩" };

  const text = lang === "ru"
    ? `✅ <b>${title}</b> добавлен\n📅 ${localDate} · ${startTime}–${endTime}\n${energyEmoji[energyAfter] ?? ""} ${energyAfter} · ${dressEmoji[dressCode] ?? ""} ${dressCode}`
    : `✅ <b>${title}</b> added\n📅 ${localDate} · ${startTime}–${endTime}\n${energyEmoji[energyAfter] ?? ""} ${energyAfter} · ${dressEmoji[dressCode] ?? ""} ${dressCode}`;

  const reply_markup = {
    inline_keyboard: [[
      { text: lang === "ru" ? "🔔 Напомнить" : "🔔 Remind", callback_data: `remind:${eventId}` },
      { text: lang === "ru" ? "✏️ Изменить" : "✏️ Edit", callback_data: `edit:${eventId}` },
      { text: lang === "ru" ? "🗑️ Удалить" : "🗑️ Delete", callback_data: `delete:${eventId}` },
    ]],
  };

  return { text, reply_markup };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getOrCreateUserProfile(userId: string) {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    await admin.from("user_profiles").insert({ user_id: userId });
    return { onboarded: false, interests: [], ai_context: null, wake_time: null, sleep_time: null, work_start: null, work_end: null };
  }

  return data as {
    onboarded: boolean;
    interests: string[];
    ai_context: string | null;
    wake_time: string | null;
    sleep_time: string | null;
    work_start: string | null;
    work_end: string | null;
  };
}

async function getRecentMessages(userId: string, limit = 10) {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("bot_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<{ role: string; content: string }>)
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

async function saveMessage(userId: string, role: "user" | "assistant", content: string) {
  const admin = getAdminSupabase();
  await admin.from("bot_messages").insert({ user_id: userId, role, content });
}

async function saveCalendarEvent(userId: string, event: ParsedEvent, timezone: string) {
  const admin = getAdminSupabase();

  const startAt = fromZonedTime(`${event.date}T${event.start_time}:00`, normalizeTimezone(timezone));
  const endAt   = fromZonedTime(`${event.date}T${event.end_time}:00`,   normalizeTimezone(timezone));

  const { error } = await admin.from("calendar_events").insert({
    user_id:       userId,
    title:         event.title,
    activity_type: event.activity_type,
    starts_at:     startAt.toISOString(),
    ends_at:       endAt.toISOString(),
    location:      event.location,
    energy_after:  event.energy_after,
    dress_code:    event.dress_code,
    is_flexible:   event.is_flexible,
    notes:         event.notes,
    source:        "ai",
  });

  return !error;
}

async function saveOnboardingInfo(
  userId: string,
  info: {
    interests: string[];
    wake_time?: string;
    sleep_time?: string;
    work_start?: string;
    work_end?: string;
    summary: string;
  },
) {
  const admin = getAdminSupabase();
  await admin.from("user_profiles").upsert({
    user_id:    userId,
    interests:  info.interests,
    wake_time:  info.wake_time ?? null,
    sleep_time: info.sleep_time ?? null,
    work_start: info.work_start ?? null,
    work_end:   info.work_end ?? null,
    ai_context: info.summary,
    onboarded:  true,
  }, { onConflict: "user_id" });
}

async function getUpcomingEvents(userId: string, timezone: string) {
  const admin = getAdminSupabase();
  const tz = normalizeTimezone(timezone);
  const from = new Date();
  const to   = addDays(from, 7);

  const { data } = await admin
    .from("calendar_events")
    .select("title, starts_at, ends_at, energy_after, dress_code, location")
    .eq("user_id", userId)
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  return ((data ?? []) as Array<{
    title: string;
    starts_at: string;
    ends_at: string;
    energy_after: string | null;
    dress_code: string | null;
    location: string | null;
  }>).map((e) => ({
    ...e,
    starts_at: formatInTimeZone(e.starts_at, tz, "yyyy-MM-dd'T'HH:mm"),
    ends_at:   formatInTimeZone(e.ends_at,   tz, "HH:mm"),
  }));
}

// ─── Onboarding message ───────────────────────────────────────────────────────

function onboardingMessage(lang: "ru" | "en") {
  if (lang === "ru") {
    return `Привет! 👋 Я твой личный ИИ-планировщик.

Расскажи немного о себе, чтобы я мог давать умные советы:
• Во сколько обычно встаёшь?
• Чем занимаешься — работаешь, учишься?
• Какие активности любишь? (зал, теннис, ужины, кино…)

Просто пиши как другу — я всё пойму 🙂`;
  }

  return `Hey! 👋 I'm your personal AI calendar assistant.

Tell me a bit about yourself so I can give you smart suggestions:
• What time do you usually wake up?
• Do you work / study?
• What activities do you enjoy? (gym, tennis, dinners, movies…)

Just write naturally — I'll figure it out 🙂`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleBotMessage(update: {
  message?: {
    from?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: { id: number };
    text?: string;
  };
}) {
  const msg = update.message;
  if (!msg?.text || !msg.from) return;

  const tgUser = msg.from;
  const chatId = msg.chat.id;
  const text   = msg.text.trim();
  const lang: "ru" | "en" = tgUser.language_code === "ru" ? "ru" : "en";

  // 1. Upsert user
  const profile: TelegramProfile = {
    telegramId: String(tgUser.id),
    firstName:  tgUser.first_name,
    lastName:   tgUser.last_name   ?? null,
    username:   tgUser.username    ?? null,
    photoUrl:   null,
    timezone:   "Europe/Moscow",
  };
  const user = await upsertTelegramUser(profile);

  // 2. /start command
  if (text === "/start") {
    const userProfile = await getOrCreateUserProfile(user.id);
    if (!userProfile.onboarded) {
      await sendMessage(chatId, onboardingMessage(lang));
    } else {
      const reply = lang === "ru"
        ? "С возвращением! 👋 Просто напиши что хочешь запланировать."
        : "Welcome back! 👋 Just tell me what you want to schedule.";
      await sendMessage(chatId, reply);
    }
    return;
  }

  // 3. Build context for AI
  const userProfile    = await getOrCreateUserProfile(user.id);
  const recentMessages = await getRecentMessages(user.id);
  const upcoming       = await getUpcomingEvents(user.id, user.timezone);
  const today          = format(new Date(), "yyyy-MM-dd");

  const calendarCtx: CalendarContext = {
    today,
    timezone:       normalizeTimezone(user.timezone),
    upcomingEvents: upcoming,
    userContext:    userProfile.ai_context,
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...recentMessages,
    { role: "user", content: text },
  ];

  // 4. Save user message
  await saveMessage(user.id, "user", text);

  // 5. Call AI
  const { reply, toolCall } = await processMessage(messages, calendarCtx, lang);

  let botReply = reply;

  // 6. Handle tool calls
  if (toolCall) {
    if (toolCall.name === "add_calendar_event") {
      const event = toolCall.args as unknown as ParsedEvent;
      const saved = await saveCalendarEvent(user.id, event, user.timezone);

      if (saved) {
        const tz = normalizeTimezone(user.timezone);
        const startUtc = fromZonedTime(`${event.date}T${event.start_time}:00`, tz);
        const localDate = formatInTimeZone(startUtc, tz, "EEE d MMM");

        // Get the saved event's ID
        const admin = getAdminSupabase();
        const { data: rows } = await admin
          .from("calendar_events")
          .select("id")
          .eq("user_id", user.id)
          .eq("title", event.title)
          .order("created_at", { ascending: false })
          .limit(1);
        const eventId = (rows?.[0] as { id: string } | undefined)?.id ?? "";

        // Conflict warning
        let warning = "";
        const conflictsAfter = upcoming.filter((e) => {
          const eStart = new Date(e.starts_at);
          const eventEnd = fromZonedTime(`${event.date}T${event.end_time}:00`, normalizeTimezone(user.timezone));
          const diffMin = (eStart.getTime() - eventEnd.getTime()) / 60000;
          return diffMin > 0 && diffMin < 90 &&
            event.energy_after === "low" &&
            ["dinner","lunch","coffee","drinks","bar","party","concert","theatre"].includes(e.title.toLowerCase());
        });
        if (conflictsAfter.length) {
          warning = lang === "ru"
            ? `\n\n⚠️ После — ${conflictsAfter[0].title}. Может быть тяжело.`
            : `\n\n⚠️ You have ${conflictsAfter[0].title} right after — might be tough.`;
        }

        const card = buildEventCard(
          eventId, event.title, localDate,
          event.start_time, event.end_time,
          event.energy_after, event.dress_code, lang,
        );
        card.text += warning;

        await saveMessage(user.id, "assistant", card.text);
        await sendMessage(chatId, card.text, card.reply_markup);
        return;
      } else {
        botReply = lang === "ru" ? "Не удалось сохранить событие." : "Could not save the event.";
      }
    } else if (toolCall.name === "save_onboarding_info") {
      const info = toolCall.args as unknown as {
        interests: string[];
        wake_time?: string;
        sleep_time?: string;
        work_start?: string;
        work_end?: string;
        summary: string;
      };
      await saveOnboardingInfo(user.id, info);

      botReply = lang === "ru"
        ? `Отлично, всё запомнил! 🙌\n\nТеперь просто пиши мне что планируешь:\n• "Завтра в 18:00 зал"\n• "В пятницу деловой ужин"\n• "Хочу поужинать после зала — когда лучше?"`
        : `Perfect, got it all! 🙌\n\nNow just tell me your plans:\n• "Tomorrow gym at 6pm"\n• "Friday business dinner"\n• "Want dinner after gym — when's best?"`;
    } else if (toolCall.name === "find_free_slot") {
      // The AI's text reply already contains the suggestion
      botReply = reply || (lang === "ru" ? "Дай подумаю..." : "Let me think...");
    }
  }

  // 7. Save and send reply
  if (botReply) {
    await saveMessage(user.id, "assistant", botReply);
    await sendMessage(chatId, botReply);
  }
}

export async function handleCallbackQuery(callbackQuery: {
  id: string;
  from: { id: number; language_code?: string };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
}) {
  const { getTelegramBotToken } = await import("@/lib/env");
  const token = getTelegramBotToken();
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data ?? "";
  const lang: "ru" | "en" = callbackQuery.from.language_code === "ru" ? "ru" : "en";

  // Answer the callback to dismiss the loading spinner
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQuery.id }),
  });

  if (!chatId) return;

  // remind:<eventId> — show time picker
  if (data.startsWith("remind:")) {
    const eventId = data.slice(7);
    const reply_markup = {
      inline_keyboard: [
        [
          { text: "15 мин", callback_data: `remind_set:${eventId}:15` },
          { text: "30 мин", callback_data: `remind_set:${eventId}:30` },
          { text: "1 час", callback_data: `remind_set:${eventId}:60` },
        ],
        [
          { text: "2 часа", callback_data: `remind_set:${eventId}:120` },
          { text: "Утром", callback_data: `remind_set:${eventId}:morning` },
        ],
      ],
    };
    await sendMessage(chatId, lang === "ru" ? "🔔 За сколько напомнить?" : "🔔 How far in advance?", reply_markup);
    return;
  }

  // remind_set:<eventId>:<minutes|morning>
  if (data.startsWith("remind_set:")) {
    const parts = data.split(":");
    const eventId = parts[1];
    const preset = parts[2];
    const adminSupabase = getAdminSupabase();
    const { data: rows } = await adminSupabase
      .from("calendar_events")
      .select("starts_at, title")
      .eq("id", eventId)
      .limit(1);
    const calEvent = rows?.[0] as { starts_at: string; title: string } | undefined;
    if (!calEvent) return;

    const startsAt = parseISO(calEvent.starts_at);
    let remindAt: Date;
    let label: string;

    const { data: userRows } = await adminSupabase
      .from("users")
      .select("id, timezone")
      .eq("telegram_id", String(callbackQuery.from.id))
      .limit(1);
    const userId = (userRows?.[0] as { id: string; timezone: string } | undefined)?.id;
    const userTz = normalizeTimezone((userRows?.[0] as { id: string; timezone: string } | undefined)?.timezone ?? "Europe/Moscow");
    if (!userId) return;

    if (preset === "morning") {
      // Build 09:00 in the user's local timezone on the event day
      const eventDayLocal = toZonedTime(startsAt, userTz);
      const morningLocal = setMinutes(setHours(eventDayLocal, 9), 0);
      const morning = fromZonedTime(morningLocal, userTz);
      remindAt = morning > new Date() ? morning : addMinutes(startsAt, -60);
      label = lang === "ru" ? "утром" : "in the morning";
    } else {
      const minutes = parseInt(preset, 10);
      remindAt = addMinutes(startsAt, -minutes);
      label = lang === "ru"
        ? minutes < 60 ? `за ${minutes} мин` : `за ${minutes / 60} ч`
        : minutes < 60 ? `${minutes} min before` : `${minutes / 60}h before`;
    }

    await createReminder({ userId, eventId, chatId, remindAt });

    const timeStr = formatInTimeZone(remindAt, userTz, "HH:mm");
    await sendMessage(chatId, lang === "ru"
      ? `🔔 Напомню ${label} (${timeStr})`
      : `🔔 Reminder set ${label} (${timeStr})`);
    return;
  }

  // delete:<eventId>
  if (data.startsWith("delete:")) {
    const eventId = data.slice(7);
    const adminSupabase = getAdminSupabase();
    const { data: rows } = await adminSupabase
      .from("calendar_events")
      .select("title")
      .eq("id", eventId)
      .limit(1);
    const title = (rows?.[0] as { title: string } | undefined)?.title ?? "событие";
    const reply_markup = {
      inline_keyboard: [[
        { text: lang === "ru" ? "✅ Удалить" : "✅ Delete", callback_data: `delete_confirm:${eventId}` },
        { text: lang === "ru" ? "❌ Отмена" : "❌ Cancel", callback_data: "cancel" },
      ]],
    };
    await sendMessage(chatId, lang === "ru" ? `Удалить «${title}»?` : `Delete "${title}"?`, reply_markup);
    return;
  }

  // delete_confirm:<eventId>
  if (data.startsWith("delete_confirm:")) {
    const eventId = data.slice(15);
    const adminSupabase = getAdminSupabase();

    // Look up userId from telegram_id
    const { data: userRows } = await adminSupabase
      .from("users")
      .select("id")
      .eq("telegram_id", String(callbackQuery.from.id))
      .limit(1);
    const userId = (userRows?.[0] as { id: string } | undefined)?.id;
    if (!userId) return;

    // Delete only if owned by this user
    await adminSupabase
      .from("calendar_events")
      .delete()
      .eq("id", eventId)
      .eq("user_id", userId);
    await sendMessage(chatId, lang === "ru" ? "🗑️ Удалено." : "🗑️ Deleted.");
    return;
  }

  // edit:<eventId>
  if (data.startsWith("edit:")) {
    const eventId = data.slice(5);
    const adminSupabase = getAdminSupabase();
    const { data: rows } = await adminSupabase
      .from("calendar_events")
      .select("title, starts_at, ends_at, location")
      .eq("id", eventId)
      .limit(1);
    const ev = rows?.[0] as { title: string; starts_at: string; ends_at: string; location: string | null } | undefined;
    if (!ev) return;
    const startStr = formatInTimeZone(ev.starts_at, "UTC", "HH:mm");
    const details = `«${ev.title}» · ${startStr}${ev.location ? ` · ${ev.location}` : ""}`;
    await sendMessage(chatId, lang === "ru"
      ? `Что изменить в ${details}?\nНапиши, например: «переставь на 19:00» или «добавь место — кофейня»`
      : `What should I change in ${details}?\nE.g. "move to 7pm" or "add location — coffee shop"`);
    return;
  }

  // cancel
  if (data === "cancel") {
    await sendMessage(chatId, lang === "ru" ? "Окей, отменено." : "Cancelled.");
  }
}
