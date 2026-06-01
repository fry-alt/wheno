# Smart Calendar — Layer 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild wheno as a calendar-first Telegram Mini App — a clean personal calendar with fixed/flexible events, three kinds of notes, and natural-language (text + voice) capture — on top of the existing auth/bot/Supabase infrastructure.

**Architecture:** Keep infrastructure (Telegram auth, session, Supabase admin client, Whisper). Delete all old feature code (groups/meetings/availability) and the old schema. Add a fresh two-table schema (`events`, `notes`) and new feature modules under `src/lib/events`, `src/lib/notes`, `src/lib/calendar`, with screens under the `(app)` route group sharing a bottom-nav layout.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, Supabase (`@supabase/supabase-js`), OpenAI (`gpt-4o-mini` + Whisper), date-fns / date-fns-tz, Vitest.

---

## File Map

### Keep (infrastructure — untouched)
`src/lib/auth.ts` (import updated), `src/lib/session.ts`, `src/lib/telegram.ts`, `src/lib/env.ts`, `src/lib/datetime.ts`, `src/lib/i18n.ts`, `src/lib/preferences.ts`, `src/lib/preferences-shared.ts`, `src/lib/utils.ts`, `src/lib/supabase/admin.ts`, `src/components/session-bootstrap.tsx`, `src/components/loading-state.tsx`, `src/components/ui/*`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/session/route.ts`.

### Create
| File | Responsibility |
|---|---|
| `supabase/schema.sql` | New clean schema (overwrite) |
| `src/lib/users.ts` | `getUserById`, `upsertTelegramUser` (extracted) |
| `src/lib/events/types.ts` | `Category`, `CalendarEvent`, `ParsedEvent` |
| `src/lib/events/categories.ts` | emoji + default-fixed + RU label maps |
| `src/lib/events/queries.ts` | event CRUD (Supabase) |
| `src/lib/events/actions.ts` | server actions for events |
| `src/lib/events/parse.ts` | OpenAI natural-language → `ParsedEvent` |
| `src/lib/notes/types.ts` | `Note` |
| `src/lib/notes/queries.ts` | note CRUD |
| `src/lib/notes/actions.ts` | server actions for notes |
| `src/lib/calendar/grid.ts` | pure month-grid builder |
| `src/lib/bot/handler.ts` | bot capture (text + voice) |
| `src/app/(app)/layout.tsx` | bottom-nav shell |
| `src/components/bottom-nav.tsx` | client nav + capture button |
| `src/app/(app)/calendar/page.tsx` | calendar screen |
| `src/app/(app)/notes/page.tsx` | notes screen |
| `src/components/calendar/month-grid.tsx` | month grid + day selection |
| `src/components/calendar/day-view.tsx` | selected day's events + note |
| `src/components/calendar/event-row.tsx` | one event row |
| `src/components/capture/capture-sheet.tsx` | tabbed NL + manual capture |
| `src/components/capture/confirm-card.tsx` | parsed-event confirm |
| `src/components/capture/event-form.tsx` | manual add/edit form |
| `src/components/notes/task-list.tsx` | standalone tasks |
| `src/components/notes/day-notes.tsx` | day notes list |

### Delete
`src/lib/db/` · `src/lib/bot-handler.ts` · `src/lib/actions.ts` · `src/lib/scheduler.ts` · `src/lib/scheduler.test.ts` · `src/lib/notify.ts` · `src/lib/calendar-utils.ts` · `src/lib/calendar-utils.test.ts` · `src/components/app-shell.tsx` · `src/components/empty-state.tsx` · `src/components/personal-calendar.tsx` · `src/components/calendar-event-card.tsx` · `src/components/quick-add-sheet.tsx` · `src/components/dark-shell.tsx` · `src/components/group-card.tsx` · `src/components/member-list.tsx` · `src/components/meeting-option-card.tsx` · `src/components/inline-availability-grid.tsx` · `src/components/availability-form.tsx` · `src/components/preference-controls.tsx` · `src/components/group-availability-calendar.tsx` · `src/components/copy-invite-button.tsx` · `src/components/form-submit-button.tsx` · `src/components/avatar.tsx` · `src/app/groups/` · `src/app/join/` · `src/app/meetings/` · `src/app/availability/` · `src/app/calendar/` (old) · `src/app/api/cron/` · `supabase/schema_v2.sql` · `supabase/schema_v3.sql` · `supabase/schema_v4.sql`

---

## Task 1: Clean slate — new schema, extract user queries, delete old feature code

**Files:**
- Create: `supabase/schema.sql` (overwrite), `src/lib/users.ts`
- Modify: `src/lib/auth.ts`, `src/app/api/session/route.ts`, `src/lib/openai.ts`, `src/lib/types.ts`, `src/app/page.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/loading.tsx`, `src/app/api/bot/route.ts`
- Delete: see "Delete" list above

- [ ] **Step 1: Write the new schema** — overwrite `supabase/schema.sql`:

```sql
-- wheno schema (Layer 1)
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  telegram_id text unique not null,
  first_name  text,
  last_name   text,
  username    text,
  photo_url   text,
  timezone    text not null default 'Europe/Amsterdam',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  category   text not null default 'other',
  is_fixed   boolean not null default false,
  notes      text,
  location   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_user_starts_idx on public.events(user_id, starts_at);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null,
  date       date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notes_user_date_idx on public.notes(user_id, date);
```

- [ ] **Step 2: Apply schema to Supabase**

Open the Supabase project SQL editor and run, in order:
1. `drop table if exists public.calendar_events, public.busy_blocks, public.reminders, public.pending_voice, public.user_profiles, public.meeting_options, public.meeting_requests, public.group_members, public.groups, public.votes, public.messages cascade;` (drop whatever old tables exist — ignore "does not exist" errors)
2. The full contents of `supabase/schema.sql` above.

Expected: `users`, `events`, `notes` tables exist; old tables gone.

- [ ] **Step 3: Create `src/lib/users.ts`** (extract user queries):

```ts
import { getAdminSupabase } from "@/lib/supabase/admin";
import { appError } from "@/lib/i18n";
import type { AppUser, TelegramProfile } from "@/lib/types";

export async function getUserById(userId: string): Promise<AppUser | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw appError("user.loadProfileFailed");
  return (data as AppUser | null) ?? null;
}

export async function upsertTelegramUser(profile: TelegramProfile): Promise<AppUser> {
  const admin = getAdminSupabase();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("users")
    .upsert(
      {
        telegram_id: profile.telegramId,
        first_name: profile.firstName,
        last_name: profile.lastName,
        username: profile.username,
        photo_url: profile.photoUrl,
        timezone: profile.timezone,
        updated_at: now,
      },
      { onConflict: "telegram_id" },
    )
    .select("*")
    .single();
  if (error) throw appError("session.saveTelegramProfileFailed");
  return data as AppUser;
}
```

- [ ] **Step 4: Repoint importers to `@/lib/users`**

In `src/lib/auth.ts` change `import { getUserById } from "@/lib/db/queries";` → `import { getUserById } from "@/lib/users";`

In `src/app/api/session/route.ts` change `import { upsertTelegramUser } from "@/lib/db/queries";` → `import { upsertTelegramUser } from "@/lib/users";`

- [ ] **Step 5: Trim `src/lib/types.ts`** to only the kept types. Replace entire file:

```ts
export interface AppUser {
  id: string;
  telegram_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface SessionPayload {
  userId: string;
  telegramId: string;
  timezone: string;
  issuedAt: number;
}

export interface TelegramProfile {
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  timezone: string;
}
```

- [ ] **Step 6: Trim `src/lib/openai.ts`** to keep only the client + Whisper. Replace entire file:

```ts
import OpenAI from "openai";

import { getOpenAiApiKey, getTelegramBotToken } from "@/lib/env";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!client) {
    client = new OpenAI({ apiKey: getOpenAiApiKey() });
  }
  return client;
}

export async function transcribeVoice(fileId: string): Promise<string> {
  const token = getTelegramBotToken();

  const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileJson = (await fileRes.json()) as { result: { file_path: string } };
  const filePath = fileJson.result.file_path;

  const audioRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  const audioBuffer = await audioRes.arrayBuffer();

  const openai = getOpenAI();
  const file = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "ru",
  });

  return result.text;
}
```

- [ ] **Step 7: Replace `src/app/page.tsx`** with a redirect:

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/calendar");
}
```

- [ ] **Step 8: Rewrite `src/app/error.tsx`** without AppShell:

```tsx
"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] p-8 text-center text-white">
          <p className="text-sm text-[#999]">Что-то пошло не так.</p>
          <button
            onClick={reset}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Rewrite `src/app/not-found.tsx`** without AppShell:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] p-8 text-center text-white">
      <p className="text-sm text-[#999]">Страница не найдена.</p>
      <Link href="/calendar" className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black">
        На календарь
      </Link>
    </div>
  );
}
```

- [ ] **Step 10: Rewrite `src/app/loading.tsx`** without AppShell:

```tsx
import { LoadingState } from "@/components/loading-state";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
      <LoadingState description="Загружаем" title="wheno" />
    </div>
  );
}
```

- [ ] **Step 11: Stub `src/app/api/bot/route.ts`** (real handler in Task 10):

```ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 12: Delete old feature code.** Run from repo root:

```bash
cd "c:/wheno"
rm -rf src/lib/db src/app/groups src/app/join src/app/meetings src/app/availability src/app/calendar src/app/api/cron
rm -f src/lib/bot-handler.ts src/lib/actions.ts src/lib/scheduler.ts src/lib/scheduler.test.ts src/lib/notify.ts src/lib/calendar-utils.ts src/lib/calendar-utils.test.ts
rm -f src/components/app-shell.tsx src/components/empty-state.tsx src/components/personal-calendar.tsx src/components/calendar-event-card.tsx src/components/quick-add-sheet.tsx src/components/dark-shell.tsx src/components/group-card.tsx src/components/member-list.tsx src/components/meeting-option-card.tsx src/components/inline-availability-grid.tsx src/components/availability-form.tsx src/components/preference-controls.tsx src/components/group-availability-calendar.tsx src/components/copy-invite-button.tsx src/components/form-submit-button.tsx src/components/avatar.tsx
rm -f supabase/schema_v2.sql supabase/schema_v3.sql supabase/schema_v4.sql
```

- [ ] **Step 13: Verify compile + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: passing (the only remaining test is `openai-voice.test.ts` which checks `transcribeVoice` is exported).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "refactor: clean slate — new schema, extract user queries, remove old feature code"
```

---

## Task 2: Event types + categories

**Files:**
- Create: `src/lib/events/types.ts`, `src/lib/events/categories.ts`, `src/lib/events/categories.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/events/categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_DEFAULT_FIXED, CATEGORY_LABEL_RU, categoryEmoji } from "./categories";

describe("categories", () => {
  it("every category has an emoji, a default fixedness, and a RU label", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_EMOJI[c], `emoji for ${c}`).toBeTruthy();
      expect(typeof CATEGORY_DEFAULT_FIXED[c], `fixed for ${c}`).toBe("boolean");
      expect(CATEGORY_LABEL_RU[c], `label for ${c}`).toBeTruthy();
    }
  });

  it("study/work/meeting default to fixed; gym defaults to flexible", () => {
    expect(CATEGORY_DEFAULT_FIXED.study).toBe(true);
    expect(CATEGORY_DEFAULT_FIXED.work).toBe(true);
    expect(CATEGORY_DEFAULT_FIXED.meeting).toBe(true);
    expect(CATEGORY_DEFAULT_FIXED.gym).toBe(false);
  });

  it("categoryEmoji falls back to 📌 for unknown", () => {
    expect(categoryEmoji("nonsense")).toBe("📌");
    expect(categoryEmoji("gym")).toBe("🏋️");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/events/categories.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/events/types.ts`**:

```ts
export type Category =
  | "study" | "work" | "meeting"
  | "gym" | "run" | "meal" | "coffee" | "social" | "rest" | "errand" | "other";

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  category: Category;
  is_fixed: boolean;
  notes: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedEvent {
  title: string;
  category: Category;
  starts_at: string; // ISO UTC
  ends_at: string;   // ISO UTC
  is_fixed: boolean;
  notes: string | null;
}
```

- [ ] **Step 4: Create `src/lib/events/categories.ts`**:

```ts
import type { Category } from "./types";

export const CATEGORIES: Category[] = [
  "study", "work", "meeting", "gym", "run", "meal", "coffee", "social", "rest", "errand", "other",
];

export const CATEGORY_EMOJI: Record<Category, string> = {
  study: "📚", work: "💻", meeting: "💼", gym: "🏋️", run: "🏃",
  meal: "🍽️", coffee: "☕", social: "🎉", rest: "😴", errand: "🛒", other: "📌",
};

export const CATEGORY_DEFAULT_FIXED: Record<Category, boolean> = {
  study: true, work: true, meeting: true,
  gym: false, run: false, meal: false, coffee: false, social: false, rest: false, errand: false, other: false,
};

export const CATEGORY_LABEL_RU: Record<Category, string> = {
  study: "Учёба", work: "Работа", meeting: "Встреча", gym: "Зал", run: "Бег",
  meal: "Еда", coffee: "Кофе", social: "Тусовка", rest: "Отдых", errand: "Дела", other: "Другое",
};

export function categoryEmoji(c: string): string {
  return CATEGORY_EMOJI[c as Category] ?? "📌";
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as string[]).includes(value);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/events/categories.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/events/types.ts src/lib/events/categories.ts src/lib/events/categories.test.ts
git commit -m "feat: event types and category maps"
```

---

## Task 3: Month-grid date math

**Files:**
- Create: `src/lib/calendar/grid.ts`, `src/lib/calendar/grid.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/calendar/grid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseISO } from "date-fns";
import { buildMonthGrid } from "./grid";

describe("buildMonthGrid", () => {
  it("June 2026 starts on Monday June 1 and the grid leads with it", () => {
    const grid = buildMonthGrid(parseISO("2026-06-01"));
    // June 1 2026 is a Monday → no leading days
    expect(grid[0].date.getDate()).toBe(1);
    expect(grid[0].inMonth).toBe(true);
  });

  it("produces full weeks (length divisible by 7)", () => {
    const grid = buildMonthGrid(parseISO("2026-06-01"));
    expect(grid.length % 7).toBe(0);
  });

  it("marks days outside the month as inMonth=false", () => {
    // February 2026 starts on a Sunday → 6 leading days from January
    const grid = buildMonthGrid(parseISO("2026-02-01"));
    expect(grid[0].inMonth).toBe(false);
    expect(grid.some((d) => d.inMonth && d.date.getDate() === 28)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calendar/grid.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/calendar/grid.ts`**:

```ts
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  getDay,
  isSameMonth,
  startOfMonth,
  subDays,
} from "date-fns";

export interface GridDay {
  date: Date;
  inMonth: boolean;
}

/** Monday-first calendar grid padded to full weeks. */
export function buildMonthGrid(monthDate: Date): GridDay[] {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const leading = (getDay(first) + 6) % 7; // Mon=0 … Sun=6
  const lastIdx = (getDay(last) + 6) % 7;
  const trailing = lastIdx === 6 ? 0 : 6 - lastIdx;
  return eachDayOfInterval({
    start: subDays(first, leading),
    end: addDays(last, trailing),
  }).map((date) => ({ date, inMonth: isSameMonth(date, monthDate) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calendar/grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/grid.ts src/lib/calendar/grid.test.ts
git commit -m "feat: month-grid date math"
```

---

## Task 4: Event queries + server actions

**Files:**
- Create: `src/lib/events/queries.ts`, `src/lib/events/actions.ts`

- [ ] **Step 1: Create `src/lib/events/queries.ts`**:

```ts
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { CalendarEvent } from "./types";

const COLUMNS =
  "id, user_id, title, starts_at, ends_at, category, is_fixed, notes, location, created_at, updated_at";

export async function getEventsInRange(
  userId: string,
  startAt: Date,
  endAt: Date,
): Promise<CalendarEvent[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("events")
    .select(COLUMNS)
    .eq("user_id", userId)
    .gte("starts_at", startAt.toISOString())
    .lt("starts_at", endAt.toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarEvent[];
}

export interface NewEvent {
  user_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  category: string;
  is_fixed: boolean;
  notes: string | null;
  location: string | null;
}

export async function insertEvent(event: NewEvent): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("events").insert(event);
  if (error) throw new Error(error.message);
}

export async function updateEventById(
  userId: string,
  id: string,
  patch: Partial<Omit<NewEvent, "user_id">>,
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteEventById(userId: string, id: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("events").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Create `src/lib/events/actions.ts`**:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { toUtcDateFromLocalParts } from "@/lib/datetime";
import { insertEvent, updateEventById, deleteEventById } from "./queries";
import type { Category, ParsedEvent } from "./types";

export interface EventFormInput {
  title: string;
  category: Category;
  date: string;       // yyyy-MM-dd (user local)
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  is_fixed: boolean;
  notes?: string | null;
  location?: string | null;
}

export async function createEventAction(input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  const startsAt = toUtcDateFromLocalParts(input.date, input.start_time, user.timezone);
  const endsAt = toUtcDateFromLocalParts(input.date, input.end_time, user.timezone);
  await insertEvent({
    user_id: user.id,
    title: input.title.trim(),
    category: input.category,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
  });
  revalidatePath("/calendar");
}

export async function updateEventAction(id: string, input: EventFormInput): Promise<void> {
  const user = await requireCurrentUser();
  const startsAt = toUtcDateFromLocalParts(input.date, input.start_time, user.timezone);
  const endsAt = toUtcDateFromLocalParts(input.date, input.end_time, user.timezone);
  await updateEventById(user.id, id, {
    title: input.title.trim(),
    category: input.category,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    is_fixed: input.is_fixed,
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
  });
  revalidatePath("/calendar");
}

export async function deleteEventAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  await deleteEventById(user.id, id);
  revalidatePath("/calendar");
}

/** Create from an already-parsed natural-language event (times are ISO UTC). */
export async function createParsedEventAction(parsed: ParsedEvent): Promise<void> {
  const user = await requireCurrentUser();
  await insertEvent({
    user_id: user.id,
    title: parsed.title.trim(),
    category: parsed.category,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    is_fixed: parsed.is_fixed,
    notes: parsed.notes?.trim() || null,
    location: null,
  });
  revalidatePath("/calendar");
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/events/queries.ts src/lib/events/actions.ts
git commit -m "feat: event queries and server actions"
```

---

## Task 5: Notes queries + server actions

**Files:**
- Create: `src/lib/notes/types.ts`, `src/lib/notes/queries.ts`, `src/lib/notes/actions.ts`

- [ ] **Step 1: Create `src/lib/notes/types.ts`**:

```ts
export interface Note {
  id: string;
  user_id: string;
  content: string;
  date: string | null; // yyyy-MM-dd, or null for standalone task
  done: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Create `src/lib/notes/queries.ts`**:

```ts
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Note } from "./types";

const COLUMNS = "id, user_id, content, date, done, created_at";

export async function getTasks(userId: string): Promise<Note[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("notes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .is("date", null)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Note[];
}

export async function getDayNotes(userId: string): Promise<Note[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("notes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .not("date", "is", null)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Note[];
}

export async function getNoteForDate(userId: string, date: string): Promise<Note | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("notes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Note | null) ?? null;
}

export async function insertNote(note: {
  user_id: string;
  content: string;
  date: string | null;
}): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notes").insert(note);
  if (error) throw new Error(error.message);
}

export async function setNoteDone(userId: string, id: string, done: boolean): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notes").update({ done }).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteNoteById(userId: string, id: string): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notes").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Create `src/lib/notes/actions.ts`**:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { insertNote, setNoteDone, deleteNoteById } from "./queries";

export async function addTaskAction(content: string): Promise<void> {
  const user = await requireCurrentUser();
  const trimmed = content.trim();
  if (!trimmed) return;
  await insertNote({ user_id: user.id, content: trimmed, date: null });
  revalidatePath("/notes");
}

export async function addDayNoteAction(content: string, date: string): Promise<void> {
  const user = await requireCurrentUser();
  const trimmed = content.trim();
  if (!trimmed) return;
  await insertNote({ user_id: user.id, content: trimmed, date });
  revalidatePath("/notes");
  revalidatePath("/calendar");
}

export async function toggleTaskAction(id: string, done: boolean): Promise<void> {
  const user = await requireCurrentUser();
  await setNoteDone(user.id, id, done);
  revalidatePath("/notes");
}

export async function deleteNoteAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  await deleteNoteById(user.id, id);
  revalidatePath("/notes");
  revalidatePath("/calendar");
}
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notes/
git commit -m "feat: notes queries and server actions"
```

---

## Task 6: Natural-language event parser

**Files:**
- Create: `src/lib/events/parse.ts`, `src/lib/events/parse.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/events/parse.test.ts` (mocks OpenAI, no live calls):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@/lib/openai", () => ({
  getOpenAI: () => ({ chat: { completions: { create: createMock } } }),
}));

import { parseEvent } from "./parse";

beforeEach(() => {
  createMock.mockReset();
});

function toolResponse(args: Record<string, unknown>) {
  return {
    choices: [
      {
        message: {
          tool_calls: [{ function: { name: "create_event", arguments: JSON.stringify(args) } }],
        },
      },
    ],
  };
}

describe("parseEvent", () => {
  it("maps a tool call into a ParsedEvent with UTC ISO times", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Зал",
        category: "gym",
        starts_at: "2026-06-03T07:00:00+03:00",
        ends_at: "2026-06-03T08:00:00+03:00",
        is_fixed: false,
        notes: null,
      }),
    );

    const result = await parseEvent("завтра зал в 7", {
      today: "2026-06-02",
      timezone: "Europe/Moscow",
    });

    expect(result.title).toBe("Зал");
    expect(result.category).toBe("gym");
    expect(result.is_fixed).toBe(false);
    expect(result.starts_at).toBe("2026-06-03T04:00:00.000Z");
    expect(result.ends_at).toBe("2026-06-03T05:00:00.000Z");
  });

  it("falls back to 'other' for an unknown category", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Что-то",
        category: "banana",
        starts_at: "2026-06-03T10:00:00+03:00",
        ends_at: "2026-06-03T11:00:00+03:00",
        is_fixed: false,
        notes: null,
      }),
    );

    const result = await parseEvent("что-то в 10", { today: "2026-06-02", timezone: "Europe/Moscow" });
    expect(result.category).toBe("other");
  });

  it("throws when the model returns no tool call", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "не понял" } }] });
    await expect(
      parseEvent("бла", { today: "2026-06-02", timezone: "Europe/Moscow" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/events/parse.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/events/parse.ts`**:

```ts
import type OpenAI from "openai";

import { getOpenAI } from "@/lib/openai";
import { CATEGORIES, isCategory } from "./categories";
import type { ParsedEvent } from "./types";

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_event",
    description: "Extract a single calendar event from the user's message.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short event title" },
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        starts_at: { type: "string", description: "ISO 8601 with timezone offset" },
        ends_at: { type: "string", description: "ISO 8601 with timezone offset; default +1h" },
        is_fixed: { type: "boolean", description: "true for mandatory (study/work/meeting), false for flexible" },
        notes: { type: "string", nullable: true },
      },
      required: ["title", "category", "starts_at", "ends_at", "is_fixed"],
    },
  },
};

export async function parseEvent(
  text: string,
  ctx: { today: string; timezone: string },
): Promise<ParsedEvent> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `Today is ${ctx.today}. The user's timezone is ${ctx.timezone}. ` +
          `Parse the message into exactly one calendar event. ` +
          `Return starts_at and ends_at as ISO 8601 timestamps WITH the user's timezone offset. ` +
          `If no end time is given, make it one hour after the start. ` +
          `Categories: ${CATEGORIES.join(", ")}. ` +
          `Mark study, work, and meeting as fixed; everything else flexible unless the user implies otherwise.`,
      },
      { role: "user", content: text },
    ],
    tools: [TOOL],
    tool_choice: { type: "function", function: { name: "create_event" } },
    max_tokens: 300,
  });

  const call = response.choices[0]?.message.tool_calls?.[0];
  if (!call) {
    throw new Error("Could not parse an event from the message.");
  }

  const args = JSON.parse(call.function.arguments) as {
    title: string;
    category: string;
    starts_at: string;
    ends_at: string;
    is_fixed: boolean;
    notes?: string | null;
  };

  return {
    title: args.title,
    category: isCategory(args.category) ? args.category : "other",
    starts_at: new Date(args.starts_at).toISOString(),
    ends_at: new Date(args.ends_at).toISOString(),
    is_fixed: Boolean(args.is_fixed),
    notes: args.notes ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/events/parse.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/parse.ts src/lib/events/parse.test.ts
git commit -m "feat: natural-language event parser"
```

---

## Task 7: Calendar UI + app layout

**Files:**
- Create: `src/components/calendar/event-row.tsx`, `src/components/calendar/month-grid.tsx`, `src/components/calendar/day-view.tsx`, `src/app/(app)/calendar/page.tsx`, `src/app/(app)/layout.tsx`, `src/components/bottom-nav.tsx`

> Capture sheet is built in Task 8; here `bottom-nav.tsx` renders the nav and a placeholder `+` button that does nothing yet (wired in Task 8).

- [ ] **Step 1: Create `src/components/calendar/event-row.tsx`**:

```tsx
"use client";

import { formatInTimeZone } from "date-fns-tz";

import { categoryEmoji } from "@/lib/events/categories";
import type { CalendarEvent } from "@/lib/events/types";

export function EventRow({
  event,
  timezone,
  onClick,
}: {
  event: CalendarEvent;
  timezone: string;
  onClick: () => void;
}) {
  const start = formatInTimeZone(event.starts_at, timezone, "HH:mm");
  const end = formatInTimeZone(event.ends_at, timezone, "HH:mm");

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-3 text-left"
    >
      <span
        className="h-9 w-1 flex-shrink-0 rounded-full"
        style={
          event.is_fixed
            ? { background: "#3b82f6" }
            : { background: "transparent", borderLeft: "2px dashed #555", borderRadius: 0 }
        }
      />
      <span className="text-lg">{categoryEmoji(event.category)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{event.title}</span>
        <span className="block text-xs text-[#777]">
          {start}–{end}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Create `src/components/calendar/month-grid.tsx`**:

```tsx
"use client";

import { format, isToday } from "date-fns";

import { buildMonthGrid } from "@/lib/calendar/grid";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function MonthGrid({
  monthDate,
  selectedDate,
  daysWithEvents,
  onSelect,
}: {
  monthDate: Date;
  selectedDate: string; // yyyy-MM-dd
  daysWithEvents: Set<string>;
  onSelect: (dateStr: string) => void;
}) {
  const grid = buildMonthGrid(monthDate);

  return (
    <div>
      <div className="grid grid-cols-7 px-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#555]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 px-2 pb-2">
        {grid.map(({ date, inMonth }) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const selected = dateStr === selectedDate;
          const today = isToday(date);
          return (
            <button key={dateStr} onClick={() => onSelect(dateStr)} className="flex flex-col items-center gap-0.5 py-1">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                style={{
                  background: selected ? "#fff" : today ? "#3b82f622" : "transparent",
                  color: selected ? "#000" : inMonth ? "#fff" : "#333",
                  border: today && !selected ? "1px solid #3b82f655" : undefined,
                }}
              >
                {format(date, "d")}
              </span>
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: daysWithEvents.has(dateStr) ? (selected ? "#000" : "#555") : "transparent" }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/calendar/day-view.tsx`** (client; owns selected-day state, month nav, event list):

```tsx
"use client";

import { useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";

import { MonthGrid } from "./month-grid";
import { EventRow } from "./event-row";
import type { CalendarEvent } from "@/lib/events/types";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function DayView({
  events,
  timezone,
  monthStr,
  onEventClick,
}: {
  events: CalendarEvent[];
  timezone: string;
  monthStr: string; // yyyy-MM
  onEventClick: (event: CalendarEvent) => void;
}) {
  const router = useRouter();
  const monthDate = parseISO(`${monthStr}-01`);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const currentMonthStr = formatInTimeZone(new Date(), timezone, "yyyy-MM");

  const [selectedDate, setSelectedDate] = useState(
    monthStr === currentMonthStr ? todayStr : format(startOfMonth(monthDate), "yyyy-MM-dd"),
  );

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd"));
    return set;
  }, [events, timezone]);

  const dayEvents = useMemo(
    () => events.filter((e) => formatInTimeZone(e.starts_at, timezone, "yyyy-MM-dd") === selectedDate),
    [events, timezone, selectedDate],
  );

  function navigateMonth(dir: 1 | -1) {
    const next = dir === 1 ? addMonths(monthDate, 1) : subMonths(monthDate, 1);
    router.push(`/calendar?month=${format(next, "yyyy-MM")}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigateMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white" aria-label="Предыдущий месяц">‹</button>
        <span className="text-base font-bold text-white">{MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()}</span>
        <button onClick={() => navigateMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-xl text-white" aria-label="Следующий месяц">›</button>
      </div>

      <MonthGrid monthDate={monthDate} selectedDate={selectedDate} daysWithEvents={daysWithEvents} onSelect={setSelectedDate} />

      <div className="mx-4 my-2 border-t border-[#1a1a1a]" />

      <div className="flex flex-col gap-2 px-4">
        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-white">Свободный день</p>
            <p className="mt-1 text-xs text-[#555]">Нажми ➕ чтобы добавить</p>
          </div>
        ) : (
          dayEvents.map((e) => <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/bottom-nav.tsx`** (placeholder capture button for now):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const isCalendar = pathname.startsWith("/calendar");
  const isNotes = pathname.startsWith("/notes");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#1a1a1a] bg-[#0f0f0f] px-6 py-2">
      <Link href="/calendar" className="flex flex-col items-center gap-0.5 text-[10px]" style={{ color: isCalendar ? "#fff" : "#555" }}>
        <span className="text-lg">📅</span>
        Календарь
      </Link>
      <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-bold text-black" aria-label="Добавить">+</button>
      <Link href="/notes" className="flex flex-col items-center gap-0.5 text-[10px]" style={{ color: isNotes ? "#fff" : "#555" }}>
        <span className="text-lg">📝</span>
        Заметки
      </Link>
    </nav>
  );
}
```

- [ ] **Step 5: Create `src/app/(app)/layout.tsx`**:

```tsx
import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-20 text-white">
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/(app)/calendar/page.tsx`**:

```tsx
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getEventsInRange } from "@/lib/events/queries";
import { getDateRangeUtc } from "@/lib/datetime";
import { getUiPreferences } from "@/lib/preferences";
import { readSearchParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#3b82f6] text-xl font-bold text-white">w</span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const monthParam = readSearchParam(params.month);
  const monthStr = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : formatInTimeZone(new Date(), user.timezone, "yyyy-MM");

  const monthDate = parseISO(`${monthStr}-01`);
  const { start, end } = getDateRangeUtc(
    format(startOfMonth(monthDate), "yyyy-MM-dd"),
    format(endOfMonth(monthDate), "yyyy-MM-dd"),
    user.timezone,
  );
  const events = await getEventsInRange(user.id, start, end);

  return <CalendarScreen events={events} monthStr={monthStr} timezone={user.timezone} />;
}
```

> Note: `CalendarScreen` is created in Task 8 (it wires `DayView` + the capture sheet + the event-edit form together). For this task, create a minimal `src/components/calendar/calendar-screen.tsx` that renders only `DayView` with a no-op `onEventClick`, so the page compiles and shows the calendar. Task 8 replaces it.

- [ ] **Step 7: Create minimal `src/components/calendar/calendar-screen.tsx`** (replaced in Task 8):

```tsx
"use client";

import { DayView } from "./day-view";
import type { CalendarEvent } from "@/lib/events/types";

export function CalendarScreen({
  events,
  monthStr,
  timezone,
}: {
  events: CalendarEvent[];
  monthStr: string;
  timezone: string;
}) {
  return (
    <DayView
      events={events}
      monthStr={monthStr}
      timezone={timezone}
      onEventClick={() => {}}
    />
  );
}
```

- [ ] **Step 8: Verify compile + build routing**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next build`
Expected: build succeeds; route list shows `/calendar` (no conflict with old route, which was deleted in Task 1).

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)" src/components/calendar src/components/bottom-nav.tsx
git commit -m "feat: calendar screen, month grid, bottom-nav shell"
```

---

## Task 8: Capture sheet (NL + manual form) + event edit wiring

**Files:**
- Create: `src/components/capture/event-form.tsx`, `src/components/capture/confirm-card.tsx`, `src/components/capture/capture-sheet.tsx`
- Create: `src/app/api/parse-event/route.ts` (client → server bridge for parsing)
- Replace: `src/components/calendar/calendar-screen.tsx`
- Modify: `src/components/bottom-nav.tsx` (open the capture sheet)

- [ ] **Step 1: Create `src/app/api/parse-event/route.ts`** (lets the client call the parser; parser must run server-side because it holds the OpenAI key):

```ts
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { parseEvent } from "@/lib/events/parse";
import { formatInTimeZone } from "date-fns-tz";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  try {
    const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
    const parsed = await parseEvent(text.trim(), { today, timezone: user.timezone });
    return NextResponse.json({ parsed });
  } catch {
    return NextResponse.json({ error: "parse_failed" }, { status: 422 });
  }
}
```

- [ ] **Step 2: Create `src/components/capture/event-form.tsx`** (manual add/edit; native date/time inputs):

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { createEventAction, updateEventAction, deleteEventAction, type EventFormInput } from "@/lib/events/actions";
import { CATEGORIES, CATEGORY_DEFAULT_FIXED, CATEGORY_EMOJI, CATEGORY_LABEL_RU } from "@/lib/events/categories";
import type { CalendarEvent, Category } from "@/lib/events/types";

export function EventForm({
  timezone,
  initialDate,
  editing,
  onDone,
}: {
  timezone: string;
  initialDate: string;            // yyyy-MM-dd
  editing?: CalendarEvent | null; // present = edit mode
  onDone: () => void;
}) {
  const editStart = editing ? formatInTimeZone(editing.starts_at, timezone, "HH:mm") : "09:00";
  const editEnd = editing ? formatInTimeZone(editing.ends_at, timezone, "HH:mm") : "10:00";
  const editDate = editing ? formatInTimeZone(editing.starts_at, timezone, "yyyy-MM-dd") : initialDate;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState<Category>((editing?.category as Category) ?? "gym");
  const [date, setDate] = useState(editDate);
  const [startTime, setStartTime] = useState(editStart);
  const [endTime, setEndTime] = useState(editEnd);
  const [isFixed, setIsFixed] = useState(editing?.is_fixed ?? CATEGORY_DEFAULT_FIXED.gym);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickCategory(c: Category) {
    setCategory(c);
    if (!editing) setIsFixed(CATEGORY_DEFAULT_FIXED[c]);
  }

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Введи название");
    if (endTime <= startTime) return setError("Конец должен быть позже начала");
    const input: EventFormInput = { title, category, date, start_time: startTime, end_time: endTime, is_fixed: isFixed, notes };
    setPending(true);
    try {
      if (editing) await updateEventAction(editing.id, input);
      else await createEventAction(input);
      onDone();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setPending(true);
    try {
      await deleteEventAction(editing.id);
      onDone();
    } catch {
      setError("Не удалось удалить");
    } finally {
      setPending(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none";

  return (
    <div className="flex flex-col gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" className={inputCls} />

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => pickCategory(c)}
            className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: category === c ? "#fff" : "#1a1a1a", color: category === c ? "#000" : "#888" }}
          >
            {CATEGORY_EMOJI[c]} {CATEGORY_LABEL_RU[c]}
          </button>
        ))}
      </div>

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      <div className="flex gap-3">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} flex-1`} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputCls} flex-1`} />
      </div>

      <button
        onClick={() => setIsFixed((v) => !v)}
        className="flex items-center justify-between rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white"
      >
        <span>{isFixed ? "Фиксированное" : "Гибкое"}</span>
        <span className="text-xs text-[#777]">{isFixed ? "нельзя двигать" : "ИИ может подвинуть"}</span>
      </button>

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Примечание" rows={2} className={inputCls} />

      {error && <p className="text-center text-xs text-red-400">{error}</p>}

      <button onClick={submit} disabled={pending} className="rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
        {pending ? "Сохраняю…" : editing ? "Сохранить" : "Добавить"}
      </button>
      {editing && (
        <button onClick={remove} disabled={pending} className="rounded-xl bg-[#1a1a1a] py-3 text-sm font-semibold text-red-400 disabled:opacity-50">
          Удалить
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/capture/confirm-card.tsx`**:

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { createParsedEventAction } from "@/lib/events/actions";
import { categoryEmoji } from "@/lib/events/categories";
import type { ParsedEvent } from "@/lib/events/types";

export function ConfirmCard({
  parsed,
  timezone,
  onConfirmed,
  onEdit,
  onCancel,
}: {
  parsed: ParsedEvent;
  timezone: string;
  onConfirmed: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = formatInTimeZone(parsed.starts_at, timezone, "d MMMM, EEE", { locale: ru });
  const start = formatInTimeZone(parsed.starts_at, timezone, "HH:mm");
  const end = formatInTimeZone(parsed.ends_at, timezone, "HH:mm");

  async function confirm() {
    setError(null);
    setPending(true);
    try {
      await createParsedEventAction(parsed);
      onConfirmed();
    } catch {
      setError("Не удалось добавить");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-[#1a1a1a] p-4">
        <p className="text-base font-semibold text-white">{categoryEmoji(parsed.category)} {parsed.title}</p>
        <p className="mt-1 text-sm text-[#999]">{day}, {start}–{end} · {parsed.is_fixed ? "фиксированное" : "гибкое"}</p>
      </div>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={confirm} disabled={pending} className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
          {pending ? "…" : "✅ Добавить"}
        </button>
        <button onClick={onEdit} className="rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white">✏️</button>
        <button onClick={onCancel} className="rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-[#999]">✕</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/capture/capture-sheet.tsx`** (NL tab with mic + text, manual tab; routes NL → confirm card → optional edit):

```tsx
"use client";

import { useRef, useState } from "react";

import { ConfirmCard } from "./confirm-card";
import { EventForm } from "./event-form";
import type { CalendarEvent, ParsedEvent } from "@/lib/events/types";

type Mode = "nl" | "manual" | "confirm";

export function CaptureSheet({
  timezone,
  defaultDate,
  editing,
  onClose,
}: {
  timezone: string;
  defaultDate: string;       // yyyy-MM-dd
  editing?: CalendarEvent | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(editing ? "manual" : "nl");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedEvent | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  async function runParse(input: string) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/parse-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) throw new Error();
      const { parsed: p } = (await res.json()) as { parsed: ParsedEvent };
      setParsed(p);
      setMode("confirm");
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
          await runParse(transcript);
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

  const inputCls = "w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#111] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        {mode !== "confirm" && !editing && (
          <div className="mb-4 flex gap-2">
            <button onClick={() => setMode("nl")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "nl" ? "#fff" : "#1a1a1a", color: mode === "nl" ? "#000" : "#888" }}>Текстом / голосом</button>
            <button onClick={() => setMode("manual")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "manual" ? "#fff" : "#1a1a1a", color: mode === "manual" ? "#000" : "#888" }}>Вручную</button>
          </div>
        )}

        {mode === "nl" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-white">Что добавить?</p>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="завтра зал в 7 на час" className={`${inputCls} flex-1`} />
              <button onClick={toggleRecording} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#1a1a1a] text-lg" aria-label="Голос">{recording ? "⏹️" : "🎤"}</button>
            </div>
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
            <button onClick={() => runParse(text)} disabled={pending || !text.trim()} className="rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
              {pending ? "Думаю…" : "Разобрать"}
            </button>
          </div>
        )}

        {mode === "manual" && (
          <EventForm timezone={timezone} initialDate={defaultDate} editing={editing} onDone={onClose} />
        )}

        {mode === "confirm" && parsed && (
          <ConfirmCard
            parsed={parsed}
            timezone={timezone}
            onConfirmed={onClose}
            onEdit={() => setMode("manual")}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/api/transcribe/route.ts`** (Mini App voice → Whisper). Reuses `getOpenAI`:

```ts
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getOpenAI } from "@/lib/openai";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "no_audio" }, { status: 400 });

  try {
    const openai = getOpenAI();
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "ru",
    });
    return NextResponse.json({ text: result.text });
  } catch {
    return NextResponse.json({ error: "transcribe_failed" }, { status: 422 });
  }
}
```

- [ ] **Step 6: Replace `src/components/calendar/calendar-screen.tsx`** to wire capture + edit:

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { DayView } from "./day-view";
import { CaptureSheet } from "@/components/capture/capture-sheet";
import type { CalendarEvent } from "@/lib/events/types";

export function CalendarScreen({
  events,
  monthStr,
  timezone,
}: {
  events: CalendarEvent[];
  monthStr: string;
  timezone: string;
}) {
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  return (
    <>
      <DayView
        events={events}
        monthStr={monthStr}
        timezone={timezone}
        onEventClick={(e) => { setEditing(e); setSheetOpen(true); }}
      />
      {/* FAB lives in the bottom nav; expose an opener via a custom event */}
      <button
        onClick={() => { setEditing(null); setSheetOpen(true); }}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg"
        aria-label="Добавить"
      >
        +
      </button>
      {sheetOpen && (
        <CaptureSheet
          timezone={timezone}
          defaultDate={todayStr}
          editing={editing}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
    </>
  );
}
```

> Design note: the calendar screen renders its own `+` FAB (which also handles edit-on-tap), so the bottom-nav `+` is redundant on the calendar screen. Keep the nav `+` only for the notes screen → it links to `/calendar` where the FAB lives. Simpler: in Step 7 make the nav center button a Link to `/calendar`.

- [ ] **Step 7: Update `src/components/bottom-nav.tsx`** — center button becomes a Link to `/calendar` (the calendar screen owns the capture FAB):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const isCalendar = pathname.startsWith("/calendar");
  const isNotes = pathname.startsWith("/notes");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#1a1a1a] bg-[#0f0f0f] px-6 py-2">
      <Link href="/calendar" className="flex flex-col items-center gap-0.5 text-[10px]" style={{ color: isCalendar ? "#fff" : "#555" }}>
        <span className="text-lg">📅</span>
        Календарь
      </Link>
      <Link href="/calendar" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-bold text-black" aria-label="Добавить">+</Link>
      <Link href="/notes" className="flex flex-col items-center gap-0.5 text-[10px]" style={{ color: isNotes ? "#fff" : "#555" }}>
        <span className="text-lg">📝</span>
        Заметки
      </Link>
    </nav>
  );
}
```

- [ ] **Step 8: Verify compile + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next build`
Expected: build succeeds; routes include `/calendar`, `/api/parse-event`, `/api/transcribe`.

- [ ] **Step 9: Commit**

```bash
git add src/components/capture "src/app/api/parse-event" "src/app/api/transcribe" src/components/calendar/calendar-screen.tsx src/components/bottom-nav.tsx
git commit -m "feat: capture sheet (NL + voice + manual) and event edit"
```

---

## Task 9: Notes screen

**Files:**
- Create: `src/components/notes/task-list.tsx`, `src/components/notes/day-notes.tsx`, `src/app/(app)/notes/page.tsx`

- [ ] **Step 1: Create `src/components/notes/task-list.tsx`**:

```tsx
"use client";

import { useState } from "react";

import { addTaskAction, toggleTaskAction, deleteNoteAction } from "@/lib/notes/actions";
import type { Note } from "@/lib/notes/types";

export function TaskList({ tasks }: { tasks: Note[] }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setPending(true);
    try {
      await addTaskAction(text);
      setText("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Новая задача"
          className="flex-1 rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none"
        />
        <button onClick={add} disabled={pending} className="rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-50">+</button>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <button onClick={() => toggleTaskAction(t.id, !t.done)} className="text-base" aria-label="Отметить">
              {t.done ? "☑" : "☐"}
            </button>
            <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-[#555] line-through" : "text-white"}`}>{t.content}</span>
            <button onClick={() => deleteNoteAction(t.id)} className="text-xs text-[#555]" aria-label="Удалить">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/notes/day-notes.tsx`**:

```tsx
"use client";

import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import { deleteNoteAction } from "@/lib/notes/actions";
import type { Note } from "@/lib/notes/types";

export function DayNotes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <p className="text-xs text-[#555]">Пока нет заметок на конкретные дни.</p>;
  }
  return (
    <div className="space-y-1.5">
      {notes.map((n) => (
        <div key={n.id} className="flex items-start gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
          <span className="flex-shrink-0 text-xs font-semibold text-[#3b82f6]">
            {n.date ? format(parseISO(n.date), "d MMM", { locale: ru }) : ""}
          </span>
          <span className="min-w-0 flex-1 text-sm text-white">{n.content}</span>
          <button onClick={() => deleteNoteAction(n.id)} className="text-xs text-[#555]" aria-label="Удалить">✕</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/notes/page.tsx`**:

```tsx
import { TaskList } from "@/components/notes/task-list";
import { DayNotes } from "@/components/notes/day-notes";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getTasks, getDayNotes } from "@/lib/notes/queries";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#3b82f6] text-xl font-bold text-white">w</span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const [tasks, dayNotes] = await Promise.all([getTasks(user.id), getDayNotes(user.id)]);

  return (
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-2xl font-bold text-white">Заметки</h1>
      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Задачи</p>
        <TaskList tasks={tasks} />
      </section>
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">На день</p>
        <DayNotes notes={dayNotes} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify compile + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next build`
Expected: build succeeds; routes include `/notes`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/notes" src/components/notes
git commit -m "feat: notes screen with tasks and day notes"
```

---

## Task 10: Bot capture (text + voice)

**Files:**
- Create: `src/lib/bot/handler.ts`
- Modify: `src/app/api/bot/route.ts`

- [ ] **Step 1: Create `src/lib/bot/handler.ts`**

Bot behavior (Layer 1): a text or voice message describing an event → parse → create immediately → reply with a confirmation card carrying a single "🗑 Удалить" inline button (Undo). Editing happens in the Mini App.

```ts
import { formatInTimeZone } from "date-fns-tz";

import { getOpenAI, transcribeVoice } from "@/lib/openai";
import { parseEvent } from "@/lib/events/parse";
import { insertEvent, deleteEventById } from "@/lib/events/queries";
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
```

- [ ] **Step 2: Wire `src/app/api/bot/route.ts`**:

```ts
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
```

- [ ] **Step 3: Verify compile + tests + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all tests pass (categories, grid, parse, openai-voice).

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot "src/app/api/bot/route.ts"
git commit -m "feat: bot capture via text and voice"
```

---

## Task 11: Day-note composer in the calendar day view

**Files:**
- Modify: `src/app/(app)/calendar/page.tsx` (fetch day notes, pass down)
- Modify: `src/components/calendar/calendar-screen.tsx` (thread day notes)
- Modify: `src/components/calendar/day-view.tsx` (show selected day's note + composer)

- [ ] **Step 1: Fetch day notes in the calendar page.** In `src/app/(app)/calendar/page.tsx`, add the import and fetch, then pass `dayNotes` to `CalendarScreen`.

Add import:
```tsx
import { getDayNotes } from "@/lib/notes/queries";
```

Replace the events fetch + render block (the `const events = ...` line and the `return <CalendarScreen ... />`) with:
```tsx
  const [events, dayNotes] = await Promise.all([
    getEventsInRange(user.id, start, end),
    getDayNotes(user.id),
  ]);

  return <CalendarScreen events={events} dayNotes={dayNotes} monthStr={monthStr} timezone={user.timezone} />;
```

- [ ] **Step 2: Thread `dayNotes` through `calendar-screen.tsx`.** Update the props and the `DayView` usage:

```tsx
"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { DayView } from "./day-view";
import { CaptureSheet } from "@/components/capture/capture-sheet";
import type { CalendarEvent } from "@/lib/events/types";
import type { Note } from "@/lib/notes/types";

export function CalendarScreen({
  events,
  dayNotes,
  monthStr,
  timezone,
}: {
  events: CalendarEvent[];
  dayNotes: Note[];
  monthStr: string;
  timezone: string;
}) {
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const todayStr = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  return (
    <>
      <DayView
        events={events}
        dayNotes={dayNotes}
        monthStr={monthStr}
        timezone={timezone}
        onEventClick={(e) => { setEditing(e); setSheetOpen(true); }}
      />
      <button
        onClick={() => { setEditing(null); setSheetOpen(true); }}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-bold text-black shadow-lg"
        aria-label="Добавить"
      >
        +
      </button>
      {sheetOpen && (
        <CaptureSheet
          timezone={timezone}
          defaultDate={todayStr}
          editing={editing}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Show the selected day's note + composer in `day-view.tsx`.** Add the `dayNotes` prop, compute the selected day's note, and render it above the events list with an inline composer.

Add the import near the top:
```tsx
import { addDayNoteAction } from "@/lib/notes/actions";
import type { Note } from "@/lib/notes/types";
```

Add `dayNotes` to the props signature:
```tsx
export function DayView({
  events,
  dayNotes,
  timezone,
  monthStr,
  onEventClick,
}: {
  events: CalendarEvent[];
  dayNotes: Note[];
  timezone: string;
  monthStr: string;
  onEventClick: (event: CalendarEvent) => void;
}) {
```

Inside the component, after `dayEvents` is computed, add the selected day's note plus composer state:
```tsx
  const selectedNote = useMemo(
    () => dayNotes.find((n) => n.date === selectedDate) ?? null,
    [dayNotes, selectedDate],
  );
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function saveDayNote() {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    try {
      await addDayNoteAction(noteDraft, selectedDate);
      setNoteDraft("");
    } finally {
      setSavingNote(false);
    }
  }
```

Render the note block immediately after the `<div className="mx-4 my-2 border-t border-[#1a1a1a]" />` divider and before the events list:
```tsx
      <div className="px-4 pb-3">
        {selectedNote ? (
          <p className="rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs text-[#bbb]">📌 {selectedNote.content}</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveDayNote(); }}
              placeholder="＋ заметка дня"
              className="flex-1 rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs text-white placeholder-[#555] outline-none"
            />
            {noteDraft.trim() && (
              <button onClick={saveDayNote} disabled={savingNote} className="rounded-xl bg-white px-3 text-xs font-semibold text-black disabled:opacity-50">ОК</button>
            )}
          </div>
        )}
      </div>
```

(Note: `useMemo` and `useState` are already imported at the top of `day-view.tsx` from Task 7.)

- [ ] **Step 4: Verify compile + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/calendar/page.tsx" src/components/calendar/calendar-screen.tsx src/components/calendar/day-view.tsx
git commit -m "feat: day-note composer in calendar day view"
```

---

## Self-Review

**Spec coverage:**
- ✅ Open app → calendar (`page.tsx` redirect → `(app)/calendar`, Task 1 + 7)
- ✅ `events` table with `is_fixed`, `notes` table (Task 1)
- ✅ Categories with emoji + default fixedness (Task 2)
- ✅ Month grid math, Monday-first (Task 3)
- ✅ Event CRUD + actions (Task 4)
- ✅ Notes: tasks (date null) + day notes (date set) (Task 5, 9)
- ✅ NL parser, OpenAI, timezone-aware (Task 6)
- ✅ Calendar UI: month grid, day view, fixed vs flexible visual (Task 7)
- ✅ Capture: NL text + voice + manual form + confirm card (Task 8)
- ✅ Notes screen (Task 9)
- ✅ Bot capture text + voice (Task 10)
- ✅ Day-note creation from calendar day view (Task 11)
- ✅ Keep infra, delete old feature code (Task 1)

**Type consistency:** `Category`, `CalendarEvent`, `ParsedEvent` (events/types.ts) and `Note` (notes/types.ts) are used consistently. `EventFormInput` defined in actions.ts, consumed by event-form.tsx. `parseEvent(text, {today, timezone})` signature consistent across parse.ts, the `/api/parse-event` route, and the bot handler.

**Placeholders:** none — every step has complete code.

**Known scope notes:**
- Bot uses create-then-Undo rather than confirm-before-save (no pending-state table); the Mini App is the confirm-flow surface. Documented in Task 10.
