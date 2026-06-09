# Bot Instant Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a friend/meeting action happens in the Mini App, the Telegram bot sends the affected user a best-effort direct message with an "Открыть" button.

**Architecture:** A low-level `sendTelegramMessage` (extracted from the bot handler) is wrapped by a best-effort `notifyUser` that resolves the recipient's `telegram_id`, attaches an optional Mini-App button, and swallows all errors. Existing server actions call `notifyUser` after their state mutation; the call can never throw.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (admin client), `date-fns-tz` + `date-fns/locale` (`ru`), Vitest.

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `src/lib/telegram/send.ts` | `sendTelegramMessage(chatId, text, replyMarkup?)` — single Telegram `sendMessage` HTTP call |
| `src/lib/telegram/notify.ts` | `escapeHtml`, message builders, `openButton`, best-effort `notifyUser(userId, text, withOpenButton?)` |
| `src/lib/telegram/notify.test.ts` | unit tests for builders, `escapeHtml`, `openButton` |

### Modify
| File | Change |
|---|---|
| `src/lib/bot/handler.ts` | use `sendTelegramMessage`; delete the private `sendMessage` |
| `src/lib/friends/queries.ts` | add `getFriendshipById` |
| `src/lib/friends/actions.ts` | notify on friend request created + accepted |
| `src/lib/meetings/actions.ts` | notify on meeting proposed + accepted + confirmed |

---

## Task 1: Extract the low-level Telegram sender

**Files:**
- Create: `src/lib/telegram/send.ts`
- Modify: `src/lib/bot/handler.ts`

- [ ] **Step 1: Create `src/lib/telegram/send.ts`**

```ts
import { getTelegramBotToken } from "@/lib/env";

/** One Telegram `sendMessage` call. Throws on a non-OK response. */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${getTelegramBotToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage failed: ${res.status}`);
}
```

- [ ] **Step 2: Refactor `src/lib/bot/handler.ts` to use it**

Add this import near the other top-of-file imports:

```ts
import { sendTelegramMessage } from "@/lib/telegram/send";
```

Delete the private `sendMessage` function (lines ~26-33):

```ts
async function sendMessage(chatId: number, text: string, replyMarkup?: object): Promise<void> {
  const { getTelegramBotToken } = await import("@/lib/env");
  await fetch(`https://api.telegram.org/bot${getTelegramBotToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
  });
}
```

Then replace every remaining call `sendMessage(` in this file with `sendTelegramMessage(`. There are 7 call sites (the voice-fallback, three add-event paths, the event card, and two callback replies). Each is a literal rename of the function name only — arguments stay identical, e.g.:

```ts
await sendTelegramMessage(message.chat.id, "Не расслышал, напиши текстом.");
```
```ts
await sendTelegramMessage(message.chat.id, built.text, built.reply_markup);
```
```ts
await sendTelegramMessage(cb.message.chat.id, "🗑 Удалено.");
```

Leave `answerCallback` unchanged.

- [ ] **Step 3: Verify no leftover references**

Run: `npx tsc --noEmit`
Expected: no errors.
Run (PowerShell): `Select-String -Path src/lib/bot/handler.ts -Pattern '\bsendMessage\('`
Expected: no matches (every call is now `sendTelegramMessage`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/telegram/send.ts src/lib/bot/handler.ts
git commit -m "refactor: extract sendTelegramMessage; bot handler reuses it"
```

---

## Task 2: Notification module (builders + escape + button) — TDD

**Files:**
- Create: `src/lib/telegram/notify.ts`
- Test: `src/lib/telegram/notify.test.ts`

- [ ] **Step 1: Write the failing test — `src/lib/telegram/notify.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  escapeHtml,
  friendRequestMsg,
  friendAcceptedMsg,
  meetingProposedMsg,
  meetingAcceptedMsg,
  meetingConfirmedMsg,
  openButton,
} from "./notify";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe("escapeHtml", () => {
  it("neutralizes &, <, >", () => {
    expect(escapeHtml('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; "d"');
  });
});

describe("message builders", () => {
  it("builds the five messages with interpolation", () => {
    expect(friendRequestMsg("Аня")).toBe("👋 <b>Аня</b> хочет добавить вас в друзья");
    expect(friendAcceptedMsg("Аня")).toBe("✅ <b>Аня</b> принял ваш запрос в друзья");
    expect(meetingProposedMsg("Аня", "Кофе")).toBe("📅 <b>Аня</b> предлагает встречу: «Кофе»");
    expect(meetingAcceptedMsg("Аня", "Кофе")).toBe("✅ <b>Аня</b> принял встречу «Кофе» — выберите время");
    expect(meetingConfirmedMsg("Аня", "Кофе", "ср, 11 июня, 14:00")).toBe("🤝 «Кофе» с Аня — ср, 11 июня, 14:00");
  });

  it("escapes HTML-unsafe names and titles", () => {
    expect(friendRequestMsg("<b>x</b>")).toBe("👋 <b>&lt;b&gt;x&lt;/b&gt;</b> хочет добавить вас в друзья");
    expect(meetingProposedMsg("A&B", "1<2")).toBe("📅 <b>A&amp;B</b> предлагает встречу: «1&lt;2»");
  });
});

describe("openButton", () => {
  it("returns a web_app keyboard for an https APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://wheno.vercel.app";
    expect(openButton()).toEqual({
      inline_keyboard: [[{ text: "Открыть", web_app: { url: "https://wheno.vercel.app/friends" } }]],
    });
  });

  it("returns undefined for a non-https APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(openButton()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `npx vitest run src/lib/telegram/notify.test.ts`
Expected: FAIL (cannot find module `./notify` / exports undefined).

- [ ] **Step 3: Create `src/lib/telegram/notify.ts`**

```ts
import { getAppUrl } from "@/lib/env";
import { getUserById } from "@/lib/users";
import { sendTelegramMessage } from "./send";

/** Escape the three characters that matter for Telegram parse_mode "HTML". */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const friendRequestMsg = (name: string) =>
  `👋 <b>${escapeHtml(name)}</b> хочет добавить вас в друзья`;
export const friendAcceptedMsg = (name: string) =>
  `✅ <b>${escapeHtml(name)}</b> принял ваш запрос в друзья`;
export const meetingProposedMsg = (name: string, title: string) =>
  `📅 <b>${escapeHtml(name)}</b> предлагает встречу: «${escapeHtml(title)}»`;
export const meetingAcceptedMsg = (name: string, title: string) =>
  `✅ <b>${escapeHtml(name)}</b> принял встречу «${escapeHtml(title)}» — выберите время`;
export const meetingConfirmedMsg = (other: string, title: string, when: string) =>
  `🤝 «${escapeHtml(title)}» с ${escapeHtml(other)} — ${when}`;

/** Inline "Открыть" button → Mini App on the Friends screen. web_app needs HTTPS. */
export function openButton(): object | undefined {
  const url = `${getAppUrl()}/friends`;
  return url.startsWith("https://")
    ? { inline_keyboard: [[{ text: "Открыть", web_app: { url } }]] }
    : undefined;
}

/**
 * Best-effort DM to a user. Resolves their telegram_id, attaches the Open button,
 * and swallows every error so callers never need a try/catch and the originating
 * action is never affected by a delivery failure.
 */
export async function notifyUser(
  userId: string,
  text: string,
  withOpenButton = true,
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user?.telegram_id) return;
    await sendTelegramMessage(user.telegram_id, text, withOpenButton ? openButton() : undefined);
  } catch (err) {
    console.error("notifyUser failed", err);
  }
}
```

- [ ] **Step 4: Run — verify PASS**

Run: `npx vitest run src/lib/telegram/notify.test.ts`
Expected: PASS (4 tests).
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram/notify.ts src/lib/telegram/notify.test.ts
git commit -m "feat: notifyUser + message builders for bot notifications"
```

---

## Task 3: Wire friend-request notifications

**Files:**
- Modify: `src/lib/friends/queries.ts`
- Modify: `src/lib/friends/actions.ts`

- [ ] **Step 1: Add `getFriendshipById` to `src/lib/friends/queries.ts`**

Add at the end of the file (the file already imports `getAdminSupabase` and the `Friendship` type):

```ts
export async function getFriendshipById(id: string): Promise<Friendship | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("friendships")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Friendship | null) ?? null;
}
```

- [ ] **Step 2: Replace the imports and two functions in `src/lib/friends/actions.ts`**

Update the `./queries` import to add `getFriendshipById`, and add the notify + utils imports:

```ts
import {
  ensureInviteCodeForUser,
  findUserIdByInviteCode,
  findFriendshipBetween,
  createPendingRequest,
  acceptRequest,
  declineRequest,
  removeFriendship,
  getFriendshipById,
} from "./queries";
import { getDisplayName } from "@/lib/utils";
import { notifyUser, friendRequestMsg, friendAcceptedMsg } from "@/lib/telegram/notify";
```

Replace `sendFriendRequest` so it notifies the target after the request is created:

```ts
export async function sendFriendRequest(code: string): Promise<SendRequestResult> {
  const user = await requireCurrentUser();
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, reason: "empty" };

  const targetId = await findUserIdByInviteCode(trimmed);
  if (!targetId) return { ok: false, reason: "not_found" };
  if (targetId === user.id) return { ok: false, reason: "self" };

  const existing = await findFriendshipBetween(user.id, targetId);
  if (existing) return { ok: false, reason: "exists" };

  // I enter a friend's code → I'm the requester, they accept/decline.
  await createPendingRequest(user.id, targetId);
  await notifyUser(targetId, friendRequestMsg(getDisplayName(user)));
  revalidatePath("/friends");
  return { ok: true };
}
```

Replace `acceptFriendRequest` so it notifies the original requester:

```ts
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const user = await requireCurrentUser();
  await acceptRequest(user.id, friendshipId);
  const friendship = await getFriendshipById(friendshipId);
  if (friendship) {
    await notifyUser(friendship.requester_id, friendAcceptedMsg(getDisplayName(user)));
  }
  revalidatePath("/friends");
}
```

Leave `declineFriendRequest`, `removeFriend`, `ensureInviteCode` unchanged.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all pass (no existing test depends on these actions).

- [ ] **Step 4: Commit**

```bash
git add src/lib/friends/queries.ts src/lib/friends/actions.ts
git commit -m "feat: notify on friend request created and accepted"
```

---

## Task 4: Wire meeting notifications

**Files:**
- Modify: `src/lib/meetings/actions.ts`

- [ ] **Step 1: Add imports to `src/lib/meetings/actions.ts`**

Add these near the existing imports (`getDisplayName` is already imported; do not duplicate it):

```ts
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { normalizeTimezone } from "@/lib/telegram";
import { notifyUser, meetingProposedMsg, meetingAcceptedMsg, meetingConfirmedMsg } from "@/lib/telegram/notify";
```

- [ ] **Step 2: Notify the addressee at the end of `proposeMeeting`**

Replace the tail of `proposeMeeting` (the `createProposal(...)` call through `revalidatePath`) with:

```ts
  await createProposal({
    from_user_id: user.id,
    to_user_id: friendId,
    title,
    category: "meeting",
    duration_min: form.duration_min,
    window_from: form.window_from,
    window_to: form.window_to,
    part_of_day: form.part_of_day,
  });
  await notifyUser(friendId, meetingProposedMsg(getDisplayName(user), title));
  revalidatePath("/friends");
```

- [ ] **Step 3: Notify the initiator in `acceptMeeting`**

Replace the whole `acceptMeeting` function with:

```ts
export async function acceptMeeting(proposalId: string): Promise<void> {
  const user = await requireCurrentUser();
  await setIncomingStatus(user.id, proposalId, "accepted");
  const proposal = await getProposal(proposalId);
  if (proposal && proposal.status === "accepted") {
    await notifyUser(
      proposal.from_user_id,
      meetingAcceptedMsg(getDisplayName(user), proposal.title),
    );
  }
  revalidatePath("/friends");
}
```

- [ ] **Step 4: Notify both participants at the end of `confirmMeeting`**

In `confirmMeeting`, the chosen-slot stamp is wrapped in a `try/catch` that ends with `confirmProposalSlot(...)`. Immediately **after** that `try/catch` block and **before** the two `revalidatePath` calls, insert:

```ts
  const whenForFriend = formatInTimeZone(
    slot.starts_at,
    normalizeTimezone(friend?.timezone ?? timezone),
    "EEE, d MMMM, HH:mm",
    { locale: ru },
  );
  const whenForMe = formatInTimeZone(
    slot.starts_at,
    normalizeTimezone(timezone),
    "EEE, d MMMM, HH:mm",
    { locale: ru },
  );
  await notifyUser(friendId, meetingConfirmedMsg(myName, proposal.title, whenForFriend));
  await notifyUser(user.id, meetingConfirmedMsg(friendName, proposal.title, whenForMe));
```

(`friend`, `friendName`, `myName`, `timezone`, `proposal`, and `slot` are all already in scope in `confirmMeeting`.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all pass.
Run: `npx next build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/meetings/actions.ts
git commit -m "feat: notify on meeting proposed, accepted, and confirmed"
```

---

## Self-Review

**Spec coverage:**
- ✅ Friend request created → addressee notified — Task 3 (`sendFriendRequest`).
- ✅ Friend request accepted → requester notified — Task 3 (`acceptFriendRequest` + `getFriendshipById`).
- ✅ Meeting proposed → addressee notified — Task 4 (`proposeMeeting`).
- ✅ Meeting accepted → initiator notified — Task 4 (`acceptMeeting`, re-read guarded on `accepted`).
- ✅ Meeting confirmed → both notified with each recipient's local time — Task 4 (`confirmMeeting`).
- ✅ Best-effort, never throws — Task 2 (`notifyUser` try/catch).
- ✅ Open button, HTTPS-only — Task 2 (`openButton`).
- ✅ HTML escaping of names/titles — Task 2 (`escapeHtml` in every builder).
- ✅ Low-level sender extracted + handler reuse — Task 1.
- ✅ No schema change — confirmed (no task touches `supabase/schema.sql`).

**Placeholder scan:** none — every step shows complete code or an exact command.

**Type consistency:** `sendTelegramMessage(chatId, text, replyMarkup?)` (Task 1) is consumed by `notifyUser` (Task 2) and `handler.ts` (Task 1). `notifyUser(userId, text, withOpenButton?)` and the five builders (Task 2) are consumed by Tasks 3-4 with matching arities. `getFriendshipById` returns `Friendship` (Task 3) and `.requester_id` is read in `acceptFriendRequest` (matches the `friendships` columns used elsewhere in `queries.ts`). `getProposal` returns `MeetingProposal` with `from_user_id`, `status`, `title` (existing type) — read in `acceptMeeting`. `formatInTimeZone` + `ru` usage mirrors `src/lib/datetime.ts`.

**Edge cases:** recipient hasn't started/blocked the bot → 403 swallowed; local http → no button (and best-effort delivery); repeated `acceptMeeting` → guarded by `status === "accepted"` re-read; repeated `acceptFriendRequest` → at most one duplicate DM (acceptable per spec); self-actions impossible upstream.
