# Voice Schedule Building (multi-action) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. UI tasks are validated with the Refined-dark look via run/verify (live screenshots).

**Goal:** Turn one voice/text message into a batch of calendar actions (create events, add day-notes, edit/delete existing events), reviewed on a confirmation sheet before applying.

**Architecture:** `+` NL/voice → `/api/transcribe` (existing) → transcript → new `/api/voice-plan` (builds +30d event context, calls gpt-4o-mini `plan_schedule` tool, normalizes) → `VoiceAction[]` → `ReviewSheet` (checkboxes) → `applyVoicePlanAction` batches over the existing queries layer. Risky pure logic (normalize, apply-routing) is TDD'd; LLM/route/UI verified via typecheck/build + live.

**Tech Stack:** Next.js 16 API routes + server actions, OpenAI (`whisper-1`, `gpt-4o-mini`), date-fns/-tz, Vitest, Tailwind tokens.

**Spec:** `docs/superpowers/specs/2026-06-11-voice-schedule-multiaction-design.md`

---

## File structure

**New:**
- `src/lib/events/voice-plan-types.ts` — `VoiceAction` union, `EventContextItem`, `TargetScope`. No deps beyond `./types`.
- `src/lib/events/voice-plan-normalize.ts` (+ `.test.ts`) — pure `normalizeVoicePlan(raw, ctx)`.
- `src/lib/events/voice-plan.ts` — `planSchedule(text, ctx)` (OpenAI tool call → raw actions).
- `src/app/api/voice-plan/route.ts` — endpoint: auth → +30d context → planSchedule → normalize.
- `src/lib/events/voice-actions.ts` (+ `.test.ts`) — `applyVoicePlanAction` (batch).
- `src/components/capture/review-sheet.tsx` — multi-action review UI.

**Modified:**
- `src/components/capture/capture-sheet.tsx` — NL/voice path → `/api/voice-plan` → `ReviewSheet`.

**Conventions:** Russian labels hardcoded (existing pattern). Do not touch `src/lib/i18n.ts`. Per-task verify: `npm test` for logic, `npx tsc --noEmit` + `npx eslint <files>` for the rest; final `npm run build`.

**Note (spec deviation, intentional):** the NL path now always opens `ReviewSheet` (even for a single action), superseding the single-event `ConfirmCard`. The manual "Вручную" `EventForm` path and the `editing` path are unchanged. `confirm-card.tsx` is left in place (no longer imported by capture-sheet).

---

## Task 1: Types + `normalizeVoicePlan` (TDD)

**Files:**
- Create: `src/lib/events/voice-plan-types.ts`
- Create: `src/lib/events/voice-plan-normalize.ts`
- Test: `src/lib/events/voice-plan-normalize.test.ts`

- [ ] **Step 1: Create the types** — `src/lib/events/voice-plan-types.ts`:

```ts
import type { ParsedEvent } from "./types";

export type TargetScope = "one" | "all";

export interface EventContextItem {
  id: string;
  recurring: boolean;
  date: string;  // yyyy-MM-dd (occurrence date)
  start: string; // HH:mm
  title: string;
  category: string;
}

export interface CreateAction { type: "create"; event: ParsedEvent }
export interface NoteAction { type: "note"; date: string; text: string }
export interface EditAction {
  type: "edit";
  targetId: string;
  recurring: boolean;
  scope: TargetScope;
  targetDate: string | null; // occurrence date when scope === "one"
  targetTitle: string;       // original title, for display
  event: ParsedEvent;        // new state
}
export interface DeleteAction {
  type: "delete";
  targetId: string;
  recurring: boolean;
  scope: TargetScope;
  targetDate: string | null;
  targetTitle: string;
}
export type VoiceAction = CreateAction | NoteAction | EditAction | DeleteAction;
```

- [ ] **Step 2: Write the failing test** — `src/lib/events/voice-plan-normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeVoicePlan } from "./voice-plan-normalize";
import type { EventContextItem } from "./voice-plan-types";

const tz = "Europe/Moscow";
const today = "2026-06-11";
const events: EventContextItem[] = [
  { id: "evt-oneoff", recurring: false, date: "2026-06-12", start: "19:00", title: "Ужин", category: "meal" },
  { id: "evt-series", recurring: true, date: "2026-06-15", start: "10:00", title: "Работа", category: "work" },
];
const ctx = { events, today, timezone: tz };

describe("normalizeVoicePlan", () => {
  it("returns [] for non-array input", () => {
    expect(normalizeVoicePlan(null, ctx)).toEqual([]);
    expect(normalizeVoicePlan({}, ctx)).toEqual([]);
  });

  it("create: defaults end to +1h and falls back category to 'other'", () => {
    const out = normalizeVoicePlan(
      [{ type: "create", title: "Зал", category: "bogus", starts_at: "2026-06-11T19:00:00+03:00", is_fixed: false }],
      ctx,
    );
    expect(out).toHaveLength(1);
    const a = out[0];
    if (a.type !== "create") throw new Error("expected create");
    expect(a.event.category).toBe("other");
    expect(new Date(a.event.ends_at).getTime() - new Date(a.event.starts_at).getTime()).toBe(3_600_000);
  });

  it("create: drops actions with no title or bad start", () => {
    expect(normalizeVoicePlan([{ type: "create", category: "gym", starts_at: "2026-06-11T19:00:00+03:00", is_fixed: false }], ctx)).toHaveLength(0);
    expect(normalizeVoicePlan([{ type: "create", title: "x", starts_at: "not-a-date", is_fixed: false }], ctx)).toHaveLength(0);
  });

  it("note: requires yyyy-MM-dd date and non-empty text", () => {
    expect(normalizeVoicePlan([{ type: "note", note_date: "2026-06-12", note_text: " подарок " }], ctx)).toEqual([
      { type: "note", date: "2026-06-12", text: "подарок" },
    ]);
    expect(normalizeVoicePlan([{ type: "note", note_date: "12.06", note_text: "x" }], ctx)).toHaveLength(0);
    expect(normalizeVoicePlan([{ type: "note", note_date: "2026-06-12", note_text: "  " }], ctx)).toHaveLength(0);
  });

  it("delete: drops when target_id not in context", () => {
    expect(normalizeVoicePlan([{ type: "delete", target_id: "missing" }], ctx)).toHaveLength(0);
  });

  it("delete one-off: scope all, no targetDate", () => {
    const out = normalizeVoicePlan([{ type: "delete", target_id: "evt-oneoff" }], ctx);
    expect(out[0]).toMatchObject({ type: "delete", targetId: "evt-oneoff", recurring: false, scope: "all", targetDate: null, targetTitle: "Ужин" });
  });

  it("delete recurring: defaults to scope 'one' with the occurrence date", () => {
    const out = normalizeVoicePlan([{ type: "delete", target_id: "evt-series", target_date: "2026-06-15" }], ctx);
    expect(out[0]).toMatchObject({ type: "delete", recurring: true, scope: "one", targetDate: "2026-06-15" });
  });

  it("delete recurring: scope 'all' when explicitly requested", () => {
    const out = normalizeVoicePlan([{ type: "delete", target_id: "evt-series", target_scope: "all" }], ctx);
    expect(out[0]).toMatchObject({ recurring: true, scope: "all", targetDate: null });
  });

  it("edit: carries new event state + target", () => {
    const out = normalizeVoicePlan(
      [{ type: "edit", target_id: "evt-oneoff", title: "Ужин", category: "meal", starts_at: "2026-06-12T20:00:00+03:00", ends_at: "2026-06-12T21:00:00+03:00", is_fixed: false }],
      ctx,
    );
    const a = out[0];
    if (a.type !== "edit") throw new Error("expected edit");
    expect(a.targetId).toBe("evt-oneoff");
    expect(a.event.starts_at).toBe(new Date("2026-06-12T20:00:00+03:00").toISOString());
  });

  it("drops unknown action types", () => {
    expect(normalizeVoicePlan([{ type: "nonsense" }], ctx)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npm test -- voice-plan-normalize`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** — `src/lib/events/voice-plan-normalize.ts`:

```ts
import { isCategory } from "./categories";
import type { ParsedEvent, Recurrence } from "./types";
import type { EventContextItem, TargetScope, VoiceAction } from "./voice-plan-types";

interface NormalizeCtx { events: EventContextItem[]; today: string; timezone: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== "string") return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function normalizeRecurrence(a: Record<string, unknown>): Recurrence | null {
  const freq = a.recur_freq;
  if (freq !== "daily" && freq !== "weekly" && freq !== "monthly" && freq !== "yearly") return null;
  const weekdays =
    freq === "weekly" && Array.isArray(a.recur_weekdays)
      ? (a.recur_weekdays as unknown[]).filter((n): n is number => typeof n === "number")
      : [];
  const until = typeof a.recur_until === "string" && DATE_RE.test(a.recur_until) ? a.recur_until : null;
  const count = typeof a.recur_count === "number" && a.recur_count > 0 ? Math.round(a.recur_count) : null;
  return { freq, weekdays: weekdays.length > 0 ? weekdays : null, until, count };
}

function toParsedEvent(a: Record<string, unknown>): ParsedEvent | null {
  const title = typeof a.title === "string" ? a.title.trim() : "";
  if (!title) return null;
  const starts_at = toIso(a.starts_at);
  if (!starts_at) return null;
  const ends_at = toIso(a.ends_at, new Date(new Date(starts_at).getTime() + 3_600_000).toISOString())!;
  const category = typeof a.category === "string" && isCategory(a.category) ? a.category : "other";
  return {
    title,
    category,
    starts_at,
    ends_at,
    is_fixed: Boolean(a.is_fixed),
    notes: typeof a.notes === "string" ? a.notes : null,
    recurrence: normalizeRecurrence(a),
  };
}

export function normalizeVoicePlan(raw: unknown, ctx: NormalizeCtx): VoiceAction[] {
  if (!Array.isArray(raw)) return [];
  const out: VoiceAction[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as Record<string, unknown>;

    if (a.type === "create") {
      const event = toParsedEvent(a);
      if (event) out.push({ type: "create", event });
      continue;
    }
    if (a.type === "note") {
      const date = typeof a.note_date === "string" && DATE_RE.test(a.note_date) ? a.note_date : null;
      const text = typeof a.note_text === "string" ? a.note_text.trim() : "";
      if (date && text) out.push({ type: "note", date, text });
      continue;
    }
    if (a.type === "edit" || a.type === "delete") {
      const targetId = typeof a.target_id === "string" ? a.target_id : "";
      const target = ctx.events.find((e) => e.id === targetId);
      if (!target) continue;
      const recurring = target.recurring;
      let scope: TargetScope = a.target_scope === "all" ? "all" : "one";
      let targetDate: string | null = null;
      if (recurring && scope === "one") {
        targetDate = typeof a.target_date === "string" && DATE_RE.test(a.target_date) ? a.target_date : target.date;
      }
      if (!recurring) scope = "all";

      if (a.type === "edit") {
        const event = toParsedEvent(a);
        if (!event) continue;
        out.push({ type: "edit", targetId, recurring, scope, targetDate, targetTitle: target.title, event });
      } else {
        out.push({ type: "delete", targetId, recurring, scope, targetDate, targetTitle: target.title });
      }
    }
  }

  return out;
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- voice-plan-normalize`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/events/voice-plan-types.ts src/lib/events/voice-plan-normalize.ts src/lib/events/voice-plan-normalize.test.ts
git commit -m "feat: voice plan types + normalizeVoicePlan (TDD)"
```

---

## Task 2: `planSchedule` (OpenAI tool call)

**Files:** Create `src/lib/events/voice-plan.ts`

Mirrors `parse.ts` but with a `plan_schedule` tool returning an `actions` array, and the +30d event context embedded in the system prompt. Returns the raw `actions` array (validation happens in `normalizeVoicePlan`).

- [ ] **Step 1: Implement** — `src/lib/events/voice-plan.ts`:

```ts
import type OpenAI from "openai";

import { getOpenAI } from "@/lib/openai";
import { CATEGORIES } from "./categories";
import type { EventContextItem } from "./voice-plan-types";

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "plan_schedule",
    description: "Extract a list of calendar actions (create/edit/delete events, add day notes) from the user's message.",
    parameters: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["create", "edit", "delete", "note"] },
              title: { type: "string" },
              category: { type: "string", enum: CATEGORIES as unknown as string[] },
              starts_at: { type: "string", description: "ISO 8601 with tz offset" },
              ends_at: { type: "string", description: "ISO 8601 with tz offset; default +1h" },
              is_fixed: { type: "boolean" },
              notes: { type: "string", nullable: true },
              recur_freq: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"], nullable: true },
              recur_weekdays: { type: "array", items: { type: "integer" }, nullable: true },
              recur_until: { type: "string", nullable: true },
              recur_count: { type: "integer", nullable: true },
              target_id: { type: "string", nullable: true, description: "id of an existing event for edit/delete" },
              target_scope: { type: "string", enum: ["one", "all"], nullable: true },
              target_date: { type: "string", nullable: true, description: "occurrence date yyyy-MM-dd for scope=one" },
              note_date: { type: "string", nullable: true },
              note_text: { type: "string", nullable: true },
            },
            required: ["type"],
          },
        },
      },
      required: ["actions"],
    },
  },
};

export async function planSchedule(
  text: string,
  ctx: { today: string; timezone: string; events: EventContextItem[] },
): Promise<unknown[]> {
  const openai = getOpenAI();
  const eventLines = ctx.events
    .map((e) => `${e.id} | ${e.date} ${e.start} | ${e.title} | ${e.category}${e.recurring ? " | recurring" : ""}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `Today is ${ctx.today}. The user's timezone is ${ctx.timezone}. ` +
          `Parse the message into a list of calendar actions. Each action has a "type": ` +
          `"create" (new event), "edit" (change an existing event), "delete" (remove an existing event), "note" (add a day note). ` +
          `For create/edit, return starts_at and ends_at as ISO 8601 WITH the user's timezone offset; if no end is given, +1 hour. ` +
          `Categories: ${CATEGORIES.join(", ")}. Mark study/work/meeting as fixed; others flexible unless implied. ` +
          `For repetition set recur_freq (+ recur_weekdays 1=Mon..7=Sun for weekly). ` +
          `For edit/delete you MUST set target_id to the id of an existing event from the list below. ` +
          `If the user means a single occurrence of a recurring event, set target_scope="one" and target_date (yyyy-MM-dd); ` +
          `if they mean the whole repeating series, set target_scope="all". ` +
          `For note set note_date (yyyy-MM-dd) and note_text. Only include actions the user clearly asked for.\n\n` +
          `Existing events (id | date time | title | category):\n${eventLines || "(none)"}`,
      },
      { role: "user", content: text },
    ],
    tools: [TOOL],
    tool_choice: { type: "function", function: { name: "plan_schedule" } },
    max_tokens: 1200,
  });

  const rawCall = response.choices[0]?.message.tool_calls?.[0];
  const call = rawCall as Extract<typeof rawCall, { type: "function" }> | undefined;
  if (!call || !("function" in call)) return [];
  try {
    const args = JSON.parse(call.function.arguments) as { actions?: unknown };
    return Array.isArray(args.actions) ? args.actions : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/events/voice-plan.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/events/voice-plan.ts
git commit -m "feat: planSchedule multi-action LLM tool call"
```

---

## Task 3: `/api/voice-plan` route

**Files:** Create `src/app/api/voice-plan/route.ts`

- [ ] **Step 1: Implement** — `src/app/api/voice-plan/route.ts`:

```ts
import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { getCurrentUser } from "@/lib/auth";
import { getEventsInRange } from "@/lib/events/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { planSchedule } from "@/lib/events/voice-plan";
import { normalizeVoicePlan } from "@/lib/events/voice-plan-normalize";
import type { EventContextItem } from "@/lib/events/voice-plan-types";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
    const endDay = format(addDays(new Date(`${today}T00:00:00`), 30), "yyyy-MM-dd");
    const { start, end } = getDateRangeUtc(today, endDay, user.timezone);
    const events = await getEventsInRange(user.id, start, end, user.timezone);

    const ctxEvents: EventContextItem[] = events.map((e) => ({
      id: e.id,
      recurring: e.series_id != null,
      date: formatInTimeZone(e.starts_at, user.timezone, "yyyy-MM-dd"),
      start: formatInTimeZone(e.starts_at, user.timezone, "HH:mm"),
      title: e.title,
      category: e.category,
    }));

    const raw = await planSchedule(text.trim(), { today, timezone: user.timezone, events: ctxEvents });
    const actions = normalizeVoicePlan(raw, { events: ctxEvents, today, timezone: user.timezone });
    return NextResponse.json({ actions });
  } catch {
    return NextResponse.json({ error: "plan_failed" }, { status: 422 });
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/voice-plan/route.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/voice-plan/route.ts
git commit -m "feat: /api/voice-plan endpoint (context + plan + normalize)"
```

---

## Task 4: `applyVoicePlanAction` (TDD on routing)

**Files:**
- Create: `src/lib/events/voice-actions.ts`
- Test: `src/lib/events/voice-actions.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/events/voice-actions.test.ts` (mocks the queries layer + auth + cache):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireCurrentUser: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const q = {
  insertEvent: vi.fn(async () => "new-id"),
  updateEventById: vi.fn(async () => {}),
  updateSeries: vi.fn(async () => {}),
  deleteEventById: vi.fn(async () => {}),
  addExcludedDate: vi.fn(async () => {}),
};
vi.mock("@/lib/events/queries", () => q);
const insertNote = vi.fn(async () => {});
vi.mock("@/lib/notes/queries", () => ({ insertNote }));

import { applyVoicePlanAction } from "./voice-actions";
import type { VoiceAction } from "./voice-plan-types";

const ev = { title: "X", category: "gym" as const, starts_at: "2026-06-11T16:00:00.000Z", ends_at: "2026-06-11T17:00:00.000Z", is_fixed: false, notes: null, recurrence: null };

beforeEach(() => vi.clearAllMocks());

describe("applyVoicePlanAction", () => {
  it("create → insertEvent; note → insertNote", async () => {
    const res = await applyVoicePlanAction([
      { type: "create", event: ev },
      { type: "note", date: "2026-06-12", text: "подарок" },
    ] as VoiceAction[]);
    expect(q.insertEvent).toHaveBeenCalledTimes(1);
    expect(insertNote).toHaveBeenCalledWith({ user_id: "u1", content: "подарок", date: "2026-06-12" });
    expect(res).toEqual({ applied: 2, failed: 0 });
  });

  it("delete recurring one → addExcludedDate; delete one-off → deleteEventById", async () => {
    await applyVoicePlanAction([
      { type: "delete", targetId: "s1", recurring: true, scope: "one", targetDate: "2026-06-15", targetTitle: "Работа" },
      { type: "delete", targetId: "o1", recurring: false, scope: "all", targetDate: null, targetTitle: "Ужин" },
    ] as VoiceAction[]);
    expect(q.addExcludedDate).toHaveBeenCalledWith("u1", "s1", "2026-06-15");
    expect(q.deleteEventById).toHaveBeenCalledWith("u1", "o1");
  });

  it("edit recurring all → updateSeries; edit one-off → updateEventById", async () => {
    await applyVoicePlanAction([
      { type: "edit", targetId: "s1", recurring: true, scope: "all", targetDate: null, targetTitle: "Работа", event: ev },
      { type: "edit", targetId: "o1", recurring: false, scope: "all", targetDate: null, targetTitle: "Ужин", event: ev },
    ] as VoiceAction[]);
    expect(q.updateSeries).toHaveBeenCalledTimes(1);
    expect(q.updateEventById).toHaveBeenCalledTimes(1);
  });

  it("counts a failed action without aborting the batch", async () => {
    q.insertEvent.mockRejectedValueOnce(new Error("boom"));
    const res = await applyVoicePlanAction([
      { type: "create", event: ev },
      { type: "note", date: "2026-06-12", text: "ok" },
    ] as VoiceAction[]);
    expect(res).toEqual({ applied: 1, failed: 1 });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- voice-actions`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/events/voice-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { insertEvent, updateEventById, updateSeries, deleteEventById, addExcludedDate } from "./queries";
import { insertNote } from "@/lib/notes/queries";
import type { ParsedEvent, Recurrence } from "./types";
import type { VoiceAction } from "./voice-plan-types";

function insertParsed(userId: string, e: ParsedEvent, recurrence: Recurrence | null) {
  return insertEvent({
    user_id: userId,
    title: e.title.trim(),
    category: e.category,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    is_fixed: e.is_fixed,
    notes: e.notes?.trim() || null,
    location: null,
    recurrence,
    excluded_dates: [],
  });
}

export async function applyVoicePlanAction(
  actions: VoiceAction[],
): Promise<{ applied: number; failed: number }> {
  const user = await requireCurrentUser();
  let applied = 0;
  let failed = 0;
  let touchedNotes = false;

  for (const action of actions) {
    try {
      if (action.type === "create") {
        await insertParsed(user.id, action.event, action.event.recurrence ?? null);
      } else if (action.type === "note") {
        await insertNote({ user_id: user.id, content: action.text.trim(), date: action.date });
        touchedNotes = true;
      } else if (action.type === "edit") {
        const e = action.event;
        const patch = {
          title: e.title.trim(),
          category: e.category,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          is_fixed: e.is_fixed,
          notes: e.notes?.trim() || null,
        };
        if (action.recurring && action.scope === "one" && action.targetDate) {
          await addExcludedDate(user.id, action.targetId, action.targetDate);
          await insertParsed(user.id, e, null);
        } else if (action.recurring) {
          await updateSeries(user.id, action.targetId, { ...patch, recurrence: e.recurrence ?? null });
        } else {
          await updateEventById(user.id, action.targetId, patch);
        }
      } else {
        // delete
        if (action.recurring && action.scope === "one" && action.targetDate) {
          await addExcludedDate(user.id, action.targetId, action.targetDate);
        } else {
          await deleteEventById(user.id, action.targetId);
        }
      }
      applied += 1;
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/calendar");
  if (touchedNotes) revalidatePath("/notes");
  return { applied, failed };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- voice-actions`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/voice-actions.ts src/lib/events/voice-actions.test.ts
git commit -m "feat: applyVoicePlanAction batch apply (TDD routing)"
```

---

## Task 5: `ReviewSheet` component

**Files:** Create `src/components/capture/review-sheet.tsx`

Lists actions grouped by type with per-row checkboxes; applies the checked subset via `applyVoicePlanAction`. Refined-dark tokens.

- [ ] **Step 1: Implement** — `src/components/capture/review-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { useRouter } from "next/navigation";

import { categoryEmoji } from "@/lib/events/categories";
import { applyVoicePlanAction } from "@/lib/events/voice-actions";
import type { VoiceAction } from "@/lib/events/voice-plan-types";

function when(iso: string, tz: string) {
  return formatInTimeZone(iso, tz, "EEE d MMM, HH:mm", { locale: ru });
}
function scopeLabel(a: { recurring: boolean; scope: "one" | "all" }) {
  if (!a.recurring) return "";
  return a.scope === "all" ? " · вся серия" : " · только это";
}

export function ReviewSheet({
  actions,
  timezone,
  onClose,
}: {
  actions: VoiceAction[];
  timezone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(() => actions.map(() => true));
  const [applying, setApplying] = useState(false);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  async function apply() {
    const selected = actions.filter((_, i) => checked[i]);
    if (selected.length === 0) return;
    setApplying(true);
    try {
      await applyVoicePlanAction(selected);
      router.refresh();
      onClose();
    } catch {
      setApplying(false);
    }
  }

  const count = checked.filter(Boolean).length;

  const groups: { key: VoiceAction["type"]; label: string }[] = [
    { key: "create", label: "➕ Создать" },
    { key: "edit", label: "✏️ Изменить" },
    { key: "delete", label: "🗑 Удалить" },
    { key: "note", label: "📌 Заметка" },
  ];

  function rowText(a: VoiceAction): string {
    if (a.type === "create") return `${categoryEmoji(a.event.category)} ${a.event.title} · ${when(a.event.starts_at, timezone)}`;
    if (a.type === "edit") return `${categoryEmoji(a.event.category)} ${a.targetTitle} → ${when(a.event.starts_at, timezone)}${scopeLabel(a)}`;
    if (a.type === "delete") return `${a.targetTitle}${scopeLabel(a)}`;
    return `${a.date} · «${a.text}»`;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Вот что я понял · {actions.length}</p>

      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
        {groups.map((g) => {
          const items = actions.map((a, i) => ({ a, i })).filter(({ a }) => a.type === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{g.label}</p>
              <div className="flex flex-col gap-1.5">
                {items.map(({ a, i }) => (
                  <button
                    key={i}
                    onClick={() => toggle(i)}
                    className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
                    style={{ opacity: checked[i] ? 1 : 0.45 }}
                  >
                    <span className="text-base">{checked[i] ? "☑" : "☐"}</span>
                    <span className="min-w-0 flex-1 text-sm text-foreground">{rowText(a)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-muted">Отмена</button>
        <button onClick={apply} disabled={applying || count === 0} className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
          {applying ? "Применяю…" : `Применить (${count})`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/capture/review-sheet.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/capture/review-sheet.tsx
git commit -m "feat: ReviewSheet multi-action confirmation UI"
```

---

## Task 6: Wire `CaptureSheet` NL/voice → ReviewSheet

**Files:** Modify `src/components/capture/capture-sheet.tsx`

Replace the single-event NL confirm path with the multi-action plan + ReviewSheet. Keep the manual `EventForm` and the `editing` path intact.

- [ ] **Step 1: Rewrite** `src/components/capture/capture-sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { EventForm, type RecurringEdit } from "./event-form";
import { ReviewSheet } from "./review-sheet";
import type { CalendarEvent } from "@/lib/events/types";
import type { VoiceAction } from "@/lib/events/voice-plan-types";

type Mode = "nl" | "manual" | "review";

export function CaptureSheet({
  timezone,
  defaultDate,
  editing,
  recurringEdit,
  onClose,
}: {
  timezone: string;
  defaultDate: string;
  editing?: CalendarEvent | null;
  recurringEdit?: RecurringEdit | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(editing ? "manual" : "nl");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  async function runPlan(input: string) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/voice-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) throw new Error();
      const { actions: a } = (await res.json()) as { actions: VoiceAction[] };
      if (!a || a.length === 0) {
        setError("Не понял. Попробуй иначе или добавь вручную.");
        return;
      }
      setActions(a);
      setMode("review");
    } catch {
      setError("Не понял. Попробуй иначе или добавь вручную.");
    } finally {
      setPending(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        setPending(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!res.ok) throw new Error();
          const { text: transcript } = (await res.json()) as { text: string };
          setText(transcript);
          await runPlan(transcript);
        } catch {
          setError("Не расслышал. Напиши текстом.");
          setPending(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Микрофон недоступен. Напиши текстом.");
    }
  }

  const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border bg-card-strong p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        {mode !== "review" && !editing && (
          <div className="mb-4 flex gap-2">
            <button onClick={() => setMode("nl")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "nl" ? "var(--color-foreground)" : "var(--color-card)", color: mode === "nl" ? "var(--color-background)" : "var(--color-muted)" }}>Текстом / голосом</button>
            <button onClick={() => setMode("manual")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "manual" ? "var(--color-foreground)" : "var(--color-card)", color: mode === "manual" ? "var(--color-background)" : "var(--color-muted)" }}>Вручную</button>
          </div>
        )}

        {mode === "nl" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-foreground">Что добавить или изменить?</p>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="завтра зал в 7, перенеси созвон на 15, удали ужин в чт" className={`${inputCls} flex-1`} />
              <button onClick={toggleRecording} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card text-lg" aria-label="Голос">{recording ? "⏹️" : "🎤"}</button>
            </div>
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
            <button onClick={() => runPlan(text)} disabled={pending || !text.trim()} className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
              {pending ? "Думаю…" : "Разобрать"}
            </button>
          </div>
        )}

        {mode === "manual" && (
          <EventForm timezone={timezone} initialDate={defaultDate} editing={editing} prefill={null} recurringEdit={recurringEdit} onDone={onClose} />
        )}

        {mode === "review" && (
          <ReviewSheet actions={actions} timezone={timezone} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean (only pre-existing `<img>` warnings). `confirm-card.tsx` is now unused but still compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/capture/capture-sheet.tsx
git commit -m "feat: capture sheet NL/voice -> multi-action ReviewSheet"
```

---

## Task 7: Full verification + visual pass

- [ ] **Step 1: Unit suite** — `npm test`. Expected: all pass (adds normalize + voice-actions suites).
- [ ] **Step 2: i18n + lint + build** — `npm run check:i18n && npm run lint && npm run build`. Expected: clean.
- [ ] **Step 3: Visual/behavior pass** — run the app (run/verify); open `+` → speak/type a mixed message ("добавь зал завтра в 19 и в среду, перенеси созвон в четверг на 15, удали ужин в четверг, заметка на 12 июня купить подарок"); confirm ReviewSheet groups the actions correctly, scope labels show for recurring, unchecking excludes, apply updates the calendar. Tune Refined-dark spacing.
- [ ] **Step 4: Manual acceptance:**
  - Multiple creates from one message land on the right days.
  - Edit moves an existing event; delete removes it (one-off and a single recurring occurrence).
  - Day-note appears on its date in month view.
  - Empty/garbled input shows "Не понял" without writing anything.
  - Manual "Вручную" form and editing an existing event still work.
- [ ] **Step 5: Commit any polish**

```bash
git add -A
git commit -m "polish: voice multi-action review pass"
```

---

## Self-review notes
- **Spec coverage:** entry upgrade (T6), +30d context (T3), plan tool (T2), normalize incl. recurring scope default-`one` (T1), apply incl. occurrence/series routing (T4), ReviewSheet with scope labels + checkboxes (T5), errors (T3/T6), notes add-only (T1/T4), tests (T1/T4). Covered.
- **Type consistency:** `VoiceAction` union + `EventContextItem` from `voice-plan-types.ts` used identically across normalize, planSchedule ctx, route, apply, ReviewSheet. `ParsedEvent` reused for create/edit state. `applyVoicePlanAction(VoiceAction[]) → {applied,failed}` matches caller in ReviewSheet.
- **Deviation:** single-event `ConfirmCard` superseded by 1-item `ReviewSheet` (noted above); `confirm-card.tsx` left unused, not deleted.
- **Deferred:** note edit/delete; animations/optimization/further design (separate cycles).
```
