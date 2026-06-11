# Profiles / Personal Cabinet — design (social pivot, cycle 1)

**Date:** 2026-06-11
**Status:** approved (brainstorm)
**Part of:** the "meet people through activities" social pivot. This is sub-project 1 of ~5 (Profiles → Public activities + discovery → AI matching → Places → Trust & safety). Each sub-project is its own spec → plan → implement cycle.

## Goal

Give every wheno user a real profile / personal cabinet — the identity foundation the social product depends on. A user can view and edit their own profile (photo gallery, bio, city, interests, age, gender, privacy toggles), and the public parts of a profile render on other users' pages (the existing `/friends/[id]`).

This cycle ships **identity only**. Discovery of strangers, the activity feed, matching, and stranger-visibility rules are later cycles. We build on wheno's existing assets (Telegram identity, Supabase, Refined-dark UI primitives, server-action + admin-client pattern).

## Product context (decided in brainstorm)

- **Product shape:** activity-first — people meet by doing activities together, not by swiping. Profiles support that; they are not a swipe deck.
- **First slice:** Profiles / personal cabinet (this doc).
- **Interests:** curated tags + custom.
- **Photos:** gallery up to 6 via Supabase Storage.
- **Age & gender:** included, with per-field show/hide privacy.
- **Navigation:** add a 4th bottom-nav item 👤 "Профиль".

## Scope

**In scope:**
- Own cabinet at `/profile`: view + edit.
- Photo gallery (upload / delete / set main), up to 6, via Supabase Storage.
- Fields: bio, city, birthdate (→ age), gender, interests (curated + custom), `show_age` / `show_gender` toggles.
- Public projection of a profile (honoring privacy) rendered on `/friends/[id]`.
- 4th bottom-nav entry 👤.
- Refined-dark visuals on existing tokens/primitives.

**Out of scope (later cycles):**
- Stranger discovery, activity feed, AI matching, places.
- Whole-profile visibility model (who-can-see). This cycle: a profile's public projection is visible to friends (via `/friends/[id]`) and self; field-level privacy is limited to age/gender toggles.
- Content moderation, photo NSFW checks, verification — flagged for the Trust & Safety cycle. Basic risk noted below.
- Chat (Telegram covers it).

## Data model (new in `supabase/schema.sql`)

```sql
create table if not exists public.profiles (
  user_id     uuid primary key references public.users(id) on delete cascade,
  bio         text,
  city        text,
  birthdate   date,
  gender      text,                         -- 'male' | 'female' | 'other' (null = unset); visibility via show_gender
  show_age    boolean not null default true,
  show_gender boolean not null default true,
  interests   text[]  not null default '{}',-- curated slugs + custom strings
  updated_at  timestamptz not null default now()
);
-- + enable RLS, set_updated_at trigger (match existing tables)

create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  storage_path text not null,
  position     int  not null default 0,     -- 0 = main
  created_at   timestamptz not null default now()
);
create index if not exists profile_photos_user_idx on public.profile_photos(user_id, position);
-- + enable RLS
```

- **Storage:** new bucket `profile-photos`, public read. Object path `${userId}/${uuid}` (extension from upload). The public URL is stored/derived from `storage_path`.
- **`profiles` is 1:1 with `users`** and kept separate so the auth/user entity stays lean. A user may have no `profiles` row yet → treat as empty profile.
- **Interests** are a Postgres `text[]` mixing curated slugs and raw custom strings. Curated slugs validate against `INTEREST_TAGS`; custom are trimmed free strings.

## Interest tags

New `src/lib/profile/interests.ts`, modeled on `categories.ts`:

```ts
export interface InterestTag { slug: string; emoji: string; label: string }
export const INTEREST_TAGS: InterestTag[] = [ /* ~24 */ ];
export function isInterestSlug(s: string): boolean
export function interestLabel(s: string): string   // slug → "🎾 Теннис"; custom → the raw string
```

~24 tags (running, tennis, cycling, climbing, gym, yoga, football, basketball, swimming, coffee, food, cooking, movies, music, concerts, travel, boardgames, videogames, hiking, photography, art, reading, dancing, languages). Russian labels (hardcoded, project convention).

## Architecture

**Route:** `src/app/(app)/profile/page.tsx` (server) — loads the current user's profile + photos, renders `ProfileScreen`. `force-dynamic`.

**Components** (`src/components/profile/`):
- `ProfileScreen` — owns view/edit state for the current user; composes the pieces; calls server actions; `router.refresh()` after writes.
- `PhotoGallery` — grid of up to 6; upload (file input), delete, set-main; optimistic-ish via refresh; disabled "add" at 6.
- `InterestPicker` — curated chips (toggle) + "добавить свой" input; reflects selected `interests`.
- `ProfileFields` — bio (textarea), city (input), birthdate (date input), gender (select), `show_age` / `show_gender` toggles.
- `ProfileView` (read-only) — renders a public projection (photos, name, age?, gender?, city, bio, interests) for reuse on `/friends/[id]`.

**Server actions** (`src/lib/profile/actions.ts`, `"use server"`, all via `requireCurrentUser` + `getAdminSupabase`):
- `updateProfileAction(fields)` — upsert scalar fields (validates/normalizes interests, gender enum, birthdate).
- `uploadProfilePhotoAction(formData)` — enforces ≤6, uploads to Storage, inserts `profile_photos` row (position = current count).
- `deleteProfilePhotoAction(id)` — removes Storage object + row (ownership-checked).
- `setMainPhotoAction(id)` — sets that photo `position=0`, others shifted (ownership-checked).
- Each `revalidatePath("/profile")` (and the friend page is dynamic).

**Queries** (`src/lib/profile/queries.ts`):
- `getProfile(userId)` → `{ ...profileRow|defaults, photos }` (full, for own cabinet).
- `getPublicProfile(userId)` → `publicProfileProjection` applied (age/gender hidden per toggles) + photos — for `/friends/[id]`.
- `upsertProfile`, `insertPhoto`, `deletePhoto`, `setMainPhoto`.

**Navigation:** add 👤 "Профиль" → `/profile` to `bottom-nav.tsx` (now 4 items).

**Friend page:** `/friends/[id]` renders `ProfileView` with `getPublicProfile(id)` above its existing busy-grid/meeting UI.

## Privacy

- `show_age` / `show_gender` are applied **server-side** in `getPublicProfile` — hidden fields are never sent to other users' clients (not just CSS-hidden).
- Age is derived from `birthdate` via `ageFromBirthdate`; the public projection exposes a number or nothing, never the raw birthdate.
- Photos are public-by-URL (same model as Telegram avatars today). Tightening (signed URLs, per-photo visibility) is deferred to the Trust & Safety cycle and noted as a known risk.

## Testing

Pure logic, TDD (Vitest), in `src/lib/profile/`:
- `ageFromBirthdate(birthdate, today): number` — incl. birthday-not-yet-passed this year.
- `publicProfileProjection(profile): PublicProfile` — drops `birthdate`/exposes `age` only if `show_age`; drops `gender` if `show_gender` false; never leaks raw birthdate.
- `normalizeInterests(raw: unknown): string[]` — keep valid slugs, trim custom strings, dedupe, cap length (e.g. 12), drop empties.
- Photo limit (≤6) is enforced in `uploadProfilePhotoAction`; cover the count check with a small unit on a pure helper `canAddPhoto(currentCount)`.

Components + upload verified via `tsc`/`lint`/`build` and live screenshots.

## Deploy gotcha (manual, like `meeting_proposals`)

Before this works in prod, run once in Supabase:
1. The `profiles` + `profile_photos` table SQL (added to `supabase/schema.sql`).
2. Create the public Storage bucket `profile-photos`.

No automated migration exists; the cabinet throws at runtime until both are present. Document in the backlog memory.

## Risks
- **Stranger safety/photos:** public photo URLs + soon-public profiles need moderation/abuse controls — owned by the Trust & Safety cycle, not this one. Don't expose profiles to non-friends until that lands.
- **Storage setup is manual** — easy to forget; surfaced above + in backlog.
- **Birthdate is sensitive** — only `age` (or nothing) ever leaves the server.
