# Wheno Improvements Design

**Date:** 2026-05-31  
**Approach:** Incremental — Mini app → Bot → Voice  

---

## Overview

Three independent improvements delivered in sequence:

1. **Mini app redesign** — dark minimalist UI, week strip navigation, stats, filters, swipe actions, quick-add form
2. **Bot improvements** — structured card responses with inline action buttons, quick reminder flow
3. **Voice messages** — Whisper transcription with confirmation before adding to calendar

---

## Part 1 — Mini App Redesign

### Visual Style

- Background: `#0f0f0f`
- Cards: `#1a1a1a`, border `#2a2a2a`, border-radius `12–16px`
- Primary text: `#ffffff`, secondary: `#888888`, muted: `#555555`
- Accent: white (`#ffffff`) for selected/active states
- No gradients, no shadows — flat dark

### Main Screen `/calendar`

**Week strip (top):**
- 7 columns, current day highlighted with white circle around date number
- Day abbreviated label above number (ПН, ВТ, …)
- Dot below day number if it has events
- Tapping a day switches the event list below

**Stats bar (below week strip):**
- Single line: `3 тренировки · 2 ужина · 4 встречи`
- Computed from `calendar_events` for the current week, grouped by `activity_type`:
  - Sport group: `gym | run | swim | tennis | cycling | yoga | sport`
  - Social group: `dinner | lunch | coffee | drinks | bar | party | concert | theatre | cinema`
  - Work group: `work | meeting | conference | call`
- Only non-zero categories shown

**Filter tabs (below stats):**
- `Все / Спорт / Работа / Социальное`
- Filters the event list for the selected day
- Active tab: white pill; inactive: `#1a1a1a` pill

**Event list:**
- One card per event, sorted by `starts_at`
- Card: emoji icon for `activity_type` + title + time range + energy badge
- Swipe left on card → reveals `Удалить` (red) and `Изменить` (grey) action buttons
- Implemented via CSS `transform: translateX` on `touchstart`/`touchmove`/`touchend` — no external libraries
- Empty state: dashed border card with text

**FAB `+` button:**
- Fixed bottom-right, white circle, black `+`
- Opens quick-add form inline (not a new page)

**Quick-add form (inline sheet):**
- Fields: title (text), date (defaults today), start time, end time, type (select)
- Submit calls existing `createCalendarEvent` server action
- Cancel dismisses sheet

### Event Detail (tap on card)

- Full info: title, date/time, location, dress code, energy after
- `🔔 Напомнить` button — triggers inline reminder options (see Part 2)
- `✏️ Изменить` — edit form (same fields as quick-add)
- `🗑️ Удалить` — confirm dialog, then delete

### Files Changed

- `src/components/personal-calendar.tsx` — full rewrite with dark theme, week strip, stats, filters
- `src/app/calendar/page.tsx` — pass `calendarEvents` (from `calendar_events` table, not `busy_blocks`)
- `src/lib/db/queries.ts` — add `getCalendarEventsForUserInRange`
- New component: `src/components/calendar-event-card.tsx` — swipe-enabled card
- New component: `src/components/quick-add-sheet.tsx` — inline add form

---

## Part 2 — Bot Improvements

### Card Response Format

After any event is added (text or voice), bot sends:

```
✅ {title} добавлен
📅 {day} · {start_time}–{end_time}
{activity_emoji} {activity_type} · {energy_emoji} {energy_after}
[optional] ⚠️ {conflict warning if energy=low and social event within 90min}
```

With inline keyboard:
```
[🔔 Напомнить]  [✏️ Изменить]  [🗑️ Удалить]
```

### Reminder Flow

1. User taps `🔔 Напомнить`
2. Bot replies with inline keyboard:
   ```
   [15 мин]  [30 мин]  [1 час]  [2 часа]  [Утром]  [Своё ✏️]
   ```
3. User taps a preset → bot confirms: `🔔 Напомню за 30 мин (17:30)`
4. User taps `Своё ✏️` → bot asks: `Напиши за сколько напомнить (например: "45 мин" или "3 часа")`
5. At `remind_at` time → bot sends: `⏰ Через 30 минут — {title} в {start_time}`

### Edit / Delete via Callback

- `✏️ Изменить` → bot replies with current event details and asks what to change (freeform text, processed by GPT)
- `🗑️ Удалить` → bot asks confirmation: `Удалить {title}? [Да] [Нет]` → on confirm, deletes from DB

### New DB Table

```sql
create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  event_id    uuid not null references public.calendar_events(id) on delete cascade,
  remind_at   timestamptz not null,
  sent        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on public.reminders(remind_at) where sent = false;
```

### Cron Job (Vercel)

- `src/app/api/cron/reminders/route.ts` — GET handler
- Queries `reminders` where `remind_at <= now() AND sent = false`
- Sends Telegram message for each, marks `sent = true`
- Configured in `vercel.json`: `{ "crons": [{ "path": "/api/cron/reminders", "schedule": "* * * * *" }] }`
- Protected by `CRON_SECRET` env var checked against `Authorization` header

### Files Changed

- `src/lib/bot-handler.ts` — add `callback_query` handler, card response helper, edit/delete flow
- `src/app/api/bot/route.ts` — handle `callback_query` alongside `message`
- `src/app/api/cron/reminders/route.ts` — new cron endpoint
- `src/lib/db/queries.ts` — add reminder CRUD
- `vercel.json` — add cron config
- `supabase/schema_v3.sql` — reminders table + index

---

## Part 3 — Voice Messages

### Flow

1. User sends voice message in bot chat
2. `bot-handler.ts` detects `msg.voice` and calls `transcribeVoice(fileId)`
3. `transcribeVoice`:
   - Calls `https://api.telegram.org/bot{token}/getFile?file_id={fileId}` to get download URL
   - Downloads OGG file
   - Sends to OpenAI `whisper-1` model as `audio/ogg`
   - Returns transcription string
4. Bot saves transcription to `pending_voice` table and replies:
   ```
   🎤 Расслышал: «{transcription}»

   Добавить событие?
   [✅ Добавить]  [✏️ Исправить]  [❌ Отмена]
   ```
5. `✅ Добавить` — passes transcription to `processMessage` as regular user text, adds event, shows card
6. `✏️ Исправить` — bot replies: `Напиши исправленный вариант текстом` — next message treated as corrected text, processed normally
7. `❌ Отмена` — bot replies: `Окей, отменено.`, deletes `pending_voice` row

### New DB Table

```sql
create table public.pending_voice (
  user_id       uuid primary key references public.users(id) on delete cascade,
  transcription text not null,
  expires_at    timestamptz not null default (now() + interval '5 minutes')
);
```

Row replaced on each new voice message. Expired rows ignored (cleanup via cron or on next voice).

### Files Changed

- `src/lib/openai.ts` — add `transcribeVoice(fileId: string): Promise<string>`
- `src/lib/bot-handler.ts` — add voice message handling, `pending_voice` state management
- `src/lib/db/queries.ts` — add `pending_voice` CRUD
- `supabase/schema_v3.sql` — `pending_voice` table (same migration as reminders)

---

## Implementation Order

1. **Part 1** — Mini app redesign (pure frontend, no new APIs)
2. **Part 2** — Bot card responses + reminders (new DB table + cron)
3. **Part 3** — Voice messages (Whisper integration)

Each part is independently deployable and testable.

---

## Environment Variables Required

| Variable | Used by |
|---|---|
| `TELEGRAM_BOT_TOKEN` | existing |
| `OPENAI_API_KEY` | existing + Whisper |
| `CRON_SECRET` | new — protects cron endpoint |
