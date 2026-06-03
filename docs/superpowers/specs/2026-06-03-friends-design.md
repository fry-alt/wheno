# Smart Calendar — Layer 3a: Friends

**Date:** 2026-06-03
**Status:** Design approved, ready for implementation plan
**Part of:** Layer 3 (shared meetings). 3a = Friends (this spec) is the prerequisite for 3b = Meetings.

---

## Overview

Let two wheno users become friends so they can later schedule shared meetings. A user shares an invite link; the recipient opens it and is shown an "accept / decline" request; on accept they become mutual friends. A Friends screen lists accepted friends and incoming requests.

**Stack (unchanged):** Next.js 15 App Router · React 19 · TypeScript · Supabase · `@telegram-apps/sdk` · Tailwind v4 · Vitest.

**Scope (3a):** establishing friendships only. Proposing/scheduling meetings is 3b (next sub-project). No chat, no presence, no groups (N>2 friendships are just many pairwise rows).

---

## Goals

1. Generate a shareable invite link tied to the current user.
2. When the recipient opens it, create a pending friend request (with the recipient's explicit accept/decline).
3. A Friends screen: incoming requests (accept/decline) + accepted friends (with remove).
4. Everything owner-scoped: a user can only act on requests addressed to them and friendships they're part of.

---

## Data Model

**`users` += `invite_code`** — short unique code, generated lazily the first time the user opens the invite share. Avoids exposing internal UUIDs in links.

```sql
alter table public.users add column if not exists invite_code text unique;
```

**New table `friendships`:**
```sql
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status       text not null default 'pending', -- 'pending' | 'accepted'
  created_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships(requester_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);
alter table public.friendships enable row level security; -- service-role only, like other tables
```

- A friendship is **unordered** semantically: A↔B equals B↔A. A query helper looks up an existing row in either direction before creating a new one, so a reverse-direction invite never creates a duplicate.
- `status = 'accepted'` in either direction means the two are friends.

---

## Types

```ts
// src/lib/types.ts — AppUser gains:
//   invite_code: string | null;

// src/lib/friends/types.ts
export interface FriendSummary {
  user_id: string;          // the OTHER user's id
  name: string;             // display name from users
  username: string | null;
  photo_url: string | null;
  friendship_id: string;
}

export interface IncomingRequest {
  friendship_id: string;
  from_user_id: string;
  name: string;
  username: string | null;
  photo_url: string | null;
}
```

---

## Invite + Accept Flow

### Sending (inviter A)

- Friends screen has an **"Пригласить друга"** button.
- On tap: `ensureInviteCode()` (server action) generates the user's `invite_code` if absent and returns it; the client builds the link and opens the native Telegram share sheet (`@telegram-apps/sdk` share, falling back to copy).
- **Link:** `buildFriendInviteLink(code)`:
  - If `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` and `NEXT_PUBLIC_TELEGRAM_MINIAPP` are set → `https://t.me/<bot>/<app>?startapp=<code>` (opens the Mini App with a start param).
  - Else (fallback) → `<NEXT_PUBLIC_APP_URL>/friends?invite=<code>` (plain web link).

### Opening (recipient B)

- A small client component (`start-param-handler`) runs on app open. It reads the invite code from **either** source:
  - Telegram start param via `@telegram-apps/sdk` (`retrieveLaunchParams().tgWebAppStartParam`), or
  - the URL query `?invite=<code>` (web fallback).
- If a code is present, it POSTs to `/api/friend-request` with the code.
- The route resolves the code → inviter A; with the current user B it:
  - rejects self-invite (A == B) and missing/unknown code,
  - if an A↔B friendship row already exists (any direction/status) → no-op,
  - else inserts a `pending` row `(requester_id = A, addressee_id = B)`.
- Then the handler routes the user to `/friends` so they see the request.

### Confirming (recipient B)

- Friends screen shows an **"Запросы"** section listing incoming `pending` rows where `addressee_id = B`.
- **Принять** → `acceptFriendRequest(friendshipId)` sets `status = 'accepted'` (only if the current user is the addressee).
- **Отклонить** → `declineFriendRequest(friendshipId)` deletes the row (only if the current user is the addressee).

### Removing

- **✕** on a friend → `removeFriend(friendshipId)` deletes the row (only if the current user is a participant).

### Server actions (`src/lib/friends/actions.ts`)
`ensureInviteCode(): Promise<string>` · `acceptFriendRequest(id)` · `declineFriendRequest(id)` · `removeFriend(id)`. The pending-request creation lives in the API route (it runs for the recipient on open), not a form action.

---

## Screen & Navigation

Bottom nav becomes three real tabs (drop the redundant center "+", since the calendar screen owns its own add FAB):

```
┌─────────────────────────────────┐
│   📅          👥          📝     │
│ Календарь   Друзья    Заметки   │
└─────────────────────────────────┘
```

**`/friends` screen:**
```
Друзья                       [Пригласить]

Запросы                              ← only if incoming pending exist
┌────────────────────────────────┐
│ 👤 Андрей · хочет добавить      │
│         [Принять] [Отклонить]   │
└────────────────────────────────┘

Мои друзья
┌────────────────────────────────┐
│ 👤 Маша                      ✕  │
│ 👤 Олег                      ✕  │
└────────────────────────────────┘
```
- Empty: "Пока никого. Нажми «Пригласить» и кинь ссылку другу."
- Avatar + name from `users` (already stored). Reuse `getDisplayName`.
- A friend row is a button that, in 3b, becomes "propose a meeting" — for 3a it is inert (or shows a disabled hint). Keep the row a simple element so 3b can wire an onClick.

---

## Files

### Create
| File | Responsibility |
|---|---|
| `src/lib/friends/types.ts` | `FriendSummary`, `IncomingRequest` |
| `src/lib/friends/queries.ts` | friendship CRUD, unordered-pair lookup, find-by-invite-code, generate code |
| `src/lib/friends/queries.test.ts` | unit: code generation, unordered-pair lookup, no-dup |
| `src/lib/friends/actions.ts` | `ensureInviteCode`, accept/decline/remove |
| `src/app/api/friend-request/route.ts` | accept startapp code → create pending request |
| `src/app/(app)/friends/page.tsx` | friends screen (server: friends + requests) |
| `src/components/friends/friends-screen.tsx` | list + requests + invite button (client) |
| `src/components/friends/start-param-handler.tsx` | read start param/`?invite=` on open → POST |

### Modify
| File | Change |
|---|---|
| `supabase/schema.sql` | `users.invite_code`; `friendships` table (+ manual `ALTER`/create on live DB) |
| `src/lib/types.ts` | `AppUser` += `invite_code: string \| null` |
| `src/lib/env.ts` | add `getTelegramBotUsername()`, `getMiniAppName()` (optional, public) |
| `src/lib/utils.ts` | `buildFriendInviteLink(code)` |
| `src/components/bottom-nav.tsx` | three tabs (Календарь · Друзья · Заметки) |
| `src/app/(app)/layout.tsx` | mount `start-param-handler` so it runs on any app screen |

### Reuse
`getCurrentUser`/`requireCurrentUser`, `getAdminSupabase`, `getDisplayName`, the avatar rendering pattern, `@telegram-apps/sdk` (already used in `session-bootstrap`), the old groups invite-code generation approach (short alphabet).

---

## Error Handling

- Unknown/expired code → API returns 404; handler silently no-ops (no error UI — opening a stale link just lands on /friends).
- Self-invite → ignored.
- Existing friendship/request → no-op (idempotent open).
- Accept/decline/remove by a non-participant → action throws (owner-scoped `where` matches nothing → explicit guard).
- Missing bot-username env → `buildFriendInviteLink` uses the web fallback; the handler also reads `?invite=`, so the flow still works.

---

## Testing

- `friends/queries.test.ts`: invite-code generator produces unique non-empty codes; unordered-pair lookup finds A↔B given a B↔A row; creating a request when one already exists is detected as existing.
- Actions, route, UI: verified via `npx tsc --noEmit` and `npx next build`.
- Manual: open own invite link as a second Telegram account → request appears → accept → both see each other in friends.

---

## Out of Scope (3a)

- Proposing/scheduling meetings (that is 3b).
- Friend search/discovery, mutual-friends, blocking.
- Notifications when a request arrives (the recipient sees it next time they open Friends; bot notification can come in 3b).
- Group friendships (only pairwise).
