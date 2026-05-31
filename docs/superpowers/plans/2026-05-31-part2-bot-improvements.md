# Part 2: Bot Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bot replies with a card + inline buttons after adding an event. Buttons: remind (quick time picker), edit, delete. Cron job sends reminders at the right time.

**Architecture:** Telegram inline keyboards via `reply_markup`. New `callback_query` handler in `route.ts` dispatches to `bot-handler.ts`. Reminders stored in new `reminders` table; Vercel cron polls every minute.

**Tech Stack:** Next.js App Router, TypeScript, Telegram Bot API (inline keyboards + callback_query), Supabase admin client, Vercel Cron

**Depends on:** Part 1 (uses `calendar_events` table)

---

## File Map

**Create:**
- `supabase/schema_v3.sql` — `reminders` table
- `src/app/api/cron/reminders/route.ts` — cron endpoint
- `vercel.json` — cron config

**Modify:**
- `src/lib/db/queries.ts` — reminder CRUD
- `src/lib/types.ts` — `Reminder` type
- `src/lib/bot-handler.ts` — card response format, callback handlers
- `src/app/api/bot/route.ts` — handle `callback_query`
- `src/lib/env.ts` — add `getCronSecret()`

---

## Task 1: Reminders DB table

**Files:**
- Create: `supabase/schema_v3.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/schema_v3.sql`:

```sql
-- wheno v3 — reminders

create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  event_id   uuid not null references public.calendar_events(id) on delete cascade,
  chat_id    bigint not null,
  remind_at  timestamptz not null,
  sent       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reminders_pending on public.reminders(remind_at)
  where sent = false;

alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase dashboard → SQL Editor → paste contents of `supabase/schema_v3.sql` → Run.
Expected: no errors, table `reminders` appears in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_v3.sql
git commit -m "feat: add reminders table migration"
```

---

## Task 2: Reminder type + CRUD

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db/queries.ts`

- [ ] **Step 1: Add Reminder type to `src/lib/types.ts`**

```typescript
export type Reminder = {
  id: string;
  user_id: string;
  event_id: string;
  chat_id: number;
  remind_at: string;
  sent: boolean;
  created_at: string;
};
```

- [ ] **Step 2: Add reminder CRUD to `src/lib/db/queries.ts`**

Add `Reminder` to the existing type import. Then add at the bottom:

```typescript
export async function createReminder({
  userId,
  eventId,
  chatId,
  remindAt,
}: {
  userId: string;
  eventId: string;
  chatId: number;
  remindAt: Date;
}): Promise<void> {
  const admin = getAdminSupabase();
  await admin.from("reminders").insert({
    user_id: userId,
    event_id: eventId,
    chat_id: chatId,
    remind_at: remindAt.toISOString(),
  });
}

export async function getPendingReminders(): Promise<
  Array<Reminder & { event_title: string; event_starts_at: string }>
> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("reminders")
    .select("*, calendar_events(title, starts_at)")
    .lte("remind_at", new Date().toISOString())
    .eq("sent", false);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as Reminder),
    event_title: (row.calendar_events as { title: string; starts_at: string }).title,
    event_starts_at: (row.calendar_events as { title: string; starts_at: string }).starts_at,
  }));
}

export async function markReminderSent(id: string): Promise<void> {
  const admin = getAdminSupabase();
  await admin.from("reminders").update({ sent: true }).eq("id", id);
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/db/queries.ts
git commit -m "feat: add Reminder type and CRUD functions"
```

---

## Task 3: Bot card responses + callback handler

**Files:**
- Modify: `src/lib/bot-handler.ts`

- [ ] **Step 1: Add card reply helper to `src/lib/bot-handler.ts`**

Add this helper function after the existing `sendMessage` function:

```typescript
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
      { text: "🔔 Напомнить", callback_data: `remind:${eventId}` },
      { text: "✏️ Изменить", callback_data: `edit:${eventId}` },
      { text: "🗑️ Удалить", callback_data: `delete:${eventId}` },
    ]],
  };

  return { text, reply_markup };
}
```

- [ ] **Step 2: Replace the event-added reply in `handleBotMessage`**

Find the block in `handleBotMessage` where `botReply` is set for `add_calendar_event` (lines ~260–290). Replace it with:

```typescript
if (toolCall.name === "add_calendar_event") {
  const event = toolCall.args as unknown as ParsedEvent;
  const saved = await saveCalendarEvent(user.id, event, user.timezone);

  if (saved) {
    const tz = normalizeTimezone(user.timezone);
    const startUtc = fromZonedTime(`${event.date}T${event.start_time}:00`, tz);
    const localDate = formatInTimeZone(startUtc, tz, "EEE d MMM");

    // Get the event ID for the card buttons
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
}
```

- [ ] **Step 3: Add `handleCallbackQuery` export to `src/lib/bot-handler.ts`**

Add this function at the bottom of the file:

```typescript
import { createReminder, markReminderSent } from "@/lib/db/queries";
import { addMinutes, parseISO, setHours, setMinutes } from "date-fns";

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
    const [, eventId, preset] = data.split(":");
    const admin = getAdminSupabase();
    const { data: rows } = await admin
      .from("calendar_events")
      .select("starts_at, title")
      .eq("id", eventId)
      .limit(1);
    const event = rows?.[0] as { starts_at: string; title: string } | undefined;
    if (!event) return;

    const startsAt = parseISO(event.starts_at);
    let remindAt: Date;
    let label: string;

    if (preset === "morning") {
      // 09:00 on the event day; if event is today and current time >= 09:00, use 1h before
      const morning = setMinutes(setHours(startsAt, 9), 0);
      remindAt = morning > new Date() ? morning : addMinutes(startsAt, -60);
      label = lang === "ru" ? "утром" : "in the morning";
    } else {
      const minutes = parseInt(preset, 10);
      remindAt = addMinutes(startsAt, -minutes);
      label = lang === "ru"
        ? minutes < 60 ? `за ${minutes} мин` : `за ${minutes / 60} ч`
        : minutes < 60 ? `${minutes} min before` : `${minutes / 60}h before`;
    }

    const { data: userRows } = await admin.from("users").select("id").eq("telegram_id", String(callbackQuery.from.id)).limit(1);
    const userId = (userRows?.[0] as { id: string } | undefined)?.id;
    if (!userId) return;

    await createReminder({ userId, eventId, chatId, remindAt });

    const timeStr = formatInTimeZone(remindAt, "Europe/Moscow", "HH:mm");
    await sendMessage(chatId, lang === "ru"
      ? `🔔 Напомню ${label} (${timeStr})`
      : `🔔 Reminder set ${label} (${timeStr})`);
    return;
  }

  // delete:<eventId>
  if (data.startsWith("delete:")) {
    const eventId = data.slice(7);
    const admin = getAdminSupabase();
    const { data: rows } = await admin.from("calendar_events").select("title").eq("id", eventId).limit(1);
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
    const admin = getAdminSupabase();
    await admin.from("calendar_events").delete().eq("id", eventId);
    await sendMessage(chatId, lang === "ru" ? "🗑️ Удалено." : "🗑️ Deleted.");
    return;
  }

  // edit:<eventId>
  if (data.startsWith("edit:")) {
    const eventId = data.slice(5);
    const admin = getAdminSupabase();
    const { data: rows } = await admin
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
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-handler.ts
git commit -m "feat: bot card responses with inline keyboard + callback handlers"
```

---

## Task 4: Update bot route to handle callback_query

**Files:**
- Modify: `src/app/api/bot/route.ts`

- [ ] **Step 1: Replace contents of `src/app/api/bot/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { handleBotMessage, handleCallbackQuery } from "@/lib/bot-handler";
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
    const update = await request.json() as {
      message?: Parameters<typeof handleBotMessage>[0]["message"];
      callback_query?: Parameters<typeof handleCallbackQuery>[0];
    };

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.message) {
      await handleBotMessage({ message: update.message });
    }
  } catch (err) {
    console.error("Bot handler error:", err);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bot/route.ts
git commit -m "feat: handle callback_query in bot route"
```

---

## Task 5: Cron reminder endpoint

**Files:**
- Modify: `src/lib/env.ts`
- Create: `src/app/api/cron/reminders/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Add `getCronSecret` to `src/lib/env.ts`**

```typescript
export function getCronSecret() {
  return getRequiredEnv("CRON_SECRET", "");
}
```

- [ ] **Step 2: Create `src/app/api/cron/reminders/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { getPendingReminders, markReminderSent } from "@/lib/db/queries";
import { getCronSecret, getTelegramBotToken } from "@/lib/env";

export async function GET(request: Request) {
  const secret = getCronSecret();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const reminders = await getPendingReminders();
  const token = getTelegramBotToken();

  for (const reminder of reminders) {
    const timeStr = formatInTimeZone(reminder.event_starts_at, "UTC", "HH:mm");
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: reminder.chat_id,
        text: `⏰ Напоминание: <b>${reminder.event_title}</b> в ${timeStr}`,
        parse_mode: "HTML",
      }),
    });
    await markReminderSent(reminder.id);
  }

  return NextResponse.json({ ok: true, sent: reminders.length });
}
```

- [ ] **Step 3: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "* * * * *"
    }
  ]
}
```

- [ ] **Step 4: Add `CRON_SECRET` to Vercel env vars**

Go to Vercel → Settings → Environment Variables → add:
- Key: `CRON_SECRET`
- Value: any random string, e.g. `cron_wheno_2026`

- [ ] **Step 5: Type-check + build**

```bash
npx tsc --noEmit && npx next build
```
Expected: no errors

- [ ] **Step 6: Deploy**

```bash
git add src/lib/env.ts src/app/api/cron/reminders/route.ts vercel.json
git commit -m "feat: cron reminder endpoint and vercel.json"
git push origin main
```
Expected: Vercel builds successfully. Cron appears under Settings → Crons.

- [ ] **Step 7: Manual test**

1. Send a message to the bot: `Завтра зал в 18:00`
2. Bot replies with card + 3 buttons
3. Tap `🔔 Напомнить` → time picker appears
4. Tap `15 мин` → bot confirms
5. Verify row in Supabase `reminders` table with correct `remind_at`
6. Tap `🗑️ Удалить` → confirmation appears → tap confirm → event deleted
