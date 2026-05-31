# Part 3: Voice Messages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users send voice messages to the bot. Whisper transcribes them, bot shows the transcription and asks to confirm before adding the event.

**Architecture:** `bot-handler.ts` detects `msg.voice`, calls `transcribeVoice` (downloads OGG from Telegram, sends to Whisper). Transcription stored in `pending_voice` table (TTL 5 min). User confirms via inline button → transcription passed to GPT as regular text.

**Tech Stack:** TypeScript, OpenAI Whisper API (`whisper-1`), Telegram Bot API, Supabase admin client

**Depends on:** Part 2 (uses `handleCallbackQuery` infrastructure)

---

## File Map

**Create:**
- `supabase/schema_v4.sql` — `pending_voice` table

**Modify:**
- `src/lib/openai.ts` — add `transcribeVoice`
- `src/lib/db/queries.ts` — add `pending_voice` CRUD
- `src/lib/types.ts` — add `PendingVoice` type
- `src/lib/bot-handler.ts` — voice message handling + voice callback

---

## Task 1: pending_voice DB table

**Files:**
- Create: `supabase/schema_v4.sql`

- [ ] **Step 1: Create `supabase/schema_v4.sql`**

```sql
-- wheno v4 — voice transcription state

create table if not exists public.pending_voice (
  user_id       uuid primary key references public.users(id) on delete cascade,
  transcription text not null,
  expires_at    timestamptz not null default (now() + interval '5 minutes')
);
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase dashboard → SQL Editor → paste and run.
Expected: table `pending_voice` created.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_v4.sql
git commit -m "feat: add pending_voice table migration"
```

---

## Task 2: transcribeVoice function + test

**Files:**
- Modify: `src/lib/openai.ts`

- [ ] **Step 1: Write a failing test for `transcribeVoice` signature**

Create `src/lib/openai-voice.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// We only test that the function exists and accepts the right args.
// Integration with Whisper requires a real API key — test at the manual step.
describe("transcribeVoice", () => {
  it("is exported from openai.ts", async () => {
    const mod = await import("./openai");
    expect(typeof mod.transcribeVoice).toBe("function");
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx vitest run src/lib/openai-voice.test.ts
```
Expected: FAIL — `transcribeVoice is not a function`

- [ ] **Step 3: Add `transcribeVoice` to `src/lib/openai.ts`**

Add at the bottom of the file:

```typescript
// Add getTelegramBotToken to the EXISTING import from "@/lib/env" in openai.ts
// (don't add a second import line — just extend the existing one)

export async function transcribeVoice(fileId: string): Promise<string> {
  const token = getTelegramBotToken();

  // 1. Get file path from Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
  );
  const fileJson = (await fileRes.json()) as { result: { file_path: string } };
  const filePath = fileJson.result.file_path;

  // 2. Download OGG audio
  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${token}/${filePath}`,
  );
  const audioBuffer = await audioRes.arrayBuffer();

  // 3. Transcribe with Whisper
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

Note: `getTelegramBotToken` import — add it to the existing import from `@/lib/env` if already present, otherwise add a new import line.

- [ ] **Step 4: Run — verify PASS**

```bash
npx vitest run src/lib/openai-voice.test.ts
```
Expected: PASS

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/openai.ts src/lib/openai-voice.test.ts
git commit -m "feat: add transcribeVoice using OpenAI Whisper"
```

---

## Task 3: pending_voice type + CRUD

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db/queries.ts`

- [ ] **Step 1: Add `PendingVoice` type to `src/lib/types.ts`**

```typescript
export type PendingVoice = {
  user_id: string;
  transcription: string;
  expires_at: string;
};
```

- [ ] **Step 2: Add CRUD to `src/lib/db/queries.ts`**

Add `PendingVoice` to the type imports. Then add at the bottom:

```typescript
export async function savePendingVoice(userId: string, transcription: string): Promise<void> {
  const admin = getAdminSupabase();
  await admin.from("pending_voice").upsert(
    { user_id: userId, transcription, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() },
    { onConflict: "user_id" },
  );
}

export async function getPendingVoice(userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("pending_voice")
    .select("transcription, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await admin.from("pending_voice").delete().eq("user_id", userId);
    return null;
  }
  return data.transcription;
}

export async function deletePendingVoice(userId: string): Promise<void> {
  const admin = getAdminSupabase();
  await admin.from("pending_voice").delete().eq("user_id", userId);
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
git commit -m "feat: add PendingVoice type and CRUD"
```

---

## Task 4: Voice message handler in bot-handler.ts

**Files:**
- Modify: `src/lib/bot-handler.ts`

- [ ] **Step 1: Add voice imports to `src/lib/bot-handler.ts`**

Add to the imports at the top:

```typescript
import { transcribeVoice } from "@/lib/openai";
import {
  savePendingVoice,
  getPendingVoice,
  deletePendingVoice,
} from "@/lib/db/queries";
```

- [ ] **Step 2: Update `handleBotMessage` to handle `msg.voice`**

The function signature already accepts `update.message`. Extend the `message` type to include `voice`:

```typescript
export async function handleBotMessage(update: {
  message?: {
    from?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string };
    chat: { id: number };
    text?: string;
    voice?: { file_id: string; duration: number };
  };
})
```

After the existing `/start` handler block and before step 3 "Build context for AI", add:

```typescript
  // Handle voice message
  if (msg.voice) {
    const typing = sendMessage(chatId, "🎤 Слушаю...");
    let transcription: string;
    try {
      transcription = await transcribeVoice(msg.voice.file_id);
    } catch {
      await typing;
      await sendMessage(chatId, lang === "ru" ? "Не смог распознать голос, попробуй ещё раз." : "Couldn't transcribe. Please try again.");
      return;
    }
    await typing;

    await savePendingVoice(user.id, transcription);

    const confirmText = lang === "ru"
      ? `🎤 Расслышал: «${transcription}»\n\nДобавить событие?`
      : `🎤 I heard: «${transcription}»\n\nAdd this event?`;

    const reply_markup = {
      inline_keyboard: [[
        { text: lang === "ru" ? "✅ Добавить" : "✅ Add", callback_data: "voice_confirm" },
        { text: lang === "ru" ? "✏️ Исправить" : "✏️ Edit", callback_data: "voice_edit" },
        { text: lang === "ru" ? "❌ Отмена" : "❌ Cancel", callback_data: "voice_cancel" },
      ]],
    };

    await sendMessage(chatId, confirmText, reply_markup);
    return;
  }
```

- [ ] **Step 3: Add voice callbacks to `handleCallbackQuery` in `src/lib/bot-handler.ts`**

Inside `handleCallbackQuery`, before the final `if (data === "cancel")` block, add:

```typescript
  // voice_confirm — process saved transcription as text
  if (data === "voice_confirm") {
    const { data: userRows } = await getAdminSupabase()
      .from("users").select("id, timezone").eq("telegram_id", String(callbackQuery.from.id)).limit(1);
    const dbUser = userRows?.[0] as { id: string; timezone: string } | undefined;
    if (!dbUser) return;

    const transcription = await getPendingVoice(dbUser.id);
    if (!transcription) {
      await sendMessage(chatId, lang === "ru" ? "Сессия истекла, отправь голосовое снова." : "Session expired, send voice again.");
      return;
    }
    await deletePendingVoice(dbUser.id);

    // Process as a normal text message
    await handleBotMessage({
      message: {
        from: callbackQuery.from,
        chat: { id: chatId },
        text: transcription,
      },
    });
    return;
  }

  // voice_edit — ask for corrected text
  if (data === "voice_edit") {
    await sendMessage(chatId, lang === "ru"
      ? "Напиши исправленный вариант текстом:"
      : "Type the corrected version:");
    return;
  }

  // voice_cancel
  if (data === "voice_cancel") {
    const { data: userRows } = await getAdminSupabase()
      .from("users").select("id").eq("telegram_id", String(callbackQuery.from.id)).limit(1);
    const userId = (userRows?.[0] as { id: string } | undefined)?.id;
    if (userId) await deletePendingVoice(userId);
    await sendMessage(chatId, lang === "ru" ? "Окей, отменено." : "Cancelled.");
    return;
  }
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Build**

```bash
npx next build
```
Expected: successful

- [ ] **Step 6: Deploy**

```bash
git add src/lib/bot-handler.ts
git commit -m "feat: voice message transcription with Whisper and confirmation flow"
git push origin main
```

- [ ] **Step 7: Manual test**

1. Send a voice message to the bot: record "завтра зал в шесть вечера"
2. Bot replies: `🎤 Расслышал: «завтра зал в шесть вечера»` + buttons
3. Tap `✅ Добавить` → event added, card response shown
4. Send another voice message
5. Tap `✏️ Исправить` → bot asks to type correction → type text → event added
6. Send another voice message → tap `❌ Отмена` → cancelled
