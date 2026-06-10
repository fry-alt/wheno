# Voice schedule building (multi-action) — design

**Date:** 2026-06-11
**Status:** approved (brainstorm)
**Feature:** One voice (or text) message produces a batch of mixed calendar changes — create multiple events, add day-notes, and edit/delete existing events — reviewed on a confirmation screen before applying.

## Goal

Today the `+` capture sheet turns one voice/text message into **exactly one** event (`parseEvent` → single `create_event` tool → `ConfirmCard` → `createParsedEventAction`). The user wants to speak a whole schedule in one message and have it understood as several actions at once:

- create **several** events,
- **add day-notes**,
- **edit** existing events,
- **delete** existing events,

then confirm everything on one review screen before it's applied.

## Scope

In scope:
- Upgrade the `+` capture sheet's NL/voice mode to **multi-action**.
- New LLM "plan" that returns a list of typed actions: `create` / `edit` / `delete` / `note`.
- Pass the user's **upcoming-30-day** events (with expanded recurrences) to the model so `edit`/`delete` can reference real events.
- Recurring `edit`/`delete`: the model infers **scope** (`one` occurrence vs `all` series); shown explicitly on the review screen.
- A **ReviewSheet** that groups proposed actions, lets the user uncheck any, and applies the rest in one batch.
- Partial-success apply (per-action), with a result summary.

Out of scope (deferred):
- **Editing/deleting notes** by voice (notes are add-only, per the request wording).
- The other four follow-up asks (animations, optimization, further design) — separate cycles.
- Changing the manual single-event form or the existing single-event `ConfirmCard` path (kept as-is for the "Вручную" flow and as fallback).

## Decisions (locked during brainstorm)

| Question | Decision |
|---|---|
| Entry point | **Upgrade the existing `+`** NL/voice mode to multi-action. Manual form stays as fallback. |
| Match window | Existing events from **today → +30 days**, recurrences expanded. |
| Recurring edit/delete | **Model infers scope** (`one` vs `all`); ReviewSheet shows "только это / вся серия". |
| Notes | **Add only.** |
| Model | **gpt-4o-mini** to start (cheap; ReviewSheet is the safety net). Bump to gpt-4o if matching is weak. |
| Safety | **Always** show ReviewSheet before applying. No silent writes. |

## Architecture — data flow

```
«+» → NL/voice
  ├─ 🎤 → POST /api/transcribe (Whisper, existing) → transcript
  └─ transcript + server context (today, tz, events[+30d]) → POST /api/voice-plan
        ├─ buildEventContext(): getEventsInRange(today, today+30d, tz) → compact list
        ├─ planSchedule(transcript, ctx): gpt-4o-mini, tool `plan_schedule` → raw actions[]
        └─ normalizeVoicePlan(raw, ctx): validate/repair → VoiceAction[]   (pure, tested)
  → ReviewSheet (grouped ➕ ✏️ 🗑 📌, checkboxes, scope labels)
  → «Применить (N)» → applyVoicePlanAction(selected) → loop existing queries → revalidate
  → toast: applied N / failed M
```

The event context is assembled **server-side** in `/api/voice-plan`; the client never sends events. The route signature mirrors `/api/parse-event` (auth, `{ text }` in, plan out).

## LLM action plan

One function tool `plan_schedule` returning `{ actions: RawAction[] }`. Each action is discriminated by `type`:

| `type` | fields |
|---|---|
| `create` | `title, category, starts_at, ends_at, is_fixed, recur_freq?, recur_weekdays?, recur_until?, recur_count?` (same shape as today's `parseEvent`) |
| `edit` | `target_id`, `target_scope: "one"\|"all"\|null`, `target_date: yyyy-MM-dd\|null`, **plus the full new event state** (`title, category, starts_at, ends_at, is_fixed`) |
| `delete` | `target_id`, `target_scope`, `target_date` |
| `note` | `note_date: yyyy-MM-dd`, `note_text` |

`starts_at`/`ends_at` are ISO 8601 with the user's timezone offset (as `parseEvent` already does).

**Event context passed to the model** — compact, one line per upcoming instance:
```
{ id, recurring: boolean, date: "yyyy-MM-dd", start: "HH:mm", title, category }
```
- one-off target → `target_id = id`, `target_scope = null`.
- whole series → `target_id = id` (parent row id), `target_scope = "all"`.
- single occurrence of a series → `target_id = id`, `target_scope = "one"`, `target_date = <date>`.

Recurring instances in the window repeat the same `id` across dates; the model selects the date.

### `normalizeVoicePlan(raw, ctx)` — pure, TDD

Validates and repairs the raw model output into `VoiceAction[]`:
- drop actions with unknown `type`;
- `create`: require title + valid `category` (fallback `"other"`) + parseable `starts_at`/`ends_at` (default end = start + 1h); normalize recurrence exactly like `parseEvent`;
- `edit`/`delete`: require `target_id` present in `ctx` events; if the target is recurring and `target_scope` is missing/invalid, default to **`one`** with `target_date` (never silently `all`); if `one` but `target_date` not in the window, drop the action;
- `note`: require valid `note_date` (yyyy-MM-dd) + non-empty text;
- return `{ actions: VoiceAction[] }`; the LLM call itself is mocked in tests, only normalization is unit-tested.

## Apply — server action

`applyVoicePlanAction(actions: VoiceAction[]): Promise<{ applied: number; failed: number }>`:
- `requireCurrentUser()` once; one `revalidatePath("/calendar")` (+ `/notes` if any notes) at the end.
- maps each action to the **existing queries layer** (so we don't pay per-action auth/revalidate):
  - `create` → `insertEvent`
  - `note` → `insertNote({ user_id, content, date })`
  - `edit`: one-off → `updateEventById`; series (`all`) → `updateSeries`; occurrence (`one`) → `addExcludedDate` + `insertEvent` (override), mirroring `editOccurrenceAction`
  - `delete`: one-off/series → `deleteEventById`; occurrence (`one`) → `addExcludedDate`
- per-action `try/catch`; tally `applied`/`failed`; never throw the whole batch on one failure.

## ReviewSheet (confirmation UI)

```
┌──────────────────────────────────┐
│  Вот что я понял · 5 изменений    │
│  ➕ Создать                        │
│   ☑ 🏋 Зал · ср 11, 19:00–20:00   │
│   ☑ 💻 Работа · пн–пт 10:00 🔁    │
│  ✏️ Изменить                       │
│   ☑ 💼 Созвон · чт 12 → 15:00      │
│  🗑 Удалить                        │
│   ☑ 🍽 Ужин · чт 12 (только это)  │
│  📌 Заметка                        │
│   ☑ 12 июн · «купить подарок»     │
│  ───────────────────────────────  │
│  [ Применить (5) ]    [ Отмена ]  │
└──────────────────────────────────┘
```
- Grouped by action type; each row is a checkbox (unchecking excludes it from apply).
- Recurring edit/delete rows always carry a scope label ("только это" / "вся серия").
- The raw transcript shows small at the top and is editable → "Разобрать заново" re-runs the plan.
- Empty/no understood actions → "Не понял, попробуй иначе" + re-record.
- Built on the Refined-dark tokens/primitives (`Surface`, `SectionLabel`, `IconButton`).

## Files

| File | Change |
|---|---|
| `src/lib/events/voice-plan.ts` | **new** — `VoiceAction` types + `planSchedule(text, ctx)` (gpt-4o-mini, `plan_schedule` tool) |
| `src/lib/events/voice-plan-normalize.ts` | **new** (+ `.test.ts`) — pure `normalizeVoicePlan` |
| `src/app/api/voice-plan/route.ts` | **new** — auth, build +30d context, plan → normalize → respond |
| `src/lib/events/voice-actions.ts` | **new** — `applyVoicePlanAction` (batch over queries layer) |
| `src/components/capture/review-sheet.tsx` | **new** — multi-action review UI |
| `src/components/capture/capture-sheet.tsx` | **mod** — NL/voice path calls `/api/voice-plan` → ReviewSheet; manual + single ConfirmCard stay |

## Error handling
- Transcribe failure → existing "Не расслышал" message.
- Plan failure / empty actions → "Не понял, попробуй иначе" (re-record / edit text).
- Per-action apply failure → counted in `failed`; others still applied; summary toast.
- Wrong id match → caught by the user on ReviewSheet (uncheck). Mitigation lever: raise model to gpt-4o.

## Testing
- `normalizeVoicePlan` — unit tests (Vitest): each action type, category fallback, end-default, recurring scope defaulting to `one`, dropping targets not in context, bad dates. Mirrors `parse`/`categories` test style.
- `planSchedule` — LLM mocked; assert it forwards context + parses tool args into raw actions.
- `applyVoicePlanAction` — queries mocked; assert correct query per action/scope and partial-failure tally.
- Components validated visually (run/verify) with the Refined-dark look.

## Provider note
This builds on the existing **OpenAI** usage (`whisper-1`, `gpt-4o-mini`); no Anthropic/Claude APIs involved.
