# Bot Instant Notifications — Design

**Date:** 2026-06-09

---

## Overview

When a social action happens in the Mini App, the Telegram bot sends the affected
user a direct message so they learn about it without having the app open. This
covers the full friend + meeting loop (requests, acceptances, and final meeting
confirmation). Each notification is a one-shot, best-effort side effect of an
existing server action — it never blocks or breaks the action that triggered it.

This is the first of three planned notification features. **Event reminders**
(cron-scheduled, with delivery state) and **calendar view switching** are separate
specs/cycles and are explicitly out of scope here.

---

## Goals

1. A user is told, in their Telegram chat, when:
   - someone sends them a friend request,
   - their friend request is accepted,
   - someone proposes a meeting to them,
   - their meeting proposal is accepted,
   - a meeting is confirmed with a final time (both participants).
2. Notifications are best-effort: a delivery failure (user never pressed Start,
   blocked the bot, network error) must never fail the originating action or its
   `revalidatePath`.
3. Each notification carries an inline **"Открыть"** button that opens the Mini App
   on the Friends screen (HTTPS only).

## Non-Goals (YAGNI)

- No `notifications` table, delivery queue, retries, or history (that belongs to the
  reminders feature, not here).
- No decline notifications (friend decline / meeting decline) — avoids awkwardness,
  keeps the loop positive.
- No per-recipient language: the app is Russian-first and the recipient's language is
  not stored. All messages are Russian.

---

## Architecture

Two new modules plus inline calls in existing server actions:

```
friends/actions.ts ─┐
meetings/actions.ts ─┼─→ notifyUser(userId, text, {openButton}) ─→ sendTelegramMessage(chatId, …) ─→ Telegram API
                     │        (resolve telegram_id, best-effort, swallow errors)
bot/handler.ts ──────┘──────────────────────────────────────────→ (reuses sendTelegramMessage)
```

A notification is emitted **after** the state-changing mutation succeeds. Because the
mutations are status-scoped (e.g. `setIncomingStatus` only matches `pending` rows), a
repeated no-op accept/confirm does not re-send.

---

## Components

### `src/lib/telegram/send.ts` (new)

Low-level sender, extracted from `bot/handler.ts`:

```ts
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  const token = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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

`bot/handler.ts` is refactored to import and use this; its private `sendMessage` is
deleted (behavior unchanged — `answerCallback` stays as-is).

### `src/lib/telegram/notify.ts` (new)

Domain notification layer. Resolves the recipient, attaches the Open button, and
swallows every error so callers never need a try/catch.

```ts
export function openButton(): object | undefined {
  const url = `${getAppUrl()}/friends`;
  return url.startsWith("https://")
    ? { inline_keyboard: [[{ text: "Открыть", web_app: { url } }]] }
    : undefined; // web_app buttons require HTTPS; skip in local dev
}

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

Pure, testable message builders live here too:

```ts
export const friendRequestMsg  = (name: string) => `👋 <b>${name}</b> хочет добавить вас в друзья`;
export const friendAcceptedMsg = (name: string) => `✅ <b>${name}</b> принял ваш запрос в друзья`;
export const meetingProposedMsg = (name: string, title: string) => `📅 <b>${name}</b> предлагает встречу: «${title}»`;
export const meetingAcceptedMsg = (name: string, title: string) => `✅ <b>${name}</b> принял встречу «${title}» — выберите время`;
export const meetingConfirmedMsg = (other: string, title: string, when: string) => `🤝 «${title}» с ${other} — ${when}`;
```

> Note: names/titles originate from Telegram profiles and user input. They are
> interpolated into `parse_mode: "HTML"` text, so the builders must HTML-escape `& < >`
> (a small `escapeHtml` helper) to avoid breaking the message or injecting markup.

### Messages

| Trigger | Recipient | Text |
|---|---|---|
| Friend request created | addressee | `👋 <b>{name}</b> хочет добавить вас в друзья` |
| Friend request accepted | requester | `✅ <b>{name}</b> принял ваш запрос в друзья` |
| Meeting proposed | addressee | `📅 <b>{name}</b> предлагает встречу: «{title}»` |
| Meeting accepted | initiator | `✅ <b>{name}</b> принял встречу «{title}» — выберите время` |
| Meeting confirmed | **both** | `🤝 «{title}» с {other} — {when}` |

`{name}` is the acting user's display name (`getDisplayName(requireCurrentUser())`).
`{when}` is `slot.starts_at` rendered in the **recipient's** timezone via
`formatInTimeZone(starts_at, tz, "EEE, d MMMM, HH:mm", { locale: ru })`, so the
confirmation builds two distinct messages (each recipient sees the other's name and
their own local time).

---

## Action wiring

### `src/lib/friends/queries.ts`
Add a by-id getter (needed to learn who to notify on accept):

```ts
export async function getFriendshipById(id: string): Promise<Friendship | null>;
```

### `src/lib/friends/actions.ts`
- `sendFriendRequest`: after `createPendingRequest(user.id, targetId)` →
  `notifyUser(targetId, friendRequestMsg(getDisplayName(user)))`.
- `acceptFriendRequest`: after `acceptRequest(...)`, load `getFriendshipById(friendshipId)`,
  and if present → `notifyUser(friendship.requester_id, friendAcceptedMsg(getDisplayName(user)))`.

### `src/lib/meetings/actions.ts`
- `proposeMeeting`: after `createProposal(...)` →
  `notifyUser(friendId, meetingProposedMsg(getDisplayName(user), title))`.
- `acceptMeeting`: after `setIncomingStatus(...)`, `getProposal(proposalId)` for
  `from_user_id` + `title` → `notifyUser(proposal.from_user_id, meetingAcceptedMsg(getDisplayName(user), proposal.title))`.
  (Guard: only notify when the proposal exists and is now `accepted`.)
- `confirmMeeting`: after `confirmProposalSlot(...)`, notify **both**:
  - friend: `meetingConfirmedMsg(myName, title, whenInFriendTz)`
  - initiator: `meetingConfirmedMsg(friendName, title, whenInMyTz)`
  `friend` and the initiator's timezone are already loaded in this action.

All `notifyUser` calls are `await`ed (serverless cannot reliably fire-and-forget after
the response) but cannot throw, so they add one best-effort round-trip and nothing more.

---

## Error handling & edge cases

- **Recipient hasn't started the bot / blocked it** → Telegram returns 403 →
  `sendTelegramMessage` throws → `notifyUser` swallows and logs. Action unaffected.
- **Local dev (http)** → `openButton()` returns `undefined`; the message itself may
  also fail to deliver (no real chat) — acceptable under best-effort.
- **No-op transitions** (repeated accept/confirm) → scoped mutation matches no row, so
  the surrounding logic should only notify on a real change. For `acceptMeeting`, re-read
  the proposal and skip notifying if it is not `accepted`. For `acceptFriendRequest`, a
  repeated accept could in theory re-notify (the row already reads `accepted`); this is
  acceptable — the UI removes the request card after the first accept, so a double-accept
  is not a real path, and the cost is at most one duplicate friendly DM.
- **HTML-unsafe names/titles** → escaped by the builders.
- **Self-actions** → already impossible (cannot friend/meet yourself; enforced upstream).

---

## Testing

`src/lib/telegram/notify.test.ts` (Vitest), pure parts only:

- Each message builder returns the expected string with interpolation.
- `escapeHtml` neutralizes `& < >` in names/titles.
- `openButton()` returns a `web_app` keyboard for an `https://` `APP_URL` and
  `undefined` for an `http://` one.

`notifyUser` and `sendTelegramMessage` (network + DB) are not unit-tested.

---

## Files

**Create**
- `src/lib/telegram/send.ts`
- `src/lib/telegram/notify.ts`
- `src/lib/telegram/notify.test.ts`

**Modify**
- `src/lib/bot/handler.ts` — use `sendTelegramMessage`, drop private `sendMessage`
- `src/lib/friends/queries.ts` — add `getFriendshipById`
- `src/lib/friends/actions.ts` — notify on request + accept
- `src/lib/meetings/actions.ts` — notify on propose + accept + confirm

**No changes:** DB schema, auth, calendar, advisor.
