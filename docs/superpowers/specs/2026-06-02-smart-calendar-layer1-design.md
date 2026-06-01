# Smart Calendar — Layer 1: Personal Calendar + Notes

**Date:** 2026-06-02
**Status:** Design approved, ready for implementation plan

---

## Product Vision (3 layers)

A smart personal calendar in Telegram. Built in three independent, layered sub-projects:

1. **Layer 1 — Personal Calendar + Notes** *(this spec)* — the foundation. Events (fixed/flexible), three kinds of notes, natural-language + manual capture, calendar and notes screens.
2. **Layer 2 — AI Schedule Advisor** *(future)* — user asks "when can I fit the gym 3× this week?", AI reads fixed events and proposes 2-3 slots respecting preferences.
3. **Layer 3 — Shared Meetings** *(future)* — invite a friend, AI finds a common slot, both confirm, it lands in both calendars.

Each layer ships as a working product on its own. This spec covers **Layer 1 only**.

**Stack (unchanged):** Telegram Mini App · Next.js 15 App Router · Supabase · OpenAI · Tailwind v4 · deployed on Vercel.

**AI character (decided):** advisor — the user asks, AI suggests, the user always decides. (Relevant to Layer 2; in Layer 1 the only AI is natural-language parsing of captured events.)

---

## Goals

1. Open the app → land on your calendar.
2. Capture an event by typing or speaking ("завтра зал в 7 на час") → AI parses → confirm → saved.
3. Also add/edit events with a plain manual form.
4. Keep three kinds of notes: per-event, per-day, and standalone tasks.
5. Events carry a `is_fixed` flag (mandatory vs flexible) — the bridge to Layer 2.

---

## Data Model

Fresh schema. Old tables (groups, meetings, availability, busy_blocks, reminders, pending_voice, calendar_events) are dropped. Two new feature tables plus the existing `users` table (kept).

### `events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid fk → users | `on delete cascade` |
| `title` | text not null | "Зал", "Лекция по матану" |
| `starts_at` | timestamptz not null | |
| `ends_at` | timestamptz not null | |
| `category` | text not null | one of the known categories below |
| `is_fixed` | boolean not null | true = mandatory (study/work), false = flexible (gym). Smart default by category, user-toggleable |
| `notes` | text | nullable — per-event note |
| `location` | text | nullable |
| `created_at` | timestamptz not null | `now()` |
| `updated_at` | timestamptz not null | `now()` |

Index: `(user_id, starts_at)`.

**Categories** (drive emoji + default `is_fixed`):

| Category | Emoji | Default is_fixed |
|---|---|---|
| `study` | 📚 | true |
| `work` | 💻 | true |
| `meeting` | 💼 | true |
| `gym` | 🏋️ | false |
| `run` | 🏃 | false |
| `meal` | 🍽️ | false |
| `coffee` | ☕ | false |
| `social` | 🎉 | false |
| `rest` | 😴 | false |
| `errand` | 🛒 | false |
| `other` | 📌 | false |

A single shared map (`src/lib/events/categories.ts`) holds emoji + default fixedness so the AI parser, the form, and the views all agree.

### `notes`

Covers day-notes and standalone tasks. (Per-event notes live in `events.notes`.)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk → users | `on delete cascade` |
| `content` | text not null | |
| `date` | date | nullable. **set** → day note · **null** → standalone task |
| `done` | boolean not null | default false (task checkbox; harmless for day notes) |
| `created_at` | timestamptz not null | `now()` |

Index: `(user_id, date)`.

---

## Capture Flow

Two entry points, one result.

### A. Natural language (the headline feature)

```
User types/speaks: «завтра зал в 7 утра на час»
        ↓
parseEvent(text, { today, timezone })  — OpenAI structured output
        ↓
returns { title, category, starts_at, ends_at, is_fixed, notes? }
        ↓
Confirmation card:
   🏋️ Зал
   Завтра, 07:00–08:00 · гибкое
   [✅ Добавить]  [✏️ Изменить]  [✕]
        ↓
✅ → createEvent     ✏️ → opens manual form prefilled     ✕ → discard
```

- **Two surfaces:** inside the Mini App (a text field + 🎤 mic button on the capture sheet) and in the Telegram bot chat (plain text or voice message).
- **Voice:** Telegram voice message → `transcribeVoice` (existing Whisper util) → same `parseEvent` path.
- **Parser** (`src/lib/events/parse.ts`): OpenAI call with a single tool/structured-output schema matching the `events` columns. System prompt receives `today` and the user's `timezone`. Returns one parsed event. If the model can't parse a time, it defaults to a 1-hour block at the next sensible hour and the user fixes it on the confirm card.
- **Mini App voice:** recorded via the browser MediaRecorder API → uploaded to a small route that calls Whisper. (If MediaRecorder proves fiddly, the text field still works; voice in the bot chat is the reliable path.)

### B. Manual form

- Used for adding without AI and for editing (including the "✏️ Изменить" branch of the confirm card).
- Fields: title (text), category (emoji chips), date (`input type="date"`), start/end time (`input type="time"`), fixed/flexible toggle, notes (textarea).
- Native time inputs — reliable on every phone (no custom drum pickers).
- Selecting a category sets the `is_fixed` toggle to its default; the user can override.

---

## Screens & Navigation

Persistent bottom navigation with a center capture button:

```
┌─────────────────────────────────┐
│            (content)            │
├─────────────────────────────────┤
│   📅            ➕           📝   │
│ Календарь    Добавить    Заметки │
└─────────────────────────────────┘
```

`➕` opens the capture sheet (default tab: natural language; second tab: manual form).

### 📅 Calendar

```
‹  Июнь 2026  ›
Пн Вт Ср Чт Пт Сб Вс
      1  2  3  4  5
 6  7 [8] 9 10 11 12      ← dots under days with events
─────────────────────
📌 day note (if any)
─────────────────────
▮ 09:00–10:30  Лекция     ← fixed: solid left bar
▮ 11:00–17:00  Работа
┆ 17:30–18:30  Зал        ← flexible: dashed left bar
```

- Month grid: Monday-first, dots on days with events, today highlighted, selected day highlighted.
- `‹ ›` navigate months (server re-fetch via `?month=YYYY-MM`).
- Below the grid: the selected day's note (if any) then its events sorted by `starts_at`.
- Event row: time range, emoji + title, fixed (solid bar) vs flexible (dashed bar) visual distinction.
- Tap an event → manual form (edit/delete). Empty day → "Свободный день / Нажми ➕".
- Month data only (fetch current month; navigating refetches).

### 📝 Notes

```
Задачи                       ← standalone tasks (date = null)
☐ Купить абонемент
☑ Записаться к врачу

На день                      ← day notes (date set), grouped by date
8 июня · Важная встреча, не опаздывать
```

- Tasks: checkbox toggles `done`. Add via an inline input. Completed sink to the bottom.
- Day notes: read here, created from the calendar day view (a "+ заметка дня" affordance).

---

## File Structure

### Keep (infrastructure — untouched)

- `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/telegram.ts` — Telegram auth + session
- `src/lib/supabase/admin.ts` — Supabase admin client
- `src/lib/env.ts` — env access
- `src/lib/datetime.ts` — timezone/date helpers (`getDateRangeUtc`, `getLocalDateValue`, …)
- `src/lib/preferences.ts`, `src/lib/i18n.ts` — language/theme
- `src/app/api/session/route.ts` — session bootstrap
- `src/app/api/bot/route.ts` — webhook shell (handler logic rewritten)
- `transcribeVoice` from `src/lib/openai.ts` — Whisper (kept; rest of openai.ts trimmed)
- `src/components/session-bootstrap.tsx`, `src/components/avatar.tsx`, UI primitives in `src/components/ui/`

### Create

```
src/app/(app)/layout.tsx              — bottom navigation shell
src/app/(app)/calendar/page.tsx       — calendar screen (server: month fetch)
src/app/(app)/notes/page.tsx          — notes screen
src/components/calendar/month-grid.tsx
src/components/calendar/day-view.tsx
src/components/calendar/event-row.tsx
src/components/capture/capture-sheet.tsx     — tabbed: NL input + manual form
src/components/capture/confirm-card.tsx      — parsed-event confirmation
src/components/capture/event-form.tsx        — manual add/edit form
src/components/notes/task-list.tsx
src/components/notes/day-notes.tsx
src/lib/events/categories.ts          — emoji + default is_fixed map
src/lib/events/queries.ts             — event CRUD (Supabase)
src/lib/events/parse.ts               — OpenAI natural-language → ParsedEvent
src/lib/events/actions.ts             — server actions (create/update/delete)
src/lib/notes/queries.ts              — note/task CRUD
src/lib/notes/actions.ts              — server actions
src/lib/bot/handler.ts                — rewritten bot logic (capture via chat)
supabase/schema.sql                   — new clean schema
```

### Delete (old feature code)

- All groups / meetings / availability / find-time: `src/app/groups/**`, `src/app/join/**`, `src/app/meetings/**`, `src/app/availability/**`, and their components (`group-*`, `member-list`, `meeting-option-card`, `inline-availability-grid`, `availability-form`, `preference-controls`, `quick-add-sheet`, `personal-calendar`, `calendar-event-card`, `dark-shell`, `app-shell`, `group-availability-calendar`, `copy-invite-button`, `empty-state`, `form-submit-button`).
- `src/lib/scheduler.ts` (+ test), `src/lib/notify.ts`, `src/lib/actions.ts`, old `src/lib/db/queries.ts`, `src/lib/calendar-utils.ts` (+ test), `src/lib/bot-handler.ts`, old schema files (`schema_v*.sql`), `src/app/api/cron/**` (reminders — no longer in Layer 1).
- Old routes `src/app/page.tsx` redirect target updated to `(app)/calendar`.

---

## Routing

- `/` → redirect to `/calendar`.
- `/calendar` and `/notes` live under the `(app)` route group sharing the bottom-nav layout.
- Unauthenticated on any `(app)` page → dark splash + `SessionBootstrap` (existing).

---

## Error Handling

- Parse failure (OpenAI error or unparseable) → confirm card shows a best-effort guess; user edits or cancels. Never silently create.
- Event create/update/delete failures → inline error toast on the form/sheet; nothing is closed until success.
- Voice transcription failure → bot replies "не расслышал, напиши текстом"; Mini App shows a retry.
- All server actions `revalidatePath` the affected screen (`/calendar` or `/notes`).

---

## Testing

- `src/lib/events/categories.ts` — unit: every category has emoji + default fixedness.
- `src/lib/events/parse.ts` — unit with a mocked OpenAI client: given a fixture message + fixed `today`/`timezone`, asserts the parsed `{ starts_at, ends_at, category, is_fixed }` (no live API calls).
- `src/lib/datetime.ts` reuse — covered by existing helpers.
- Month-grid date math — unit: leading/trailing days, Monday-first, today/selected flags.
- Notes CRUD — unit on query builders (date-set vs null → day note vs task).

---

## Out of Scope (Layer 1)

- AI slot-finding / optimization (Layer 2).
- Preferences/onboarding model (Layer 2).
- Any multi-user / groups / shared meetings (Layer 3).
- Reminders / cron (revisit later).
- Recurring events.
